#target photoshop
app.displayDialogs = DialogModes.NO;

function main() {
    var tempFolder = Folder.temp;
    var settingsFile = new File(tempFolder + "/psd_layer_organize_settings.json");

    if (!settingsFile.exists) {
        alert("Settings file not found: " + settingsFile.fsName);
        return;
    }

    settingsFile.open("r");
    settingsFile.encoding = "UTF-8";
    var jsonStr = settingsFile.read();
    settingsFile.close();

    // Remove UTF-8 BOM if present
    if (jsonStr.charCodeAt(0) === 0xFEFF || jsonStr.charCodeAt(0) === 65279) {
        jsonStr = jsonStr.substring(1);
    }

    var settings;
    try {
        settings = parseJSON(jsonStr);
    } catch (e) {
        alert("Failed to parse settings: " + e.message);
        return;
    }

    var targetGroupName = settings.targetGroupName;
    var includeSpecial = settings.includeSpecial;
    var saveFolder = settings.saveFolder || null;
    var results = [];

    for (var i = 0; i < settings.files.length; i++) {
        var filePath = settings.files[i];
        var result = processOrganizeFile(filePath, targetGroupName, includeSpecial, saveFolder);
        results.push(result);
    }

    // Write results
    var outputFile = new File(settings.outputPath);
    outputFile.open("w");
    outputFile.encoding = "UTF-8";
    outputFile.write(arrayToJSON(results));
    outputFile.close();
}

/* =====================================================
   Process single file: organize layers into target group
   Strategy: Create empty group → move each layer individually
   No multi-select / Ctrl+G to avoid visibility side-effects
 ===================================================== */
