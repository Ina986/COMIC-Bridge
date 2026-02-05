// Photoshop JSX Script for PSD Conversion
// Based on PSD仕様調整.jsx patterns

#target photoshop

app.displayDialogs = DialogModes.NO;

/* -----------------------------------------------------
  Main Processing
 ----------------------------------------------------- */
function main() {
    // Get settings file path from temp location
    var tempFolder = Folder.temp;
    var settingsFile = new File(tempFolder + "/psd_convert_settings.json");

    if (!settingsFile.exists) {
        alert("Settings file not found: " + settingsFile.fsName);
        return;
    }

    // Read JSON settings with UTF-8 encoding
    settingsFile.open("r");
    settingsFile.encoding = "UTF-8";
    var jsonStr = settingsFile.read();
    settingsFile.close();

    var settings;
    try {
        settings = parseJSON(jsonStr);
    } catch (e) {
        alert("Failed to parse settings: " + e.message);
        return;
    }

    var results = [];

    // Process each file
    for (var i = 0; i < settings.files.length; i++) {
        var fileSettings = settings.files[i];
        var result = processFile(fileSettings, settings.options);
        results.push(result);
    }

    // Write results to output file
    var outputFile = new File(settings.outputPath);
    outputFile.open("w");
    outputFile.encoding = "UTF-8";
    outputFile.write(arrayToJSON(results));
    outputFile.close();
}

function processFile(fileSettings, options) {
    var result = {
        filePath: fileSettings.path,
        success: false,
        changes: [],
        error: null
    };

    var doc = null;

    try {
        var file = new File(fileSettings.path);
        if (!file.exists) {
            result.error = "File not found: " + fileSettings.path;
            return result;
        }

        // Open the file
        doc = app.open(file);

        // 1. Convert to 8-bit if needed (do this first for better compatibility)
        if (options.target_bit_depth && fileSettings.needs_bit_depth_change) {
            var currentBits = doc.bitsPerChannel;
            var targetBits;

            if (options.target_bit_depth === 8) {
                targetBits = BitsPerChannelType.EIGHT;
            } else if (options.target_bit_depth === 16) {
                targetBits = BitsPerChannelType.SIXTEEN;
            }

            if (targetBits && currentBits !== targetBits) {
                var oldBits = (currentBits === BitsPerChannelType.EIGHT) ? 8 :
                              (currentBits === BitsPerChannelType.SIXTEEN) ? 16 : 32;
                doc.bitsPerChannel = targetBits;
                result.changes.push("Bits: " + oldBits + " -> " + options.target_bit_depth);
            }
        }

        // 2. Color mode conversion
        if (options.target_color_mode && fileSettings.needs_color_mode_change) {
            var currentMode = doc.mode;
            var targetMode;

            if (options.target_color_mode === "Grayscale") {
                targetMode = DocumentMode.GRAYSCALE;
            } else if (options.target_color_mode === "RGB") {
                targetMode = DocumentMode.RGB;
            }

            if (targetMode && currentMode !== targetMode) {
                var oldModeName = getModeName(currentMode);

                if (options.target_color_mode === "Grayscale") {
                    doc.changeMode(ChangeMode.GRAYSCALE);
                } else if (options.target_color_mode === "RGB") {
                    doc.changeMode(ChangeMode.RGB);
                }
                result.changes.push("Color: " + oldModeName + " -> " + options.target_color_mode);
            }
        }

        // 3. DPI/Resolution change with resampling
        if (options.target_dpi && fileSettings.needs_dpi_change) {
            var currentDpi = doc.resolution;
            var targetDpi = options.target_dpi;

            // Check if change is needed (with 5% tolerance)
            var tolerance = targetDpi * 0.05;
            if (Math.abs(currentDpi - targetDpi) > tolerance) {
                // ResampleMethod.BICUBIC for actual pixel resampling
                doc.resizeImage(undefined, undefined, targetDpi, ResampleMethod.BICUBIC);
                result.changes.push("DPI: " + Math.round(currentDpi) + " -> " + targetDpi + " (resampled)");
            }
        }

        // 4. Remove alpha channels if needed
        if (options.remove_alpha_channels && fileSettings.needs_alpha_removal) {
            var removedChannels = removeExtraChannels(doc);
            if (removedChannels && removedChannels.length > 0) {
                result.changes.push("Removed " + removedChannels.length + " alpha channel(s): " + removedChannels.join(", "));
            }
        }

        // Save the file if changes were made
        if (result.changes.length > 0) {
            var saveOptions = new PhotoshopSaveOptions();
            saveOptions.layers = true;
            saveOptions.embedColorProfile = true;

            // Save as PSD (overwrite original)
            doc.saveAs(file, saveOptions, true, Extension.LOWERCASE);
        }

        // Close document without prompting
        doc.close(SaveOptions.DONOTSAVECHANGES);
        doc = null;

        result.success = true;
        if (result.changes.length === 0) {
            result.changes.push("No changes needed");
        }

    } catch (e) {
        result.error = e.message + " (Line: " + e.line + ")";

        // Try to close document if open
        if (doc) {
            try {
                doc.close(SaveOptions.DONOTSAVECHANGES);
            } catch (e2) {}
        }
    }

    return result;
}

