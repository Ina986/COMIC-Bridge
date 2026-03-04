// Photoshop JSX Script for Layer Replacement
// Ported from swatta_ver1.94.jsx, integrated with app's config/result pattern

#target photoshop

app.displayDialogs = DialogModes.NO;
app.preferences.rulerUnits = Units.PIXELS;

/* =====================================================
   Helper Functions (ported from swatta)
 ===================================================== */

// フォルダ内にテキストレイヤーが存在するかチェック
function hasTextLayersInFolder(folder) {
    if (!folder || folder.typename !== 'LayerSet') return false;
    for (var i = 0; i < folder.artLayers.length; i++) {
        if (folder.artLayers[i].kind === LayerKind.TEXT && folder.artLayers[i].visible) return true;
    }
    for (var j = 0; j < folder.layerSets.length; j++) {
        if (folder.layerSets[j].visible && hasTextLayersInFolder(folder.layerSets[j])) return true;
    }
    return false;
}

// フォルダ内の非テキストレイヤーを削除
function removeNonTextLayersFromFolder(folder) {
    if (!folder || folder.typename !== 'LayerSet') return;
    for (var j = folder.layerSets.length - 1; j >= 0; j--) {
        var subFolder = folder.layerSets[j];
        if (hasTextLayersInFolder(subFolder)) {
            removeNonTextLayersFromFolder(subFolder);
        } else {
            try {
                if (subFolder.hasOwnProperty('allLocked')) subFolder.allLocked = false;
                subFolder.remove();
            } catch (e) {}
        }
    }
    for (var i = folder.artLayers.length - 1; i >= 0; i--) {
        var layer = folder.artLayers[i];
        if (layer.kind !== LayerKind.TEXT) {
            try {
                if (layer.hasOwnProperty('allLocked')) layer.allLocked = false;
                if (layer.hasOwnProperty('pixelsLocked')) layer.pixelsLocked = false;
                if (layer.hasOwnProperty('positionLocked')) layer.positionLocked = false;
                if (layer.hasOwnProperty('transparentPixelsLocked')) layer.transparentPixelsLocked = false;
                layer.remove();
            } catch (e) {}
        }
    }
}

// 特定名レイヤーを収集
function collectSpecialLayers(parentObject, collectedArray, specialName, usePartialMatch) {
    if (!parentObject || !parentObject.typename) return;
    if (parentObject.artLayers) {
        for (var i = 0; i < parentObject.artLayers.length; i++) {
            var layer = parentObject.artLayers[i];
            var isMatch = usePartialMatch ? (layer.name.indexOf(specialName) !== -1) : (layer.name === specialName);
            if (layer.visible && isMatch) collectedArray.push(layer);
        }
    }
    if (parentObject.layerSets) {
        for (var j = 0; j < parentObject.layerSets.length; j++) {
            var layerSet = parentObject.layerSets[j];
            if (layerSet.visible) collectSpecialLayers(layerSet, collectedArray, specialName, usePartialMatch);
        }
    }
}

// 特定名グループ（LayerSet）を収集
function collectSpecialLayerSets(parentObject, collectedArray, specialName, usePartialMatch) {
    if (!parentObject || !parentObject.typename) return;
    if (parentObject.layerSets) {
        for (var j = 0; j < parentObject.layerSets.length; j++) {
            var layerSet = parentObject.layerSets[j];
            var isMatch = usePartialMatch ? (layerSet.name.indexOf(specialName) !== -1) : (layerSet.name === specialName);
            if (layerSet.visible && isMatch) collectedArray.push(layerSet);
            collectSpecialLayerSets(layerSet, collectedArray, specialName, usePartialMatch);
        }
    }
}

// フォルダ名で LayerSet を再帰検索
function findLayerSetByName(parentObject, name) {
    if (parentObject.layerSets) {
        for (var i = 0; i < parentObject.layerSets.length; i++) {
            var layerSet = parentObject.layerSets[i];
            if (layerSet.name === name && layerSet.visible) return layerSet;
            var found = findLayerSetByName(layerSet, name);
            if (found) return found;
        }
    }
    return null;
}

// コンテナ直下からレイヤー名で ArtLayer を検索
function findArtLayerByName_InContainer(container, layerName) {
    if (!container.artLayers) return null;
    for (var i = 0; i < container.artLayers.length; i++) {
        var layer = container.artLayers[i];
        if (layer.name === layerName && layer.visible) return layer;
    }
    return null;
}

// 自分の1つ下の ArtLayer を取得
function getLayerBelow(layer) {
    var parent = layer.parent;
    if (!parent.artLayers || parent.artLayers.length < 2) return null;
    var layers = parent.artLayers;
    for (var i = 0; i < layers.length - 1; i++) {
        if (layers[i] === layer) return layers[i + 1];
    }
    return null;
}

// スマート配置: テキスト含有グループの下、それ以外は最上部
function getSmartPlacement(container) {
    var result = { placement: ElementPlacement.PLACEATBEGINNING, relative: null };
    if (!container || !container.layers || container.layers.length === 0) return result;
    var topLayer = container.layers[0];
    if (topLayer.typename === 'LayerSet') {
        if (hasTextLayersInFolder(topLayer)) {
            result.placement = ElementPlacement.PLACEAFTER;
            result.relative = topLayer;
        }
    } else if (topLayer.typename === 'ArtLayer' && topLayer.kind === LayerKind.TEXT) {
        result.placement = ElementPlacement.PLACEAFTER;
        result.relative = topLayer;
    }
    return result;
}

// 親コンテナ内でのインデックス(上から)
function getIndexInParent(element) {
    var parent = element.parent;
    if (!parent.layers) return -1;
    for (var i = 0; i < parent.layers.length; i++) {
        if (parent.layers[i] === element) return i;
    }
    return -1;
}

// 指定インデックスの要素を取得
function getElementAtIndex(container, index) {
    if (!container.layers || index < 0 || index >= container.layers.length) return null;
    return container.layers[index];
}

// 下から数えたインデックス
function getIndexFromBottom(element) {
    var parent = element.parent;
    if (!parent.layers) return -1;
    for (var i = 0; i < parent.layers.length; i++) {
        if (parent.layers[i] === element) return parent.layers.length - 1 - i;
    }
    return -1;
}

// 下からインデックスで要素を取得
function getElementAtIndexFromBottom(container, indexFromBottom) {
    if (!container.layers || indexFromBottom < 0) return null;
    var indexFromTop = container.layers.length - 1 - indexFromBottom;
    if (indexFromTop < 0 || indexFromTop >= container.layers.length) return null;
    return container.layers[indexFromTop];
}

// フォントサイズを0.5刻み/整数に丸める
function roundFontSize(size) {
    var intPart = Math.floor(size);
    var decPart = size - intPart;
    if (decPart >= 0.26 && decPart <= 0.74) return intPart + 0.5;
    if (decPart >= 0.75) return intPart + 1;
    return intPart;
}

