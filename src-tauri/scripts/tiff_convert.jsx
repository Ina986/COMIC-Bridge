// Photoshop JSX Script for TIFF Conversion
// Processing pipeline integrated with COMIC-Bridge config/result pattern

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
    var tempFolder = new Folder(Folder.temp.fsName + "/COMIC-Bridge/convert"); if (!tempFolder.exists) { tempFolder.create(); }

    var settingsFile = (typeof COMIC_BRIDGE_SETTINGS_PATH !== "undefined" && COMIC_BRIDGE_SETTINGS_PATH) ? new File(COMIC_BRIDGE_SETTINGS_PATH) : new File(tempFolder + "/psd_tiff_settings.json");

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

    // Initial heartbeat: signal script has started
    try {
        var pf = new File((typeof COMIC_BRIDGE_PROGRESS_PATH !== "undefined" && COMIC_BRIDGE_PROGRESS_PATH) ? COMIC_BRIDGE_PROGRESS_PATH : tempFolder + "/psd_tiff_progress.txt");
        pf.open("w"); pf.write("0/" + String(config.files.length)); pf.close();
    } catch (e_hb0) {}

    for (var i = 0; i < config.files.length; i++) {
        var fileConfig = config.files[i];
        var result = processFile(fileConfig, globalSettings);
        results.push(result);

        // Heartbeat: write progress so Rust knows we are still alive
        try {
            var progressFile = new File((typeof COMIC_BRIDGE_PROGRESS_PATH !== "undefined" && COMIC_BRIDGE_PROGRESS_PATH) ? COMIC_BRIDGE_PROGRESS_PATH : tempFolder + "/psd_tiff_progress.txt");
            progressFile.open("w");
            progressFile.write(String(i + 1) + "/" + String(config.files.length));
            progressFile.close();
        } catch (e_hb) { /* ignore */ }
    }

    // Write results
    var resultFile = (typeof COMIC_BRIDGE_OUTPUT_PATH !== "undefined" && COMIC_BRIDGE_OUTPUT_PATH) ? new File(COMIC_BRIDGE_OUTPUT_PATH) : new File(tempFolder + "/psd_tiff_results.json");
    resultFile.open("w");
    resultFile.encoding = "UTF-8";
    resultFile.write(valueToJSON({ results: results }));
    resultFile.close();

    // 診断ファイルを書き出す（白消し再表示の原因調査用）
    cbDiagWrite();

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

        var doc = app.open(file);

        // ★ app.open 直後の「正しい可視性」を id 単位で記録（この後の処理で化けても復元できる）。
        var __origVis = {};
        cbCaptureVis(doc, __origVis);

        // === 診断: app.open 直後（purge/unlock 前）の可視性を DOM と AM で読み比べる ===
        cbDiag("=== RAW OPEN: " + fileName + " ===");
        try {
            for (var __ri = 0; __ri < doc.layers.length; __ri++) {
                var __rl = doc.layers[__ri];
                var __dom = "?"; try { __dom = __rl.visible; } catch (e) {}
                var __amIx = cbVisByAMIndex(__ri + 1);
                var __amId = "?"; try { __amId = cbVisByAMId(__rl.id); } catch (e) {}
                var __nm = "?"; try { __nm = __rl.name; } catch (e) {}
                cbDiag("  [" + __ri + '] name="' + __nm + '" DOM.visible=' + __dom
                    + " AM.byIndex=" + __amIx + " AM.byId=" + __amId);
            }
        } catch (e) { cbDiag("  (raw read error: " + e + ")"); }
        // 先頭レイヤー(白消し想定)の全AMプロパティキーをダンプ（可視性の別手掛かり探索）
        try {
            var __r0 = new ActionReference();
            __r0.putIndex(charIDToTypeID("Lyr "), 1);
            var __d0 = executeActionGet(__r0);
            var __keys = [];
            for (var __k = 0; __k < __d0.count; __k++) {
                try { __keys.push(typeIDToStringID(__d0.getKey(__k))); } catch (e) {}
            }
            cbDiag("  [layer0 AM keys] " + __keys.join(","));
        } catch (e) { cbDiag("  (AM keys error: " + e + ")"); }

        // 2. Unlock all layers
        unlockAllLayers(doc);

        // 2.5 Detect metrics kerning BEFORE text is consolidated/rasterized
        var metricsKerningLayers = [];
        try {
            metricsKerningLayers = detectMetricsKerningLayers(doc, "");
        } catch (e_kern) { /* ignore detection errors */ }

        // 2.6 Detect link group font-size issues BEFORE text is consolidated/rasterized
        var linkGroupIssues = [];
        try {
            linkGroupIssues = detectLinkGroupFontSizeIssues(doc);
        } catch (e_link) { /* ignore detection errors */ }

        // 3. Always find existing text group for text/background separation
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

        // Text layer organization (if enabled)
        if (globalSettings.reorganizeText) {
            if (!textGroup) {
                textGroup = findOrCreateTextGroup(doc);
            }
            if (textGroup) {
                consolidateTextLayers(doc, textGroup);
            }
        }

        // === 診断: オープン直後の構成とテキストグループ検出 ===
        cbDiag("=== FILE: " + fileName + " ===");
        cbDiag("[OPEN] top-level layers=" + doc.layers.length);
        cbDiagDumpLayers(doc, "  ");
        cbDiag("[TEXTGROUP] found=" + (textGroup ? "true" : "false")
            + (textGroup ? (' name="' + textGroup.name + '"') : "")
            + " reorganizeText=" + (globalSettings.reorganizeText ? "true" : "false"));

        // ★ SO化の直前に、app.open 直後に記録した「正しい可視性」を復元する。
        // （purge/unlock/各種検出で白消し等の visible が true に化けるのを打ち消す）
        var __restored = cbRestoreVis(doc, __origVis);
        cbDiag("[RESTORE VIS] restored=" + __restored + " layers=" + doc.layers.length);
        cbDiagDumpLayers(doc, "  ");

        // テキストを最上位へ移動しない（順番維持）。上/テキスト/下の3区画で個別SO化する。

        // 4. Separate into above-text / text / below-text, convert each to smart objects
        var backgroundSO = null;   // below text
        var textSO = null;         // text
        var topmostSO = null;      // above text
        var topmostHadVisible = false;
        var backgroundHadVisible = false;

        if (textGroup && doc.layers.length > 1) {
            var __textIdx = -1;
            for (var __ti = 0; __ti < doc.layers.length; __ti++) {
                if (doc.layers[__ti].id === textGroup.id) { __textIdx = __ti; break; }
            }
            var __aboveIds = [];
            var __belowIds = [];
            if (__textIdx >= 0) {
                for (var __li = 0; __li < doc.layers.length; __li++) {
                    if (__li < __textIdx) {
                        __aboveIds.push(doc.layers[__li].id);
                        try { if (doc.layers[__li].visible) topmostHadVisible = true; } catch (e) {}
                    } else if (__li > __textIdx) {
                        __belowIds.push(doc.layers[__li].id);
                        try { if (doc.layers[__li].visible) backgroundHadVisible = true; } catch (e) {}
                    }
                }
            }

            // above-text -> topmost SO（非表示も含む。元が全部非表示ならSOごと非表示で保持＝出力に出ない）
            if (__aboveIds.length > 0) {
                var __aboveLayers = idsToLayers(doc, __aboveIds);
                if (__aboveLayers.length > 0) {
                    try {
                        selectLayers(__aboveLayers);
                        topmostSO = convertToSmartObject();
                        if (topmostSO) {
                            topmostSO.name = "最上位";
                            try { topmostSO.visible = topmostHadVisible; } catch (e) {}
                        }
                    } catch (e) { topmostSO = null; }
                }
            }

            // text -> text SO
            var __tg2 = findTopLevelById(doc, textGroup.id);
            if (__tg2) {
                try {
                    selectLayerWithChildren(__tg2);
                    textSO = convertToSmartObject();
                    if (textSO) textSO.name = "テキスト";
                } catch (e) { textSO = null; }
            }

            // below-text -> background SO（非表示も含む）
            if (__belowIds.length > 0) {
                var __belowLayers = idsToLayers(doc, __belowIds);
                if (__belowLayers.length > 0) {
                    try {
                        selectLayers(__belowLayers);
                        backgroundSO = convertToSmartObject();
                        if (backgroundSO) {
                            backgroundSO.name = "背景";
                            try { backgroundSO.visible = backgroundHadVisible; } catch (e) {}
                        }
                    } catch (e) { backgroundSO = null; }
                }
            }
        } else if (!textGroup && doc.layers.length > 1) {
            // テキストグループ無し: 従来どおり全レイヤーを1つの背景SOに（非表示も含む）
            var __allLayers = [];
            for (var __ali = 0; __ali < doc.layers.length; __ali++) __allLayers.push(doc.layers[__ali]);
            try {
                selectLayers(__allLayers);
                backgroundSO = convertToSmartObject();
                if (backgroundSO) backgroundSO.name = "背景";
            } catch (e) { backgroundSO = null; }
        }



        // === 診断: 3区画SO化の直後（各SOの可視性・構成） ===
        cbDiag("[AFTER SPLIT] topmostHadVisible=" + topmostHadVisible
            + " backgroundHadVisible=" + backgroundHadVisible
            + " layers=" + doc.layers.length);
        cbDiagDumpLayers(doc, "  ");

        // 5. Rasterize both smart objects (DOM method 参照パイプライン準拠)
        var textLayer = null;
        if (textSO) {
            try {
                doc.activeLayer = textSO;
                textSO.rasterize(RasterizeType.ENTIRELAYER);
                textLayer = doc.activeLayer;
                textLayer.name = "\u30C6\u30AD\u30B9\u30C8";
            } catch (e) {}
        }
        var backgroundLayer = null;
        if (backgroundSO) {
            try {
                doc.activeLayer = backgroundSO;
                backgroundSO.rasterize(RasterizeType.ENTIRELAYER);
                backgroundLayer = doc.activeLayer;
                backgroundLayer.name = "\u80CC\u666F";
            } catch (e) {}
        }

        // 6. Color mode conversion
        var targetColorMode = fileConfig.colorMode;
        if (targetColorMode === "mono" && doc.mode !== DocumentMode.GRAYSCALE) {
            doc.changeMode(ChangeMode.GRAYSCALE);
        } else if (targetColorMode === "color" && doc.mode !== DocumentMode.RGB) {
            doc.changeMode(ChangeMode.RGB);
        }

        // 7. Re-convert rasterized text to smart object (fresh ref after color mode change)
        var textSOFinal = null;
        if (textLayer) {
            try {
                doc.activeLayer = textLayer;
                textSOFinal = convertToSmartObject();
                if (textSOFinal) textSOFinal.name = "\u30C6\u30AD\u30B9\u30C8";
            } catch (e) {}
        }

        // 8. Hide text SO
        if (textSOFinal) {
            try { textSOFinal.visible = false; } catch (e) {}
        }

        // 9. Optional: Save intermediate PSD
        if (globalSettings.saveIntermediatePsd) {
            saveIntermediatePsd(doc, fileConfig, globalSettings);
        }

        // 10. Apply Gaussian blur to background only (参照パイプライン準拠)
        // Check for page-specific partial blur settings
        var currentPartialBlurSettings = null;
        if (fileConfig.partialBlur && fileConfig.partialBlur.blurRadius !== undefined) {
            currentPartialBlurSettings = fileConfig.partialBlur;
        }

        // Fallback: when the source PSD has no text (single-layer flat files,
        // or any layout where the bg-SO pipeline didn't run / produce a layer),
        // pick the existing non-text top-level layer so blur still applies.
        if (!backgroundLayer) {
            backgroundLayer = pickBlurFallbackLayer(doc, textSOFinal, textGroup);
        }

        if (backgroundLayer && fileConfig.applyBlur && fileConfig.blurRadius > 0) {
            doc.activeLayer = backgroundLayer;
            try {
                if (backgroundLayer.allLocked) backgroundLayer.allLocked = false;

                if (currentPartialBlurSettings) {
                    applyPartialBlur(doc, fileConfig.blurRadius, currentPartialBlurSettings);
                } else {
                    doc.activeLayer.applyGaussianBlur(fileConfig.blurRadius);
                }
            } catch (e) {}
        } else if (backgroundLayer && currentPartialBlurSettings) {
            // Blur disabled globally but partial blur exists for this page
            doc.activeLayer = backgroundLayer;
            try {
                if (backgroundLayer.allLocked) backgroundLayer.allLocked = false;
                applyPartialBlur(doc, 0, currentPartialBlurSettings);
            } catch (e) {}
        }

        // 11. Show text SO
        if (textSOFinal) {
            try { textSOFinal.visible = true; } catch (e) {}
        }

        // === 診断: 最終統合の直前（flatten/SO化前の構成） ===
        cbDiag("[BEFORE FINAL] topmostSO=" + (topmostSO ? "exists" : "null") + " layers=" + doc.layers.length);
        cbDiagDumpLayers(doc, "  ");

        // 12. Final merge: re-acquire layers by name -> SO (参照パイプライン準拠)
        var layersToMerge = [];
        if (textSOFinal) {
            try { layersToMerge.push(doc.layers.getByName("\u30C6\u30AD\u30B9\u30C8")); } catch (e) {}
        }
        if (backgroundLayer) {
            try { layersToMerge.push(doc.layers.getByName("\u80CC\u666F")); } catch (e) {}
        }

        if (topmostSO) {
            // 3区画構成（上/テキスト/下）。flatten で「見た目どおり」に1枚へ。
            // flatten は表示中レイヤーを合成し非表示を破棄するので、
            //   - 非表示の最上位(白消し) → 出力に出ない（クリッピング等はSO内に保持済み・処理では省いていない）
            //   - 表示中の最上位 → テキストの上に正しく残る
            try { doc.flatten(); } catch (e) {}
        } else if (layersToMerge.length > 0) {
            try {
                selectLayers(layersToMerge);
                convertToSmartObject();
            } catch (e) {}
        } else if (doc.layers.length > 1) {
            doc.flatten();
        }

        // 13. Crop (if not skipped)
        if (!fileConfig.skipCrop && fileConfig.cropBounds) {
            var cb = fileConfig.cropBounds;
            doc.crop([
                new UnitValue(cb.left, "px"),
                new UnitValue(cb.top, "px"),
                new UnitValue(cb.right, "px"),
                new UnitValue(cb.bottom, "px")
            ]);
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
        var safeOutputName = sanitizeFileName(fileConfig.outputName, "output.tif");
        var outputFile = new File(fileConfig.outputPath + "/" + safeOutputName);
        var baseName = sanitizeFileName(safeOutputName.replace(/\.[^.]+$/, ""), "output");

        if (globalSettings.proceedAsTiff) {
            // TIFF with LZW compression
            var tiffOpts = new TiffSaveOptions();
            tiffOpts.imageCompression = TIFFEncoding.TIFFLZW;
            tiffOpts.layers = false;
            tiffOpts.alphaChannels = false;
            tiffOpts.byteOrder = ByteOrder.IBM;
            doc.saveAs(outputFile, tiffOpts, true, Extension.LOWERCASE);
        } else if (globalSettings.outputJpg) {
            // JPG only (TIFF OFF + JPG ON)
            var jpgOpts = new JPEGSaveOptions();
            jpgOpts.quality = 12;
            jpgOpts.embedColorProfile = true;
            jpgOpts.formatOptions = FormatOptions.STANDARDBASELINE;
            var jpgFile = new File(fileConfig.outputPath + "/" + baseName + ".jpg");
            doc.saveAs(jpgFile, jpgOpts, true, Extension.LOWERCASE);
            outputFile = jpgFile;
        } else {
            // PSD
            var psdOpts = new PhotoshopSaveOptions();
            psdOpts.layers = false;
            psdOpts.alphaChannels = false;
            doc.saveAs(outputFile, psdOpts, true, Extension.LOWERCASE);
        }

        // 16b. TIFF+JPG: save JPG copy to separate folder
        if (globalSettings.proceedAsTiff && globalSettings.outputJpg && fileConfig.jpgOutputPath) {
            var jpgDir2 = new Folder(fileConfig.jpgOutputPath);
            if (!jpgDir2.exists) jpgDir2.create();
            var jpgFile2 = new File(fileConfig.jpgOutputPath + "/" + baseName + ".jpg");
            var jpgOpts2 = new JPEGSaveOptions();
            jpgOpts2.quality = 12;
            jpgOpts2.embedColorProfile = true;
            jpgOpts2.formatOptions = FormatOptions.STANDARDBASELINE;
            doc.saveAs(jpgFile2, jpgOpts2, true, Extension.LOWERCASE);
        }

        // 17. Capture final document metadata before closing
        var finalColorMode = (doc.mode == DocumentMode.GRAYSCALE) ? "mono" : "color";
        var finalWidth = Math.round(doc.width.value);
        var finalHeight = Math.round(doc.height.value);
        var finalDpi = Math.round(doc.resolution);

        // 18. Close
        doc.close(SaveOptions.DONOTSAVECHANGES);

        return {
            fileName: fileName,
            success: true,
            outputPath: outputFile.fsName.replace(/\\/g, "/"),
            colorMode: finalColorMode,
            finalWidth: finalWidth,
            finalHeight: finalHeight,
            dpi: finalDpi,
            metricsKerningLayers: metricsKerningLayers,
            linkGroupIssues: linkGroupIssues
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
        if (excludeGroup && layer.id === excludeGroup.id) continue;
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

// ===== 診断（白消し再表示の原因調査用） =====
// 可視性を Action Manager 経由で読む（DOM の layer.visible と一致するか確認用）
function cbVisByAMIndex(idx1based) {
    try {
        var r = new ActionReference();
        r.putProperty(charIDToTypeID("Prpr"), stringIDToTypeID("visible"));
        r.putIndex(charIDToTypeID("Lyr "), idx1based);
        return executeActionGet(r).getBoolean(stringIDToTypeID("visible"));
    } catch (e) { return "err"; }
}
function cbVisByAMId(id) {
    try {
        var r = new ActionReference();
        r.putProperty(charIDToTypeID("Prpr"), stringIDToTypeID("visible"));
        r.putIdentifier(charIDToTypeID("Lyr "), id);
        return executeActionGet(r).getBoolean(stringIDToTypeID("visible"));
    } catch (e) { return "err"; }
}
// app.open 直後の正しい可視性を id 単位で記録し、後で復元する。
// （app.purge / unlockAllLayers 等が一部PSDで可視性を勝手に true へ化けさせるため）
function cbCaptureVis(container, map) {
    for (var i = 0; i < container.layers.length; i++) {
        var L = container.layers[i];
        try { map[L.id] = L.visible; } catch (e) {}
        if (L.typename === "LayerSet") { try { cbCaptureVis(L, map); } catch (e) {} }
    }
}
function cbRestoreVis(container, map) {
    var changed = 0;
    for (var i = 0; i < container.layers.length; i++) {
        var L = container.layers[i];
        try {
            if (map[L.id] !== undefined && L.visible !== map[L.id]) {
                L.visible = map[L.id];
                changed++;
            }
        } catch (e) {}
        if (L.typename === "LayerSet") { try { changed += cbRestoreVis(L, map); } catch (e) {} }
    }
    return changed;
}

var __CB_DIAG = [];
function cbDiag(msg) { try { __CB_DIAG.push(String(msg)); } catch (e) {} }
function cbDiagDumpLayers(container, prefix) {
    try {
        for (var i = 0; i < container.layers.length; i++) {
            var L = container.layers[i];
            var s = prefix + "[" + i + "]";
            try { s += ' name="' + L.name + '"'; } catch (e) { s += " name=?"; }
            try { s += " visible=" + L.visible; } catch (e) {}
            try { s += " type=" + L.typename; } catch (e) {}
            try { s += " kind=" + L.kind; } catch (e) {}
            try { s += " grouped=" + L.grouped; } catch (e) {} // 下のレイヤーにクリップ
            try { s += " opacity=" + Math.round(L.opacity); } catch (e) {}
            cbDiag(s);
            if (L.typename === "LayerSet") cbDiagDumpLayers(L, prefix + "    ");
        }
    } catch (e) { cbDiag(prefix + "(dump error: " + e + ")"); }
}
function cbDiagWrite() {
    try {
        var dir = Folder.temp.fsName + "/COMIC-Bridge";
        var f = new Folder(dir);
        if (!f.exists) { try { f.create(); } catch (ce) {} }
        var out = new File(dir + "/tiff_diagnostics.txt");
        out.encoding = "UTF-8";
        out.open("w");
        out.write(__CB_DIAG.join("\r\n"));
        out.close();
    } catch (e) {}
}

// top-level レイヤーを id で取り直す（SO化で参照が無効化されるため）。
function findTopLevelById(doc, id) {
    for (var i = 0; i < doc.layers.length; i++) {
        if (doc.layers[i].id === id) return doc.layers[i];
    }
    return null;
}
function idsToLayers(doc, ids) {
    var out = [];
    for (var i = 0; i < ids.length; i++) {
        var l = findTopLevelById(doc, ids[i]);
        if (l) out.push(l);
    }
    return out;
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

// Pick a top-level non-text layer to receive gaussian blur when the bg-SO
// pipeline didn't produce one (e.g., single-layer flat PSD, no text).
// LayerSet candidates are merged to a single raster so applyGaussianBlur works.
function pickBlurFallbackLayer(doc, textSOFinal, textGroup) {
    for (var i = 0; i < doc.layers.length; i++) {
        var layer = doc.layers[i];
        if (textSOFinal && layer.id === textSOFinal.id) continue;
        if (textGroup && layer.id === textGroup.id) continue;
        if (layer.kind === LayerKind.TEXT) continue;
        if (layer.typename === "LayerSet") {
            try { layer = layer.merge(); } catch (e) { continue; }
        }
        try { if (layer.allLocked) layer.allLocked = false; } catch (e) {}
        return layer;
    }
    return null;
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
    // Select first layer by ID (handles hidden layers correctly)
    var desc = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putIdentifier(charIDToTypeID("Lyr "), layers[0].id);
    desc.putReference(charIDToTypeID("null"), ref);
    desc.putBoolean(stringIDToTypeID("makeVisible"), false);
    executeAction(charIDToTypeID("slct"), desc, DialogModes.NO);

    // Add remaining layers to selection by ID
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
// 部分ぼかし: regionsがある場合は各ポリゴン領域に個別の半径を適用
// regionsが無い場合はレガシーboundsまたは全体にpartialBlurRadiusを適用
function applyPartialBlur(doc, defaultBlurRadius, partialSettings) {
    try {
        var activeLayer = doc.activeLayer;
        var partialBlurRadius = partialSettings.blurRadius;
        var regions = partialSettings.regions;

        // --- regions配列がある場合: 新方式（複数ポリゴン領域） ---
        if (regions && regions.length > 0) {
            applyRegionsBlur(doc, activeLayer, defaultBlurRadius, partialBlurRadius, regions);
            return;
        }

        // --- レガシー: bounds方式 ---
        var bounds = partialSettings.bounds;

        // boundsがnull/未定義: 全体にpartialBlurRadiusを適用
        if (!bounds || bounds.left === undefined) {
            if (partialBlurRadius > 0) {
                activeLayer.applyGaussianBlur(partialBlurRadius);
            } else if (defaultBlurRadius > 0) {
                activeLayer.applyGaussianBlur(defaultBlurRadius);
            }
            return;
        }

        // boundsがドキュメント全体と同じ場合も同様にスキップ
        var docW = doc.width.value;
        var docH = doc.height.value;
        if (bounds.left <= 0 && bounds.top <= 0 && bounds.right >= docW && bounds.bottom >= docH) {
            if (partialBlurRadius > 0) {
                activeLayer.applyGaussianBlur(partialBlurRadius);
            } else if (defaultBlurRadius > 0) {
                activeLayer.applyGaussianBlur(defaultBlurRadius);
            }
            return;
        }

        // 有効なboundsがある場合のみ選択範囲ベースの処理
        var selRegion = [
            [bounds.left, bounds.top],
            [bounds.right, bounds.top],
            [bounds.right, bounds.bottom],
            [bounds.left, bounds.bottom]
        ];

        // 1. 選択範囲外に通常のぼかしを適用
        if (defaultBlurRadius > 0) {
            doc.selection.select(selRegion);
            doc.selection.invert();
            var hasSelection = false;
            try { var sb = doc.selection.bounds; hasSelection = true; } catch (eSel) {}
            if (hasSelection) {
                activeLayer.applyGaussianBlur(defaultBlurRadius);
            }
            doc.selection.deselect();
        }

        // 2. 選択範囲内に指定したぼかしを適用
        if (partialBlurRadius > 0) {
            doc.selection.select(selRegion);
            activeLayer.applyGaussianBlur(partialBlurRadius);
            doc.selection.deselect();
        }
    } catch (e) {
        try { doc.selection.deselect(); } catch (ed) {}
        if (defaultBlurRadius > 0) {
            try { doc.activeLayer.applyGaussianBlur(defaultBlurRadius); } catch (e2) {}
        }
    }
}

// 複数ポリゴン領域ぼかし
// 1. 全regions選択→invert→外側にdefaultBlur
// 2. 各regionを個別選択→個別blurRadius適用
function applyRegionsBlur(doc, activeLayer, defaultBlurRadius, fallbackBlurRadius, regions) {
    try {
        // 1. 外側にデフォルトぼかし
        if (defaultBlurRadius > 0) {
            // 全regionsをunion選択
            for (var i = 0; i < regions.length; i++) {
                var pts = regions[i].points;
                if (!pts || pts.length < 3) continue;
                if (i === 0) {
                    doc.selection.select(pts);
                } else {
                    doc.selection.select(pts, SelectionType.EXTEND);
                }
            }
            doc.selection.invert();
            var hasOuter = false;
            try { var sb = doc.selection.bounds; hasOuter = true; } catch (eOuter) {}
            if (hasOuter) {
                activeLayer.applyGaussianBlur(defaultBlurRadius);
            }
            doc.selection.deselect();
        }

        // 2. 各regionに個別ぼかし
        for (var j = 0; j < regions.length; j++) {
            var region = regions[j];
            var pts2 = region.points;
            var regionBlur = region.blurRadius;
            if (!pts2 || pts2.length < 3) continue;
            if (regionBlur === undefined || regionBlur === null) regionBlur = fallbackBlurRadius;
            if (regionBlur > 0) {
                doc.selection.select(pts2);
                activeLayer.applyGaussianBlur(regionBlur);
                doc.selection.deselect();
            }
        }
    } catch (e) {
        try { doc.selection.deselect(); } catch (ed) {}
        if (defaultBlurRadius > 0) {
            try { activeLayer.applyGaussianBlur(defaultBlurRadius); } catch (e2) {}
        }
    }
}

/* -----------------------------------------------------
  Intermediate PSD Save
 ----------------------------------------------------- */
function saveIntermediatePsd(doc, fileConfig, globalSettings) {
    try {
        var baseName = sanitizeFileName(decodeURI(new File(fileConfig.path).name).replace(/\.[^.]+$/, ""), "output");
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
function sanitizeFileName(name, fallback) {
    var value = String(name || "").replace(/^\s+|\s+$/g, "");
    value = value.replace(/[\\\/:\*\?"<>\|\x00-\x1F]/g, "_");
    value = value.replace(/\.+$/g, "");
    if (!value || /^\.+$/.test(value)) value = fallback || "output";
    if (value.length > 180) value = value.substring(0, 180);
    return value;
}

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
  Linked Text Layer Font-Size Check
  リンクされたテキストレイヤー群のフォントサイズが同一 or ちょうど1:2 のいずれにも該当しない場合を検出
  ----
  アプローチ: 各テキストレイヤーの `linkedLayerIDs` プロパティを直接読み取り、
  selectLinkedLayers による選択変更を避ける（副作用なし＋失敗しにくい）。
  Union-Find でリンクグループを構築する。
 ----------------------------------------------------- */
function detectLinkGroupFontSizeIssues(doc) {
    var issues = [];

    // --- テキストレイヤー一覧 + その linkedLayerIDs 収集 ---
    var textLayerList = []; // { id, layer, linkedIds:[], maxFontSize, name }

    function readLayerLinkedIds(layer) {
        var result = { id: null, linkedIds: [] };
        try {
            var ref = new ActionReference();
            ref.putIdentifier(charIDToTypeID("Lyr "), layer.id);
            var desc = executeActionGet(ref);
            result.id = desc.getInteger(stringIDToTypeID("layerID"));
            if (desc.hasKey(stringIDToTypeID("linkedLayerIDs"))) {
                var linkedList = desc.getList(stringIDToTypeID("linkedLayerIDs"));
                for (var i = 0; i < linkedList.count; i++) {
                    result.linkedIds.push(linkedList.getInteger(i));
                }
            }
        } catch (e) {}
        return result;
    }

    function readMaxFontSize(layer) {
        try {
            if (layer.kind !== LayerKind.TEXT) return null;
            var ref = new ActionReference();
            ref.putIdentifier(charIDToTypeID("Lyr "), layer.id);
            var desc = executeActionGet(ref);
            if (!desc.hasKey(stringIDToTypeID("textKey"))) return null;
            var tk = desc.getObjectValue(stringIDToTypeID("textKey"));
            if (!tk.hasKey(stringIDToTypeID("textStyleRange"))) return null;
            var ranges = tk.getList(stringIDToTypeID("textStyleRange"));
            var maxSize = null;
            for (var r = 0; r < ranges.count; r++) {
                var range = ranges.getObjectValue(r);
                if (!range.hasKey(stringIDToTypeID("textStyle"))) continue;
                var style = range.getObjectValue(stringIDToTypeID("textStyle"));
                if (!style.hasKey(stringIDToTypeID("size"))) continue;
                var sz;
                try {
                    sz = style.getUnitDoubleValue(stringIDToTypeID("size"));
                } catch (e_size) {
                    try { sz = style.getDouble(stringIDToTypeID("size")); } catch (e_d) { continue; }
                }
                if (typeof sz === "number" && !isNaN(sz)) {
                    if (maxSize === null || sz > maxSize) maxSize = sz;
                }
            }
            return maxSize;
        } catch (e) { return null; }
    }

    function collectTextLayers(parent) {
        for (var i = 0; i < parent.layers.length; i++) {
            var layer = parent.layers[i];
            try {
                if (layer.typename === "LayerSet") {
                    collectTextLayers(layer);
                } else if (layer.kind === LayerKind.TEXT) {
                    var info = readLayerLinkedIds(layer);
                    if (info.id === null) continue;
                    var sz = readMaxFontSize(layer);
                    textLayerList.push({
                        id: info.id,
                        layer: layer,
                        linkedIds: info.linkedIds,
                        maxFontSize: sz,
                        name: layer.name
                    });
                }
            } catch (e) {}
        }
    }
    try { collectTextLayers(doc); } catch (e) {}

    if (textLayerList.length === 0) return issues;

    // --- Union-Find でリンクグループ構築 ---
    var parent = {};
    function find(x) {
        if (parent[x] === undefined) parent[x] = x;
        if (parent[x] === x) return x;
        parent[x] = find(parent[x]);
        return parent[x];
    }
    function union(a, b) {
        var ra = find(a), rb = find(b);
        if (ra !== rb) parent[ra] = rb;
    }
    for (var i = 0; i < textLayerList.length; i++) {
        find(textLayerList[i].id);
    }
    var textIdSet = {};
    for (var j = 0; j < textLayerList.length; j++) textIdSet[textLayerList[j].id] = true;
    for (var k = 0; k < textLayerList.length; k++) {
        var tl = textLayerList[k];
        for (var m = 0; m < tl.linkedIds.length; m++) {
            var lid = tl.linkedIds[m];
            if (textIdSet[lid]) union(tl.id, lid);
        }
    }
    var groups = {}; // rootId -> [textLayerList item, ...]
    for (var q = 0; q < textLayerList.length; q++) {
        var root = find(textLayerList[q].id);
        if (!groups[root]) groups[root] = [];
        groups[root].push(textLayerList[q]);
    }

    // --- 各グループでフォントサイズ検証 ---
    var groupCounter = 1;
    for (var rootId in groups) {
        if (!groups.hasOwnProperty(rootId)) continue;
        var groupMembers = groups[rootId];
        if (groupMembers.length < 2) continue; // 単独はリンクでない

        var validMembers = [];
        for (var mi = 0; mi < groupMembers.length; mi++) {
            if (typeof groupMembers[mi].maxFontSize === "number" && groupMembers[mi].maxFontSize > 0) {
                validMembers.push({
                    layerName: groupMembers[mi].name,
                    fontSize: groupMembers[mi].maxFontSize
                });
            }
        }
        if (validMembers.length < 2) continue;

        var sizes = [];
        for (var vi = 0; vi < validMembers.length; vi++) sizes.push(validMembers[vi].fontSize);
        var maxSize = sizes[0], minSize = sizes[0];
        for (var si = 1; si < sizes.length; si++) {
            if (sizes[si] > maxSize) maxSize = sizes[si];
            if (sizes[si] < minSize) minSize = sizes[si];
        }

        var EPS = 0.001;
        var allEqual = (maxSize - minSize) <= EPS;
        var ratio = minSize > 0 ? (maxSize / minSize) : 0;
        var exactlyHalf = Math.abs(ratio - 2.0) <= EPS;
        var allBigOrSmall = exactlyHalf;
        if (exactlyHalf) {
            for (var ni = 0; ni < sizes.length; ni++) {
                if (Math.abs(sizes[ni] - maxSize) > EPS && Math.abs(sizes[ni] - minSize) > EPS) {
                    allBigOrSmall = false;
                    break;
                }
            }
        }

        if (!allEqual && !(exactlyHalf && allBigOrSmall)) {
            var roundedMembers = [];
            for (var rm = 0; rm < validMembers.length; rm++) {
                roundedMembers.push({
                    layerName: validMembers[rm].layerName,
                    fontSize: Math.round(validMembers[rm].fontSize * 1000) / 1000
                });
            }
            issues.push({
                linkGroup: groupCounter,
                members: roundedMembers,
                maxSize: Math.round(maxSize * 1000) / 1000,
                minSize: Math.round(minSize * 1000) / 1000,
                ratio: Math.round(ratio * 10000) / 10000
            });
        }
        groupCounter++;
    }

    return issues;
}

/* -----------------------------------------------------
  Metrics Kerning Detection
  全テキストレイヤーをActionManager経由で走査し、
  textStyleRangeのautoKern値から "metricsKern" を含むものを収集する
 ----------------------------------------------------- */
function detectMetricsKerningLayers(container, parentPath) {
    var results = [];
    parentPath = parentPath || "";
    for (var i = 0; i < container.layers.length; i++) {
        var layer = container.layers[i];
        var path = parentPath ? (parentPath + "/" + layer.name) : layer.name;
        try {
            if (layer.typename === "LayerSet") {
                var childResults = detectMetricsKerningLayers(layer, path);
                for (var k = 0; k < childResults.length; k++) results.push(childResults[k]);
            } else if (layer.kind === LayerKind.TEXT) {
                if (hasMetricsKerning(layer)) {
                    results.push(path);
                }
            }
        } catch (e) { /* skip problematic layers */ }
    }
    return results;
}

function hasMetricsKerning(textLayer) {
    try {
        var ref = new ActionReference();
        ref.putIdentifier(charIDToTypeID("Lyr "), textLayer.id);
        var desc = executeActionGet(ref);
        var textKeyID = stringIDToTypeID("textKey");
        if (!desc.hasKey(textKeyID)) return false;
        var textKey = desc.getObjectValue(textKeyID);
        var textStyleRangeID = stringIDToTypeID("textStyleRange");
        if (!textKey.hasKey(textStyleRangeID)) return false;
        var ranges = textKey.getList(textStyleRangeID);
        var textStyleID = stringIDToTypeID("textStyle");
        var autoKernID = stringIDToTypeID("autoKern");
        var metricsID = stringIDToTypeID("metricsKern");
        for (var r = 0; r < ranges.count; r++) {
            var range = ranges.getObjectValue(r);
            if (!range.hasKey(textStyleID)) continue;
            var style = range.getObjectValue(textStyleID);
            if (!style.hasKey(autoKernID)) continue;
            var kernEnum = style.getEnumerationValue(autoKernID);
            if (kernEnum === metricsID) return true;
        }
    } catch (e) { /* fallthrough */ }
    return false;
}

/* -----------------------------------------------------
  Execute
 ----------------------------------------------------- */
try {
    main();
} catch (e) {
    // Write error to temp file for Rust to read
    try {
        var errFile = new File(Folder.temp.fsName + "/COMIC-Bridge/convert/psd_tiff_script_error.txt");
        errFile.open("w");
        errFile.write("JSX Error: " + (e.message || String(e)) + " (line: " + (e.line || "?") + ")");
        errFile.close();
    } catch (ef) {}
    app.displayDialogs = originalDialogs;
}
