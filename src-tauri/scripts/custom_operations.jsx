// Photoshop JSX Script for Custom Layer Operations
// Applies explicit path-based visibility changes and layer moves

#target photoshop

app.displayDialogs = DialogModes.NO;

/* -----------------------------------------------------
  Main Processing
 ----------------------------------------------------- */
function main() {
    var tempFolder = Folder.temp;
    var settingsFile = new File(tempFolder + "/psd_custom_operations_settings.json");

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
        // Find ops for this file
        var visOps = [];
        var moveOps = [];
        for (var j = 0; j < settings.fileOps.length; j++) {
            if (settings.fileOps[j].filePath === filePath) {
                visOps = settings.fileOps[j].visibilityOps || [];
                moveOps = settings.fileOps[j].moveOps || [];
                break;
            }
        }
        var result = processFile(filePath, visOps, moveOps, saveFolder, deleteHiddenText);
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
function processFile(filePath, visOps, moveOps, saveFolder, deleteHiddenText) {
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

        var changedCount = 0;

        // 1. Process move operations first (paths may change after moves)
        for (var m = 0; m < moveOps.length; m++) {
            var mop = moveOps[m];
            var sourceLayer = findLayerByPathAndIndex(doc.layers, mop.sourcePath, mop.sourceIndex);
            var targetLayer = findLayerByPathAndIndex(doc.layers, mop.targetPath, mop.targetIndex);
            if (!sourceLayer || !targetLayer) {
                var debugSrc = (mop.sourcePath || []).join("/") + ":" + mop.sourceIndex;
                var debugTgt = (mop.targetPath || []).join("/") + ":" + mop.targetIndex;
                result.changes.push("Move: not found (src=" + debugSrc + " " + (sourceLayer ? "OK" : "MISS") + ", tgt=" + debugTgt + " " + (targetLayer ? "OK" : "MISS") + ")");
                continue;
            }
            try {
                if (mop.placement === "before") {
                    sourceLayer.move(targetLayer, ElementPlacement.PLACEBEFORE);
                } else if (mop.placement === "after") {
                    sourceLayer.move(targetLayer, ElementPlacement.PLACEAFTER);
                } else if (mop.placement === "inside") {
                    sourceLayer.move(targetLayer, ElementPlacement.INSIDE);
                }
                changedCount++;
                result.changes.push("Moved: " + sourceLayer.name);
            } catch (moveErr) {
                result.changes.push("Move failed: " + sourceLayer.name + " (" + moveErr.message + ")");
            }
        }

        // 2. Process visibility operations
        for (var v = 0; v < visOps.length; v++) {
            var vop = visOps[v];
            var layer = findLayerByPathAndIndex(doc.layers, vop.path, vop.index);
            if (!layer) {
                result.changes.push("Visibility: layer not found at " + vop.path.join("/") + ":" + vop.index);
                continue;
            }
            var targetVisible = (vop.action === "show");
            if (layer.visible !== targetVisible) {
                layer.visible = targetVisible;
                changedCount++;
                if (targetVisible) {
                    ensureParentsVisible(layer);
                }
                result.changes.push((targetVisible ? "Show" : "Hide") + ": " + layer.name);
            }
        }

        // 3. Delete hidden text layers if requested
        if (deleteHiddenText) {
            var deletedNames = [];
            var deletedCount = deleteHiddenTextLayers(doc.layers, deletedNames, []);
            changedCount += deletedCount;
            if (deletedCount > 0) {
                result.changes.push("Deleted " + deletedCount + " hidden text layer(s)");
                for (var d = 0; d < deletedNames.length; d++) {
                    result.changes.push("  deleted: " + deletedNames[d]);
                }
            }
        }

        if (changedCount > 0) {
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
            result.changes.push("Applied " + changedCount + " operation(s)");
        } else {
            result.changes.push("No changes needed");
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
  Layer Finding by Path + Index
 ----------------------------------------------------- */
function findLayerByPathAndIndex(layers, path, targetIndex) {
    if (!path || path.length === 0) return null;
    var targetName = path[0];
    var isLeaf = (path.length === 1);
    var nameCount = 0;

    // Iterate top-to-bottom (layers[0]=top in PS panel)
    // to match frontend annotation counting direction
    for (var i = 0; i < layers.length; i++) {
        var layer = layers[i];
        if (layer.name === targetName) {
            if (isLeaf) {
                // Leaf level: use targetIndex to disambiguate same-named layers
                if (nameCount === targetIndex) {
                    return layer;
                }
                nameCount++;
            } else {
                // Intermediate level: enter first matching group,
                // pass targetIndex through to the leaf level
                if (layer.typename === "LayerSet") {
                    var remaining = [];
                    for (var j = 1; j < path.length; j++) {
                        remaining.push(path[j]);
                    }
                    return findLayerByPathAndIndex(layer.layers, remaining, targetIndex);
                }
            }
        }
    }

    return null;
}

/* -----------------------------------------------------
  Utility
 ----------------------------------------------------- */
function ensureParentsVisible(layer) {
    var current = layer.parent;
    while (current && current.typename !== "Document") {
        if (!current.visible) {
            current.visible = true;
        }
        current = current.parent;
    }
}

function createFolderRecursive(folder) {
    if (folder.exists) return true;
    var parent = folder.parent;
    if (!parent.exists) createFolderRecursive(parent);
    return folder.create();
}

/* -----------------------------------------------------
  Delete Hidden Text Layers
 ----------------------------------------------------- */
function deleteHiddenTextLayers(layers, deletedNames, currentPath) {
    var count = 0;
    for (var i = layers.length - 1; i >= 0; i--) {
        var layer = layers[i];
        var layerPath = currentPath.concat([layer.name]);
        if (layer.typename === "LayerSet") {
            count += deleteHiddenTextLayers(layer.layers, deletedNames, layerPath);
        } else if (layer.kind === LayerKind.TEXT && !layer.visible) {
            deletedNames.push(layerPath.join("/"));
            layer.remove();
            count++;
        }
    }
    return count;
}

/* -----------------------------------------------------
  JSON Utilities
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
