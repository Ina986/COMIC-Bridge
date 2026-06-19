// merge_layers.jsx - Layer merge (text/background separation)
// Separates text layers from background, merges background into single layer,
// keeps both visible. Based on tiff_convert.jsx pipeline (steps 1-7).
#target photoshop
app.displayDialogs = DialogModes.NO;

var TEXT_GROUP_NAMES = ["#text#", "text", "\u5199\u690D", "\u30BB\u30EA\u30D5", "\u30C6\u30AD\u30B9\u30C8", "\u53F0\u8A5E"];

function main() {
    var tempFolder = new Folder(Folder.temp.fsName + "/COMIC-Bridge/convert"); if (!tempFolder.exists) { tempFolder.create(); }
    var settingsFile = (typeof COMIC_BRIDGE_SETTINGS_PATH !== "undefined" && COMIC_BRIDGE_SETTINGS_PATH) ? new File(COMIC_BRIDGE_SETTINGS_PATH) : new File(tempFolder + "/psd_merge_layers_settings.json");

    settingsFile.open("r");
    settingsFile.encoding = "UTF-8";
    var jsonStr = settingsFile.read();
    settingsFile.close();

    // Remove BOM
    if (jsonStr.charCodeAt(0) === 0xFEFF || jsonStr.charCodeAt(0) === 65279) {
        jsonStr = jsonStr.substring(1);
    }

    var settings = parseJSON(jsonStr);
    var results = [];

    for (var i = 0; i < settings.files.length; i++) {
        var result = processMergeFile(settings.files[i], settings);
        results.push(result);
    }

    var outputFile = new File(settings.outputPath);
    outputFile.open("w");
    outputFile.encoding = "UTF-8";
    outputFile.write(arrayToJSON(results));
    outputFile.close();
}

function processMergeFile(filePath, settings) {
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
            result.error = "File not found";
            return result;
        }

        doc = app.open(file);

        // 1. Unlock all layers
        unlockAllLayers(doc);

        // 2. Find existing text group
        var textGroup = null;
        for (var gi = 0; gi < doc.layerSets.length; gi++) {
            var gName = doc.layerSets[gi].name;
            for (var gj = 0; gj < TEXT_GROUP_NAMES.length; gj++) {
                if (gName === TEXT_GROUP_NAMES[gj] || gName.toLowerCase() === TEXT_GROUP_NAMES[gj].toLowerCase()) {
                    textGroup = doc.layerSets[gi];
                    break;
                }
            }
            if (textGroup) break;
        }

        // 3. Text layer organization (if enabled)
        if (settings.reorganizeText) {
            if (!textGroup) {
                textGroup = findOrCreateTextGroup(doc);
            }
            if (textGroup) {
                consolidateTextLayers(doc, textGroup);
            }
        }

        // Move text group to top
        if (textGroup) {
            try { textGroup.move(doc, ElementPlacement.PLACEATBEGINNING); } catch (e) {}
        }

        // 4. Merge background layers (text group stays as-is)
        var bgLayerCount = 0;

        if (doc.layers.length > 1) {
            var bgLayers = collectNonTextLayers(doc, textGroup);
            bgLayerCount = bgLayers.length;

            // Background: Select all non-text layers -> convert to SO -> rasterize
            if (bgLayers.length > 0) {
                var bgVisibility = [];
                for (var vi = 0; vi < bgLayers.length; vi++) {
                    bgVisibility.push(bgLayers[vi].visible);
                }

                selectLayers(bgLayers);

                for (var vi = 0; vi < bgLayers.length; vi++) {
                    try { bgLayers[vi].visible = bgVisibility[vi]; } catch (e) {}
                }

                var backgroundSO = convertToSmartObject();
                if (backgroundSO) {
                    backgroundSO.name = "\u80CC\u666F";
                    // Rasterize the background SO into a single layer
                    try {
                        doc.activeLayer = backgroundSO;
                        backgroundSO.rasterize(RasterizeType.ENTIRELAYER);
                        doc.activeLayer.name = "\u80CC\u666F";
                    } catch (e) {}
                }
            }

            // Text group: just rename, keep as LayerSet
            if (textGroup) {
                try { textGroup.name = "\u30C6\u30AD\u30B9\u30C8"; } catch (e) {}
            }
        } else if (doc.layers.length === 1) {
            // Single layer - just rename
            doc.layers[0].name = "\u80CC\u666F";
            bgLayerCount = 1;
        }

        // Ensure all remaining layers are visible
        for (var li = 0; li < doc.layers.length; li++) {
            try { doc.layers[li].visible = true; } catch (e) {}
        }

        // 7. Save
        if (settings.saveFolder) {
            var outputDir = new Folder(settings.saveFolder);
            if (!outputDir.exists) createFolderRecursive(outputDir);
            var outFile = new File(outputDir.fsName + "/" + decodeURI(file.name));
            var psdOpts = new PhotoshopSaveOptions();
            psdOpts.layers = true;
            doc.saveAs(outFile, psdOpts, true, Extension.LOWERCASE);
        } else {
            doc.save();
        }

        doc.close(SaveOptions.DONOTSAVECHANGES);
        doc = null;

        result.success = true;
        var summary = bgLayerCount + " layer(s) merged into background";
        if (textGroup) summary += ", text group preserved as LayerSet";
        result.changes.push(summary);

        return result;

    } catch (e) {
        result.error = e.message || String(e);
        try {
            if (doc) doc.close(SaveOptions.DONOTSAVECHANGES);
        } catch (ex) {}
        return result;
    }
}

