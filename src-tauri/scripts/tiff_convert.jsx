// Photoshop JSX Script for TIFF Conversion
// Based on TIPPY v2.92 processing pipeline, integrated with COMIC-Bridge config/result pattern

#target photoshop

var originalDialogs = app.displayDialogs;
app.displayDialogs = DialogModes.NO;
app.preferences.rulerUnits = Units.PIXELS;

/* -----------------------------------------------------
  Text Group Names (for consolidation)
 ----------------------------------------------------- */
var TEXT_GROUP_NAMES = ["#text#", "text", "\u5199\u690D", "\u30BB\u30EA\u30D5", "\u30C6\u30AD\u30B9\u30C8", "\u53F0\u8A5E"];

/* -----------------------------------------------------
  Main Processing
 ----------------------------------------------------- */
function main() {
    var tempFolder = Folder.temp;
    var settingsFile = new File(tempFolder + "/psd_tiff_settings.json");

    if (!settingsFile.exists) {
        alert("Settings file not found: " + settingsFile.fsName);
        return;
    }

    settingsFile.open("r");
    settingsFile.encoding = "UTF-8";
    var jsonStr = settingsFile.read();
    settingsFile.close();

    // BOM skip
    if (jsonStr.charCodeAt(0) === 0xFEFF || jsonStr.charCodeAt(0) === 0xEF) {
        jsonStr = jsonStr.substring(1);
    }

    var config;
    try {
        config = parseJSON(jsonStr);
    } catch (e) {
        alert("Failed to parse settings: " + e.message);
        return;
    }

    var globalSettings = config.globalSettings;
    var results = [];

    for (var i = 0; i < config.files.length; i++) {
        var fileConfig = config.files[i];
        var result = processFile(fileConfig, globalSettings);
        results.push(result);
    }

    // Write results
    var resultFile = new File(tempFolder + "/psd_tiff_results.json");
    resultFile.open("w");
    resultFile.encoding = "UTF-8";
    resultFile.write(valueToJSON({ results: results }));
    resultFile.close();

    app.displayDialogs = originalDialogs;
}

/* -----------------------------------------------------
  Process Single File
 ----------------------------------------------------- */
