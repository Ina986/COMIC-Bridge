// scan_psd_core.jsx — Headless PSD scanner for COMIC-Bridge
// Reads: %TEMP%/psd_scan_settings.json
// Writes: %TEMP%/psd_scan_progress.json (heartbeat)
//         %TEMP%/psd_scan_results.json (final output)
// No UI — all progress is file-based for Rust polling.

// ========== JSON polyfill ==========
if (typeof JSON !== 'object') { JSON = {}; }
(function () {
    'use strict';
    function f(n) { return n < 10 ? '0' + n : n; }
    if (typeof Date.prototype.toJSON !== 'function') {
        Date.prototype.toJSON = function () {
            return isFinite(this.valueOf())
                ? this.getUTCFullYear() + '-' + f(this.getUTCMonth() + 1) + '-' + f(this.getUTCDate()) + 'T' + f(this.getUTCHours()) + ':' + f(this.getUTCMinutes()) + ':' + f(this.getUTCSeconds()) + 'Z'
                : null;
        };
        String.prototype.toJSON = Number.prototype.toJSON = Boolean.prototype.toJSON = function () { return this.valueOf(); };
    }
    var cx, escapable, gap, indent, meta, rep;
    function quote(string) {
        escapable.lastIndex = 0;
        return escapable.test(string) ? '"' + string.replace(escapable, function (a) {
            var c = meta[a]; return typeof c === 'string' ? c : '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
        }) + '"' : '"' + string + '"';
    }
    function str(key, holder) {
        var i, k, v, length, mind = gap, partial, value = holder[key];
        if (value && typeof value === 'object' && typeof value.toJSON === 'function') { value = value.toJSON(key); }
        if (typeof rep === 'function') { value = rep.call(holder, key, value); }
        switch (typeof value) {
        case 'string': return quote(value);
        case 'number': return isFinite(value) ? String(value) : 'null';
        case 'boolean': case 'null': return String(value);
        case 'object':
            if (!value) { return 'null'; }
            gap += indent; partial = [];
            if (Object.prototype.toString.apply(value) === '[object Array]') {
                length = value.length;
                for (i = 0; i < length; i += 1) { partial[i] = str(i, value) || 'null'; }
                v = partial.length === 0 ? '[]' : gap ? '[\n' + gap + partial.join(',\n' + gap) + '\n' + mind + ']' : '[' + partial.join(',') + ']';
                gap = mind; return v;
            }
            if (rep && typeof rep === 'object') {
                length = rep.length;
                for (i = 0; i < length; i += 1) { if (typeof rep[i] === 'string') { k = rep[i]; v = str(k, value); if (v) { partial.push(quote(k) + (gap ? ': ' : ':') + v); } } }
            } else {
                for (k in value) { if (Object.prototype.hasOwnProperty.call(value, k)) { v = str(k, value); if (v) { partial.push(quote(k) + (gap ? ': ' : ':') + v); } } }
            }
            v = partial.length === 0 ? '{}' : gap ? '{\n' + gap + partial.join(',\n' + gap) + '\n' + mind + '}' : '{' + partial.join(',') + '}';
            gap = mind; return v;
        }
    }
    if (typeof JSON.stringify !== 'function') {
        escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
        meta = { '\b': '\\b', '\t': '\\t', '\n': '\\n', '\f': '\\f', '\r': '\\r', '"': '\\"', '\\': '\\\\' };
        JSON.stringify = function (value, replacer, space) {
            var i; gap = ''; indent = '';
            if (typeof space === 'number') { for (i = 0; i < space; i += 1) { indent += ' '; } } else if (typeof space === 'string') { indent = space; }
            rep = replacer;
            if (replacer && typeof replacer !== 'function' && (typeof replacer !== 'object' || typeof replacer.length !== 'number')) { throw new Error('JSON.stringify'); }
            return str('', {'': value});
        };
    }
    if (typeof JSON.parse !== 'function') {
        cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
        JSON.parse = function (text, reviver) {
            var j;
            function walk(holder, key) {
                var k, v, value = holder[key];
                if (value && typeof value === 'object') { for (k in value) { if (Object.prototype.hasOwnProperty.call(value, k)) { v = walk(value, k); if (v !== undefined) { value[k] = v; } else { delete value[k]; } } } }
                return reviver.call(holder, key, value);
            }
            text = String(text); cx.lastIndex = 0;
            if (cx.test(text)) { text = text.replace(cx, function (a) { return '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4); }); }
            if (/^[\],:{}\s]*$/.test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@').replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']').replace(/(?:^|:|,)(?:\s*\[)+/g, ''))) {
                j = eval('(' + text + ')'); return typeof reviver === 'function' ? walk({'': j}, '') : j;
            }
            throw new SyntaxError('JSON.parse');
        };
    }
}());

// ========== Utility functions ==========
function trimString(s) {
    if (s === null || typeof s === 'undefined') return '';
    return typeof s.trim === 'function' ? s.trim() : String(s).replace(/^\s+|\s+$/g, '');
}

function naturalSortCompare(a, b) {
    var aParts = String(a).split(/(\d+)/);
    var bParts = String(b).split(/(\d+)/);
    var maxLen = Math.max(aParts.length, bParts.length);
    for (var i = 0; i < maxLen; i++) {
        var aPart = aParts[i] || "";
        var bPart = bParts[i] || "";
        var aNum = parseInt(aPart, 10);
        var bNum = parseInt(bPart, 10);
        if (!isNaN(aNum) && !isNaN(bNum)) {
            if (aNum !== bNum) return aNum - bNum;
        } else {
            if (aPart !== bPart) return aPart < bPart ? -1 : 1;
        }
    }
    return 0;
}

// ========== File I/O helpers ==========
function readJsonFile(path) {
    var f = new File(path);
    if (!f.exists) return null;
    try {
        f.encoding = "UTF-8";
        f.open("r");
        var content = f.read();
        f.close();
        // Strip BOM if present
        if (content.charCodeAt(0) === 0xFEFF) content = content.substring(1);
        return JSON.parse(content);
    } catch (e) {
        return null;
    }
}

function writeJsonFile(path, data) {
    var f = new File(path);
    try {
        f.encoding = "UTF-8";
        f.open("w");
        f.write(JSON.stringify(data));
        f.close();
        return true;
    } catch (e) {
        return false;
    }
}

// Progress file path (global)
var TEMP_DIR = Folder.temp.fsName.replace(/\\/g, "/");
var PROGRESS_PATH = TEMP_DIR + "/psd_scan_progress.json";
var RESULTS_PATH = TEMP_DIR + "/psd_scan_results.json";
var SETTINGS_PATH = TEMP_DIR + "/psd_scan_settings.json";

function writeProgress(current, total, message) {
    writeJsonFile(PROGRESS_PATH, { current: current, total: total, message: message || "" });
}

// ========== Photoshop scanning functions ==========

function getFontDisplayName(postScriptName) {
    try {
        for (var i = 0; i < app.fonts.length; i++) {
            if (app.fonts[i].postScriptName === postScriptName) {
                return app.fonts[i].family + " " + app.fonts[i].style;
            }
        }
    } catch(e) {}
    return postScriptName;
}

function getLayerStrokeSize(layer) {
    try {
        app.activeDocument.activeLayer = layer;
        var ref = new ActionReference();
        ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
        var desc = executeActionGet(ref);
        if (desc.hasKey(stringIDToTypeID("layerEffects"))) {
            var effectsDesc = desc.getObjectValue(stringIDToTypeID("layerEffects"));
            if (effectsDesc.hasKey(stringIDToTypeID("frameFX"))) {
                var strokeDesc = effectsDesc.getObjectValue(stringIDToTypeID("frameFX"));
                if (strokeDesc.hasKey(stringIDToTypeID("enabled"))) {
                    if (!strokeDesc.getBoolean(stringIDToTypeID("enabled"))) return null;
                }
                if (strokeDesc.hasKey(stringIDToTypeID("size"))) {
                    var size = strokeDesc.getUnitDoubleValue(stringIDToTypeID("size"));
                    return Math.round(size * 10) / 10;
                }
            }
        }
    } catch (e) {}
    return null;
}

function isTextOnlyFolder(layerSet) {
    try {
        if (layerSet.layers.length === 0) return false;
        for (var i = 0; i < layerSet.layers.length; i++) {
            var child = layerSet.layers[i];
            if (child.typename === "LayerSet") {
                if (!isTextOnlyFolder(child)) return false;
            } else if (child.kind !== LayerKind.TEXT) {
                return false;
            }
        }
        return true;
    } catch (e) { return false; }
}

function getMaxFontSizeInFolder(layerSet) {
    var maxSize = null;
    for (var i = 0; i < layerSet.layers.length; i++) {
        var layer = layerSet.layers[i];
        if (!layer.visible) continue;
        try {
            if (layer.typename === "LayerSet") {
                var subMax = getMaxFontSizeInFolder(layer);
                if (subMax !== null && (maxSize === null || subMax > maxSize)) {
                    maxSize = subMax;
                }
            } else if (layer.kind === LayerKind.TEXT) {
                var fontSize = layer.textItem.size.as("pt");
                if (maxSize === null || fontSize > maxSize) {
                    maxSize = fontSize;
                }
            }
        } catch (e) {}
    }
    return maxSize;
}

function getGuideInfo(doc) {
    var guides = { horizontal: [], vertical: [] };
    if (!doc) return guides;
    try {
        var docGuides = doc.guides;
        if (!docGuides) return guides;
        for (var i = 0; i < docGuides.length; i++) {
            try {
                var guide = docGuides[i];
                var coord = (typeof guide.coordinate === 'object' && guide.coordinate.value !== undefined) ? guide.coordinate.value : guide.coordinate;
                var directionStr = guide.direction.toString();
                if (directionStr.indexOf("HORIZONTAL") >= 0 || directionStr.indexOf("Horizontal") >= 0) {
                    guides.horizontal.push(coord);
                } else if (directionStr.indexOf("VERTICAL") >= 0 || directionStr.indexOf("Vertical") >= 0) {
                    guides.vertical.push(coord);
                }
            } catch (e) {}
        }
    } catch (e) {}
    return guides;
}

function getGuideSetHash(guideSet) {
    try {
        var hArray = [];
        for (var i = 0; i < guideSet.horizontal.length; i++) hArray.push(guideSet.horizontal[i].toFixed(1));
        var vArray = [];
        for (var j = 0; j < guideSet.vertical.length; j++) vArray.push(guideSet.vertical[j].toFixed(1));
        return "H:" + hArray.join(",") + "|V:" + vArray.join(",");
    } catch (e) { return "ERROR"; }
}

function isValidTachikiriGuideSet(guideSet) {
    try {
        if (!guideSet.docWidth || !guideSet.docHeight) return true;
        var centerX = guideSet.docWidth / 2;
        var centerY = guideSet.docHeight / 2;
        var tolerance = 1;
        var hasAbove = false, hasBelow = false;
        for (var h = 0; h < guideSet.horizontal.length; h++) {
            var hPos = guideSet.horizontal[h];
            if (Math.abs(hPos - centerY) <= tolerance) continue;
            if (hPos < centerY) hasAbove = true; else hasBelow = true;
        }
        var hasLeft = false, hasRight = false;
        for (var v = 0; v < guideSet.vertical.length; v++) {
            var vPos = guideSet.vertical[v];
            if (Math.abs(vPos - centerX) <= tolerance) continue;
            if (vPos < centerX) hasLeft = true; else hasRight = true;
        }
        return hasAbove && hasBelow && hasLeft && hasRight;
    } catch (e) { return true; }
}

function calculateFontSizeStats(allFontSizes) {
    var sizeArray = [];
    for (var size in allFontSizes) {
        sizeArray.push({ size: parseFloat(size), count: allFontSizes[size] });
    }
    if (sizeArray.length === 0) return { mostFrequent: null, sizes: [], excludeRange: null, allSizes: {} };
    sizeArray.sort(function(a, b) { return b.count - a.count; });
    var mostFrequent = sizeArray[0];
    var halfSize = mostFrequent.size / 2;
    var excludeMin = halfSize - 1;
    var excludeMax = halfSize + 1;
    return {
        mostFrequent: mostFrequent,
        sizes: sizeArray,
        excludeRange: { min: excludeMin, max: excludeMax },
        allSizes: allFontSizes
    };
}

// ========== Image layer cleanup ==========
function deleteImageLayers(doc) {
    function deleteFromParent(parent) {
        for (var i = parent.layers.length - 1; i >= 0; i--) {
            var layer = parent.layers[i];
            try {
                if (layer.typename === "LayerSet") {
                    deleteFromParent(layer);
                    if (layer.layers.length === 0) {
                        try { layer.allLocked = false; layer.remove(); } catch(e) {}
                    }
                } else if (layer.typename === "ArtLayer") {
                    if (layer.kind !== LayerKind.TEXT || !layer.visible) {
                        try { layer.allLocked = false; } catch(e) {}
                        try { layer.remove(); } catch(e) {}
                    }
                }
            } catch(e) {}
        }
    }
    deleteFromParent(doc);
}

// ========== Core scanner ==========
function scanSingleDocument(doc, usedFonts, allFontSizes, strokeStats, textLayerList, guideSets) {
    var docName = doc.name;

    function scanLayers(parent, result) {
        if (!result) result = { isTextOnly: true, maxFontSize: null, hasVisibleText: false };
        for (var i = 0; i < parent.layers.length; i++) {
            var layer = parent.layers[i];
            if (!layer.visible) continue;
            try {
                if (layer.typename === "LayerSet") {
                    if (layer.layers.length === 0) continue;
                    var subResult = scanLayers(layer, null);
                    if (!subResult.isTextOnly) result.isTextOnly = false;
                    if (subResult.maxFontSize !== null) {
                        if (result.maxFontSize === null || subResult.maxFontSize > result.maxFontSize) result.maxFontSize = subResult.maxFontSize;
                        result.hasVisibleText = true;
                    }
                    if (subResult.isTextOnly && subResult.hasVisibleText && subResult.maxFontSize !== null) {
                        try {
                            var folderStrokeSize = getLayerStrokeSize(layer);
                            if (folderStrokeSize !== null && folderStrokeSize > 0) {
                                var strokeKey = String(folderStrokeSize);
                                if (!strokeStats[strokeKey]) strokeStats[strokeKey] = { count: 0, fontSizes: {} };
                                strokeStats[strokeKey].count++;
                                strokeStats[strokeKey].fontSizes[String(subResult.maxFontSize)] = true;
                            }
                        } catch (e) {}
                    }
                } else if (layer.kind === LayerKind.TEXT) {
                    result.hasVisibleText = true;
                    try {
                        var textItem = layer.textItem;
                        var fontName = textItem.font;
                        var fontSize = Math.round(textItem.size.value * 10) / 10;
                        var content = textItem.contents || "";
                        if (content.length > 30) content = content.substring(0, 30) + "...";
                        content = content.replace(/\r\n/g, " ").replace(/\n/g, " ").replace(/\r/g, " ");
                        textLayerList.push({
                            layerName: layer.name, content: content, fontSize: fontSize,
                            fontName: fontName, displayFontName: getFontDisplayName(fontName)
                        });
                        if (!usedFonts[fontName]) usedFonts[fontName] = { count: 0, sizes: {} };
                        usedFonts[fontName].count++;
                        if (!usedFonts[fontName].sizes[fontSize]) usedFonts[fontName].sizes[fontSize] = 0;
                        usedFonts[fontName].sizes[fontSize]++;
                        if (!allFontSizes[fontSize]) allFontSizes[fontSize] = 0;
                        allFontSizes[fontSize]++;
                        if (result.maxFontSize === null || fontSize > result.maxFontSize) result.maxFontSize = fontSize;
                        try {
                            var strokeSize = getLayerStrokeSize(layer);
                            if (strokeSize !== null && strokeSize > 0) {
                                var sKey = String(strokeSize);
                                if (!strokeStats[sKey]) strokeStats[sKey] = { count: 0, fontSizes: {} };
                                strokeStats[sKey].count++;
                                strokeStats[sKey].fontSizes[String(fontSize)] = true;
                            }
                        } catch (e) {}
                    } catch (e) {}
                } else {
                    result.isTextOnly = false;
                }
            } catch (e) {}
        }
        return result;
    }

    scanLayers(doc, null);

    // Guides
    try {
        var guides = getGuideInfo(doc);
        var roundedH = [], roundedV = [];
        for (var h = 0; h < guides.horizontal.length; h++) roundedH.push(Math.round(guides.horizontal[h] * 10) / 10);
        for (var v = 0; v < guides.vertical.length; v++) roundedV.push(Math.round(guides.vertical[v] * 10) / 10);
        roundedH.sort(function(a, b) { return a - b; });
        roundedV.sort(function(a, b) { return a - b; });
        if (roundedH.length > 0 || roundedV.length > 0) {
            var hash = getGuideSetHash({ horizontal: roundedH, vertical: roundedV });
            if (hash !== "ERROR") {
                var docWidthPx = doc.width.as('px');
                var docHeightPx = doc.height.as('px');
                if (!guideSets[hash]) {
                    guideSets[hash] = { horizontal: roundedH, vertical: roundedV, count: 0, docNames: [], docWidth: docWidthPx, docHeight: docHeightPx };
                }
                guideSets[hash].count++;
                guideSets[hash].docNames.push(docName);
            }
        }
    } catch (e) {}
}

// ========== Text log collection with link detection ==========
function detectLinkedLayerGroups(doc) {
    var linkedMap = {};
    var processedLayerIds = {};
    var groupCounter = 1;

    function getLayerId(layer) {
        try {
            app.activeDocument.activeLayer = layer;
            var ref = new ActionReference();
            ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
            var desc = executeActionGet(ref);
            return desc.getInteger(stringIDToTypeID("layerID"));
        } catch (e) { return null; }
    }

    function selectLinkedLayers() {
        try {
            var desc = new ActionDescriptor();
            var ref = new ActionReference();
            ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
            desc.putReference(charIDToTypeID("null"), ref);
            executeAction(stringIDToTypeID("selectLinkedLayers"), desc, DialogModes.NO);
            return true;
        } catch (e) { return false; }
    }

    function getSelectedLayerIds() {
        var ids = [];
        try {
            var ref = new ActionReference();
            ref.putProperty(charIDToTypeID("Prpr"), stringIDToTypeID("targetLayersIDs"));
            ref.putEnumerated(charIDToTypeID("Dcmn"), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
            var desc = executeActionGet(ref);
            if (desc.hasKey(stringIDToTypeID("targetLayersIDs"))) {
                var list = desc.getList(stringIDToTypeID("targetLayersIDs"));
                for (var i = 0; i < list.count; i++) ids.push(list.getInteger(i));
            }
        } catch (e) {}
        return ids;
    }

    function scanForLinks(parent) {
        for (var i = 0; i < parent.layers.length; i++) {
            var layer = parent.layers[i];
            if (!layer.visible) continue;
            try {
                if (layer.typename === "LayerSet") {
                    scanForLinks(layer);
                } else if (layer.kind === LayerKind.TEXT) {
                    var layerId = getLayerId(layer);
                    if (layerId && !processedLayerIds[layerId]) {
                        app.activeDocument.activeLayer = layer;
                        if (selectLinkedLayers()) {
                            var selectedIds = getSelectedLayerIds();
                            if (selectedIds.length > 1) {
                                var groupId = "linkGroup_" + groupCounter;
                                groupCounter++;
                                for (var j = 0; j < selectedIds.length; j++) {
                                    linkedMap[selectedIds[j]] = groupId;
                                    processedLayerIds[selectedIds[j]] = true;
                                }
                            }
                        }
                        processedLayerIds[layerId] = true;
                    }
                }
            } catch (e) {}
        }
    }

    try { scanForLinks(doc); } catch (e) {}
    return linkedMap;
}

function getLayerLinkInfo(layer) {
    var result = { isLinked: false, linkGroupId: null };
    try {
        app.activeDocument.activeLayer = layer;
        var ref = new ActionReference();
        ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
        var desc = executeActionGet(ref);
        var layerId = desc.getInteger(stringIDToTypeID("layerID"));
        if (desc.hasKey(stringIDToTypeID("linkedLayerIDs"))) {
            var linkedList = desc.getList(stringIDToTypeID("linkedLayerIDs"));
            if (linkedList.count > 0) {
                result.isLinked = true;
                var ids = [layerId];
                for (var i = 0; i < linkedList.count; i++) ids.push(linkedList.getInteger(i));
                ids.sort(function(a, b) { return a - b; });
                result.linkGroupId = ids.join("_");
                return result;
            }
        }
        if (desc.hasKey(stringIDToTypeID("linked"))) {
            if (desc.getBoolean(stringIDToTypeID("linked"))) {
                result.isLinked = true;
                result.linkGroupId = "linked_" + layerId;
                return result;
            }
        }
    } catch (e) {}
    return result;
}

function collectTextForLog(doc) {
    var textData = [];
    var linkedMap = detectLinkedLayerGroups(doc);

    function getLayerId(layer) {
        try {
            app.activeDocument.activeLayer = layer;
            var ref = new ActionReference();
            ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
            var desc = executeActionGet(ref);
            return desc.getInteger(stringIDToTypeID("layerID"));
        } catch (e) { return null; }
    }

    function scanLayers(parent) {
        for (var i = 0; i < parent.layers.length; i++) {
            var layer = parent.layers[i];
            if (!layer.visible) continue;
            try {
                if (layer.typename === "LayerSet") {
                    scanLayers(layer);
                } else if (layer.kind === LayerKind.TEXT) {
                    try {
                        var textItem = layer.textItem;
                        var content = textItem.contents || "";
                        if (trimString(content) === "") continue;
                        var bounds = layer.bounds;
                        var yPos = bounds[1].as("px");
                        var fontSize = 0;
                        try { fontSize = textItem.size.as("pt"); } catch (e) {}
                        var layerId = getLayerId(layer);
                        var isLinked = false;
                        var linkGroupId = null;
                        if (layerId && linkedMap[layerId]) {
                            isLinked = true;
                            linkGroupId = linkedMap[layerId];
                        } else {
                            var linkInfo = getLayerLinkInfo(layer);
                            isLinked = linkInfo.isLinked;
                            linkGroupId = linkInfo.linkGroupId;
                        }
                        textData.push({
                            content: content, yPos: yPos, layerName: layer.name,
                            fontSize: fontSize, isLinked: isLinked, linkGroupId: linkGroupId
                        });
                    } catch (e) {}
                }
            } catch (e) {}
        }
    }

    scanLayers(doc);
    textData.sort(function(a, b) { return b.yPos - a.yPos; });
    return textData;
}

// ========== Folder scanning ==========
function findPSDFilesInFolder(folder) {
    var psdFiles = [];
    try {
        var files = folder.getFiles("*");
        for (var i = 0; i < files.length; i++) {
            if (files[i] instanceof File && files[i].name.toLowerCase().match(/\.(psd|psb)$/)) {
                psdFiles.push(files[i]);
            }
        }
    } catch (e) {}
    return psdFiles;
}

function determineTargetFolders(folder) {
    var targetFolders = [];
    var items = folder.getFiles("*");
    var hasPSD = false;
    var subFolders = [];
    for (var i = 0; i < items.length; i++) {
        if (items[i] instanceof File && items[i].name.toLowerCase().match(/\.(psd|psb)$/)) {
            hasPSD = true;
        } else if (items[i] instanceof Folder && items[i].name.charAt(0) !== "_" && items[i].name.charAt(0) !== ".") {
            subFolders.push(items[i]);
        }
    }
    if (hasPSD) {
        targetFolders.push(folder);
    } else if (subFolders.length > 0) {
        subFolders.sort(function(a, b) { return naturalSortCompare(a.name, b.name); });
        for (var j = 0; j < subFolders.length; j++) {
            if (findPSDFilesInFolder(subFolders[j]).length > 0) {
                targetFolders.push(subFolders[j]);
            }
        }
    }
    return targetFolders;
}

function mergeFontData(existingFonts, newUsedFonts) {
    var usedFonts = {};
    if (existingFonts) {
        for (var i = 0; i < existingFonts.length; i++) {
            var f = existingFonts[i];
            usedFonts[f.name] = { count: f.count, sizes: {} };
            if (f.sizes) {
                for (var j = 0; j < f.sizes.length; j++) usedFonts[f.name].sizes[f.sizes[j].size] = f.sizes[j].count;
            }
        }
    }
    for (var fontName in newUsedFonts) {
        if (!usedFonts[fontName]) usedFonts[fontName] = { count: 0, sizes: {} };
        usedFonts[fontName].count += newUsedFonts[fontName].count;
        for (var size in newUsedFonts[fontName].sizes) {
            if (!usedFonts[fontName].sizes[size]) usedFonts[fontName].sizes[size] = 0;
            usedFonts[fontName].sizes[size] += newUsedFonts[fontName].sizes[size];
        }
    }
    return usedFonts;
}

// ========== Main processing ==========
function processFolders(settings) {
    var folders = settings.folders;
    var existingScanData = settings.existingScanData;

    // Count total PSD files across all folders
    var allTargetFolders = [];
    var totalPsdCount = 0;
    for (var fi = 0; fi < folders.length; fi++) {
        var folderObj = new Folder(folders[fi].path);
        if (!folderObj.exists) continue;
        var targets = determineTargetFolders(folderObj);
        for (var ti = 0; ti < targets.length; ti++) {
            var psdFiles = findPSDFilesInFolder(targets[ti]);
            totalPsdCount += psdFiles.length;
            allTargetFolders.push({ folder: targets[ti], volume: folders[fi].volume, psdFiles: psdFiles });
        }
    }

    writeProgress(0, totalPsdCount, "スキャン準備中...");

    // Existing doc names (for differential scanning)
    var scannedDocNames = {};
    if (existingScanData && existingScanData.textLayersByDoc) {
        for (var docName in existingScanData.textLayersByDoc) scannedDocNames[docName] = true;
    }

    var allUsedFonts = {};
    var allFontSizes = {};
    var allStrokeStats = {};
    var allTextLayersByDoc = {};
    var allGuideSets = {};
    var textLogByFolder = {};
    var scannedFolders = {};
    var folderVolumeMapping = {};
    var globalProcessed = 0;
    var globalErrors = 0;

    // Preserve existing scanned folders
    if (existingScanData && existingScanData.scannedFolders) {
        for (var fp in existingScanData.scannedFolders) scannedFolders[fp] = existingScanData.scannedFolders[fp];
    }

    var originalDialogMode = app.displayDialogs;
    app.displayDialogs = DialogModes.NO;

    for (var fi = 0; fi < allTargetFolders.length; fi++) {
        var entry = allTargetFolders[fi];
        var targetFolder = entry.folder;
        var psdFiles = entry.psdFiles;
        var folderName = targetFolder.name;

        folderVolumeMapping[folderName] = entry.volume;

        // Filter to new files only
        var newPsdFiles = [];
        for (var i = 0; i < psdFiles.length; i++) {
            if (!scannedDocNames[psdFiles[i].name]) newPsdFiles.push(psdFiles[i]);
        }

        if (newPsdFiles.length === 0) {
            globalProcessed += psdFiles.length; // count as processed (skipped)
            continue;
        }

        var folderUsedFonts = {};
        var folderFontSizes = {};
        var folderStrokeStats = {};
        var folderGuideSets = {};
        var folderScannedFiles = [];
        if (!textLogByFolder[folderName]) textLogByFolder[folderName] = {};

        for (var i = 0; i < newPsdFiles.length; i++) {
            var psdFile = newPsdFiles[i];
            globalProcessed++;
            writeProgress(globalProcessed, totalPsdCount, psdFile.name);

            try {
                var doc = app.open(psdFile);
                app.activeDocument = doc;
                var docName = doc.name;

                deleteImageLayers(doc);

                var textLayerList = [];
                scanSingleDocument(doc, folderUsedFonts, folderFontSizes, folderStrokeStats, textLayerList, folderGuideSets);
                allTextLayersByDoc[docName] = textLayerList;

                textLogByFolder[folderName][docName] = collectTextForLog(doc);

                try { doc.close(SaveOptions.DONOTSAVECHANGES); } catch (e) {}
                folderScannedFiles.push(psdFile.name);
            } catch (e) {
                globalErrors++;
            }
        }

        if (folderScannedFiles.length > 0) {
            scannedFolders[targetFolder.fsName] = { files: folderScannedFiles, scanDate: new Date().toString() };
        }

        // Merge folder data into global
        for (var fontName in folderUsedFonts) {
            if (!allUsedFonts[fontName]) allUsedFonts[fontName] = { count: 0, sizes: {} };
            allUsedFonts[fontName].count += folderUsedFonts[fontName].count;
            for (var sz in folderUsedFonts[fontName].sizes) {
                if (!allUsedFonts[fontName].sizes[sz]) allUsedFonts[fontName].sizes[sz] = 0;
                allUsedFonts[fontName].sizes[sz] += folderUsedFonts[fontName].sizes[sz];
            }
        }
        for (var sz in folderFontSizes) {
            if (!allFontSizes[sz]) allFontSizes[sz] = 0;
            allFontSizes[sz] += folderFontSizes[sz];
        }
        for (var sz in folderStrokeStats) {
            if (!allStrokeStats[sz]) allStrokeStats[sz] = { count: 0, fontSizes: {} };
            allStrokeStats[sz].count += folderStrokeStats[sz].count;
            for (var fs in folderStrokeStats[sz].fontSizes) allStrokeStats[sz].fontSizes[fs] = true;
        }
        for (var hash in folderGuideSets) {
            if (!allGuideSets[hash]) {
                allGuideSets[hash] = {
                    horizontal: folderGuideSets[hash].horizontal, vertical: folderGuideSets[hash].vertical,
                    count: 0, docNames: [], docWidth: folderGuideSets[hash].docWidth, docHeight: folderGuideSets[hash].docHeight
                };
            }
            allGuideSets[hash].count += folderGuideSets[hash].count;
            allGuideSets[hash].docNames = allGuideSets[hash].docNames.concat(folderGuideSets[hash].docNames);
        }
    }

    app.displayDialogs = originalDialogMode;

    // Merge with existing data
    var mergedTextLayersByDoc = {};
    if (existingScanData && existingScanData.textLayersByDoc) {
        for (var docName in existingScanData.textLayersByDoc) mergedTextLayersByDoc[docName] = existingScanData.textLayersByDoc[docName];
    }
    for (var docName in allTextLayersByDoc) mergedTextLayersByDoc[docName] = allTextLayersByDoc[docName];

    var mergedUsedFonts = mergeFontData(existingScanData ? existingScanData.fonts : null, allUsedFonts);

    // Convert fonts to array
    var fontArray = [];
    for (var font in mergedUsedFonts) {
        var sizes = [];
        for (var size in mergedUsedFonts[font].sizes) sizes.push({ size: parseFloat(size), count: mergedUsedFonts[font].sizes[size] });
        sizes.sort(function(a, b) { return b.count - a.count; });
        fontArray.push({ name: font, displayName: getFontDisplayName(font), count: mergedUsedFonts[font].count, sizes: sizes });
    }
    fontArray.sort(function(a, b) { return b.count - a.count; });

    // Merge font sizes
    var mergedAllFontSizes = {};
    for (var size in allFontSizes) {
        if (!mergedAllFontSizes[size]) mergedAllFontSizes[size] = 0;
        mergedAllFontSizes[size] += allFontSizes[size];
    }

    // Merge stroke stats
    var strokeArray = [];
    for (var size in allStrokeStats) {
        var fontSizes = allStrokeStats[size].fontSizes || {};
        var fontSizeArray = [];
        for (var fs in fontSizes) fontSizeArray.push(parseFloat(fs));
        fontSizeArray.sort(function(a, b) { return b - a; });
        strokeArray.push({
            size: parseFloat(size), count: allStrokeStats[size].count,
            fontSizes: fontSizeArray, maxFontSize: fontSizeArray.length > 0 ? fontSizeArray[0] : null
        });
    }
    strokeArray.sort(function(a, b) { return b.count - a.count; });

    // Guide sets
    var guideSetArray = [];
    // Merge existing guide sets first
    if (existingScanData && existingScanData.guideSets) {
        for (var gi = 0; gi < existingScanData.guideSets.length; gi++) {
            var gs = existingScanData.guideSets[gi];
            var hash = getGuideSetHash(gs);
            if (hash !== "ERROR" && !allGuideSets[hash]) {
                allGuideSets[hash] = {
                    horizontal: gs.horizontal, vertical: gs.vertical,
                    count: gs.count, docNames: gs.docNames || [],
                    docWidth: gs.docWidth, docHeight: gs.docHeight
                };
            } else if (hash !== "ERROR" && allGuideSets[hash]) {
                allGuideSets[hash].count += gs.count;
                allGuideSets[hash].docNames = allGuideSets[hash].docNames.concat(gs.docNames || []);
            }
        }
    }
    for (var hash in allGuideSets) {
        if (allGuideSets.hasOwnProperty(hash)) guideSetArray.push(allGuideSets[hash]);
    }
    guideSetArray.sort(function(a, b) {
        var aValid = isValidTachikiriGuideSet(a) ? 1 : 0;
        var bValid = isValidTachikiriGuideSet(b) ? 1 : 0;
        if (aValid !== bValid) return bValid - aValid;
        return b.count - a.count;
    });

    // Merge text log from existing data
    if (existingScanData && existingScanData.textLogByFolder) {
        for (var fk in existingScanData.textLogByFolder) {
            if (!textLogByFolder[fk]) textLogByFolder[fk] = {};
            for (var dk in existingScanData.textLogByFolder[fk]) {
                if (!textLogByFolder[fk][dk]) textLogByFolder[fk][dk] = existingScanData.textLogByFolder[fk][dk];
            }
        }
    }

    // Total processed
    var totalProcessed = 0;
    for (var docKey in mergedTextLayersByDoc) {
        if (mergedTextLayersByDoc.hasOwnProperty(docKey)) totalProcessed++;
    }

    var sizeStats = calculateFontSizeStats(mergedAllFontSizes);

    return {
        fonts: fontArray,
        sizeStats: sizeStats,
        allFontSizes: mergedAllFontSizes,
        strokeStats: { sizes: strokeArray },
        guideSets: guideSetArray,
        textLayersByDoc: mergedTextLayersByDoc,
        scannedFolders: scannedFolders,
        processedFiles: totalProcessed,
        workInfo: existingScanData && existingScanData.workInfo ? existingScanData.workInfo : {
            genre: "", label: "", authorType: "single", author: "", artist: "", original: "",
            title: "", subtitle: "", editor: "", volume: 1, storagePath: "", notes: ""
        },
        textLogByFolder: textLogByFolder,
        folderVolumeMapping: folderVolumeMapping,
        editedRubyList: existingScanData ? existingScanData.editedRubyList : undefined
    };
}

// ========== Entry point ==========
(function main() {
    try {
        writeProgress(0, 0, "設定を読み込み中...");

        var settings = readJsonFile(SETTINGS_PATH);
        if (!settings || !settings.folders || settings.folders.length === 0) {
            writeJsonFile(RESULTS_PATH, { error: "設定ファイルが無効です", fonts: [], sizeStats: {}, allFontSizes: {}, strokeStats: { sizes: [] }, guideSets: [], textLayersByDoc: {}, scannedFolders: {}, processedFiles: 0 });
            return;
        }

        var result = processFolders(settings);
        writeProgress(result.processedFiles, result.processedFiles, "完了");
        writeJsonFile(RESULTS_PATH, result);
    } catch (e) {
        writeJsonFile(RESULTS_PATH, { error: e.message || String(e), fonts: [], sizeStats: {}, allFontSizes: {}, strokeStats: { sizes: [] }, guideSets: [], textLayersByDoc: {}, scannedFolders: {}, processedFiles: 0 });
    }
})();