// テキストレイヤーのフォントサイズ/行間をスケール調整
function scaleTextFontSizes(folder, scaleX, scaleY, shouldRound) {
    if (!folder || folder.typename !== 'LayerSet') return;
    for (var i = 0; i < folder.artLayers.length; i++) {
        var layer = folder.artLayers[i];
        if (layer.kind === LayerKind.TEXT && layer.visible) {
            try {
                var textItem = layer.textItem;
                var avgScale = (scaleX + scaleY) / 2;
                var currentSize = textItem.size.as('pt');
                var currentLeading = null;
                var leadingRatio = null;
                try {
                    currentLeading = textItem.leading.as('pt');
                    leadingRatio = currentLeading / currentSize;
                } catch (eLeading) {}
                var newSize = currentSize * avgScale;
                if (shouldRound) newSize = roundFontSize(newSize);
                textItem.size = new UnitValue(newSize, 'pt');
                if (leadingRatio !== null) {
                    textItem.leading = new UnitValue(newSize * leadingRatio, 'pt');
                }
            } catch (e) {}
        }
    }
    for (var j = 0; j < folder.layerSets.length; j++) {
        scaleTextFontSizes(folder.layerSets[j], scaleX, scaleY, shouldRound);
    }
}

// ドキュメントをアクティブにする
function setActiveDocument(doc) {
    if (!doc) return false;
    try {
        if (app.activeDocument === doc) return true;
        app.activeDocument = doc;
        return true;
    } catch (e) { return false; }
}

// フォルダ全体を複製
function duplicateLayerSet(sourceLayerSet, targetDoc, placement) {
    try {
        setActiveDocument(sourceLayerSet.parent.parent || app.activeDocument);
        var placementMode = placement || ElementPlacement.PLACEATBEGINNING;
        return sourceLayerSet.duplicate(targetDoc, placementMode);
    } catch (e) { return null; }
}

// レイヤーのカラーラベルを「なし」にリセット
// （duplicate()でドキュメント間複製すると赤ラベルが付く問題の対策）
function clearLayerColor(layer) {
    try {
        app.activeDocument.activeLayer = layer;
        var desc = new ActionDescriptor();
        var ref = new ActionReference();
        ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
        desc.putReference(charIDToTypeID("null"), ref);
        var descSet = new ActionDescriptor();
        descSet.putEnumerated(charIDToTypeID("Clr "), charIDToTypeID("Clr "), charIDToTypeID("None"));
        desc.putObject(charIDToTypeID("T   "), charIDToTypeID("Lyr "), descSet);
        executeAction(charIDToTypeID("setd"), desc, DialogModes.NO);
    } catch (e) {}
}

// 背景/最下層レイヤーのロックを解除して削除
function unlockAndRemoveLayer(layer) {
    try {
        if (layer.typename === 'ArtLayer') {
            try { layer.isBackgroundLayer = false; } catch(e) {}
            try { layer.allLocked = false; } catch(e) {}
            try { layer.pixelsLocked = false; } catch(e) {}
            try { layer.positionLocked = false; } catch(e) {}
            try { layer.transparentPixelsLocked = false; } catch(e) {}
        } else if (layer.typename === 'LayerSet') {
            try { layer.allLocked = false; } catch(e) {}
        }
        layer.remove();
        return true;
    } catch (e) { return false; }
}

// 最下層レイヤーを取得
function getBottomLayer(doc) {
    var bgLayer = null;
    try { bgLayer = doc.backgroundLayer; } catch (e) {}
    if (!bgLayer && doc.layers.length > 0) bgLayer = doc.layers[doc.layers.length - 1];
    return bgLayer;
}

/* =====================================================
   Main Processing
 ===================================================== */
