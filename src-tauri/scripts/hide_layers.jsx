// Photoshop JSX Script for Layer Visibility Control
// Based on hihyouji_ver1.2.jsx patterns, integrated with app's config/result pattern

#target photoshop

app.displayDialogs = DialogModes.NO;

// Metadata key for storing hidden layer paths (compatible with hihyouji_ver1.2.jsx)
var SETTINGS_KEY = "//@ps_hidden_layer_data_v10:";

// Text folder name patterns
var TEXT_FOLDER_PATTERNS = ["text", "写植", "セリフ", "テキスト", "セリフ層"];

/* -----------------------------------------------------
  Main Processing
 ----------------------------------------------------- */
function main() {
    var tempFolder = Folder.temp;
    var settingsFile = new File(tempFolder + "/psd_layer_visibility_settings.json");

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
    var saveFolder = settings.saveFolder || null;
    var deleteHiddenText = settings.deleteHiddenText || false;

    for (var i = 0; i < settings.files.length; i++) {
        var filePath = settings.files[i];
        var result = processFile(filePath, settings.conditions, settings.mode, saveFolder, deleteHiddenText);
        results.push(result);
    }

    var outputFile = new File(settings.outputPath);
    outputFile.open("w");
    outputFile.encoding = "UTF-8";
    outputFile.write(arrayToJSON(results));
    outputFile.close();
}

/* -----------------------------------------------------
  File Processing
 ----------------------------------------------------- */
