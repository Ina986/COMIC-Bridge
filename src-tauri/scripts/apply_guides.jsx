// Photoshop JSX Script for Applying Guides to PSD Files
// Based on ガイド線コピペ改.jsx patterns

#target photoshop

app.displayDialogs = DialogModes.NO;

/* -----------------------------------------------------
  Main Processing
 ----------------------------------------------------- */
function main() {
    var tempFolder = Folder.temp;
    var settingsFile = new File(tempFolder + "/psd_guide_settings.json");

    if (!settingsFile.exists) {
        alert("Settings file not found: " + settingsFile.fsName);
        return;
    }

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

    // Save current ruler units and switch to pixels
    var startRulerUnits = app.preferences.rulerUnits;
    app.preferences.rulerUnits = Units.PIXELS;

    for (var i = 0; i < settings.files.length; i++) {
        var result = processFile(settings.files[i], settings.guides);
        results.push(result);
    }

    // Restore ruler units
    app.preferences.rulerUnits = startRulerUnits;

    // Write results to output file
    var outputFile = new File(settings.outputPath);
    outputFile.open("w");
    outputFile.encoding = "UTF-8";
    outputFile.write(arrayToJSON(results));
    outputFile.close();
}

function processFile(filePath, guides) {
    var result = {
        filePath: filePath,
        success: false,
        changes: [],
        error: null
    };

    var doc = null;

    try {
        var file = new File(filePath);
        if (!file.exists) {
            result.error = "File not found: " + filePath;
            return result;
        }

        doc = app.open(file);

        // Clear existing guides
        clearGuides();

        // Add new guides
        var addedH = 0;
        var addedV = 0;
        for (var i = 0; i < guides.length; i++) {
            var g = guides[i];
            if (g.direction === "horizontal") {
                doc.guides.add(Direction.HORIZONTAL, new UnitValue(g.position, "px"));
                addedH++;
            } else {
                doc.guides.add(Direction.VERTICAL, new UnitValue(g.position, "px"));
                addedV++;
            }
        }

        result.changes.push("Guides: H=" + addedH + " V=" + addedV);

        // Save
        var saveOptions = new PhotoshopSaveOptions();
        saveOptions.layers = true;
        saveOptions.embedColorProfile = true;
        doc.saveAs(file, saveOptions, true, Extension.LOWERCASE);

        doc.close(SaveOptions.DONOTSAVECHANGES);
        doc = null;

        result.success = true;

    } catch (e) {
        result.error = e.message + " (Line: " + e.line + ")";
        if (doc) {
            try {
                doc.close(SaveOptions.DONOTSAVECHANGES);
            } catch (e2) {}
        }
    }

    return result;
}

/**
 * Clear all guides (from ガイド線コピペ改.jsx)
 */
function clearGuides() {
    try {
        var idDlt = charIDToTypeID("Dlt ");
        var desc = new ActionDescriptor();
        var idnull = charIDToTypeID("null");
        var ref = new ActionReference();
        var idGd = charIDToTypeID("Gd  ");
        var idOrdn = charIDToTypeID("Ordn");
        var idAl = charIDToTypeID("Al  ");
        ref.putEnumerated(idGd, idOrdn, idAl);
        desc.putReference(idnull, ref);
        executeAction(idDlt, desc, DialogModes.NO);
    } catch (e) {
        // No guides to clear - ignore
    }
}

/* -----------------------------------------------------
  JSON Utilities (same as convert_psd.jsx)
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
