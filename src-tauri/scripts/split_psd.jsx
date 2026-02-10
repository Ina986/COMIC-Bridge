// Photoshop JSX Script for Spread Page Split
// Based on bunkatsu_ver1.13.jsx patterns, integrated with app's config/result pattern

#target photoshop

app.displayDialogs = DialogModes.NO;
app.preferences.rulerUnits = Units.PIXELS;

/* -----------------------------------------------------
  Main Processing
 ----------------------------------------------------- */
function main() {
    var tempFolder = Folder.temp;
    var settingsFile = new File(tempFolder + "/psd_split_settings.json");

    if (!settingsFile.exists) {
        alert("Settings file not found: " + settingsFile.fsName);
        return;
    }

    settingsFile.open("r");
    settingsFile.encoding = "UTF-8";
    var jsonStr = settingsFile.read();
    settingsFile.close();

    // BOMが残っている場合はスキップ
    if (jsonStr.charCodeAt(0) === 0xFEFF || jsonStr.charCodeAt(0) === 0xEF) {
        jsonStr = jsonStr.substring(1);
    }

    var settings;
    try {
        settings = parseJSON(jsonStr);
    } catch (e) {
        alert("Failed to parse settings: " + e.message);
        return;
    }

    // Ensure output directory exists
    var outputFolder = new Folder(settings.outputDir);
    if (!outputFolder.exists) {
        outputFolder.create();
    }

    var results = [];

    // Helper: extract file path from file info (supports both string and object format)
    function getFilePath(fileInfo) {
        if (typeof fileInfo === "string") return fileInfo;
        return fileInfo.path;
    }
    function getPdfPageIndex(fileInfo) {
        if (typeof fileInfo === "object" && fileInfo.pdfPageIndex >= 0) return fileInfo.pdfPageIndex;
        return -1;
    }

    // Detect standard width from reference file (2nd file or 1st if only 1)
    var standardWidth = 0;
    if (settings.files.length > 1 && settings.mode !== "none") {
        var refIndex = Math.min(1, settings.files.length - 1);
        try {
            var refPath = getFilePath(settings.files[refIndex]);
            var refPageIdx = getPdfPageIndex(settings.files[refIndex]);
            var refFile = new File(refPath);
            if (refFile.exists) {
                var refDoc;
                if (refPageIdx >= 0 && refPath.match(/\.pdf$/i)) {
                    var pdfOpts = new PDFOpenOptions();
                    pdfOpts.page = refPageIdx + 1;
                    pdfOpts.resolution = 600;
                    pdfOpts.mode = OpenDocumentMode.RGB;
                    refDoc = app.open(refFile, pdfOpts);
                } else {
                    refDoc = app.open(refFile);
                }
                standardWidth = refDoc.width.value;
                refDoc.close(SaveOptions.DONOTSAVECHANGES);
            }
        } catch (e) {}
    }

    var nextPageNum = 1;
    var skipFirstRight = (settings.firstPageBlank === true);
    var skipLastLeft = (settings.lastPageBlank === true);
    for (var i = 0; i < settings.files.length; i++) {
        var filePath = getFilePath(settings.files[i]);
        var pdfPageIndex = getPdfPageIndex(settings.files[i]);
        var doSkipRight = (skipFirstRight && i === 0);
        var doSkipLeft = (skipLastLeft && i === settings.files.length - 1);
        var result = processFile(filePath, pdfPageIndex, settings, outputFolder, i, standardWidth, nextPageNum, doSkipRight, doSkipLeft);
        results.push(result);

        // 出力ファイル数でページ番号を進める（SKIPPEDは除外）
        var outputCount = 0;
        for (var j = 0; j < result.changes.length; j++) {
            if (result.changes[j].indexOf("SKIPPED") === -1) {
                outputCount++;
            }
        }
        if (outputCount > 0) {
            nextPageNum += outputCount;
        }
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
function zeroPad(num, length) {
    var s = String(num);
    while (s.length < length) s = "0" + s;
    return s;
}

function getPageNames(baseName, settings, startPageNum) {
    if (settings.pageNumbering === "sequential") {
        return {
            right: baseName + "_" + zeroPad(startPageNum, 3),
            left: baseName + "_" + zeroPad(startPageNum + 1, 3),
            single: baseName + "_" + zeroPad(startPageNum, 3)
        };
    }
    return {
        right: baseName + "_R",
        left: baseName + "_L",
        single: baseName + "_001"
    };
}

function processFile(filePath, pdfPageIndex, settings, outputFolder, fileIndex, standardWidth, startPageNum, skipRightPage, skipLeftPage) {
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

        // 既に分割済みファイル(_L/_R)はスキップ
        var checkName = decodeURI(file.name).replace(/\.[^.]+$/, '');
        if (checkName.match(/_(L|R)$/)) {
            result.success = true;
            result.changes.push("SKIPPED (already split)");
            return result;
        }

        // PDFはページ指定でオープン
        if (pdfPageIndex >= 0 && filePath.match(/\.pdf$/i)) {
            var pdfOpts = new PDFOpenOptions();
            pdfOpts.page = pdfPageIndex + 1;  // 1-based
            pdfOpts.resolution = 600;
            pdfOpts.mode = OpenDocumentMode.RGB;
            pdfOpts.antiAlias = true;
            pdfOpts.constrainProportions = true;
            doc = app.open(file, pdfOpts);
        } else {
            doc = app.open(file);
        }

        var originalWidth = doc.width.value;
        var originalHeight = doc.height.value;
        var baseName = (settings.customBaseName && settings.customBaseName !== "")
            ? settings.customBaseName
            : decodeURI(file.name).replace(/\.[^.]+$/, '');

        // Detect single page (first/last file that is <70% of standard width)
        var isSinglePage = false;
        if (settings.mode !== "none" && standardWidth > 0) {
            if ((fileIndex === 0 || fileIndex === settings.files.length - 1) &&
                originalWidth < standardWidth * 0.7) {
                isSinglePage = true;
            }
        }

        if (settings.mode === "none") {
            // No split - just save in target format
            if (settings.deleteHiddenLayers) deleteHiddenLayers(doc);
            var names = getPageNames(baseName, settings, startPageNum);
            saveDocument(doc, outputFolder, names.single, settings);
            result.changes.push(names.single + "." + settings.outputFormat);
            doc.close(SaveOptions.DONOTSAVECHANGES);
        } else if (isSinglePage) {
            // Single page: resize canvas if uneven mode has target width
            if (settings.deleteHiddenLayers) deleteHiddenLayers(doc);
            var names = getPageNames(baseName, settings, startPageNum);

            if (settings.mode === "uneven") {
                var halfWidth = Math.floor(standardWidth / 2);
                var outerMargin = settings.selectionLeft;
                var innerMargin = halfWidth - settings.selectionRight;
                var marginToAdd = Math.max(0, outerMargin - innerMargin);
                var targetWidth = halfWidth + marginToAdd;
                if (originalWidth < targetWidth) {
                    doc.resizeCanvas(UnitValue(targetWidth, "px"), doc.height, AnchorPosition.MIDDLECENTER);
                }
            }

            saveDocument(doc, outputFolder, names.single, settings);
            result.changes.push(names.single + "." + settings.outputFormat);
            doc.close(SaveOptions.DONOTSAVECHANGES);
        } else if (settings.mode === "even") {
            processEvenSplit(doc, baseName, outputFolder, settings, result, startPageNum, skipRightPage, skipLeftPage);
        } else if (settings.mode === "uneven") {
            processUnevenSplit(doc, baseName, outputFolder, settings, result, startPageNum, skipRightPage, skipLeftPage);
        }

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

/* -----------------------------------------------------
  Even Split (center)
 ----------------------------------------------------- */
function processEvenSplit(doc, baseName, outputFolder, settings, result, startPageNum, skipRightPage, skipLeftPage) {
    var originalWidth = doc.width.value;
    var originalHeight = doc.height.value;
    var halfWidth = Math.floor(originalWidth / 2);

    if (skipRightPage) {
        // 白紙右ページを破棄 — 左ページのみ保存（連番の最初）
        var names = getPageNames(baseName, settings, startPageNum);
        var leftDoc = doc.duplicate();
        if (settings.deleteHiddenLayers) deleteHiddenLayers(leftDoc);
        if (settings.deleteOffCanvasText) deleteOffCanvasTextLayers(leftDoc, "right");
        leftDoc.crop([0, 0, halfWidth, originalHeight]);

        saveDocument(leftDoc, outputFolder, names.single, settings);
        leftDoc.close(SaveOptions.DONOTSAVECHANGES);
        result.changes.push(names.single + "." + settings.outputFormat);

        doc.close(SaveOptions.DONOTSAVECHANGES);
        return;
    }

    if (skipLeftPage) {
        // 白紙左ページを破棄 — 右ページのみ保存（連番の最後）
        var names = getPageNames(baseName, settings, startPageNum);
        var rightDoc = doc.duplicate();
        if (settings.deleteHiddenLayers) deleteHiddenLayers(rightDoc);
        if (settings.deleteOffCanvasText) deleteOffCanvasTextLayers(rightDoc, "left");
        rightDoc.crop([originalWidth - halfWidth, 0, originalWidth, originalHeight]);

        saveDocument(rightDoc, outputFolder, names.single, settings);
        rightDoc.close(SaveOptions.DONOTSAVECHANGES);
        result.changes.push(names.single + "." + settings.outputFormat);

        doc.close(SaveOptions.DONOTSAVECHANGES);
        return;
    }

    var names = getPageNames(baseName, settings, startPageNum);

    // Right page (even number in manga reading order)
    var rightDoc = doc.duplicate();
    if (settings.deleteHiddenLayers) deleteHiddenLayers(rightDoc);
    if (settings.deleteOffCanvasText) deleteOffCanvasTextLayers(rightDoc, "left");
    rightDoc.crop([originalWidth - halfWidth, 0, originalWidth, originalHeight]);

    saveDocument(rightDoc, outputFolder, names.right, settings);
    rightDoc.close(SaveOptions.DONOTSAVECHANGES);
    result.changes.push(names.right + "." + settings.outputFormat);

    // Left page (odd number in manga reading order)
    var leftDoc = doc.duplicate();
    if (settings.deleteHiddenLayers) deleteHiddenLayers(leftDoc);
    if (settings.deleteOffCanvasText) deleteOffCanvasTextLayers(leftDoc, "right");
    leftDoc.crop([0, 0, halfWidth, originalHeight]);

    saveDocument(leftDoc, outputFolder, names.left, settings);
    leftDoc.close(SaveOptions.DONOTSAVECHANGES);
    result.changes.push(names.left + "." + settings.outputFormat);

    doc.close(SaveOptions.DONOTSAVECHANGES);
}

/* -----------------------------------------------------
  Uneven Split (margin-adjusted)
 ----------------------------------------------------- */
function processUnevenSplit(doc, baseName, outputFolder, settings, result, startPageNum, skipRightPage, skipLeftPage) {
    var originalWidth = doc.width.value;
    var originalHeight = doc.height.value;
    var halfWidth = Math.floor(originalWidth / 2);

    // 元スクリプト(bunkatsu_ver1.13.jsx)準拠のマージン計算
    var outerMargin = settings.selectionLeft || 0;
    var innerMargin = halfWidth - (settings.selectionRight || 0);
    var marginToAdd = Math.max(0, outerMargin - innerMargin);

    // 超過チェック: 選択範囲が中央を超えている場合
    var overlapPx = Math.max(0, (settings.selectionRight || 0) - halfWidth);
    var overlapPercent = halfWidth > 0 ? (overlapPx / halfWidth) * 100 : 0;

    if (overlapPercent > 5) {
        throw new Error("Selection exceeds center by " + overlapPercent.toFixed(1) + "% (limit: 5%)");
    }

    // 超過が5%以内の場合は自動補正: innerMargin=0, marginToAdd=outerMargin
    if (overlapPx > 0) {
        innerMargin = 0;
        marginToAdd = outerMargin;
    }

    var finalOutputWidth = halfWidth + marginToAdd;

    if (skipRightPage) {
        // 白紙右ページを破棄 — 左ページのみ保存
        var names = getPageNames(baseName, settings, startPageNum);
        var leftDoc = doc.duplicate();
        if (settings.deleteHiddenLayers) deleteHiddenLayers(leftDoc);
        if (settings.deleteOffCanvasText) deleteOffCanvasTextLayers(leftDoc, "right");
        leftDoc.crop([0, 0, halfWidth, originalHeight]);
        leftDoc.resizeCanvas(UnitValue(finalOutputWidth, "px"), leftDoc.height, AnchorPosition.MIDDLELEFT);

        saveDocument(leftDoc, outputFolder, names.single, settings);
        leftDoc.close(SaveOptions.DONOTSAVECHANGES);
        result.changes.push(names.single + "." + settings.outputFormat);

        doc.close(SaveOptions.DONOTSAVECHANGES);
        return;
    }

    if (skipLeftPage) {
        // 白紙左ページを破棄 — 右ページのみ保存
        var names = getPageNames(baseName, settings, startPageNum);
        var rightDoc = doc.duplicate();
        if (settings.deleteHiddenLayers) deleteHiddenLayers(rightDoc);
        if (settings.deleteOffCanvasText) deleteOffCanvasTextLayers(rightDoc, "left");
        rightDoc.crop([originalWidth - halfWidth, 0, originalWidth, originalHeight]);
        rightDoc.resizeCanvas(UnitValue(finalOutputWidth, "px"), rightDoc.height, AnchorPosition.MIDDLERIGHT);

        saveDocument(rightDoc, outputFolder, names.single, settings);
        rightDoc.close(SaveOptions.DONOTSAVECHANGES);
        result.changes.push(names.single + "." + settings.outputFormat);

        doc.close(SaveOptions.DONOTSAVECHANGES);
        return;
    }

    var names = getPageNames(baseName, settings, startPageNum);

    // Right page: crop right half → resizeCanvas to add inner padding on left
    var rightDoc = doc.duplicate();
    if (settings.deleteHiddenLayers) deleteHiddenLayers(rightDoc);
    if (settings.deleteOffCanvasText) deleteOffCanvasTextLayers(rightDoc, "left");
    rightDoc.crop([originalWidth - halfWidth, 0, originalWidth, originalHeight]);
    rightDoc.resizeCanvas(UnitValue(finalOutputWidth, "px"), rightDoc.height, AnchorPosition.MIDDLERIGHT);

    saveDocument(rightDoc, outputFolder, names.right, settings);
    rightDoc.close(SaveOptions.DONOTSAVECHANGES);
    result.changes.push(names.right + "." + settings.outputFormat);

    // Left page: crop left half → resizeCanvas to add inner padding on right
    var leftDoc = doc.duplicate();
    if (settings.deleteHiddenLayers) deleteHiddenLayers(leftDoc);
    if (settings.deleteOffCanvasText) deleteOffCanvasTextLayers(leftDoc, "right");
    leftDoc.crop([0, 0, halfWidth, originalHeight]);
    leftDoc.resizeCanvas(UnitValue(finalOutputWidth, "px"), leftDoc.height, AnchorPosition.MIDDLELEFT);

    saveDocument(leftDoc, outputFolder, names.left, settings);
    leftDoc.close(SaveOptions.DONOTSAVECHANGES);
    result.changes.push(names.left + "." + settings.outputFormat);

    doc.close(SaveOptions.DONOTSAVECHANGES);
}

/* -----------------------------------------------------
  Layer Cleanup
 ----------------------------------------------------- */
function deleteHiddenLayers(doc) {
    if (!doc) return;
    try {
        for (var i = doc.layers.length - 1; i >= 0; i--) {
            if (!doc.layers[i].visible) {
                doc.layers[i].remove();
            }
        }
    } catch (e) {}
}

function deleteOffCanvasTextLayers(doc, side) {
    if (!doc) return;
    var halfWidth = doc.width.value / 2;

    try {
        for (var i = doc.layers.length - 1; i >= 0; i--) {
            var layer = doc.layers[i];
            if (layer.kind === LayerKind.TEXT) {
                var bounds = layer.bounds;
                var layerCenter = (bounds[0].value + bounds[2].value) / 2;

                if (side === "right" && layerCenter > halfWidth + 5) {
                    layer.remove();
                } else if (side === "left" && layerCenter < halfWidth - 5) {
                    layer.remove();
                }
            }
        }
    } catch (e) {}
}

/* -----------------------------------------------------
  Save Document
 ----------------------------------------------------- */
function saveDocument(doc, folder, baseName, settings) {
    app.activeDocument = doc;

    if (settings.outputFormat === "jpg") {
        var jpgFile = new File(folder + "/" + baseName + ".jpg");
        var jpgOptions = new JPEGSaveOptions();
        jpgOptions.quality = settings.jpgQuality || 12;
        jpgOptions.embedColorProfile = true;
        jpgOptions.formatOptions = FormatOptions.PROGRESSIVE;
        jpgOptions.scans = 3;
        jpgOptions.matte = MatteType.NONE;
        doc.saveAs(jpgFile, jpgOptions, true, Extension.LOWERCASE);
    } else {
        var psdFile = new File(folder + "/" + baseName + ".psd");
        var psdOptions = new PhotoshopSaveOptions();
        psdOptions.layers = true;
        psdOptions.embedColorProfile = true;
        doc.saveAs(psdFile, psdOptions, true, Extension.LOWERCASE);
    }
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