function processOrganizeFile(filePath, targetGroupName, includeSpecial, saveFolder) {
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

        // ══════════════════════════════════════════════════
        // STEP 0: Scan ALL layer visibility BEFORE any changes
        // ══════════════════════════════════════════════════
        var originalVisibility = {};
        scanVisibility(doc, originalVisibility);

        // ── Step 1: Convert background layer to normal layer ──
        convertBackgroundIfNeeded(doc);
        doc = app.activeDocument;

        // ── Step 2: Find or create target group ──
        var existingGroup = findGroupByName(doc, targetGroupName);
        var targetGroupId;

        if (existingGroup) {
            targetGroupId = existingGroup.id;
        } else {
            var newGroup = doc.layerSets.add();
            newGroup.name = targetGroupName;
            targetGroupId = newGroup.id;
            result.changes.push("\u30D5\u30A9\u30EB\u30C0\u300C" + targetGroupName + "\u300D\u3092\u4F5C\u6210");
            doc = app.activeDocument;
        }

        // ── Step 3: Collect candidate layer IDs & names ──
        var candidateIds = [];
        var candidateNames = [];

        for (var i = 0; i < doc.layers.length; i++) {
            var layer = doc.layers[i];
            if (layer.id === targetGroupId) continue;

            if (layer.typename === "ArtLayer" && layer.kind === LayerKind.TEXT) {
                if (layer.visible) continue;
            }

            if (layer.typename === "LayerSet" && layer.visible) {
                if (groupHasVisibleText(layer)) continue;
            }

            if (!includeSpecial) {
                var name = layer.name;
                if (name.indexOf("\u767D\u6D88\u3057") !== -1 || name.indexOf("\u68D2\u6D88\u3057") !== -1) {
                    continue;
                }
            }

            unlockLayer(layer);
            candidateIds.push(layer.id);
            candidateNames.push(layer.name);
        }

        if (candidateIds.length === 0) {
            result.changes.push("\u79FB\u52D5\u5BFE\u8C61\u306E\u30EC\u30A4\u30E4\u30FC\u304C\u3042\u308A\u307E\u305B\u3093");
            result.success = true;
            doc.close(SaveOptions.DONOTSAVECHANGES);
            return result;
        }

        // ── Step 4: Move each candidate into the group ──
        // Create a dummy anchor layer inside the target group so we can
        // always use PLACEBEFORE (more reliable than INSIDE for LayerSets)
        doc = app.activeDocument;
        var anchorTg = findLayerById(doc, targetGroupId);
        doc.activeLayer = anchorTg;
        var anchorLayer = anchorTg.artLayers.add();
        anchorLayer.name = "__anchor__";
        var anchorId = anchorLayer.id;
        doc = app.activeDocument;

        var movedCount = 0;
        for (var m = 0; m < candidateIds.length; m++) {
            doc = app.activeDocument;
            var srcLayer = findLayerById(doc, candidateIds[m]);
            var anchor = findLayerById(doc, anchorId);

            if (!srcLayer) {
                result.changes.push("  \u2716 \u300C" + candidateNames[m] + "\u300D src not found");
                continue;
            }
            if (!anchor) {
                result.changes.push("  \u2716 \u300C" + candidateNames[m] + "\u300D anchor not found");
                continue;
            }

            unlockLayer(srcLayer);
            try {
                srcLayer.move(anchor, ElementPlacement.PLACEBEFORE);
                result.changes.push("  \u2192 \u300C" + candidateNames[m] + "\u300D");
                movedCount++;
            } catch (moveErr) {
                result.changes.push("  \u2716 \u300C" + candidateNames[m] + "\u300D " + moveErr.message);
            }
        }

        // Remove the dummy anchor layer
        doc = app.activeDocument;
        var anchorToRemove = findLayerById(doc, anchorId);
        if (anchorToRemove) {
            try { anchorToRemove.remove(); } catch (re) {}
        }
        result.changes.push(movedCount + " \u30EC\u30A4\u30E4\u30FC\u3092\u683C\u7D0D");

        // ── Step 5: Move target group to bottom ──
        doc = app.activeDocument;
        var tg = findLayerById(doc, targetGroupId);
        if (tg && doc.layers.length > 1) {
            var lastRootLayer = doc.layers[doc.layers.length - 1];
            if (lastRootLayer.id !== targetGroupId) {
                try {
                    tg.move(lastRootLayer, ElementPlacement.PLACEAFTER);
                    result.changes.push("\u300C" + targetGroupName + "\u300D\u3092\u6700\u4E0B\u5C64\u306B\u914D\u7F6E");
                } catch (posErr) {}
            }
        }

        // ══════════════════════════════════════════════════
        // STEP 6: Restore ALL visibility from original scan
        // ══════════════════════════════════════════════════
        doc = app.activeDocument;
        var restoredCount = restoreVisibility(doc, originalVisibility);
        if (restoredCount > 0) {
            result.changes.push(restoredCount + " \u30EC\u30A4\u30E4\u30FC\u306E\u975E\u8868\u793A\u3092\u5FA9\u5143");
        }

        // ── Step 7: Save ──
        var saveOptions = new PhotoshopSaveOptions();
        saveOptions.layers = true;
        saveOptions.embedColorProfile = true;

        if (saveFolder) {
            var outDir = new Folder(saveFolder);
            if (!outDir.exists) createFolderRecursive(outDir);
            var outFile = new File(outDir.fsName + "/" + decodeURI(file.name));
            doc.saveAs(outFile, saveOptions, true, Extension.LOWERCASE);
        } else {
            doc.saveAs(file, saveOptions, true, Extension.LOWERCASE);
        }

        doc.close(SaveOptions.DONOTSAVECHANGES);
        doc = null;
        result.success = true;

    } catch (e) {
        result.error = e.message + " (Line: " + e.line + ")";
        if (doc) {
            try { doc.close(SaveOptions.DONOTSAVECHANGES); } catch (e2) {}
        }
    }

    return result;
}

/* =====================================================
   Convert background layer to normal layer (if present)
   Uses Action Manager for reliability
 ===================================================== */