function main() {
    var tempFolder = Folder.temp;
    var settingsFile = new File(tempFolder + "/psd_replace_settings.json");

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

    var mode = settings.mode;
    var pairs = settings.pairs;
    var textSettings = settings.textSettings;
    var imageSettings = settings.imageSettings;
    var switchSettings = settings.switchSettings;
    var generalSettings = settings.generalSettings;

    var isBatchMode = (mode === "batch");
    var isImageOnlyMode = (mode === "image");
    var isSwitchMode = (mode === "switch");
    var isComposeMode = (mode === "compose");
    var composeSettings = isComposeMode ? settings.composeSettings : null;

    // テキスト差替え / バッチモード: 通常方向(source→target), 画像差替え: 逆方向(target→source)
    var isReverseDirection = isImageOnlyMode;
    // 合成モード: restSourceがAなら植字データ(source)を保存
    if (isComposeMode && composeSettings) {
        isReverseDirection = (composeSettings.restSource === "A");
    }

    var shouldReplaceText = (mode === "text" && textSettings.subMode === "textLayers");
    var shouldReplaceTextGroup = (mode === "text" && textSettings.subMode === "namedGroup");
    var shouldReplaceBackground = isImageOnlyMode && imageSettings.replaceBackground;
    var shouldReplaceSpecial = (isImageOnlyMode && imageSettings.replaceSpecialLayer) || isBatchMode;
    var shouldReplaceImageGroup = (isImageOnlyMode && imageSettings.replaceNamedGroup) || isBatchMode;
    var usePlaceFromBottom = imageSettings.placeFromBottom;
    var skipResize = generalSettings.skipResize;
    var shouldRoundFontSize = generalSettings.roundFontSize;
    var useSourceFileName = (generalSettings.saveFileName === "source");

    var specialName = imageSettings.specialLayerName;
    var specialPartialMatch = imageSettings.specialLayerPartialMatch;
    var groupName = "";
    var groupPartialMatch = false;

    if (shouldReplaceTextGroup) {
        groupName = textSettings.groupName;
        groupPartialMatch = textSettings.partialMatch;
    } else if (shouldReplaceImageGroup) {
        groupName = imageSettings.namedGroupName;
        groupPartialMatch = imageSettings.namedGroupPartialMatch;
    }

    var originalDisplayDialogs = app.displayDialogs;
    app.displayDialogs = DialogModes.NO;
    var results = [];

    // Initial heartbeat: signal script has started
    try {
        var pf = new File(tempFolder + "/psd_replace_progress.txt");
        pf.open("w"); pf.write("0/" + String(pairs.length)); pf.close();
    } catch (e_hb0) {}

    try {
        for (var i = 0; i < pairs.length; i++) {
            var pair = pairs[i];
            var result = processPair(pair, {
                isReverseDirection: isReverseDirection,
                isBatchMode: isBatchMode,
                isSwitchMode: isSwitchMode,
                shouldReplaceText: shouldReplaceText,
                shouldReplaceTextGroup: shouldReplaceTextGroup,
                shouldReplaceBackground: shouldReplaceBackground,
                shouldReplaceSpecial: shouldReplaceSpecial,
                shouldReplaceImageGroup: shouldReplaceImageGroup,
                usePlaceFromBottom: usePlaceFromBottom,
                skipResize: skipResize,
                shouldRoundFontSize: shouldRoundFontSize,
                useSourceFileName: useSourceFileName,
                specialName: specialName,
                specialPartialMatch: specialPartialMatch,
                groupName: groupName,
                groupPartialMatch: groupPartialMatch,
                switchSubMode: isSwitchMode ? switchSettings.subMode : "",
                switchWhiteName: isSwitchMode ? switchSettings.whiteLayerName : "",
                switchWhitePartialMatch: isSwitchMode ? switchSettings.whitePartialMatch : false,
                switchBarName: isSwitchMode ? switchSettings.barGroupName : "",
                switchBarPartialMatch: isSwitchMode ? switchSettings.barPartialMatch : false,
                switchPlaceFromBottom: isSwitchMode ? switchSettings.placeFromBottom : false,
                isComposeMode: isComposeMode,
                composeSettings: composeSettings
            });
            results.push(result);

            // Heartbeat: write progress so Rust knows we are still alive
            try {
                var progressFile = new File(tempFolder + "/psd_replace_progress.txt");
                progressFile.open("w");
                progressFile.write(String(i + 1) + "/" + String(pairs.length));
                progressFile.close();
            } catch (e_hb) { /* ignore */ }
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
    var resultsJSON = arrayToJSON(results);
    var outputFile = new File(settings.outputPath);
    outputFile.open("w");
    outputFile.encoding = "UTF-8";
    outputFile.write(resultsJSON);
    outputFile.close();

}

/* =====================================================
   Compose Helpers
 ===================================================== */

// 合成モード: ドキュメントから要素を除外
function composeRemoveElement(doc, elem, result) {
    setActiveDocument(doc);
    var name = elem.customName || "";
    var partial = elem.partialMatch || false;
    var elemType = elem["type"] || "";

    switch (elemType) {
        case "textFolders":
            var removedCount = 0;
            for (var i = doc.layerSets.length - 1; i >= 0; i--) {
                if (hasTextLayersInFolder(doc.layerSets[i])) {
                    var rName = doc.layerSets[i].name;
                    try { doc.layerSets[i].remove(); removedCount++; result.changes.push("    除外: \"" + rName + "\""); } catch (e) { result.changes.push("    除外失敗: \"" + rName + "\" " + e.message); }
                }
            }
            result.changes.push("    textFolders除外: " + removedCount + " removed");
            break;

        case "background":
            var bg = getBottomLayer(doc);
            if (bg) {
                var bgOk = unlockAndRemoveLayer(bg);
                result.changes.push("    背景除外: " + (bgOk ? "OK" : "失敗"));
            } else {
                result.changes.push("    背景除外: 背景レイヤーなし");
            }
            break;

        case "specialLayer":
            var sLayers = [];
            collectSpecialLayers(doc, sLayers, name, partial);
            for (var si = sLayers.length - 1; si >= 0; si--) {
                try { unlockAndRemoveLayer(sLayers[si]); } catch (e) {}
            }
            result.changes.push("    specialLayer \"" + name + "\" 除外: " + sLayers.length + " found");
            break;

        case "namedGroup":
            var nGroups = [];
            collectSpecialLayerSets(doc, nGroups, name, partial);
            for (var ni = nGroups.length - 1; ni >= 0; ni--) {
                try { nGroups[ni].remove(); } catch (e) {}
            }
            result.changes.push("    namedGroup \"" + name + "\" 除外: " + nGroups.length + " found");
            break;

        case "custom":
            if ((elem.customKind || "layer") === "group") {
                var cGroups = [];
                collectSpecialLayerSets(doc, cGroups, name, partial);
                for (var cgi = cGroups.length - 1; cgi >= 0; cgi--) {
                    try { cGroups[cgi].remove(); } catch (e) {}
                }
                result.changes.push("    custom group \"" + name + "\" 除外: " + cGroups.length + " found");
            } else {
                var cLayers = [];
                collectSpecialLayers(doc, cLayers, name, partial);
                for (var cli = cLayers.length - 1; cli >= 0; cli--) {
                    try { unlockAndRemoveLayer(cLayers[cli]); } catch (e) {}
                }
                result.changes.push("    custom layer \"" + name + "\" 除外: " + cLayers.length + " found");
            }
            break;

        default:
            result.changes.push("    除外: unknown type \"" + elemType + "\"");
            break;
    }
}

// 合成モード: otherDoc → baseDoc へ要素をコピー
function composeCopyElement(fromDoc, toDoc, elem, composeOpts, result, offsetX, offsetY, needFontScale, scaleX, scaleY) {
    var name = elem.customName || "";
    var partial = elem.partialMatch || false;
    var elemType = elem["type"] || "";

    switch (elemType) {
        case "textFolders":
            var textCopyCount = 0;
            result.changes.push("    [textFolders] fromDoc layerSets=" + fromDoc.layerSets.length);
            for (var ti = 0; ti < fromDoc.layerSets.length; ti++) {
                setActiveDocument(fromDoc);
                var srcSet = fromDoc.layerSets[ti];
                var hasText = hasTextLayersInFolder(srcSet);
                result.changes.push("      layerSet[" + ti + "] \"" + srcSet.name + "\" visible=" + srcSet.visible + " hasText=" + hasText);
                if (srcSet.visible && hasText) {
                    try {
                        var dupFolder = duplicateLayerSet(srcSet, toDoc, ElementPlacement.PLACEATBEGINNING);
                        if (dupFolder) {
                            setActiveDocument(toDoc);
                            clearLayerColor(dupFolder);
                            removeNonTextLayersFromFolder(dupFolder);
                            if (needFontScale) {
                                try { scaleTextFontSizes(dupFolder, scaleX, scaleY, composeOpts.roundFontSize); } catch (e) {}
                            }
                            if (composeOpts.skipResize) {
                                try { dupFolder.translate(offsetX, offsetY); } catch (e) {}
                            }
                            result.changes.push("      -> OK: \"" + srcSet.name + "\"");
                            textCopyCount++;
                        } else {
                            result.changes.push("      -> duplicateLayerSet returned null");
                        }
                    } catch (e) { result.changes.push("      -> ERROR: " + e.message); }
                }
            }
            result.changes.push("    textFolders: " + textCopyCount + " copied");
            break;

        case "background":
            setActiveDocument(fromDoc);
            var srcBg = getBottomLayer(fromDoc);
            if (srcBg) {
                setActiveDocument(toDoc);
                var tgtBg = getBottomLayer(toDoc);
                try {
                    setActiveDocument(fromDoc);
                    var dupBg = srcBg.duplicate(toDoc, ElementPlacement.PLACEATEND);
                    if (composeOpts.skipResize) { setActiveDocument(toDoc); dupBg.translate(offsetX, offsetY); }
                } catch (e) { result.changes.push("    背景複製エラー: " + e.message); }
                if (tgtBg) { setActiveDocument(toDoc); unlockAndRemoveLayer(tgtBg); }
                result.changes.push("    背景を差替え");
            } else {
                result.changes.push("    背景: fromDocに背景レイヤーなし");
            }
            break;

        case "specialLayer":
            setActiveDocument(fromDoc);
            var sLayers = [];
            collectSpecialLayers(fromDoc, sLayers, name, partial);
            for (var si = 0; si < sLayers.length; si++) {
                try {
                    var sParent = sLayers[si].parent;
                    var tContainer = toDoc;
                    var sPlacement = ElementPlacement.PLACEATBEGINNING;
                    if (sParent.typename === 'LayerSet') {
                        var tParent = findLayerSetByName(toDoc, sParent.name);
                        if (tParent) tContainer = tParent;
                    }
                    setActiveDocument(fromDoc);
                    var dup = sLayers[si].duplicate(tContainer, sPlacement);
                    if (composeOpts.skipResize) { setActiveDocument(toDoc); dup.translate(offsetX, offsetY); }
                } catch (e) { result.changes.push("    specialLayer複製エラー: " + e.message); }
            }
            result.changes.push("    specialLayer \"" + name + "\": " + sLayers.length + " found");
            break;

        case "namedGroup":
            setActiveDocument(fromDoc);
            var nGroups = [];
            collectSpecialLayerSets(fromDoc, nGroups, name, partial);
            for (var ni = 0; ni < nGroups.length; ni++) {
                try {
                    setActiveDocument(toDoc);
                    var smartPlace = getSmartPlacement(toDoc);
                    setActiveDocument(fromDoc);
                    var dupGroup = smartPlace.relative
                        ? nGroups[ni].duplicate(smartPlace.relative, smartPlace.placement)
                        : nGroups[ni].duplicate(toDoc, smartPlace.placement);
                    if (composeOpts.skipResize) { setActiveDocument(toDoc); dupGroup.translate(offsetX, offsetY); }
                } catch (e) { result.changes.push("    namedGroup複製エラー: " + e.message); }
            }
            result.changes.push("    namedGroup \"" + name + "\": " + nGroups.length + " found");
            break;

        case "custom":
            if ((elem.customKind || "layer") === "group") {
                setActiveDocument(fromDoc);
                var cGroups = [];
                collectSpecialLayerSets(fromDoc, cGroups, name, partial);
                for (var cgi = 0; cgi < cGroups.length; cgi++) {
                    try {
                        setActiveDocument(fromDoc);
                        var cDup = cGroups[cgi].duplicate(toDoc, ElementPlacement.PLACEATBEGINNING);
                        if (composeOpts.skipResize) { setActiveDocument(toDoc); cDup.translate(offsetX, offsetY); }
                    } catch (e) { result.changes.push("    customGroup複製エラー: " + e.message); }
                }
                result.changes.push("    customGroup \"" + name + "\": " + cGroups.length + " found");
            } else {
                setActiveDocument(fromDoc);
                var cLayers = [];
                collectSpecialLayers(fromDoc, cLayers, name, partial);
                for (var cli = 0; cli < cLayers.length; cli++) {
                    try {
                        setActiveDocument(fromDoc);
                        var cDup2 = cLayers[cli].duplicate(toDoc, ElementPlacement.PLACEATBEGINNING);
                        if (composeOpts.skipResize) { setActiveDocument(toDoc); cDup2.translate(offsetX, offsetY); }
                    } catch (e) { result.changes.push("    customLayer複製エラー: " + e.message); }
                }
                result.changes.push("    customLayer \"" + name + "\": " + cLayers.length + " found");
            }
            break;

        default:
            result.changes.push("    unknown type: \"" + elemType + "\"");
            break;
    }
}

/* =====================================================
   Per-Pair Processing
 ===================================================== */
function processPair(pair, opts) {
    var sourceFile = new File(pair.sourceFile);
    var targetFile = new File(pair.targetFile);

    // 出力ディレクトリ: __desktop__ プレースホルダーを解決
    var outputDirPath = pair.outputDir;
    if (outputDirPath.indexOf("__desktop__") === 0) {
        outputDirPath = Folder.desktop.fsName + outputDirPath.substring("__desktop__".length);
    }
    // パス区切りを統一
    outputDirPath = outputDirPath.replace(/\//g, ($.os.indexOf("Windows") !== -1) ? "\\" : "/");
    var outputDir = new Folder(outputDirPath);

    var result = {
        filePath: pair.sourceFile,
        success: false,
        changes: [],
        error: null
    };

    var sourceDoc = null, targetDoc = null;

    try {
        if (!sourceFile.exists) { result.error = "Source not found: " + sourceFile.fsName; return result; }
        if (!targetFile.exists) { result.error = "Target not found: " + targetFile.fsName; return result; }

        // 出力フォルダ作成
        if (!outputDir.exists) {
            try { outputDir.create(); } catch (e) {}
            // 親フォルダが無い場合は再帰的に作成
            if (!outputDir.exists) {
                createFolderRecursive(outputDir);
            }
        }

        // ファイルを開く
        try {
            sourceDoc = app.open(new File(sourceFile.fsName));
        } catch (e) { result.error = "Cannot open source: " + e.message; return result; }

        try {
            targetDoc = app.open(new File(targetFile.fsName));
        } catch (e) {
            result.error = "Cannot open target: " + e.message;
            if (sourceDoc) try { sourceDoc.close(SaveOptions.DONOTSAVECHANGES); } catch(e2) {}
            return result;
        }

        // ビットマップモードの場合グレースケールに変換
        setActiveDocument(targetDoc);
        if (targetDoc.mode == DocumentMode.BITMAP) {
            targetDoc.changeMode(ChangeMode.GRAYSCALE);
            targetDoc.resizeImage(null, null, 600, ResampleMethod.NONE);
        }

        setActiveDocument(sourceDoc);
        var centerOffsetX = 0, centerOffsetY = 0;
        var scaleX = 1, scaleY = 1;

      if (opts.isComposeMode && !opts.composeSettings) {
        result.changes.push("警告: 合成モードですがcomposeSettingsが空です (type=" + typeof opts.composeSettings + ")");
      }

      if (opts.isComposeMode && opts.composeSettings) {
        // ============================================================
        //  合成モード処理
        // ============================================================
        var cs = opts.composeSettings;
        var rest = cs.restSource || "B";
        var composeSkipResize = cs.skipResize || false;
        var composeRoundFont = cs.roundFontSize !== false;  // default true
        // base = 残りを保持するドキュメント, other = 要素をコピーする元
        var baseDoc = (rest === "A") ? sourceDoc : targetDoc;
        var otherDoc = (rest === "A") ? targetDoc : sourceDoc;

        result.changes.push("=== 合成モード開始 ===");
        result.changes.push("restSource=" + rest + " | elements=" + cs.elements.length + " | skipResize=" + composeSkipResize);
        result.changes.push("baseDoc=" + (rest === "A" ? "sourceDoc(A)" : "targetDoc(B)") + " mode=" + baseDoc.mode);
        result.changes.push("otherDoc=" + (rest === "A" ? "targetDoc(B)" : "sourceDoc(A)") + " mode=" + otherDoc.mode);
        result.changes.push("baseDoc: " + baseDoc.width.as('px') + "x" + baseDoc.height.as('px') + " " + baseDoc.resolution + "dpi");
        result.changes.push("otherDoc: " + otherDoc.width.as('px') + "x" + otherDoc.height.as('px') + " " + otherDoc.resolution + "dpi");
        result.changes.push("baseDoc layers=" + baseDoc.layers.length + " layerSets=" + baseDoc.layerSets.length);
        result.changes.push("otherDoc layers=" + otherDoc.layers.length + " layerSets=" + otherDoc.layerSets.length);

        // sourceDoc (A) のビットマップモード変換 — リサイズ前に実行
        setActiveDocument(sourceDoc);
        if (sourceDoc.mode == DocumentMode.BITMAP) {
            sourceDoc.changeMode(ChangeMode.GRAYSCALE);
            sourceDoc.resizeImage(null, null, 600, ResampleMethod.NONE);
            result.changes.push("sourceDoc: BITMAP -> GRAYSCALE変換");
        }

        // baseのラベルを記録（文字列比較用）
        var baseLabel = (rest === "A") ? "A" : "B";

        // テキストフォルダを他方からコピーするか判定（フォントサイズ調整判定用）
        var hasTextCopy = false;
        for (var ci = 0; ci < cs.elements.length; ci++) {
            var ciElem = cs.elements[ci];
            if (ciElem["type"] === "textFolders" && ciElem.source !== "exclude") {
                if (ciElem.source !== baseLabel) { hasTextCopy = true; break; }
            }
        }

        var needFontSizeAdjustment = hasTextCopy && !composeSkipResize;
        if (needFontSizeAdjustment) {
            var oRes = otherDoc.resolution;
            var bRes = baseDoc.resolution;
            scaleX = (baseDoc.width.as('px') / bRes) / (otherDoc.width.as('px') / oRes);
            scaleY = (baseDoc.height.as('px') / bRes) / (otherDoc.height.as('px') / oRes);
            if (Math.abs(scaleX - 1.0) < 0.005 && Math.abs(scaleY - 1.0) < 0.005) {
                needFontSizeAdjustment = false;
                scaleX = 1; scaleY = 1;
            }
        }
        result.changes.push("hasTextCopy=" + hasTextCopy + " needFontScale=" + needFontSizeAdjustment + " scale=" + scaleX.toFixed(3));

        // other を base のサイズにリサイズ
        if (!composeSkipResize) {
            setActiveDocument(otherDoc);
            otherDoc.resizeImage(baseDoc.width, baseDoc.height, baseDoc.resolution, ResampleMethod.BICUBIC);
            result.changes.push("リサイズ実行 (otherDoc -> baseDocサイズ)");
        } else {
            centerOffsetX = (baseDoc.width - otherDoc.width) / 2;
            centerOffsetY = (baseDoc.height - otherDoc.height) / 2;
            result.changes.push("リサイズスキップ (offset=" + centerOffsetX + "," + centerOffsetY + ")");
        }

        // 合成設定オプション（composeCopyElementへ渡す）
        var composeOpts = {
            skipResize: composeSkipResize,
            roundFontSize: composeRoundFont
        };

        // 各合成要素を処理（文字列比較で判定 — ExtendScriptではDocumentオブジェクト比較が不安定）
        for (var ei = 0; ei < cs.elements.length; ei++) {
            var elem = cs.elements[ei];
            var elemType = elem["type"] || "";

            result.changes.push("--- 要素[" + ei + "]: type=\"" + elemType + "\" source=\"" + elem.source + "\" name=\"" + (elem.customName || "") + "\"");

            if (elem.source === "exclude") {
                // baseDoc から該当要素を除外
                result.changes.push("  -> exclude: baseDocから除外");
                composeRemoveElement(baseDoc, elem, result);
            } else if (elem.source === baseLabel) {
                // ベースに既に存在 → スキップ
                result.changes.push("  -> skip: 既にbaseDoc内 (source=" + elem.source + " === baseLabel=" + baseLabel + ")");
            } else {
                // otherDoc → baseDoc へ要素をコピー
                result.changes.push("  -> copy: otherDoc -> baseDoc (source=" + elem.source + " !== baseLabel=" + baseLabel + ")");
                composeCopyElement(otherDoc, baseDoc, elem, composeOpts, result, centerOffsetX, centerOffsetY, needFontSizeAdjustment, scaleX, scaleY);
            }
        }

        if (needFontSizeAdjustment) {
            result.changes.push("フォントサイズ調整適用 (scale: " + ((scaleX + scaleY) / 2).toFixed(3) + ")");
        }
        result.changes.push("=== 合成モード完了 ===");

      } else {
        // ============================================================
        //  既存モード処理（text / image / batch / switch）
        // ============================================================

        // テキスト差替え時はリサイズ前にスケール比を計算（フォントサイズ調整用）
        var needFontSizeAdjustment = opts.shouldReplaceText && !opts.skipResize;
        if (needFontSizeAdjustment) {
            // ピクセル数ではなく物理サイズ（インチ）で比率を計算する
            // 解像度が異なる原稿（例: カラー350dpi→モノクロ600dpi）でも
            // 同じ用紙サイズなら scaleX/Y ≈ 1 になり、フォントサイズを変えない
            var srcRes = sourceDoc.resolution;  // ppi
            var tgtRes = targetDoc.resolution;  // ppi
            var srcWInch = sourceDoc.width.as('px') / srcRes;
            var srcHInch = sourceDoc.height.as('px') / srcRes;
            var tgtWInch = targetDoc.width.as('px') / tgtRes;
            var tgtHInch = targetDoc.height.as('px') / tgtRes;
            scaleX = tgtWInch / srcWInch;
            scaleY = tgtHInch / srcHInch;
            // 物理サイズが実質同一（誤差0.5%以内）ならフォントサイズ調整は不要
            if (Math.abs(scaleX - 1.0) < 0.005 && Math.abs(scaleY - 1.0) < 0.005) {
                needFontSizeAdjustment = false;
                scaleX = 1;
                scaleY = 1;
            }
        }

        if (!opts.skipResize) {
            sourceDoc.resizeImage(targetDoc.width, targetDoc.height, targetDoc.resolution, ResampleMethod.BICUBIC);
            result.changes.push("リサイズ実行");
        } else {
            centerOffsetX = (targetDoc.width - sourceDoc.width) / 2;
            centerOffsetY = (targetDoc.height - sourceDoc.height) / 2;
        }

        // === 1. 背景レイヤー処理 ===
        if (opts.shouldReplaceBackground) {
            if (opts.isReverseDirection) {
                // 画像データ→植字データ（逆方向）
                setActiveDocument(targetDoc);
                var imgBottom = getBottomLayer(targetDoc);
                if (imgBottom) {
                    setActiveDocument(sourceDoc);
                    var srcBottom = getBottomLayer(sourceDoc);
                    try {
                        setActiveDocument(targetDoc);
                        var dupBg = imgBottom.duplicate(sourceDoc, ElementPlacement.PLACEATEND);
                        if (opts.skipResize) { setActiveDocument(sourceDoc); dupBg.translate(-centerOffsetX, -centerOffsetY); }
                    } catch (e) { result.changes.push("背景複製エラー: " + e.message); }
                    if (srcBottom) { setActiveDocument(sourceDoc); unlockAndRemoveLayer(srcBottom); }
                    result.changes.push("背景レイヤー差替え(逆方向)");
                }
            } else {
                // 植字データ→画像データ（通常方向）
                setActiveDocument(sourceDoc);
                var srcBottom = getBottomLayer(sourceDoc);
                if (srcBottom) {
                    setActiveDocument(targetDoc);
                    var tgtBottom = getBottomLayer(targetDoc);
                    try {
                        setActiveDocument(sourceDoc);
                        var dupBg = srcBottom.duplicate(targetDoc, ElementPlacement.PLACEATEND);
                        if (opts.skipResize) { setActiveDocument(targetDoc); dupBg.translate(centerOffsetX, centerOffsetY); }
                    } catch (e) { result.changes.push("背景複製エラー: " + e.message); }
                    if (tgtBottom) { setActiveDocument(targetDoc); unlockAndRemoveLayer(tgtBottom); }
                    result.changes.push("背景レイヤー差替え(通常方向)");
                }
            }
        }

        // === 2. テキストレイヤー処理 ===
        if (opts.shouldReplaceText) {
            var textCount = 0;
            var srcBottomRef = null;
            if (sourceDoc.layers.length > 0) srcBottomRef = sourceDoc.layers[sourceDoc.layers.length - 1];

            for (var fIdx = 0; fIdx < sourceDoc.layerSets.length; fIdx++) {
                var srcSet = sourceDoc.layerSets[fIdx];
                if (srcSet.visible && hasTextLayersInFolder(srcSet)) {
                    try {
                        var placement = ElementPlacement.PLACEATBEGINNING;
                        if (!opts.shouldReplaceBackground && srcBottomRef && srcSet === srcBottomRef) {
                            placement = ElementPlacement.PLACEATEND;
                        }
                        var dupFolder = duplicateLayerSet(srcSet, targetDoc, placement);
                        if (dupFolder) {
                            setActiveDocument(targetDoc);
                            clearLayerColor(dupFolder);
                            removeNonTextLayersFromFolder(dupFolder);
                            if (needFontSizeAdjustment) {
                                try { scaleTextFontSizes(dupFolder, scaleX, scaleY, opts.shouldRoundFontSize); } catch (e) {}
                            }
                            if (opts.skipResize) {
                                try { dupFolder.translate(centerOffsetX, centerOffsetY); } catch (e) {}
                            }
                            result.changes.push("  \u2192 \u30C6\u30AD\u30B9\u30C8\u30D5\u30A9\u30EB\u30C0\u300C" + srcSet.name + "\u300D");
                            textCount++;
                        }
                    } catch (e) { result.changes.push("\u30C6\u30AD\u30B9\u30C8\u30D5\u30A9\u30EB\u30C0\u51E6\u7406\u30A8\u30E9\u30FC: " + e.message); }
                }
            }
            result.changes.push("\u30C6\u30AD\u30B9\u30C8\u30EC\u30A4\u30E4\u30FC " + textCount + " \u30B0\u30EB\u30FC\u30D7\u3092\u30B3\u30D4\u30FC");
            if (needFontSizeAdjustment) {
                result.changes.push("フォントサイズ調整 (scale: " + ((scaleX + scaleY) / 2).toFixed(2) + ")");
            }
        }

        // === 3. 特定名レイヤー処理 ===
        if (opts.shouldReplaceSpecial) {
            var specialCount = 0;
            if (opts.isReverseDirection) {
                // 画像データ→植字データ（逆方向）
                setActiveDocument(targetDoc);
                var imgLayers = [];
                collectSpecialLayers(targetDoc, imgLayers, opts.specialName, opts.specialPartialMatch);
                for (var k = 0; k < imgLayers.length; k++) {
                    var iLayer = imgLayers[k];
                    var iContainer = sourceDoc;
                    var iPlacement = ElementPlacement.PLACEATBEGINNING;
                    var iRelative = null;
                    try {
                        if (iLayer.parent.typename === 'LayerSet') {
                            var iParent = findLayerSetByName(sourceDoc, iLayer.parent.name);
                            if (iParent) iContainer = iParent;
                        }
                        var iBelow = getLayerBelow(iLayer);
                        if (iBelow) {
                            var iBelowTarget = findArtLayerByName_InContainer(iContainer, iBelow.name);
                            if (iBelowTarget) { iRelative = iBelowTarget; iPlacement = ElementPlacement.PLACEBEFORE; }
                        } else {
                            iPlacement = ElementPlacement.PLACEATEND;
                        }
                        setActiveDocument(targetDoc);
                        var dupI = iRelative ? iLayer.duplicate(iRelative, iPlacement) : iLayer.duplicate(iContainer, iPlacement);
                        if (opts.skipResize) { setActiveDocument(sourceDoc); dupI.translate(-centerOffsetX, -centerOffsetY); }
                        result.changes.push("  \u2192 \u30EC\u30A4\u30E4\u30FC\u300C" + iLayer.name + "\u300D");
                        specialCount++;
                    } catch (e) {}
                }
            } else {
                // 通常方向（テキストタブ or バッチ）
                setActiveDocument(sourceDoc);
                var specialLayers = [];
                collectSpecialLayers(sourceDoc, specialLayers, opts.specialName, opts.specialPartialMatch);
                for (var k = 0; k < specialLayers.length; k++) {
                    var sLayer = specialLayers[k];
                    var tContainer = targetDoc;
                    var placement = ElementPlacement.PLACEATBEGINNING;
                    var relative = null;
                    try {
                        if (sLayer.parent.typename === 'LayerSet') {
                            var tParent = findLayerSetByName(targetDoc, sLayer.parent.name);
                            if (tParent) tContainer = tParent;
                        }
                        if (opts.isBatchMode) {
                            setActiveDocument(targetDoc);
                            var smartPlace = getSmartPlacement(tContainer);
                            placement = smartPlace.placement;
                            relative = smartPlace.relative;
                        } else {
                            var below = getLayerBelow(sLayer);
                            if (below) {
                                var tBelow = findArtLayerByName_InContainer(tContainer, below.name);
                                if (tBelow) { relative = tBelow; placement = ElementPlacement.PLACEBEFORE; }
                            }
                        }
                        setActiveDocument(sourceDoc);
                        var dup = relative ? sLayer.duplicate(relative, placement) : sLayer.duplicate(tContainer, placement);
                        if (opts.skipResize) { setActiveDocument(targetDoc); dup.translate(centerOffsetX, centerOffsetY); }
                        result.changes.push("  \u2192 \u30EC\u30A4\u30E4\u30FC\u300C" + sLayer.name + "\u300D");
                        specialCount++;
                    } catch (e) {}
                }
            }
            if (specialCount > 0) result.changes.push("特定名レイヤー「" + opts.specialName + "」" + specialCount + " 個を複製");
        }

        // === 4. 特定名グループ処理 ===
        if (opts.shouldReplaceTextGroup) {
            // テキストタブ用グループ（通常方向）
            var tgCount = 0;
            setActiveDocument(sourceDoc);
            var textGroups = [];
            collectSpecialLayerSets(sourceDoc, textGroups, opts.groupName, opts.groupPartialMatch);
            for (var m = 0; m < textGroups.length; m++) {
                var sGroup = textGroups[m];
                var tContainer = targetDoc;
                var placement = ElementPlacement.PLACEATBEGINNING;
                var relative = null;
                try {
                    var sIndex = getIndexInParent(sGroup);
                    if (sGroup.parent.typename === 'LayerSet') {
                        var tParent = findLayerSetByName(targetDoc, sGroup.parent.name);
                        if (tParent) tContainer = tParent;
                    }
                    if (sIndex >= 0) {
                        var tElement = getElementAtIndex(tContainer, sIndex);
                        if (tElement) { relative = tElement; placement = ElementPlacement.PLACEBEFORE; }
                        else placement = ElementPlacement.PLACEATEND;
                    }
                    setActiveDocument(sourceDoc);
                    var dupGroup = relative ? sGroup.duplicate(relative, placement) : sGroup.duplicate(tContainer, placement);
                    setActiveDocument(targetDoc);
                    clearLayerColor(dupGroup);
                    if (opts.skipResize) { dupGroup.translate(centerOffsetX, centerOffsetY); }
                    result.changes.push("  \u2192 \u30B0\u30EB\u30FC\u30D7\u300C" + sGroup.name + "\u300D");
                    tgCount++;
                } catch (e) {}
            }
            if (tgCount > 0) result.changes.push("\u30B0\u30EB\u30FC\u30D7\u300C" + opts.groupName + "\u300D" + tgCount + " \u500B\u3092\u8907\u88FD(\u901A\u5E38\u65B9\u5411)");
        }

        if (opts.shouldReplaceImageGroup) {
            var igCount = 0;
            if (opts.isBatchMode) {
                // バッチモード: 通常方向 + 下から配置
                setActiveDocument(sourceDoc);
                var batchGroups = [];
                collectSpecialLayerSets(sourceDoc, batchGroups, opts.groupName, opts.groupPartialMatch);
                for (var sg = 0; sg < batchGroups.length; sg++) {
                    var sGroup = batchGroups[sg];
                    var tContainer = targetDoc;
                    var placement = ElementPlacement.PLACEATBEGINNING;
                    var relative = null;
                    try {
                        if (sGroup.parent.typename === 'LayerSet') {
                            var tParent = findLayerSetByName(targetDoc, sGroup.parent.name);
                            if (tParent) tContainer = tParent;
                        }
                        var sIdxBottom = getIndexFromBottom(sGroup);
                        setActiveDocument(targetDoc);
                        if (sIdxBottom >= 0) {
                            var tElement = getElementAtIndexFromBottom(tContainer, sIdxBottom);
                            if (tElement) { relative = tElement; placement = ElementPlacement.PLACEAFTER; }
                            else placement = ElementPlacement.PLACEATEND;
                        } else {
                            var smartPlace = getSmartPlacement(tContainer);
                            placement = smartPlace.placement;
                            relative = smartPlace.relative;
                        }
                        setActiveDocument(sourceDoc);
                        var dupGroup = relative ? sGroup.duplicate(relative, placement) : sGroup.duplicate(tContainer, placement);
                        setActiveDocument(targetDoc);
                        clearLayerColor(dupGroup);
                        if (opts.skipResize) { dupGroup.translate(centerOffsetX, centerOffsetY); }
                        result.changes.push("  \u2192 \u30B0\u30EB\u30FC\u30D7\u300C" + sGroup.name + "\u300D");
                        igCount++;
                    } catch (e) {}
                }
            } else if (opts.usePlaceFromBottom) {
                // 画像タブ + 下から配置(逆方向)
                setActiveDocument(targetDoc);
                var bottomGroups = [];
                collectSpecialLayerSets(targetDoc, bottomGroups, opts.groupName, opts.groupPartialMatch);
                for (var bg = 0; bg < bottomGroups.length; bg++) {
                    var bGroup = bottomGroups[bg];
                    var bContainer = sourceDoc;
                    var bPlacement = ElementPlacement.PLACEATBEGINNING;
                    var bRelative = null;
                    try {
                        if (bGroup.parent.typename === 'LayerSet') {
                            var bParent = findLayerSetByName(sourceDoc, bGroup.parent.name);
                            if (bParent) bContainer = bParent;
                        }
                        var bIdxBottom = getIndexFromBottom(bGroup);
                        setActiveDocument(sourceDoc);
                        if (bIdxBottom >= 0) {
                            var bElement = getElementAtIndexFromBottom(bContainer, bIdxBottom);
                            if (bElement) { bRelative = bElement; bPlacement = ElementPlacement.PLACEAFTER; }
                            else bPlacement = ElementPlacement.PLACEATEND;
                        }
                        setActiveDocument(targetDoc);
                        var dupBGroup = bRelative ? bGroup.duplicate(bRelative, bPlacement) : bGroup.duplicate(bContainer, bPlacement);
                        setActiveDocument(sourceDoc);
                        clearLayerColor(dupBGroup);
                        if (opts.skipResize) { dupBGroup.translate(-centerOffsetX, -centerOffsetY); }
                        result.changes.push("  \u2192 \u30B0\u30EB\u30FC\u30D7\u300C" + bGroup.name + "\u300D");
                        igCount++;
                    } catch (e) {}
                }
            } else {
                // 画像タブ通常(逆方向)
                setActiveDocument(targetDoc);
                var imageGroups = [];
                collectSpecialLayerSets(targetDoc, imageGroups, opts.groupName, opts.groupPartialMatch);
                for (var n = 0; n < imageGroups.length; n++) {
                    var iGroup = imageGroups[n];
                    var iContainer = sourceDoc;
                    var iPlacement = ElementPlacement.PLACEATBEGINNING;
                    var iRelative = null;
                    try {
                        var iIndex = getIndexInParent(iGroup);
                        if (iGroup.parent.typename === 'LayerSet') {
                            var iParent = findLayerSetByName(sourceDoc, iGroup.parent.name);
                            if (iParent) iContainer = iParent;
                        }
                        if (iIndex >= 0) {
                            var iElement = getElementAtIndex(iContainer, iIndex);
                            if (iElement) { iRelative = iElement; iPlacement = ElementPlacement.PLACEBEFORE; }
                            else iPlacement = ElementPlacement.PLACEATEND;
                        }
                        setActiveDocument(targetDoc);
                        var dupIGroup = iRelative ? iGroup.duplicate(iRelative, iPlacement) : iGroup.duplicate(iContainer, iPlacement);
                        setActiveDocument(sourceDoc);
                        clearLayerColor(dupIGroup);
                        if (opts.skipResize) { dupIGroup.translate(-centerOffsetX, -centerOffsetY); }
                        result.changes.push("  \u2192 \u30B0\u30EB\u30FC\u30D7\u300C" + iGroup.name + "\u300D");
                        igCount++;
                    } catch (e) {}
                }
            }
            if (igCount > 0) result.changes.push("グループ「" + opts.groupName + "」" + igCount + " 個を複製");
        }

        // === 5. Switch mode: hide + copy ===
        if (opts.isSwitchMode) {
            if (opts.switchSubMode === "whiteToBar") {
                // Case A: targetDoc has white-erase layers -> hide them, copy bar-erase groups from sourceDoc
                // Step 1: Hide white-erase layers in targetDoc
                setActiveDocument(targetDoc);
                var whiteLayersToHide = [];
                collectSpecialLayers(targetDoc, whiteLayersToHide, opts.switchWhiteName, opts.switchWhitePartialMatch);
                var whHiddenCount = 0;
                for (var wh = 0; wh < whiteLayersToHide.length; wh++) {
                    try { whiteLayersToHide[wh].visible = false; whHiddenCount++; } catch (e_wh) {}
                }
                if (whHiddenCount > 0) {
                    result.changes.push("\u975E\u8868\u793A: \u300C" + opts.switchWhiteName + "\u300D" + whHiddenCount + " \u500B");
                }

                // Step 2: Copy bar-erase groups from sourceDoc to targetDoc
                setActiveDocument(sourceDoc);
                var barGroupsToCopy = [];
                collectSpecialLayerSets(sourceDoc, barGroupsToCopy, opts.switchBarName, opts.switchBarPartialMatch);
                var bgCopiedCount = 0;
                for (var bg = 0; bg < barGroupsToCopy.length; bg++) {
                    var bGroup = barGroupsToCopy[bg];
                    var bContainer = targetDoc;
                    var bPlacement = ElementPlacement.PLACEATBEGINNING;
                    var bRelative = null;
                    try {
                        if (bGroup.parent.typename === 'LayerSet') {
                            var bParent = findLayerSetByName(targetDoc, bGroup.parent.name);
                            if (bParent) bContainer = bParent;
                        }
                        if (opts.switchPlaceFromBottom) {
                            var bIdxBottom = getIndexFromBottom(bGroup);
                            setActiveDocument(targetDoc);
                            if (bIdxBottom >= 0) {
                                var bElem = getElementAtIndexFromBottom(bContainer, bIdxBottom);
                                if (bElem) { bRelative = bElem; bPlacement = ElementPlacement.PLACEAFTER; }
                                else bPlacement = ElementPlacement.PLACEATEND;
                            }
                        } else {
                            var bIdx = getIndexInParent(bGroup);
                            if (bIdx >= 0) {
                                setActiveDocument(targetDoc);
                                var bElem2 = getElementAtIndex(bContainer, bIdx);
                                if (bElem2) { bRelative = bElem2; bPlacement = ElementPlacement.PLACEBEFORE; }
                                else bPlacement = ElementPlacement.PLACEATEND;
                            }
                        }
                        setActiveDocument(sourceDoc);
                        var dupBG = bRelative ? bGroup.duplicate(bRelative, bPlacement) : bGroup.duplicate(bContainer, bPlacement);
                        setActiveDocument(targetDoc);
                        clearLayerColor(dupBG);
                        if (opts.skipResize) { dupBG.translate(centerOffsetX, centerOffsetY); }
                        result.changes.push("  \u2192 \u30B0\u30EB\u30FC\u30D7\u300C" + bGroup.name + "\u300D");
                        bgCopiedCount++;
                    } catch (e_bg) {}
                }
                if (bgCopiedCount > 0) {
                    result.changes.push("\u30B0\u30EB\u30FC\u30D7\u300C" + opts.switchBarName + "\u300D" + bgCopiedCount + " \u500B\u3092\u8907\u88FD");
                }

            } else if (opts.switchSubMode === "barToWhite") {
                // Case B: targetDoc has bar-erase groups -> hide them, copy white-erase layers from sourceDoc
                // Step 1: Hide bar-erase groups in targetDoc
                setActiveDocument(targetDoc);
                var barGroupsToHide = [];
                collectSpecialLayerSets(targetDoc, barGroupsToHide, opts.switchBarName, opts.switchBarPartialMatch);
                var brHiddenCount = 0;
                for (var bh = 0; bh < barGroupsToHide.length; bh++) {
                    try { barGroupsToHide[bh].visible = false; brHiddenCount++; } catch (e_bh) {}
                }
                if (brHiddenCount > 0) {
                    result.changes.push("\u975E\u8868\u793A: \u300C" + opts.switchBarName + "\u300D" + brHiddenCount + " \u500B");
                }

                // Step 2: Copy white-erase layers from sourceDoc to targetDoc
                setActiveDocument(sourceDoc);
                var whiteLayersToCopy = [];
                collectSpecialLayers(sourceDoc, whiteLayersToCopy, opts.switchWhiteName, opts.switchWhitePartialMatch);
                var wlCopiedCount = 0;
                for (var wl = 0; wl < whiteLayersToCopy.length; wl++) {
                    var wLayer = whiteLayersToCopy[wl];
                    var wContainer = targetDoc;
                    var wPlacement = ElementPlacement.PLACEATBEGINNING;
                    var wRelative = null;
                    try {
                        if (wLayer.parent.typename === 'LayerSet') {
                            var wParent = findLayerSetByName(targetDoc, wLayer.parent.name);
                            if (wParent) wContainer = wParent;
                        }
                        var wBelow = getLayerBelow(wLayer);
                        if (wBelow) {
                            setActiveDocument(targetDoc);
                            var wBelowTarget = findArtLayerByName_InContainer(wContainer, wBelow.name);
                            if (wBelowTarget) { wRelative = wBelowTarget; wPlacement = ElementPlacement.PLACEBEFORE; }
                        } else {
                            wPlacement = ElementPlacement.PLACEATEND;
                        }
                        setActiveDocument(sourceDoc);
                        var dupWL = wRelative ? wLayer.duplicate(wRelative, wPlacement) : wLayer.duplicate(wContainer, wPlacement);
                        if (opts.skipResize) { setActiveDocument(targetDoc); dupWL.translate(centerOffsetX, centerOffsetY); }
                        result.changes.push("  \u2192 \u30EC\u30A4\u30E4\u30FC\u300C" + wLayer.name + "\u300D");
                        wlCopiedCount++;
                    } catch (e_wl) {}
                }
                if (wlCopiedCount > 0) {
                    result.changes.push("\u30EC\u30A4\u30E4\u30FC\u300C" + opts.switchWhiteName + "\u300D" + wlCopiedCount + " \u500B\u3092\u8907\u88FD");
                }
            }
        }

      } // end of if/else (compose vs existing modes)

        // === 保存処理 ===
        var outputFileName = opts.useSourceFileName
            ? decodeURI(sourceFile.name)
            : decodeURI(targetFile.name);
        var saveFile = new File(outputDir.fsName + "/" + outputFileName);

        if (opts.isReverseDirection) {
            // 画像差替え: 植字データ(sourceDoc)を保存
            if (targetDoc) try { targetDoc.close(SaveOptions.DONOTSAVECHANGES); } catch (e) {}
            targetDoc = null;
            setActiveDocument(sourceDoc);
            try {
                var psdOpts = new PhotoshopSaveOptions();
                psdOpts.layers = true;
                sourceDoc.saveAs(saveFile, psdOpts, true, Extension.LOWERCASE);
                result.success = true;
                result.filePath = saveFile.fsName;
                result.changes.push("保存: " + outputFileName);
            } catch (e) { result.error = "保存エラー: " + e.message; }
            if (sourceDoc) try { sourceDoc.close(SaveOptions.DONOTSAVECHANGES); } catch (e) {}
        } else {
            // テキスト差替え / バッチ: 画像データ(targetDoc)を保存
            if (sourceDoc) try { sourceDoc.close(SaveOptions.DONOTSAVECHANGES); } catch (e) {}
            sourceDoc = null;
            setActiveDocument(targetDoc);
            try {
                var psdOpts = new PhotoshopSaveOptions();
                psdOpts.layers = true;
                targetDoc.saveAs(saveFile, psdOpts, true, Extension.LOWERCASE);
                result.success = true;
                result.filePath = saveFile.fsName;
                result.changes.push("保存: " + outputFileName);
            } catch (e) { result.error = "保存エラー: " + e.message; }
            if (targetDoc) try { targetDoc.close(SaveOptions.DONOTSAVECHANGES); } catch (e) {}
        }

    } catch (e_pair) {
        result.error = "処理エラー: " + e_pair.message;
        if (sourceDoc) try { sourceDoc.close(SaveOptions.DONOTSAVECHANGES); } catch(e) {}
        if (targetDoc) try { targetDoc.close(SaveOptions.DONOTSAVECHANGES); } catch(e) {}
    }

    return result;
}

// フォルダを再帰的に作成
function createFolderRecursive(folder) {
    if (folder.exists) return true;
    var parent = folder.parent;
    if (!parent.exists) createFolderRecursive(parent);
    return folder.create();
}

/* =====================================================
   JSON Parser / Writer (same as split_psd.jsx)
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