function getModeName(mode) {
    switch (mode) {
        case DocumentMode.BITMAP: return "Bitmap";
        case DocumentMode.GRAYSCALE: return "Grayscale";
        case DocumentMode.RGB: return "RGB";
        case DocumentMode.CMYK: return "CMYK";
        case DocumentMode.LAB: return "Lab";
        case DocumentMode.INDEXEDCOLOR: return "Indexed";
        case DocumentMode.DUOTONE: return "Duotone";
        case DocumentMode.MULTICHANNEL: return "Multichannel";
        default: return "Unknown";
    }
}

/**
 * Remove extra channels (alpha, spot color, etc.)
 * Based on アルファチャンネル削除.jsx
 */
function removeExtraChannels(doc) {
    var removedChannelNames = [];

    try {
        // Loop backwards to avoid index issues when removing
        for (var i = doc.channels.length - 1; i >= 0; i--) {
            var currentChannel = doc.channels[i];
            // ChannelType.COMPONENT = standard color component channels (R, G, B, Gray, etc.)
            // Remove anything else (MASKEDAREA: alpha, SPOTCOLOR: spot color)
            if (currentChannel.kind !== ChannelType.COMPONENT) {
                try {
                    var chName = currentChannel.name;
                    currentChannel.remove();
                    removedChannelNames.push(chName);
                } catch (e) {
                    // Channel might be locked
                }
            }
        }

        return removedChannelNames;

    } catch (e) {
        return null;
    }
}

/* -----------------------------------------------------
  JSON Utilities
 ----------------------------------------------------- */
function valueToJSON(val) {
    if (val === null) {
        return "null";
    } else if (typeof val === "string") {
        return '"' + val.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r") + '"';
    } else if (typeof val === "number" || typeof val === "boolean") {
        return String(val);
    } else if (val instanceof Array) {
        return arrayToJSON(val);
    } else if (typeof val === "object") {
        return objectToJSON(val);
    }
    return "null";
}

function arrayToJSON(arr) {
    var json = "[";
    for (var i = 0; i < arr.length; i++) {
        if (i > 0) json += ",";
        json += valueToJSON(arr[i]);
    }
    json += "]";
    return json;
}

function objectToJSON(obj) {
    var json = "{";
    var first = true;
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            if (!first) json += ",";
            first = false;
            json += '"' + key + '":';
            json += valueToJSON(obj[key]);
        }
    }
    json += "}";
    return json;
}