function convertBackgroundIfNeeded(doc) {
    for (var b = doc.layers.length - 1; b >= 0; b--) {
        try {
            if (doc.layers[b].typename === "ArtLayer" && doc.layers[b].isBackgroundLayer) {
                doc.activeLayer = doc.layers[b];
                var bgDesc = new ActionDescriptor();
                var bgRef = new ActionReference();
                bgRef.putClass(charIDToTypeID("Lyr "));
                bgDesc.putReference(charIDToTypeID("null"), bgRef);
                var bgLayerDesc = new ActionDescriptor();
                bgLayerDesc.putString(charIDToTypeID("Nm  "), doc.layers[b].name);
                bgDesc.putObject(charIDToTypeID("Usng"), charIDToTypeID("Lyr "), bgLayerDesc);
                executeAction(charIDToTypeID("Mk  "), bgDesc, DialogModes.NO);
                break;
            }
        } catch (bgErr) {}
    }
}

/* =====================================================
   Find a layer by ID (recursive through all levels)
 ===================================================== */
function findLayerById(parent, id) {
    for (var i = 0; i < parent.layers.length; i++) {
        if (parent.layers[i].id === id) return parent.layers[i];
        if (parent.layers[i].typename === "LayerSet") {
            var found = findLayerById(parent.layers[i], id);
            if (found) return found;
        }
    }
    return null;
}

/* =====================================================
   Check if a group contains any VISIBLE text layer
   (recursive through all nested levels)
 ===================================================== */
function groupHasVisibleText(layerSet) {
    for (var i = 0; i < layerSet.artLayers.length; i++) {
        var al = layerSet.artLayers[i];
        if (al.kind === LayerKind.TEXT && al.visible) {
            return true;
        }
    }
    for (var j = 0; j < layerSet.layerSets.length; j++) {
        if (groupHasVisibleText(layerSet.layerSets[j])) {
            return true;
        }
    }
    return false;
}

/* =====================================================
   Scan visibility of ALL layers in document (recursive)
   Stores { layerId: true/false } in the map object
 ===================================================== */
function scanVisibility(parent, map) {
    for (var i = 0; i < parent.layers.length; i++) {
        var layer = parent.layers[i];
        map[layer.id] = layer.visible;
        if (layer.typename === "LayerSet") {
            scanVisibility(layer, map);
        }
    }
}

/* =====================================================
   Restore visibility from original scan (recursive)
   Compares current vs original, fixes mismatches
   Returns count of layers restored to hidden
 ===================================================== */
function restoreVisibility(parent, originalMap) {
    var count = 0;
    for (var i = 0; i < parent.layers.length; i++) {
        var layer = parent.layers[i];
        var orig = originalMap[layer.id];
        // If we have original data and the layer was originally hidden but is now visible
        if (orig !== undefined && orig === false && layer.visible === true) {
            layer.visible = false;
            count++;
        }
        if (layer.typename === "LayerSet") {
            count += restoreVisibility(layer, originalMap);
        }
    }
    return count;
}

/* =====================================================
   Unlock all lock types on a layer
 ===================================================== */
function unlockLayer(layer) {
    try { layer.allLocked = false; } catch (e) {}
    try { layer.pixelsLocked = false; } catch (e) {}
    try { layer.positionLocked = false; } catch (e) {}
    try { layer.transparentPixelsLocked = false; } catch (e) {}
}

/* =====================================================
   Find a group (LayerSet) by exact name (recursive)
 ===================================================== */
function findGroupByName(parent, name) {
    for (var i = 0; i < parent.layerSets.length; i++) {
        var ls = parent.layerSets[i];
        if (ls.name === name) return ls;
        var found = findGroupByName(ls, name);
        if (found) return found;
    }
    return null;
}

/* =====================================================
   Folder Creation
 ===================================================== */
function createFolderRecursive(folder) {
    if (folder.exists) return true;
    var parent = folder.parent;
    if (!parent.exists) createFolderRecursive(parent);
    return folder.create();
}

/* =====================================================
   JSON Utilities
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