function processFile(fileConfig, globalSettings) {
    var filePath = fileConfig.path;
    var fileName = decodeURI(new File(filePath).name);

    try {
        // 1. Open file
        var file = new File(filePath);
        if (!file.exists) {
            return { fileName: fileName, success: false, error: "File not found" };
        }

        var doc;
        // PSB handling
        if (filePath.match(/\.psb$/i) && fileConfig.psbConvert) {
            doc = app.open(file);
        } else {
            doc = app.open(file);
        }

        // 2. Unlock all layers
        unlockAllLayers(doc);

        // 3. Text layer organization (if enabled)
        var textGroup = null;
        if (globalSettings.reorganizeText) {
            textGroup = findOrCreateTextGroup(doc);
            if (textGroup) {
                consolidateTextLayers(doc, textGroup);
            }
        }

        // 4-5. Smart Object creation for non-text and text layers
        var bgLayer = null;
        var textSO = null;

        if (doc.layers.length > 1) {
            // Separate text and background
            var textLayers = collectTextLayers(doc, textGroup);
            var bgLayers = collectNonTextLayers(doc, textGroup);

            // Background: Select all non-text layers → merge to single layer
            if (bgLayers.length > 0) {
                selectLayers(bgLayers);
                if (bgLayers.length > 1) {
                    try {
                        executeAction(stringIDToTypeID("mergeLayersNew"), undefined, DialogModes.NO);
                    } catch (e) {
                        // Fallback: flatten
                        doc.flatten();
                    }
                }
                bgLayer = doc.activeLayer;
                bgLayer.name = "\u80CC\u666F";
            }

            // Text: Convert text layers to smart object (preserves fonts)
            if (textLayers.length > 0 && textGroup) {
                try {
                    doc.activeLayer = textGroup;
                    convertToSmartObject();
                    textSO = doc.activeLayer;
                    textSO.name = "\u30C6\u30AD\u30B9\u30C8";
                } catch (e) {
                    textSO = null;
                }
            }
        }

        // 6. Color mode conversion
        var targetColorMode = fileConfig.colorMode; // "mono" | "color" | "noChange"
        if (targetColorMode === "mono" && doc.mode !== DocumentMode.GRAYSCALE) {
            doc.changeMode(ChangeMode.GRAYSCALE);
        } else if (targetColorMode === "color" && doc.mode !== DocumentMode.RGB) {
            doc.changeMode(ChangeMode.RGB);
        }

        // 7-8. Text SO: rasterize then hide
        if (textSO) {
            try {
                doc.activeLayer = textSO;
                rasterizeLayer();
                // Re-convert to SO for isolation
                convertToSmartObject();
                textSO = doc.activeLayer;
                textSO.visible = false;
            } catch (e) {}
        }

        // 9. Optional: Save intermediate PSD
        if (globalSettings.saveIntermediatePsd) {
            saveIntermediatePsd(doc, fileConfig, globalSettings);
        }

        // 10. Apply Gaussian blur to background
        if (fileConfig.applyBlur && fileConfig.blurRadius > 0) {
            // Select background layer
            if (bgLayer) {
                try { doc.activeLayer = bgLayer; } catch (e) {}
            } else if (doc.layers.length > 0) {
                doc.activeLayer = doc.layers[doc.layers.length - 1];
            }

            // Partial blur check
            if (fileConfig.partialBlur && fileConfig.partialBlur.blurRadius !== undefined) {
                // Partial blur: different inside/outside selection
                applyPartialBlur(doc, fileConfig);
            } else {
                // Standard full blur
                doc.activeLayer.applyGaussianBlur(fileConfig.blurRadius);
            }
        }

        // 11. Show text SO
        if (textSO) {
            try { textSO.visible = true; } catch (e) {}
        }

        // 12. Flatten all layers
        doc.flatten();

        // 13. Crop (if not skipped)
        if (!fileConfig.skipCrop && fileConfig.cropBounds) {
            var cb = fileConfig.cropBounds;
            var region = [
                [cb.left, cb.top],
                [cb.right, cb.top],
                [cb.right, cb.bottom],
                [cb.left, cb.bottom]
            ];
            doc.crop(region);
        }

        // 14. Resize
        var targetW = new UnitValue(globalSettings.targetWidth, "px");
        var targetH = new UnitValue(globalSettings.targetHeight, "px");

        // DPI based on color mode
        var targetDPI;
        if (targetColorMode === "mono") {
            targetDPI = 600;
        } else if (targetColorMode === "color") {
            targetDPI = 350;
        } else {
            targetDPI = doc.resolution;
        }

        doc.resizeImage(targetW, targetH, targetDPI, ResampleMethod.AUTOMATIC);

        // 15. Remove alpha channels
        while (doc.channels.length > getExpectedChannelCount(doc)) {
            doc.channels[doc.channels.length - 1].remove();
        }

        // 16. Save
        var outputDir = new Folder(fileConfig.outputPath);
        if (!outputDir.exists) outputDir.create();
        var outputFile = new File(fileConfig.outputPath + "/" + fileConfig.outputName);

        if (globalSettings.proceedAsTiff) {
            // TIFF with LZW compression
            var tiffOpts = new TiffSaveOptions();
            tiffOpts.imageCompression = TIFFEncoding.TIFFLZW;
            tiffOpts.layers = false;
            tiffOpts.alphaChannels = false;
            tiffOpts.byteOrder = ByteOrder.IBM;
            doc.saveAs(outputFile, tiffOpts, true, Extension.LOWERCASE);
        } else {
            // PSD
            var psdOpts = new PhotoshopSaveOptions();
            psdOpts.layers = false;
            psdOpts.alphaChannels = false;
            doc.saveAs(outputFile, psdOpts, true, Extension.LOWERCASE);
        }

        // 17. Close
        doc.close(SaveOptions.DONOTSAVECHANGES);

        return {
            fileName: fileName,
            success: true,
            outputPath: outputFile.fsName.replace(/\\/g, "/")
        };

    } catch (e) {
        // Close doc if open
        try {
            if (app.documents.length > 0) {
                app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);
            }
        } catch (ex) {}

        return {
            fileName: fileName,
            success: false,
            error: e.message || String(e)
        };
    }
}

/* -----------------------------------------------------
  Layer Operations
 ----------------------------------------------------- */
function unlockAllLayers(doc) {
    // Unlock background layer
    try {
        if (doc.layers.length > 0 && doc.layers[doc.layers.length - 1].isBackgroundLayer) {
            doc.layers[doc.layers.length - 1].isBackgroundLayer = false;
        }
    } catch (e) {}

    // Unlock all locked layers recursively
    unlockRecursive(doc);
}

function unlockRecursive(container) {
    for (var i = 0; i < container.layers.length; i++) {
        var layer = container.layers[i];
        try {
            layer.allLocked = false;
            layer.pixelsLocked = false;
            layer.positionLocked = false;
            layer.transparentPixelsLocked = false;
        } catch (e) {}
        if (layer.typename === "LayerSet") {
            unlockRecursive(layer);
        }
    }
}