/* ----- Layer Operations (from tiff_convert.jsx) ----- */

function unlockAllLayers(doc) {
    try {
        if (doc.layers.length > 0 && doc.layers[doc.layers.length - 1].isBackgroundLayer) {
            doc.layers[doc.layers.length - 1].isBackgroundLayer = false;
        }
    } catch (e) {}
    unlockRecursive(doc);
}

function unlockRecursive(container) {
    for (var i = 0; i < container.layers.length; i++) {
        var layer = container.layers[i];
        try {
            var originalVisibility = layer.visible;
            layer.allLocked = false;
            layer.visible = originalVisibility;
        } catch (e) {}
        if (layer.typename === "LayerSet") {
            unlockRecursive(layer);
        }
    }
}

function findOrCreateTextGroup(doc) {
    for (var i = 0; i < doc.layerSets.length; i++) {
        var groupName = doc.layerSets[i].name;
        for (var j = 0; j < TEXT_GROUP_NAMES.length; j++) {
            if (groupName === TEXT_GROUP_NAMES[j] || groupName.toLowerCase() === TEXT_GROUP_NAMES[j].toLowerCase()) {
                return doc.layerSets[i];
            }
        }
    }
    var hasTextLayers = false;
    checkForTextLayers(doc, function() { hasTextLayers = true; });
    if (!hasTextLayers) return null;
    var textGroup = doc.layerSets.add();
    textGroup.name = "#text#";
    return textGroup;
}

function checkForTextLayers(container, callback) {
    for (var i = 0; i < container.layers.length; i++) {
        var layer = container.layers[i];
        if (layer.kind === LayerKind.TEXT) {
            callback();
            return;
        }
        if (layer.typename === "LayerSet") {
            checkForTextLayers(layer, callback);
        }
    }
}

function consolidateTextLayers(doc, targetGroup) {
    var layersToMove = [];
    findTextLayersOutside(doc, targetGroup, layersToMove);
    for (var i = 0; i < layersToMove.length; i++) {
        try {
            layersToMove[i].move(targetGroup, ElementPlacement.INSIDE);
        } catch (e) {}
    }
}

function findTextLayersOutside(container, excludeGroup, list) {
    for (var i = 0; i < container.layers.length; i++) {
        var layer = container.layers[i];
        if (excludeGroup && layer.id === excludeGroup.id) continue;
        if (layer.kind === LayerKind.TEXT) {
            list.push(layer);
        } else if (layer.typename === "LayerSet") {
            var allText = true;
            checkAllText(layer, function() { allText = false; });
            if (allText && layer.layers.length > 0) {
                list.push(layer);
            } else {
                findTextLayersOutside(layer, excludeGroup, list);
            }
        }
    }
}

function checkAllText(container, onNonText) {
    for (var i = 0; i < container.layers.length; i++) {
        var layer = container.layers[i];
        if (layer.kind !== LayerKind.TEXT && layer.typename !== "LayerSet") {
            onNonText();
            return;
        }
        if (layer.typename === "LayerSet") {
            checkAllText(layer, onNonText);
        }
    }
}

function collectNonTextLayers(doc, textGroup) {
    var layers = [];
    for (var i = 0; i < doc.layers.length; i++) {
        if (!textGroup || doc.layers[i].id !== textGroup.id) {
            layers.push(doc.layers[i]);
        }
    }
    return layers;
}

function selectLayerWithChildren(layer) {
    var descendants = [];
    function collectDescendants(parent) {
        if (parent.typename === "LayerSet") {
            descendants.push(parent);
            for (var i = 0; i < parent.layers.length; i++) {
                collectDescendants(parent.layers[i]);
            }
        } else {
            descendants.push(parent);
        }
    }
    collectDescendants(layer);
    selectLayers(descendants);
}