// JSON parser for ExtendScript
function parseJSON(str) {
    var pos = 0;

    function parseValue() {
        skipWhitespace();
        var ch = str.charAt(pos);

        if (ch === '{') return parseObject();
        if (ch === '[') return parseArray();
        if (ch === '"') return parseString();
        if (ch === 't' || ch === 'f') return parseBoolean();
        if (ch === 'n') return parseNull();
        if (ch === '-' || (ch >= '0' && ch <= '9')) return parseNumber();

        throw new Error("Unexpected character at position " + pos + ": " + ch);
    }

    function skipWhitespace() {
        while (pos < str.length) {
            var ch = str.charAt(pos);
            if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
                pos++;
            } else {
                break;
            }
        }
    }

    function parseObject() {
        var obj = {};
        pos++;
        skipWhitespace();

        if (str.charAt(pos) === '}') {
            pos++;
            return obj;
        }

        while (true) {
            skipWhitespace();
            var key = parseString();
            skipWhitespace();

            if (str.charAt(pos) !== ':') {
                throw new Error("Expected ':' at position " + pos);
            }
            pos++;

            var value = parseValue();
            obj[key] = value;

            skipWhitespace();
            var ch = str.charAt(pos);
            if (ch === '}') {
                pos++;
                return obj;
            }
            if (ch !== ',') {
                throw new Error("Expected ',' or '}' at position " + pos);
            }
            pos++;
        }
    }

    function parseArray() {
        var arr = [];
        pos++;
        skipWhitespace();

        if (str.charAt(pos) === ']') {
            pos++;
            return arr;
        }

        while (true) {
            var value = parseValue();
            arr.push(value);

            skipWhitespace();
            var ch = str.charAt(pos);
            if (ch === ']') {
                pos++;
                return arr;
            }
            if (ch !== ',') {
                throw new Error("Expected ',' or ']' at position " + pos);
            }
            pos++;
        }
    }

    function parseString() {
        pos++;
        var result = "";

        while (pos < str.length) {
            var ch = str.charAt(pos);

            if (ch === '"') {
                pos++;
                return result;
            }

            if (ch === '\\') {
                pos++;
                var escaped = str.charAt(pos);
                switch (escaped) {
                    case '"': result += '"'; break;
                    case '\\': result += '\\'; break;
                    case '/': result += '/'; break;
                    case 'b': result += '\b'; break;
                    case 'f': result += '\f'; break;
                    case 'n': result += '\n'; break;
                    case 'r': result += '\r'; break;
                    case 't': result += '\t'; break;
                    case 'u':
                        var hex = str.substr(pos + 1, 4);
                        result += String.fromCharCode(parseInt(hex, 16));
                        pos += 4;
                        break;
                    default:
                        result += escaped;
                }
                pos++;
            } else {
                result += ch;
                pos++;
            }
        }

        throw new Error("Unterminated string");
    }

    function parseNumber() {
        var start = pos;

        if (str.charAt(pos) === '-') pos++;

        while (pos < str.length && str.charAt(pos) >= '0' && str.charAt(pos) <= '9') {
            pos++;
        }

        if (pos < str.length && str.charAt(pos) === '.') {
            pos++;
            while (pos < str.length && str.charAt(pos) >= '0' && str.charAt(pos) <= '9') {
                pos++;
            }
        }

        if (pos < str.length && (str.charAt(pos) === 'e' || str.charAt(pos) === 'E')) {
            pos++;
            if (str.charAt(pos) === '+' || str.charAt(pos) === '-') pos++;
            while (pos < str.length && str.charAt(pos) >= '0' && str.charAt(pos) <= '9') {
                pos++;
            }
        }

        return parseFloat(str.substring(start, pos));
    }

    function parseBoolean() {
        if (str.substr(pos, 4) === 'true') {
            pos += 4;
            return true;
        }
        if (str.substr(pos, 5) === 'false') {
            pos += 5;
            return false;
        }
        throw new Error("Invalid boolean at position " + pos);
    }

    function parseNull() {
        if (str.substr(pos, 4) === 'null') {
            pos += 4;
            return null;
        }
        throw new Error("Invalid null at position " + pos);
    }

    return parseValue();
}

// Run main
main();
