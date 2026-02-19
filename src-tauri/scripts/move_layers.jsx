#target photoshop
app.displayDialogs = DialogModes.NO;

function main() {
    var tempFolder = Folder.temp;
    var settingsFile = new File(tempFolder + "/psd_layer_move_settings.json");

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

    var results = [];

    for (var i = 0; i < settings.files.length; i++) {
        var filePath = settings.files[i];
        var result = processLayerMove(filePath, settings);
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
   Process single file: move layers by conditions
   into target group
 ===================================================== */
function processLayerMove(filePath, settings) {
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

        // ── Step 0: Scan ALL layer visibility BEFORE any changes ──
        var originalVisibility = {};
        scanVisibility(doc, originalVisibility);

        // ── Step 1: Convert background layer to normal layer ──
        convertBackgroundIfNeeded(doc);
        doc = app.activeDocument;

        // ── Step 2: Determine search root ──
        var searchRoot;
        if (settings.searchScope === "group" && settings.searchGroupName) {
            searchRoot = findGroupByName(doc, settings.searchGroupName);
            if (!searchRoot) {
                result.error = "\u691C\u7D22\u30B0\u30EB\u30FC\u30D7\u300C" + settings.searchGroupName + "\u300D\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093";
                doc.close(SaveOptions.DONOTSAVECHANGES);
                return result;
            }
        } else {
            searchRoot = doc;
        }

        // ── Step 3: Find or create target group ──
        var targetGroup = findGroupByName(doc, settings.targetGroupName);
        var targetGroupId;

        if (targetGroup) {
            targetGroupId = targetGroup.id;
        } else if (settings.createIfMissing) {
            var newGroup = doc.layerSets.add();
            newGroup.name = settings.targetGroupName;
            targetGroupId = newGroup.id;
            result.changes.push("\u30D5\u30A9\u30EB\u30C0\u300C" + settings.targetGroupName + "\u300D\u3092\u4F5C\u6210");
            doc = app.activeDocument;
        } else {
            result.error = "\u79FB\u52D5\u5148\u30B0\u30EB\u30FC\u30D7\u300C" + settings.targetGroupName + "\u300D\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093";
            doc.close(SaveOptions.DONOTSAVECHANGES);
            return result;
        }

        // ── Step 4: Collect candidate layers with parent info ──
        var candidates = [];
        collectCandidates(searchRoot, targetGroupId, candidates, searchRoot);

        // ── Step 5: Filter by AND conditions ──
        var cond = settings.conditions;
        var matchedLayers = [];

        for (var c = 0; c < candidates.length; c++) {
            var layer = candidates[c].layer;
            var parent = candidates[c].parent;
            var allMatch = true;

            // Condition: Text Layer
            if (cond.textLayer) {
                if (!(layer.typename !== "LayerSet" && layer.kind === LayerKind.TEXT)) {
                    allMatch = false;
                }
            }

            // Condition: Subgroup Top (first child of a group)
            if (cond.subgroupTop && allMatch) {
                if (parent.typename === "LayerSet" && parent !== searchRoot) {
                    if (layer !== parent.layers[0]) {
                        allMatch = false;
                    }
                } else {
                    allMatch = false;
                }
            }

            // Condition: Subgroup Bottom (last child of a group)
            if (cond.subgroupBottom && allMatch) {
                if (parent.typename === "LayerSet" && parent !== searchRoot) {
                    if (layer !== parent.layers[parent.layers.length - 1]) {
                        allMatch = false;
                    }
                } else {
                    allMatch = false;
                }
            }

            // Condition: Layer Name match
            if (cond.nameEnabled && allMatch) {
                var condName = cond.namePattern;
                if (condName) {
                    if (cond.namePartial) {
                        if (layer.name.indexOf(condName) === -1) {
                            allMatch = false;
                        }
                    } else {
                        if (layer.name !== condName) {
                            allMatch = false;
                        }
                    }
                } else {
                    allMatch = false;
                }
            }

            if (allMatch) {
                matchedLayers.push({
                    id: layer.id,
                    name: layer.name
                });
            }
        }

        if (matchedLayers.length === 0) {
            result.changes.push("\u6761\u4EF6\u306B\u4E00\u81F4\u3059\u308B\u30EC\u30A4\u30E4\u30FC\u304C\u3042\u308A\u307E\u305B\u3093");
            result.success = true;
            doc.close(SaveOptions.DONOTSAVECHANGES);
            return result;
        }

        // ── Step 6: Create anchor inside target group for reliable placement ──
        doc = app.activeDocument;
        var anchorTg = findLayerById(doc, targetGroupId);
        doc.activeLayer = anchorTg;
        var anchorLayer = anchorTg.artLayers.add();
        anchorLayer.name = "__anchor__";
        var anchorId = anchorLayer.id;
        doc = app.activeDocument;

        // ── Step 7: Move matched layers (reverse order to preserve indices) ──
        var movedCount = 0;
        for (var m = matchedLayers.length - 1; m >= 0; m--) {
            doc = app.activeDocument;
            var srcLayer = findLayerById(doc, matchedLayers[m].id);
            var anchor = findLayerById(doc, anchorId);

            if (!srcLayer) {
                result.changes.push("  \u2716 \u300C" + matchedLayers[m].name + "\u300D src not found");
                continue;
            }
            if (!anchor) {
                result.changes.push("  \u2716 \u300C" + matchedLayers[m].name + "\u300D anchor not found");
                continue;
            }

            unlockLayer(srcLayer);
            try {
                srcLayer.move(anchor, ElementPlacement.PLACEBEFORE);
                result.changes.push("  \u2192 \u300C" + matchedLayers[m].name + "\u300D");
                movedCount++;
            } catch (moveErr) {
                result.changes.push("  \u2716 \u300C" + matchedLayers[m].name + "\u300D " + moveErr.message);
            }
        }

        // Remove the dummy anchor layer
        doc = app.activeDocument;
        var anchorToRemove = findLayerById(doc, anchorId);
        if (anchorToRemove) {
            try { anchorToRemove.remove(); } catch (re) {}
        }
        result.changes.push(movedCount + " \u30EC\u30A4\u30E4\u30FC\u3092\u79FB\u52D5");

        // ── Step 8: Restore ALL visibility from original scan ──
        doc = app.activeDocument;
        var restoredCount = restoreVisibility(doc, originalVisibility);
        if (restoredCount > 0) {
            result.changes.push(restoredCount + " \u30EC\u30A4\u30E4\u30FC\u306E\u975E\u8868\u793A\u3092\u5FA9\u5143");
        }

        // ── Step 9: Save ──
        var saveOptions = new PhotoshopSaveOptions();
        saveOptions.layers = true;
        saveOptions.embedColorProfile = true;

        var saveFolder = settings.saveFolder || null;
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
   Recursively collect candidate layers with parent info
   Skips the target group and its contents
 ===================================================== */
function collectCandidates(parent, targetGroupId, candidates, searchRoot) {
    for (var i = 0; i < parent.layers.length; i++) {
        var layer = parent.layers[i];

        // Skip the target group itself and all its contents
        if (layer.id === targetGroupId) continue;

        // Add this layer as candidate
        candidates.push({ layer: layer, parent: parent });

        // Recurse into subgroups
        if (layer.typename === "LayerSet") {
            collectCandidates(layer, targetGroupId, candidates, searchRoot);
        }
    }
}

/* =====================================================
   Convert background layer to normal layer (if present)
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
   Scan visibility of ALL layers in document (recursive)
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
 ===================================================== */
function restoreVisibility(parent, originalMap) {
    var count = 0;
    for (var i = 0; i < parent.layers.length; i++) {
        var layer = parent.layers[i];
        var orig = originalMap[layer.id];
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
