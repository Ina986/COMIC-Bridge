// Photoshop JSX Script for Layer/Group Rename
// Integrated with app's config/result JSON pattern

#target photoshop

app.displayDialogs = DialogModes.NO;

/* =====================================================
   Main
 ===================================================== */
function main() {
    var tempFolder = Folder.temp;
    var settingsFile = new File(tempFolder + "/psd_rename_settings.json");

    if (!settingsFile.exists) {
        alert("Settings file not found: " + settingsFile.fsName);
        return;
    }

    settingsFile.open("r");
    settingsFile.encoding = "UTF-8";
    var jsonStr = settingsFile.read();
    settingsFile.close();

    // Strip BOM if present
    if (jsonStr.charCodeAt(0) === 0xFEFF) {
        jsonStr = jsonStr.substring(1);
    }

    var settings;
    try {
        settings = parseJSON(jsonStr);
    } catch (e) {
        alert("Failed to parse settings: " + e.message);
        return;
    }

    var files = settings.files;
    var bottomLayer = settings.bottomLayer;
    var rules = settings.rules;
    var fileOutput = settings.fileOutput;
    var outputDirectory = settings.outputDirectory;

    // Resolve output directory
    var outputDir = null;
    if (outputDirectory) {
        var outputDirPath = outputDirectory;
        if (outputDirPath.indexOf("__desktop__") === 0) {
            outputDirPath = Folder.desktop.fsName + outputDirPath.substring("__desktop__".length);
        }
        outputDirPath = outputDirPath.replace(/\//g, ($.os.indexOf("Windows") !== -1) ? "\\" : "/");
        outputDir = new Folder(outputDirPath);
    } else {
        // Default: Desktop/Script_Output/リネーム_PSD
        var desktop = Folder.desktop;
        var scriptOutput = new Folder(desktop + "/Script_Output");
        if (!scriptOutput.exists) scriptOutput.create();
        outputDir = new Folder(scriptOutput + "/リネーム_PSD");
    }
    if (!outputDir.exists) {
        createFolderRecursive(outputDir);
    }

    var originalDisplayDialogs = app.displayDialogs;
    app.displayDialogs = DialogModes.NO;
    var results = [];
    var currentNumber = fileOutput.startNumber || 1;

    try {
        for (var i = 0; i < files.length; i++) {
            var filePath = files[i];
            var result = processFile(filePath, {
                bottomLayer: bottomLayer,
                rules: rules,
                fileOutput: fileOutput,
                outputDir: outputDir,
                currentNumber: currentNumber
            });
            results.push(result);
            if (fileOutput.enabled) {
                currentNumber++;
            }
        }
    } catch (e_main) {
        results.push({
            filePath: "FATAL",
            success: false,
            changes: [],
            error: "Main error: " + e_main.message
        });
    } finally {
        app.displayDialogs = originalDisplayDialogs;
    }

    // Write results
    var outputFile = new File(settings.outputPath);
    outputFile.open("w");
    outputFile.encoding = "UTF-8";
    outputFile.write(arrayToJSON(results));
    outputFile.close();
}

/* =====================================================
   Per-File Processing
 ===================================================== */
function processFile(filePath, opts) {
    var file = new File(filePath);
    var result = {
        filePath: filePath,
        success: false,
        changes: [],
        error: null
    };

    if (!file.exists) {
        result.error = "File not found: " + file.fsName;
        return result;
    }

    var doc = null;
    try {
        doc = app.open(file);
        var docModified = false;

        // 1. Bottom/Background layer rename
        if (opts.bottomLayer && opts.bottomLayer.enabled) {
            var bottomResult = renameBottomLayer(doc, opts.bottomLayer.newName);
            if (bottomResult) {
                result.changes.push("最下位レイヤー → \"" + opts.bottomLayer.newName + "\"");
                docModified = true;
            }
        }

        // 2. Apply rename rules
        if (opts.rules && opts.rules.length > 0) {
            for (var r = 0; r < opts.rules.length; r++) {
                var rule = opts.rules[r];
                if (!rule.oldName || rule.oldName === "") continue;

                var count = traverseAndRename(doc, rule);
                if (count > 0) {
                    var targetLabel = (rule.target === "group") ? "グループ" : "レイヤー";
                    result.changes.push(targetLabel + " \"" + rule.oldName + "\" → \"" + rule.newName + "\" (" + count + "件)");
                    docModified = true;
                }
            }
        }

        // 3. Save
        if (opts.fileOutput && opts.fileOutput.enabled) {
            // Save with sequential naming
            var numberStr = zfill(opts.currentNumber, opts.fileOutput.padding || 3);
            var sep = opts.fileOutput.separator || "_";
            var baseName = opts.fileOutput.baseName || "";
            var newFileName = baseName + sep + numberStr + ".psd";
            var saveFile = new File(opts.outputDir.fsName + "/" + newFileName);

            var psdOpts = new PhotoshopSaveOptions();
            psdOpts.layers = true;
            doc.saveAs(saveFile, psdOpts, true, Extension.LOWERCASE);
            result.success = true;
            result.filePath = saveFile.fsName;
            result.changes.push("保存: " + newFileName);
        } else if (docModified) {
            // Save with original name to output directory
            var originalName = decodeURI(file.name);
            var saveFile = new File(opts.outputDir.fsName + "/" + originalName);

            var psdOpts = new PhotoshopSaveOptions();
            psdOpts.layers = true;
            doc.saveAs(saveFile, psdOpts, true, Extension.LOWERCASE);
            result.success = true;
            result.filePath = saveFile.fsName;
            result.changes.push("保存: " + originalName);
        } else {
            // Nothing changed
            result.success = true;
            result.changes.push("変更なし");
        }

        doc.close(SaveOptions.DONOTSAVECHANGES);

    } catch (e) {
        result.error = "処理エラー: " + e.message;
        if (doc) {
            try { doc.close(SaveOptions.DONOTSAVECHANGES); } catch (e2) {}
        }
    }

    return result;
}

/* =====================================================
   Rename Functions
 ===================================================== */

/**
 * Rename the bottom-most layer (or Background layer)
 */
function renameBottomLayer(document, newName) {
    if (document.layers.length === 0) return false;
    try {
        var bottomLayer = document.layers[document.layers.length - 1];
        if (bottomLayer.name !== newName) {
            bottomLayer.name = newName;
            return true;
        }
        return false;
    } catch (e) {
        return false;
    }
}

/**
 * Recursively traverse and rename layers/groups based on a rule
 * Supports match modes: exact, partial, regex
 * Returns number of renames performed
 */
function traverseAndRename(parent, rule) {
    var count = 0;
    var target = rule.target;       // "layer" or "group"
    var oldName = rule.oldName;
    var newName = rule.newName;
    var matchMode = rule.matchMode; // "exact", "partial", "regex"

    // ArtLayers (regular layers)
    if (target === "layer" || target === "both") {
        if (parent.artLayers) {
            for (var i = 0; i < parent.artLayers.length; i++) {
                var layer = parent.artLayers[i];
                var renamed = applyRename(layer, oldName, newName, matchMode);
                if (renamed) count++;
            }
        }
    }

    // LayerSets (groups)
    if (parent.layerSets) {
        for (var j = 0; j < parent.layerSets.length; j++) {
            var group = parent.layerSets[j];

            // Rename the group itself
            if (target === "group" || target === "both") {
                var renamed = applyRename(group, oldName, newName, matchMode);
                if (renamed) count++;
            }

            // Recurse into children
            count += traverseAndRename(group, rule);
        }
    }

    return count;
}

/**
 * Apply rename to a single layer/group based on match mode
 * Returns true if renamed
 */
function applyRename(item, oldName, newName, matchMode) {
    var currentName = item.name;

    if (matchMode === "exact") {
        if (currentName === oldName) {
            item.name = newName;
            return true;
        }
    } else if (matchMode === "partial") {
        if (currentName.indexOf(oldName) !== -1) {
            // Replace all occurrences of oldName in the current name
            item.name = replaceAll(currentName, oldName, newName);
            return true;
        }
    } else if (matchMode === "regex") {
        try {
            var regex = new RegExp(oldName, "g");
            if (regex.test(currentName)) {
                // Reset lastIndex after test
                regex.lastIndex = 0;
                item.name = currentName.replace(regex, newName);
                return true;
            }
        } catch (e) {
            // Invalid regex, skip
        }
    }
    return false;
}

/**
 * Replace all occurrences of search in str with replacement
 * (ExtendScript-compatible, no String.replaceAll)
 */
function replaceAll(str, search, replacement) {
    var result = str;
    while (result.indexOf(search) !== -1) {
        result = result.replace(search, replacement);
    }
    return result;
}

/**
 * Zero-pad a number to specified length
 */
function zfill(num, len) {
    var s = num.toString();
    while (s.length < len) {
        s = "0" + s;
    }
    return s;
}

/**
 * Recursively create folders
 */
function createFolderRecursive(folder) {
    if (folder.exists) return true;
    var parent = folder.parent;
    if (!parent.exists) createFolderRecursive(parent);
    return folder.create();
}

/* =====================================================
   JSON Parser / Writer (same as replace_layers.jsx)
 ===================================================== */

function valueToJSON(val) {
    if (val === null || val === undefined) {
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
            if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') { pos++; } else { break; }
        }
    }

    function parseObject() {
        var obj = {}; pos++; skipWhitespace();
        if (str.charAt(pos) === '}') { pos++; return obj; }
        while (true) {
            skipWhitespace(); var key = parseString(); skipWhitespace();
            if (str.charAt(pos) !== ':') throw new Error("Expected ':' at position " + pos);
            pos++; var value = parseValue(); obj[key] = value; skipWhitespace();
            var ch = str.charAt(pos);
            if (ch === '}') { pos++; return obj; }
            if (ch !== ',') throw new Error("Expected ',' or '}' at position " + pos);
            pos++;
        }
    }

    function parseArray() {
        var arr = []; pos++; skipWhitespace();
        if (str.charAt(pos) === ']') { pos++; return arr; }
        while (true) {
            var value = parseValue(); arr.push(value); skipWhitespace();
            var ch = str.charAt(pos);
            if (ch === ']') { pos++; return arr; }
            if (ch !== ',') throw new Error("Expected ',' or ']' at position " + pos);
            pos++;
        }
    }

    function parseString() {
        pos++; var result = "";
        while (pos < str.length) {
            var ch = str.charAt(pos);
            if (ch === '"') { pos++; return result; }
            if (ch === '\\') {
                pos++; var escaped = str.charAt(pos);
                switch (escaped) {
                    case '"': result += '"'; break; case '\\': result += '\\'; break;
                    case '/': result += '/'; break; case 'b': result += '\b'; break;
                    case 'f': result += '\f'; break; case 'n': result += '\n'; break;
                    case 'r': result += '\r'; break; case 't': result += '\t'; break;
                    case 'u': var hex = str.substr(pos + 1, 4); result += String.fromCharCode(parseInt(hex, 16)); pos += 4; break;
                    default: result += escaped;
                }
                pos++;
            } else { result += ch; pos++; }
        }
        throw new Error("Unterminated string");
    }

    function parseNumber() {
        var start = pos;
        if (str.charAt(pos) === '-') pos++;
        while (pos < str.length && str.charAt(pos) >= '0' && str.charAt(pos) <= '9') pos++;
        if (pos < str.length && str.charAt(pos) === '.') { pos++; while (pos < str.length && str.charAt(pos) >= '0' && str.charAt(pos) <= '9') pos++; }
        if (pos < str.length && (str.charAt(pos) === 'e' || str.charAt(pos) === 'E')) { pos++; if (str.charAt(pos) === '+' || str.charAt(pos) === '-') pos++; while (pos < str.length && str.charAt(pos) >= '0' && str.charAt(pos) <= '9') pos++; }
        return parseFloat(str.substring(start, pos));
    }

    function parseBoolean() {
        if (str.substr(pos, 4) === 'true') { pos += 4; return true; }
        if (str.substr(pos, 5) === 'false') { pos += 5; return false; }
        throw new Error("Invalid boolean at position " + pos);
    }

    function parseNull() {
        if (str.substr(pos, 4) === 'null') { pos += 4; return null; }
        throw new Error("Invalid null at position " + pos);
    }

    return parseValue();
}

// Run main
main();