function processFile(filePath, conditions, mode, saveFolder, deleteHiddenText) {
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

        if (!doc.layers || doc.layers.length === 0) {
            result.changes.push("No layers found");
            result.success = true;
            doc.close(SaveOptions.DONOTSAVECHANGES);
            return result;
        }

        var isHideMode = (mode === "hide");
        var changedPaths = [];
        var changedNames = [];
        var changedCount = 0;

        // Process layers recursively
        if (conditions.length > 0) {
            changedCount = processLayers(doc.layers, conditions, isHideMode, changedPaths, false, [], changedNames);
        }

        // Delete hidden text layers (second pass)
        var deletedCount = 0;
        var deletedNames = [];
        if (deleteHiddenText && isHideMode) {
            deletedCount = deleteHiddenTextLayers(doc.layers, deletedNames, []);
        }

        if (changedCount > 0 || deletedCount > 0) {
            // Save metadata for later restoration (hide mode only)
            if (isHideMode) {
                saveHiddenLayerData(doc, changedPaths, conditions);
            }

            // Save the file
            var saveOptions = new PhotoshopSaveOptions();
            saveOptions.layers = true;
            saveOptions.embedColorProfile = true;

            if (saveFolder) {
                var outputDir = new Folder(saveFolder);
                if (!outputDir.exists) {
                    createFolderRecursive(outputDir);
                }
                var outFile = new File(outputDir.fsName + "/" + decodeURI(file.name));
                doc.saveAs(outFile, saveOptions, true, Extension.LOWERCASE);
            } else {
                doc.saveAs(file, saveOptions, true, Extension.LOWERCASE);
            }

            // Push individual match details first
            for (var ci = 0; ci < changedNames.length; ci++) {
                result.changes.push("  \u2192 " + changedNames[ci]);
            }
            if (changedCount > 0) {
                result.changes.push((isHideMode ? "Hidden" : "Shown") + " " + changedCount + " layer(s)");
            }
            // Push deleted layer details
            for (var di = 0; di < deletedNames.length; di++) {
                result.changes.push(deletedNames[di]);
            }
            if (deletedCount > 0) {
                result.changes.push("Deleted " + deletedCount + " hidden text layer(s)");
            }
        } else {
            result.changes.push("No matching layers found");
        }

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

/* -----------------------------------------------------
  Layer Traversal & Condition Matching
 ----------------------------------------------------- */
function processLayers(layers, conditions, isHideMode, changedPaths, parentIsTextFolder, currentPath, changedNames) {
    var count = 0;

    for (var i = layers.length - 1; i >= 0; i--) {
        var layer = layers[i];
        var trimmedName = layer.name.replace(/^\s+|\s+$/g, '');
        var layerPath = currentPath.concat([trimmedName]);

        if (layer.typename === "LayerSet") {
            // Check if this is a text folder
            var isTextFolder = isTextFolderByName(trimmedName);

            // Check if this folder itself should be toggled
            var shouldActOnFolder = matchesConditions(layer, trimmedName, conditions, parentIsTextFolder, true);

            // Recurse into children first
            count += processLayers(
                layer.layers, conditions, isHideMode, changedPaths,
                parentIsTextFolder || isTextFolder, layerPath, changedNames
            );

            // Then toggle folder visibility if it matches
            if (shouldActOnFolder) {
                var targetVisible = !isHideMode; // hide: false, show: true
                if (layer.visible !== targetVisible) {
                    layer.visible = targetVisible;
                    count++;
                    var folderParent = currentPath.length > 0 ? currentPath[currentPath.length - 1] : "";
                    changedNames.push("\u30D5\u30A9\u30EB\u30C0\u300C" + trimmedName + "\u300D" + (folderParent ? "\u2208\u300C" + folderParent + "\u300D" : ""));
                    if (isHideMode) {
                        changedPaths.push(layerPath);
                    }
                    if (!isHideMode) {
                        // When showing, also show parent folders
                        ensureParentsVisible(layer);
                    }
                }
            }
        } else if (!layer.isBackgroundLayer) {
            var shouldAct = matchesConditions(layer, trimmedName, conditions, parentIsTextFolder, false);

            if (shouldAct) {
                var targetVisible = !isHideMode;
                if (layer.visible !== targetVisible) {
                    layer.visible = targetVisible;
                    count++;
                    var layerType = (layer.kind === LayerKind.TEXT) ? "\u30C6\u30AD\u30B9\u30C8" : "\u30EC\u30A4\u30E4\u30FC";
                    var layerParent = currentPath.length > 0 ? currentPath[currentPath.length - 1] : "";
                    changedNames.push(layerType + "\u300C" + trimmedName + "\u300D" + (layerParent ? "\u2208\u300C" + layerParent + "\u300D" : ""));
                    if (isHideMode) {
                        changedPaths.push(layerPath);
                    }
                    if (!isHideMode) {
                        ensureParentsVisible(layer);
                    }
                }
            }
        }
    }

    return count;
}

function matchesConditions(layer, trimmedName, conditions, parentIsTextFolder, isFolder) {
    for (var i = 0; i < conditions.length; i++) {
        var cond = conditions[i];

        switch (cond.type) {
            case "textLayers":
                if (!isFolder && layer.kind === LayerKind.TEXT) return true;
                break;

            case "textFolder":
                if (isFolder && isTextFolderByName(trimmedName)) return true;
                // Also match layers inside text folders
                if (!isFolder && parentIsTextFolder) return true;
                break;

            case "layerName":
                if (!isFolder && cond.value) {
                    if (matchesName(trimmedName, cond.value, cond.partialMatch, cond.caseSensitive)) {
                        return true;
                    }
                }
                break;

            case "folderName":
                if (isFolder && cond.value) {
                    if (matchesName(trimmedName, cond.value, cond.partialMatch, cond.caseSensitive)) {
                        return true;
                    }
                }
                break;

            case "custom":
                if (cond.value) {
                    if (matchesName(trimmedName, cond.value, cond.partialMatch, cond.caseSensitive)) {
                        return true;
                    }
                }
                break;
        }
    }
    return false;
}

function isTextFolderByName(name) {
    var lowerName = name.toLowerCase();
    for (var i = 0; i < TEXT_FOLDER_PATTERNS.length; i++) {
        if (lowerName === TEXT_FOLDER_PATTERNS[i].toLowerCase()) return true;
    }
    return false;
}

function matchesName(layerName, searchValue, partialMatch, caseSensitive) {
    var a = caseSensitive ? layerName : layerName.toLowerCase();
    var b = caseSensitive ? searchValue : searchValue.toLowerCase();
    if (partialMatch) {
        return a.indexOf(b) !== -1;
    }
    return a === b;
}

function ensureParentsVisible(layer) {
    var current = layer.parent;
    while (current && current.typename !== "Document") {
        if (!current.visible) {
            current.visible = true;
        }
        current = current.parent;
    }
}

/* -----------------------------------------------------
  Delete Hidden Text Layers
 ----------------------------------------------------- */
function deleteHiddenTextLayers(layers, deletedNames, currentPath) {
    var count = 0;
    for (var i = layers.length - 1; i >= 0; i--) {
        var layer = layers[i];
        var trimmedName = layer.name.replace(/^\s+|\s+$/g, '');
        var layerPath = currentPath.concat([trimmedName]);

        if (layer.typename === "LayerSet") {
            count += deleteHiddenTextLayers(layer.layers, deletedNames, layerPath);
        } else if (layer.kind === LayerKind.TEXT && !layer.visible) {
            var parentName = currentPath.length > 0 ? currentPath[currentPath.length - 1] : "";
            deletedNames.push("  \u2192 \u524A\u9664\u300C" + trimmedName + "\u300D" + (parentName ? "\u2208\u300C" + parentName + "\u300D" : ""));
            layer.remove();
            count++;
        }
    }
    return count;
}

/* -----------------------------------------------------
  Metadata Save (compatible with hihyouji_ver1.2.jsx)
 ----------------------------------------------------- */
function saveHiddenLayerData(doc, paths, conditions) {
    try {
        var result = "{";
        result += '"paths":[';
        var pathStrings = [];
        for (var i = 0; i < paths.length; i++) {
            var path = paths[i];
            var quotedPath = [];
            for (var j = 0; j < path.length; j++) {
                quotedPath.push('"' + path[j].replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"');
            }
            pathStrings.push('[' + quotedPath.join(',') + ']');
        }
        result += pathStrings.join(',') + '],';
        result += '"conditions":{}}';
        doc.info.caption = SETTINGS_KEY + result;
    } catch (e) {
        // Metadata save failure is non-critical
    }
}

/* -----------------------------------------------------
  Folder Creation
 ----------------------------------------------------- */
function createFolderRecursive(folder) {
    if (folder.exists) return true;
    var parent = folder.parent;
    if (!parent.exists) createFolderRecursive(parent);
    return folder.create();
}

/* -----------------------------------------------------
  JSON Utilities (same as convert_psd.jsx)
 ----------------------------------------------------- */
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
        if (str.charAt(pos) === '}') { pos++; return obj; }
        while (true) {
            skipWhitespace();
            var key = parseString();
            skipWhitespace();
            if (str.charAt(pos) !== ':') throw new Error("Expected ':' at position " + pos);
            pos++;
            var value = parseValue();
            obj[key] = value;
            skipWhitespace();
            var ch = str.charAt(pos);
            if (ch === '}') { pos++; return obj; }
            if (ch !== ',') throw new Error("Expected ',' or '}' at position " + pos);
            pos++;
        }
    }

    function parseArray() {
        var arr = [];
        pos++;
        skipWhitespace();
        if (str.charAt(pos) === ']') { pos++; return arr; }
        while (true) {
            var value = parseValue();
            arr.push(value);
            skipWhitespace();
            var ch = str.charAt(pos);
            if (ch === ']') { pos++; return arr; }
            if (ch !== ',') throw new Error("Expected ',' or ']' at position " + pos);
            pos++;
        }
    }

    function parseString() {
        pos++;
        var result = "";
        while (pos < str.length) {
            var ch = str.charAt(pos);
            if (ch === '"') { pos++; return result; }
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
                    default: result += escaped;
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
        while (pos < str.length && str.charAt(pos) >= '0' && str.charAt(pos) <= '9') pos++;
        if (pos < str.length && str.charAt(pos) === '.') {
            pos++;
            while (pos < str.length && str.charAt(pos) >= '0' && str.charAt(pos) <= '9') pos++;
        }
        if (pos < str.length && (str.charAt(pos) === 'e' || str.charAt(pos) === 'E')) {
            pos++;
            if (str.charAt(pos) === '+' || str.charAt(pos) === '-') pos++;
            while (pos < str.length && str.charAt(pos) >= '0' && str.charAt(pos) <= '9') pos++;
        }
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