function findOrCreateTextGroup(doc) {
    // Search existing text group
    for (var i = 0; i < doc.layerSets.length; i++) {
        var groupName = doc.layerSets[i].name;
        for (var j = 0; j < TEXT_GROUP_NAMES.length; j++) {
            if (groupName === TEXT_GROUP_NAMES[j] || groupName.toLowerCase() === TEXT_GROUP_NAMES[j].toLowerCase()) {
                return doc.layerSets[i];
            }
        }
    }

    // Check if any text layers exist
    var hasTextLayers = false;
    checkForTextLayers(doc, function() { hasTextLayers = true; });
    if (!hasTextLayers) return null;

    // Create new text group at top
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
    // Move scattered text layers into the target group
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
        if (layer === excludeGroup) continue;
        if (layer.kind === LayerKind.TEXT) {
            list.push(layer);
        } else if (layer.typename === "LayerSet") {
            // Check if this group is only text
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

function collectTextLayers(doc, textGroup) {
    if (!textGroup) return [];
    return [textGroup];
}

function collectNonTextLayers(doc, textGroup) {
    var layers = [];
    for (var i = 0; i < doc.layers.length; i++) {
        if (doc.layers[i] !== textGroup) {
            layers.push(doc.layers[i]);
        }
    }
    return layers;
}

function selectLayers(layers) {
    if (layers.length === 0) return;
    // Select first layer
    app.activeDocument.activeLayer = layers[0];
    if (layers.length === 1) return;

    // Add others to selection
    for (var i = 1; i < layers.length; i++) {
        var desc = new ActionDescriptor();
        var ref = new ActionReference();
        ref.putName(stringIDToTypeID("layer"), layers[i].name);
        desc.putReference(stringIDToTypeID("target"), ref);
        desc.putEnumerated(
            stringIDToTypeID("selectionModifier"),
            stringIDToTypeID("selectionModifierType"),
            stringIDToTypeID("addToSelection")
        );
        desc.putBoolean(stringIDToTypeID("makeVisible"), false);
        executeAction(stringIDToTypeID("select"), desc, DialogModes.NO);
    }
}

function convertToSmartObject() {
    try {
        executeAction(stringIDToTypeID("newPlacedLayer"), undefined, DialogModes.NO);
    } catch (e) {}
}

function rasterizeLayer() {
    try {
        var desc = new ActionDescriptor();
        var ref = new ActionReference();
        ref.putEnumerated(stringIDToTypeID("layer"), stringIDToTypeID("ordinal"), stringIDToTypeID("targetEnum"));
        desc.putReference(stringIDToTypeID("target"), ref);
        executeAction(stringIDToTypeID("rasterizeLayer"), desc, DialogModes.NO);
    } catch (e) {}
}

/* -----------------------------------------------------
  Blur Operations
 ----------------------------------------------------- */
function applyPartialBlur(doc, fileConfig) {
    var pb = fileConfig.partialBlur;
    var defaultBlur = fileConfig.blurRadius;

    // Outside selection: apply default blur to everything first
    doc.activeLayer.applyGaussianBlur(defaultBlur);

    // If partial blur area defined and radius differs
    if (pb.bounds && pb.blurRadius !== defaultBlur) {
        // Select the partial blur region
        var bounds = pb.bounds;
        var selRegion = [
            [bounds.left, bounds.top],
            [bounds.right, bounds.top],
            [bounds.right, bounds.bottom],
            [bounds.left, bounds.bottom]
        ];
        doc.selection.select(selRegion);

        // Undo the default blur within selection (History)
        // Instead: Apply additional blur or undo+reblur
        // Simpler approach: Apply blur difference
        if (pb.blurRadius > 0) {
            doc.activeLayer.applyGaussianBlur(pb.blurRadius);
        }

        doc.selection.deselect();
    }
}

/* -----------------------------------------------------
  Intermediate PSD Save
 ----------------------------------------------------- */
function saveIntermediatePsd(doc, fileConfig, globalSettings) {
    try {
        var baseName = decodeURI(new File(fileConfig.path).name).replace(/\.[^.]+$/, "");
        var suffix = globalSettings.mergeAfterColor ? "_merged" : "_color";
        var psdDir = new Folder(fileConfig.outputPath + "/../Processed_PSD");
        if (!psdDir.exists) psdDir.create();

        if (globalSettings.mergeAfterColor) {
            // Merge visible, then save
            doc.mergeVisibleLayers();
        }

        var midFile = new File(psdDir.fsName + "/" + baseName + suffix + ".psd");
        var opts = new PhotoshopSaveOptions();
        opts.layers = true;
        doc.saveAs(midFile, opts, true, Extension.LOWERCASE);
    } catch (e) {}
}

/* -----------------------------------------------------
  Helpers
 ----------------------------------------------------- */
function getExpectedChannelCount(doc) {
    // RGB=3, Grayscale=1, CMYK=4
    switch (doc.mode) {
        case DocumentMode.RGB: return 3;
        case DocumentMode.GRAYSCALE: return 1;
        case DocumentMode.CMYK: return 4;
        default: return doc.channels.length;
    }
}

/* -----------------------------------------------------
  JSON Utilities (same as other COMIC-Bridge scripts)
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

/* -----------------------------------------------------
  Execute
 ----------------------------------------------------- */
main();