function selectLayers(layers) {
    if (layers.length === 0) return;
    var desc = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putIdentifier(charIDToTypeID("Lyr "), layers[0].id);
    desc.putReference(charIDToTypeID("null"), ref);
    desc.putBoolean(stringIDToTypeID("makeVisible"), false);
    executeAction(charIDToTypeID("slct"), desc, DialogModes.NO);

    for (var i = 1; i < layers.length; i++) {
        var addDesc = new ActionDescriptor();
        var addRef = new ActionReference();
        addRef.putIdentifier(charIDToTypeID("Lyr "), layers[i].id);
        addDesc.putReference(charIDToTypeID("null"), addRef);
        addDesc.putEnumerated(
            stringIDToTypeID("selectionModifier"),
            stringIDToTypeID("selectionModifierType"),
            stringIDToTypeID("addToSelection")
        );
        addDesc.putBoolean(stringIDToTypeID("makeVisible"), false);
        executeAction(charIDToTypeID("slct"), addDesc, DialogModes.NO);
    }
}

function convertToSmartObject() {
    try {
        executeAction(stringIDToTypeID("newPlacedLayer"), new ActionDescriptor(), DialogModes.NO);
        return app.activeDocument.activeLayer;
    } catch (e) { return null; }
}

function createFolderRecursive(folder) {
    if (!folder.exists) {
        createFolderRecursive(folder.parent);
        folder.create();
    }
}

/* ----- JSON Utilities ----- */

function valueToJSON(val) {
    if (val === null || val === undefined) return "null";
    if (typeof val === "string") return '"' + val.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r") + '"';
    if (typeof val === "number" || typeof val === "boolean") return String(val);
    if (val instanceof Array) return arrayToJSON(val);
    if (typeof val === "object") return objectToJSON(val);
    return "null";
}

function arrayToJSON(arr) {
    var json = "[";
    for (var i = 0; i < arr.length; i++) {
        if (i > 0) json += ",";
        json += valueToJSON(arr[i]);
    }
    return json + "]";
}

function objectToJSON(obj) {
    var json = "{";
    var first = true;
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            if (!first) json += ",";
            first = false;
            json += '"' + key + '":' + valueToJSON(obj[key]);
        }
    }
    return json + "}";
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
        throw new Error("Unexpected character at " + pos + ": " + ch);
    }
    function skipWhitespace() {
        while (pos < str.length) {
            var ch = str.charAt(pos);
            if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') pos++;
            else break;
        }
    }
    function parseObject() {
        pos++;
        var obj = {};
        skipWhitespace();
        if (str.charAt(pos) === '}') { pos++; return obj; }
        while (true) {
            skipWhitespace();
            var key = parseString();
            skipWhitespace();
            pos++; // ':'
            obj[key] = parseValue();
            skipWhitespace();
            if (str.charAt(pos) === ',') { pos++; continue; }
            if (str.charAt(pos) === '}') { pos++; return obj; }
            throw new Error("Expected , or } at " + pos);
        }
    }
    function parseArray() {
        pos++;
        var arr = [];
        skipWhitespace();
        if (str.charAt(pos) === ']') { pos++; return arr; }
        while (true) {
            arr.push(parseValue());
            skipWhitespace();
            if (str.charAt(pos) === ',') { pos++; continue; }
            if (str.charAt(pos) === ']') { pos++; return arr; }
            throw new Error("Expected , or ] at " + pos);
        }
    }
    function parseString() {
        pos++; // '"'
        var result = "";
        while (pos < str.length) {
            var ch = str.charAt(pos);
            if (ch === '"') { pos++; return result; }
            if (ch === '\\') {
                pos++;
                var esc = str.charAt(pos);
                if (esc === '"') result += '"';
                else if (esc === '\\') result += '\\';
                else if (esc === '/') result += '/';
                else if (esc === 'n') result += '\n';
                else if (esc === 'r') result += '\r';
                else if (esc === 't') result += '\t';
                else if (esc === 'u') {
                    var hex = str.substring(pos + 1, pos + 5);
                    result += String.fromCharCode(parseInt(hex, 16));
                    pos += 4;
                }
                else result += esc;
            } else {
                result += ch;
            }
            pos++;
        }
        return result;
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
        return Number(str.substring(start, pos));
    }
    function parseBoolean() {
        if (str.substring(pos, pos + 4) === "true") { pos += 4; return true; }
        if (str.substring(pos, pos + 5) === "false") { pos += 5; return false; }
        throw new Error("Expected boolean at " + pos);
    }
    function parseNull() {
        pos += 4;
        return null;
    }
    return parseValue();
}

main();
