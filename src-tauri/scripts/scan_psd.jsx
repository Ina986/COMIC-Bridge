// Photoshop ExtendScript: フォントプリセット管理専用ツール（フォルダ対応版）
// Ver 2.02: フォント名の和名表示対応

// JSON polyfill
if (typeof JSON !== 'object') {
    JSON = {};
}

(function () {
    'use strict';

    function f(n) {
        return n < 10 ? '0' + n : n;
    }

    if (typeof Date.prototype.toJSON !== 'function') {
        Date.prototype.toJSON = function () {
            return isFinite(this.valueOf())
                ? this.getUTCFullYear() + '-' +
                    f(this.getUTCMonth() + 1) + '-' +
                    f(this.getUTCDate()) + 'T' +
                    f(this.getUTCHours()) + ':' +
                    f(this.getUTCMinutes()) + ':' +
                    f(this.getUTCSeconds()) + 'Z'
                : null;
        };

        String.prototype.toJSON =
            Number.prototype.toJSON =
            Boolean.prototype.toJSON = function () {
                return this.valueOf();
            };
    }

    var cx, escapable, gap, indent, meta, rep;

    function quote(string) {
        escapable.lastIndex = 0;
        return escapable.test(string) ? '"' + string.replace(escapable, function (a) {
            var c = meta[a];
            return typeof c === 'string'
                ? c
                : '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
        }) + '"' : '"' + string + '"';
    }

    function str(key, holder) {
        var i, k, v, length, mind = gap, partial, value = holder[key];

        if (value && typeof value === 'object' &&
                typeof value.toJSON === 'function') {
            value = value.toJSON(key);
        }

        if (typeof rep === 'function') {
            value = rep.call(holder, key, value);
        }

        switch (typeof value) {
        case 'string':
            return quote(value);
        case 'number':
            return isFinite(value) ? String(value) : 'null';
        case 'boolean':
        case 'null':
            return String(value);
        case 'object':
            if (!value) {
                return 'null';
            }
            gap += indent;
            partial = [];
            if (Object.prototype.toString.apply(value) === '[object Array]') {
                length = value.length;
                for (i = 0; i < length; i += 1) {
                    partial[i] = str(i, value) || 'null';
                }
                v = partial.length === 0
                    ? '[]'
                    : gap
                    ? '[\n' + gap + partial.join(',\n' + gap) + '\n' + mind + ']'
                    : '[' + partial.join(',') + ']';
                gap = mind;
                return v;
            }
            if (rep && typeof rep === 'object') {
                length = rep.length;
                for (i = 0; i < length; i += 1) {
                    if (typeof rep[i] === 'string') {
                        k = rep[i];
                        v = str(k, value);
                        if (v) {
                            partial.push(quote(k) + (gap ? ': ' : ':') + v);
                        }
                    }
                }
            } else {
                for (k in value) {
                    if (Object.prototype.hasOwnProperty.call(value, k)) {
                        v = str(k, value);
                        if (v) {
                            partial.push(quote(k) + (gap ? ': ' : ':') + v);
                        }
                    }
                }
            }
            v = partial.length === 0
                ? '{}'
                : gap
                ? '{\n' + gap + partial.join(',\n' + gap) + '\n' + mind + '}'
                : '{' + partial.join(',') + '}';
            gap = mind;
            return v;
        }
    }

    if (typeof JSON.stringify !== 'function') {
        escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
        meta = {
            '\b': '\\b',
            '\t': '\\t',
            '\n': '\\n',
            '\f': '\\f',
            '\r': '\\r',
            '"' : '\\"',
            '\\': '\\\\'
        };
        JSON.stringify = function (value, replacer, space) {
            var i;
            gap = '';
            indent = '';
            if (typeof space === 'number') {
                for (i = 0; i < space; i += 1) {
                    indent += ' ';
                }
            } else if (typeof space === 'string') {
                indent = space;
            }
            rep = replacer;
            if (replacer && typeof replacer !== 'function' &&
                    (typeof replacer !== 'object' ||
                    typeof replacer.length !== 'number')) {
                throw new Error('JSON.stringify');
            }
            return str('', {'': value});
        };
    }

    if (typeof JSON.parse !== 'function') {
        cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
        JSON.parse = function (text, reviver) {
            var j;
            function walk(holder, key) {
                var k, v, value = holder[key];
                if (value && typeof value === 'object') {
                    for (k in value) {
                        if (Object.prototype.hasOwnProperty.call(value, k)) {
                            v = walk(value, k);
                            if (v !== undefined) {
                                value[k] = v;
                            } else {
                                delete value[k];
                            }
                        }
                    }
                }
                return reviver.call(holder, key, value);
            }
            text = String(text);
            cx.lastIndex = 0;
            if (cx.test(text)) {
                text = text.replace(cx, function (a) {
                    return '\\u' +
                        ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
                });
            }
            if (/^[\],:{}\s]*$/
                    .test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@')
                        .replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']')
                        .replace(/(?:^|:|,)(?:\s*\[)+/g, ''))) {
                j = eval('(' + text + ')');
                return typeof reviver === 'function'
                    ? walk({'': j}, '')
                    : j;
            }
            throw new SyntaxError('JSON.parse');
        };
    }
}());

// ★★★ .trim() の Polyfill ★★★
function trimString(str) {
    if (str === null || typeof str === 'undefined') {
        return '';
    }
    if (typeof str.trim === 'function') {
        return str.trim();
    } else {
        return String(str).replace(/^\s+|\s+$/g, '');
    }
}

// ★★★ JSONフォルダの固定パス ★★★
var JSON_FOLDER_PATH = "G:/共有ドライブ/CLLENN/編集部フォルダ/編集企画部/編集企画_C班(AT業務推進)/DTP制作部/JSONフォルダ";

// JSONフォルダを取得（存在確認付き）
function getJsonFolder() {
    var folder = new Folder(JSON_FOLDER_PATH);
    if (!folder.exists) {
        alert("指定されたJSONフォルダが見つかりません：\n" + JSON_FOLDER_PATH);
        return null;
    }
    return folder;
}

// JSONフォルダをエクスプローラーで開く
function openJsonFolderInExplorer() {
    var folder = new Folder(JSON_FOLDER_PATH);
    if (folder.exists) {
        folder.execute();
    } else {
        alert("指定されたJSONフォルダが見つかりません：\n" + JSON_FOLDER_PATH);
    }
}

// ★★★ JSONファイル選択ダイアログ（フォルダ制限付き・サブフォルダ対応・検索機能付き） ★★★
function showJsonFileSelector(title) {
    var rootFolder = getJsonFolder();
    if (!rootFolder) return null;

    var currentFolder = rootFolder;

    // ダイアログ作成
    var dialog = new Window("dialog", title || "JSONファイルを選択");
    dialog.orientation = "column";
    dialog.alignChildren = ["fill", "top"];
    dialog.spacing = 10;
    dialog.margins = 15;

    // 現在のフォルダパス（内部管理用）
    var folderPathText = { text: "" };

    // ★★★ 現在のサブフォルダ名を表示 ★★★
    var folderNameGroup = dialog.add("group");
    folderNameGroup.orientation = "row";
    folderNameGroup.alignChildren = ["left", "center"];
    folderNameGroup.add("statictext", undefined, "現在のフォルダ:");
    var currentFolderLabel = folderNameGroup.add("statictext", undefined, "（ルート）");
    currentFolderLabel.preferredSize.width = 400;

    // ナビゲーションボタン
    var navGroup = dialog.add("group");
    navGroup.orientation = "row";
    navGroup.alignChildren = ["left", "center"];
    var upButton = navGroup.add("button", undefined, "↑ 上の階層へ");
    var rootButton = navGroup.add("button", undefined, "ルートへ戻る");
    var refreshButton = navGroup.add("button", undefined, "更新");
    upButton.preferredSize.width = 120;
    rootButton.preferredSize.width = 120;
    refreshButton.preferredSize.width = 80;

    // 検索ボックス
    var searchGroup = dialog.add("group");
    searchGroup.orientation = "row";
    searchGroup.alignChildren = ["left", "center"];
    searchGroup.add("statictext", undefined, "検索:");
    var searchInput = searchGroup.add("edittext", undefined, "");
    searchInput.preferredSize.width = 350;
    var searchButton = searchGroup.add("button", undefined, "検索");
    var clearButton = searchGroup.add("button", undefined, "クリア");
    searchButton.preferredSize.width = 60;
    clearButton.preferredSize.width = 60;

    // ファイル・フォルダリスト
    dialog.add("statictext", undefined, "ファイル・フォルダ一覧:（フォルダは [フォルダ名] で表示）");
    var fileList = dialog.add("listbox", undefined, [], {multiselect: false});
    fileList.preferredSize = [500, 280];

    // ボタングループ
    var buttonGroup = dialog.add("group");
    buttonGroup.orientation = "row";
    buttonGroup.alignment = "center";
    buttonGroup.spacing = 10;

    var newButton = buttonGroup.add("button", undefined, "新規作成");
    var selectButton = buttonGroup.add("button", undefined, "選択");
    var deleteButton = buttonGroup.add("button", undefined, "削除");
    var cancelButton = buttonGroup.add("button", undefined, "キャンセル");

    newButton.preferredSize.width = 80;
    selectButton.preferredSize.width = 80;
    deleteButton.preferredSize.width = 80;
    cancelButton.preferredSize.width = 80;

    var selectedFile = null;
    var isClosing = false; // ★★★ ダブルクリック防止 ★★★

    // 再帰的にJSONファイルを検索
    function searchFilesRecursively(folder, keyword, results) {
        var rootPath = decodeURI(rootFolder.fsName);

        // JSONファイルを検索
        var jsonFiles = folder.getFiles("*.json");
        for (var i = 0; i < jsonFiles.length; i++) {
            var fileName = decodeURI(jsonFiles[i].name);
            if (fileName.toLowerCase().indexOf(keyword.toLowerCase()) >= 0) {
                // 相対パスを計算
                var filePath = decodeURI(jsonFiles[i].parent.fsName);
                var relativePath = filePath.replace(rootPath, "");
                if (relativePath === "") relativePath = "/";

                results.push({
                    name: fileName,
                    displayName: fileName + "  [" + relativePath + "]",
                    isFolder: false,
                    obj: jsonFiles[i]
                });
            }
        }

        // サブフォルダを再帰的に検索
        var subFolders = folder.getFiles(function(f) { return f instanceof Folder; });
        for (var i = 0; i < subFolders.length; i++) {
            searchFilesRecursively(subFolders[i], keyword, results);
        }
    }

    // フォルダ内容を更新
    function updateFileList(searchKeyword) {
        fileList.removeAll();

        var items = [];

        // 検索キーワードがある場合は全フォルダから検索
        if (searchKeyword && trimString(searchKeyword) !== "") {
            folderPathText.text = "【検索モード】全フォルダから「" + searchKeyword + "」を検索中...";
            currentFolderLabel.text = "【検索結果】「" + searchKeyword + "」";
            upButton.enabled = false;
            rootButton.enabled = true;

            // ルートフォルダから再帰的に検索
            searchFilesRecursively(rootFolder, searchKeyword, items);

            // 名前順でソート
            items.sort(function(a, b) {
                return a.name.localeCompare(b.name);
            });

            // リストに追加（検索結果はパス付きで表示）
            for (var i = 0; i < items.length; i++) {
                var item = fileList.add("item", items[i].displayName);
                item.isFolder = false;
                item.fileObj = items[i].obj;
            }

            if (items.length === 0) {
                var emptyItem = fileList.add("item", "（該当するファイルがありません）");
                emptyItem.enabled = false;
                currentFolderLabel.text = "【検索結果】該当なし";
            } else {
                folderPathText.text = "【検索結果】「" + searchKeyword + "」: " + items.length + "件見つかりました";
                currentFolderLabel.text = "【検索結果】" + items.length + "件";
            }

        } else {
            // 通常モード：現在のフォルダを表示
            folderPathText.text = decodeURI(currentFolder.fsName);

            // ルートフォルダかどうかをチェック
            var isRoot = (decodeURI(currentFolder.fsName) === decodeURI(rootFolder.fsName));
            upButton.enabled = !isRoot;
            rootButton.enabled = !isRoot;

            // ★★★ サブフォルダ名をラベルに表示 ★★★
            if (isRoot) {
                currentFolderLabel.text = "（ルート）";
            } else {
                // ルートからの相対パスを計算して表示
                var rootPath = decodeURI(rootFolder.fsName);
                var currentPath = decodeURI(currentFolder.fsName);
                var relativePath = currentPath.replace(rootPath, "").replace(/^[\\\/]/, "");
                currentFolderLabel.text = relativePath || decodeURI(currentFolder.name);
            }

            // サブフォルダを取得
            var subFolders = currentFolder.getFiles(function(f) { return f instanceof Folder; });
            for (var i = 0; i < subFolders.length; i++) {
                var folderName = decodeURI(subFolders[i].name);
                items.push({
                    name: "[" + folderName + "]",
                    isFolder: true,
                    obj: subFolders[i]
                });
            }

            // JSONファイルを取得
            var jsonFiles = currentFolder.getFiles("*.json");
            for (var i = 0; i < jsonFiles.length; i++) {
                var fileName = decodeURI(jsonFiles[i].name);
                items.push({
                    name: fileName,
                    isFolder: false,
                    obj: jsonFiles[i]
                });
            }

            // ソート（フォルダ優先、その後名前順）
            items.sort(function(a, b) {
                if (a.isFolder && !b.isFolder) return -1;
                if (!a.isFolder && b.isFolder) return 1;
                return a.name.localeCompare(b.name);
            });

            // リストに追加
            for (var i = 0; i < items.length; i++) {
                var item = fileList.add("item", items[i].name);
                item.isFolder = items[i].isFolder;
                item.fileObj = items[i].obj;
            }

            if (items.length === 0) {
                var emptyItem = fileList.add("item", "（ファイル・フォルダがありません）");
                emptyItem.enabled = false;
            }
        }
    }

    // 上の階層へ
    upButton.onClick = function() {
        var rootPath = decodeURI(rootFolder.fsName);
        var currentPath = decodeURI(currentFolder.fsName);

        // ルートより上には行けない
        if (currentPath === rootPath) return;

        var parentFolder = currentFolder.parent;
        var parentPath = decodeURI(parentFolder.fsName);

        // ルートフォルダのパスを含んでいるか確認
        if (parentPath.indexOf(rootPath) === 0 || rootPath.indexOf(parentPath) === 0) {
            // ルートより上には行けない
            if (parentPath.length < rootPath.length) {
                currentFolder = rootFolder;
            } else {
                currentFolder = parentFolder;
            }
            searchInput.text = "";
            updateFileList();
        }
    };

    // ルートへ戻る
    rootButton.onClick = function() {
        currentFolder = rootFolder;
        searchInput.text = "";
        updateFileList();
    };

    // 検索ボタン
    searchButton.onClick = function() {
        updateFileList(searchInput.text);
    };

    // クリアボタン
    clearButton.onClick = function() {
        searchInput.text = "";
        updateFileList();
    };

    // Enterキーで検索
    searchInput.onChanging = function() {
        // リアルタイム検索（入力中にフィルタリング）
        updateFileList(searchInput.text);
    };

    // 更新ボタン
    refreshButton.onClick = function() {
        updateFileList(searchInput.text);
    };

    // 新規作成ボタン
    newButton.onClick = function() {
        if (isClosing) return; // ★★★ ダブルクリック防止 ★★★
        isClosing = true;
        newButton.enabled = false;
        selectButton.enabled = false;
        // 新規作成フラグを設定してダイアログを閉じる
        selectedFile = "NEW";
        dialog.close();
    };

    // ダブルクリック
    fileList.onDoubleClick = function() {
        if (isClosing) return; // ★★★ ダブルクリック防止 ★★★
        if (fileList.selection && fileList.selection.fileObj) {
            if (fileList.selection.isFolder) {
                // フォルダなら移動
                currentFolder = fileList.selection.fileObj;
                searchInput.text = "";
                updateFileList();
            } else {
                // ファイルなら選択して閉じる
                isClosing = true;
                selectedFile = fileList.selection.fileObj;
                dialog.close();
            }
        }
    };

    // 選択ボタン
    selectButton.onClick = function() {
        if (isClosing) return; // ★★★ ダブルクリック防止 ★★★
        if (fileList.selection && fileList.selection.fileObj) {
            if (fileList.selection.isFolder) {
                // フォルダなら移動
                currentFolder = fileList.selection.fileObj;
                searchInput.text = "";
                updateFileList();
            } else {
                // ファイルなら選択
                isClosing = true;
                newButton.enabled = false;
                selectButton.enabled = false;
                selectedFile = fileList.selection.fileObj;
                dialog.close();
            }
        } else {
            alert("ファイルを選択してください。");
        }
    };

    // キャンセルボタン
    cancelButton.onClick = function() {
        if (isClosing) return; // ★★★ ダブルクリック防止 ★★★
        isClosing = true;
        selectedFile = null;
        dialog.close();
    };

    // 削除ボタン
    deleteButton.onClick = function() {
        if (!fileList.selection || !fileList.selection.fileObj) {
            alert("削除するファイルを選択してください。");
            return;
        }
        if (fileList.selection.isFolder) {
            alert("フォルダは削除できません。\nJSONファイルを選択してください。");
            return;
        }

        var targetFile = fileList.selection.fileObj;
        var fileName = decodeURI(targetFile.name);

        // 削除確認ダイアログ
        if (!confirm("以下のファイルを削除しますか？\n\n" + fileName + "\n\n※対応するscandataも同時に削除されます。\nこの操作は取り消せません。")) {
            return;
        }

        // JSONファイルを読み込んでworkInfo情報を取得
        var jsonData = null;
        try {
            targetFile.encoding = "UTF-8";
            targetFile.open("r");
            var jsonContent = targetFile.read();
            targetFile.close();
            var parsedJson = JSON.parse(jsonContent);
            jsonData = parsedJson.presetData || null;
        } catch (e) {
            // 読み込みエラーは無視
        }

        // 対応するscandataを検索・削除
        var scandataDeleted = false;
        if (jsonData && jsonData.workInfo && jsonData.workInfo.title && jsonData.workInfo.label) {
            var safeLabel = sanitizeFileName(jsonData.workInfo.label);
            var safeTitle = sanitizeFileName(jsonData.workInfo.title);
            var scandataPath = SAVE_DATA_BASE_PATH + "/" + safeLabel + "/" + safeTitle + "_scandata.json";
            var scandataFile = new File(scandataPath);

            if (scandataFile.exists) {
                try {
                    scandataFile.remove();
                    scandataDeleted = true;
                } catch (e) {
                    alert("scandataの削除に失敗しました:\n" + e.message);
                }
            }
        }

        // JSONファイルを削除
        var jsonDeleted = false;
        try {
            targetFile.remove();
            jsonDeleted = true;
        } catch (e) {
            alert("JSONファイルの削除に失敗しました:\n" + e.message);
        }

        // 結果を表示
        if (jsonDeleted) {
            var resultMsg = "削除完了:\n\n";
            resultMsg += "- JSON: " + fileName + "\n";
            if (scandataDeleted) {
                resultMsg += "- scandata: 削除しました\n";
            } else if (jsonData && jsonData.workInfo && jsonData.workInfo.title) {
                resultMsg += "- scandata: 見つかりませんでした\n";
            }
            alert(resultMsg);

            // リストを更新
            updateFileList(searchInput.text);
        }
    };

    // 初期表示
    updateFileList();

    dialog.center();
    dialog.show();

    return selectedFile;
}

// ★★★ JSONファイル保存ダイアログ（フォルダ制限付き・サブフォルダ対応） ★★★
function showJsonFileSaveDialog(defaultName, suggestedSubFolder) {
    var rootFolder = getJsonFolder();
    if (!rootFolder) return null;

    var currentFolder = rootFolder;

    // サブフォルダが提案されている場合、そのフォルダに移動を試みる（なければ作成）
    if (suggestedSubFolder) {
        var suggestedPath = new Folder(rootFolder.fsName + "/" + suggestedSubFolder);
        if (!suggestedPath.exists) {
            // フォルダが存在しない場合は作成
            if (suggestedPath.create()) {
                currentFolder = suggestedPath;
            }
        } else {
            currentFolder = suggestedPath;
        }
    }

    // ダイアログ作成
    var dialog = new Window("dialog", "JSONファイルを保存");
    dialog.orientation = "column";
    dialog.alignChildren = ["fill", "top"];
    dialog.spacing = 10;
    dialog.margins = 15;

    // 現在のフォルダパス（内部管理用）
    var currentSubFolderText = { text: "" };

    // ★★★ 現在の保存先フォルダ名を表示 ★★★
    var folderNameGroup = dialog.add("group");
    folderNameGroup.orientation = "row";
    folderNameGroup.alignChildren = ["left", "center"];
    folderNameGroup.add("statictext", undefined, "保存先フォルダ:");
    var currentFolderLabel = folderNameGroup.add("statictext", undefined, "（ルート）");
    currentFolderLabel.preferredSize.width = 400;

    // ナビゲーションボタン
    var navGroup = dialog.add("group");
    navGroup.orientation = "row";
    navGroup.alignChildren = ["left", "center"];
    var upButton = navGroup.add("button", undefined, "↑ 上の階層へ");
    var rootButton = navGroup.add("button", undefined, "ルートへ戻る");
    var newFolderButton = navGroup.add("button", undefined, "新規フォルダ作成");
    upButton.preferredSize.width = 110;
    rootButton.preferredSize.width = 110;
    newFolderButton.preferredSize.width = 130;

    // サブフォルダ一覧
    dialog.add("statictext", undefined, "サブフォルダ（ダブルクリックで移動）:");
    var folderList = dialog.add("listbox", undefined, [], {multiselect: false});
    folderList.preferredSize = [500, 100];

    // ファイル名入力
    var nameGroup = dialog.add("group");
    nameGroup.orientation = "row";
    nameGroup.alignChildren = ["left", "center"];
    nameGroup.add("statictext", undefined, "ファイル名:");
    var nameInput = nameGroup.add("edittext", undefined, defaultName || "");
    nameInput.preferredSize.width = 400;

    // 既存ファイル一覧
    dialog.add("statictext", undefined, "既存ファイル（参考・クリックでファイル名をセット）:");
    var fileList = dialog.add("listbox", undefined, [], {multiselect: false});
    fileList.preferredSize = [500, 120];

    // ボタングループ
    var buttonGroup = dialog.add("group");
    buttonGroup.orientation = "row";
    buttonGroup.alignment = "center";
    buttonGroup.spacing = 10;

    var saveButton = buttonGroup.add("button", undefined, "保存");
    var cancelButton = buttonGroup.add("button", undefined, "キャンセル");

    saveButton.preferredSize.width = 80;
    cancelButton.preferredSize.width = 80;

    var resultFile = null;

    // フォルダ内容を更新
    function updateFolderView() {
        // ルートフォルダかどうかをチェック
        var isRoot = (decodeURI(currentFolder.fsName) === decodeURI(rootFolder.fsName));
        upButton.enabled = !isRoot;
        rootButton.enabled = !isRoot;

        // 現在のサブフォルダ名を表示
        if (isRoot) {
            currentSubFolderText.text = "JSONフォルダ（ルート）";
            currentFolderLabel.text = "（ルート）";
        } else {
            // ルートからの相対パスを取得
            var rootPath = decodeURI(rootFolder.fsName);
            var currentPath = decodeURI(currentFolder.fsName);
            var relativePath = currentPath.substring(rootPath.length + 1); // +1 for separator
            currentSubFolderText.text = relativePath;
            currentFolderLabel.text = relativePath;
        }

        // サブフォルダ一覧を更新
        folderList.removeAll();
        var subFolders = currentFolder.getFiles(function(f) { return f instanceof Folder; });
        var folderNames = [];
        for (var i = 0; i < subFolders.length; i++) {
            folderNames.push({name: decodeURI(subFolders[i].name), obj: subFolders[i]});
        }
        folderNames.sort(function(a, b) { return a.name.localeCompare(b.name); });
        for (var i = 0; i < folderNames.length; i++) {
            var item = folderList.add("item", "[" + folderNames[i].name + "]");
            item.folderObj = folderNames[i].obj;
        }

        // 既存ファイル一覧を更新
        fileList.removeAll();
        var jsonFiles = currentFolder.getFiles("*.json");
        var fileNames = [];
        for (var i = 0; i < jsonFiles.length; i++) {
            fileNames.push(decodeURI(jsonFiles[i].name));
        }
        fileNames.sort();
        for (var i = 0; i < fileNames.length; i++) {
            fileList.add("item", fileNames[i]);
        }
    }

    // 上の階層へ
    upButton.onClick = function() {
        var rootPath = decodeURI(rootFolder.fsName);
        var currentPath = decodeURI(currentFolder.fsName);
        if (currentPath === rootPath) return;

        var parentFolder = currentFolder.parent;
        var parentPath = decodeURI(parentFolder.fsName);

        if (parentPath.length < rootPath.length) {
            currentFolder = rootFolder;
        } else {
            currentFolder = parentFolder;
        }
        updateFolderView();
    };

    // ルートへ戻る
    rootButton.onClick = function() {
        currentFolder = rootFolder;
        updateFolderView();
    };

    // 新規フォルダ作成
    newFolderButton.onClick = function() {
        var newName = prompt("新規フォルダ名を入力してください:", "");
        if (newName && trimString(newName) !== "") {
            newName = trimString(newName);
            var newFolder = new Folder(currentFolder.fsName + "/" + newName);
            if (newFolder.exists) {
                alert("同名のフォルダが既に存在します。");
            } else {
                if (newFolder.create()) {
                    currentFolder = newFolder;
                    updateFolderView();
                } else {
                    alert("フォルダの作成に失敗しました。");
                }
            }
        }
    };

    // サブフォルダダブルクリックで移動
    folderList.onDoubleClick = function() {
        if (folderList.selection && folderList.selection.folderObj) {
            currentFolder = folderList.selection.folderObj;
            updateFolderView();
        }
    };

    // リストをクリックしたらファイル名をセット
    fileList.onChange = function() {
        if (fileList.selection) {
            nameInput.text = fileList.selection.text;
        }
    };

    // 保存ボタン
    saveButton.onClick = function() {
        var fileName = trimString(nameInput.text);
        if (!fileName) {
            alert("ファイル名を入力してください。");
            return;
        }

        // .json拡張子を追加（なければ）
        if (!/\.json$/i.test(fileName)) {
            fileName += ".json";
        }

        var targetFile = new File(currentFolder.fsName + "/" + fileName);

        // 既存ファイルの上書き確認
        if (targetFile.exists) {
            if (!confirm("ファイル「" + fileName + "」は既に存在します。\n上書きしますか？")) {
                return;
            }
        }

        resultFile = targetFile;
        dialog.close();
    };

    // キャンセルボタン
    cancelButton.onClick = function() {
        resultFile = null;
        dialog.close();
    };

    // 初期表示
    updateFolderView();

    dialog.center();
    dialog.show();

    return resultFile;
}

// ★★★ フォントの表示名（和名）を取得する関数 ★★★
function getFontDisplayName(postScriptName) {
    try {
        for (var i = 0; i < app.fonts.length; i++) {
            if (app.fonts[i].postScriptName === postScriptName) {
                return app.fonts[i].family + " " + app.fonts[i].style;
            }
        }
    } catch(e) {
        // エラー時はそのまま返す
    }
    return postScriptName;
}

// ★★★ レイヤーのストローク（境界線）サイズを取得する関数 ★★★
function getLayerStrokeSize(layer) {
    try {
        // レイヤーを選択
        app.activeDocument.activeLayer = layer;

        // Action Managerでレイヤー効果を取得
        var ref = new ActionReference();
        ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
        var desc = executeActionGet(ref);

        // レイヤー効果があるかチェック
        if (desc.hasKey(stringIDToTypeID("layerEffects"))) {
            var effectsDesc = desc.getObjectValue(stringIDToTypeID("layerEffects"));

            // ストローク（境界線）があるかチェック
            if (effectsDesc.hasKey(stringIDToTypeID("frameFX"))) {
                var strokeDesc = effectsDesc.getObjectValue(stringIDToTypeID("frameFX"));

                // 有効かどうかチェック
                if (strokeDesc.hasKey(stringIDToTypeID("enabled"))) {
                    if (!strokeDesc.getBoolean(stringIDToTypeID("enabled"))) {
                        return null; // 無効なストローク
                    }
                }

                // サイズを取得（UnitDouble型として直接取得）
                if (strokeDesc.hasKey(stringIDToTypeID("size"))) {
                    var size = strokeDesc.getUnitDoubleValue(stringIDToTypeID("size"));
                    return Math.round(size * 10) / 10; // 小数点1桁に丸める
                }
            }
        }
    } catch (e) {
        // エラー時はnullを返す
    }
    return null;
}

// ★★★ フォルダ（グループ）がテキストレイヤーのみを含むかチェックする関数 ★★★
function isTextOnlyFolder(layerSet) {
    try {
        if (layerSet.layers.length === 0) return false;

        for (var i = 0; i < layerSet.layers.length; i++) {
            var child = layerSet.layers[i];
            if (child.typename === "LayerSet") {
                // サブフォルダの場合は再帰的にチェック
                if (!isTextOnlyFolder(child)) return false;
            } else if (child.kind !== LayerKind.TEXT) {
                // テキストレイヤー以外があれば false
                return false;
            }
        }
        return true;
    } catch (e) {
        return false;
    }
}

// ★★★ 白フチ（ストローク）サイズを集計する関数 ★★★
function detectStrokeSizes() {
    var strokeStats = {};

    if (app.documents.length === 0) {
        return { sizes: [], stats: strokeStats };
    }

    for (var d = 0; d < app.documents.length; d++) {
        var doc = app.documents[d];
        collectStrokeSizesFromLayers(doc, doc, strokeStats);
    }

    // 配列に変換してソート（出現回数順）
    var sizeArray = [];
    for (var size in strokeStats) {
        var fontSizes = strokeStats[size].fontSizes || {};
        // フォントサイズを配列に変換して大きい順にソート
        var fontSizeArray = [];
        for (var fs in fontSizes) {
            fontSizeArray.push(parseFloat(fs));
        }
        fontSizeArray.sort(function(a, b) { return b - a; });
        // 最大のフォントサイズを取得
        var maxFontSize = fontSizeArray.length > 0 ? fontSizeArray[0] : null;

        sizeArray.push({
            size: parseFloat(size),
            count: strokeStats[size].count,
            fontSizes: fontSizeArray,
            maxFontSize: maxFontSize
        });
    }
    sizeArray.sort(function(a, b) { return b.count - a.count; });

    return { sizes: sizeArray, stats: strokeStats };
}

// ★★★ レイヤーを再帰的に探索してストロークサイズを集計（非表示レイヤーは除外）★★★
function collectStrokeSizesFromLayers(doc, parent, strokeStats) {
    for (var i = 0; i < parent.layers.length; i++) {
        var layer = parent.layers[i];

        // ★★★ 非表示レイヤーは除外 ★★★
        if (!layer.visible) continue;

        try {
            if (layer.typename === "LayerSet") {
                // フォルダの場合
                // ★★★ 空のフォルダはスキップ ★★★
                if (layer.layers.length === 0) {
                    continue;
                }
                // テキストレイヤーのみを含むフォルダならストロークをチェック
                if (isTextOnlyFolder(layer)) {
                    // ★★★ フォルダ内に表示されているテキストレイヤーがあるか先に確認 ★★★
                    var maxFontSizeInFolder = getMaxFontSizeInFolder(layer);
                    if (maxFontSizeInFolder === null) {
                        // 中に有効なテキストレイヤーがない場合はスキップ
                        collectStrokeSizesFromLayers(doc, layer, strokeStats);
                        continue;
                    }
                    app.activeDocument = doc;
                    var strokeSize = getLayerStrokeSize(layer);
                    if (strokeSize !== null && strokeSize > 0) {
                        if (!strokeStats[strokeSize]) {
                            strokeStats[strokeSize] = { count: 0, fontSizes: {} };
                        }
                        strokeStats[strokeSize].count++;
                        strokeStats[strokeSize].fontSizes[maxFontSizeInFolder] = true;
                    }
                }
                // サブレイヤーも検索
                collectStrokeSizesFromLayers(doc, layer, strokeStats);

            } else if (layer.kind === LayerKind.TEXT) {
                // テキストレイヤーの場合
                app.activeDocument = doc;
                var strokeSize = getLayerStrokeSize(layer);
                if (strokeSize !== null && strokeSize > 0) {
                    if (!strokeStats[strokeSize]) {
                        strokeStats[strokeSize] = { count: 0, fontSizes: {} };
                    }
                    strokeStats[strokeSize].count++;
                    // テキストレイヤーのフォントサイズを取得
                    try {
                        var fontSize = layer.textItem.size.as("pt");
                        strokeStats[strokeSize].fontSizes[fontSize] = true;
                    } catch (e) {}
                }
            }
        } catch (e) {
            // エラーは無視して続行
        }
    }
}

// ★★★ フォルダ内のテキストレイヤーから最大フォントサイズを取得（非表示レイヤーは除外）★★★
function getMaxFontSizeInFolder(layerSet) {
    var maxSize = null;
    for (var i = 0; i < layerSet.layers.length; i++) {
        var layer = layerSet.layers[i];
        // ★★★ 非表示レイヤーは除外 ★★★
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

// ★★★ サーバー保存先ベースパス（グローバル定数）★★★
var SAVE_DATA_BASE_PATH = "G:/共有ドライブ/CLLENN/編集部フォルダ/編集企画部/編集企画_C班(AT業務推進)/DTP制作部/作品情報";

// ★★★ テキストログ出力先パス（グローバル定数）★★★
var TEXT_LOG_FOLDER_PATH = "G:/共有ドライブ/CLLENN/編集部フォルダ/編集企画部/写植・校正用テキストログ";

// メイン処理実行
main();

// ★★★ 新規作成時の作品情報入力ダイアログ ★★★
/**
 * ★★★ 追加スキャン用フォルダ選択ダイアログ ★★★
 * 複数フォルダを選択し、各フォルダに巻数を設定できる
 */
function showAdditionalScanDialog() {
    var dialog = new Window("dialog", "追加スキャン - フォルダ選択");
    dialog.orientation = "column";
    dialog.alignChildren = ["fill", "top"];
    dialog.spacing = 10;
    dialog.margins = 20;

    dialog.add("statictext", undefined, "【追加スキャンするフォルダを選択】");
    dialog.add("statictext", undefined, "※既存のデータに追記されます（カウントは加算）");

    // フォルダパネル
    var folderPanel = dialog.add("panel", undefined, "フォルダ一覧");
    folderPanel.orientation = "column";
    folderPanel.alignChildren = ["fill", "top"];
    folderPanel.margins = 10;

    // フォルダ追加ボタン群
    var addButtonGroup = folderPanel.add("group");
    addButtonGroup.orientation = "row";
    addButtonGroup.alignChildren = ["left", "center"];
    var autoDetectButton = addButtonGroup.add("button", undefined, "自動検出...");
    var manualAddButton = addButtonGroup.add("button", undefined, "個別追加...");
    var clearAllButton = addButtonGroup.add("button", undefined, "全てクリア");
    autoDetectButton.preferredSize.width = 100;
    manualAddButton.preferredSize.width = 100;
    clearAllButton.preferredSize.width = 100;

    // フォルダリスト
    folderPanel.add("statictext", undefined, "選択したフォルダ一覧（ダブルクリックで巻数変更）:");
    var folderList = folderPanel.add("listbox", undefined, [], {
        numberOfColumns: 3,
        showHeaders: true,
        columnTitles: ["フォルダ名", "巻数", "パス"],
        columnWidths: [180, 60, 180]
    });
    folderList.preferredSize = [440, 150];

    // 操作ボタン
    var folderButtonGroup = folderPanel.add("group");
    folderButtonGroup.orientation = "row";
    folderButtonGroup.alignment = "center";
    var removeFolderButton = folderButtonGroup.add("button", undefined, "選択を削除");
    var changeVolumeButton = folderButtonGroup.add("button", undefined, "巻数変更...");
    removeFolderButton.preferredSize.width = 100;
    changeVolumeButton.preferredSize.width = 100;

    // 選択されたフォルダとその巻数を保持
    var folderVolumeList = [];

    // フォルダリスト更新関数
    function updateFolderList() {
        folderList.removeAll();
        folderVolumeList.sort(function(a, b) {
            return naturalSortCompare(a.folder.name, b.folder.name);
        });
        for (var i = 0; i < folderVolumeList.length; i++) {
            var folderName = decodeURI(folderVolumeList[i].folder.name);
            var item = folderList.add("item", folderName);
            item.subItems[0].text = folderVolumeList[i].volume + "巻";
            item.subItems[1].text = decodeURI(folderVolumeList[i].folder.fsName);
            item.folderData = folderVolumeList[i];
        }
    }

    // 自動検出ボタン（新規登録と同じ方式：開始巻数を選択）
    autoDetectButton.onClick = function() {
        var parentFolder = Folder.selectDialog("PSDが含まれる親フォルダを選択");
        if (!parentFolder) return;

        var targetFolders = determineTargetFolders(parentFolder);
        if (targetFolders.length === 0) {
            alert("PSDファイルが見つかりませんでした。");
            return;
        }

        // ★★★ 開始巻数を入力（新規登録と同じ方式）★★★
        var startVolDialog = new Window("dialog", "開始巻数を選択");
        startVolDialog.orientation = "column";
        startVolDialog.alignChildren = ["fill", "top"];
        startVolDialog.margins = 15;
        startVolDialog.add("statictext", undefined, "検出フォルダ数: " + targetFolders.length);

        // ドロップダウン選択
        var volGroup = startVolDialog.add("group");
        volGroup.add("statictext", undefined, "開始巻数:");
        var volDropdown = volGroup.add("dropdownlist");
        for (var v = 1; v <= 50; v++) {
            volDropdown.add("item", v + "巻");
        }
        // 現在のリストの最大巻数+1をデフォルトに
        var nextVol = 1;
        if (folderVolumeList.length > 0) {
            var maxVol = 0;
            for (var mv = 0; mv < folderVolumeList.length; mv++) {
                if (folderVolumeList[mv].volume > maxVol) {
                    maxVol = folderVolumeList[mv].volume;
                }
            }
            nextVol = maxVol + 1;
        }
        if (nextVol > 50) nextVol = 50;
        volDropdown.selection = nextVol - 1;

        // ★★★ 手入力欄を追加 ★★★
        var manualGroup = startVolDialog.add("group");
        manualGroup.add("statictext", undefined, "または手入力:");
        var manualInput = manualGroup.add("edittext", undefined, "");
        manualInput.characters = 10;
        manualInput.helpTip = "51巻以上の場合はここに入力（全角数字も可）";

        // 手入力時にドロップダウンの選択を解除
        manualInput.onChanging = function() {
            if (manualInput.text !== "") {
                volDropdown.selection = null;
            }
        };
        // ドロップダウン選択時に手入力をクリア
        volDropdown.onChange = function() {
            if (volDropdown.selection !== null) {
                manualInput.text = "";
            }
        };

        var volBtnGroup = startVolDialog.add("group");
        volBtnGroup.alignment = "center";
        var volOkBtn = volBtnGroup.add("button", undefined, "追加");
        var volCancelBtn = volBtnGroup.add("button", undefined, "キャンセル");
        var startVol = null;
        volOkBtn.onClick = function() {
            // 手入力を優先
            if (manualInput.text !== "") {
                var parsed = normalizeVolumeInput(manualInput.text);
                if (parsed !== null) {
                    startVol = parsed;
                } else {
                    alert("有効な数値を入力してください。");
                    return;
                }
            } else if (volDropdown.selection) {
                startVol = volDropdown.selection.index + 1;
            } else {
                alert("巻数を選択または入力してください。");
                return;
            }
            startVolDialog.close();
        };
        volCancelBtn.onClick = function() { startVolDialog.close(); };
        startVolDialog.show();

        if (startVol !== null) {
            // 検出したフォルダを追加（重複チェック）
            var addedCount = 0;
            for (var fi = 0; fi < targetFolders.length; fi++) {
                var targetFolder = targetFolders[fi];
                var isDuplicate = false;
                for (var ei = 0; ei < folderVolumeList.length; ei++) {
                    if (folderVolumeList[ei].folder.fsName === targetFolder.fsName) {
                        isDuplicate = true;
                        break;
                    }
                }
                if (!isDuplicate) {
                    folderVolumeList.push({
                        folder: targetFolder,
                        volume: startVol + addedCount
                    });
                    addedCount++;
                }
            }
            updateFolderList();
            if (addedCount > 0) {
                alert(addedCount + "個のフォルダを追加しました。");
            } else {
                alert("追加できるフォルダがありませんでした（既に登録済み）。");
            }
        }
    };

    // 個別追加ボタン（新規登録と同じ方式：巻数を選択）
    manualAddButton.onClick = function() {
        var folder = Folder.selectDialog("PSDフォルダを選択");
        if (!folder) return;

        for (var i = 0; i < folderVolumeList.length; i++) {
            if (folderVolumeList[i].folder.fsName === folder.fsName) {
                alert("このフォルダは既に追加されています。");
                return;
            }
        }

        // ★★★ 巻数を入力（新規登録と同じ方式）★★★
        var volDialog = new Window("dialog", "巻数を選択");
        volDialog.orientation = "column";
        volDialog.alignChildren = ["fill", "top"];
        volDialog.margins = 15;
        volDialog.add("statictext", undefined, "フォルダ: " + decodeURI(folder.name));

        // ドロップダウン選択
        var volGroup = volDialog.add("group");
        volGroup.add("statictext", undefined, "巻数:");
        var volDropdown = volGroup.add("dropdownlist");
        for (var v = 1; v <= 50; v++) {
            volDropdown.add("item", v + "巻");
        }
        // 現在のリストの最大巻数+1をデフォルトに
        var nextVol = 1;
        if (folderVolumeList.length > 0) {
            var maxVol = 0;
            for (var mv = 0; mv < folderVolumeList.length; mv++) {
                if (folderVolumeList[mv].volume > maxVol) {
                    maxVol = folderVolumeList[mv].volume;
                }
            }
            nextVol = maxVol + 1;
        }
        if (nextVol > 50) nextVol = 50;
        volDropdown.selection = nextVol - 1;

        // ★★★ 手入力欄を追加 ★★★
        var manualGroup = volDialog.add("group");
        manualGroup.add("statictext", undefined, "または手入力:");
        var manualInput = manualGroup.add("edittext", undefined, "");
        manualInput.characters = 10;
        manualInput.helpTip = "51巻以上の場合はここに入力（全角数字も可）";

        // 手入力時にドロップダウンの選択を解除
        manualInput.onChanging = function() {
            if (manualInput.text !== "") {
                volDropdown.selection = null;
            }
        };
        // ドロップダウン選択時に手入力をクリア
        volDropdown.onChange = function() {
            if (volDropdown.selection !== null) {
                manualInput.text = "";
            }
        };

        var volBtnGroup = volDialog.add("group");
        volBtnGroup.alignment = "center";
        var volOkBtn = volBtnGroup.add("button", undefined, "追加");
        var volCancelBtn = volBtnGroup.add("button", undefined, "キャンセル");
        var selectedVol = null;
        volOkBtn.onClick = function() {
            // 手入力を優先
            if (manualInput.text !== "") {
                var parsed = normalizeVolumeInput(manualInput.text);
                if (parsed !== null) {
                    selectedVol = parsed;
                } else {
                    alert("有効な数値を入力してください。");
                    return;
                }
            } else if (volDropdown.selection) {
                selectedVol = volDropdown.selection.index + 1;
            } else {
                alert("巻数を選択または入力してください。");
                return;
            }
            volDialog.close();
        };
        volCancelBtn.onClick = function() { volDialog.close(); };
        volDialog.show();

        if (selectedVol !== null) {
            folderVolumeList.push({ folder: folder, volume: selectedVol });
            updateFolderList();
        }
    };

    // 全てクリアボタン
    clearAllButton.onClick = function() {
        folderVolumeList = [];
        updateFolderList();
    };

    // 削除ボタン
    removeFolderButton.onClick = function() {
        if (!folderList.selection) return;
        var idx = folderList.selection.index;
        folderVolumeList.splice(idx, 1);
        updateFolderList();
    };

    // 巻数変更ボタン
    changeVolumeButton.onClick = function() {
        if (!folderList.selection) {
            alert("巻数を変更するフォルダを選択してください。");
            return;
        }
        var idx = folderList.selection.index;
        var folderData = folderVolumeList[idx];

        var volumeDialog = new Window("dialog", "巻数を変更");
        volumeDialog.orientation = "column";
        volumeDialog.alignChildren = ["fill", "top"];
        volumeDialog.margins = 15;
        volumeDialog.add("statictext", undefined, "フォルダ: " + decodeURI(folderData.folder.name));

        // ドロップダウン選択
        var volGroup = volumeDialog.add("group");
        volGroup.add("statictext", undefined, "巻数:");
        var volDropdown = volGroup.add("dropdownlist");
        for (var v = 1; v <= 50; v++) {
            volDropdown.add("item", v + "巻");
        }
        // 現在の巻数が50以下ならドロップダウンで選択
        if (folderData.volume <= 50) {
            volDropdown.selection = folderData.volume - 1;
        }

        // ★★★ 手入力欄を追加 ★★★
        var manualGroup = volumeDialog.add("group");
        manualGroup.add("statictext", undefined, "または手入力:");
        var manualInput = manualGroup.add("edittext", undefined, "");
        manualInput.characters = 10;
        manualInput.helpTip = "51巻以上の場合はここに入力（全角数字も可）";
        // 現在の巻数が51以上なら手入力欄に表示
        if (folderData.volume > 50) {
            manualInput.text = String(folderData.volume);
        }

        // 手入力時にドロップダウンの選択を解除
        manualInput.onChanging = function() {
            if (manualInput.text !== "") {
                volDropdown.selection = null;
            }
        };
        // ドロップダウン選択時に手入力をクリア
        volDropdown.onChange = function() {
            if (volDropdown.selection !== null) {
                manualInput.text = "";
            }
        };

        var volBtnGroup = volumeDialog.add("group");
        volBtnGroup.alignment = "center";
        var volOkBtn = volBtnGroup.add("button", undefined, "OK");
        var volCancelBtn = volBtnGroup.add("button", undefined, "キャンセル");
        volOkBtn.onClick = function() {
            var newVol = null;
            // 手入力を優先
            if (manualInput.text !== "") {
                var parsed = normalizeVolumeInput(manualInput.text);
                if (parsed !== null) {
                    newVol = parsed;
                } else {
                    alert("有効な数値を入力してください。");
                    return;
                }
            } else if (volDropdown.selection) {
                newVol = volDropdown.selection.index + 1;
            } else {
                alert("巻数を選択または入力してください。");
                return;
            }
            folderVolumeList[idx].volume = newVol;
            updateFolderList();
            volumeDialog.close();
        };
        volCancelBtn.onClick = function() { volumeDialog.close(); };
        volumeDialog.show();
    };

    // ダブルクリックで巻数変更
    folderList.onDoubleClick = function() {
        changeVolumeButton.notify("onClick");
    };

    // ボタン
    var buttonGroup = dialog.add("group");
    buttonGroup.orientation = "row";
    buttonGroup.alignment = "center";
    var okButton = buttonGroup.add("button", undefined, "スキャン開始");
    var cancelButton = buttonGroup.add("button", undefined, "キャンセル");

    var result = null;

    okButton.onClick = function() {
        if (folderVolumeList.length === 0) {
            alert("少なくとも1つのフォルダを追加してください。");
            return;
        }
        result = { folderVolumeList: folderVolumeList };
        dialog.close();
    };

    cancelButton.onClick = function() {
        result = null;
        dialog.close();
    };

    dialog.show();
    return result;
}

function showNewWorkInfoDialog() {
    var dialog = new Window("dialog", "新規作成 - 作品情報入力");
    dialog.orientation = "column";
    dialog.alignChildren = ["fill", "top"];
    dialog.spacing = 10;
    dialog.margins = 20;

    dialog.add("statictext", undefined, "【作品情報を入力してください】");

    // レーベル選択
    var labelsByGenre = {
        "一般女性": ["Ropopo!", "コイパレ", "キスカラ", "カルコミ", "ウーコミ!", "シェノン"],
        "TL": ["TLオトメチカ", "LOVE FLICK", "乙女チック", "ウーコミkiss!", "シェノン+", "@夜噺"],
        "BL": ["NuPu", "spicomi", "MooiComics", "BLオトメチカ", "BOYS FAN"],
        "一般男性": ["DEDEDE", "GG-COMICS", "コミックREBEL"],
        "メンズ": ["カゲキヤコミック", "もえスタビースト", "@夜噺＋"],
        "タテコミ": ["GIGATOON"]
    };

    var labelGroup = dialog.add("group");
    labelGroup.orientation = "row";
    labelGroup.alignChildren = ["left", "center"];
    labelGroup.add("statictext", undefined, "レーベル: CLLENN /");
    var genreDropdown = labelGroup.add("dropdownlist");
    genreDropdown.preferredSize.width = 100;
    for (var genre in labelsByGenre) {
        if (labelsByGenre.hasOwnProperty(genre)) {
            genreDropdown.add("item", genre);
        }
    }
    genreDropdown.selection = 0;
    labelGroup.add("statictext", undefined, "/");
    var labelDropdown = labelGroup.add("dropdownlist");
    labelDropdown.preferredSize.width = 150;

    // ジャンル変更時にレーベルを更新
    function updateLabelDropdown() {
        labelDropdown.removeAll();
        if (genreDropdown.selection) {
            var genre = genreDropdown.selection.text;
            var labels = labelsByGenre[genre];
            if (labels) {
                for (var i = 0; i < labels.length; i++) {
                    labelDropdown.add("item", labels[i]);
                }
                if (labelDropdown.items.length > 0) {
                    labelDropdown.selection = 0;
                }
            }
        }
    }
    genreDropdown.onChange = updateLabelDropdown;
    updateLabelDropdown();

    // タイトル入力
    var titleGroup = dialog.add("group");
    titleGroup.orientation = "row";
    titleGroup.alignChildren = ["left", "center"];
    titleGroup.add("statictext", undefined, "タイトル:");
    var titleInput = titleGroup.add("edittext", undefined, "");
    titleInput.preferredSize.width = 300;

    // ★★★ フォルダ選択セクション（統合リスト）★★★
    dialog.add("statictext", undefined, "");
    dialog.add("statictext", undefined, "【PSDフォルダを選択】");

    // ★★★ 統合フォルダパネル ★★★
    var folderPanel = dialog.add("panel", undefined, "フォルダ一覧");
    folderPanel.orientation = "column";
    folderPanel.alignChildren = ["fill", "top"];
    folderPanel.margins = 10;

    // フォルダ追加ボタン群
    var addButtonGroup = folderPanel.add("group");
    addButtonGroup.orientation = "row";
    addButtonGroup.alignChildren = ["left", "center"];
    var autoDetectButton = addButtonGroup.add("button", undefined, "自動検出...");
    var manualAddButton = addButtonGroup.add("button", undefined, "個別追加...");
    var clearAllButton = addButtonGroup.add("button", undefined, "全てクリア");
    autoDetectButton.preferredSize.width = 100;
    manualAddButton.preferredSize.width = 100;
    clearAllButton.preferredSize.width = 100;

    // フォルダリスト（統合）
    folderPanel.add("statictext", undefined, "選択したフォルダ一覧（ダブルクリックで巻数変更）:");
    var folderList = folderPanel.add("listbox", undefined, [], {
        numberOfColumns: 3,
        showHeaders: true,
        columnTitles: ["フォルダ名", "巻数", "パス"],
        columnWidths: [180, 60, 180]
    });
    folderList.preferredSize = [440, 150];

    // ★★★ 選択したフォルダのパスを表示（横スクロール可能）★★★
    var folderPathText = folderPanel.add("edittext", undefined, "パス: （フォルダを選択してください）", {readonly: true});
    folderPathText.preferredSize = [440, 22];

    // 操作ボタン
    var folderButtonGroup = folderPanel.add("group");
    folderButtonGroup.orientation = "row";
    folderButtonGroup.alignment = "center";
    var removeFolderButton = folderButtonGroup.add("button", undefined, "選択を削除");
    var changeVolumeButton = folderButtonGroup.add("button", undefined, "巻数変更...");
    removeFolderButton.preferredSize.width = 100;
    changeVolumeButton.preferredSize.width = 100;

    // 選択されたフォルダとその巻数を保持する配列（統合）
    var folderVolumeList = []; // [{folder: Folder, volume: number}]

    // ★★★ 統合フォルダリスト更新関数 ★★★
    function updateFolderList() {
        folderList.removeAll();
        // 自然順ソートで並べ替え
        folderVolumeList.sort(function(a, b) {
            return naturalSortCompare(a.folder.name, b.folder.name);
        });
        for (var i = 0; i < folderVolumeList.length; i++) {
            // ★★★ フォルダ名もdecodeURIで文字化け防止 ★★★
            var folderName = decodeURI(folderVolumeList[i].folder.name);
            var item = folderList.add("item", folderName);
            item.subItems[0].text = folderVolumeList[i].volume + "巻";
            item.subItems[1].text = decodeURI(folderVolumeList[i].folder.fsName);
            item.folderData = folderVolumeList[i];
        }
    }

    // ★★★ フォルダ選択時にパスを表示 ★★★
    folderList.onChange = function() {
        if (folderList.selection && folderList.selection.folderData) {
            var fullPath = decodeURI(folderList.selection.folderData.folder.fsName);
            folderPathText.text = "パス: " + fullPath;
        } else {
            folderPathText.text = "パス: （フォルダを選択してください）";
        }
    };

    // ★★★ 自動検出ボタン ★★★
    autoDetectButton.onClick = function() {
        var folder = Folder.selectDialog("PSDファイルを含むフォルダを選択\n（サブフォルダも自動検索されます）");
        if (folder) {
            // フォルダを検出
            var targetFolders = determineTargetFolders(folder);
            if (targetFolders.length === 0) {
                alert("PSDファイルを含むフォルダが見つかりませんでした。");
                return;
            }
            // 自然順ソート
            targetFolders.sort(function(a, b) {
                return naturalSortCompare(a.name, b.name);
            });

            // 開始巻数を入力
            var startVolDialog = new Window("dialog", "開始巻数を選択");
            startVolDialog.orientation = "column";
            startVolDialog.alignChildren = ["fill", "top"];
            startVolDialog.margins = 15;
            startVolDialog.add("statictext", undefined, "検出フォルダ数: " + targetFolders.length);

            // ドロップダウン選択
            var volGroup = startVolDialog.add("group");
            volGroup.add("statictext", undefined, "開始巻数:");
            var volDropdown = volGroup.add("dropdownlist");
            for (var v = 1; v <= 50; v++) {
                volDropdown.add("item", v + "巻");
            }
            // 現在のリストの最大巻数+1をデフォルトに
            var nextVol = 1;
            if (folderVolumeList.length > 0) {
                var maxVol = 0;
                for (var mv = 0; mv < folderVolumeList.length; mv++) {
                    if (folderVolumeList[mv].volume > maxVol) {
                        maxVol = folderVolumeList[mv].volume;
                    }
                }
                nextVol = maxVol + 1;
            }
            if (nextVol > 50) nextVol = 50;
            volDropdown.selection = nextVol - 1;

            // ★★★ 手入力欄を追加 ★★★
            var manualGroup = startVolDialog.add("group");
            manualGroup.add("statictext", undefined, "または手入力:");
            var manualInput = manualGroup.add("edittext", undefined, "");
            manualInput.characters = 10;
            manualInput.helpTip = "51巻以上の場合はここに入力（全角数字も可）";

            // 手入力時にドロップダウンの選択を解除
            manualInput.onChanging = function() {
                if (manualInput.text !== "") {
                    volDropdown.selection = null;
                }
            };
            // ドロップダウン選択時に手入力をクリア
            volDropdown.onChange = function() {
                if (volDropdown.selection !== null) {
                    manualInput.text = "";
                }
            };

            var volBtnGroup = startVolDialog.add("group");
            volBtnGroup.alignment = "center";
            var volOkBtn = volBtnGroup.add("button", undefined, "追加");
            var volCancelBtn = volBtnGroup.add("button", undefined, "キャンセル");
            var startVol = null;
            volOkBtn.onClick = function() {
                // 手入力を優先
                if (manualInput.text !== "") {
                    var parsed = normalizeVolumeInput(manualInput.text);
                    if (parsed !== null) {
                        startVol = parsed;
                    } else {
                        alert("有効な数値を入力してください。");
                        return;
                    }
                } else if (volDropdown.selection) {
                    startVol = volDropdown.selection.index + 1;
                } else {
                    alert("巻数を選択または入力してください。");
                    return;
                }
                startVolDialog.close();
            };
            volCancelBtn.onClick = function() { startVolDialog.close(); };
            startVolDialog.show();

            if (startVol !== null) {
                // 検出したフォルダを追加（重複チェック）
                var addedCount = 0;
                for (var fi = 0; fi < targetFolders.length; fi++) {
                    var targetFolder = targetFolders[fi];
                    var isDuplicate = false;
                    for (var ei = 0; ei < folderVolumeList.length; ei++) {
                        if (folderVolumeList[ei].folder.fsName === targetFolder.fsName) {
                            isDuplicate = true;
                            break;
                        }
                    }
                    if (!isDuplicate) {
                        folderVolumeList.push({
                            folder: targetFolder,
                            volume: startVol + fi
                        });
                        addedCount++;
                    }
                }
                updateFolderList();
                if (addedCount > 0) {
                    alert(addedCount + "個のフォルダを追加しました。");
                } else {
                    alert("追加できるフォルダがありませんでした（既に登録済み）。");
                }
            }
        }
    };

    // ★★★ 個別追加ボタン ★★★
    manualAddButton.onClick = function() {
        var folder = Folder.selectDialog("PSDファイルを含むフォルダを選択");
        if (folder) {
            // 既に追加済みかチェック
            for (var i = 0; i < folderVolumeList.length; i++) {
                if (folderVolumeList[i].folder.fsName === folder.fsName) {
                    alert("このフォルダは既に追加されています。");
                    return;
                }
            }
            // 巻数入力ダイアログ
            var volumeDialog = new Window("dialog", "巻数を入力");
            volumeDialog.orientation = "column";
            volumeDialog.alignChildren = ["fill", "top"];
            volumeDialog.margins = 15;
            volumeDialog.add("statictext", undefined, "フォルダ: " + folder.name);

            // ドロップダウン選択
            var volGroup = volumeDialog.add("group");
            volGroup.add("statictext", undefined, "巻数:");
            var volDropdown = volGroup.add("dropdownlist");
            for (var v = 1; v <= 50; v++) {
                volDropdown.add("item", v + "巻");
            }
            // 次の巻数をデフォルトに
            var nextVol = 1;
            if (folderVolumeList.length > 0) {
                var maxVol = 0;
                for (var mv = 0; mv < folderVolumeList.length; mv++) {
                    if (folderVolumeList[mv].volume > maxVol) {
                        maxVol = folderVolumeList[mv].volume;
                    }
                }
                nextVol = maxVol + 1;
            }
            if (nextVol > 50) nextVol = 50;
            volDropdown.selection = nextVol - 1;

            // ★★★ 手入力欄を追加 ★★★
            var manualGroup = volumeDialog.add("group");
            manualGroup.add("statictext", undefined, "または手入力:");
            var manualInput = manualGroup.add("edittext", undefined, "");
            manualInput.characters = 10;
            manualInput.helpTip = "51巻以上の場合はここに入力（全角数字も可）";

            // 手入力時にドロップダウンの選択を解除
            manualInput.onChanging = function() {
                if (manualInput.text !== "") {
                    volDropdown.selection = null;
                }
            };
            // ドロップダウン選択時に手入力をクリア
            volDropdown.onChange = function() {
                if (volDropdown.selection !== null) {
                    manualInput.text = "";
                }
            };

            var volBtnGroup = volumeDialog.add("group");
            volBtnGroup.alignment = "center";
            var volOkBtn = volBtnGroup.add("button", undefined, "OK");
            var volCancelBtn = volBtnGroup.add("button", undefined, "キャンセル");
            var selectedVol = null;
            volOkBtn.onClick = function() {
                // 手入力を優先
                if (manualInput.text !== "") {
                    var parsed = normalizeVolumeInput(manualInput.text);
                    if (parsed !== null) {
                        selectedVol = parsed;
                    } else {
                        alert("有効な数値を入力してください。");
                        return;
                    }
                } else if (volDropdown.selection) {
                    selectedVol = volDropdown.selection.index + 1;
                } else {
                    alert("巻数を選択または入力してください。");
                    return;
                }
                volumeDialog.close();
            };
            volCancelBtn.onClick = function() { volumeDialog.close(); };
            volumeDialog.show();
            if (selectedVol !== null) {
                folderVolumeList.push({folder: folder, volume: selectedVol});
                updateFolderList();
            }
        }
    };

    // ★★★ 全てクリアボタン ★★★
    clearAllButton.onClick = function() {
        if (folderVolumeList.length === 0) {
            alert("フォルダが登録されていません。");
            return;
        }
        if (confirm("全てのフォルダをクリアしますか？")) {
            folderVolumeList = [];
            updateFolderList();
        }
    };

    // ★★★ 削除ボタン ★★★
    removeFolderButton.onClick = function() {
        if (folderList.selection) {
            var idx = folderList.selection.index;
            folderVolumeList.splice(idx, 1);
            updateFolderList();
        } else {
            alert("削除するフォルダを選択してください。");
        }
    };

    // ★★★ 巻数変更ボタン ★★★
    changeVolumeButton.onClick = function() {
        if (folderList.selection) {
            var idx = folderList.selection.index;
            var folderData = folderVolumeList[idx];
            var volumeDialog = new Window("dialog", "巻数を変更");
            volumeDialog.orientation = "column";
            volumeDialog.alignChildren = ["fill", "top"];
            volumeDialog.margins = 15;
            volumeDialog.add("statictext", undefined, "フォルダ: " + folderData.folder.name);

            // ドロップダウン選択
            var volGroup = volumeDialog.add("group");
            volGroup.add("statictext", undefined, "巻数:");
            var volDropdown = volGroup.add("dropdownlist");
            for (var v = 1; v <= 50; v++) {
                volDropdown.add("item", v + "巻");
            }
            // 現在の巻数が50以下ならドロップダウンで選択、51以上なら手入力欄に表示
            if (folderData.volume <= 50) {
                volDropdown.selection = folderData.volume - 1;
            }

            // ★★★ 手入力欄を追加 ★★★
            var manualGroup = volumeDialog.add("group");
            manualGroup.add("statictext", undefined, "または手入力:");
            var manualInput = manualGroup.add("edittext", undefined, "");
            manualInput.characters = 10;
            manualInput.helpTip = "51巻以上の場合はここに入力（全角数字も可）";
            // 現在の巻数が51以上なら手入力欄に表示
            if (folderData.volume > 50) {
                manualInput.text = String(folderData.volume);
            }

            // 手入力時にドロップダウンの選択を解除
            manualInput.onChanging = function() {
                if (manualInput.text !== "") {
                    volDropdown.selection = null;
                }
            };
            // ドロップダウン選択時に手入力をクリア
            volDropdown.onChange = function() {
                if (volDropdown.selection !== null) {
                    manualInput.text = "";
                }
            };

            var volBtnGroup = volumeDialog.add("group");
            volBtnGroup.alignment = "center";
            var volOkBtn = volBtnGroup.add("button", undefined, "OK");
            var volCancelBtn = volBtnGroup.add("button", undefined, "キャンセル");
            volOkBtn.onClick = function() {
                var newVol = null;
                // 手入力を優先
                if (manualInput.text !== "") {
                    var parsed = normalizeVolumeInput(manualInput.text);
                    if (parsed !== null) {
                        newVol = parsed;
                    } else {
                        alert("有効な数値を入力してください。");
                        return;
                    }
                } else if (volDropdown.selection) {
                    newVol = volDropdown.selection.index + 1;
                } else {
                    alert("巻数を選択または入力してください。");
                    return;
                }
                folderVolumeList[idx].volume = newVol;
                updateFolderList();
                volumeDialog.close();
            };
            volCancelBtn.onClick = function() { volumeDialog.close(); };
            volumeDialog.show();
        } else {
            alert("巻数を変更するフォルダを選択してください。");
        }
    };

    // ダブルクリックで巻数変更
    folderList.onDoubleClick = function() {
        changeVolumeButton.notify("onClick");
    };

    // ボタン
    var buttonGroup = dialog.add("group");
    buttonGroup.orientation = "row";
    buttonGroup.alignment = "center";
    var okButton = buttonGroup.add("button", undefined, "スキャン開始");
    var cancelButton = buttonGroup.add("button", undefined, "キャンセル");

    var result = null;
    var isProcessing = false; // ★★★ ダブルクリック防止フラグ ★★★

    okButton.onClick = function() {
        // ★★★ ダブルクリック防止 ★★★
        if (isProcessing) return;

        // 入力チェック
        if (!titleInput.text || titleInput.text === "") {
            alert("タイトルを入力してください。");
            return;
        }

        // ★★★ ファイル名に使用できない文字のチェックと自動変換 ★★★
        var invalidChars = ['\\', '/', ':', '*', '?', '"', '<', '>', '|'];
        var invalidCharsFullWidth = ['￥', '／', '：', '＊', '？', '"', '＜', '＞', '｜'];
        var foundInvalidChars = [];
        var convertedTitle = titleInput.text;

        for (var ic = 0; ic < invalidChars.length; ic++) {
            if (convertedTitle.indexOf(invalidChars[ic]) !== -1) {
                foundInvalidChars.push("【" + invalidChars[ic] + "】→【" + invalidCharsFullWidth[ic] + "】");
                // 該当文字を全て置換
                while (convertedTitle.indexOf(invalidChars[ic]) !== -1) {
                    convertedTitle = convertedTitle.replace(invalidChars[ic], invalidCharsFullWidth[ic]);
                }
            }
        }

        if (foundInvalidChars.length > 0) {
            titleInput.text = convertedTitle;
            alert("タイトルにファイル名使用不可の文字が含まれています。\n" +
                  "以下の文字が自動で置き換えられますのでご確認ください。\n\n" +
                  foundInvalidChars.join("\n") + "\n\n" +
                  "変換後: " + convertedTitle);
        }

        if (folderVolumeList.length === 0) {
            alert("少なくとも1つのフォルダを追加してください。");
            return;
        }

        var genre = genreDropdown.selection ? genreDropdown.selection.text : "";
        var label = labelDropdown.selection ? labelDropdown.selection.text : "";

        // ★★★ 処理開始 - ボタン無効化 ★★★
        isProcessing = true;
        okButton.enabled = false;

        // 最小巻数を開始巻数とする
        var minVolume = folderVolumeList[0].volume;
        for (var minV = 1; minV < folderVolumeList.length; minV++) {
            if (folderVolumeList[minV].volume < minVolume) {
                minVolume = folderVolumeList[minV].volume;
            }
        }

        result = {
            workInfo: {
                genre: genre,
                label: label,
                title: titleInput.text,
                volume: minVolume,
                authorType: "single",
                author: "",
                artist: "",
                original: "",
                subtitle: "",
                editor: "",
                completedPath: "",
                typesettingPath: "",
                coverPath: ""
            },
            folderVolumeList: folderVolumeList,
            folderCount: folderVolumeList.length,
            selectionMode: "manual" // 統合リストは常にmanualモードとして処理
        };
        dialog.close();
    };

    cancelButton.onClick = function() {
        result = null;
        dialog.close();
    };

    dialog.show();
    return result;
}

// モード選択ダイアログ
function showModeSelectionDialog() {
    var dialog = new Window("dialog", "モードを選択");
    dialog.orientation = "column";
    dialog.alignChildren = "center";
    dialog.spacing = 10;
    dialog.margins = 20;

    dialog.add("statictext", undefined, "実行するモードを選択してください。");

    var btnGroup = dialog.add("group");
    btnGroup.orientation = "row";
    btnGroup.spacing = 10;

    var newBtn = btnGroup.add("button", undefined, "新規作成");
    var editBtn = btnGroup.add("button", undefined, "JSON編集");
    var cancelBtn = btnGroup.add("button", undefined, "キャンセル");

    newBtn.preferredSize.width = 100;
    editBtn.preferredSize.width = 100;

    var mode = null;
    var isClicked = false; // ★★★ ダブルクリック防止 ★★★

    newBtn.onClick = function() {
        if (isClicked) return;
        isClicked = true;
        newBtn.enabled = false;
        editBtn.enabled = false;
        mode = "new";
        dialog.close();
    };

    editBtn.onClick = function() {
        if (isClicked) return;
        isClicked = true;
        newBtn.enabled = false;
        editBtn.enabled = false;
        mode = "edit";
        dialog.close();
    };

    cancelBtn.onClick = function() {
        if (isClicked) return;
        isClicked = true;
        mode = null;
        dialog.close();
    };

    dialog.center();
    dialog.show();

    return mode;
}

// main関数
function main() {
    var existingDocs = [];
    for (var i = 0; i < app.documents.length; i++) {
        existingDocs.push(app.documents[i]);
    }

    var mode = showModeSelectionDialog();

    if (mode === "new") {
        // ★★★ 新規作成：作品情報入力ダイアログを表示 ★★★
        var newWorkResult = showNewWorkInfoDialog();
        if (!newWorkResult) return;

        var inputWorkInfo = newWorkResult.workInfo;
        var result = null;

        if (newWorkResult.selectionMode === "manual" && newWorkResult.folderVolumeList) {
            // ★★★ 個別選択モード：複数フォルダを個別に処理 ★★★
            result = processFoldersWithVolumes(newWorkResult.folderVolumeList, existingDocs);
        } else {
            // ★★★ 自動検出モード：従来の処理 ★★★
            var folder = newWorkResult.folder;
            result = processFolder(folder, existingDocs);
        }

        if (result.success && result.scanData) {
            // ★★★ 入力された作品情報をscanDataに設定 ★★★
            result.scanData.workInfo = inputWorkInfo;
            // ★★★ 開始巻数を明示的に保存 ★★★
            result.scanData.startVolume = inputWorkInfo.volume || 1;
            // ★★★ 個別選択モードの場合、フォルダ-巻数マッピングを保存 ★★★
            if (newWorkResult.selectionMode === "manual" && newWorkResult.folderVolumeList) {
                result.scanData.folderVolumeMapping = {};
                for (var fvi = 0; fvi < newWorkResult.folderVolumeList.length; fvi++) {
                    var fv = newWorkResult.folderVolumeList[fvi];
                    result.scanData.folderVolumeMapping[fv.folder.name] = fv.volume;
                }
            }
            // ★★★ 自動保存：スキャン完了後に自動でデータを保存 ★★★
            var autoSaveLabel = inputWorkInfo.label || "";
            var autoSaveTitle = inputWorkInfo.title || "";
            if (autoSaveLabel && autoSaveTitle) {
                var savedPath = saveScanDataWithInfo(result.scanData, autoSaveLabel, autoSaveTitle, inputWorkInfo.volume);
                if (savedPath) {
                    result.scanData.lastSavedPath = savedPath;
                }
            }
            // ★★★ セーブデータをダイアログに渡す ★★★
            showPresetManagerDialog(true, result.scanData, null);
        } else if (result.success) {
            alert("PSDファイルが読み込まれませんでした。\nスクリプトを終了します。");
        }

    } else if (mode === "edit") {
        // ★★★ JSON編集モード：JSONファイルを選択し、対応scandataを自動読み込み ★★★
        var jsonFile = showJsonFileSelector("編集するJSONプリセットファイルを選択");
        if (!jsonFile) return;

        // ★★★ 新規作成が選択された場合 → 作品情報入力から開始 ★★★
        if (typeof jsonFile === "string" && jsonFile === "NEW") {
            var newWorkResult = showNewWorkInfoDialog();
            if (!newWorkResult) return;

            var inputWorkInfo = newWorkResult.workInfo;
            var result = null;

            if (newWorkResult.selectionMode === "manual" && newWorkResult.folderVolumeList) {
                // ★★★ 個別選択モード：複数フォルダを個別に処理 ★★★
                result = processFoldersWithVolumes(newWorkResult.folderVolumeList, existingDocs);
            } else {
                // ★★★ 自動検出モード：従来の処理 ★★★
                var folder = newWorkResult.folder;
                result = processFolder(folder, existingDocs);
            }

            if (result.success && result.scanData) {
                // ★★★ 入力された作品情報をscanDataに設定 ★★★
                result.scanData.workInfo = inputWorkInfo;
                // ★★★ 開始巻数を明示的に保存 ★★★
                result.scanData.startVolume = inputWorkInfo.volume || 1;
                // ★★★ 個別選択モードの場合、フォルダ-巻数マッピングを保存 ★★★
                if (newWorkResult.selectionMode === "manual" && newWorkResult.folderVolumeList) {
                    result.scanData.folderVolumeMapping = {};
                    for (var fvi = 0; fvi < newWorkResult.folderVolumeList.length; fvi++) {
                        var fv = newWorkResult.folderVolumeList[fvi];
                        result.scanData.folderVolumeMapping[fv.folder.name] = fv.volume;
                    }
                }
                // ★★★ 自動保存：スキャン完了後に自動でデータを保存 ★★★
                var autoSaveLabel = inputWorkInfo.label || "";
                var autoSaveTitle = inputWorkInfo.title || "";
                if (autoSaveLabel && autoSaveTitle) {
                    var savedPath = saveScanDataWithInfo(result.scanData, autoSaveLabel, autoSaveTitle, inputWorkInfo.volume);
                    if (savedPath) {
                        result.scanData.lastSavedPath = savedPath;
                    }
                }
                // ★★★ セーブデータをダイアログに渡す ★★★
                showPresetManagerDialog(true, result.scanData, null);
            } else if (result.success) {
                alert("PSDファイルが読み込まれませんでした。\nスクリプトを終了します。");
            }
            return;
        }

        var loadedScanData = null;

        // ★★★ JSONファイルを読み込んでworkInfoを取得 ★★★
        try {
            jsonFile.encoding = "UTF-8";
            jsonFile.open("r");
            var jsonContent = jsonFile.read();
            jsonFile.close();

            var parsedJsonData = JSON.parse(jsonContent);
            var jsonData = parsedJsonData.presetData || {};

            // ★★★ workInfoがあれば対応するscandataを検索 ★★★
            if (jsonData.workInfo && jsonData.workInfo.title && jsonData.workInfo.label) {
                var safeLabel = sanitizeFileName(jsonData.workInfo.label);
                var safeTitle = sanitizeFileName(jsonData.workInfo.title);
                var scandataPath = SAVE_DATA_BASE_PATH + "/" + safeLabel + "/" + safeTitle + "_scandata.json";
                var scandataFile = new File(scandataPath);

                if (scandataFile.exists) {
                    // 対応するscandataが見つかった - 自動読み込み
                    loadedScanData = loadScandataFile(scandataFile);
                    if (loadedScanData) {
                        alert("対応するscandataを自動読み込みしました。\n\nタイトル: " + jsonData.workInfo.title + "\nレーベル: " + jsonData.workInfo.label);
                    }
                }
            }
        } catch (e) {
            // JSONの読み込みに失敗した場合はscandataなしで続行
        }

        // ★★★ セーブデータをダイアログに渡す ★★★
        showPresetManagerDialog(false, loadedScanData, jsonFile);

    } else if (mode === "scandata") {
        // ★★★ scandata上書きモード：既存scandataを選択して編集 ★★★
        var scandataFile = showScandataFileSelector();
        if (!scandataFile) return;

        // scandataを読み込み
        var loadedScanData = loadScandataFile(scandataFile);
        if (!loadedScanData) {
            alert("scandataの読み込みに失敗しました。");
            return;
        }

        // ★★★ デバッグ：読み込んだデータの確認（scandata形式/JSON形式両方） ★★★
        var debugInfo = "【saveデータ読み込み確認】\n\n";
        // scandata形式
        debugInfo += "【scandata形式】\n";
        debugInfo += "fonts: " + (loadedScanData.fonts ? loadedScanData.fonts.length + "件" : "なし") + "\n";
        debugInfo += "guideSets: " + (loadedScanData.guideSets ? loadedScanData.guideSets.length + "件" : "なし") + "\n";
        debugInfo += "sizeStats: " + (loadedScanData.sizeStats ? "あり" : "なし") + "\n";
        debugInfo += "strokeStats: " + (loadedScanData.strokeStats ? "あり" : "なし") + "\n";
        // JSON形式
        debugInfo += "\n【JSON形式】\n";
        // presetsのセット数をカウント（Object.keysが使えないため手動）
        var presetCount = 0;
        if (loadedScanData.presets) {
            for (var pkey in loadedScanData.presets) {
                if (loadedScanData.presets.hasOwnProperty(pkey)) presetCount++;
            }
        }
        debugInfo += "presets: " + (presetCount > 0 ? presetCount + "セット" : "なし") + "\n";
        debugInfo += "guides: " + (loadedScanData.guides ? "あり" : "なし") + "\n";
        debugInfo += "fontSizeStats: " + (loadedScanData.fontSizeStats ? "あり" : "なし") + "\n";
        debugInfo += "strokeSizes: " + (loadedScanData.strokeSizes ? loadedScanData.strokeSizes.length + "件" : "なし") + "\n";
        debugInfo += "workInfo: " + (loadedScanData.workInfo && loadedScanData.workInfo.title ? loadedScanData.workInfo.title : "なし") + "\n";
        alert(debugInfo);

        // scannedFoldersを初期化（旧形式対応）
        if (!loadedScanData.scannedFolders) {
            loadedScanData.scannedFolders = {};
            // 旧形式のfolderPathがあれば移行
            if (loadedScanData.folderPath) {
                loadedScanData.scannedFolders[loadedScanData.folderPath] = {
                    files: loadedScanData.scannedFiles || [],
                    scanDate: loadedScanData.timestamp || new Date().toString()
                };
            }
        }

        // ★★★ 対応するJSONファイルを検索 ★★★
        var correspondingJsonFile = null;
        if (loadedScanData.workInfo && loadedScanData.workInfo.title) {
            var jsonFolder = getJsonFolder();
            if (jsonFolder) {
                // タイトルとレーベルを元にJSONファイルを検索
                var searchTitle = loadedScanData.workInfo.title;
                var searchLabel = loadedScanData.workInfo.label || "";

                // サブフォルダも含めて検索
                function findJsonByTitle(folder, title, label) {
                    var jsonFiles = folder.getFiles("*.json");
                    for (var i = 0; i < jsonFiles.length; i++) {
                        var fileName = decodeURI(jsonFiles[i].name);
                        // ファイル名にタイトルが含まれているかチェック
                        if (fileName.indexOf(title) >= 0) {
                            return jsonFiles[i];
                        }
                    }
                    // サブフォルダを検索（レーベル名のフォルダを優先）
                    var subFolders = folder.getFiles(function(f) { return f instanceof Folder; });
                    // レーベルフォルダを優先
                    if (label) {
                        for (var j = 0; j < subFolders.length; j++) {
                            if (decodeURI(subFolders[j].name).indexOf(label) >= 0) {
                                var found = findJsonByTitle(subFolders[j], title, "");
                                if (found) return found;
                            }
                        }
                    }
                    // その他のフォルダも検索
                    for (var k = 0; k < subFolders.length; k++) {
                        var found = findJsonByTitle(subFolders[k], title, "");
                        if (found) return found;
                    }
                    return null;
                }

                correspondingJsonFile = findJsonByTitle(jsonFolder, searchTitle, searchLabel);
            }
        }

        // 対応するJSONが見つかった場合、読み込むか確認
        var loadJsonFile = null;
        if (correspondingJsonFile) {
            var loadJson = confirm("対応するJSONファイルが見つかりました。\n\nファイル名: " + decodeURI(correspondingJsonFile.name) + "\n\n一緒に読み込みますか？\n\n[OK] → JSONのプリセットも読み込む\n[キャンセル] → scandataのみ読み込む");
            if (loadJson) {
                loadJsonFile = correspondingJsonFile;
            }
        }

        // フォルダ追加するか確認
        var addFolder = confirm("scandataを読み込みました。\n\n新しいフォルダを追加スキャンしますか？\n\n[OK] → フォルダを選択して追記\n[キャンセル] → そのまま編集画面へ");

        if (addFolder) {
            var newFolder = Folder.selectDialog("追加スキャンするフォルダを選択");
            if (newFolder) {
                // フォルダ内のPSD配置を確認して対象フォルダを決定
                var targetFolders = determineTargetFolders(newFolder);

                if (targetFolders.length === 0) {
                    alert("選択したフォルダにPSDファイルが見つかりませんでした。");
                } else {
                    // 各フォルダをスキャンして追記
                    var addedCount = 0;
                    var skippedFolders = [];

                    for (var i = 0; i < targetFolders.length; i++) {
                        var tf = targetFolders[i];

                        // 既にスキャン済みのフォルダはスキップ
                        if (loadedScanData.scannedFolders[tf.fsName]) {
                            skippedFolders.push(tf.name);
                            continue;
                        }

                        // フォルダをスキャンして結果をマージ
                        var scanResult = scanFolderForMerge(tf, existingDocs);
                        if (scanResult) {
                            mergeScanResult(loadedScanData, scanResult, tf.fsName);
                            addedCount++;
                        }
                    }

                    // 結果を保存
                    saveScandataToFile(loadedScanData);

                    var resultMsg = "スキャン追記完了\n\n";
                    resultMsg += "追加フォルダ数: " + addedCount + "\n";
                    if (skippedFolders.length > 0) {
                        resultMsg += "スキップ（スキャン済み）: " + skippedFolders.length + "\n";
                        resultMsg += "  " + skippedFolders.join(", ");
                    }
                    alert(resultMsg);
                }
            }
        }

        // ★★★ セーブデータをダイアログに渡す（対応JSONがあれば一緒に）★★★
        showPresetManagerDialog(false, loadedScanData, loadJsonFile);

    } else {
        return;
    }
}

/**
 * ★★★ scandataファイル選択ダイアログ ★★★
 * 保存先ベースパスから開始（存在しない場合は任意の場所から）
 */
function showScandataFileSelector() {
    // ★★★ UIファイルセレクタでscandataを選択 ★★★
    var rootFolder = new Folder(SAVE_DATA_BASE_PATH);
    if (!rootFolder.exists) {
        alert("scandataフォルダが見つかりません：\n" + SAVE_DATA_BASE_PATH);
        return null;
    }

    var currentFolder = rootFolder;

    // ダイアログ作成
    var dialog = new Window("dialog", "scandataファイルを選択");
    dialog.orientation = "column";
    dialog.alignChildren = ["fill", "top"];
    dialog.spacing = 10;
    dialog.margins = 15;

    // 現在のフォルダパス（内部管理用）
    var folderPathText = { text: "" };

    // ★★★ 現在のサブフォルダ名を表示 ★★★
    var folderNameGroup = dialog.add("group");
    folderNameGroup.orientation = "row";
    folderNameGroup.alignChildren = ["left", "center"];
    folderNameGroup.add("statictext", undefined, "現在のフォルダ:");
    var currentFolderLabel = folderNameGroup.add("statictext", undefined, "（ルート）");
    currentFolderLabel.preferredSize.width = 400;

    // ナビゲーションボタン
    var navGroup = dialog.add("group");
    navGroup.orientation = "row";
    navGroup.alignChildren = ["left", "center"];
    var upButton = navGroup.add("button", undefined, "↑ 上の階層へ");
    var rootButton = navGroup.add("button", undefined, "ルートへ戻る");
    var refreshButton = navGroup.add("button", undefined, "更新");
    upButton.preferredSize.width = 120;
    rootButton.preferredSize.width = 120;
    refreshButton.preferredSize.width = 80;

    // 検索ボックス
    var searchGroup = dialog.add("group");
    searchGroup.orientation = "row";
    searchGroup.alignChildren = ["left", "center"];
    searchGroup.add("statictext", undefined, "検索:");
    var searchInput = searchGroup.add("edittext", undefined, "");
    searchInput.preferredSize.width = 350;
    var searchButton = searchGroup.add("button", undefined, "検索");
    var clearButton = searchGroup.add("button", undefined, "クリア");
    searchButton.preferredSize.width = 60;
    clearButton.preferredSize.width = 60;

    // ファイル・フォルダリスト
    dialog.add("statictext", undefined, "scandataファイル一覧:（フォルダは [フォルダ名] で表示）");
    var fileList = dialog.add("listbox", undefined, [], {multiselect: false});
    fileList.preferredSize = [500, 280];

    // ボタングループ
    var buttonGroup = dialog.add("group");
    buttonGroup.orientation = "row";
    buttonGroup.alignment = "center";
    buttonGroup.spacing = 10;

    var newButton = buttonGroup.add("button", undefined, "新規作成");
    var selectButton = buttonGroup.add("button", undefined, "選択");
    var cancelButton = buttonGroup.add("button", undefined, "キャンセル");

    newButton.preferredSize.width = 80;
    selectButton.preferredSize.width = 80;
    cancelButton.preferredSize.width = 80;

    var selectedFile = null;

    // 再帰的にscandataファイルを検索
    function searchFilesRecursively(folder, keyword, results) {
        var rootPath = decodeURI(rootFolder.fsName);

        // scandata.jsonファイルを検索（_scandataを含むファイル）
        var jsonFiles = folder.getFiles("*.json");
        for (var i = 0; i < jsonFiles.length; i++) {
            var fileName = decodeURI(jsonFiles[i].name);
            // scandataファイルのみ表示（_scandata.jsonを含む、または検索キーワードに一致）
            if (fileName.toLowerCase().indexOf(keyword.toLowerCase()) >= 0) {
                var filePath = decodeURI(jsonFiles[i].parent.fsName);
                var relativePath = filePath.replace(rootPath, "");
                if (relativePath === "") relativePath = "/";

                results.push({
                    name: fileName,
                    displayName: fileName + "  [" + relativePath + "]",
                    isFolder: false,
                    obj: jsonFiles[i]
                });
            }
        }

        // サブフォルダを再帰的に検索
        var subFolders = folder.getFiles(function(f) { return f instanceof Folder; });
        for (var i = 0; i < subFolders.length; i++) {
            searchFilesRecursively(subFolders[i], keyword, results);
        }
    }

    // フォルダ内容を更新
    function updateFileList(searchKeyword) {
        fileList.removeAll();

        var items = [];

        // 検索キーワードがある場合は全フォルダから検索
        if (searchKeyword && searchKeyword.replace(/^\s+|\s+$/g, "") !== "") {
            folderPathText.text = "【検索モード】全フォルダから「" + searchKeyword + "」を検索中...";
            currentFolderLabel.text = "【検索結果】「" + searchKeyword + "」";
            upButton.enabled = false;
            rootButton.enabled = false;

            searchFilesRecursively(rootFolder, searchKeyword, items);

            if (items.length === 0) {
                folderPathText.text = "【検索モード】「" + searchKeyword + "」に一致するファイルは見つかりませんでした";
                currentFolderLabel.text = "【検索結果】該当なし";
            } else {
                folderPathText.text = "【検索モード】「" + searchKeyword + "」の検索結果: " + items.length + " 件";
                currentFolderLabel.text = "【検索結果】" + items.length + "件";
            }
        } else {
            // 通常モード：現在のフォルダを表示
            try {
                folderPathText.text = decodeURI(currentFolder.fsName);
            } catch (e) {
                folderPathText.text = currentFolder.fsName;
            }
            var isRoot = (currentFolder.fsName === rootFolder.fsName);
            upButton.enabled = !isRoot;
            rootButton.enabled = !isRoot;

            // ★★★ サブフォルダ名をラベルに表示 ★★★
            if (isRoot) {
                currentFolderLabel.text = "（ルート）";
            } else {
                var rootPath = "";
                var currentPath = "";
                try {
                    rootPath = decodeURI(rootFolder.fsName);
                    currentPath = decodeURI(currentFolder.fsName);
                } catch (e) {
                    rootPath = rootFolder.fsName;
                    currentPath = currentFolder.fsName;
                }
                var relativePath = currentPath.replace(rootPath, "").replace(/^[\\\/]/, "");
                currentFolderLabel.text = relativePath || currentFolder.name;
            }

            // サブフォルダを取得
            var subFolders = currentFolder.getFiles(function(f) { return f instanceof Folder; });
            for (var i = 0; i < subFolders.length; i++) {
                var folderName = subFolders[i].name;
                try { folderName = decodeURI(folderName); } catch (e) {}
                items.push({
                    name: folderName,
                    displayName: "[" + folderName + "]",
                    isFolder: true,
                    obj: subFolders[i]
                });
            }

            // JSONファイルを取得（scandataファイルのみ）
            var jsonFiles = currentFolder.getFiles("*.json");
            for (var i = 0; i < jsonFiles.length; i++) {
                var fileName = jsonFiles[i].name;
                try { fileName = decodeURI(fileName); } catch (e) {}
                items.push({
                    name: fileName,
                    displayName: fileName,
                    isFolder: false,
                    obj: jsonFiles[i]
                });
            }
        }

        // リストに追加
        for (var i = 0; i < items.length; i++) {
            var item = fileList.add("item", items[i].displayName);
            item.itemData = items[i];
        }
    }

    // 上の階層へ
    upButton.onClick = function() {
        if (currentFolder.parent && currentFolder.fsName !== rootFolder.fsName) {
            // ルートフォルダより上には行かない
            if (currentFolder.parent.fsName.indexOf(rootFolder.fsName) === 0 ||
                rootFolder.fsName.indexOf(currentFolder.parent.fsName) === 0) {
                currentFolder = currentFolder.parent;
                searchInput.text = "";
                updateFileList();
            }
        }
    };

    // ルートへ戻る
    rootButton.onClick = function() {
        currentFolder = rootFolder;
        searchInput.text = "";
        updateFileList();
    };

    // 検索実行
    searchButton.onClick = function() {
        updateFileList(searchInput.text);
    };

    // 検索クリア
    clearButton.onClick = function() {
        searchInput.text = "";
        updateFileList();
    };

    // Enterキーで検索
    searchInput.onEnterKey = function() {
        updateFileList(searchInput.text);
    };

    // リスト項目ダブルクリック
    fileList.onDoubleClick = function() {
        if (this.selection && this.selection.itemData) {
            var itemData = this.selection.itemData;
            if (itemData.isFolder) {
                currentFolder = itemData.obj;
                searchInput.text = "";
                updateFileList();
            } else {
                selectedFile = itemData.obj;
                dialog.close(1);
            }
        }
    };

    // 更新ボタン
    refreshButton.onClick = function() {
        updateFileList(searchInput.text);
    };

    // 新規作成ボタン
    newButton.onClick = function() {
        // 新規作成フラグを設定してダイアログを閉じる
        selectedFile = "NEW";
        dialog.close(1);
    };

    // 選択ボタン
    selectButton.onClick = function() {
        if (fileList.selection && fileList.selection.itemData) {
            var itemData = fileList.selection.itemData;
            if (itemData.isFolder) {
                currentFolder = itemData.obj;
                searchInput.text = "";
                updateFileList();
            } else {
                selectedFile = itemData.obj;
                dialog.close(1);
            }
        } else {
            alert("ファイルを選択してください。");
        }
    };

    // キャンセルボタン
    cancelButton.onClick = function() {
        dialog.close(0);
    };

    // 初期表示
    updateFileList();

    // ダイアログ表示
    if (dialog.show() === 1 && selectedFile) {
        return selectedFile;
    }
    return null;
}

/**
 * ★★★ scandataファイルを読み込む ★★★
 */
function loadScandataFile(file) {
    if (!file || !file.exists) return null;

    try {
        file.encoding = "UTF-8";
        file.open("r");
        var content = file.read();
        file.close();

        var data = JSON.parse(content);

        // scandataまたはJSONエクスポート形式の必須フィールドチェック
        // scandata形式: folderPath または sourceFolderPath
        // JSONエクスポート形式: presets
        var isScandataFormat = data.folderPath || data.sourceFolderPath || data.scannedFolders || data.detectedFonts;
        var isJsonExportFormat = data.presets || data.workInfo;

        if (!isScandataFormat && !isJsonExportFormat) {
            alert("選択したファイルは有効な形式ではありません。");
            return null;
        }

        // saveDataPathを現在のファイルパスで更新（上書き時に使用）
        data.saveDataPath = file.fsName;

        return data;
    } catch (e) {
        alert("scandataファイルの読み込みエラー:\n" + e.message);
        return null;
    }
}

/**
 * ★★★ 対象フォルダを決定する ★★★
 * - 選択フォルダ直下にPSDがある → そのフォルダが対象
 * - 選択フォルダ直下にPSDがなくサブフォルダがある → サブフォルダが対象
 */
function determineTargetFolders(folder) {
    var targetFolders = [];

    // 直下のファイルとフォルダを取得
    var items = folder.getFiles("*");
    var hasPSD = false;
    var subFolders = [];

    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        if (item instanceof File) {
            var itemName = item.name.toLowerCase();
            if (itemName.match(/\.(psd|psb)$/)) {
                hasPSD = true;
            }
        } else if (item instanceof Folder) {
            // _で始まるフォルダや隠しフォルダは除外
            if (item.name.charAt(0) !== "_" && item.name.charAt(0) !== ".") {
                subFolders.push(item);
            }
        }
    }

    if (hasPSD) {
        // 直下にPSDがある場合、このフォルダが対象
        targetFolders.push(folder);
    } else if (subFolders.length > 0) {
        // ★★★ サブフォルダを自然順ソート（1, 2, 3, 10, 11の順）★★★
        subFolders.sort(function(a, b) {
            return naturalSortCompare(a.name, b.name);
        });

        // サブフォルダがある場合、各サブフォルダを確認
        for (var j = 0; j < subFolders.length; j++) {
            var subFolder = subFolders[j];
            // サブフォルダ内にPSDがあるか確認
            var subPsdFiles = findPSDFilesInFolder(subFolder);
            if (subPsdFiles.length > 0) {
                targetFolders.push(subFolder);
            }
        }
    }

    return targetFolders;
}

/**
 * ★★★ フォルダ内のPSDファイルを検索（再帰なし、直下のみ）★★★
 */
function findPSDFilesInFolder(folder) {
    var psdFiles = [];
    try {
        var files = folder.getFiles("*");
        for (var i = 0; i < files.length; i++) {
            var item = files[i];
            if (item instanceof File) {
                var itemName = item.name.toLowerCase();
                if (itemName.match(/\.(psd|psb)$/)) {
                    psdFiles.push(item);
                }
            }
        }
    } catch (e) {}
    return psdFiles;
}

/**
 * ★★★ フォルダをスキャンしてマージ用結果を返す ★★★
 */
function scanFolderForMerge(folder, existingDocs) {
    var psdFiles = findPSDFilesInFolder(folder);
    if (psdFiles.length === 0) return null;

    var usedFonts = {};
    var allFontSizes = {};
    var strokeStats = {};
    var textLayersByDoc = {};
    var guideSets = {};
    var scannedFileNames = [];
    var processedCount = 0;
    var errorCount = 0;
    var textLogData = {}; // ★★★ テキストログ用データ追加 ★★★

    // プログレスウィンドウ
    var progressWin = new Window("palette", "スキャン中...");
    progressWin.add("statictext", undefined, "フォルダ: " + folder.name);
    var progressBar = progressWin.add("progressbar", undefined, 0, psdFiles.length);
    progressBar.preferredSize.width = 300;
    var progressText = progressWin.add("statictext", undefined, "0 / " + psdFiles.length);
    progressWin.center();
    progressWin.show();

    for (var i = 0; i < psdFiles.length; i++) {
        var psdFile = psdFiles[i];
        progressBar.value = i + 1;
        progressText.text = (i + 1) + " / " + psdFiles.length + " : " + psdFile.name;
        progressWin.update();

        try {
            var doc = app.open(psdFile);
            var docName = doc.name;

            // ★★★ 各ドキュメントごとにテキストレイヤー配列を初期化 ★★★
            textLayersByDoc[docName] = [];

            // 1回の走査で全情報収集
            scanSingleDocument(doc, usedFonts, allFontSizes, strokeStats, textLayersByDoc[docName], guideSets);

            // ★★★ テキストログ用データを収集 ★★★
            textLogData[docName] = collectTextForLog(doc);

            scannedFileNames.push(psdFile.name);
            processedCount++;

            // PSDを閉じる（既存ドキュメントは閉じない）
            var isExisting = false;
            for (var e = 0; e < existingDocs.length; e++) {
                if (existingDocs[e] === doc) {
                    isExisting = true;
                    break;
                }
            }
            if (!isExisting) {
                doc.close(SaveOptions.DONOTSAVECHANGES);
            }
        } catch (err) {
            errorCount++;
        }
    }

    progressWin.close();

    // フォント配列に変換
    var fontArray = [];
    for (var font in usedFonts) {
        var sizes = [];
        for (var size in usedFonts[font].sizes) {
            sizes.push({
                size: parseFloat(size),
                count: usedFonts[font].sizes[size]
            });
        }
        sizes.sort(function(a, b) { return b.count - a.count; });
        fontArray.push({
            name: font,
            displayName: getFontDisplayName(font),
            count: usedFonts[font].count,
            sizes: sizes
        });
    }
    fontArray.sort(function(a, b) { return b.count - a.count; });

    // ガイドセット配列に変換
    var guideSetArray = [];
    for (var hash in guideSets) {
        guideSetArray.push(guideSets[hash]);
    }
    // ★★★ 有効なタチキリ枠を優先、無効なものは最下位 ★★★
    guideSetArray.sort(function(a, b) {
        var aValid = isValidTachikiriGuideSet(a) ? 1 : 0;
        var bValid = isValidTachikiriGuideSet(b) ? 1 : 0;
        if (aValid !== bValid) {
            return bValid - aValid;
        }
        return b.count - a.count;
    });

    // 白フチ配列に変換
    var strokeArray = [];
    for (var sz in strokeStats) {
        var fontSizes = strokeStats[sz].fontSizes || {};
        var fontSizeArray = [];
        for (var fs in fontSizes) {
            fontSizeArray.push(parseFloat(fs));
        }
        fontSizeArray.sort(function(a, b) { return b - a; });
        var maxFontSize = fontSizeArray.length > 0 ? fontSizeArray[0] : null;
        strokeArray.push({
            size: parseFloat(sz),
            count: strokeStats[sz].count,
            fontSizes: fontSizeArray,
            maxFontSize: maxFontSize
        });
    }
    strokeArray.sort(function(a, b) { return b.count - a.count; });

    return {
        files: scannedFileNames,
        fonts: fontArray,
        sizeStats: calculateFontSizeStats(allFontSizes),
        allFontSizes: allFontSizes,  // ★★★ 生データも返す（マージ用）★★★
        strokeStats: { sizes: strokeArray, stats: strokeStats },
        guideSets: guideSetArray,
        processedCount: processedCount,
        errorCount: errorCount,
        textLogData: textLogData  // ★★★ テキストログデータ追加 ★★★
    };
}

/**
 * ★★★ スキャン結果をscandataにマージする ★★★
 */
function mergeScanResult(scanData, newResult, folderPath) {
    // スキャン済みフォルダに追加
    scanData.scannedFolders[folderPath] = {
        files: newResult.files,
        scanDate: new Date().toString()
    };

    // フォント情報をマージ（既存+新規を統合）
    if (!scanData.detectedFonts) scanData.detectedFonts = [];
    for (var i = 0; i < newResult.fonts.length; i++) {
        var newFont = newResult.fonts[i];
        var found = false;
        for (var j = 0; j < scanData.detectedFonts.length; j++) {
            if (scanData.detectedFonts[j].name === newFont.name) {
                // 既存フォントにカウントを追加
                scanData.detectedFonts[j].count += newFont.count;
                // サイズ情報をマージ
                for (var k = 0; k < newFont.sizes.length; k++) {
                    var newSize = newFont.sizes[k];
                    var sizeFound = false;
                    for (var l = 0; l < scanData.detectedFonts[j].sizes.length; l++) {
                        if (scanData.detectedFonts[j].sizes[l].size === newSize.size) {
                            scanData.detectedFonts[j].sizes[l].count += newSize.count;
                            sizeFound = true;
                            break;
                        }
                    }
                    if (!sizeFound) {
                        scanData.detectedFonts[j].sizes.push(newSize);
                    }
                }
                found = true;
                break;
            }
        }
        if (!found) {
            scanData.detectedFonts.push(newFont);
        }
    }
    // フォントを使用回数順にソート
    scanData.detectedFonts.sort(function(a, b) { return b.count - a.count; });

    // ガイドセットをマージ（同じセットはカウント増加、別セットは追加）
    if (!scanData.detectedGuideSets) scanData.detectedGuideSets = [];
    for (var gi = 0; gi < newResult.guideSets.length; gi++) {
        var newGuide = newResult.guideSets[gi];
        var guideFound = false;
        for (var gj = 0; gj < scanData.detectedGuideSets.length; gj++) {
            // ハッシュで比較
            if (scanData.detectedGuideSets[gj].hash === newGuide.hash) {
                scanData.detectedGuideSets[gj].count += newGuide.count;
                // ★★★ docNamesもマージする ★★★
                if (newGuide.docNames && newGuide.docNames.length > 0) {
                    if (!scanData.detectedGuideSets[gj].docNames) {
                        scanData.detectedGuideSets[gj].docNames = [];
                    }
                    for (var dn = 0; dn < newGuide.docNames.length; dn++) {
                        scanData.detectedGuideSets[gj].docNames.push(newGuide.docNames[dn]);
                    }
                }
                guideFound = true;
                break;
            }
        }
        if (!guideFound) {
            scanData.detectedGuideSets.push(newGuide);
        }
    }
    scanData.detectedGuideSets.sort(function(a, b) { return b.count - a.count; });

    // 白フチ情報をマージ（対応フォントサイズも含む）
    if (!scanData.detectedStrokeStats) scanData.detectedStrokeStats = { sizes: [], stats: {} };
    if (newResult.strokeStats && newResult.strokeStats.sizes) {
        for (var si = 0; si < newResult.strokeStats.sizes.length; si++) {
            var newStroke = newResult.strokeStats.sizes[si];
            var strokeFound = false;
            for (var sj = 0; sj < scanData.detectedStrokeStats.sizes.length; sj++) {
                if (scanData.detectedStrokeStats.sizes[sj].size === newStroke.size) {
                    scanData.detectedStrokeStats.sizes[sj].count += newStroke.count;
                    // ★★★ 対応フォントサイズをマージ ★★★
                    if (newStroke.fontSizes && newStroke.fontSizes.length > 0) {
                        var existingFontSizes = scanData.detectedStrokeStats.sizes[sj].fontSizes || [];
                        for (var fsi = 0; fsi < newStroke.fontSizes.length; fsi++) {
                            var newFs = newStroke.fontSizes[fsi];
                            var fsExists = false;
                            for (var fsj = 0; fsj < existingFontSizes.length; fsj++) {
                                if (existingFontSizes[fsj] === newFs) {
                                    fsExists = true;
                                    break;
                                }
                            }
                            if (!fsExists) {
                                existingFontSizes.push(newFs);
                            }
                        }
                        existingFontSizes.sort(function(a, b) { return b - a; });
                        scanData.detectedStrokeStats.sizes[sj].fontSizes = existingFontSizes;
                    }
                    strokeFound = true;
                    break;
                }
            }
            if (!strokeFound) {
                scanData.detectedStrokeStats.sizes.push({
                    size: newStroke.size,
                    count: newStroke.count,
                    fontSizes: newStroke.fontSizes ? newStroke.fontSizes.slice() : [],
                    maxFontSize: newStroke.maxFontSize || null
                });
            }
        }
        scanData.detectedStrokeStats.sizes.sort(function(a, b) { return b.count - a.count; });
    }

    // ★★★ フォントサイズ生データをマージ ★★★
    if (!scanData.detectedAllFontSizes) scanData.detectedAllFontSizes = {};
    if (newResult.allFontSizes) {
        for (var size in newResult.allFontSizes) {
            if (!scanData.detectedAllFontSizes[size]) {
                scanData.detectedAllFontSizes[size] = 0;
            }
            scanData.detectedAllFontSizes[size] += newResult.allFontSizes[size];
        }
    }
    // マージしたデータからsizeStatsを再計算
    scanData.detectedSizeStats = calculateFontSizeStats(scanData.detectedAllFontSizes);

    // 統計情報を更新
    scanData.totalFiles = (scanData.totalFiles || 0) + newResult.processedCount;
    scanData.processedFiles = (scanData.processedFiles || 0) + newResult.processedCount;
    scanData.errorFiles = (scanData.errorFiles || 0) + newResult.errorCount;
    scanData.timestamp = new Date().toString();

    // ★★★ テキストログデータをマージ（フォルダ名をキーにして追記）★★★
    if (newResult.textLogData) {
        if (!scanData.textLogByFolder) scanData.textLogByFolder = {};
        // フォルダ名（folderPathから取得）
        var folderObj = new Folder(folderPath);
        var folderName = folderObj.name;
        if (!scanData.textLogByFolder[folderName]) {
            scanData.textLogByFolder[folderName] = {};
        }
        // 各ドキュメントのテキストログをマージ
        for (var docName in newResult.textLogData) {
            if (newResult.textLogData.hasOwnProperty(docName)) {
                scanData.textLogByFolder[folderName][docName] = newResult.textLogData[docName];
            }
        }
    }
}

/**
 * ★★★ scandataをファイルに保存する ★★★
 */
function saveScandataToFile(scanData) {
    // saveDataPathがない場合は初回保存として作成
    if (!scanData.saveDataPath) {
        // サーバーに初回保存
        var folderName = "";
        if (scanData.folderPath) {
            var f = new Folder(scanData.folderPath);
            folderName = f.name;
        } else if (scanData.sourceFolderPath) {
            var f = new Folder(scanData.sourceFolderPath);
            folderName = f.name;
        } else {
            folderName = "unknown";
        }
        var serverPath = saveScanDataInitial(scanData, folderName);
        if (serverPath) {
            scanData.saveDataPath = serverPath;
        } else {
            return false;
        }
    }

    var saveFile = new File(scanData.saveDataPath);
    try {
        saveFile.encoding = "UTF-8";
        saveFile.open("w");
        saveFile.write(JSON.stringify(scanData));
        saveFile.close();
        return true;
    } catch (e) {
        alert("scandata保存エラー: " + e.message);
        return false;
    }
}

/**
 * フォルダ内のPSDファイルを再帰的に検索
 */
function findPSDFiles(folder, fileList) {
    if (!fileList) fileList = [];
    
    try {
        var files = folder.getFiles("*");
        
        for (var i = 0; i < files.length; i++) {
            var item = files[i];
            
            if (item instanceof Folder) {
                findPSDFiles(item, fileList);
            } else if (item instanceof File) {
                var itemName = item.name.toLowerCase();
                if (itemName.match(/\.(psd|psb)$/)) {
                    fileList.push(item);
                }
            }
        }
    } catch (e) {
    }
    
    return fileList;
}

/**
 * ★★★ 画像レイヤーと非表示テキストレイヤーを再帰的に削除（ロック解除して削除）★★★
 * テキストレイヤー以外のArtLayer、および非表示のテキストレイヤーを削除して読み込み高速化
 */
function deleteImageLayers(doc) {
    function deleteFromParent(parent) {
        // 後ろから削除（インデックスがずれるのを防ぐ）
        for (var i = parent.layers.length - 1; i >= 0; i--) {
            var layer = parent.layers[i];

            try {
                if (layer.typename === "LayerSet") {
                    // グループレイヤーは再帰的に処理
                    deleteFromParent(layer);
                    // グループ内のレイヤーがすべて削除されたら、空のグループも削除
                    if (layer.layers.length === 0) {
                        try {
                            layer.allLocked = false;
                            layer.remove();
                        } catch (e) {}
                    }
                } else if (layer.typename === "ArtLayer") {
                    // ★★★ テキストレイヤー以外を削除、または非表示のテキストレイヤーも削除 ★★★
                    var shouldDelete = false;
                    if (layer.kind !== LayerKind.TEXT) {
                        // テキストレイヤー以外は削除
                        shouldDelete = true;
                    } else if (!layer.visible) {
                        // 非表示のテキストレイヤーも削除
                        shouldDelete = true;
                    }

                    if (shouldDelete) {
                        try {
                            // すべてのロックを解除
                            layer.allLocked = false;
                        } catch (e) {}
                        try {
                            layer.remove();
                        } catch (e) {}
                    }
                }
            } catch (e) {
                // エラーは無視して続行
            }
        }
    }

    deleteFromParent(doc);
}

/**
 * ★★★ 1ドキュメントから全情報を1回の走査で収集する関数 ★★★
 */
function scanSingleDocument(doc, usedFonts, allFontSizes, strokeStats, textLayerList, guideSets) {
    var docName = doc.name;
    var docPath = doc.path ? doc.path.fsName : null;

    // 1回の走査で全情報を収集
    function scanLayers(parent, result) {
        if (!result) result = { isTextOnly: true, maxFontSize: null, hasVisibleText: false };

        for (var i = 0; i < parent.layers.length; i++) {
            var layer = parent.layers[i];

            // 非表示レイヤーは除外
            if (!layer.visible) continue;

            try {
                if (layer.typename === "LayerSet") {
                    // フォルダの場合
                    if (layer.layers.length === 0) continue;

                    // サブレイヤーを再帰的に処理
                    var subResult = scanLayers(layer, null);

                    if (!subResult.isTextOnly) {
                        result.isTextOnly = false;
                    }

                    if (subResult.maxFontSize !== null) {
                        if (result.maxFontSize === null || subResult.maxFontSize > result.maxFontSize) {
                            result.maxFontSize = subResult.maxFontSize;
                        }
                        result.hasVisibleText = true;
                    }

                    // ★★★ フォルダの境界線をチェック（テキストのみのフォルダの場合）★★★
                    if (subResult.isTextOnly && subResult.hasVisibleText && subResult.maxFontSize !== null) {
                        try {
                            var folderStrokeSize = getLayerStrokeSize(layer);
                            if (folderStrokeSize !== null && folderStrokeSize > 0) {
                                var strokeKey = String(folderStrokeSize);
                                if (!strokeStats[strokeKey]) {
                                    strokeStats[strokeKey] = { count: 0, fontSizes: {} };
                                }
                                strokeStats[strokeKey].count++;
                                var fontKey = String(subResult.maxFontSize);
                                strokeStats[strokeKey].fontSizes[fontKey] = true;
                            }
                        } catch (folderStrokeErr) {
                            // フォルダ境界線取得エラーは無視
                        }
                    }

                } else if (layer.kind === LayerKind.TEXT) {
                    // テキストレイヤーの場合
                    result.hasVisibleText = true;

                    try {
                        var textItem = layer.textItem;
                        var fontName = textItem.font;
                        var fontSize = Math.round(textItem.size.value * 10) / 10;

                        // テキストレイヤー情報を保存
                        var content = textItem.contents || "";
                        if (content.length > 30) content = content.substring(0, 30) + "...";
                        content = content.replace(/\r\n/g, " ").replace(/\n/g, " ").replace(/\r/g, " ");

                        textLayerList.push({
                            layerName: layer.name,
                            content: content,
                            fontSize: fontSize,
                            fontName: fontName,
                            displayFontName: getFontDisplayName(fontName),
                            docName: docName,
                            docPath: docPath
                        });

                        // フォント情報を収集
                        if (!usedFonts[fontName]) {
                            usedFonts[fontName] = { count: 0, sizes: {} };
                        }
                        usedFonts[fontName].count++;
                        if (!usedFonts[fontName].sizes[fontSize]) {
                            usedFonts[fontName].sizes[fontSize] = 0;
                        }
                        usedFonts[fontName].sizes[fontSize]++;

                        // 全体のフォントサイズ統計
                        if (!allFontSizes[fontSize]) {
                            allFontSizes[fontSize] = 0;
                        }
                        allFontSizes[fontSize]++;

                        // maxFontSize を更新
                        if (result.maxFontSize === null || fontSize > result.maxFontSize) {
                            result.maxFontSize = fontSize;
                        }

                        // ★★★ 境界線（白フチ）情報を収集 ★★★
                        try {
                            var strokeSize = getLayerStrokeSize(layer);
                            if (strokeSize !== null && strokeSize > 0) {
                                var strokeKey = String(strokeSize);
                                if (!strokeStats[strokeKey]) {
                                    strokeStats[strokeKey] = { count: 0, fontSizes: {} };
                                }
                                strokeStats[strokeKey].count++;
                                var fontKey = String(fontSize);
                                strokeStats[strokeKey].fontSizes[fontKey] = true;
                            }
                        } catch (strokeErr) {
                            // 境界線取得エラーは無視
                        }
                    } catch (e) {}

                } else {
                    result.isTextOnly = false;
                }
            } catch (e) {}
        }

        return result;
    }

    // レイヤー走査
    scanLayers(doc, null);

    // ガイド線情報を収集
    try {
        var guides = getGuideInfo(doc);
        var roundedH = [];
        var roundedV = [];

        for (var h = 0; h < guides.horizontal.length; h++) {
            roundedH.push(Math.round(guides.horizontal[h] * 10) / 10);
        }
        for (var v = 0; v < guides.vertical.length; v++) {
            roundedV.push(Math.round(guides.vertical[v] * 10) / 10);
        }

        roundedH.sort(function(a, b) { return a - b; });
        roundedV.sort(function(a, b) { return a - b; });

        if (roundedH.length > 0 || roundedV.length > 0) {
            var hash = getGuideSetHash({ horizontal: roundedH, vertical: roundedV });
            if (hash !== "ERROR") {
                // ドキュメントサイズを取得（ピクセル単位）
                var docWidthPx = doc.width.as('px');
                var docHeightPx = doc.height.as('px');

                if (!guideSets[hash]) {
                    guideSets[hash] = {
                        horizontal: roundedH,
                        vertical: roundedV,
                        count: 0,
                        docNames: [],
                        docWidth: docWidthPx,
                        docHeight: docHeightPx
                    };
                }
                guideSets[hash].count++;
                guideSets[hash].docNames.push(docName);
            }
        }
    } catch (e) {}
}

/**
 * ★★★ 既存のセーブデータを読み込む関数 ★★★
 */
function loadExistingScanData(folder) {
    var saveFile = new File(folder.fsName + "/_scandata.json");
    if (!saveFile.exists) {
        return null;
    }

    try {
        saveFile.encoding = "UTF-8";
        saveFile.open("r");
        var content = saveFile.read();
        saveFile.close();
        return JSON.parse(content);
    } catch (e) {
        return null;
    }
}

/**
 * ★★★ フォントデータをマージする関数 ★★★
 */
function mergeFontData(existingFonts, newUsedFonts) {
    // 既存データをusedFonts形式に変換
    var usedFonts = {};
    if (existingFonts) {
        for (var i = 0; i < existingFonts.length; i++) {
            var f = existingFonts[i];
            usedFonts[f.name] = { count: f.count, sizes: {} };
            if (f.sizes) {
                for (var j = 0; j < f.sizes.length; j++) {
                    usedFonts[f.name].sizes[f.sizes[j].size] = f.sizes[j].count;
                }
            }
        }
    }

    // 新しいデータをマージ
    for (var fontName in newUsedFonts) {
        if (!usedFonts[fontName]) {
            usedFonts[fontName] = { count: 0, sizes: {} };
        }
        usedFonts[fontName].count += newUsedFonts[fontName].count;
        for (var size in newUsedFonts[fontName].sizes) {
            if (!usedFonts[fontName].sizes[size]) {
                usedFonts[fontName].sizes[size] = 0;
            }
            usedFonts[fontName].sizes[size] += newUsedFonts[fontName].sizes[size];
        }
    }

    return usedFonts;
}

/**
 * ★★★ フォルダ内のPSDファイルを処理（差分スキャン対応・フォルダ認識対応）★★★
 */
function processFolder(folder, existingDocs) {
    var progressWin = new Window("palette", "処理中...", undefined, {closeButton: false});
    progressWin.orientation = "column";
    progressWin.alignChildren = ["fill", "top"];
    progressWin.spacing = 10;
    progressWin.margins = 15;

    var statusText = progressWin.add("statictext", undefined, "フォルダ構造を確認中...");
    statusText.preferredSize.width = 400;

    var progressBar = progressWin.add("progressbar", undefined, 0, 100);
    progressBar.preferredSize.width = 400;

    var countText = progressWin.add("statictext", undefined, "");

    progressWin.center();
    progressWin.show();
    progressWin.update();

    // ★★★ フォルダ認識ロジック適用 ★★★
    var targetFolders = determineTargetFolders(folder);
    if (targetFolders.length === 0) {
        progressWin.close();
        alert("指定されたフォルダ内にPSDファイルが見つかりませんでした。\n\n検索対象：" + folder.fsName);
        return {success: true, scanData: null};
    }

    statusText.text = "対象フォルダ: " + targetFolders.length + "個";
    progressWin.update();

    // ★★★ 既存のセーブデータを読み込む ★★★
    var existingScanData = loadExistingScanData(folder);
    var scannedDocNames = {};

    if (existingScanData && existingScanData.textLayersByDoc) {
        var scannedCount = 0;
        for (var docName in existingScanData.textLayersByDoc) {
            scannedDocNames[docName] = true;
            scannedCount++;
        }
        statusText.text = "既存のセーブデータを発見（" + scannedCount + "ファイルスキャン済み）";
        progressWin.update();
    }

    // ★★★ 全体の統計用 ★★★
    var totalProcessedCount = 0;
    var totalErrorCount = 0;
    var totalSkippedCount = 0;
    var errors = [];

    // ★★★ マージ用データ格納オブジェクト ★★★
    var allUsedFonts = {};
    var allFontSizes = {};
    var allStrokeStats = {};
    var allTextLayersByDoc = {};
    var allGuideSets = {};

    // ★★★ テキストログ用データ格納オブジェクト（フォルダごとに分ける）★★★
    var textLogByFolder = {};

    // ★★★ scannedFolders構造を初期化 ★★★
    var scannedFolders = {};
    if (existingScanData && existingScanData.scannedFolders) {
        for (var fp in existingScanData.scannedFolders) {
            scannedFolders[fp] = existingScanData.scannedFolders[fp];
        }
    }

    var originalDialogMode = app.displayDialogs;
    app.displayDialogs = DialogModes.NO;

    // ★★★ 各対象フォルダを個別に処理 ★★★
    for (var fi = 0; fi < targetFolders.length; fi++) {
        var targetFolder = targetFolders[fi];
        var targetFolderPath = targetFolder.fsName;

        statusText.text = "フォルダ: " + targetFolder.name + " (" + (fi + 1) + "/" + targetFolders.length + ")";
        progressWin.update();

        // このフォルダのPSDファイルを取得（直下のみ）
        var folderPsdFiles = findPSDFilesInFolder(targetFolder);

        // 新規ファイルのみフィルタリング
        var newPsdFiles = [];
        for (var i = 0; i < folderPsdFiles.length; i++) {
            var fileName = folderPsdFiles[i].name;
            if (!scannedDocNames[fileName]) {
                newPsdFiles.push(folderPsdFiles[i]);
            }
        }

        var folderSkippedCount = folderPsdFiles.length - newPsdFiles.length;
        totalSkippedCount += folderSkippedCount;

        if (newPsdFiles.length === 0) {
            continue; // このフォルダはスキップ
        }

        // ★★★ このフォルダ用のデータ格納オブジェクト ★★★
        var folderUsedFonts = {};
        var folderFontSizes = {};
        var folderStrokeStats = {};
        var folderTextLayersByDoc = {};
        var folderGuideSets = {};
        var folderScannedFiles = [];
        var folderProcessedCount = 0;
        var folderErrorCount = 0;

        // ★★★ このフォルダのテキストログ用データを初期化 ★★★
        var folderName = targetFolder.name;
        if (!textLogByFolder[folderName]) {
            textLogByFolder[folderName] = {};
        }

        for (var i = 0; i < newPsdFiles.length; i++) {
            try {
                var fileName = newPsdFiles[i].name;

                statusText.text = "処理中: " + targetFolder.name + "/" + fileName + " (" + (i + 1) + "/" + newPsdFiles.length + ")";
                countText.text = "処理済み: " + totalProcessedCount + " / エラー: " + totalErrorCount + " / スキップ: " + totalSkippedCount;
                progressBar.value = ((fi / targetFolders.length) + ((i / newPsdFiles.length) / targetFolders.length)) * 100;
                progressWin.update();

                // PSDを開く
                var doc = app.open(newPsdFiles[i]);
                app.activeDocument = doc;
                var docName = doc.name;

                // テキストレイヤーリストを初期化
                folderTextLayersByDoc[docName] = [];
                allTextLayersByDoc[docName] = [];

                // 1回の走査で全情報を収集
                scanSingleDocument(doc, folderUsedFonts, folderFontSizes, folderStrokeStats, folderTextLayersByDoc[docName], folderGuideSets);

                // 全体統計にもコピー
                allTextLayersByDoc[docName] = folderTextLayersByDoc[docName];

                // ★★★ テキストログ用データを収集（PSDを閉じる前に、フォルダごとに）★★★
                textLogByFolder[folderName][docName] = collectTextForLog(doc);

                // PSDを閉じる
                try {
                    doc.close(SaveOptions.DONOTSAVECHANGES);
                } catch (e) {}

                folderScannedFiles.push(fileName);
                folderProcessedCount++;
                totalProcessedCount++;

            } catch (e) {
                folderErrorCount++;
                totalErrorCount++;
                errors.push({
                    file: newPsdFiles[i].name,
                    folder: targetFolder.name,
                    error: e.message
                });
            }
        }

        // ★★★ このフォルダの結果をscannedFoldersに保存 ★★★
        if (folderScannedFiles.length > 0) {
            scannedFolders[targetFolderPath] = {
                files: folderScannedFiles,
                scanDate: new Date().toString()
            };
        }

        // ★★★ 全体統計にマージ ★★★
        for (var fontName in folderUsedFonts) {
            if (!allUsedFonts[fontName]) {
                allUsedFonts[fontName] = { count: 0, sizes: {} };
            }
            allUsedFonts[fontName].count += folderUsedFonts[fontName].count;
            for (var sz in folderUsedFonts[fontName].sizes) {
                if (!allUsedFonts[fontName].sizes[sz]) {
                    allUsedFonts[fontName].sizes[sz] = 0;
                }
                allUsedFonts[fontName].sizes[sz] += folderUsedFonts[fontName].sizes[sz];
            }
        }

        for (var sz in folderFontSizes) {
            if (!allFontSizes[sz]) allFontSizes[sz] = 0;
            allFontSizes[sz] += folderFontSizes[sz];
        }

        for (var sz in folderStrokeStats) {
            if (!allStrokeStats[sz]) {
                allStrokeStats[sz] = { count: 0, fontSizes: {} };
            }
            allStrokeStats[sz].count += folderStrokeStats[sz].count;
            for (var fs in folderStrokeStats[sz].fontSizes) {
                allStrokeStats[sz].fontSizes[fs] = true;
            }
        }

        for (var hash in folderGuideSets) {
            if (!allGuideSets[hash]) {
                allGuideSets[hash] = {
                    horizontal: folderGuideSets[hash].horizontal,
                    vertical: folderGuideSets[hash].vertical,
                    count: 0,
                    docNames: [],
                    docWidth: folderGuideSets[hash].docWidth,
                    docHeight: folderGuideSets[hash].docHeight
                };
            }
            allGuideSets[hash].count += folderGuideSets[hash].count;
            allGuideSets[hash].docNames = allGuideSets[hash].docNames.concat(folderGuideSets[hash].docNames);
        }
    }

    app.displayDialogs = originalDialogMode;

    // ★★★ 既存データと新規データをマージ ★★★
    statusText.text = "データをマージ中...";
    progressWin.update();

    // テキストレイヤーデータをマージ
    var mergedTextLayersByDoc = {};
    if (existingScanData && existingScanData.textLayersByDoc) {
        for (var docName in existingScanData.textLayersByDoc) {
            mergedTextLayersByDoc[docName] = existingScanData.textLayersByDoc[docName];
        }
    }
    for (var docName in allTextLayersByDoc) {
        mergedTextLayersByDoc[docName] = allTextLayersByDoc[docName];
    }

    // フォントデータをマージ
    var mergedUsedFonts = mergeFontData(existingScanData ? existingScanData.fonts : null, allUsedFonts);

    // マージしたフォントデータを配列に変換
    var fontArray = [];
    for (var font in mergedUsedFonts) {
        var sizes = [];
        for (var size in mergedUsedFonts[font].sizes) {
            sizes.push({
                size: parseFloat(size),
                count: mergedUsedFonts[font].sizes[size]
            });
        }
        sizes.sort(function(a, b) { return b.count - a.count; });

        fontArray.push({
            name: font,
            displayName: getFontDisplayName(font),
            count: mergedUsedFonts[font].count,
            sizes: sizes
        });
    }
    fontArray.sort(function(a, b) { return b.count - a.count; });

    // フォントサイズをマージ
    var mergedAllFontSizes = {};
    if (existingScanData && existingScanData.sizeStats && existingScanData.sizeStats.forExport) {
        // 既存データから復元（簡易版）
    }
    for (var size in allFontSizes) {
        if (!mergedAllFontSizes[size]) mergedAllFontSizes[size] = 0;
        mergedAllFontSizes[size] += allFontSizes[size];
    }
    var sizeStats = calculateFontSizeStats(mergedAllFontSizes);

    // 白フチ統計をマージ
    var mergedStrokeStats = {};
    if (existingScanData && existingScanData.strokeStats) {
        // ★★★ stats形式（オブジェクト）からの読み込み ★★★
        if (existingScanData.strokeStats.stats) {
            for (var size in existingScanData.strokeStats.stats) {
                mergedStrokeStats[size] = {
                    count: existingScanData.strokeStats.stats[size].count,
                    fontSizes: {}
                };
                for (var fs in existingScanData.strokeStats.stats[size].fontSizes) {
                    mergedStrokeStats[size].fontSizes[fs] = true;
                }
            }
        }
        // ★★★ sizes形式（配列）からの読み込み（stats形式がない場合）★★★
        if (existingScanData.strokeStats.sizes && existingScanData.strokeStats.sizes.length > 0) {
            for (var si = 0; si < existingScanData.strokeStats.sizes.length; si++) {
                var item = existingScanData.strokeStats.sizes[si];
                var strokeSize = item.size;
                if (!mergedStrokeStats[strokeSize]) {
                    mergedStrokeStats[strokeSize] = { count: item.count || 0, fontSizes: {} };
                }
                // ★★★ fontSizes配列をオブジェクト形式に変換してマージ ★★★
                if (item.fontSizes && item.fontSizes.length > 0) {
                    for (var fi = 0; fi < item.fontSizes.length; fi++) {
                        mergedStrokeStats[strokeSize].fontSizes[item.fontSizes[fi]] = true;
                    }
                }
            }
        }
    }
    for (var size in allStrokeStats) {
        if (!mergedStrokeStats[size]) {
            mergedStrokeStats[size] = { count: 0, fontSizes: {} };
        }
        mergedStrokeStats[size].count += allStrokeStats[size].count;
        for (var fs in allStrokeStats[size].fontSizes) {
            mergedStrokeStats[size].fontSizes[fs] = true;
        }
    }

    var strokeArray = [];
    for (var size in mergedStrokeStats) {
        var fontSizes = mergedStrokeStats[size].fontSizes || {};
        var fontSizeArray = [];
        for (var fs in fontSizes) {
            fontSizeArray.push(parseFloat(fs));
        }
        fontSizeArray.sort(function(a, b) { return b - a; });
        var maxFontSize = fontSizeArray.length > 0 ? fontSizeArray[0] : null;

        strokeArray.push({
            size: parseFloat(size),
            count: mergedStrokeStats[size].count,
            fontSizes: fontSizeArray,
            maxFontSize: maxFontSize
        });
    }
    strokeArray.sort(function(a, b) { return b.count - a.count; });

    // ガイド線セットをマージ
    var mergedGuideSets = {};
    if (existingScanData && existingScanData.guideSets) {
        for (var i = 0; i < existingScanData.guideSets.length; i++) {
            var gs = existingScanData.guideSets[i];
            var hash = getGuideSetHash(gs);
            if (hash !== "ERROR") {
                mergedGuideSets[hash] = {
                    horizontal: gs.horizontal,
                    vertical: gs.vertical,
                    count: gs.count,
                    docNames: gs.docNames || [],
                    docWidth: gs.docWidth,
                    docHeight: gs.docHeight
                };
            }
        }
    }
    for (var hash in allGuideSets) {
        if (!mergedGuideSets[hash]) {
            mergedGuideSets[hash] = {
                horizontal: allGuideSets[hash].horizontal,
                vertical: allGuideSets[hash].vertical,
                count: 0,
                docNames: [],
                docWidth: allGuideSets[hash].docWidth,
                docHeight: allGuideSets[hash].docHeight
            };
        }
        mergedGuideSets[hash].count += allGuideSets[hash].count;
        mergedGuideSets[hash].docNames = mergedGuideSets[hash].docNames.concat(allGuideSets[hash].docNames);
    }

    var guideSetArray = [];
    for (var hash in mergedGuideSets) {
        if (mergedGuideSets.hasOwnProperty(hash)) {
            guideSetArray.push(mergedGuideSets[hash]);
        }
    }
    // ★★★ 有効なタチキリ枠を優先、無効なものは最下位 ★★★
    guideSetArray.sort(function(a, b) {
        var aValid = isValidTachikiriGuideSet(a) ? 1 : 0;
        var bValid = isValidTachikiriGuideSet(b) ? 1 : 0;
        if (aValid !== bValid) {
            return bValid - aValid;
        }
        return b.count - a.count;
    });

    // ★★★ 全PSDファイル数を計算 ★★★
    var totalPsdCount = 0;
    for (var fi = 0; fi < targetFolders.length; fi++) {
        var folderPsdFiles = findPSDFilesInFolder(targetFolders[fi]);
        totalPsdCount += folderPsdFiles.length;
    }

    // ★★★ マージしたデータを保存 ★★★
    var totalProcessed = 0;
    for (var docKey in mergedTextLayersByDoc) {
        if (mergedTextLayersByDoc.hasOwnProperty(docKey)) {
            totalProcessed++;
        }
    }
    // ★★★ 白フチデータをシンプルな形式で保存（fontSizes配列を含む）★★★
    var scanData = {
        fonts: fontArray,
        sizeStats: sizeStats,
        allFontSizes: mergedAllFontSizes,
        strokeStats: { sizes: strokeArray },  // ★★★ sizes配列のみ（statsは不要）★★★
        guideSets: guideSetArray,
        textLayersByDoc: mergedTextLayersByDoc,
        scannedFolders: scannedFolders,
        processedFiles: totalProcessed,
        workInfo: { genre: "", label: "", authorType: "single", author: "", artist: "", original: "", title: "", subtitle: "", editor: "", volume: 1, completedPath: "", typesettingPath: "", coverPath: "" },
        textLogByFolder: textLogByFolder
    };

    // ★★★ サーバーに初回保存（日付時間_フォルダ名で保存）★★★
    var serverSavePath = saveScanDataInitial(scanData, folder.name);
    if (serverSavePath) {
        scanData.saveDataPath = serverSavePath;
        // サーバー保存成功時はローカルに_scandata.jsonを作らない
    } else {
        // サーバー保存失敗時のみローカルに保存（差分スキャン用）
        var tempSaveFile = new File(folder.fsName + "/_scandata.json");
        try {
            tempSaveFile.encoding = "UTF-8";
            tempSaveFile.open("w");
            tempSaveFile.write(JSON.stringify(scanData));
            tempSaveFile.close();
        } catch (e) {
            // 一時保存に失敗しても続行
        }
    }

    progressWin.close();

    // ★★★ テキストログは作品情報（レーベル/タイトル）入力後に出力 ★★★
    // textLogByFolder は scanData に保存済み

    // 結果を表示
    var resultMessage = "スキャン完了\n\n" +
          "対象フォルダ数: " + targetFolders.length + "\n" +
          "全ファイル数: " + totalPsdCount + "\n" +
          "新規スキャン: " + totalProcessedCount + "\n" +
          "エラー: " + totalErrorCount;
    if (totalSkippedCount > 0) {
        resultMessage = "差分スキャン完了\n\n" +
              "対象フォルダ数: " + targetFolders.length + "\n" +
              "全ファイル数: " + totalPsdCount + "\n" +
              "スキップ（スキャン済み）: " + totalSkippedCount + "\n" +
              "新規スキャン: " + totalProcessedCount + "\n" +
              "エラー: " + totalErrorCount;
    }
    if (serverSavePath) {
        resultMessage += "\n\n【サーバーに保存完了】";
    }
    alert(resultMessage);

    return {success: true, scanData: scanData};
}

/**
 * ★★★ 個別選択モード用：複数フォルダを個別の巻数で処理 ★★★
 */
function processFoldersWithVolumes(folderVolumeList, existingDocs) {
    var progressWin = new Window("palette", "処理中...", undefined, {closeButton: false});
    progressWin.orientation = "column";
    progressWin.alignChildren = ["fill", "top"];
    progressWin.spacing = 10;
    progressWin.margins = 15;

    var statusText = progressWin.add("statictext", undefined, "フォルダを処理中...");
    statusText.preferredSize.width = 400;

    var progressBar = progressWin.add("progressbar", undefined, 0, 100);
    progressBar.preferredSize.width = 400;

    var countText = progressWin.add("statictext", undefined, "");

    progressWin.center();
    progressWin.show();
    progressWin.update();

    // ★★★ 全体の統計用 ★★★
    var totalProcessedCount = 0;
    var totalErrorCount = 0;
    var totalPsdCount = 0;
    var errors = [];

    // ★★★ マージ用データ格納オブジェクト ★★★
    var allUsedFonts = {};
    var allFontSizes = {};
    var allStrokeStats = {};
    var allTextLayersByDoc = {};
    var allGuideSets = {};
    var textLogByFolder = {};

    var originalDialogMode = app.displayDialogs;
    app.displayDialogs = DialogModes.NO;

    // ★★★ 各フォルダを個別に処理 ★★★
    for (var fi = 0; fi < folderVolumeList.length; fi++) {
        var folderVolumeItem = folderVolumeList[fi];
        var targetFolder = folderVolumeItem.folder;
        var assignedVolume = folderVolumeItem.volume;
        var folderName = targetFolder.name;

        statusText.text = "フォルダ: " + folderName + " (" + (fi + 1) + "/" + folderVolumeList.length + ") - " + assignedVolume + "巻";
        progressWin.update();

        // このフォルダのPSDファイルを取得
        var folderPsdFiles = findPSDFilesInFolder(targetFolder);
        totalPsdCount += folderPsdFiles.length;

        if (folderPsdFiles.length === 0) {
            continue;
        }

        // ★★★ このフォルダ用のデータ格納オブジェクト ★★★
        var folderUsedFonts = {};
        var folderFontSizes = {};
        var folderStrokeStats = {};
        var folderTextLayersByDoc = {};
        var folderGuideSets = {};

        // ★★★ このフォルダのテキストログ用データを初期化 ★★★
        if (!textLogByFolder[folderName]) {
            textLogByFolder[folderName] = {};
        }

        for (var i = 0; i < folderPsdFiles.length; i++) {
            try {
                var fileName = folderPsdFiles[i].name;

                statusText.text = "処理中: " + folderName + "/" + fileName + " (" + (i + 1) + "/" + folderPsdFiles.length + ")";
                countText.text = "処理済み: " + totalProcessedCount + " / エラー: " + totalErrorCount;
                progressBar.value = ((fi / folderVolumeList.length) + ((i / folderPsdFiles.length) / folderVolumeList.length)) * 100;
                progressWin.update();

                // PSDを開く
                var doc = app.open(folderPsdFiles[i]);
                app.activeDocument = doc;
                var docName = doc.name;

                // テキストレイヤーリストを初期化
                folderTextLayersByDoc[docName] = [];
                allTextLayersByDoc[docName] = [];

                // 1回の走査で全情報を収集
                scanSingleDocument(doc, folderUsedFonts, folderFontSizes, folderStrokeStats, folderTextLayersByDoc[docName], folderGuideSets);

                // 全体統計にもコピー
                allTextLayersByDoc[docName] = folderTextLayersByDoc[docName];

                // ★★★ テキストログ用データを収集 ★★★
                textLogByFolder[folderName][docName] = collectTextForLog(doc);

                // PSDを閉じる
                try {
                    doc.close(SaveOptions.DONOTSAVECHANGES);
                } catch (e) {}

                totalProcessedCount++;

            } catch (e) {
                totalErrorCount++;
                errors.push({
                    file: folderPsdFiles[i].name,
                    folder: folderName,
                    error: e.message
                });
            }
        }

        // ★★★ 全体統計にマージ ★★★
        for (var fontName in folderUsedFonts) {
            if (!allUsedFonts[fontName]) {
                allUsedFonts[fontName] = { count: 0, sizes: {} };
            }
            allUsedFonts[fontName].count += folderUsedFonts[fontName].count;
            for (var sz in folderUsedFonts[fontName].sizes) {
                if (!allUsedFonts[fontName].sizes[sz]) {
                    allUsedFonts[fontName].sizes[sz] = 0;
                }
                allUsedFonts[fontName].sizes[sz] += folderUsedFonts[fontName].sizes[sz];
            }
        }

        for (var sz in folderFontSizes) {
            if (!allFontSizes[sz]) allFontSizes[sz] = 0;
            allFontSizes[sz] += folderFontSizes[sz];
        }

        for (var sz in folderStrokeStats) {
            if (!allStrokeStats[sz]) {
                allStrokeStats[sz] = { count: 0, fontSizes: {} };
            }
            allStrokeStats[sz].count += folderStrokeStats[sz].count;
            for (var fs in folderStrokeStats[sz].fontSizes) {
                allStrokeStats[sz].fontSizes[fs] = true;
            }
        }

        for (var setKey in folderGuideSets) {
            allGuideSets[setKey] = folderGuideSets[setKey];
        }
    }

    app.displayDialogs = originalDialogMode;

    // ★★★ フォントデータを配列に変換 ★★★
    var fontArray = [];
    for (var fontName in allUsedFonts) {
        var sizes = [];
        for (var size in allUsedFonts[fontName].sizes) {
            sizes.push({
                size: parseFloat(size),
                count: allUsedFonts[fontName].sizes[size]
            });
        }
        sizes.sort(function(a, b) { return b.count - a.count; });
        fontArray.push({
            name: fontName,
            displayName: getFontDisplayName(fontName),
            count: allUsedFonts[fontName].count,
            sizes: sizes
        });
    }
    fontArray.sort(function(a, b) { return b.count - a.count; });

    // ★★★ サイズ統計を作成 ★★★
    var sizeStats = { sizes: [], stats: allFontSizes };
    for (var sz in allFontSizes) {
        sizeStats.sizes.push({ size: parseFloat(sz), count: allFontSizes[sz] });
    }
    sizeStats.sizes.sort(function(a, b) { return b.count - a.count; });

    // ★★★ 白フチ統計を配列に変換 ★★★
    var strokeArray = [];
    for (var sz in allStrokeStats) {
        // fontSizesをオブジェクト形式から配列形式に変換
        var fontSizes = allStrokeStats[sz].fontSizes || {};
        var fontSizeArray = [];
        for (var fs in fontSizes) {
            if (fontSizes.hasOwnProperty(fs)) {
                fontSizeArray.push(parseFloat(fs));
            }
        }
        fontSizeArray.sort(function(a, b) { return b - a; });
        var maxFontSize = fontSizeArray.length > 0 ? fontSizeArray[0] : null;

        strokeArray.push({
            size: parseFloat(sz),
            count: allStrokeStats[sz].count,
            fontSizes: fontSizeArray,
            maxFontSize: maxFontSize
        });
    }
    strokeArray.sort(function(a, b) { return b.count - a.count; });

    // ★★★ ガイドセットを配列に変換 ★★★
    var guideSetArray = [];
    for (var setKey in allGuideSets) {
        guideSetArray.push(allGuideSets[setKey]);
    }
    // ★★★ 有効なタチキリ枠を優先、無効なものは最下位 ★★★
    guideSetArray.sort(function(a, b) {
        var aValid = isValidTachikiriGuideSet(a) ? 1 : 0;
        var bValid = isValidTachikiriGuideSet(b) ? 1 : 0;
        if (aValid !== bValid) {
            return bValid - aValid;
        }
        return b.pageCount - a.pageCount;
    });

    // ★★★ scanDataを構築 ★★★
    var scanData = {
        fonts: fontArray,
        sizeStats: sizeStats,
        allFontSizes: allFontSizes,
        strokeStats: { sizes: strokeArray, stats: allStrokeStats },
        guideSets: guideSetArray,
        workInfo: { genre: "", label: "", authorType: "single", author: "", artist: "", original: "", title: "", subtitle: "", editor: "", volume: 1, completedPath: "", typesettingPath: "", coverPath: "" },
        textLogByFolder: textLogByFolder,
        processedFiles: totalProcessedCount
    };

    progressWin.close();

    // 結果を表示
    var resultMessage = "スキャン完了\n\n" +
          "対象フォルダ数: " + folderVolumeList.length + "\n" +
          "全ファイル数: " + totalPsdCount + "\n" +
          "処理済み: " + totalProcessedCount + "\n" +
          "エラー: " + totalErrorCount;
    alert(resultMessage);

    return {success: true, scanData: scanData};
}

/**
 * ★★★ セーブデータを指定パスに保存する関数群 ★★★
 * 保存先: SAVE_DATA_BASE_PATH（グローバル定数で定義）
 */

/**
 * ファイル名に使えない文字を置換する関数
 */
function sanitizeFileName(str) {
    if (!str) return "";
    var result = "";
    var invalidChars = "\\/:*?\"<>|";
    for (var i = 0; i < str.length; i++) {
        var c = str.charAt(i);
        if (invalidChars.indexOf(c) >= 0) {
            result += "_";
        } else {
            result += c;
        }
    }
    return result;
}

/**
 * 現在の日時を取得してファイル名用文字列を返す
 */
function getDateTimeString() {
    var now = new Date();
    var y = now.getFullYear();
    var m = ("0" + (now.getMonth() + 1)).slice(-2);
    var d = ("0" + now.getDate()).slice(-2);
    var h = ("0" + now.getHours()).slice(-2);
    var min = ("0" + now.getMinutes()).slice(-2);
    var s = ("0" + now.getSeconds()).slice(-2);
    return y + m + d + "_" + h + min + s;
}

/**
 * ★★★ 初回スキャン時：日付時間_フォルダ名で直接ベースパスに保存 ★★★
 */
function saveScanDataInitial(scanData, folderName) {
    // ベースフォルダの存在確認
    var baseFolder = new Folder(SAVE_DATA_BASE_PATH);
    if (!baseFolder.exists) {
        // サーバー保存先がない場合はスキップ（PSDフォルダ内のみに保存）
        return null;
    }

    // ファイル名: 日付時間_フォルダ名.json
    var safeFolderName = sanitizeFileName(folderName);
    var dateTimeStr = getDateTimeString();
    var fileName = dateTimeStr + "_" + safeFolderName + ".json";
    var saveFilePath = SAVE_DATA_BASE_PATH + "/" + fileName;

    // セーブデータにパス情報を追加
    scanData.saveDataPath = saveFilePath;
    scanData.initialSave = true;
    scanData.originalFolderName = folderName;

    // JSONファイルを保存（圧縮形式：読解性なし、Photoshop読み込み最適化）
    var saveFile = new File(saveFilePath);
    try {
        saveFile.encoding = "UTF-8";
        saveFile.open("w");
        saveFile.write(JSON.stringify(scanData));
        saveFile.close();
        return saveFilePath;
    } catch (e) {
        alert("セーブデータの保存に失敗しました:\n" + e.message + "\n\nパス: " + saveFilePath);
        return null;
    }
}

/**
 * ★★★ タイトル/レーベル入力時：旧データ削除→レーベルフォルダに新規保存 ★★★
 * ファイル名: タイトル_巻数巻_scandata.json
 */
function saveScanDataWithInfo(scanData, label, title, volume) {
    if (!label || label === "") {
        alert("レーベル名が設定されていません。\n作品情報タブでレーベル名を入力してください。");
        return null;
    }
    if (!title || title === "") {
        alert("タイトル名が設定されていません。\n作品情報タブでタイトル名を入力してください。");
        return null;
    }

    // 旧セーブデータを削除
    if (scanData.saveDataPath) {
        var oldFile = new File(scanData.saveDataPath);
        if (oldFile.exists) {
            try {
                oldFile.remove();
            } catch (e) {
                // 削除失敗は警告のみ
            }
        }
    }

    // ファイル名に使えない文字を置換
    var safeLabel = sanitizeFileName(label);
    var safeTitle = sanitizeFileName(title);

    // ★★★ タイトルに既に巻数が含まれている場合はvolumeStrを追加しない ★★★
    // 巻数パターン: 「1巻」「第1巻」「上巻」「下巻」「前編」「後編」など
    var volumePattern = /(\d+巻|第\d+巻|上巻|中巻|下巻|前編|後編|完結編)/;
    var titleHasVolume = volumePattern.test(safeTitle);
    var volumeStr = (volume && !titleHasVolume) ? (volume + "巻") : "";

    // レーベル名フォルダを作成
    var labelFolder = new Folder(SAVE_DATA_BASE_PATH + "/" + safeLabel);
    if (!labelFolder.exists) {
        var created = labelFolder.create();
        if (!created) {
            alert("レーベルフォルダの作成に失敗しました:\n" + labelFolder.fsName);
            return null;
        }
    }

    // セーブデータに保存先パスを追加（巻数がある場合は含める）
    // ★★★ ファイル名は常に巻数なし（JSON編集モードでの自動読み込み対応）★★★
    var fileName = safeTitle + "_scandata.json";
    var saveFilePath = labelFolder.fsName + "/" + fileName;
    scanData.saveDataPath = saveFilePath;
    scanData.label = label;
    scanData.title = title;
    scanData.initialSave = false;

    // JSONファイルを保存（圧縮形式：読解性なし、Photoshop読み込み最適化）
    var saveFile = new File(saveFilePath);
    try {
        saveFile.encoding = "UTF-8";
        saveFile.open("w");
        saveFile.write(JSON.stringify(scanData));
        saveFile.close();
    } catch (e) {
        alert("セーブデータの保存に失敗しました:\n" + e.message + "\n\nパス: " + saveFilePath);
        return null;
    }

    // ★★★ テキストログを出力（レーベル/タイトル確定後）★★★
    if (scanData.textLogByFolder) {
        // 巻数は引数を優先、なければscanData.startVolume、最後にscanData.workInfo.volumeを使用
        var logVolume = volume || scanData.startVolume || (scanData.workInfo ? scanData.workInfo.volume : 1) || 1;
        // ★★★ 個別巻数マッピングがあれば渡す ★★★
        var folderVolumeMapping = scanData.folderVolumeMapping || null;
        // ★★★ 編集済みルビリストがあれば渡す ★★★
        var editedRubyList = scanData.editedRubyList || null;
        var textLogPath = exportTextLog(scanData.textLogByFolder, label, title, logVolume, folderVolumeMapping, editedRubyList);
        if (textLogPath) {
            alert("テキストログを出力しました:\n" + textLogPath);
        }
    }

    return saveFilePath;
}

/**
 * ★★★ 後方互換用：従来のsaveScanDataToServer ★★★
 */
function saveScanDataToServer(scanData, label, title) {
    return saveScanDataWithInfo(scanData, label, title, scanData.workInfo ? scanData.workInfo.volume : null);
}

/**
 * ★★★ テキストログ用：テキストレイヤーからテキストとY座標を収集（下から上順）★★★
 * @param {Document} doc - 対象ドキュメント
 * @returns {Array} テキスト情報の配列（Y座標降順＝下から上）
 */
function collectTextForLog(doc) {
    var textData = [];

    // ★★★ 先にリンクグループを検出 ★★★
    var linkedMap = detectLinkedLayerGroups(doc);

    function getLayerId(layer) {
        try {
            app.activeDocument.activeLayer = layer;
            var ref = new ActionReference();
            ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
            var desc = executeActionGet(ref);
            return desc.getInteger(stringIDToTypeID("layerID"));
        } catch (e) {
            return null;
        }
    }

    function scanLayers(parent) {
        for (var i = 0; i < parent.layers.length; i++) {
            var layer = parent.layers[i];

            // 非表示レイヤーは除外
            if (!layer.visible) continue;

            try {
                if (layer.typename === "LayerSet") {
                    // フォルダの場合は再帰
                    scanLayers(layer);
                } else if (layer.kind === LayerKind.TEXT) {
                    // テキストレイヤーの場合
                    try {
                        var textItem = layer.textItem;
                        var content = textItem.contents || "";

                        // 空のテキストはスキップ
                        if (trimString(content) === "") continue;

                        // Y座標を取得（boundsの上端）
                        var bounds = layer.bounds;
                        var yPos = bounds[1].as("px"); // 上端のY座標

                        // フォントサイズを取得
                        var fontSize = 0;
                        try {
                            fontSize = textItem.size.as("pt");
                        } catch (e) {
                            fontSize = 0;
                        }

                        // ★★★ リンク情報を取得（事前検出結果を使用）★★★
                        var layerId = getLayerId(layer);
                        var isLinked = false;
                        var linkGroupId = null;

                        if (layerId && linkedMap[layerId]) {
                            isLinked = true;
                            linkGroupId = linkedMap[layerId];
                        } else {
                            // フォールバック: 従来の方法も試す
                            var linkInfo = getLayerLinkInfo(layer);
                            isLinked = linkInfo.isLinked;
                            linkGroupId = linkInfo.linkGroupId;
                        }

                        textData.push({
                            content: content,
                            yPos: yPos,
                            layerName: layer.name,
                            fontSize: fontSize,
                            isLinked: isLinked,
                            linkGroupId: linkGroupId
                        });
                    } catch (e) {
                        // テキスト取得エラーは無視
                    }
                }
            } catch (e) {
                // レイヤーアクセスエラーは無視
            }
        }
    }

    scanLayers(doc);

    // Y座標で降順ソート（下から上へ）
    textData.sort(function(a, b) {
        return b.yPos - a.yPos;
    });

    return textData;
}

/**
 * ★★★ デバッグモード（リンク検出のデバッグ用）★★★
 */
var DEBUG_LINK_DETECTION = false; // デバッグ時はtrueに変更

/**
 * ★★★ レイヤーのリンク情報を取得する関数 ★★★
 * @param {Layer} layer - 判定対象のレイヤー
 * @returns {Object} { isLinked: boolean, linkGroupId: string|null }
 */
function getLayerLinkInfo(layer) {
    var result = { isLinked: false, linkGroupId: null };
    try {
        // レイヤーをアクティブにする
        app.activeDocument.activeLayer = layer;

        // Action Managerでレイヤー情報を取得
        var ref = new ActionReference();
        ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
        var desc = executeActionGet(ref);

        // レイヤーIDを取得
        var layerId = desc.getInteger(stringIDToTypeID("layerID"));

        // 方法1: linkedLayerIDsキーをチェック
        if (desc.hasKey(stringIDToTypeID("linkedLayerIDs"))) {
            var linkedList = desc.getList(stringIDToTypeID("linkedLayerIDs"));
            if (linkedList.count > 0) {
                result.isLinked = true;
                // リンクグループIDを生成（リンクされたレイヤーIDをソートして結合）
                var ids = [layerId]; // 自分自身も含める
                for (var i = 0; i < linkedList.count; i++) {
                    ids.push(linkedList.getInteger(i));
                }
                ids.sort(function(a, b) { return a - b; });
                result.linkGroupId = ids.join("_");
                return result;
            }
        }

        // 方法2: linkedプロパティをチェック
        if (desc.hasKey(stringIDToTypeID("linked"))) {
            var isLinked = desc.getBoolean(stringIDToTypeID("linked"));
            if (isLinked) {
                result.isLinked = true;
                result.linkGroupId = "linked_" + layerId;
                return result;
            }
        }

        // 方法3: layerLockingキー内のlinkedを確認
        if (desc.hasKey(stringIDToTypeID("layerLocking"))) {
            var lockDesc = desc.getObjectValue(stringIDToTypeID("layerLocking"));
            if (lockDesc.hasKey(stringIDToTypeID("protectNone")) === false) {
                // ロックされている場合もリンクの可能性
            }
        }

    } catch (e) {
        // エラー時はデフォルト値を返す
    }
    return result;
}

/**
 * ★★★ ドキュメント内のリンクされたテキストレイヤーグループを検出する関数 ★★★
 * 全レイヤーを走査し、「リンクを選択」コマンドでリンクグループを特定
 * @param {Document} doc - 対象ドキュメント
 * @returns {Object} { layerId: linkGroupId } のマッピング
 */
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
        } catch (e) {
            return null;
        }
    }

    function selectLinkedLayers() {
        try {
            var desc = new ActionDescriptor();
            var ref = new ActionReference();
            ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
            desc.putReference(charIDToTypeID("null"), ref);
            executeAction(stringIDToTypeID("selectLinkedLayers"), desc, DialogModes.NO);
            return true;
        } catch (e) {
            return false;
        }
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
                for (var i = 0; i < list.count; i++) {
                    ids.push(list.getInteger(i));
                }
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
                        // このレイヤーを選択してリンクを選択
                        app.activeDocument.activeLayer = layer;
                        if (selectLinkedLayers()) {
                            var selectedIds = getSelectedLayerIds();
                            if (selectedIds.length > 1) {
                                // リンクグループが見つかった
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

    try {
        scanForLinks(doc);
    } catch (e) {}

    return linkedMap;
}

/**
 * ★★★ レイヤーがリンクされているかどうかを判定する関数（後方互換性用）★★★
 * @param {Layer} layer - 判定対象のレイヤー
 * @returns {boolean} リンクされている場合true
 */
function isLayerLinked(layer) {
    return getLayerLinkInfo(layer).isLinked;
}

/**
 * ★★★ ゼロパディング関数（01, 02形式）★★★
 * @param {Number} num - 数値
 * @param {Number} digits - 桁数
 * @returns {String} ゼロパディングされた文字列
 */
function zeroPad(num, digits) {
    var str = String(num);
    while (str.length < digits) {
        str = "0" + str;
    }
    return str;
}

/**
 * ★★★ 全角数字を半角数字に変換する関数 ★★★
 * @param {String} str - 変換対象の文字列
 * @returns {String} 半角数字に変換された文字列
 */
function convertFullWidthToHalfWidth(str) {
    if (!str) return str;
    return String(str).replace(/[０-９]/g, function(s) {
        return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
    });
}

/**
 * ★★★ 巻数入力値を正規化する関数 ★★★
 * - 全角数字を半角に変換
 * - 数字のみの場合は数値として返す
 * - 「巻」が付いている場合は除去して数値として返す
 * @param {String} input - 入力値
 * @returns {Number|null} 正規化された巻数（無効な場合はnull）
 */
function normalizeVolumeInput(input) {
    if (!input) return null;
    // 全角数字を半角に変換
    var normalized = convertFullWidthToHalfWidth(String(input));
    // 「巻」を除去
    normalized = normalized.replace(/巻/g, "");
    // 前後の空白を除去
    normalized = normalized.replace(/^\s+|\s+$/g, "");
    // 数値に変換
    var num = parseInt(normalized, 10);
    if (isNaN(num) || num < 1) return null;
    return num;
}

/**
 * ★★★ 自然順ソート比較関数（1, 2, 3, 10, 11の順にソート）★★★
 * @param {String} a - 比較対象1
 * @param {String} b - 比較対象2
 * @returns {Number} ソート順序
 */
function naturalSortCompare(a, b) {
    // 文字列を数値部分と非数値部分に分割
    var aParts = String(a).split(/(\d+)/);
    var bParts = String(b).split(/(\d+)/);

    var maxLen = Math.max(aParts.length, bParts.length);
    for (var i = 0; i < maxLen; i++) {
        var aPart = aParts[i] || "";
        var bPart = bParts[i] || "";

        // 両方が数値の場合、数値として比較
        var aNum = parseInt(aPart, 10);
        var bNum = parseInt(bPart, 10);

        if (!isNaN(aNum) && !isNaN(bNum)) {
            if (aNum !== bNum) {
                return aNum - bNum;
            }
        } else {
            // 文字列として比較
            if (aPart !== bPart) {
                return aPart < bPart ? -1 : 1;
            }
        }
    }
    return 0;
}

/**
 * ★★★ テキストログファイルを出力（レーベル/タイトル/フォルダ階層対応）★★★
 * @param {Object} textLogByFolder - フォルダ名をキー、{docName: [テキストデータ]}を値とするオブジェクト
 * @param {String} label - レーベル名
 * @param {String} title - タイトル名
 * @param {Number} volume - 開始巻数（この巻数からナンバリング）
 * @param {Object} folderVolumeMapping - フォルダ名→巻数のマッピング（オプション）
 * @param {Array} editedRubyList - 編集済みルビリスト（オプション）
 * @returns {String|null} 保存したフォルダパス、または失敗時null
 */
function exportTextLog(textLogByFolder, label, title, volume, folderVolumeMapping, editedRubyList) {
    // パラメータチェック
    if (!label || label === "") {
        alert("テキストログ出力にはレーベル名が必要です。\n作品情報タブでレーベル名を入力してください。");
        return null;
    }
    if (!title || title === "") {
        alert("テキストログ出力にはタイトル名が必要です。\n作品情報タブでタイトル名を入力してください。");
        return null;
    }
    if (!textLogByFolder) {
        return null;
    }

    // テキストログベースフォルダの存在確認
    var baseFolder = new Folder(TEXT_LOG_FOLDER_PATH);
    if (!baseFolder.exists) {
        if (!baseFolder.create()) {
            alert("テキストログフォルダを作成できませんでした:\n" + TEXT_LOG_FOLDER_PATH);
            return null;
        }
    }

    // レーベルフォルダを作成
    var safeLabel = sanitizeFileName(label);
    var labelFolder = new Folder(TEXT_LOG_FOLDER_PATH + "/" + safeLabel);
    if (!labelFolder.exists) {
        if (!labelFolder.create()) {
            alert("レーベルフォルダを作成できませんでした:\n" + labelFolder.fsName);
            return null;
        }
    }

    // タイトルフォルダを作成
    var safeTitle = sanitizeFileName(title);
    var titleFolder = new Folder(labelFolder.fsName + "/" + safeTitle);
    if (!titleFolder.exists) {
        if (!titleFolder.create()) {
            alert("タイトルフォルダを作成できませんでした:\n" + titleFolder.fsName);
            return null;
        }
    }

    var savedCount = 0;

    // ★★★ ルビ一覧用：リンクされたテキストをリンクグループごとに収集（全フォルダ共通）★★★
    var linkedGroups = {}; // linkGroupId -> { pageNum, docName, texts: [{content, fontSize, layerName}] }

    // ★★★ フォルダ名を収集して自然順ソート（1, 2, 10の順）★★★
    var folderNames = [];
    for (var folderName in textLogByFolder) {
        if (textLogByFolder.hasOwnProperty(folderName)) {
            folderNames.push(folderName);
        }
    }
    folderNames.sort(naturalSortCompare); // 自然順ソート（1, 2, 3, 10, 11の順）

    // ★★★ 開始巻数を設定（デフォルトは1）★★★
    var startVolume = volume || 1;

    // 各フォルダごとにテキストファイルを出力（ソート順にナンバリング）
    for (var folderIdx = 0; folderIdx < folderNames.length; folderIdx++) {
        var srcFolderName = folderNames[folderIdx];

        // ★★★ 個別巻数マッピングがあればそれを使用、なければ連番 ★★★
        var currentVolume;
        if (folderVolumeMapping && folderVolumeMapping[srcFolderName] !== undefined) {
            currentVolume = folderVolumeMapping[srcFolderName];
        } else {
            currentVolume = startVolume + folderIdx; // 連番（開始巻数 + フォルダインデックス）
        }
        var volumeStr = zeroPad(currentVolume, 2); // ゼロパディング（01, 02形式）

        var folderData = textLogByFolder[srcFolderName];

        // ドキュメント名（ページ番号）でソート
        var docNames = [];
        for (var docName in folderData) {
            if (folderData.hasOwnProperty(docName)) {
                docNames.push(docName);
            }
        }

        if (docNames.length === 0) continue;

        // ページ番号順にソート（ファイル名から数字を抽出）
        docNames.sort(function(a, b) {
            var numA = parseInt(a.replace(/[^0-9]/g, ""), 10) || 0;
            var numB = parseInt(b.replace(/[^0-9]/g, ""), 10) || 0;
            return numA - numB;
        });

        // テキストログを生成（先頭に巻数表記を追加）
        var logContent = "[" + volumeStr + "巻]\n\n";
        var pageNum = 1;

        for (var i = 0; i < docNames.length; i++) {
            var docName = docNames[i];
            var texts = folderData[docName];

            // ページ区切りを追加
            logContent += "<<" + pageNum + "Page>>\n";

            // テキストを追加（各テキストは改行で区切り、レイヤーが変わるごとに空行を追加）
            for (var j = 0; j < texts.length; j++) {
                var content = texts[j].content;
                // 改行を保持してテキストを追加（段落を再現）
                logContent += content + "\n";

                // ★★★ レイヤーが変わるごとに空行を追加 ★★★
                logContent += "\n";

                // ★★★ リンクされたテキストをグループごとに収集（ルビ一覧用）★★★
                if (texts[j].isLinked && texts[j].linkGroupId) {
                    var groupId = texts[j].linkGroupId;
                    if (!linkedGroups[groupId]) {
                        linkedGroups[groupId] = {
                            pageNum: pageNum,
                            docName: docName,
                            volumeStr: volumeStr, // 巻数情報を追加
                            texts: []
                        };
                    }
                    linkedGroups[groupId].texts.push({
                        content: content,
                        fontSize: texts[j].fontSize || 0,
                        layerName: texts[j].layerName || ""
                    });
                }
            }

            // ページ間に空行を追加
            logContent += "\n";
            pageNum++;
        }

        // ファイル名を生成（巻数.txt）
        var filePath = titleFolder.fsName + "/" + volumeStr + "巻.txt";

        // ファイルに保存
        var logFile = new File(filePath);
        try {
            logFile.encoding = "UTF-8";
            logFile.open("w");
            logFile.write(logContent);
            logFile.close();
            savedCount++;
        } catch (e) {
            alert("テキストログの保存に失敗しました:\n" + e.message + "\n\nパス: " + filePath);
        }
    }

    // ★★★ ルビ一覧の生成（編集済みリストがあればそれを使用）★★★
    var rubyContent = "";
    var hasRubyData = false;

    // ★★★ 編集済みルビリストがあればそれを使用 ★★★
    if (editedRubyList && editedRubyList.length > 0) {
        hasRubyData = true;
        // 巻数・ページ順でソート
        var sortedRubyList = editedRubyList.slice();
        sortedRubyList.sort(function(a, b) {
            if (a.volume !== b.volume) {
                return (a.volume || "01").localeCompare(b.volume || "01");
            }
            return (a.page || 1) - (b.page || 1);
        });

        for (var ri = 0; ri < sortedRubyList.length; ri++) {
            var rubyItem = sortedRubyList[ri];
            var volStr = rubyItem.volume || "01";
            var pageNum = rubyItem.page || 1;
            var filePagePrefix = "[" + volStr + "巻-" + pageNum + "]";
            // ★★★ ルビから空白（半角・全角）を除去して出力 ★★★
            var cleanRuby = (rubyItem.ruby || "").replace(/[\s\u3000]/g, "");
            var rubyLine = filePagePrefix + rubyItem.parent + "(" + cleanRuby + ")";
            rubyContent += rubyLine + "\n\n";
        }
    } else {
        // ★★★ リンクグループから抽出（従来の処理）★★★
        var hasLinkedGroups = false;
        for (var gid in linkedGroups) {
            if (linkedGroups.hasOwnProperty(gid)) {
                hasLinkedGroups = true;
                break;
            }
        }

        if (hasLinkedGroups) {
            hasRubyData = true;

            // 各リンクグループを処理
            for (var groupId in linkedGroups) {
                if (!linkedGroups.hasOwnProperty(groupId)) continue;

                var group = linkedGroups[groupId];
                var groupTexts = group.texts;

                // フォントサイズでソート（大きい順）
                groupTexts.sort(function(a, b) {
                    return b.fontSize - a.fontSize;
                });

                // 最大フォントサイズのテキストを親文字、それ以外をルビとする
                if (groupTexts.length >= 2) {
                    var parentText = groupTexts[0].content; // 最大フォントサイズ = 親文字

                    // ★★★ ルビを括弧形式と通常形式に分類 ★★★
                    var bracketRubies = []; // レイヤー名が括弧形式のルビ
                    var normalRubies = [];  // 通常形式のルビ

                    for (var t = 1; t < groupTexts.length; t++) {
                        var rubyText = groupTexts[t].content;
                        var rubyLayerName = groupTexts[t].layerName || "";

                        // ★★★ ルビから空白（半角・全角）を除去 ★★★
                        var trimmedRuby = rubyText.replace(/[\s\u3000]/g, "");

                        // ★★★ ルビが「・」「゛」のみで構成されている場合はスキップ ★★★
                        if (/^[・･゛]+$/.test(trimmedRuby)) {
                            continue;
                        }

                        // ★★★ レイヤー名が括弧形式かチェック ★★★
                        // 例: 「あじさい(紫陽花)」→ 括弧内「紫陽花」が親文字、括弧前「あじさい」がルビ
                        var bracketMatch = rubyLayerName.match(/^(.+?)[\(（](.+?)[\)）]$/);
                        if (bracketMatch) {
                            // 括弧形式のルビも空白を除去
                            var bracketRuby = bracketMatch[1].replace(/[\s\u3000]/g, "");
                            bracketRubies.push({
                                ruby: bracketRuby,          // 括弧前 = ルビ（空白除去済み）
                                parent: bracketMatch[2]     // 括弧内 = 親文字
                            });
                        } else {
                            // 通常形式のルビも空白を除去
                            normalRubies.push(trimmedRuby);
                        }
                    }

                    // ★★★ 巻数-ページ数 形式のプレフィックス ★★★
                    var volStr = group.volumeStr || "01";
                    var filePagePrefix = "[" + volStr + "巻-" + group.pageNum + "]";

                    // ★★★ 括弧形式のルビを出力（親文字レイヤーはスキップ）★★★
                    for (var b = 0; b < bracketRubies.length; b++) {
                        var rubyLine = filePagePrefix + bracketRubies[b].parent + "(" + bracketRubies[b].ruby + ")";
                        rubyContent += rubyLine + "\n\n";
                    }

                    // ★★★ 通常形式のルビを出力 ★★★
                    if (normalRubies.length > 0) {
                        var rubyLine = filePagePrefix + parentText;
                        for (var n = 0; n < normalRubies.length; n++) {
                            rubyLine += "(" + normalRubies[n] + ")";
                        }
                        rubyContent += rubyLine + "\n\n";
                    }
                }
            }
        }
    }

    // ★★★ ルビ一覧ファイルに保存 ★★★
    if (hasRubyData && rubyContent !== "") {
        var rubyFilePath = titleFolder.fsName + "/ルビ一覧.txt";
        var rubyFile = new File(rubyFilePath);
        try {
            rubyFile.encoding = "UTF-8";
            rubyFile.open("w");
            rubyFile.write(rubyContent);
            rubyFile.close();
        } catch (e) {
            alert("ルビ一覧の保存に失敗しました:\n" + e.message);
        }
    }

    if (savedCount > 0) {
        return titleFolder.fsName;
    }
    return null;
}

/**
 * テキストレイヤーを収集（非表示レイヤーは除外）
 */
function collectTextLayers(parent) {
    var textLayers = [];
    for (var i = 0; i < parent.layers.length; i++) {
        var layer = parent.layers[i];
        // ★★★ 非表示レイヤーは除外 ★★★
        if (!layer.visible) continue;

        if (layer.typename === "LayerSet") {
            var subLayers = collectTextLayers(layer);
            textLayers = textLayers.concat(subLayers);
        } else if (layer.kind === LayerKind.TEXT) {
            textLayers.push(layer);
        }
    }
    return textLayers;
}

/**
 * ★★★ 統合検出関数：フォント種類・サイズ・白フチ・テキストレイヤーリストを1回の走査で検出 ★★★
 */
function detectUsedFonts() {
    var usedFonts = {};
    var allFontSizes = {};
    var strokeStats = {};
    var textLayersByDoc = {}; // ドキュメントごとのテキストレイヤーリスト

    if (app.documents.length === 0) {
        return {fonts: [], sizeStats: null, strokeStats: null, textLayersByDoc: {}};
    }

    for (var d = 0; d < app.documents.length; d++) {
        var doc = app.documents[d];
        app.activeDocument = doc;
        var docId = doc.name;
        textLayersByDoc[docId] = [];
        // ★★★ 1回の走査で全情報を収集 ★★★
        collectAllInfoOptimized(doc, doc, usedFonts, allFontSizes, strokeStats, textLayersByDoc[docId]);
    }

    var fontArray = [];
    for (var font in usedFonts) {
        var sizes = [];
        for (var size in usedFonts[font].sizes) {
            sizes.push({
                size: parseFloat(size),
                count: usedFonts[font].sizes[size]
            });
        }
        sizes.sort(function(a, b) { return b.count - a.count; });

        fontArray.push({
            name: font,
            displayName: getFontDisplayName(font),
            count: usedFonts[font].count,
            sizes: sizes
        });
    }

    fontArray.sort(function(a, b) { return b.count - a.count; });

    var sizeStats = calculateFontSizeStats(allFontSizes);

    var strokeArray = [];
    for (var size in strokeStats) {
        var fontSizes = strokeStats[size].fontSizes || {};
        var fontSizeArray = [];
        for (var fs in fontSizes) {
            fontSizeArray.push(parseFloat(fs));
        }
        fontSizeArray.sort(function(a, b) { return b - a; });
        var maxFontSize = fontSizeArray.length > 0 ? fontSizeArray[0] : null;

        strokeArray.push({
            size: parseFloat(size),
            count: strokeStats[size].count,
            fontSizes: fontSizeArray,
            maxFontSize: maxFontSize
        });
    }
    strokeArray.sort(function(a, b) { return b.count - a.count; });

    return {
        fonts: fontArray,
        sizeStats: sizeStats,
        strokeStats: { sizes: strokeArray, stats: strokeStats },
        textLayersByDoc: textLayersByDoc
    };
}

/**
 * ★★★ 最適化された統合走査関数：1回の走査で全情報を収集（追加走査なし）★★★
 * 戻り値: { isTextOnly: boolean, maxFontSize: number|null, hasVisibleText: boolean }
 */
function collectAllInfoOptimized(doc, parent, usedFonts, allFontSizes, strokeStats, textLayerList) {
    var result = { isTextOnly: true, maxFontSize: null, hasVisibleText: false };

    for (var i = 0; i < parent.layers.length; i++) {
        var layer = parent.layers[i];

        // 非表示レイヤーは除外
        if (!layer.visible) continue;

        try {
            if (layer.typename === "LayerSet") {
                // フォルダの場合
                if (layer.layers.length === 0) continue;

                // サブレイヤーを再帰的に処理し、結果を取得
                var subResult = collectAllInfoOptimized(doc, layer, usedFonts, allFontSizes, strokeStats, textLayerList);

                // 親フォルダの isTextOnly を更新
                if (!subResult.isTextOnly) {
                    result.isTextOnly = false;
                }

                // 親フォルダの maxFontSize を更新
                if (subResult.maxFontSize !== null) {
                    if (result.maxFontSize === null || subResult.maxFontSize > result.maxFontSize) {
                        result.maxFontSize = subResult.maxFontSize;
                    }
                    result.hasVisibleText = true;
                }

                // フォルダが「テキストのみ」で、中に有効なテキストがある場合、フォルダの白フチをチェック
                if (subResult.isTextOnly && subResult.hasVisibleText && subResult.maxFontSize !== null) {
                    var folderStrokeSize = getLayerStrokeSize(layer);
                    if (folderStrokeSize !== null && folderStrokeSize > 0) {
                        if (!strokeStats[folderStrokeSize]) {
                            strokeStats[folderStrokeSize] = { count: 0, fontSizes: {} };
                        }
                        strokeStats[folderStrokeSize].count++;
                        strokeStats[folderStrokeSize].fontSizes[subResult.maxFontSize] = true;
                    }
                }

            } else if (layer.kind === LayerKind.TEXT) {
                // テキストレイヤーの場合
                result.hasVisibleText = true;

                try {
                    var textItem = layer.textItem;
                    var fontName = textItem.font;
                    var fontSize = Math.round(textItem.size.value * 10) / 10;

                    // ★★★ テキストレイヤー情報をデータとして保存（PSD閉じても維持可能）★★★
                    var content = textItem.contents || "";
                    if (content.length > 30) content = content.substring(0, 30) + "...";
                    content = content.replace(/\r\n/g, " ").replace(/\n/g, " ").replace(/\r/g, " ");

                    textLayerList.push({
                        layerName: layer.name,
                        content: content,
                        fontSize: fontSize,
                        fontName: fontName,
                        displayFontName: getFontDisplayName(fontName),
                        docName: doc.name,
                        docPath: doc.path ? doc.path.fsName : null
                    });

                    // フォント情報を収集
                    if (!usedFonts[fontName]) {
                        usedFonts[fontName] = { count: 0, sizes: {} };
                    }
                    usedFonts[fontName].count++;
                    if (!usedFonts[fontName].sizes[fontSize]) {
                        usedFonts[fontName].sizes[fontSize] = 0;
                    }
                    usedFonts[fontName].sizes[fontSize]++;

                    // 全体のフォントサイズ統計
                    if (!allFontSizes[fontSize]) {
                        allFontSizes[fontSize] = 0;
                    }
                    allFontSizes[fontSize]++;

                    // maxFontSize を更新
                    if (result.maxFontSize === null || fontSize > result.maxFontSize) {
                        result.maxFontSize = fontSize;
                    }

                    // 白フチ情報を収集
                    var strokeSize = getLayerStrokeSize(layer);
                    if (strokeSize !== null && strokeSize > 0) {
                        if (!strokeStats[strokeSize]) {
                            strokeStats[strokeSize] = { count: 0, fontSizes: {} };
                        }
                        strokeStats[strokeSize].count++;
                        strokeStats[strokeSize].fontSizes[fontSize] = true;
                    }
                } catch (e) {}

            } else {
                // テキスト以外のレイヤーがある場合
                result.isTextOnly = false;
            }
        } catch (e) {}
    }

    return result;
}

/**
 * ガイド線関連の関数
 */
function getGuideInfo(doc) {
    var guides = {
        horizontal: [],
        vertical: []
    };
    if (!doc) return guides;
    
    try {
        var docGuides = doc.guides;
        if (!docGuides) return guides;
        
        for (var i = 0; i < docGuides.length; i++) {
            try {
                var guide = docGuides[i];
                var coord;
                if (typeof guide.coordinate === 'object' && guide.coordinate.value !== undefined) {
                    coord = guide.coordinate.value;
                } else {
                    coord = guide.coordinate;
                }
                var directionStr = guide.direction.toString();
                
                if (directionStr.indexOf("HORIZONTAL") >= 0 || directionStr.indexOf("Horizontal") >= 0) {
                    guides.horizontal.push(coord);
                } else if (directionStr.indexOf("VERTICAL") >= 0 || directionStr.indexOf("Vertical") >= 0) {
                    guides.vertical.push(coord);
                }
            } catch (e) {
            }
        }
    } catch (e) {
    }
    return guides;
}

/**
 * ★★★ ガイド線セットのハッシュを生成（グローバルスコープ）★★★
 */
function getGuideSetHash(guideSet) {
    try {
        var hArray = [];
        for (var i = 0; i < guideSet.horizontal.length; i++) {
            hArray.push(guideSet.horizontal[i].toFixed(1));
        }
        var vArray = [];
        for (var j = 0; j < guideSet.vertical.length; j++) {
            vArray.push(guideSet.vertical[j].toFixed(1));
        }
        var h = hArray.join(",");
        var v = vArray.join(",");
        return "H:" + h + "|V:" + v;
    } catch (e) {
        return "ERROR";
    }
}

/**
 * ★★★ ガイドセットが有効なタチキリ枠かどうかを判定 ★★★
 * 中心を挟んで上下左右、それぞれに1本以上ガイド線がないものは無効
 * ちょうど中心（許容誤差1px以内）のガイド線は除外
 */
function isValidTachikiriGuideSet(guideSet) {
    try {
        // ドキュメントサイズがない場合は有効とみなす（後方互換性）
        if (!guideSet.docWidth || !guideSet.docHeight) {
            return true;
        }

        var centerX = guideSet.docWidth / 2;
        var centerY = guideSet.docHeight / 2;
        var tolerance = 1; // 中心からの許容誤差（px）

        // 水平ガイド線（上下判定）: 中心より上に1本以上、下に1本以上必要
        var hasAbove = false;
        var hasBelow = false;
        for (var h = 0; h < guideSet.horizontal.length; h++) {
            var hPos = guideSet.horizontal[h];
            // ちょうど中心のガイド線は除外
            if (Math.abs(hPos - centerY) <= tolerance) {
                continue;
            }
            if (hPos < centerY) {
                hasAbove = true;
            } else {
                hasBelow = true;
            }
        }

        // 垂直ガイド線（左右判定）: 中心より左に1本以上、右に1本以上必要
        var hasLeft = false;
        var hasRight = false;
        for (var v = 0; v < guideSet.vertical.length; v++) {
            var vPos = guideSet.vertical[v];
            // ちょうど中心のガイド線は除外
            if (Math.abs(vPos - centerX) <= tolerance) {
                continue;
            }
            if (vPos < centerX) {
                hasLeft = true;
            } else {
                hasRight = true;
            }
        }

        // 上下左右すべてにガイド線があるか
        return hasAbove && hasBelow && hasLeft && hasRight;
    } catch (e) {
        return true; // エラー時は有効とみなす
    }
}

function calculateFontSizeStats(allFontSizes) {
    var sizeArray = [];
    for (var size in allFontSizes) {
        sizeArray.push({
            size: parseFloat(size),
            count: allFontSizes[size]
        });
    }
    if (sizeArray.length === 0) return null;
    
    sizeArray.sort(function(a, b) { return b.count - a.count; });
    
    var mostFrequent = sizeArray[0];
    var halfSize = mostFrequent.size / 2;
    var excludeMin = halfSize - 1;
    var excludeMax = halfSize + 1;
    
    var filteredSizes = [];
    for (var i = 0; i < sizeArray.length; i++) {
        if (sizeArray[i].count >= 2) {
            if (sizeArray[i].size < excludeMin || sizeArray[i].size > excludeMax) {
                filteredSizes.push(sizeArray[i]);
            }
        }
    }
    
    var top10 = filteredSizes.slice(0, 10);

    var sizesForExport = [];
    var top10SizesForExport = [];  // ★★★ 出現数順（多い順）＋カウント情報 ★★★
    for (var i = 0; i < top10.length; i++) {
        sizesForExport.push(top10[i].size);
        top10SizesForExport.push({ size: top10[i].size, count: top10[i].count });
    }
    sizesForExport.sort(function(a, b) { return a - b; });

    return {
        mostFrequent: mostFrequent,
        top10: top10,
        allSizes: sizeArray,  // ★★★ 全サイズ情報を含める ★★★
        excludeRange: {
            min: excludeMin,
            max: excludeMax
        },
        forExport: {
            mostFrequent: mostFrequent.size,
            sizes: sizesForExport,
            top10Sizes: top10SizesForExport,  // ★★★ 出現数上位10（{size, count}形式、出現数多い順） ★★★
            excludeRange: {
                min: excludeMin,
                max: excludeMax
            }
        }
    };
}

function convertStatsForExport(stats) {
    if (!stats) {
        return null;
    }

    // forExportがあればそれを使用（既に編集済みの場合）
    if (stats.forExport) {
        // ★★★ top10Sizesがない場合はtop10から補完（{size, count}形式） ★★★
        if (!stats.forExport.top10Sizes && stats.top10) {
            var t10sizes = [];
            for (var ti = 0; ti < Math.min(stats.top10.length, 10); ti++) {
                var t10item = stats.top10[ti];
                if (typeof t10item === 'object' && t10item !== null && t10item.size > 0) {
                    t10sizes.push({ size: t10item.size, count: t10item.count || 0 });
                }
            }
            stats.forExport.top10Sizes = t10sizes;
        }
        return stats.forExport;
    }

    // ★★★ forExportがない場合は既存のデータから構築 ★★★
    var result = {};

    // mostFrequentを取得
    if (stats.mostFrequent) {
        if (typeof stats.mostFrequent === 'number') {
            result.mostFrequent = stats.mostFrequent;
        } else if (typeof stats.mostFrequent === 'object' && stats.mostFrequent.size) {
            result.mostFrequent = stats.mostFrequent.size;
        }
    }

    // excludeRangeを取得
    if (stats.excludeRange) {
        result.excludeRange = {
            min: stats.excludeRange.min || 0,
            max: stats.excludeRange.max || 0
        };
    } else if (result.mostFrequent && result.mostFrequent > 0) {
        // excludeRangeがない場合は計算
        var halfSize = result.mostFrequent / 2;
        result.excludeRange = {
            min: halfSize - 1,
            max: halfSize + 1
        };
    }

    // sizesを取得（top10またはsizesまたはallSizesから）
    var sizes = [];
    var sizeExists = {}; // 重複チェック用オブジェクト（ES3対応）
    var sourceArray = stats.top10 || stats.sizes || stats.allSizes || [];

    for (var i = 0; i < sourceArray.length; i++) {
        var item = sourceArray[i];
        var sizeVal = 0;
        if (typeof item === 'number') {
            sizeVal = item;
        } else if (typeof item === 'object' && item !== null) {
            sizeVal = item.size || 0;
        }
        if (sizeVal > 0 && !sizeExists[sizeVal]) {
            sizes.push(sizeVal);
            sizeExists[sizeVal] = true;
        }
    }

    // サイズを昇順でソート
    sizes.sort(function(a, b) { return a - b; });
    result.sizes = sizes;

    // ★★★ 上位10サイズを明示的に別保存（{size, count}形式、出現数多い順） ★★★
    var top10Sizes = [];
    // excludeRange取得（フィルタリング用）
    var exMin = (result.excludeRange && result.excludeRange.min) ? result.excludeRange.min : 0;
    var exMax = (result.excludeRange && result.excludeRange.max) ? result.excludeRange.max : 0;

    if (stats.top10) {
        // スキャン直後のデータ（top10に{size, count}あり、既にフィルタ済み）
        for (var t = 0; t < Math.min(stats.top10.length, 10); t++) {
            var t10item = stats.top10[t];
            if (typeof t10item === 'object' && t10item !== null && t10item.size > 0) {
                top10Sizes.push({ size: t10item.size, count: t10item.count || 0 });
            }
        }
    } else if (stats.top10Sizes && stats.top10Sizes.length > 0) {
        // インポートデータ（既にtop10Sizesが{size, count}形式で存在）
        for (var t2 = 0; t2 < stats.top10Sizes.length; t2++) {
            var t10s = stats.top10Sizes[t2];
            if (typeof t10s === 'object' && t10s !== null && t10s.size > 0) {
                top10Sizes.push({ size: t10s.size, count: t10s.count || 0 });
            } else if (typeof t10s === 'number' && t10s > 0) {
                // 旧形式（数値のみ）の互換性対応
                top10Sizes.push({ size: t10s, count: 0 });
            }
        }
    } else if (sourceArray.length > 0 && typeof sourceArray[0] === 'object' && sourceArray[0] !== null && typeof sourceArray[0].count === 'number') {
        // ★★★ scandataのsizes形式（{size, count}オブジェクト配列、出現数順） ★★★
        // 出現数順にソートしてからフィルタリング＆上位10件を取得
        var sortedForTop10 = sourceArray.slice().sort(function(a, b) { return (b.count || 0) - (a.count || 0); });
        for (var t3 = 0; t3 < sortedForTop10.length && top10Sizes.length < 10; t3++) {
            var t10obj = sortedForTop10[t3];
            if (t10obj && t10obj.size > 0 && (t10obj.count || 0) >= 2) {
                // ルビ除外範囲を除外
                if (exMin > 0 && exMax > 0 && t10obj.size >= exMin && t10obj.size <= exMax) {
                    continue;
                }
                top10Sizes.push({ size: t10obj.size, count: t10obj.count || 0 });
            }
        }
    }
    // top10Sizesはソートしない（出現数順を維持）
    result.top10Sizes = top10Sizes;

    // データがあればresultを返す、なければnull
    if (result.mostFrequent || sizes.length > 0) {
        return result;
    }
    return null;
}

/**
 * ★★★ JSONエクスポート用：白フチサイズを保存（対応フォントサイズ情報も含む）★★★
 */
function convertStrokeSizesForExport(strokeStats) {
    if (!strokeStats || !strokeStats.sizes || strokeStats.sizes.length === 0) {
        return null;
    }
    var result = [];
    for (var i = 0; i < strokeStats.sizes.length; i++) {
        var item = strokeStats.sizes[i];
        result.push({
            size: item.size,
            fontSizes: item.fontSizes || []
        });
    }
    result.sort(function(a, b) { return a.size - b.size; });
    return result;
}

/**
 * ★★★ 数値のみの配列を1行にまとめるJSONフォーマット関数 ★★★
 * JSON.stringify(obj, null, 2) の結果を受け取り、
 * 数値だけの配列（sizes, fontSizes等）を改行なしの1行にする
 */
function formatJsonCompactNumberArrays(jsonStr) {
    // 数値のみの配列パターンを検出して1行に変換
    // パターン: [ の後に数値とカンマだけが改行で続き ] で閉じる
    var result = "";
    var i = 0;
    var len = jsonStr.length;

    while (i < len) {
        if (jsonStr.charAt(i) === '[') {
            // [ を見つけた：中身が数値のみかチェック
            var bracketStart = i;
            var j = i + 1;
            var isNumberOnly = true;
            var depth = 1;

            while (j < len && depth > 0) {
                var ch = jsonStr.charAt(j);
                if (ch === '[') { isNumberOnly = false; break; }
                if (ch === '{') { isNumberOnly = false; break; }
                if (ch === ']') { depth--; break; }
                if (ch === '"') { isNumberOnly = false; break; }
                j++;
            }

            if (isNumberOnly && depth === 0) {
                // 中身が数値のみ → 1行にまとめる
                var inner = jsonStr.substring(bracketStart + 1, j);
                // 改行・余分な空白を除去し、カンマ後にスペース1つ
                var compacted = inner.replace(/\s+/g, ' ').replace(/^\s+/, '').replace(/\s+$/, '');
                result += "[" + compacted + "]";
                i = j + 1;
            } else {
                result += jsonStr.charAt(i);
                i++;
            }
        } else {
            result += jsonStr.charAt(i);
            i++;
        }
    }
    return result;
}

function convertPresetsForExport(presets) {
    if (!presets) return {};
    
    var exportPresets = {};
    try {
        for (var setName in presets) {
            if (!presets[setName] || !presets[setName].length) {
                exportPresets[setName] = [];
                continue;
            }
            
            exportPresets[setName] = [];
            for (var i = 0; i < presets[setName].length; i++) {
                var preset = presets[setName][i];
                if (!preset) continue;
                
                var exportPreset = {
                    name: preset.name || "",
                    font: preset.font || ""
                };
                if (preset.subName) {
                    exportPreset.subName = preset.subName;
                }
                if (preset.description && preset.description.indexOf("使用回数:") === -1) {
                    exportPreset.description = preset.description;
                }
                exportPresets[setName].push(exportPreset);
            }
        }
    } catch (e) {
        return presets;
    }
    return exportPresets;
}

/**
 * プリセット管理ダイアログ
 */
function showPresetManagerDialog(autoDetect, scanData, jsonToImport) {
    var dialog = new Window("dialog", "作品情報", undefined, {
        resizeable: true
    });
    dialog.orientation = "column";
    dialog.alignChildren = ["fill", "top"];
    dialog.spacing = 10;
    dialog.margins = 15;
    dialog.preferredSize.width = 520;

    var lastUsedFile = null;


    // ★★★ scanDataからデータを取得（PSDは閉じているのでキャッシュを使用）★★★
    if (!scanData) scanData = null;

    var allPresetSets = { "デフォルト": [] };
    var currentSetName = "デフォルト";

    // ★★★ JSONエクスポート形式のプリセット読み込み ★★★
    if (scanData && scanData.presets) {
        for (var setName in scanData.presets) {
            if (scanData.presets.hasOwnProperty(setName)) {
                allPresetSets[setName] = scanData.presets[setName];
                currentSetName = setName;  // 最初に見つかったセット名を使用
            }
        }
    }

    // ★★★ プロパティ名の互換性対応（scandata形式/JSONエクスポート形式両対応）★★★
    // 参考スクリプトと同じシンプルな形式
    var lastFontSizeStats = scanData ? (scanData.detectedSizeStats || scanData.sizeStats || scanData.fontSizeStats) : null;

    // ★★★ 初期化時にmostFrequentをオブジェクト形式に統一（テキストタブとの連動のため）★★★
    if (lastFontSizeStats) {
        // mostFrequentが数値の場合はオブジェクト形式に変換
        if (typeof lastFontSizeStats.mostFrequent === 'number') {
            var baseSize = lastFontSizeStats.mostFrequent;
            lastFontSizeStats.mostFrequent = { size: baseSize, count: 0 };
        } else if (!lastFontSizeStats.mostFrequent && lastFontSizeStats.sizes && lastFontSizeStats.sizes.length > 0) {
            // mostFrequentがない場合、sizes[0]から取得
            var firstSize = lastFontSizeStats.sizes[0];
            var baseSize = (typeof firstSize === 'number') ? firstSize : (firstSize.size || 0);
            if (baseSize > 0) {
                lastFontSizeStats.mostFrequent = { size: baseSize, count: 0 };
            }
        }
        // excludeRangeがない場合は計算
        if (!lastFontSizeStats.excludeRange && lastFontSizeStats.mostFrequent && lastFontSizeStats.mostFrequent.size > 0) {
            var halfSize = lastFontSizeStats.mostFrequent.size / 2;
            lastFontSizeStats.excludeRange = { min: halfSize - 1, max: halfSize + 1 };
        }
    }

    var lastGuideData = null;
    var guideLoadResult = null;

    // ★★★ scanDataから作品情報を読み込む ★★★
    var workInfo = (scanData && scanData.workInfo) ? {
        genre: scanData.workInfo.genre || "",
        label: scanData.workInfo.label || "",
        authorType: scanData.workInfo.authorType || "single",
        author: scanData.workInfo.author || "",
        artist: scanData.workInfo.artist || "",
        original: scanData.workInfo.original || "",
        title: scanData.workInfo.title || "",
        subtitle: scanData.workInfo.subtitle || "",
        editor: scanData.workInfo.editor || "",
        volume: scanData.workInfo.volume || 1,
        storagePath: scanData.workInfo.storagePath || "",
        notes: scanData.workInfo.notes || "",
        completedPath: scanData.workInfo.completedPath || "",
        typesettingPath: scanData.workInfo.typesettingPath || "",
        coverPath: scanData.workInfo.coverPath || ""
    } : {
        genre: "", label: "", authorType: "single", author: "",
        artist: "", original: "", title: "", subtitle: "",
        editor: "", volume: 1, storagePath: "", notes: "", completedPath: "", typesettingPath: "", coverPath: ""
    };

    // ★★★ scanDataからガイド線情報を読み込む（guideSets/detectedGuideSets/guides両対応）★★★
    var scanGuideSets = scanData ? (scanData.detectedGuideSets || scanData.guideSets) : null;
    if (scanGuideSets && scanGuideSets.length > 0) {
        var mostUsedSet = scanGuideSets[0];
        lastGuideData = {
            horizontal: mostUsedSet.horizontal ? mostUsedSet.horizontal.slice() : [],
            vertical: mostUsedSet.vertical ? mostUsedSet.vertical.slice() : []
        };
    } else if (scanData && scanData.guides) {
        // ★★★ JSONエクスポート形式（選択されたガイドのみ）の場合 ★★★
        lastGuideData = {
            horizontal: scanData.guides.horizontal ? scanData.guides.horizontal.slice() : [],
            vertical: scanData.guides.vertical ? scanData.guides.vertical.slice() : []
        };
    }

    // ★★★ scanDataからテキストレイヤーキャッシュを取得（textLayersByDoc/detectedTextLayers両対応）★★★
    var lastTextLayersByDoc = scanData ? (scanData.detectedTextLayers || scanData.textLayersByDoc || {}) : {};
    // ★★★ 白フチ統計を取得（scandata形式/JSONエクスポート形式両対応）★★★
    // scandata: strokeStats, detectedStrokeStats / JSON: strokeSizes (配列のみ)
    var lastStrokeStats = null;
    if (scanData) {
        if (scanData.detectedStrokeStats || scanData.strokeStats) {
            lastStrokeStats = scanData.detectedStrokeStats || scanData.strokeStats;
        } else if (scanData.strokeSizes && scanData.strokeSizes.length > 0) {
            // ★★★ strokeSizes形式から変換（新形式: オブジェクト配列 / 旧形式: 数値配列）★★★
            var sizes = [];
            for (var sti = 0; sti < scanData.strokeSizes.length; sti++) {
                var strokeItem = scanData.strokeSizes[sti];
                if (typeof strokeItem === 'object' && strokeItem !== null) {
                    // 新形式: {size: number, fontSizes: array}
                    sizes.push({
                        size: strokeItem.size || 0,
                        count: strokeItem.count || 0,
                        fontSizes: strokeItem.fontSizes || []
                    });
                } else if (typeof strokeItem === 'number') {
                    // 旧形式: 数値のみ
                    sizes.push({
                        size: strokeItem,
                        count: 0,
                        fontSizes: []
                    });
                }
            }
            lastStrokeStats = { sizes: sizes };
        }
    }

    // ★★★ データソース管理（scan/json両方のデータを保持）（fonts/detectedFonts両対応）★★★
    var scanDataFonts = scanData ? (scanData.detectedFonts || scanData.fonts || []) : [];
    var jsonDataFonts = [];
    var mergedFonts = [];
    var allDetectedFonts = scanDataFonts.slice(); // 全検出フォント（削除復元用）

    // ★★★ フォントデータをマージする関数（JSON優先）★★★
    function mergeFontData(scanFonts, jsonFonts) {
        var result = [];
        var fontMap = {};

        // まずscanDataのフォントを追加
        for (var i = 0; i < scanFonts.length; i++) {
            var font = scanFonts[i];
            fontMap[font.name] = {
                font: font,
                source: "scan"
            };
        }

        // JSONのフォントで上書き（JSON優先）
        for (var j = 0; j < jsonFonts.length; j++) {
            var jsonFont = jsonFonts[j];
            fontMap[jsonFont.name] = {
                font: jsonFont,
                source: "json"
            };
        }

        // 結果配列を構築
        for (var name in fontMap) {
            result.push(fontMap[name].font);
        }

        // 使用回数でソート
        result.sort(function(a, b) {
            return b.count - a.count;
        });

        return result;
    }

    // ★★★ テキストレイヤーデータをマージする関数（JSON優先）★★★
    function mergeTextLayerData(scanLayers, jsonLayers) {
        var result = {};

        // まずscanDataのレイヤーを追加
        for (var docName in scanLayers) {
            result[docName] = scanLayers[docName];
        }

        // JSONのレイヤーで上書き（JSON優先）
        for (var jsonDocName in jsonLayers) {
            result[jsonDocName] = jsonLayers[jsonDocName];
        }

        return result;
    }

    if (typeof autoDetect === 'undefined') autoDetect = false;

    // ★★★ PSDは閉じているのでscanDataの情報を表示（アドレスは非表示）★★★
    if (scanData && scanData.processedFiles > 0) {
        var infoGroup = dialog.add("group");
        infoGroup.orientation = "row";
        infoGroup.alignChildren = ["left", "center"];
        infoGroup.add("statictext", undefined, "✓ " + scanData.processedFiles + "個のPSDファイルをスキャン済み");
    }
    
    // ===== タブボタングループ =====
    var tabButtonGroup = dialog.add("group");
    tabButtonGroup.orientation = "row";
    tabButtonGroup.alignChildren = ["left", "center"];
    tabButtonGroup.alignment = ["fill", "top"];
    tabButtonGroup.spacing = 2;

    // ★★★ タブボタンの選択状態を保持 ★★★
    var tabButtonSelected = [false, true, false, false, false, false]; // index 0は未使用
    var tabButtons = [null]; // index 0は未使用
    var tabLabels = ["", "作品情報", "フォント種類", "フォントサイズ", "タチキリ枠", "テキスト"];
    var tabWidths = [0, 90, 95, 105, 90, 75];

    // ★★★ カスタムタブボタン作成関数（ボタン使用・完全カスタム描画）★★★
    function createTabButton(parent, tabIndex) {
        var btn = parent.add("button", undefined, "");
        btn.preferredSize = [tabWidths[tabIndex], 24];
        btn.alignment = ["left", "center"];

        // ★★★ 完全カスタム描画（ホバー状態を無視）★★★
        btn.onDraw = function() {
            var g = this.graphics;
            var isSelected = tabButtonSelected[tabIndex];

            // 背景色（選択時は明るく、非選択時は暗く）- ホバー状態に関係なく固定
            var bgColor;
            if (isSelected) {
                bgColor = g.newBrush(g.BrushType.SOLID_COLOR, [0.4, 0.4, 0.4, 1]); // 選択中
            } else {
                bgColor = g.newBrush(g.BrushType.SOLID_COLOR, [0.25, 0.25, 0.25, 1]); // 非選択
            }

            // 背景を描画（ボタン全体を塗りつぶし）
            g.newPath();
            g.rectPath(0, 0, this.size[0], this.size[1]);
            g.fillPath(bgColor);

            // テキスト色
            var textColor;
            if (isSelected) {
                textColor = g.newPen(g.PenType.SOLID_COLOR, [1, 1, 1, 1], 1); // 白
            } else {
                textColor = g.newPen(g.PenType.SOLID_COLOR, [0.65, 0.65, 0.65, 1], 1); // グレー
            }

            // テキストを描画
            var displayText = isSelected ? ("▶ " + tabLabels[tabIndex]) : tabLabels[tabIndex];
            var textWidth = g.measureString(displayText, g.font, this.size[0])[0];
            var x = (this.size[0] - textWidth) / 2;
            var y = (this.size[1] - 12) / 2;
            g.drawString(displayText, textColor, x, y);
        };

        // ★★★ クリックイベント（onClick使用）★★★
        btn.onClick = function() {
            switchToTab(tabIndex);
        };

        return btn;
    }

    // タブボタンを作成
    var tabButton1 = createTabButton(tabButtonGroup, 1);
    var tabButton2 = createTabButton(tabButtonGroup, 2);
    var tabButton3 = createTabButton(tabButtonGroup, 3);
    var tabButton4 = createTabButton(tabButtonGroup, 4);
    var tabButton5 = createTabButton(tabButtonGroup, 5);
    tabButtons[1] = tabButton1;
    tabButtons[2] = tabButton2;
    tabButtons[3] = tabButton3;
    tabButtons[4] = tabButton4;
    tabButtons[5] = tabButton5;

    // ===== メインコンテンツエリア =====
    var mainContent = dialog.add("group");
    mainContent.orientation = "row";
    mainContent.alignChildren = ["fill", "top"];
    mainContent.alignment = ["fill", "top"];
    mainContent.spacing = 10;

    // ===== タブコンテンツエリア（スタック構造） =====
    var tabStack = mainContent.add("panel", undefined, "");
    tabStack.orientation = "stack";
    tabStack.alignChildren = ["fill", "top"];
    tabStack.alignment = ["fill", "top"];
    tabStack.preferredSize = [490, 400];
    tabStack.maximumSize = [600, 600];
    var tab1Content = tabStack.add("group");
    tab1Content.orientation = "column";
    tab1Content.alignChildren = ["fill", "top"];
    tab1Content.spacing = 8;
    var tab2Content = tabStack.add("group");
    tab2Content.orientation = "column";
    tab2Content.alignChildren = ["fill", "top"];
    tab2Content.spacing = 8;
    var tab3Content = tabStack.add("group");
    tab3Content.orientation = "column";
    tab3Content.alignChildren = ["fill", "top"];
    tab3Content.spacing = 8;
    var tab4Content = tabStack.add("group");
    tab4Content.orientation = "column";
    tab4Content.alignChildren = ["fill", "top"];
    tab4Content.spacing = 8;
    var tab5Content = tabStack.add("group");
    tab5Content.orientation = "column";
    tab5Content.alignChildren = ["fill", "top"];
    tab5Content.spacing = 8;

    // ========================================
    // タブ1: 作品情報
    // ========================================
    tab1Content.add("statictext", undefined, "【作品情報（漫画原稿用）】");
    var labelsByGenre = {
        "一般女性": ["Ropopo!", "コイパレ", "キスカラ", "カルコミ", "ウーコミ!", "シェノン"],
        "TL": ["TLオトメチカ", "LOVE FLICK", "乙女チック", "ウーコミkiss!", "シェノン+", "@夜噺"],
        "BL": ["NuPu", "spicomi", "MooiComics", "BLオトメチカ", "BOYS FAN"],
        "一般男性": ["DEDEDE", "GG-COMICS", "コミックREBEL"],
        "メンズ": ["カゲキヤコミック", "もえスタビースト", "@夜噺＋"],
        "タテコミ": ["GIGATOON"]
    };
    var labelGroup = tab1Content.add("group");
    labelGroup.orientation = "row";
    labelGroup.alignChildren = ["left", "center"];
    labelGroup.spacing = 5;
    labelGroup.add("statictext", undefined, "レーベル: CLLENN /");
    var genreDropdown = labelGroup.add("dropdownlist");
    genreDropdown.preferredSize.width = 100;
    for (var genre in labelsByGenre) {
        if (labelsByGenre.hasOwnProperty(genre)) {
            genreDropdown.add("item", genre);
        }
    }
    genreDropdown.selection = 0;
    labelGroup.add("statictext", undefined, "/");
    var labelDropdown = labelGroup.add("dropdownlist");
    labelDropdown.preferredSize.width = 150;
    
    var authorGroup = tab1Content.add("group");
    authorGroup.orientation = "column";
    authorGroup.alignChildren = ["left", "top"];
    authorGroup.spacing = 5;
    authorGroup.add("statictext", undefined, "著者情報:");
    var authorTypeGroup = authorGroup.add("group");
    authorTypeGroup.orientation = "row";
    var authorRadioSingle = authorTypeGroup.add("radiobutton", undefined, "著者");
    var authorRadioDual = authorTypeGroup.add("radiobutton", undefined, "作画／原作");
    var authorRadioNone = authorTypeGroup.add("radiobutton", undefined, "なし");
    var notionPasteButton = authorTypeGroup.add("button", undefined, "Notionからペースト");
    notionPasteButton.preferredSize = [120, 22];
    authorRadioSingle.value = true;
    
    var authorInputStack = authorGroup.add("panel", undefined, "", {borderless: true});
    authorInputStack.orientation = "stack";
    authorInputStack.preferredSize = [410, 25];
    authorInputStack.alignChildren = ["left", "top"];
    var authorSingleGroup = authorInputStack.add("group");
    authorSingleGroup.orientation = "row";
    authorSingleGroup.add("statictext", undefined, "著：");
    var authorSingleInput = authorSingleGroup.add("edittext", undefined, "");
    authorSingleInput.preferredSize.width = 370;
    var authorDualGroup = authorInputStack.add("group");
    authorDualGroup.orientation = "row";
    authorDualGroup.add("statictext", undefined, "作画：");
    var artistInput = authorDualGroup.add("edittext", undefined, "");
    artistInput.preferredSize.width = 140;
    authorDualGroup.add("statictext", undefined, "／原作：");
    var originalInput = authorDualGroup.add("edittext", undefined, "");
    originalInput.preferredSize.width = 140;
    var authorNoneGroup = authorInputStack.add("group");
    var authorNoneInput = authorNoneGroup.add("edittext", undefined, "");
    authorNoneInput.preferredSize.width = 390;
    authorSingleGroup.visible = true;
    authorDualGroup.visible = false;
    authorNoneGroup.visible = false;
    
    var titleGroup = tab1Content.add("group");
    titleGroup.orientation = "row";
    titleGroup.alignChildren = ["left", "center"];
    titleGroup.add("statictext", undefined, "タイトル:");
    var titleInput = titleGroup.add("edittext", undefined, "");
    titleInput.preferredSize.width = 360;
    
    var subtitleGroup = tab1Content.add("group");
    subtitleGroup.orientation = "row";
    subtitleGroup.alignChildren = ["left", "center"];
    subtitleGroup.add("statictext", undefined, "サブタイトル:");
    var subtitleInput = subtitleGroup.add("edittext", undefined, "");
    subtitleInput.preferredSize.width = 330;

    var editorGroup = tab1Content.add("group");
    editorGroup.orientation = "row";
    editorGroup.alignChildren = ["left", "center"];
    editorGroup.add("statictext", undefined, "編集者:");
    var editorInput = editorGroup.add("edittext", undefined, "");
    editorInput.preferredSize.width = 355;

    // 巻数選択（非表示 - 内部処理用に保持）
    var volumeGroup = tab1Content.add("group");
    volumeGroup.orientation = "row";
    volumeGroup.alignChildren = ["left", "center"];
    volumeGroup.visible = false; // ★★★ 非表示に設定 ★★★
    volumeGroup.add("statictext", undefined, "巻数:");
    var volumeDropdown = volumeGroup.add("dropdownlist");
    volumeDropdown.preferredSize.width = 80;
    for (var vol = 1; vol <= 50; vol++) {
        volumeDropdown.add("item", vol + "巻");
    }
    // ★★★ 巻数を新規作成ダイアログから引き継ぐ（startVolumeを優先）★★★
    var initialVolume = (scanData && scanData.startVolume) ? scanData.startVolume : (workInfo && workInfo.volume ? workInfo.volume : 1);
    if (initialVolume >= 1 && initialVolume <= 50) {
        volumeDropdown.selection = initialVolume - 1;
    } else {
        volumeDropdown.selection = 0;
    }

    // 格納場所入力欄
    var storagePathHeader = tab1Content.add("statictext", undefined, "【格納場所】");

    var storagePathGroup = tab1Content.add("group");
    storagePathGroup.orientation = "row";
    storagePathGroup.alignChildren = ["left", "center"];
    var storagePathInput = storagePathGroup.add("edittext", undefined, "");
    storagePathInput.preferredSize.width = 420;

    // ★★★ 互換性のための変数（旧UIとの互換）★★★
    var completedPathInput = { text: "" };
    var typesettingPathInput = { text: "" };
    var coverPathInput = { text: "" };

    // ========================================
    // ★★★ 備考欄 ★★★
    // ========================================
    var notesHeader = tab1Content.add("statictext", undefined, "【備考】");
    var notesInput = tab1Content.add("edittext", undefined, "", {multiline: true});
    notesInput.preferredSize = [420, 60];
    notesInput.alignment = ["fill", "top"];

    // ========================================
    // ★★★ 保存ファイル一覧表示エリア ★★★
    // ========================================
    var textStatsHeader = tab1Content.add("statictext", undefined, "【保存ファイル一覧】");
    textStatsHeader.graphics.font = ScriptUI.newFont("dialog", "BOLD", 12);
    var textStatsDisplay = tab1Content.add("statictext", undefined, "作品情報を入力してください", {multiline: true});
    textStatsDisplay.preferredSize = [420, 80];
    textStatsDisplay.alignment = ["fill", "top"];

    // ★★★ テキストログ保存先のベースパス ★★★
    var TEXT_LOG_BASE_PATH = "G:/共有ドライブ/CLLENN/編集部フォルダ/編集企画部/写植・校正用テキストログ";

    // ★★★ 保存ファイル一覧を更新する関数 ★★★
    function updateTextStatsDisplay() {
        // 作品情報からレーベルとタイトルを取得
        var label = workInfo ? workInfo.label : "";
        var title = workInfo ? workInfo.title : "";

        if (!label || !title) {
            textStatsDisplay.text = "作品情報を入力してください";
            return;
        }

        // フォルダパスを構築
        var folderPath = TEXT_LOG_BASE_PATH + "/" + label + "/" + title;
        var folder = new Folder(folderPath);

        if (!folder.exists) {
            textStatsDisplay.text = "保存フォルダなし\n" + label + "/" + title;
            return;
        }

        // フォルダ内のファイルを取得
        var allFiles = folder.getFiles();
        var fileNames = [];
        var volumeNumbers = []; // 巻数を格納
        var otherFiles = []; // 巻数以外のファイル

        for (var i = 0; i < allFiles.length; i++) {
            if (allFiles[i] instanceof File) {
                var fileName = decodeURI(allFiles[i].name);
                // 拡張子.txtを除去
                fileName = fileName.replace(/\.txt$/i, "");
                fileNames.push(fileName);

                // ★★★ 巻数パターンを抽出（例: "01巻", "02巻"）★★★
                var volMatch = fileName.match(/^(\d{2})巻$/);
                if (volMatch) {
                    volumeNumbers.push(parseInt(volMatch[1], 10));
                } else {
                    otherFiles.push(fileName);
                }
            }
        }

        // 表示テキストを作成
        if (fileNames.length === 0) {
            textStatsDisplay.text = "保存ファイルなし";
        } else {
            var displayText = "ファイル数: " + fileNames.length + "件\n";

            // ★★★ 巻数を連番でグループ化して表示 ★★★
            if (volumeNumbers.length > 0) {
                volumeNumbers.sort(function(a, b) { return a - b; });
                var volumeRanges = [];
                var rangeStart = volumeNumbers[0];
                var rangeEnd = volumeNumbers[0];

                for (var v = 1; v < volumeNumbers.length; v++) {
                    if (volumeNumbers[v] === rangeEnd + 1) {
                        // 連番が続く
                        rangeEnd = volumeNumbers[v];
                    } else {
                        // 連番が途切れた
                        if (rangeStart === rangeEnd) {
                            volumeRanges.push(("0" + rangeStart).slice(-2) + "巻");
                        } else {
                            volumeRanges.push(("0" + rangeStart).slice(-2) + "~" + ("0" + rangeEnd).slice(-2) + "巻");
                        }
                        rangeStart = volumeNumbers[v];
                        rangeEnd = volumeNumbers[v];
                    }
                }
                // 最後の範囲を追加
                if (rangeStart === rangeEnd) {
                    volumeRanges.push(("0" + rangeStart).slice(-2) + "巻");
                } else {
                    volumeRanges.push(("0" + rangeStart).slice(-2) + "~" + ("0" + rangeEnd).slice(-2) + "巻");
                }

                displayText += volumeRanges.join(", ");
                if (otherFiles.length > 0) {
                    displayText += ", " + otherFiles.join(", ");
                }
            } else {
                // 巻数パターンがない場合は従来通り
                displayText += fileNames.join(", ");
            }

            textStatsDisplay.text = displayText;
        }
    }

    // ========================================
    // タブ2: フォント種類
    // ========================================
    // ★★★ 現在のセット項目（プリセット一覧）を上部に配置 ★★★
    tab2Content.add("statictext", undefined, "【現在のセット項目】");
    var tab2PresetList = tab2Content.add("listbox", undefined, [], {
        multiselect: false,
        numberOfColumns: 2,
        showHeaders: true,
        columnWidths: [126, 294],
        columnTitles: ["サブ名称", "プリセット名"]
    });
    tab2PresetList.preferredSize = [420, 250];
    var tab2PresetButtonGroup = tab2Content.add("group");
    tab2PresetButtonGroup.orientation = "row";
    tab2PresetButtonGroup.alignment = "center";
    tab2PresetButtonGroup.spacing = 5;
    var tab2AddButton = tab2PresetButtonGroup.add("button", undefined, "＋フォントセットを追加＋");
    var tab2EditButton = tab2PresetButtonGroup.add("button", undefined, "🖋フォントセットを編集🖋");
    var tab2DeleteButton = tab2PresetButtonGroup.add("button", undefined, "▼選択したフォントを削除▼");
    tab2AddButton.preferredSize.width = 160;
    tab2EditButton.preferredSize.width = 160;
    tab2DeleteButton.preferredSize.width = 160;

    // ★★★ JSONに未登録のフォント（検出されたがプリセットにないもの）をドロップダウンで表示 ★★★
    var missingFontGroup = tab2Content.add("group");
    missingFontGroup.orientation = "row";
    missingFontGroup.alignChildren = ["left", "center"];
    missingFontGroup.add("statictext", undefined, "【未登録フォント】");
    // ★★★ 追加ボタン（ドロップダウンの上に配置）★★★
    var detectedButtonGroup = tab2Content.add("group");
    detectedButtonGroup.orientation = "row";
    detectedButtonGroup.alignment = "center";
    detectedButtonGroup.spacing = 5;
    var addFromDetectedButton = detectedButtonGroup.add("button", undefined, "▲選択したフォントを追加▲");
    var addAllDetectedButton = detectedButtonGroup.add("button", undefined, "▲全てのフォントを追加▲");
    addFromDetectedButton.preferredSize.width = 180;
    addAllDetectedButton.preferredSize.width = 180;
    // ★★★ 未登録フォントドロップダウン ★★★
    var missingFontDropdown = tab2Content.add("dropdownlist", undefined, []);
    missingFontDropdown.preferredSize = [420, 25];

    // タブ2のプリセット一覧を更新する関数（2カラム：サブ名称/プリセット名、サブ名称優先順位でソート）
    function updateTab2PresetList() {
        tab2PresetList.removeAll();
        var presets = allPresetSets[currentSetName];
        if (!presets) return;

        // サブ名称の優先順位（上から順に表示）
        var subNamePriority = [
            "セリフ",
            "モノローグ",
            "回想内ネーム",
            "ナレーション",
            "語気強く（通常）",
            "怒鳴り（シリアス）",
            "電話・テレビ",
            "おどろ",
            "ギャグテイスト",
            "決め台詞（太め）",
            "悲鳴",
            "SNSなど",
            "エロセリフ系"
        ];

        // サブ名称の出現回数をカウント
        var subNameCount = {};
        for (var c = 0; c < presets.length; c++) {
            if (presets[c].subName) {
                subNameCount[presets[c].subName] = (subNameCount[presets[c].subName] || 0) + 1;
            }
        }

        // プリセット名の出現回数をカウント（サブ名称なし用）
        var presetNameCount = {};
        for (var d = 0; d < presets.length; d++) {
            if (!presets[d].subName) {
                presetNameCount[presets[d].name] = (presetNameCount[presets[d].name] || 0) + 1;
            }
        }

        // サブ名称あり・なしで分類
        var withSubName = [];
        var noSubName = [];
        for (var i = 0; i < presets.length; i++) {
            var preset = presets[i];
            preset._originalIndex = i;
            if (preset.subName) {
                withSubName.push(preset);
            } else {
                noSubName.push(preset);
            }
        }

        // サブ名称ありを優先順位でソート（その他は使用回数順）
        withSubName.sort(function(a, b) {
            var indexA = -1;
            var indexB = -1;
            for (var p = 0; p < subNamePriority.length; p++) {
                if (a.subName === subNamePriority[p]) indexA = p;
                if (b.subName === subNamePriority[p]) indexB = p;
            }

            // 両方とも優先順位リストにある場合は優先順位で比較
            if (indexA !== -1 && indexB !== -1) {
                return indexA - indexB;
            }
            // 片方だけ優先順位リストにある場合は、リストにある方が先
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            // 両方とも優先順位リストにない場合は使用回数の多い順
            var countA = subNameCount[a.subName] || 0;
            var countB = subNameCount[b.subName] || 0;
            return countB - countA;
        });

        // サブ名称なしを使用回数の多い順にソート
        noSubName.sort(function(a, b) {
            var countA = presetNameCount[a.name] || 0;
            var countB = presetNameCount[b.name] || 0;
            return countB - countA;
        });

        // サブ名称ありを先に表示
        for (var j = 0; j < withSubName.length; j++) {
            var preset = withSubName[j];
            var item = tab2PresetList.add("item", preset.subName);
            item.subItems[0].text = preset.name;
            item.preset = preset;
            item.presetIndex = preset._originalIndex;
        }

        // サブ名称なしを後に表示
        for (var k = 0; k < noSubName.length; k++) {
            var preset = noSubName[k];
            var item = tab2PresetList.add("item", "");
            item.subItems[0].text = preset.name;
            item.preset = preset;
            item.presetIndex = preset._originalIndex;
        }

        // プリセット更新時に未登録フォントも更新
        updateMissingFontList();
    }

    // ★★★ JSONに未登録のフォント一覧を更新する関数（ドロップダウン版）★★★
    var missingFontDataList = []; // ドロップダウン用のフォントデータを保持
    function updateMissingFontList() {
        missingFontDropdown.removeAll();
        missingFontDataList = [];

        // 参照するフォント一覧（allDetectedFonts > mergedFonts > scanDataFonts の優先順）
        var sourceFonts = allDetectedFonts.length > 0 ? allDetectedFonts :
                         (mergedFonts.length > 0 ? mergedFonts : scanDataFonts);

        // 検出されたフォントがない場合
        if (!sourceFonts || sourceFonts.length === 0) {
            missingFontDropdown.add("item", "（検出されたフォントがありません）");
            missingFontDropdown.selection = 0;
            // ★★★ ボタンを無効化 ★★★
            addFromDetectedButton.enabled = false;
            addAllDetectedButton.enabled = false;
            return;
        }

        // プリセットに登録されているフォント名を収集
        var registeredFonts = {};
        var presets = allPresetSets[currentSetName];
        if (presets) {
            for (var i = 0; i < presets.length; i++) {
                if (presets[i].font) {
                    registeredFonts[presets[i].font] = true;
                }
            }
        }

        // 未登録フォントをリストに追加
        var missingCount = 0;
        for (var j = 0; j < sourceFonts.length; j++) {
            var fontInfo = sourceFonts[j];
            var fontName = fontInfo.name;

            // プリセットに登録されていないフォントのみ表示
            if (!registeredFonts[fontName]) {
                var displayName = getFontDisplayName(fontName);
                var count = fontInfo.count || 0;
                var sizeInfo = "";
                if (fontInfo.sizes && fontInfo.sizes.length > 0) {
                    var topSizes = fontInfo.sizes.slice(0, 3);
                    var sizeTexts = [];
                    for (var k = 0; k < topSizes.length; k++) {
                        sizeTexts.push(topSizes[k].size + "pt");
                    }
                    sizeInfo = " [" + sizeTexts.join(", ") + "]";
                }
                missingFontDropdown.add("item", displayName + " (" + count + "回)" + sizeInfo);
                missingFontDataList.push(fontInfo);
                missingCount++;
            }
        }

        // 未登録フォントがない場合
        if (missingCount === 0) {
            missingFontDropdown.add("item", "（すべてのフォントが登録済みです）");
        }

        // 最初の項目を選択
        if (missingFontDropdown.items.length > 0) {
            missingFontDropdown.selection = 0;
        }

        // ★★★ 追加ボタンの有効/無効を制御 ★★★
        var hasUnregisteredFonts = missingCount > 0;
        addFromDetectedButton.enabled = hasUnregisteredFonts;
        addAllDetectedButton.enabled = hasUnregisteredFonts;
    }

    // ========================================
    // タブ3: フォントサイズ・白フチサイズ
    // ========================================
    // タイトル行（タイトル + 編集ボタン）
    var fontSizeTitleGroup = tab3Content.add("group");
    fontSizeTitleGroup.orientation = "row";
    fontSizeTitleGroup.alignChildren = ["left", "center"];
    fontSizeTitleGroup.add("statictext", undefined, "【フォントサイズ】");
    var editStatsButton = fontSizeTitleGroup.add("button", undefined, "編集");
    editStatsButton.preferredSize.width = 60;

    // ★★★ 基本サイズセクション ★★★
    var baseSizePanel = tab3Content.add("panel", undefined, "");
    baseSizePanel.orientation = "row";
    baseSizePanel.alignChildren = ["left", "center"];
    baseSizePanel.margins = [10, 5, 10, 5];
    baseSizePanel.add("statictext", undefined, "基本サイズ");
    var baseSizeInput = baseSizePanel.add("edittext", undefined, "--pt");
    baseSizeInput.preferredSize = [80, 25];
    var changeBaseSizeButton = baseSizePanel.add("button", undefined, "変更");
    changeBaseSizeButton.preferredSize.width = 60;

    // ★★★ 登録サイズセクション ★★★
    var registeredSizeGroup = tab3Content.add("group");
    registeredSizeGroup.orientation = "column";
    registeredSizeGroup.alignChildren = ["fill", "top"];
    registeredSizeGroup.add("statictext", undefined, "・登録サイズ(押下で基本サイズに指定) ※出現回数上位10件");

    // 登録サイズボタン群（2行×5列 = 10個）
    var registeredSizes = []; // 登録サイズを保持する配列（数値のみ）
    var registeredSizeButtons = []; // ボタン参照を保持
    var sizeButtonRows = [];
    for (var row = 0; row < 2; row++) {
        var rowGroup = registeredSizeGroup.add("group");
        rowGroup.orientation = "row";
        rowGroup.spacing = 5;
        sizeButtonRows.push(rowGroup);
        for (var col = 0; col < 5; col++) {
            var sizeBtn = rowGroup.add("button", undefined, "--pt");
            sizeBtn.preferredSize = [70, 25];
            sizeBtn.sizeIndex = row * 5 + col;
            registeredSizeButtons.push(sizeBtn);
        }
    }

    // ★★★ その他検出されたサイズ（横スクロール可能）★★★
    var otherSizesGroup = tab3Content.add("group");
    otherSizesGroup.orientation = "row";
    otherSizesGroup.alignChildren = ["left", "center"];
    otherSizesGroup.add("statictext", undefined, "・その他(pt)");
    var otherSizesText = otherSizesGroup.add("edittext", undefined, "--", {readonly: true});
    otherSizesText.preferredSize = [340, 20];

    // ★★★ ルビサイズ想定範囲 ★★★
    var rubySizeGroup = tab3Content.add("group");
    rubySizeGroup.orientation = "row";
    rubySizeGroup.alignChildren = ["left", "center"];
    rubySizeGroup.add("statictext", undefined, "・ルビサイズ想定範囲");
    var rubySizeRangeText = rubySizeGroup.add("statictext", undefined, "-- ~ -- pt");
    rubySizeRangeText.preferredSize = [100, 20];

    // ★★★ 互換性のための変数（旧コードとの互換）★★★
    var mostFrequentText = tab3Content.add("statictext", undefined, "");
    mostFrequentText.visible = false;
    var excludeRangeText = tab3Content.add("statictext", undefined, "");
    excludeRangeText.visible = false;
    var sizeDisplayText = tab3Content.add("statictext", undefined, "");
    sizeDisplayText.visible = false;
    var clearStatsButton = { onClick: function() {} }; // ダミー

    // ★★★ 白フチ（境界線/ストローク）サイズ ★★★
    tab3Content.add("statictext", undefined, "");
    tab3Content.add("statictext", undefined, "【白フチサイズ】");

    // 白フチサイズリスト（登録サイズ/対応テキストの文字サイズ）
    var strokeListGroup = tab3Content.add("group");
    strokeListGroup.orientation = "column";
    strokeListGroup.alignChildren = ["fill", "top"];
    strokeListGroup.add("statictext", undefined, "・登録サイズ/対応テキストの文字サイズ(pt)");

    var strokeSizeList = tab3Content.add("listbox", undefined, [], {
        numberOfColumns: 2,
        showHeaders: true,
        columnTitles: ["白フチサイズ", "対応フォントサイズ"],
        columnWidths: [100, 300]
    });
    strokeSizeList.preferredSize = [420, 100];

    // ★★★ 互換性のための変数 ★★★
    var strokeStatusText = tab3Content.add("statictext", undefined, "");
    strokeStatusText.visible = false;
    var strokeDisplayText = tab3Content.add("statictext", undefined, "");
    strokeDisplayText.visible = false;
    var rankOutSummaryText = tab3Content.add("statictext", undefined, "");
    rankOutSummaryText.visible = false;

    // ★★★ 新UI用の更新関数 ★★★
    function updateNewSizeUI() {
        // 登録サイズボタンを更新
        for (var bi = 0; bi < registeredSizeButtons.length; bi++) {
            if (bi < registeredSizes.length) {
                registeredSizeButtons[bi].text = registeredSizes[bi] + "pt";
                registeredSizeButtons[bi].enabled = true;
            } else {
                registeredSizeButtons[bi].text = "--pt";
                registeredSizeButtons[bi].enabled = false;
            }
        }
    }

    // ★★★ 登録サイズボタンのクリックで基本サイズに設定 ★★★
    for (var rsi = 0; rsi < registeredSizeButtons.length; rsi++) {
        registeredSizeButtons[rsi].onClick = function() {
            var idx = this.sizeIndex;
            if (idx < registeredSizes.length) {
                var newSize = registeredSizes[idx];
                baseSizeInput.text = newSize + "pt";

                // ★★★ lastFontSizeStatsを更新（編集ダイアログと連動）★★★
                if (!lastFontSizeStats) {
                    lastFontSizeStats = {};
                }
                var oldCount = 0;
                if (lastFontSizeStats.mostFrequent && typeof lastFontSizeStats.mostFrequent === 'object') {
                    oldCount = lastFontSizeStats.mostFrequent.count || 0;
                }
                lastFontSizeStats.mostFrequent = { size: newSize, count: oldCount };

                // ルビサイズ想定範囲を更新（基本サイズの半分±1）
                var halfSize = newSize / 2;
                var excludeMin = halfSize - 1;
                var excludeMax = halfSize + 1;
                lastFontSizeStats.excludeRange = { min: excludeMin, max: excludeMax };
                rubySizeRangeText.text = excludeMin.toFixed(1) + " ~ " + excludeMax.toFixed(1) + " pt";
            }
        };
    }

    // ★★★ 基本サイズ変更ボタン ★★★
    changeBaseSizeButton.onClick = function() {
        var changeDialog = new Window("dialog", "基本サイズを変更");
        changeDialog.orientation = "column";
        changeDialog.alignChildren = ["fill", "top"];
        changeDialog.margins = 15;
        changeDialog.add("statictext", undefined, "新しい基本サイズを入力(pt):");
        var newSizeInput = changeDialog.add("edittext", undefined, baseSizeInput.text.replace("pt", ""));
        newSizeInput.preferredSize.width = 100;
        var changeBtnGroup = changeDialog.add("group");
        changeBtnGroup.alignment = "center";
        var changeOkBtn = changeBtnGroup.add("button", undefined, "OK");
        var changeCancelBtn = changeBtnGroup.add("button", undefined, "キャンセル");
        changeOkBtn.onClick = function() {
            var newSize = parseFloat(newSizeInput.text);
            if (!isNaN(newSize) && newSize > 0) {
                baseSizeInput.text = newSize + "pt";

                // ★★★ lastFontSizeStatsを更新（編集ダイアログと連動）★★★
                if (!lastFontSizeStats) {
                    lastFontSizeStats = {};
                }
                var oldCount = 0;
                if (lastFontSizeStats.mostFrequent && typeof lastFontSizeStats.mostFrequent === 'object') {
                    oldCount = lastFontSizeStats.mostFrequent.count || 0;
                }
                lastFontSizeStats.mostFrequent = { size: newSize, count: oldCount };

                // ルビサイズ想定範囲を更新（基本サイズの半分±1）
                var halfSize = newSize / 2;
                var excludeMin = halfSize - 1;
                var excludeMax = halfSize + 1;
                lastFontSizeStats.excludeRange = { min: excludeMin, max: excludeMax };
                rubySizeRangeText.text = excludeMin.toFixed(1) + " ~ " + excludeMax.toFixed(1) + " pt";

                // 登録サイズに追加（重複チェック）
                var exists = false;
                for (var ei = 0; ei < registeredSizes.length; ei++) {
                    if (registeredSizes[ei] === newSize) {
                        exists = true;
                        break;
                    }
                }
                if (!exists && registeredSizes.length < 10) {
                    registeredSizes.push(newSize);
                    registeredSizes.sort(function(a, b) { return b - a; }); // 大きい順
                    updateNewSizeUI();
                }
                changeDialog.close();
            } else {
                alert("有効な数値を入力してください。");
            }
        };
        changeCancelBtn.onClick = function() { changeDialog.close(); };
        changeDialog.show();
    };

    // ★★★ lastStrokeStats と lastTextLayersByDoc は関数冒頭で scanData から初期化済み ★★★
    // ★★★ editStatsButton.onClick は後方（7213行目付近）で定義 ★★★

    // ========================================
    // タブ4: タチキリ枠（ガイド線）
    // ========================================
    tab4Content.add("statictext", undefined, "【ガイド線管理】");
    var guideStatusText = tab4Content.add("statictext", undefined, "ガイド線: 未読み取り");
    // ★★★ タチキリ枠用ガイド線（JSONに保存するセット）★★★
    tab4Content.add("statictext", undefined, "・タチキリ枠用ガイド線(このガイド線が保存されます)");
    var guideListBox = tab4Content.add("listbox", undefined, [], {multiselect: false});
    guideListBox.preferredSize = [420, 65];
    var guideSelectionInfo = tab4Content.add("statictext", undefined, "セットを選択してください");
    guideSelectionInfo.preferredSize = [420, 30];
    // ★★★ ガイド線を確認ボタンと選択解除ボタンを横並びに配置 ★★★
    var confirmGuideButtonGroup = tab4Content.add("group");
    confirmGuideButtonGroup.orientation = "row";
    confirmGuideButtonGroup.alignment = "left";
    confirmGuideButtonGroup.spacing = 10;
    var confirmGuideButton = confirmGuideButtonGroup.add("button", undefined, "ガイド線を確認");
    confirmGuideButton.preferredSize.width = 150;
    var unselectGuideButton = confirmGuideButtonGroup.add("button", undefined, "選択を解除");
    unselectGuideButton.preferredSize.width = 100;

    // ★★★ 未選択のガイド線セット（選択されていないセット）を下部に表示 ★★★
    tab4Content.add("statictext", undefined, "・検出されたガイド線セット");
    var unselectedGuideListBox = tab4Content.add("listbox", undefined, [], {multiselect: false});
    unselectedGuideListBox.preferredSize = [420, 80];
    var guideButtonGroup = tab4Content.add("group");
    guideButtonGroup.orientation = "row";
    guideButtonGroup.alignment = "left";
    guideButtonGroup.spacing = 10;
    var selectGuideButton = guideButtonGroup.add("button", undefined, "選んだ候補を選択");
    selectGuideButton.preferredSize.width = 150;

    // ★★★ タチキリ範囲選択ラベル一覧エリア ★★★
    tab4Content.add("statictext", undefined, "【タチキリ範囲選択ラベル一覧】（TIPPYから保存できます）");
    var jsonLabelListBox = tab4Content.add("listbox", undefined, [], {multiselect: false});
    jsonLabelListBox.preferredSize = [420, 60];
    var selectionRangeConfirmButton = tab4Content.add("button", undefined, "範囲選択を確認");
    selectionRangeConfirmButton.preferredSize.width = 150;

    // JSONフォルダのベースパス
    var JSON_FOLDER_BASE_PATH = "G:/共有ドライブ/CLLENN/編集部フォルダ/編集企画部/編集企画_C班(AT業務推進)/DTP制作部/JSONフォルダ";

    // ★★★ selectionRangesのキャッシュ（インポート時に保存）★★★
    var cachedSelectionRanges = null;

    // ★★★ 最後に使用したラベル名 ★★★
    var lastUsedLabel = null;

    // ★★★ scanDataからselectionRangesを初期キャッシュ ★★★
    if (scanData && scanData.selectionRanges && scanData.selectionRanges.length > 0) {
        cachedSelectionRanges = scanData.selectionRanges;
    }

    // ★★★ scanDataから最後に使用したラベルを読み込み ★★★
    if (scanData && scanData.lastUsedLabel) {
        lastUsedLabel = scanData.lastUsedLabel;
    }

    // JSON内ラベルを読み込んで表示する関数
    function updateJsonLabelList() {
        jsonLabelListBox.removeAll();

        // ★★★ キャッシュがある場合はそれを使用 ★★★
        if (cachedSelectionRanges && cachedSelectionRanges.length > 0) {
            for (var i = 0; i < cachedSelectionRanges.length; i++) {
                var range = cachedSelectionRanges[i];
                if (range.label) {
                    // ★★★ 最後に使用したラベルにマークをつける ★★★
                    var displayLabel = range.label;
                    if (lastUsedLabel && range.label === lastUsedLabel) {
                        displayLabel = "★ " + range.label;
                    }
                    var item = jsonLabelListBox.add("item", displayLabel);
                    item.rangeData = range;
                }
            }
            if (jsonLabelListBox.items.length === 0) {
                var noLabelItem = jsonLabelListBox.add("item", "（ラベルが登録されていません）");
                noLabelItem.enabled = false;
            }
            return;
        }

        // 作品情報からレーベルとタイトルを取得
        var label = workInfo ? workInfo.label : "";
        var title = workInfo ? workInfo.title : "";

        if (!label || !title) {
            var noInfoItem = jsonLabelListBox.add("item", "（作品情報を入力してください）");
            noInfoItem.enabled = false;
            return;
        }

        // JSONファイルパスを構築（複数のパス形式を試行）
        var jsonFilePath = JSON_FOLDER_BASE_PATH + "/" + label + "/" + title + ".json";
        var jsonFile = new File(jsonFilePath);

        // ★★★ ファイルが見つからない場合、バックスラッシュでも試行 ★★★
        if (!jsonFile.exists) {
            jsonFilePath = JSON_FOLDER_BASE_PATH.replace(/\//g, "\\") + "\\" + label + "\\" + title + ".json";
            jsonFile = new File(jsonFilePath);
        }

        if (!jsonFile.exists) {
            var noFileItem = jsonLabelListBox.add("item", "（JSONファイルが見つかりません: " + title + ".json）");
            noFileItem.enabled = false;
            return;
        }

        try {
            jsonFile.encoding = "UTF-8";
            jsonFile.open("r");
            var content = jsonFile.read();
            jsonFile.close();

            var parsedLabelJson = JSON.parse(content);
            var jsonData = parsedLabelJson.presetData || {};

            // selectionRangesからラベルを取得
            if (jsonData.selectionRanges && jsonData.selectionRanges.length > 0) {
                // ★★★ キャッシュに保存 ★★★
                cachedSelectionRanges = jsonData.selectionRanges;
                // ★★★ JSONから最後に使用したラベルを読み込み ★★★
                if (jsonData.lastUsedLabel) {
                    lastUsedLabel = jsonData.lastUsedLabel;
                }
                for (var i = 0; i < jsonData.selectionRanges.length; i++) {
                    var range = jsonData.selectionRanges[i];
                    if (range.label) {
                        // ★★★ 最後に使用したラベルにマークをつける ★★★
                        var displayLabel = range.label;
                        if (lastUsedLabel && range.label === lastUsedLabel) {
                            displayLabel = "★ " + range.label;
                        }
                        var item = jsonLabelListBox.add("item", displayLabel);
                        item.rangeData = range;
                    }
                }
                if (jsonLabelListBox.items.length === 0) {
                    var noLabelItem = jsonLabelListBox.add("item", "（ラベルが登録されていません）");
                    noLabelItem.enabled = false;
                }
            } else {
                var noRangeItem = jsonLabelListBox.add("item", "（selectionRangesがありません）");
                noRangeItem.enabled = false;
            }
        } catch (e) {
            var errorItem = jsonLabelListBox.add("item", "（JSONの読み込みエラー: " + e.message + "）");
            errorItem.enabled = false;
        }
    }


    var allGuides = { sets: [] };

    // ★★★ 除外されたガイドセットのインデックスを記憶（選択解除されたセット）★★★
    var excludedGuideIndices = [];
    // scanDataから除外インデックスを読み込み
    if (scanData && scanData.excludedGuideIndices && scanData.excludedGuideIndices.length > 0) {
        excludedGuideIndices = scanData.excludedGuideIndices.slice();
    }

    // ========================================
    // タブ5: テキスト（ルビ一覧）
    // ========================================
    tab5Content.add("statictext", undefined, "【テキスト・ルビ一覧】");

    // ★★★ ルビ一覧データを保持 ★★★
    var rubyListData = []; // [{parent: "親文字", ruby: "ルビ", volume: "01", page: 1, order: 0}]

    // ソート方式選択
    var rubySortGroup = tab5Content.add("group");
    rubySortGroup.orientation = "row";
    rubySortGroup.alignChildren = ["left", "center"];
    rubySortGroup.add("statictext", undefined, "ソート:");
    var rubySortDropdown = rubySortGroup.add("dropdownlist", undefined, ["出現順", "ルビ名順（あいうえお）", "親文字順（あいうえお）", "巻数-ページ順"]);
    rubySortDropdown.selection = 3; // デフォルト：巻数-ページ順
    rubySortDropdown.preferredSize.width = 180;

    // ルビ一覧リスト（複数列）
    tab5Content.add("statictext", undefined, "ルビ一覧:");
    var rubyListBox = tab5Content.add("listbox", undefined, [], {
        numberOfColumns: 4,
        showHeaders: true,
        columnTitles: ["親文字", "ルビ", "巻数", "ページ"],
        columnWidths: [150, 150, 50, 50]
    });
    rubyListBox.preferredSize = [420, 200];

    // ルビ編集ボタングループ
    var rubyButtonGroup = tab5Content.add("group");
    rubyButtonGroup.orientation = "row";
    rubyButtonGroup.alignment = "center";
    rubyButtonGroup.spacing = 5;
    var rubyEditButton = rubyButtonGroup.add("button", undefined, "編集...");
    var rubyDeleteButton = rubyButtonGroup.add("button", undefined, "削除");
    var rubyAddButton = rubyButtonGroup.add("button", undefined, "追加...");
    var rubyUnifyButton = rubyButtonGroup.add("button", undefined, "統一");
    var rubyRefreshButton = rubyButtonGroup.add("button", undefined, "更新");
    rubyEditButton.preferredSize.width = 70;
    rubyDeleteButton.preferredSize.width = 70;
    rubyAddButton.preferredSize.width = 70;
    rubyUnifyButton.preferredSize.width = 70;
    rubyRefreshButton.preferredSize.width = 70;

    // ★★★ テキストログ操作グループ（テキストタブ最下部）★★★
    tab5Content.add("statictext", undefined, ""); // スペーサー
    var textLogGroup = tab5Content.add("group");
    textLogGroup.orientation = "row";
    textLogGroup.alignment = ["fill", "bottom"];
    textLogGroup.spacing = 10;
    textLogGroup.add("statictext", undefined, "テキストログ:");
    var openTextFolderButton = textLogGroup.add("button", undefined, "フォルダを開く");
    var copyTextButton = textLogGroup.add("button", undefined, "クリップボードにコピー");
    openTextFolderButton.preferredSize.width = 120;
    copyTextButton.preferredSize.width = 160;

    // ★★★ ルビ一覧を更新する関数 ★★★
    function updateRubyListDisplay() {
        rubyListBox.removeAll();

        // ソート処理
        var sortedList = rubyListData.slice(); // コピーを作成
        var sortMode = rubySortDropdown.selection ? rubySortDropdown.selection.index : 0;

        switch (sortMode) {
            case 0: // 出現順
                sortedList.sort(function(a, b) {
                    return a.order - b.order;
                });
                break;
            case 1: // ルビ名順
                sortedList.sort(function(a, b) {
                    return a.ruby.localeCompare(b.ruby, "ja");
                });
                break;
            case 2: // 親文字順
                sortedList.sort(function(a, b) {
                    return a.parent.localeCompare(b.parent, "ja");
                });
                break;
            case 3: // 巻数-ページ順
                sortedList.sort(function(a, b) {
                    if (a.volume !== b.volume) {
                        return naturalSortCompare(a.volume, b.volume);
                    }
                    return a.page - b.page;
                });
                break;
        }

        // リストに追加
        for (var i = 0; i < sortedList.length; i++) {
            var data = sortedList[i];
            var item = rubyListBox.add("item", data.parent);
            // ★★★ 表示時にもルビから空白（半角・全角）を除去 ★★★
            var displayRuby = (data.ruby || "").replace(/[\s\u3000]/g, "");
            item.subItems[0].text = displayRuby;
            item.subItems[1].text = data.volume + "巻";
            item.subItems[2].text = data.page + "P";
            item.rubyData = data;
        }
    }

    // ソート変更時に更新
    rubySortDropdown.onChange = function() {
        updateRubyListDisplay();
    };

    // ★★★ ルビ一覧の基準フォルダ ★★★
    var RUBY_LIST_BASE_PATH = "G:/共有ドライブ/CLLENN/編集部フォルダ/編集企画部/写植・校正用テキストログ";

    // ★★★ 外部ルビ一覧.txtファイルからルビを読み込む ★★★
    function loadRubyListFromExternalFile(label, title) {
        if (!label || !title) return false;

        // パスを構築: {basePath}/{label}/{title}/ルビ一覧.txt
        var rubyFilePath = RUBY_LIST_BASE_PATH + "/" + label + "/" + title + "/ルビ一覧.txt";
        var rubyFile = new File(rubyFilePath);

        if (!rubyFile.exists) {
            return false;
        }

        try {
            rubyFile.encoding = "UTF-8";
            if (!rubyFile.open("r")) {
                return false;
            }

            var content = rubyFile.read();
            rubyFile.close();

            // ルビ一覧をパース
            // 形式: [01巻-1]親文字(ルビ) または 親文字(ルビ)
            // ★★★ 複数行にわたる親文字に対応 ★★★
            // 例:
            // [09巻-2]君と会ったと
            // 美優から
            // 聞いたよ(ゆう)
            // → 親文字: "君と会ったと\n美優から\n聞いたよ", ルビ: "ゆう"
            rubyListData = [];
            var lines = content.split(/[\r\n]+/);
            var orderCounter = 0;

            // 蓄積用変数
            var accumulatedParent = [];
            var currentVolume = "01";
            var currentPage = 1;

            for (var i = 0; i < lines.length; i++) {
                var line = lines[i].replace(/^\s+|\s+$/g, ""); // trim
                if (line === "") continue;

                // 新しいエントリの開始をチェック [XX巻-YY]形式
                var volumePageMatch = line.match(/^\[(\d+)巻-(\d+)\](.*)$/);

                if (volumePageMatch) {
                    // 新しい巻-ページが始まった場合、前の蓄積をリセット
                    // （ルビなしで終わった場合は破棄）
                    accumulatedParent = [];
                    currentVolume = volumePageMatch[1].length === 1 ? "0" + volumePageMatch[1] : volumePageMatch[1];
                    currentPage = parseInt(volumePageMatch[2], 10) || 1;
                    line = volumePageMatch[3]; // [XX巻-YY]の後の部分
                    if (line === "") continue;
                }

                // この行にルビ（括弧）があるかチェック
                var hasRuby = /[\(（][^)）]+[\)）]/.test(line);

                if (hasRuby) {
                    // ルビがある行 = このエントリの最終行
                    // 親文字部分を抽出（括弧の前まで）
                    var parentPartOfLine = line.replace(/[\(（][^)）]*[\)）]/g, "");

                    // 蓄積された親文字に追加
                    if (parentPartOfLine !== "") {
                        accumulatedParent.push(parentPartOfLine);
                    }

                    // 親文字を結合（改行で繋ぐ）
                    var fullParentText = accumulatedParent.join("\n");

                    // ルビを抽出
                    var rubyMatches = line.match(/[\(（]([^)）]+)[\)）]/g);

                    if (rubyMatches && rubyMatches.length > 0 && fullParentText !== "") {
                        for (var j = 0; j < rubyMatches.length; j++) {
                            var rubyText = rubyMatches[j].replace(/[\(（\)）]/g, "");
                            // 空白を除去
                            rubyText = rubyText.replace(/[\s\u3000]/g, "");
                            if (rubyText === "") continue;

                            rubyListData.push({
                                parent: fullParentText,
                                ruby: rubyText,
                                volume: currentVolume,
                                page: currentPage,
                                order: orderCounter++
                            });
                        }
                    }

                    // 蓄積をリセット
                    accumulatedParent = [];
                } else {
                    // ルビがない行 = 親文字の途中
                    accumulatedParent.push(line);
                }
            }

            updateRubyListDisplay();
            return rubyListData.length > 0;

        } catch (e) {
            return false;
        }
    }

    // ★★★ scanDataからルビ一覧を読み込む ★★★
    function loadRubyListFromScanData() {
        rubyListData = [];
        if (!scanData || !scanData.textLogByFolder) return;

        var orderCounter = 0;
        var folderNames = [];
        for (var folderName in scanData.textLogByFolder) {
            if (scanData.textLogByFolder.hasOwnProperty(folderName)) {
                folderNames.push(folderName);
            }
        }
        folderNames.sort(naturalSortCompare);

        var startVolume = scanData.startVolume || (scanData.workInfo ? scanData.workInfo.volume : 1) || 1;

        for (var folderIdx = 0; folderIdx < folderNames.length; folderIdx++) {
            var srcFolderName = folderNames[folderIdx];
            var currentVolume = startVolume + folderIdx;
            var volumeStr = zeroPad(currentVolume, 2);

            var folderData = scanData.textLogByFolder[srcFolderName];
            var docNames = [];
            for (var docName in folderData) {
                if (folderData.hasOwnProperty(docName)) {
                    docNames.push(docName);
                }
            }
            docNames.sort(function(a, b) {
                var numA = parseInt(a.replace(/[^0-9]/g, ""), 10) || 0;
                var numB = parseInt(b.replace(/[^0-9]/g, ""), 10) || 0;
                return numA - numB;
            });

            var pageNum = 1;
            for (var i = 0; i < docNames.length; i++) {
                var docName = docNames[i];
                var texts = folderData[docName];

                // リンクグループを収集
                var linkedGroups = {};
                for (var j = 0; j < texts.length; j++) {
                    if (texts[j].isLinked && texts[j].linkGroupId) {
                        var groupId = texts[j].linkGroupId;
                        if (!linkedGroups[groupId]) {
                            linkedGroups[groupId] = [];
                        }
                        linkedGroups[groupId].push({
                            content: texts[j].content,
                            fontSize: texts[j].fontSize || 0,
                            layerName: texts[j].layerName || ""
                        });
                    }
                }

                // 各リンクグループからルビを抽出
                for (var groupId in linkedGroups) {
                    if (!linkedGroups.hasOwnProperty(groupId)) continue;
                    var groupTexts = linkedGroups[groupId];
                    groupTexts.sort(function(a, b) {
                        return b.fontSize - a.fontSize;
                    });

                    if (groupTexts.length >= 2) {
                        var parentText = groupTexts[0].content;

                        for (var t = 1; t < groupTexts.length; t++) {
                            var rubyText = groupTexts[t].content;
                            var rubyLayerName = groupTexts[t].layerName || "";

                            // ルビが「・」「゛」のみの場合はスキップ
                            var trimmedRuby = rubyText.replace(/[\s\u3000]/g, "");
                            if (/^[・･゛]+$/.test(trimmedRuby)) continue;

                            // 括弧形式かチェック
                            var bracketMatch = rubyLayerName.match(/^(.+?)[\(（](.+?)[\)）]$/);
                            if (bracketMatch) {
                                rubyListData.push({
                                    parent: bracketMatch[2],
                                    ruby: bracketMatch[1],
                                    volume: volumeStr,
                                    page: pageNum,
                                    order: orderCounter++
                                });
                            } else {
                                rubyListData.push({
                                    parent: parentText,
                                    ruby: rubyText,
                                    volume: volumeStr,
                                    page: pageNum,
                                    order: orderCounter++
                                });
                            }
                        }
                    }
                }
                pageNum++;
            }
        }
        updateRubyListDisplay();
    }

    // ★★★ 指定フォルダからルビを抽出して既存editedRubyListに追記する関数 ★★★
    function appendRubyFromNewFolders(newFolderNames) {
        if (!scanData || !scanData.textLogByFolder || !newFolderNames || newFolderNames.length === 0) return;

        // 既存のeditedRubyListを保持（なければ空配列）
        if (!scanData.editedRubyList) {
            scanData.editedRubyList = [];
        }

        var beforeCount = scanData.editedRubyList.length; // デバッグ用

        // 既存の最大orderを取得
        var maxOrder = 0;
        for (var i = 0; i < scanData.editedRubyList.length; i++) {
            if (scanData.editedRubyList[i].order > maxOrder) {
                maxOrder = scanData.editedRubyList[i].order;
            }
        }
        var orderCounter = maxOrder + 1;

        // ★★★ デバッグ: textLogByFolderのキーを確認 ★★★
        var textLogKeys = [];
        for (var key in scanData.textLogByFolder) {
            if (scanData.textLogByFolder.hasOwnProperty(key)) {
                textLogKeys.push(key);
            }
        }

        // 新しいフォルダからのみルビを抽出
        for (var folderIdx = 0; folderIdx < newFolderNames.length; folderIdx++) {
            var srcFolderName = newFolderNames[folderIdx];

            // ★★★ フォルダ名が見つからない場合、decodeURIを試す ★★★
            if (!scanData.textLogByFolder[srcFolderName]) {
                // decodeURIしたキーで再検索
                var decodedName = decodeURI(srcFolderName);
                if (scanData.textLogByFolder[decodedName]) {
                    srcFolderName = decodedName;
                } else {
                    // エンコードされたキーで再検索
                    var encodedName = encodeURI(srcFolderName);
                    if (scanData.textLogByFolder[encodedName]) {
                        srcFolderName = encodedName;
                    } else {
                        continue; // 見つからない場合はスキップ
                    }
                }
            }

            // folderVolumeMappingから巻数を取得
            var currentVolume = 1;
            if (scanData.folderVolumeMapping && scanData.folderVolumeMapping[srcFolderName]) {
                currentVolume = scanData.folderVolumeMapping[srcFolderName];
            }
            var volumeStr = zeroPad(currentVolume, 2);

            var folderData = scanData.textLogByFolder[srcFolderName];
            var docNames = [];
            for (var docName in folderData) {
                if (folderData.hasOwnProperty(docName)) {
                    docNames.push(docName);
                }
            }
            docNames.sort(function(a, b) {
                var numA = parseInt(a.replace(/[^0-9]/g, ""), 10) || 0;
                var numB = parseInt(b.replace(/[^0-9]/g, ""), 10) || 0;
                return numA - numB;
            });

            var pageNum = 1;
            for (var i = 0; i < docNames.length; i++) {
                var docName = docNames[i];
                var texts = folderData[docName];

                // リンクグループを収集
                var linkedGroups = {};
                for (var j = 0; j < texts.length; j++) {
                    if (texts[j].isLinked && texts[j].linkGroupId) {
                        var groupId = texts[j].linkGroupId;
                        if (!linkedGroups[groupId]) {
                            linkedGroups[groupId] = [];
                        }
                        linkedGroups[groupId].push({
                            content: texts[j].content,
                            fontSize: texts[j].fontSize || 0,
                            layerName: texts[j].layerName || ""
                        });
                    }
                }

                // 各リンクグループからルビを抽出
                for (var groupId in linkedGroups) {
                    if (!linkedGroups.hasOwnProperty(groupId)) continue;
                    var groupTexts = linkedGroups[groupId];
                    groupTexts.sort(function(a, b) {
                        return b.fontSize - a.fontSize;
                    });

                    if (groupTexts.length >= 2) {
                        var parentText = groupTexts[0].content;

                        for (var t = 1; t < groupTexts.length; t++) {
                            var rubyText = groupTexts[t].content;
                            var rubyLayerName = groupTexts[t].layerName || "";

                            // ルビが「・」「゛」のみの場合はスキップ
                            var trimmedRuby = rubyText.replace(/[\s\u3000]/g, "");
                            if (/^[・･゛]+$/.test(trimmedRuby)) continue;

                            // 括弧形式かチェック
                            var bracketMatch = rubyLayerName.match(/^(.+?)[\(（](.+?)[\)）]$/);
                            if (bracketMatch) {
                                scanData.editedRubyList.push({
                                    parent: bracketMatch[2],
                                    ruby: bracketMatch[1].replace(/[\s\u3000]/g, ""),
                                    volume: volumeStr,
                                    page: pageNum,
                                    order: orderCounter++
                                });
                            } else {
                                scanData.editedRubyList.push({
                                    parent: parentText,
                                    ruby: trimmedRuby,
                                    volume: volumeStr,
                                    page: pageNum,
                                    order: orderCounter++
                                });
                            }
                        }
                    }
                }
                pageNum++;
            }
        }

        // ★★★ デバッグ: 追加されたルビの数を表示 ★★★
        var afterCount = scanData.editedRubyList.length;
        var addedRubyCount = afterCount - beforeCount;
        if (addedRubyCount > 0) {
            // 追加成功
        } else {
            // デバッグ情報をアラート
            var debugMsg = "【デバッグ】ルビ追加結果:\n";
            debugMsg += "追加前: " + beforeCount + "件\n";
            debugMsg += "追加後: " + afterCount + "件\n";
            debugMsg += "追加数: " + addedRubyCount + "件\n\n";
            debugMsg += "検索フォルダ: " + newFolderNames.join(", ") + "\n";
            debugMsg += "textLogByFolderのキー: " + textLogKeys.join(", ");
            alert(debugMsg);
        }

        // rubyListDataも更新（UI表示用）
        rubyListData = scanData.editedRubyList.slice();
        updateRubyListDisplay();
    }

    // ★★★ ルビリストをscanDataに保存する関数 ★★★
    function saveRubyListToScanData() {
        if (!scanData) return;
        // rubyListDataをscanDataに保存（編集済みフラグ付き）
        scanData.editedRubyList = [];
        for (var i = 0; i < rubyListData.length; i++) {
            scanData.editedRubyList.push({
                parent: rubyListData[i].parent,
                ruby: rubyListData[i].ruby,
                volume: rubyListData[i].volume,
                page: rubyListData[i].page,
                order: rubyListData[i].order
            });
        }
    }

    // ★★★ ルビ一覧を外部テキストファイルに保存する関数 ★★★
    function saveRubyListToExternalFile() {
        // レーベルとタイトルを取得
        var labelToUse = "";
        var titleToUse = "";
        if (workInfo && workInfo.label && workInfo.title) {
            labelToUse = workInfo.label;
            titleToUse = workInfo.title;
        } else if (scanData && scanData.workInfo) {
            labelToUse = scanData.workInfo.label || "";
            titleToUse = scanData.workInfo.title || "";
        }

        if (!labelToUse || !titleToUse) {
            alert("レーベル名またはタイトルが設定されていません。\n\n作品情報を設定してから再試行してください。");
            return false;
        }

        if (rubyListData.length === 0) {
            alert("保存するルビデータがありません。");
            return false;
        }

        // 保存パスを構築
        var rubyFilePath = RUBY_LIST_BASE_PATH + "/" + labelToUse + "/" + titleToUse + "/ルビ一覧.txt";
        var rubyFile = new File(rubyFilePath);

        // 親フォルダが存在しない場合は作成
        var parentFolder = rubyFile.parent;
        if (!parentFolder.exists) {
            if (!parentFolder.create()) {
                alert("フォルダの作成に失敗しました:\n" + parentFolder.fsName);
                return false;
            }
        }

        // ルビ一覧をテキスト形式で作成
        // 形式: [XX巻-YY]親文字(ルビ)
        // 複数行の親文字は改行を含めてそのまま出力
        var outputLines = [];

        // 巻・ページ順でソート
        var sortedData = rubyListData.slice().sort(function(a, b) {
            var volA = parseInt(a.volume, 10) || 0;
            var volB = parseInt(b.volume, 10) || 0;
            if (volA !== volB) return volA - volB;
            var pageA = a.page || 0;
            var pageB = b.page || 0;
            if (pageA !== pageB) return pageA - pageB;
            return (a.order || 0) - (b.order || 0);
        });

        for (var i = 0; i < sortedData.length; i++) {
            var item = sortedData[i];
            var volStr = item.volume || "01";
            var pageStr = String(item.page || 1);
            var parent = item.parent || "";
            var ruby = item.ruby || "";

            // 親文字に改行が含まれる場合、最初の行に巻・ページ情報を付加
            var parentLines = parent.split("\n");
            var firstLine = "[" + volStr + "巻-" + pageStr + "]" + parentLines[0];

            outputLines.push(firstLine);
            // 2行目以降はそのまま
            for (var j = 1; j < parentLines.length; j++) {
                if (j === parentLines.length - 1) {
                    // 最終行にルビを付加
                    outputLines.push(parentLines[j] + "(" + ruby + ")");
                } else {
                    outputLines.push(parentLines[j]);
                }
            }
            // 1行のみの場合は最初の行にルビを付加
            if (parentLines.length === 1) {
                outputLines[outputLines.length - 1] += "(" + ruby + ")";
            }
        }

        try {
            rubyFile.encoding = "UTF-8";
            if (!rubyFile.open("w")) {
                alert("ファイルを開けませんでした:\n" + rubyFilePath);
                return false;
            }
            rubyFile.write(outputLines.join("\r\n"));
            rubyFile.close();
            return true;
        } catch (e) {
            alert("ファイルの保存中にエラーが発生しました:\n" + e.message);
            return false;
        }
    }

    // ★★★ ルビ編集ダイアログ ★★★
    rubyEditButton.onClick = function() {
        if (!rubyListBox.selection) {
            alert("編集するルビを選択してください。");
            return;
        }
        var selectedData = rubyListBox.selection.rubyData;
        var editDialog = new Window("dialog", "ルビを編集");
        editDialog.orientation = "column";
        editDialog.alignChildren = ["fill", "top"];
        editDialog.margins = 15;

        var parentGroup = editDialog.add("group");
        parentGroup.add("statictext", undefined, "親文字:");
        var parentInput = parentGroup.add("edittext", undefined, selectedData.parent);
        parentInput.preferredSize.width = 200;

        var rubyGroup = editDialog.add("group");
        rubyGroup.add("statictext", undefined, "ルビ:");
        var rubyInput = rubyGroup.add("edittext", undefined, selectedData.ruby);
        rubyInput.preferredSize.width = 200;

        var btnGroup = editDialog.add("group");
        btnGroup.alignment = "center";
        var okBtn = btnGroup.add("button", undefined, "OK");
        var cancelBtn = btnGroup.add("button", undefined, "キャンセル");

        okBtn.onClick = function() {
            selectedData.parent = parentInput.text;
            selectedData.ruby = rubyInput.text;
            updateRubyListDisplay();
            saveRubyListToScanData(); // ★★★ scanDataに保存 ★★★
            editDialog.close();
        };
        cancelBtn.onClick = function() { editDialog.close(); };
        editDialog.show();
    };

    // ★★★ ルビ削除 ★★★
    rubyDeleteButton.onClick = function() {
        if (!rubyListBox.selection) {
            alert("削除するルビを選択してください。");
            return;
        }
        var selectedData = rubyListBox.selection.rubyData;
        var idx = -1;
        for (var i = 0; i < rubyListData.length; i++) {
            if (rubyListData[i] === selectedData) {
                idx = i;
                break;
            }
        }
        if (idx >= 0) {
            rubyListData.splice(idx, 1);
            updateRubyListDisplay();
            saveRubyListToScanData(); // ★★★ scanDataに保存 ★★★
        }
    };

    // ★★★ ルビ追加ダイアログ ★★★
    rubyAddButton.onClick = function() {
        var addDialog = new Window("dialog", "ルビを追加");
        addDialog.orientation = "column";
        addDialog.alignChildren = ["fill", "top"];
        addDialog.margins = 15;

        var parentGroup = addDialog.add("group");
        parentGroup.add("statictext", undefined, "親文字:");
        var parentInput = parentGroup.add("edittext", undefined, "");
        parentInput.preferredSize.width = 200;

        var rubyGroup = addDialog.add("group");
        rubyGroup.add("statictext", undefined, "ルビ:");
        var rubyInput = rubyGroup.add("edittext", undefined, "");
        rubyInput.preferredSize.width = 200;

        var volGroup = addDialog.add("group");
        volGroup.add("statictext", undefined, "巻数:");
        var volInput = volGroup.add("edittext", undefined, "01");
        volInput.preferredSize.width = 50;

        var pageGroup = addDialog.add("group");
        pageGroup.add("statictext", undefined, "ページ:");
        var pageInput = pageGroup.add("edittext", undefined, "1");
        pageInput.preferredSize.width = 50;

        var btnGroup = addDialog.add("group");
        btnGroup.alignment = "center";
        var okBtn = btnGroup.add("button", undefined, "追加");
        var cancelBtn = btnGroup.add("button", undefined, "キャンセル");

        okBtn.onClick = function() {
            if (!parentInput.text || !rubyInput.text) {
                alert("親文字とルビを入力してください。");
                return;
            }
            var maxOrder = 0;
            for (var i = 0; i < rubyListData.length; i++) {
                if (rubyListData[i].order > maxOrder) {
                    maxOrder = rubyListData[i].order;
                }
            }
            rubyListData.push({
                parent: parentInput.text,
                ruby: rubyInput.text,
                volume: volInput.text || "01",
                page: parseInt(pageInput.text, 10) || 1,
                order: maxOrder + 1
            });
            updateRubyListDisplay();
            saveRubyListToScanData(); // ★★★ scanDataに保存 ★★★
            addDialog.close();
        };
        cancelBtn.onClick = function() { addDialog.close(); };
        addDialog.show();
    };

    // ★★★ ルビ一覧を外部ファイルに保存 ★★★
    rubyRefreshButton.onClick = function() {
        if (rubyListData.length === 0) {
            alert("保存するルビデータがありません。");
            return;
        }

        // レーベルとタイトルを取得
        var labelToUse = "";
        var titleToUse = "";
        if (workInfo && workInfo.label && workInfo.title) {
            labelToUse = workInfo.label;
            titleToUse = workInfo.title;
        } else if (scanData && scanData.workInfo) {
            labelToUse = scanData.workInfo.label || "";
            titleToUse = scanData.workInfo.title || "";
        }

        if (!labelToUse || !titleToUse) {
            alert("レーベル名またはタイトルが設定されていません。\n\n作品情報タブで設定してから再試行してください。");
            return;
        }

        var savePath = RUBY_LIST_BASE_PATH + "/" + labelToUse + "/" + titleToUse + "/ルビ一覧.txt";

        saveRubyListToScanData(); // scanDataにも保存

        if (saveRubyListToExternalFile()) {
            alert("ルビ一覧を保存しました。\n\n保存先:\n" + savePath + "\n\n件数: " + rubyListData.length + "件");
        }
    };

    // ★★★ ルビ統一（重複削除） ★★★
    // 条件：ルビが完全一致（空白除去後）かつ 初出の親文字が後の親文字に含まれている場合、後を削除
    rubyUnifyButton.onClick = function() {
        if (rubyListData.length === 0) {
            alert("ルビデータがありません。");
            return;
        }

        // 出現順でソート
        rubyListData.sort(function(a, b) {
            return a.order - b.order;
        });

        var removedCount = 0;
        var unifiedList = [];
        // ルビごとに、最初に出現した親文字を記録
        var firstParentByRuby = {}; // normalizedRuby -> 最初の親文字

        for (var i = 0; i < rubyListData.length; i++) {
            var item = rubyListData[i];
            // ★★★ 比較用にルビから空白を除去して正規化 ★★★
            var normalizedRuby = (item.ruby || "").replace(/[\s\u3000]/g, "");
            var parent = item.parent || "";

            if (firstParentByRuby[normalizedRuby] === undefined) {
                // このルビは初出：記録して追加
                firstParentByRuby[normalizedRuby] = parent;
                unifiedList.push(item);
            } else {
                // このルビは既出：初出の親文字が今回の親文字に含まれているかチェック
                var firstParent = firstParentByRuby[normalizedRuby];
                // ★★★ 初出の親文字が含まれていれば重複として削除 ★★★
                if (parent.indexOf(firstParent) >= 0) {
                    removedCount++;
                } else {
                    // 別の親文字に対するルビ → 追加
                    unifiedList.push(item);
                }
            }
        }

        if (removedCount > 0) {
            rubyListData = unifiedList;
            updateRubyListDisplay();
            saveRubyListToScanData();
            alert("ルビを統一しました。\n" + removedCount + "件の重複を削除しました。\n残り: " + rubyListData.length + "件");
        } else {
            alert("重複するルビはありませんでした。");
        }
    };

    // ダブルクリックで編集
    rubyListBox.onDoubleClick = function() {
        rubyEditButton.notify("onClick");
    };

    // 初期読み込み
    loadRubyListFromScanData();
    saveRubyListToScanData(); // ★★★ 初期データもscanDataに保存 ★★★

    // ★★★ ガイドセットのページ循環用トラッキング変数 ★★★
    var lastSelectedGuideSetIndex = null;  // 最後に選択した選択済みセットのインデックス
    var currentSelectedGuidePageIndex = 0;  // 選択済みセットの現在表示中ページインデックス
    var lastSelectedUnselectedGuideSetIndex = null;  // 最後に選択した未選択セットのインデックス
    var currentGuidePageIndex = 0;  // 未選択セットの現在表示中ページインデックス

    // ===== インポート/エクスポート =====
    var ioPanel = dialog.add("panel", undefined, "インポート / エクスポート");
    ioPanel.orientation = "column";
    ioPanel.alignChildren = ["fill", "top"];
    ioPanel.spacing = 5;
    ioPanel.margins = 10;
    var ioGroup = ioPanel.add("group");
    ioGroup.orientation = "row";
    ioGroup.spacing = 5;
    
    var importButton = ioGroup.add("button", undefined, "JSON選択に戻る");

    // ★★★ 上書き保存ボタン（新規作成時は自動保存後に有効化）★★★
    var saveButton = ioGroup.add("button", undefined, "上書き保存");
    saveButton.enabled = (jsonToImport && lastUsedFile) ? true : false;

    var exportCurrentButton = ioGroup.add("button", undefined, "選択中のタブを保存");

    // ★★★ 追加スキャンボタン ★★★
    var additionalScanButton = ioGroup.add("button", undefined, "追加スキャン");

    var closeButton = ioGroup.add("button", undefined, "閉じる");

    importButton.preferredSize.width = 110;
    saveButton.preferredSize.width = 90;
    exportCurrentButton.preferredSize.width = 130;
    additionalScanButton.preferredSize.width = 90;
    closeButton.preferredSize.width = 60;

    // ★★★ 内部変数（表示なし）★★★
    var importedFileName = { text: "なし" }; // 内部保持用（UI表示なし）

    // ★★★ テキストフォルダを開くボタン ★★★
    openTextFolderButton.onClick = function() {
        if (!workInfo.label || !workInfo.title) {
            alert("レーベルとタイトルを入力してください。");
            return;
        }
        // sanitizeFileNameを使わず、そのままのレーベル・タイトルを使用
        var textFolderPath = TEXT_LOG_FOLDER_PATH + "/" + workInfo.label + "/" + workInfo.title;
        var textFolder = new Folder(textFolderPath);
        if (textFolder.exists) {
            // フォルダを開く（Folder.execute()を使用）
            textFolder.execute();
        } else {
            // フォルダが存在しない場合、親フォルダ（レーベル）を試す
            var labelFolderPath = TEXT_LOG_FOLDER_PATH + "/" + workInfo.label;
            var labelFolder = new Folder(labelFolderPath);
            if (labelFolder.exists) {
                labelFolder.execute();
                alert("タイトルフォルダが見つかりませんでした。\nレーベルフォルダを開きました。\n\n探したパス:\n" + textFolderPath);
            } else {
                // ベースフォルダを開く
                var baseFolder = new Folder(TEXT_LOG_FOLDER_PATH);
                if (baseFolder.exists) {
                    baseFolder.execute();
                    alert("フォルダが見つかりませんでした。\nベースフォルダを開きました。\n\n探したパス:\n" + textFolderPath);
                } else {
                    alert("テキストログフォルダが見つかりません:\n" + textFolderPath);
                }
            }
        }
    };

    // ★★★ テキストをクリップボードにコピー ★★★
    copyTextButton.onClick = function() {
        if (!workInfo.label || !workInfo.title) {
            alert("レーベルとタイトルを入力してください。");
            return;
        }
        // sanitizeFileNameを使わず、そのままのレーベル・タイトルを使用
        var textFolderPath = TEXT_LOG_FOLDER_PATH + "/" + workInfo.label + "/" + workInfo.title;
        var textFolder = new Folder(textFolderPath);

        if (!textFolder.exists) {
            alert("テキストログフォルダが見つかりません:\n" + textFolderPath + "\n\n先にデータを保存してください。");
            return;
        }

        // テキストファイル選択ダイアログ
        var selectDialog = new Window("dialog", "コピーするテキストを選択");
        selectDialog.orientation = "column";
        selectDialog.alignChildren = ["fill", "top"];
        selectDialog.margins = 15;

        selectDialog.add("statictext", undefined, "コピーするテキストファイルを選択:");
        var textFileList = selectDialog.add("listbox", undefined, [], {multiselect: false});
        textFileList.preferredSize = [300, 150];

        // テキストファイルを列挙
        var txtFiles = textFolder.getFiles("*.txt");
        for (var ti = 0; ti < txtFiles.length; ti++) {
            textFileList.add("item", decodeURI(txtFiles[ti].name));
            textFileList.items[ti].fileObj = txtFiles[ti];
        }
        if (textFileList.items.length > 0) {
            textFileList.selection = 0;
        }

        var selectBtnGroup = selectDialog.add("group");
        selectBtnGroup.alignment = "center";
        var selectOkBtn = selectBtnGroup.add("button", undefined, "コピー");
        var selectCancelBtn = selectBtnGroup.add("button", undefined, "キャンセル");

        selectOkBtn.onClick = function() {
            if (!textFileList.selection) {
                alert("ファイルを選択してください。");
                return;
            }
            var selectedFile = textFileList.selection.fileObj;
            try {
                selectedFile.encoding = "UTF-8";
                selectedFile.open("r");
                var content = selectedFile.read();
                selectedFile.close();

                // クリップボードにコピー（PowerShellを使用 - Unicode対応）
                // 一時ファイルにテキストを保存してからPowerShellで読み込む方式
                var tempTxtFile = new File(Folder.temp.fsName + "/clipboard_temp.txt");
                tempTxtFile.encoding = "UTF-8";
                tempTxtFile.open("w");
                tempTxtFile.write(content);
                tempTxtFile.close();

                var psCommand = 'powershell -Command "Get-Content -Path \'' + tempTxtFile.fsName.replace(/\\/g, '\\\\') + '\' -Encoding UTF8 -Raw | Set-Clipboard"';
                app.system(psCommand);

                tempTxtFile.remove();

                alert("クリップボードにコピーしました:\n" + decodeURI(selectedFile.name) + "\n\nメモ帳などに貼り付けできます。");
                selectDialog.close();
            } catch (e) {
                alert("コピーに失敗しました:\n" + e.message);
            }
        };
        selectCancelBtn.onClick = function() { selectDialog.close(); };
        selectDialog.show();
    };

    // ===== 関数定義 =====

    // ★★★ フォント名からサブ名称を自動取得する関数 ★★★
    function getAutoSubName(fontName) {
        if (!fontName) return "";
        var fontNameLower = fontName.toLowerCase();
        var displayName = getFontDisplayName(fontName).toLowerCase();

        // フォント名とサブ名称のマッピング（より具体的なパターンを先に配置）
        var fontSubNameMap = [
            { keywords: ["f910", "コミックw4", "comicw4"], subName: "セリフ" },
            { keywords: ["中丸ゴシック", "nakamarugo", "nakamaru"], subName: "モノローグ" },
            { keywords: ["平成明朝体w7", "heiseimin"], subName: "回想内ネーム" },
            { keywords: ["ＤＦ平成ゴシック体 W9", "ＤＦ平成ゴシック体 w9", "平成ゴシック体w9", "平成ゴシック体 w9", "heiseigow9"], subName: "怒鳴り（シリアス）" },
            { keywords: ["ＤＦ平成ゴシック体 W7", "ＤＦ平成ゴシック体 w7", "平成ゴシック体w7", "平成ゴシック体 w7", "heiseigow7"], subName: "語気強く（通常）" },
            { keywords: ["ＤＦ平成ゴシック体 W5", "ＤＦ平成ゴシック体 w5", "平成ゴシック体w5", "平成ゴシック体 w5", "heiseigow5"], subName: "ナレーション" },
            { keywords: ["コミックフォント太", "comicfont太"], subName: "語気強く（通常）" },
            { keywords: ["新ゴ pr5 db", "a-otf 新ゴ pr5 db", "shingo-db", "shingopr5-db"], subName: "語気強く（通常）" },
            { keywords: ["リュウミンu", "ryuminu"], subName: "悲鳴" },
            { keywords: ["ヒラギノ丸ゴ", "hiragino maru", "hiraginomarugopro"], subName: "SNSなど" },
            { keywords: ["源暎ラテゴ", "geneilatego", "geneila"], subName: "電話・テレビ" },
            { keywords: ["康印体", "kouin"], subName: "おどろ" },
            { keywords: ["綜藝", "sougei", "sougeimoji"], subName: "ギャグテイスト" }
        ];

        for (var i = 0; i < fontSubNameMap.length; i++) {
            var entry = fontSubNameMap[i];
            for (var j = 0; j < entry.keywords.length; j++) {
                var keyword = entry.keywords[j].toLowerCase();
                if (fontNameLower.indexOf(keyword) >= 0 || displayName.indexOf(keyword) >= 0) {
                    return entry.subName;
                }
            }
        }
        return "";
    }

    function updatePresetList() {
        if (!allPresetSets[currentSetName]) {
            var presetSetCount = 0;
            for (var k in allPresetSets) {
                if (allPresetSets.hasOwnProperty(k)) presetSetCount++;
            }
            if (presetSetCount === 0) {
                allPresetSets = {"デフォルト": []};
                currentSetName = "デフォルト";
            } else {
                for (var name in allPresetSets) {
                    currentSetName = name;
                    break;
                }
            }
        }
        updateTab2PresetList();
    }
    
    // ★★★ 以下の関数は左側パネル削除に伴い空の関数に変更 ★★★
    function updateFolderDropdown() {}
    function updateDocDropdownByFolder() {}
    function isDocInFolder(docName, folderPath) { return false; }
    function updateTextLayerList() {}
    function updateTextLayerListForDoc(docNameOrDoc) {}

    // ★★★ ドキュメント表示名を取得するヘルパー関数 ★★★
    function getDocDisplayName(doc) {
        try {
            if (doc.path) {
                var folderName = doc.path.name;
                var fileName = doc.name;
                try { folderName = decodeURI(folderName); } catch (e) {}
                try { fileName = decodeURI(fileName); } catch (e) {}
                return folderName + "/" + fileName;
            } else {
                var fileName = doc.name;
                try { fileName = decodeURI(fileName); } catch (e) {}
                return fileName;
            }
        } catch (e) {
            var fileName = doc.name;
            try { fileName = decodeURI(fileName); } catch (e2) {}
            return fileName;
        }
    }

    function getGuideSetHash(guideSet) {
        try {
            var hArray = [];
            for (var i = 0; i < guideSet.horizontal.length; i++) {
                hArray.push(guideSet.horizontal[i].toFixed(1));
            }
            var vArray = [];
            for (var j = 0; j < guideSet.vertical.length; j++) {
                vArray.push(guideSet.vertical[j].toFixed(1));
            }
            var h = hArray.join(",");
            var v = vArray.join(",");
            return "H:" + h + "|V:" + v;
        } catch (e) {
            return "ERROR";
        }
    }
    
    function readAllGuides(silent) {
        if (app.documents.length === 0) {
            if (!silent) alert("ドキュメントが開かれていません。");
            return { totalSets: 0, error: false };
        }
        
        var progressWin = new Window("palette", "ガイド線読み取り中...", undefined, {closeButton: false});
        progressWin.orientation = "column";
        progressWin.alignChildren = ["fill", "top"];
        progressWin.spacing = 10;
        progressWin.margins = 15;
        var statusText = progressWin.add("statictext", undefined, "処理を開始しています...");
        statusText.preferredSize.width = 400;
        var progressBar = progressWin.add("progressbar", undefined, 0, 100);
        progressBar.preferredSize.width = 400;
        var detailText = progressWin.add("statictext", undefined, "");
        detailText.preferredSize.width = 400;
        var noteText = progressWin.add("statictext", undefined, "※エラーメッセージが表示されても、処理は続行されます");
        noteText.graphics.foregroundColor = noteText.graphics.newPen(progressWin.graphics.PenType.SOLID_COLOR, [0.7, 0.7, 0.7], 1);
        progressWin.center();
        progressWin.show();
        
        try {
            var guideSets = {}; 
            var processedDocs = 0;
            var errorDocs = 0;
            var emptyDocs = 0;
            var debugInfo = []; 
            var totalDocs = app.documents.length;
            
            for (var d = 0; d < totalDocs; d++) {
                var doc = null;
                try {
                    doc = app.documents[d];
                    statusText.text = "処理中: " + doc.name + " (" + (d + 1) + "/" + totalDocs + ")";
                    progressBar.value = (d / totalDocs) * 100;
                    detailText.text = "成功: " + processedDocs + " / エラー: " + errorDocs + " / 空: " + emptyDocs;
                    progressWin.update();
                    
                    try {
                        app.activeDocument = doc;
                    } catch (activateError) {
                        errorDocs++;
                        continue;
                    }
                    
                    var guides = getGuideInfo(doc);
                    
                    var roundedH = [];
                    var roundedV = [];
                    
                    try {
                        for (var h = 0; h < guides.horizontal.length; h++) {
                            roundedH.push(Math.round(guides.horizontal[h] * 10) / 10);
                        }
                    } catch (e) {
                        errorDocs++;
                        continue;
                    }
                    
                    try {
                        for (var v = 0; v < guides.vertical.length; v++) {
                            roundedV.push(Math.round(guides.vertical[v] * 10) / 10);
                        }
                    } catch (e) {
                        errorDocs++;
                        continue;
                    }
                    
                    try {
                        roundedH.sort(function(a, b) { return a - b; });
                        roundedV.sort(function(a, b) { return a - b; });
                    } catch (e) {
                        errorDocs++;
                        continue;
                    }
                    
                    if (roundedH.length > 0 || roundedV.length > 0) {
                        try {
                            var hash = getGuideSetHash({ horizontal: roundedH, vertical: roundedV });
                            if (hash === "ERROR") {
                                errorDocs++;
                                continue;
                            }
                            if (!guideSets[hash]) {
                                guideSets[hash] = {
                                    horizontal: roundedH,
                                    vertical: roundedV,
                                    count: 0,
                                    docNames: []
                                };
                            }
                            guideSets[hash].count++;
                            guideSets[hash].docNames.push(doc.name);
                            processedDocs++;
                        } catch (e) {
                            errorDocs++;
                            continue;
                        }
                    } else {
                        emptyDocs++;
                    }
                } catch (e) {
                    errorDocs++;
                }
            }
            
            try {
                allGuides.sets = [];
                var keyCount = 0;
                for (var hash in guideSets) {
                    if (guideSets.hasOwnProperty(hash)) {
                        allGuides.sets.push(guideSets[hash]);
                        keyCount++;
                    }
                }
                if (keyCount === 0) {
                    progressWin.close();
                    alert("警告: ガイドセットが作成されませんでした。\n\n" +
                          "処理済みドキュメント: " + processedDocs + "\n" +
                          "空のドキュメント: " + emptyDocs + "\n" +
                          "エラー: " + errorDocs);
                    return;
                }
            } catch (e) {
                progressWin.close();
                return;
            }
            
            try {
                allGuides.sets.sort(function(a, b) { return b.count - a.count; });
            } catch (e) {
                progressWin.close();
                return;
            }
            
            progressWin.close();
            updateGuideListDisplay();
            var totalSets = allGuides.sets.length;
            var totalDocs = app.documents.length;
            guideStatusText.text = "ガイド線: " + totalSets + "種類のセット検出 (" + totalDocs + "ページ中)";

            // ★ガイド線セットが1つ以上ある場合は最も多いものを自動選択（サイレントモード）
            // ※セットはcountで降順ソート済みなので、最初のものが最も多い
            if (totalSets >= 1) {
                guideListBox.selection = 0; // 最初の項目（最も多いセット）を選択
                selectGuidesFromList(true); // サイレントモードで選択処理を実行
            }

            // サイレントモードでない場合のみポップアップを表示
            if (!silent) {
                if (totalSets === 0) {
                    alert("ガイド線が見つかりませんでした。\n手動でガイド線を設定してください。");
                } else if (totalSets > 1) {
                    var mostUsedCount = allGuides.sets[0].count;
                    alert("ガイド線セットが" + totalSets + "種類検出されました。\n\n最も使用頻度の高いセット（" + mostUsedCount + "ページで使用）を自動選択しました。");
                }
            }

            return { totalSets: totalSets, error: false };

        } catch (e) {
            if (progressWin) progressWin.close();
            if (!silent) alert("ガイド線の読み取り中にエラーが発生しました。\n\nエラー詳細：\n" + e.message);
            return { totalSets: 0, error: true };
        }
    }
    
    function updateGuideListDisplay() {
        guideListBox.removeAll();
        unselectedGuideListBox.removeAll();

        if (!allGuides.sets || allGuides.sets.length === 0) {
            var emptyItem = guideListBox.add("item", "（選択済みセットなし）");
            emptyItem.enabled = false;
            var emptyUnselectedItem = unselectedGuideListBox.add("item", "（ガイド線セットが見つかりません）");
            emptyUnselectedItem.enabled = false;
            return;
        }

        // ★★★ 選択中のセットを判定するためのヘルパー関数 ★★★
        function isSelectedSet(guideSet) {
            if (!lastGuideData) return false;
            if (!lastGuideData.horizontal || !lastGuideData.vertical) return false;
            if (!guideSet.horizontal || !guideSet.vertical) return false;
            if (lastGuideData.horizontal.length !== guideSet.horizontal.length) return false;
            if (lastGuideData.vertical.length !== guideSet.vertical.length) return false;
            for (var h = 0; h < lastGuideData.horizontal.length; h++) {
                if (Math.abs(lastGuideData.horizontal[h] - guideSet.horizontal[h]) > 0.1) return false;
            }
            for (var v = 0; v < lastGuideData.vertical.length; v++) {
                if (Math.abs(lastGuideData.vertical[v] - guideSet.vertical[v]) > 0.1) return false;
            }
            return true;
        }

        var selectedCount = 0;
        var unselectedCount = 0;

        for (var i = 0; i < allGuides.sets.length; i++) {
            var guideSet = allGuides.sets[i];
            var hCount = guideSet.horizontal.length;
            var vCount = guideSet.vertical.length;
            var isSelected = isSelectedSet(guideSet);
            var isValidGuide = isValidTachikiriGuideSet(guideSet);

            // ★★★ 除外リストに含まれているかチェック ★★★
            var isExcluded = false;
            for (var ei = 0; ei < excludedGuideIndices.length; ei++) {
                if (excludedGuideIndices[ei] === i) {
                    isExcluded = true;
                    break;
                }
            }

            // ★★★ 選択済み かつ 除外されていない → 上のリストに追加（3行表示）★★★
            if (isSelected && !isExcluded) {
                var selectedText = "【セット" + (i + 1) + "】(出現: " + guideSet.count + "ページ, 水平" + hCount + "本, 垂直" + vCount + "本)";
                if (!isValidGuide) {
                    selectedText += "（ガイド不足）";
                }
                var selectedItem = guideListBox.add("item", selectedText);
                selectedItem.guideData = guideSet;
                selectedItem.setIndex = i;

                // 水平ガイド線の詳細行
                if (hCount > 0) {
                    var hText = "├ 水平 (" + hCount + "本): ";
                    var hCoords = [];
                    for (var h = 0; h < guideSet.horizontal.length; h++) {
                        hCoords.push(guideSet.horizontal[h].toFixed(1));
                    }
                    hText += hCoords.join(", ");
                    var hItem = guideListBox.add("item", hText);
                    hItem.guideData = guideSet;
                    hItem.enabled = false;
                }

                // 垂直ガイド線の詳細行
                if (vCount > 0) {
                    var vText = "└ 垂直 (" + vCount + "本): ";
                    var vCoords = [];
                    for (var v = 0; v < guideSet.vertical.length; v++) {
                        vCoords.push(guideSet.vertical[v].toFixed(1));
                    }
                    vText += vCoords.join(", ");
                    var vItem = guideListBox.add("item", vText);
                    vItem.guideData = guideSet;
                    vItem.enabled = false;
                }
                selectedCount++;
            } else {
                // ★★★ 未選択 または 除外済み → 下のリストに追加 ★★★
                var unselectedText = "【セット" + (i + 1) + "】 (出現合計ページ数: " + guideSet.count + ") - 水平" + hCount + "本, 垂直" + vCount + "本";
                if (!isValidGuide) {
                    unselectedText += "（ガイド不足）";
                }
                var unselectedItem = unselectedGuideListBox.add("item", unselectedText);
                unselectedItem.guideData = guideSet;
                unselectedItem.setIndex = i;
                unselectedCount++;
            }
        }

        // 選択済みセットがない場合
        if (selectedCount === 0) {
            var noSelectedItem = guideListBox.add("item", "（選択済みセットなし）");
            noSelectedItem.enabled = false;
        }

        // 未選択セットがない場合
        if (unselectedCount === 0) {
            var noUnselectedItem = unselectedGuideListBox.add("item", "（すべてのセットが選択済みです）");
            noUnselectedItem.enabled = false;
        }

        // ★★★ guideStatusTextを更新（選択中のガイド情報を表示）★★★
        if (lastGuideData && lastGuideData.horizontal && lastGuideData.vertical) {
            var hCount = lastGuideData.horizontal.length;
            var vCount = lastGuideData.vertical.length;
            var totalCount = hCount + vCount;
            // ★★★ allGuides.setsから対応するセットを探してdocWidth/docHeightを取得 ★★★
            var guideSetForValidation = {
                horizontal: lastGuideData.horizontal,
                vertical: lastGuideData.vertical,
                docWidth: lastGuideData.docWidth || null,
                docHeight: lastGuideData.docHeight || null
            };
            // lastGuideDataにdocWidth/docHeightがない場合、allGuides.setsから探す
            if (!guideSetForValidation.docWidth || !guideSetForValidation.docHeight) {
                for (var gsi = 0; gsi < allGuides.sets.length; gsi++) {
                    var gs = allGuides.sets[gsi];
                    if (gs.horizontal && gs.vertical &&
                        gs.horizontal.length === lastGuideData.horizontal.length &&
                        gs.vertical.length === lastGuideData.vertical.length) {
                        var matchFound = true;
                        for (var mh = 0; mh < lastGuideData.horizontal.length; mh++) {
                            if (Math.abs(gs.horizontal[mh] - lastGuideData.horizontal[mh]) > 0.1) {
                                matchFound = false;
                                break;
                            }
                        }
                        if (matchFound) {
                            for (var mv = 0; mv < lastGuideData.vertical.length; mv++) {
                                if (Math.abs(gs.vertical[mv] - lastGuideData.vertical[mv]) > 0.1) {
                                    matchFound = false;
                                    break;
                                }
                            }
                        }
                        if (matchFound && gs.docWidth && gs.docHeight) {
                            guideSetForValidation.docWidth = gs.docWidth;
                            guideSetForValidation.docHeight = gs.docHeight;
                            break;
                        }
                    }
                }
            }
            var isValid = isValidTachikiriGuideSet(guideSetForValidation);
            var statusStr = isValid ? "【使用可能】" : "【ガイド不足】";
            guideStatusText.text = "ガイド線: " + totalCount + "本（水平:" + hCount + ", 垂直:" + vCount + "）" + statusStr;
        } else if (allGuides.sets && allGuides.sets.length > 0) {
            guideStatusText.text = "ガイド線: " + allGuides.sets.length + "種類のセット検出（未選択）";
        } else {
            guideStatusText.text = "ガイド線: 未読み取り";
        }

        updateSummaryDisplay();
    }
    
    function selectGuidesFromList(silent) {
        // ★★★ 未選択リスト（下のリスト）からも選択できるようにする ★★★
        var selectedSet = null;
        var setIndex = null;

        if (unselectedGuideListBox.selection && unselectedGuideListBox.selection.guideData) {
            // 未選択リストから選択された場合
            selectedSet = unselectedGuideListBox.selection.guideData;
            setIndex = unselectedGuideListBox.selection.setIndex;
        } else if (guideListBox.selection && guideListBox.selection.guideData) {
            // 選択済みリストから選択された場合（詳細行でない場合のみ）
            if (guideListBox.selection.enabled !== false) {
                selectedSet = guideListBox.selection.guideData;
                setIndex = guideListBox.selection.setIndex;
            }
        }

        if (!selectedSet) {
            if (!silent) alert("ガイド線セットを選択してください。\n\n下のリストから【セットN】を選択してください。");
            return;
        }

        lastGuideData = {
            horizontal: selectedSet.horizontal.slice(),
            vertical: selectedSet.vertical.slice()
        };

        // ★★★ 選択されたセットを除外リストから削除 ★★★
        if (typeof setIndex !== 'undefined') {
            var newExcludedList = [];
            for (var ei = 0; ei < excludedGuideIndices.length; ei++) {
                if (excludedGuideIndices[ei] !== setIndex) {
                    newExcludedList.push(excludedGuideIndices[ei]);
                }
            }
            excludedGuideIndices = newExcludedList;
        }

        // ★★★ 選択されたガイドセットのインデックスをscanDataに保存 ★★★
        if (scanData && typeof setIndex !== 'undefined') {
            scanData.selectedGuideSetIndex = setIndex;
            scanData.excludedGuideIndices = excludedGuideIndices.slice();
        }

        updateGuideDisplay();
        updateGuideListDisplay(); // ★★★ リスト表示を更新 ★★★
        updateSummaryDisplay();

        // サイレントモードでない場合のみポップアップを表示
        if (!silent) {
            var totalSelected = selectedSet.horizontal.length + selectedSet.vertical.length;
            var message = "ガイド線セットを選択しました。\n\n";
            message += "水平: " + selectedSet.horizontal.length + "本\n";
            message += "垂直: " + selectedSet.vertical.length + "本\n";
            message += "合計: " + totalSelected + "本\n\n";
            message += "出現合計ページ数: " + selectedSet.count + "\n\n";
            message += "このセットがJSONに保存されます。";
            alert(message);
        }
    }
    
    function confirmSelectedGuides() {
        var guidesToApply = lastGuideData;

        if (!guidesToApply || ((!guidesToApply.horizontal || guidesToApply.horizontal.length === 0) &&
                               (!guidesToApply.vertical || guidesToApply.vertical.length === 0))) {
            alert("選択されたガイド線がありません。\n\n先に「選択」ボタンでガイド線を選択してください。");
            return;
        }

        var doc;

        // ドキュメントが開いているか確認
        if (app.documents.length > 0) {
            // 選択ダイアログを表示
            var choiceDialog = new Window("dialog", "適用先を選択");
            choiceDialog.orientation = "column";
            choiceDialog.alignChildren = ["fill", "top"];
            choiceDialog.spacing = 10;
            choiceDialog.margins = 15;

            choiceDialog.add("statictext", undefined, "ガイド線をどこに適用しますか？");
            choiceDialog.add("statictext", undefined, "現在開いているドキュメント: " + app.activeDocument.name);

            var btnGroup = choiceDialog.add("group");
            btnGroup.orientation = "row";
            btnGroup.alignment = ["center", "top"];
            var currentDocBtn = btnGroup.add("button", undefined, "現在のドキュメント");
            var newFileBtn = btnGroup.add("button", undefined, "新しいファイルを開く");
            var cancelBtn = btnGroup.add("button", undefined, "キャンセル");

            var userChoice = null;
            currentDocBtn.onClick = function() { userChoice = "current"; choiceDialog.close(); };
            newFileBtn.onClick = function() { userChoice = "new"; choiceDialog.close(); };
            cancelBtn.onClick = function() { userChoice = "cancel"; choiceDialog.close(); };

            choiceDialog.show();

            if (userChoice === "cancel" || userChoice === null) {
                return;
            } else if (userChoice === "current") {
                doc = app.activeDocument;
            } else {
                // 新しいファイルを開く
                var selectedFile = File.openDialog("ガイド線を適用するファイルを選択してください", "Photoshop:*.psd;*.psb;*.jpg;*.jpeg;*.png;*.tif;*.tiff,すべてのファイル:*.*");
                if (!selectedFile) {
                    return;
                }
                try {
                    doc = app.open(selectedFile);
                } catch (e) {
                    alert("ファイルを開けませんでした: " + e.message);
                    return;
                }
            }
        } else {
            // ドキュメントが開いていない場合はファイル選択ダイアログを開く
            var selectedFile = File.openDialog("ガイド線を適用するファイルを選択してください", "Photoshop:*.psd;*.psb;*.jpg;*.jpeg;*.png;*.tif;*.tiff,すべてのファイル:*.*");
            if (!selectedFile) {
                return;
            }
            try {
                doc = app.open(selectedFile);
            } catch (e) {
                alert("ファイルを開けませんでした: " + e.message);
                return;
            }
        }

        var deleteGuides = confirm("「" + doc.name + "」にガイド線を適用します。\n\n既存のガイド線を削除しますか？");

        if (deleteGuides) {
            try {
                while (doc.guides.length > 0) {
                    doc.guides[0].remove();
                }
            } catch (e) { }
        }

        var addedCount = 0;
        if (guidesToApply.horizontal) {
            for (var i = 0; i < guidesToApply.horizontal.length; i++) {
                try {
                    doc.guides.add(Direction.HORIZONTAL, new UnitValue(guidesToApply.horizontal[i], "px"));
                    addedCount++;
                } catch (e) { }
            }
        }
        if (guidesToApply.vertical) {
            for (var j = 0; j < guidesToApply.vertical.length; j++) {
                try {
                    doc.guides.add(Direction.VERTICAL, new UnitValue(guidesToApply.vertical[j], "px"));
                    addedCount++;
                } catch (e) { }
            }
        }

        alert("ガイド線を適用しました。\n\n適用先: " + doc.name + "\n適用したガイド線: " + addedCount + "本\n\nダイアログを移動して確認してください。");
    }

    // ★★★ 範囲選択を確認する関数 ★★★
    function confirmSelectionRange() {
        // リストから選択されたアイテムを取得
        if (!jsonLabelListBox.selection) {
            alert("範囲選択ラベルを選択してください。");
            return;
        }

        var selectedItem = jsonLabelListBox.selection;
        var rangeData = selectedItem.rangeData;

        if (!rangeData || !rangeData.bounds) {
            alert("選択されたラベルに範囲データがありません。");
            return;
        }

        var doc;

        // ドキュメントが開いているか確認
        if (app.documents.length > 0) {
            // 選択ダイアログを表示
            var choiceDialog = new Window("dialog", "適用先を選択");
            choiceDialog.orientation = "column";
            choiceDialog.alignChildren = ["fill", "top"];
            choiceDialog.spacing = 10;
            choiceDialog.margins = 15;

            choiceDialog.add("statictext", undefined, "範囲選択をどこに適用しますか？");
            choiceDialog.add("statictext", undefined, "現在開いているドキュメント: " + app.activeDocument.name);

            var btnGroup = choiceDialog.add("group");
            btnGroup.orientation = "row";
            btnGroup.alignment = ["center", "top"];
            var currentDocBtn = btnGroup.add("button", undefined, "現在のドキュメント");
            var newFileBtn = btnGroup.add("button", undefined, "新しいファイルを開く");
            var cancelBtn = btnGroup.add("button", undefined, "キャンセル");

            var userChoice = null;
            currentDocBtn.onClick = function() { userChoice = "current"; choiceDialog.close(); };
            newFileBtn.onClick = function() { userChoice = "new"; choiceDialog.close(); };
            cancelBtn.onClick = function() { userChoice = "cancel"; choiceDialog.close(); };

            choiceDialog.show();

            if (userChoice === "cancel" || userChoice === null) {
                return;
            } else if (userChoice === "current") {
                doc = app.activeDocument;
            } else {
                // 新しいファイルを開く
                var selectedFile = File.openDialog("範囲選択を適用するファイルを選択してください", "Photoshop:*.psd;*.psb;*.jpg;*.jpeg;*.png;*.tif;*.tiff,すべてのファイル:*.*");
                if (!selectedFile) {
                    return;
                }
                try {
                    doc = app.open(selectedFile);
                } catch (e) {
                    alert("ファイルを開けませんでした: " + e.message);
                    return;
                }
            }
        } else {
            // ドキュメントが開いていない場合はファイル選択ダイアログを開く
            var selectedFile = File.openDialog("範囲選択を適用するファイルを選択してください", "Photoshop:*.psd;*.psb;*.jpg;*.jpeg;*.png;*.tif;*.tiff,すべてのファイル:*.*");
            if (!selectedFile) {
                return;
            }
            try {
                doc = app.open(selectedFile);
            } catch (e) {
                alert("ファイルを開けませんでした: " + e.message);
                return;
            }
        }

        // 範囲選択を適用
        try {
            var bounds = rangeData.bounds;
            var left = bounds.left;
            var top = bounds.top;
            var right = bounds.right;
            var bottom = bounds.bottom;

            // ★★★ ファイルパスを保存してから閉じて再度開く ★★★
            var filePath = doc.fullName;
            var fileName = doc.name;

            // ガイド線の確認が必要かどうかを事前に確認
            var needGuideReconfirm = false;
            var currentGuideIdx = -1;
            if (allGuides.sets && allGuides.sets.length > 0 && guideListBox.selection && guideListBox.selection.setIndex !== undefined) {
                currentGuideIdx = guideListBox.selection.setIndex;
                // ガイド線確認が必要かユーザーに確認
                needGuideReconfirm = confirm("ガイド線も再確認しますか？\n\n「はい」→ ガイド線も適用して確認\n「いいえ」→ 範囲選択のみ確認");
            }

            // ファイルを保存せずに閉じる
            doc.close(SaveOptions.DONOTSAVECHANGES);

            // 同じファイルを再度開く
            doc = app.open(filePath);

            // 選択範囲を作成
            var selectionBounds = [[left, top], [right, top], [right, bottom], [left, bottom]];
            doc.selection.select(selectionBounds);

            // クイックマスクモードを有効にして選択範囲外を赤く表示
            doc.quickMaskMode = true;

            // ★★★ ガイド線再確認が必要な場合 ★★★
            if (needGuideReconfirm && currentGuideIdx >= 0 && currentGuideIdx < allGuides.sets.length) {
                var guideSet = allGuides.sets[currentGuideIdx];
                if (guideSet && guideSet.horizontal && guideSet.vertical) {
                    // ガイド線を適用
                    try {
                        // 既存のガイド線をクリア
                        while (doc.guides.length > 0) {
                            doc.guides[0].remove();
                        }
                        // 水平ガイド線を適用
                        for (var hi = 0; hi < guideSet.horizontal.length; hi++) {
                            doc.guides.add(Direction.HORIZONTAL, new UnitValue(guideSet.horizontal[hi], "px"));
                        }
                        // 垂直ガイド線を適用
                        for (var vi = 0; vi < guideSet.vertical.length; vi++) {
                            doc.guides.add(Direction.VERTICAL, new UnitValue(guideSet.vertical[vi], "px"));
                        }
                    } catch (guideErr) {
                        // ガイド線適用エラーは無視
                    }
                }
            }

            alert("範囲選択を適用しました（クイックマスク表示中）。\n\n適用先: " + fileName + "\nラベル: " + selectedItem.text + "\n範囲: " + left + ", " + top + " - " + right + ", " + bottom + " (px)" + (needGuideReconfirm ? "\n\nガイド線も適用しました。" : "") + "\n\n※クイックマスクを解除するには「Q」キーを押してください。");

            // ★★★ 最後に使用したラベルを保存 ★★★
            if (rangeData.label) {
                lastUsedLabel = rangeData.label;
                // scanDataに保存
                if (scanData) {
                    scanData.lastUsedLabel = rangeData.label;
                    // saveDataPathがあれば保存
                    if (scanData.saveDataPath) {
                        try {
                            var saveFile = new File(scanData.saveDataPath);
                            saveFile.encoding = "UTF-8";
                            saveFile.open("w");
                            saveFile.write(JSON.stringify(scanData));
                            saveFile.close();
                        } catch (saveErr) {
                            // 保存エラーは無視
                        }
                    }
                }
                // リストを更新して★マークを反映
                updateJsonLabelList();
            }
        } catch (e) {
            alert("範囲選択の適用に失敗しました: " + e.message);
        }
    }
    
    function updateDetectionInfo(result) {
        var fonts = result.fonts || result;
        var sizeStats = result.sizeStats || null;
        if (result.constructor === Array || result instanceof Array) {
            fonts = result;
            sizeStats = null;
        }

        lastFontSizeStats = sizeStats;

        // ★★★ テキストレイヤーキャッシュを保存 ★★★
        if (result.textLayersByDoc) {
            lastTextLayersByDoc = result.textLayersByDoc;
        }
        
        if (fonts.length === 0) {
            // フォントが検出されませんでした
        } else {
            // フォントが検出されました
            allDetectedFonts = fonts.slice(); // 全フォント一覧を更新
            // 未登録フォントのみ表示
            updateMissingFontList();

            // ★★★ サイズ統計を保存し、横書き表示を更新 ★★★
            lastFontSizeStats = sizeStats || null;
            updateFontSizeStatsDisplay();

            updateSummaryDisplay();
            switchToTab(2);
        }
    }
    
    // ★★★ ランク外情報を保持する変数 ★★★
    var lastRankOutFontSizes = [];
    var lastRankOutStrokeSizes = [];

    // ★★★ ランク外集計をまとめて表示する関数 ★★★
    function updateRankOutSummary() {
        var summaryParts = [];
        if (lastRankOutFontSizes.length > 0) {
            summaryParts.push("フォントサイズ: " + lastRankOutFontSizes.join(", "));
        }
        if (lastRankOutStrokeSizes.length > 0) {
            summaryParts.push("白フチ: " + lastRankOutStrokeSizes.join(", "));
        }
        if (summaryParts.length > 0) {
            rankOutSummaryText.text = summaryParts.join("\n");
        } else {
            rankOutSummaryText.text = "（なし）";
        }
    }

    function updateFontSizeStatsDisplay() {
        // 新UIの登録サイズ配列をクリア
        registeredSizes = [];
        lastRankOutFontSizes = [];

        if (lastFontSizeStats) {
            var allSizesSet = {};
            var localRegisteredSizes = [];
            var baseSize = 0;
            var baseCount = 0;
            var excludeMin = 0;
            var excludeMax = 0;

            // ★★★ sizes配列がある場合（JSONエクスポート形式）★★★
            if (lastFontSizeStats.sizes && lastFontSizeStats.sizes.length > 0) {
                // mostFrequentがあればそれを使用、なければsizes[0]を使用
                if (lastFontSizeStats.mostFrequent) {
                    if (typeof lastFontSizeStats.mostFrequent === 'number') {
                        baseSize = lastFontSizeStats.mostFrequent;
                    } else if (typeof lastFontSizeStats.mostFrequent === 'object' && lastFontSizeStats.mostFrequent.size) {
                        baseSize = lastFontSizeStats.mostFrequent.size;
                        baseCount = lastFontSizeStats.mostFrequent.count || 0;
                    }
                }
                if (baseSize === 0) {
                    // sizes[0]を基本サイズとして使用
                    var firstSz = lastFontSizeStats.sizes[0];
                    baseSize = (typeof firstSz === 'object' && firstSz !== null) ? (firstSz.size || 0) : (typeof firstSz === 'number' ? firstSz : 0);
                }

                // excludeRangeがあればそれを使用、なければ計算
                if (lastFontSizeStats.excludeRange) {
                    excludeMin = lastFontSizeStats.excludeRange.min || 0;
                    excludeMax = lastFontSizeStats.excludeRange.max || 0;
                } else if (baseSize > 0) {
                    var halfSize = baseSize / 2;
                    excludeMin = halfSize - 1;
                    excludeMax = halfSize + 1;
                }

                if (baseSize > 0) {
                    mostFrequentText.text = "最頻出フォントサイズ: " + baseSize + "pt";
                    baseSizeInput.text = baseSize + "pt";
                    excludeRangeText.text = "除外範囲: " + excludeMin.toFixed(1) + "pt ～ " + excludeMax.toFixed(1) + "pt";
                    rubySizeRangeText.text = excludeMin.toFixed(1) + " ~ " + excludeMax.toFixed(1) + " pt";
                } else {
                    mostFrequentText.text = "最頻出フォントサイズ: --";
                    baseSizeInput.text = "--pt";
                    excludeRangeText.text = "除外範囲: --";
                    rubySizeRangeText.text = "-- ~ -- pt";
                }

                // ★★★ top10Sizesがあればそれを登録サイズとして使用（{size,count}形式対応） ★★★
                var registeredSource = lastFontSizeStats.top10Sizes || null;
                if (registeredSource && registeredSource.length > 0) {
                    for (var i = 0; i < registeredSource.length; i++) {
                        var regItem = registeredSource[i];
                        var sizeNum = 0;
                        if (typeof regItem === 'number') {
                            sizeNum = regItem;
                        } else if (typeof regItem === 'object' && regItem !== null) {
                            sizeNum = regItem.size || 0;
                        }
                        if (sizeNum > 0) {
                            localRegisteredSizes.push(sizeNum + "pt");
                            registeredSizes.push(sizeNum);
                            allSizesSet[sizeNum] = true;
                        }
                    }
                    // sizesからtop10Sizes以外をランク外に
                    for (var j = 0; j < lastFontSizeStats.sizes.length; j++) {
                        var sz2 = lastFontSizeStats.sizes[j];
                        var sizeNum2 = (typeof sz2 === 'object' && sz2 !== null) ? (sz2.size || 0) : (typeof sz2 === 'number' ? sz2 : 0);
                        if (sizeNum2 > 0 && !allSizesSet[sizeNum2]) {
                            lastRankOutFontSizes.push(sizeNum2 + "pt");
                        }
                    }
                } else {
                    // top10Sizesがない場合は従来通りsizes配列の先頭10件
                    for (var i = 0; i < lastFontSizeStats.sizes.length; i++) {
                        var sz = lastFontSizeStats.sizes[i];
                        var sizeNum = (typeof sz === 'object' && sz !== null) ? (sz.size || 0) : (typeof sz === 'number' ? sz : 0);
                        if (sizeNum > 0) {
                            if (i < 10) {
                                localRegisteredSizes.push(sizeNum + "pt");
                                registeredSizes.push(sizeNum);
                                allSizesSet[sizeNum] = true;
                            } else {
                                lastRankOutFontSizes.push(sizeNum + "pt");
                            }
                        }
                    }
                }

            // ★★★ オブジェクト形式（スキャン直後のデータ）★★★
            } else if (lastFontSizeStats.mostFrequent || lastFontSizeStats.allSizes || lastFontSizeStats.top10) {
                // mostFrequent の取得
                if (lastFontSizeStats.mostFrequent && typeof lastFontSizeStats.mostFrequent === 'object') {
                    baseSize = lastFontSizeStats.mostFrequent.size || 0;
                    baseCount = lastFontSizeStats.mostFrequent.count || 0;
                }

                // excludeRange の取得
                if (lastFontSizeStats.excludeRange) {
                    excludeMin = lastFontSizeStats.excludeRange.min || 0;
                    excludeMax = lastFontSizeStats.excludeRange.max || 0;
                } else if (baseSize > 0) {
                    var halfSize = baseSize / 2;
                    excludeMin = halfSize - 1;
                    excludeMax = halfSize + 1;
                }

                if (baseSize > 0) {
                    mostFrequentText.text = "最頻出フォントサイズ: " + baseSize + "pt (使用回数: " + baseCount + "回)";
                    baseSizeInput.text = baseSize + "pt";
                } else {
                    mostFrequentText.text = "最頻出フォントサイズ: --";
                    baseSizeInput.text = "--pt";
                }

                if (excludeMin > 0 && excludeMax > 0) {
                    excludeRangeText.text = "除外範囲: " + excludeMin.toFixed(1) + "pt ～ " + excludeMax.toFixed(1) + "pt";
                    rubySizeRangeText.text = excludeMin.toFixed(1) + " ~ " + excludeMax.toFixed(1) + " pt";
                } else {
                    excludeRangeText.text = "除外範囲: --";
                    rubySizeRangeText.text = "-- ~ -- pt";
                }

                // allSizes または top10 または sizes から登録サイズを取得
                var sourceArray = lastFontSizeStats.allSizes || lastFontSizeStats.top10 || lastFontSizeStats.sizes || [];
                for (var k = 0; k < sourceArray.length; k++) {
                    var sizeObj = sourceArray[k];
                    var sizeVal = (sizeObj && typeof sizeObj.size === 'number') ? sizeObj.size : 0;
                    if (sizeVal > 0) {
                        if (k < 10) {
                            localRegisteredSizes.push(sizeVal + "pt");
                            registeredSizes.push(sizeVal);
                            allSizesSet[sizeVal] = true;
                        } else {
                            lastRankOutFontSizes.push(sizeVal + "pt");
                        }
                    }
                }
            }

            // 登録サイズボタンを更新
            updateNewSizeUI();

            // その他検出されたサイズ（10位以下）
            if (lastRankOutFontSizes.length > 0) {
                otherSizesText.text = lastRankOutFontSizes.join(" / ");
            } else {
                otherSizesText.text = "--";
            }

            // 互換性のための旧UI更新（sizeDisplayText）
            if (localRegisteredSizes.length > 0) {
                sizeDisplayText.text = localRegisteredSizes.join(", ");
            } else {
                sizeDisplayText.text = "（なし）";
            }
        } else {
            // データがない場合
            baseSizeInput.text = "--pt";
            registeredSizes = [];
            updateNewSizeUI();
            otherSizesText.text = "--";
            rubySizeRangeText.text = "-- ~ -- pt";

            mostFrequentText.text = "最頻出フォントサイズ: ";
            excludeRangeText.text = "除外範囲: ";
            sizeDisplayText.text = "（なし）";
            lastRankOutFontSizes = [];
        }
        // ランク外集計をまとめて更新
        updateRankOutSummary();
    }
    
    function updateGuideDisplay() {
        if (lastGuideData && lastGuideData !== "SKIP") {
            var hCount = lastGuideData.horizontal ? lastGuideData.horizontal.length : 0;
            var vCount = lastGuideData.vertical ? lastGuideData.vertical.length : 0;
            var total = hCount + vCount;
            guideSelectionInfo.text = "選択: " + total + "本 (水平:" + hCount + ", 垂直:" + vCount + ")";
        } else {
            guideSelectionInfo.text = "選択: 0本";
        }
    }
    
    function updateLabelDropdown() {
        if (!genreDropdown.selection) return;
        var selectedGenre = genreDropdown.selection.text;
        var labels = labelsByGenre[selectedGenre];
        labelDropdown.removeAll();
        if (labels) {
            for (var i = 0; i < labels.length; i++) {
                labelDropdown.add("item", labels[i]);
            }
            if (labelDropdown.items.length > 0) labelDropdown.selection = 0;
        }
    }
    
    function updateWorkInfoDisplay() {
        if (workInfo && workInfo.title) {
            titleInput.text = workInfo.title || "";
            subtitleInput.text = workInfo.subtitle || "";
            editorInput.text = workInfo.editor || "";
            // 巻数を反映
            if (workInfo.volume && workInfo.volume >= 1 && workInfo.volume <= 50) {
                volumeDropdown.selection = workInfo.volume - 1;
            } else {
                volumeDropdown.selection = 0;
            }
            storagePathInput.text = workInfo.storagePath || "";
            notesInput.text = workInfo.notes || "";
            for (var i = 0; i < genreDropdown.items.length; i++) {
                if (genreDropdown.items[i].text === workInfo.genre) {
                    genreDropdown.selection = i;
                    break;
                }
            }
            updateLabelDropdown();
            for (var j = 0; j < labelDropdown.items.length; j++) {
                if (labelDropdown.items[j].text === workInfo.label) {
                    labelDropdown.selection = j;
                    break;
                }
            }
            if (workInfo.authorType === "single") {
                authorRadioSingle.value = true;
                authorSingleGroup.visible = true;
                authorDualGroup.visible = false;
                authorNoneGroup.visible = false;
                authorSingleInput.text = workInfo.author || "";
            } else if (workInfo.authorType === "dual") {
                authorRadioDual.value = true;
                authorSingleGroup.visible = false;
                authorDualGroup.visible = true;
                authorNoneGroup.visible = false;
                artistInput.text = workInfo.artist || "";
                originalInput.text = workInfo.original || "";
            } else {
                authorRadioNone.value = true;
                authorSingleGroup.visible = false;
                authorDualGroup.visible = false;
                authorNoneGroup.visible = true;
            }
        }
        // ★★★ 保存ファイル一覧も更新 ★★★
        updateTextStatsDisplay();
        // ★★★ JSON内ラベル一覧も更新 ★★★
        updateJsonLabelList();
    }

    function updateSummaryDisplay() {
        if (workInfo && workInfo.title) {
            var rightWorkText = workInfo.title;
            if (workInfo.subtitle) rightWorkText += "\n" + workInfo.subtitle;
            rightWorkText += "\n" + (workInfo.genre || "") + " / " + (workInfo.label || "");
            if (workInfo.authorType === "single" && workInfo.author) {
                rightWorkText += "\n著: " + workInfo.author;
            } else if (workInfo.authorType === "dual") {
                if (workInfo.artist) rightWorkText += "\n作画: " + workInfo.artist;
                if (workInfo.original) rightWorkText += "\n原作: " + workInfo.original;
            }
        }
        
        if (lastFontSizeStats) {
            var rightStatsText = "";
            var isExportFormat = (typeof lastFontSizeStats.mostFrequent === 'number');
            var isObjectFormat = (lastFontSizeStats.mostFrequent && typeof lastFontSizeStats.mostFrequent === 'object');
            var sizes = [];
            if (isExportFormat) {
                rightStatsText = "最頻出: " + lastFontSizeStats.mostFrequent + "pt\n\n";
                // top10Sizesから数値を抽出（{size,count}形式対応）
                var t10src = lastFontSizeStats.top10Sizes || lastFontSizeStats.sizes || [];
                for (var si = 0; si < t10src.length; si++) {
                    var srcItem = t10src[si];
                    if (typeof srcItem === 'object' && srcItem !== null) {
                        if (srcItem.size > 0) sizes.push(srcItem.size);
                    } else if (typeof srcItem === 'number' && srcItem > 0) {
                        sizes.push(srcItem);
                    }
                }
            } else if (isObjectFormat) {
                rightStatsText = "最頻出: " + lastFontSizeStats.mostFrequent.size + "pt\n\n";
                if (lastFontSizeStats.top10) {
                    for (var i = 0; i < lastFontSizeStats.top10.length; i++) {
                        sizes.push(lastFontSizeStats.top10[i].size);
                    }
                } else if (lastFontSizeStats.top10Sizes) {
                    // ★★★ top10Sizesから取得（{size,count}形式対応） ★★★
                    for (var i = 0; i < lastFontSizeStats.top10Sizes.length; i++) {
                        var t10item = lastFontSizeStats.top10Sizes[i];
                        if (typeof t10item === 'object' && t10item !== null) {
                            if (t10item.size > 0) sizes.push(t10item.size);
                        } else if (typeof t10item === 'number' && t10item > 0) {
                            sizes.push(t10item);
                        }
                    }
                }
            } else {
                rightStatsText = "最頻出: （データなし）\n\n";
            }
            if (sizes.length > 0) {
                sizes.sort(function(a, b) { return a - b; });
                var sizeList = "";
                for (var i = 0; i < sizes.length; i++) {
                    sizeList += sizes[i] + "pt/";
                }
                rightStatsText += sizeList;
            }
            // 白フチサイズも追加
            if (lastStrokeStats && lastStrokeStats.sizes && lastStrokeStats.sizes.length > 0) {
                rightStatsText += "\n\n白フチ: ";
                var strokeSizes = [];
                for (var j = 0; j < lastStrokeStats.sizes.length; j++) {
                    strokeSizes.push(lastStrokeStats.sizes[j].size);
                }
                strokeSizes.sort(function(a, b) { return a - b; });
                for (var k = 0; k < strokeSizes.length; k++) {
                    rightStatsText += strokeSizes[k] + "px/";
                }
            }
        } else {
            var statsText = "未検出";
            // フォントサイズがなくても白フチサイズがあれば表示
            if (lastStrokeStats && lastStrokeStats.sizes && lastStrokeStats.sizes.length > 0) {
                statsText += "\n\n白フチ: ";
                var strokeSizes = [];
                for (var j = 0; j < lastStrokeStats.sizes.length; j++) {
                    strokeSizes.push(lastStrokeStats.sizes[j].size);
                }
                strokeSizes.sort(function(a, b) { return a - b; });
                for (var k = 0; k < strokeSizes.length; k++) {
                    statsText += strokeSizes[k] + "px/";
                }
            }
        }

        if (lastGuideData && lastGuideData !== "SKIP") {
            var hCount = lastGuideData.horizontal ? lastGuideData.horizontal.length : 0;
            var vCount = lastGuideData.vertical ? lastGuideData.vertical.length : 0;
            var total = hCount + vCount;
            var rightGuideText = "合計: " + total + "本\n";
            if (hCount > 0) {
                rightGuideText += "水平: ";
                var hValues = [];
                for (var h = 0; h < Math.min(5, hCount); h++) {
                    hValues.push(lastGuideData.horizontal[h].toFixed(1));
                }
                rightGuideText += hValues.join(", ");
                if (hCount > 5) rightGuideText += " ...他" + (hCount - 5) + "本";
                rightGuideText += "\n";
            }
            if (vCount > 0) {
                rightGuideText += "垂直: ";
                var vValues = [];
                for (var v = 0; v < Math.min(5, vCount); v++) {
                    vValues.push(lastGuideData.vertical[v].toFixed(1));
                }
                rightGuideText += vValues.join(", ");
                if (vCount > 5) rightGuideText += " ...他" + (vCount - 5) + "本";
            }
        }
    }
    
    function initialize() {
        updatePresetList();
        updateGuideDisplay();

        // ★★★ ガイド線セット一覧を更新（JSONからの読み込み時も対応）★★★
        // allGuides.setsが空でもlastGuideDataがあればリストに追加
        if ((!allGuides.sets || allGuides.sets.length === 0) && lastGuideData && lastGuideData.horizontal && lastGuideData.vertical) {
            allGuides.sets = [{
                horizontal: lastGuideData.horizontal,
                vertical: lastGuideData.vertical,
                count: 1
            }];
        }
        updateGuideListDisplay();

        // ★★★ saveデータ読み込み時：ガイド線ステータスを更新 ★★★
        if (lastGuideData && lastGuideData.horizontal && lastGuideData.vertical) {
            var hCount = lastGuideData.horizontal.length;
            var vCount = lastGuideData.vertical.length;
            guideStatusText.text = "ガイド線: " + (hCount + vCount) + "本（水平:" + hCount + ", 垂直:" + vCount + "）";
        }

        updateLabelDropdown();
        updateWorkInfoDisplay();

        // ★★★ 巻数を明示的に設定（startVolumeを優先）★★★
        var initVol = (scanData && scanData.startVolume) ? scanData.startVolume : (workInfo && workInfo.volume ? workInfo.volume : null);
        if (initVol && initVol >= 1 && initVol <= 50) {
            volumeDropdown.selection = initVol - 1;
        }

        updateTextLayerList();

        // ★★★ saveデータ読み込み時：フォント情報をドロップダウンに表示 ★★★
        if (missingFontDataList.length === 0 && scanDataFonts && scanDataFonts.length > 0) {
            allDetectedFonts = scanDataFonts.slice(); // 全フォント一覧を更新
            // 未登録フォントのみ表示
            updateMissingFontList();
        }

        // ★★★ saveデータ読み込み時：フォントサイズ統計を表示 ★★★
        if (lastFontSizeStats) {
            updateFontSizeStatsDisplay();
        }

        // ★★★ saveデータ読み込み時：白フチ情報を表示 ★★★
        if (lastStrokeStats) {
            updateStrokeListDisplay(lastStrokeStats);
        }

        updateSummaryDisplay();
        updateTextStatsDisplay();
        switchToTab(1);
    }
    
    // ★★★ タブ名の定義 ★★★
    var tabNames = ["", "作品情報", "フォント種類", "フォントサイズ", "タチキリ枠", "テキスト"];
    var currentTabNumber = 1;

    function switchToTab(tabNumber) {
        // ★★★ シンプルな表示切替のみ（サイズ変更なし）★★★
        tab1Content.visible = (tabNumber === 1);
        tab2Content.visible = (tabNumber === 2);
        tab3Content.visible = (tabNumber === 3);
        tab4Content.visible = (tabNumber === 4);
        tab5Content.visible = (tabNumber === 5);

        // ★★★ タブボタンの選択状態を更新 ★★★
        for (var i = 1; i <= 5; i++) {
            tabButtonSelected[i] = (i === tabNumber);
        }
        // ★★★ 全ボタンを再描画（hide/showで強制更新）★★★
        for (var j = 1; j <= 5; j++) {
            if (tabButtons[j]) {
                tabButtons[j].hide();
            }
        }
        for (var k = 1; k <= 5; k++) {
            if (tabButtons[k]) {
                tabButtons[k].show();
            }
        }

        // ★★★ ウィンドウタイトルを「タイトル名-選択タブ名」形式に変更 ★★★
        var titlePart = (workInfo && workInfo.title) ? workInfo.title : "未設定";
        dialog.text = titlePart + " - " + tabNames[tabNumber];

        // ★★★ 現在のタブ番号を記録し、ボタン名を更新 ★★★
        currentTabNumber = tabNumber;
        exportCurrentButton.text = tabNames[tabNumber] + "を保存";
    }

    function importJsonData(file, isManualImport) {
        if (!file) return;
        try {
            if (file.open("r")) {
                file.encoding = "UTF-8";
                var content = file.read();
                file.close();
                var parsedImport = JSON.parse(content);
                var imported = parsedImport.presetData || {};
                var fileName = decodeURI(file.name).replace(/\.[^\.]+$/, '');
                importedFileName.text = fileName;

                // ★★★ ファイル形式を判定 ★★★
                // - presetsがある → JSON形式（プリセットを現在のセット項目へ）
                // - presetsがなくdetectedFonts/detectedTextLayersがある → scandata形式（検出されたフォントへ）
                // ※旧形式（fonts/textLayersByDoc）との互換性も維持
                var hasPresets = imported.presets && (typeof imported.presets === 'object');
                var detectedFontsData = imported.detectedFonts || imported.fonts;
                var detectedTextLayersData = imported.detectedTextLayers || imported.textLayersByDoc;
                var detectedSizeStatsData = imported.detectedSizeStats || imported.sizeStats || imported.fontSizeStats;
                var detectedStrokeStatsData = imported.detectedStrokeStats || imported.strokeStats;
                var detectedGuideSetsData = imported.detectedGuideSets || imported.guideSets;
                var isScandataOnly = !hasPresets && detectedFontsData && detectedTextLayersData;

                // ★★★ scandata専用形式の場合（presetsなし）★★★
                if (isScandataOnly) {
                    // ★★★ JSONデータとして保存（マージ用）★★★
                    jsonDataFonts = detectedFontsData || [];

                    // ★★★ 既存のscanDataとマージ（JSON優先）★★★
                    mergedFonts = mergeFontData(scanDataFonts, jsonDataFonts);
                    allDetectedFonts = mergedFonts.slice(); // 全フォント一覧を更新

                    // 検出されたフォントを表示（ドロップダウン）- 未登録フォントのみ表示
                    updateMissingFontList();

                    // フォントサイズ統計を表示
                    if (detectedSizeStatsData) {
                        lastFontSizeStats = detectedSizeStatsData;
                        // ★★★ mostFrequentをオブジェクト形式に統一 ★★★
                        if (typeof lastFontSizeStats.mostFrequent === 'number') {
                            var bs = lastFontSizeStats.mostFrequent;
                            lastFontSizeStats.mostFrequent = { size: bs, count: 0 };
                        } else if (!lastFontSizeStats.mostFrequent && lastFontSizeStats.sizes && lastFontSizeStats.sizes.length > 0) {
                            var fs = lastFontSizeStats.sizes[0];
                            var bs = (typeof fs === 'number') ? fs : (fs.size || 0);
                            if (bs > 0) lastFontSizeStats.mostFrequent = { size: bs, count: 0 };
                        }
                        if (!lastFontSizeStats.excludeRange && lastFontSizeStats.mostFrequent && lastFontSizeStats.mostFrequent.size > 0) {
                            var hs = lastFontSizeStats.mostFrequent.size / 2;
                            lastFontSizeStats.excludeRange = { min: hs - 1, max: hs + 1 };
                        }
                        updateFontSizeStatsDisplay();
                    }

                    // 白フチ情報を表示
                    if (detectedStrokeStatsData) {
                        lastStrokeStats = detectedStrokeStatsData;
                        updateStrokeListDisplay(detectedStrokeStatsData);
                    }

                    // ガイド線情報を表示
                    if (detectedGuideSetsData && detectedGuideSetsData.length > 0) {
                        allGuides.sets = detectedGuideSetsData;
                        // ★★★ 除外されたガイドセットインデックスを読み込み ★★★
                        if (imported.excludedGuideIndices && imported.excludedGuideIndices.length > 0) {
                            excludedGuideIndices = imported.excludedGuideIndices.slice();
                        }
                        var totalSets = detectedGuideSetsData.length;
                        var pageCount = imported.processedFiles || 0;
                        guideStatusText.text = "ガイド線: " + totalSets + "種類のセット検出 (" + pageCount + "ページ中)";

                        // ★★★ lastGuideDataを先に設定してからupdateGuideListDisplayを呼ぶ ★★★
                        var selectedIdx = (typeof imported.selectedGuideSetIndex !== 'undefined') ? imported.selectedGuideSetIndex : -1;
                        if (selectedIdx >= 0 && selectedIdx < detectedGuideSetsData.length) {
                            var selectedSet = detectedGuideSetsData[selectedIdx];
                            lastGuideData = {
                                horizontal: selectedSet.horizontal ? selectedSet.horizontal.slice() : [],
                                vertical: selectedSet.vertical ? selectedSet.vertical.slice() : []
                            };
                        } else {
                            // 選択されていない場合はlastGuideDataをクリア
                            lastGuideData = null;
                        }

                        updateGuideListDisplay();

                        if (guideListBox.items.length > 0 && selectedIdx >= 0) {
                            for (var gi = 0; gi < guideListBox.items.length; gi++) {
                                if (guideListBox.items[gi].setIndex === selectedIdx) {
                                    guideListBox.selection = gi;
                                    break;
                                }
                            }
                        }
                        updateGuideDisplay();
                    }

                    // テキストレイヤー情報をマージしてキャッシュ（JSON優先）
                    if (detectedTextLayersData) {
                        lastTextLayersByDoc = mergeTextLayerData(lastTextLayersByDoc, detectedTextLayersData);
                        updateTextLayerList();
                    }

                    // ★★★ テキストログデータをscanDataに読み込み ★★★
                    if (imported.textLogByFolder) {
                        if (!scanData) scanData = {};
                        scanData.textLogByFolder = imported.textLogByFolder;
                    }
                    if (imported.folderVolumeMapping) {
                        if (!scanData) scanData = {};
                        scanData.folderVolumeMapping = imported.folderVolumeMapping;
                    }
                    if (imported.startVolume) {
                        if (!scanData) scanData = {};
                        scanData.startVolume = imported.startVolume;
                    }

                    // ★★★ 編集済みルビ一覧をscanDataに読み込み ★★★
                    if (imported.editedRubyList && imported.editedRubyList.length > 0) {
                        if (!scanData) scanData = {};
                        scanData.editedRubyList = imported.editedRubyList;
                    }

                    // 作品情報を読み込み（ルビ一覧読み込みより先に実行）
                    if (imported.workInfo) {
                        workInfo = {
                            genre: imported.workInfo.genre || "",
                            label: imported.workInfo.label || "",
                            authorType: imported.workInfo.authorType || "single",
                            author: imported.workInfo.author || "",
                            artist: imported.workInfo.artist || "",
                            original: imported.workInfo.original || "",
                            title: imported.workInfo.title || "",
                            subtitle: imported.workInfo.subtitle || "",
                            editor: imported.workInfo.editor || "",
                            volume: imported.workInfo.volume || 1,
                            completedPath: imported.workInfo.completedPath || "",
                            typesettingPath: imported.workInfo.typesettingPath || "",
                            coverPath: imported.workInfo.coverPath || ""
                        };
                        updateWorkInfoDisplay();
                    }

                    // ★★★ selectionRangesをキャッシュに保存（scandata形式）★★★
                    if (imported.selectionRanges && imported.selectionRanges.length > 0) {
                        cachedSelectionRanges = imported.selectionRanges;
                        updateJsonLabelList();
                    }

                    // ★★★ ルビ一覧を更新（外部ファイル優先）★★★
                    var rubyLoadedFromExternal2 = false;
                    var labelForRuby2 = "";
                    var titleForRuby2 = "";
                    if (workInfo && workInfo.label && workInfo.title) {
                        labelForRuby2 = workInfo.label;
                        titleForRuby2 = workInfo.title;
                    } else if (imported.workInfo && imported.workInfo.label && imported.workInfo.title) {
                        labelForRuby2 = imported.workInfo.label;
                        titleForRuby2 = imported.workInfo.title;
                    }
                    if (labelForRuby2 && titleForRuby2) {
                        rubyLoadedFromExternal2 = loadRubyListFromExternalFile(labelForRuby2, titleForRuby2);
                    }
                    if (!rubyLoadedFromExternal2) {
                        loadRubyListFromScanData();
                    }

                    updateSummaryDisplay();
                    updateTextStatsDisplay();

                    if (isManualImport) {
                        var message = "scandataをインポートしました。\n\n読み込まれた内容：";
                        if (detectedFontsData) message += "\n- 検出フォント: " + detectedFontsData.length + "種類";
                        if (detectedSizeStatsData) message += "\n- フォントサイズ統計";
                        if (detectedStrokeStatsData && detectedStrokeStatsData.sizes) message += "\n- 白フチサイズ: " + detectedStrokeStatsData.sizes.length + "種類";
                        if (detectedGuideSetsData) message += "\n- ガイド線セット: " + detectedGuideSetsData.length + "種類";
                        if (imported.workInfo && imported.workInfo.title) message += "\n- 作品情報 (タイトル: " + imported.workInfo.title + ")";
                        if (imported.processedFiles) message += "\n\n処理済みファイル: " + imported.processedFiles + "ファイル";
                        alert(message);
                    }
                    return;
                }

                // ★★★ JSON形式（presetsあり）の場合の処理 ★★★
                var importedPresets;
                var importedStats = null;
                var importedGuides = null;
                var importedWorkInfo = null;

                if (imported.presets) {
                    importedPresets = imported.presets;
                    importedStats = imported.fontSizeStats || null;
                    importedGuides = imported.guides || null;
                    importedWorkInfo = imported.workInfo || null;
                } else {
                    importedPresets = imported;
                }

                // ★★★ 新規読み込み時は常に追加（置き換えなし） ★★★
                for (var setName in importedPresets) {
                    if (allPresetSets[setName]) {
                         allPresetSets[setName] = allPresetSets[setName].concat(importedPresets[setName]);
                    } else {
                        allPresetSets[setName] = importedPresets[setName];
                    }
                }

                if (importedStats) {
                    lastFontSizeStats = importedStats;
                    // ★★★ mostFrequentをオブジェクト形式に統一 ★★★
                    if (typeof lastFontSizeStats.mostFrequent === 'number') {
                        var bs2 = lastFontSizeStats.mostFrequent;
                        lastFontSizeStats.mostFrequent = { size: bs2, count: 0 };
                    } else if (!lastFontSizeStats.mostFrequent && lastFontSizeStats.sizes && lastFontSizeStats.sizes.length > 0) {
                        var fs2 = lastFontSizeStats.sizes[0];
                        var bs2 = (typeof fs2 === 'number') ? fs2 : (fs2.size || 0);
                        if (bs2 > 0) lastFontSizeStats.mostFrequent = { size: bs2, count: 0 };
                    }
                    if (!lastFontSizeStats.excludeRange && lastFontSizeStats.mostFrequent && lastFontSizeStats.mostFrequent.size > 0) {
                        var hs2 = lastFontSizeStats.mostFrequent.size / 2;
                        lastFontSizeStats.excludeRange = { min: hs2 - 1, max: hs2 + 1 };
                    }
                    updateFontSizeStatsDisplay();
                }
                // ★★★ guideSetsがない場合のみimportedGuidesを使用（guideSetsがある場合は後で処理）★★★
                if (importedGuides && !imported.guideSets && !imported.detectedGuideSets) {
                    lastGuideData = importedGuides;
                    updateGuideDisplay();
                }
                if (importedWorkInfo) {
                    workInfo = importedWorkInfo;
                    updateWorkInfoDisplay();
                }

                // ★★★ selectionRangesをキャッシュに保存 ★★★
                if (imported.selectionRanges && imported.selectionRanges.length > 0) {
                    cachedSelectionRanges = imported.selectionRanges;
                    updateJsonLabelList();
                }

                // ★★★ JSONに含まれるscandata情報も読み込む（検出されたフォントへ）- マージ処理 ★★★
                if (imported.fonts && imported.fonts.length > 0) {
                    // JSONのフォントデータを保存してマージ
                    jsonDataFonts = imported.fonts;
                    mergedFonts = mergeFontData(scanDataFonts, jsonDataFonts);
                    allDetectedFonts = mergedFonts.slice(); // 全フォント一覧を更新

                    // 未登録フォントのみ表示
                    updateMissingFontList();
                }
                // ★★★ 白フチ情報の読み込み（strokeStats または strokeSizes）★★★
                if (imported.strokeStats) {
                    lastStrokeStats = imported.strokeStats;
                    updateStrokeListDisplay(imported.strokeStats);
                } else if (imported.strokeSizes && imported.strokeSizes.length > 0) {
                    // ★★★ strokeSizes形式から変換（新形式: オブジェクト配列 / 旧形式: 数値配列）★★★
                    var sizes = [];
                    for (var si = 0; si < imported.strokeSizes.length; si++) {
                        var strokeItem = imported.strokeSizes[si];
                        if (typeof strokeItem === 'object' && strokeItem !== null) {
                            // 新形式: {size: number, fontSizes: array}
                            sizes.push({
                                size: strokeItem.size || 0,
                                count: strokeItem.count || 0,
                                fontSizes: strokeItem.fontSizes || []
                            });
                        } else if (typeof strokeItem === 'number') {
                            // 旧形式: 数値のみ
                            sizes.push({
                                size: strokeItem,
                                count: 0,
                                fontSizes: []
                            });
                        }
                    }
                    lastStrokeStats = { sizes: sizes };
                    updateStrokeListDisplay(lastStrokeStats);
                }
                // ★★★ ガイド線セット情報を読み込み（guideSets/detectedGuideSets両対応）★★★
                var jsonGuideSets = imported.guideSets || imported.detectedGuideSets;
                if (jsonGuideSets && jsonGuideSets.length > 0) {
                    allGuides.sets = jsonGuideSets;
                    // ★★★ 除外されたガイドセットインデックスを読み込み ★★★
                    if (imported.excludedGuideIndices && imported.excludedGuideIndices.length > 0) {
                        excludedGuideIndices = imported.excludedGuideIndices.slice();
                    }
                    var totalGuideSets = jsonGuideSets.length;
                    var pageCount = imported.processedFiles || 0;
                    guideStatusText.text = "ガイド線: " + totalGuideSets + "種類のセット検出" + (pageCount > 0 ? " (" + pageCount + "ページ中)" : "");

                    // ★★★ lastGuideDataを先に設定してからupdateGuideListDisplayを呼ぶ ★★★
                    var selectedIdx = (typeof imported.selectedGuideSetIndex !== 'undefined') ? imported.selectedGuideSetIndex : -1;
                    if (selectedIdx >= 0 && selectedIdx < jsonGuideSets.length) {
                        var selectedSet = jsonGuideSets[selectedIdx];
                        lastGuideData = {
                            horizontal: selectedSet.horizontal ? selectedSet.horizontal.slice() : [],
                            vertical: selectedSet.vertical ? selectedSet.vertical.slice() : []
                        };
                    } else {
                        // 選択されていない場合はlastGuideDataをクリア
                        lastGuideData = null;
                    }

                    updateGuideListDisplay();

                    // ★★★ guideListBoxで対応するセットを選択 ★★★
                    if (guideListBox.items.length > 0 && selectedIdx >= 0) {
                        for (var gli = 0; gli < guideListBox.items.length; gli++) {
                            if (guideListBox.items[gli].setIndex === selectedIdx) {
                                guideListBox.selection = gli;
                                break;
                            }
                        }
                    }
                    updateGuideDisplay();
                }
                if (imported.textLayersByDoc) {
                    // テキストレイヤーをマージ（JSON優先）
                    lastTextLayersByDoc = mergeTextLayerData(lastTextLayersByDoc, imported.textLayersByDoc);
                    updateTextLayerList();
                }

                // ★★★ テキストログデータをscanDataに読み込み ★★★
                if (imported.textLogByFolder) {
                    if (!scanData) scanData = {};
                    scanData.textLogByFolder = imported.textLogByFolder;
                }
                if (imported.folderVolumeMapping) {
                    if (!scanData) scanData = {};
                    scanData.folderVolumeMapping = imported.folderVolumeMapping;
                }
                if (imported.startVolume) {
                    if (!scanData) scanData = {};
                    scanData.startVolume = imported.startVolume;
                }

                // ★★★ 編集済みルビ一覧をscanDataに読み込み ★★★
                if (imported.editedRubyList && imported.editedRubyList.length > 0) {
                    if (!scanData) scanData = {};
                    scanData.editedRubyList = imported.editedRubyList;
                }
                // ★★★ ルビ一覧を更新（外部ファイル優先）★★★
                var rubyLoadedFromExternal = false;
                var labelForRuby = "";
                var titleForRuby = "";
                if (workInfo && workInfo.label && workInfo.title) {
                    labelForRuby = workInfo.label;
                    titleForRuby = workInfo.title;
                } else if (imported.workInfo && imported.workInfo.label && imported.workInfo.title) {
                    labelForRuby = imported.workInfo.label;
                    titleForRuby = imported.workInfo.title;
                }
                if (labelForRuby && titleForRuby) {
                    rubyLoadedFromExternal = loadRubyListFromExternalFile(labelForRuby, titleForRuby);
                }
                if (!rubyLoadedFromExternal) {
                    loadRubyListFromScanData();
                }

                // ★★★ フォントサイズ統計を読み込み ★★★
                var importedSizeStats = imported.sizeStats || imported.fontSizeStats || imported.detectedSizeStats;
                if (importedSizeStats) {
                    lastFontSizeStats = importedSizeStats;
                    // mostFrequentをオブジェクト形式に統一
                    if (typeof lastFontSizeStats.mostFrequent === 'number') {
                        var bs = lastFontSizeStats.mostFrequent;
                        lastFontSizeStats.mostFrequent = { size: bs, count: 0 };
                    } else if (!lastFontSizeStats.mostFrequent && lastFontSizeStats.sizes && lastFontSizeStats.sizes.length > 0) {
                        // mostFrequentがない場合、sizes[0]から取得
                        var fs = lastFontSizeStats.sizes[0];
                        var bs = (typeof fs === 'number') ? fs : (fs.size || 0);
                        if (bs > 0) lastFontSizeStats.mostFrequent = { size: bs, count: 0 };
                    }
                    // excludeRangeがない場合は計算
                    if (!lastFontSizeStats.excludeRange && lastFontSizeStats.mostFrequent && lastFontSizeStats.mostFrequent.size > 0) {
                        var hs = lastFontSizeStats.mostFrequent.size / 2;
                        lastFontSizeStats.excludeRange = { min: hs - 1, max: hs + 1 };
                    }
                    updateFontSizeStatsDisplay();
                }

                var firstImportedSet = null;
                for (var name in importedPresets) {
                    firstImportedSet = name;
                    break;
                }
                if(firstImportedSet) currentSetName = firstImportedSet;

                updatePresetList();
                updateTab2PresetList();  // ★★★ Tab2のプリセットリストも更新 ★★★
                updateSummaryDisplay();
                updateTextStatsDisplay();

                lastUsedFile = file;
                saveButton.enabled = true;

                if (isManualImport) {
                    // インポートしたプリセット数をカウント
                    var presetCount = 0;
                    for (var setName in importedPresets) {
                        if (importedPresets[setName] && importedPresets[setName].length) {
                            presetCount += importedPresets[setName].length;
                        }
                    }
                    var message = "JSONをインポートしました。";
                    message += "\n\n【現在のセット項目に追加】\n- プリセット: " + presetCount + "件";
                    if (imported.fonts) message += "\n\n【検出されたフォントに追加】\n- 検出フォント: " + imported.fonts.length + "種類";
                    if (importedStats) message += "\n- フォントサイズ統計";
                    if (jsonGuideSets && jsonGuideSets.length > 0) {
                        message += "\n- ガイド線セット: " + jsonGuideSets.length + "種類";
                    } else if (importedGuides) {
                        var hCount = importedGuides.horizontal ? importedGuides.horizontal.length : 0;
                        var vCount = importedGuides.vertical ? importedGuides.vertical.length : 0;
                        message += "\n- ガイド線 (" + (hCount + vCount) + "本)";
                    }
                    if (importedWorkInfo && importedWorkInfo.title) {
                        message += "\n\n【作品情報】\n- タイトル: " + importedWorkInfo.title;
                    }
                    alert(message);
                }
            }
        } catch (e) {
            alert("インポートエラー: " + e.message);
        }
    }

    // ===== イベントハンドラ =====
    // ★★★ タブボタンのクリックはcreateTabButton内のaddEventListenerで処理 ★★★

    // ★★★ 白フチリスト表示更新関数（横書き対応）★★★
    function updateStrokeListDisplay(strokeData) {
        lastRankOutStrokeSizes = [];

        // 新UIのリストボックスをクリア
        strokeSizeList.removeAll();

        if (!strokeData || !strokeData.sizes || strokeData.sizes.length === 0) {
            strokeStatusText.text = "白フチ（境界線）が見つかりませんでした";
            strokeDisplayText.text = "（なし）";
        } else {
            var totalCount = 0;
            for (var i = 0; i < strokeData.sizes.length; i++) {
                totalCount += strokeData.sizes[i].count || 0;
            }
            strokeStatusText.text = "白フチ: " + strokeData.sizes.length + "種類検出 (合計" + totalCount + "箇所)";

            // 登録サイズ（上位、横書き）
            var registeredStrokes = [];
            var topCount = Math.min(10, strokeData.sizes.length);
            for (var i = 0; i < topCount; i++) {
                var sz = strokeData.sizes[i].size;
                registeredStrokes.push(sz + "px");
            }
            strokeDisplayText.text = registeredStrokes.length > 0 ? registeredStrokes.join(", ") : "（なし）";

            // ★★★ 新UI: 白フチサイズリストを更新 ★★★
            // サイズ順（小さい順）にソート
            var sortedSizes = strokeData.sizes.slice().sort(function(a, b) { return a.size - b.size; });

            for (var si = 0; si < sortedSizes.length; si++) {
                var strokeItem = sortedSizes[si];
                var strokeSizeStr = strokeItem.size + "px";
                var fontSizesStr = "--";

                // 対応フォントサイズを表示
                if (strokeItem.fontSizes && strokeItem.fontSizes.length > 0) {
                    var fontSizeStrs = [];
                    for (var fi = 0; fi < strokeItem.fontSizes.length; fi++) {
                        fontSizeStrs.push(strokeItem.fontSizes[fi] + "pt");
                    }
                    fontSizesStr = fontSizeStrs.join(", ");
                }

                var listItem = strokeSizeList.add("item", strokeSizeStr);
                listItem.subItems[0].text = fontSizesStr;
            }

            // ランク外サイズ（10位以降）をグローバル変数に保存
            for (var j = topCount; j < strokeData.sizes.length; j++) {
                var szRank = strokeData.sizes[j].size;
                lastRankOutStrokeSizes.push(szRank + "px");
            }
        }
        // ランク外集計をまとめて更新
        updateRankOutSummary();
    }

    // ★★★ 選択済みガイドセットをクリック時に該当ページを表示 ★★★
    guideListBox.onChange = function() {
        if (!guideListBox.selection || !guideListBox.selection.guideData) {
            guideSelectionInfo.text = "セットを選択してください";
            return;
        }
        if (guideListBox.selection.enabled === false) {
            guideSelectionInfo.text = "【セットN】の行を選択してください";
            return;
        }
        var selectedSet = guideListBox.selection.guideData;
        var setIndex = guideListBox.selection.setIndex;
        if (typeof setIndex === 'undefined') {
            guideSelectionInfo.text = "セットを選択してください";
            return;
        }

        // docNamesがない場合は情報のみ表示
        if (!selectedSet.docNames || selectedSet.docNames.length === 0) {
            var infoText = "【セット" + (setIndex + 1) + "】を選択中  |  ";
            infoText += "水平: " + selectedSet.horizontal.length + "本, ";
            infoText += "垂直: " + selectedSet.vertical.length + "本  |  ";
            infoText += "出現合計ページ数: " + selectedSet.count + "（ページ情報なし）";
            guideSelectionInfo.text = infoText;
            return;
        }

        // 同じセットをクリックした場合は次のページへ、違うセットなら最初のページへ
        if (lastSelectedGuideSetIndex === setIndex) {
            currentSelectedGuidePageIndex = (currentSelectedGuidePageIndex + 1) % selectedSet.docNames.length;
        } else {
            lastSelectedGuideSetIndex = setIndex;
            currentSelectedGuidePageIndex = 0;
        }

        var targetDocName = selectedSet.docNames[currentSelectedGuidePageIndex];

        // 情報表示を更新
        var pageInfo = (currentSelectedGuidePageIndex + 1) + "/" + selectedSet.docNames.length;
        var infoText = "【セット" + (setIndex + 1) + "】 ページ: " + pageInfo + " (" + targetDocName + ")";
        guideSelectionInfo.text = infoText;
    };

    // ★★★ 未選択ガイドセットをクリック時に該当ページを表示 ★★★
    unselectedGuideListBox.onChange = function() {
        if (!unselectedGuideListBox.selection || !unselectedGuideListBox.selection.guideData) {
            return;
        }
        if (unselectedGuideListBox.selection.enabled === false) {
            return;
        }

        var selectedSet = unselectedGuideListBox.selection.guideData;
        var setIndex = unselectedGuideListBox.selection.setIndex;

        // docNamesがない場合は再読み取りを促す
        if (!selectedSet.docNames || selectedSet.docNames.length === 0) {
            guideSelectionInfo.text = "【セット" + (setIndex + 1) + "】- ページ情報なし（ガイド線の読み取りを再実行してください）";
            return;
        }

        // 同じセットをクリックした場合は次のページへ、違うセットなら最初のページへ
        if (lastSelectedUnselectedGuideSetIndex === setIndex) {
            currentGuidePageIndex = (currentGuidePageIndex + 1) % selectedSet.docNames.length;
        } else {
            lastSelectedUnselectedGuideSetIndex = setIndex;
            currentGuidePageIndex = 0;
        }

        var targetDocName = selectedSet.docNames[currentGuidePageIndex];

        // 情報表示を更新
        var pageInfo = (currentGuidePageIndex + 1) + "/" + selectedSet.docNames.length;
        var infoText = "【セット" + (setIndex + 1) + "】 ページ: " + pageInfo + " (" + targetDocName + ")";
        guideSelectionInfo.text = infoText;
    };

    selectGuideButton.onClick = function() {
        selectGuidesFromList();
    };

    // ★★★ 選択解除ボタン：選択済みセットを未選択に戻す ★★★
    unselectGuideButton.onClick = function() {
        // 選択済みリストから選択されている場合のみ処理
        if (!guideListBox.selection || !guideListBox.selection.guideData) {
            alert("選択を解除するセットを上のリストから選んでください。");
            return;
        }
        if (guideListBox.selection.enabled === false) {
            alert("詳細行ではなく【セットN】の行を選択してください。");
            return;
        }

        // ★★★ 除外リストにインデックスを追加（重複チェック付き）★★★
        var setIndexToExclude = guideListBox.selection.setIndex;
        var alreadyInExcluded = false;
        for (var exi = 0; exi < excludedGuideIndices.length; exi++) {
            if (excludedGuideIndices[exi] === setIndexToExclude) {
                alreadyInExcluded = true;
                break;
            }
        }
        if (!alreadyInExcluded) {
            excludedGuideIndices.push(setIndexToExclude);
        }

        // scanDataにも保存（JSON保存時に反映される）
        if (scanData) {
            scanData.excludedGuideIndices = excludedGuideIndices.slice();
            scanData.selectedGuideIndex = null;
        }

        // 選択を解除（lastGuideDataをクリア）
        lastGuideData = null;

        // リスト表示を更新
        updateGuideListDisplay();
        guideSelectionInfo.text = "セットの選択が解除されました";
        updateSummaryDisplay();
    };

    confirmGuideButton.onClick = function() {
        confirmSelectedGuides();
    };

    selectionRangeConfirmButton.onClick = function() {
        confirmSelectionRange();
    };

    clearStatsButton.onClick = function() {
      if (confirm("保存されているフォントサイズ統計をクリアしますか？\n（書き出し時にフォントサイズ情報が含まれなくなります）")) {
        lastFontSizeStats = null;
        updateFontSizeStatsDisplay();
        updateSummaryDisplay();
        alert("フォントサイズ統計をクリアしました。");
      }
    }
    
    editStatsButton.onClick = function() {
        if (!lastFontSizeStats) {
            alert("フォントサイズ統計がありません。\n\nまずフォントを検出してください。");
            return;
        }

        // ★★★ 形式を判定してサイズ値を取得 ★★★
        var isExportFormat = (typeof lastFontSizeStats.mostFrequent === 'number');
        var currentFreqSize = 0;
        var currentFreqCount = 0;

        if (isExportFormat) {
            currentFreqSize = lastFontSizeStats.mostFrequent;
        } else if (lastFontSizeStats.mostFrequent && typeof lastFontSizeStats.mostFrequent === 'object') {
            currentFreqSize = lastFontSizeStats.mostFrequent.size || 0;
            currentFreqCount = lastFontSizeStats.mostFrequent.count || 0;
        }

        var currentRangeMin, currentRangeMax;
        if (lastFontSizeStats.excludeRange) {
            currentRangeMin = lastFontSizeStats.excludeRange.min || 0;
            currentRangeMax = lastFontSizeStats.excludeRange.max || 0;
        } else if (currentFreqSize > 0) {
            var halfSize = currentFreqSize / 2;
            currentRangeMin = halfSize - 1;
            currentRangeMax = halfSize + 1;
        } else {
            currentRangeMin = 0;
            currentRangeMax = 0;
        }

        var currentTop10 = [];
        if (lastFontSizeStats.top10 && lastFontSizeStats.top10.length > 0) {
            for (var ti = 0; ti < lastFontSizeStats.top10.length; ti++) {
                var t10 = lastFontSizeStats.top10[ti];
                if (t10 && t10.size) {
                    currentTop10.push({
                        size: t10.size,
                        count: t10.count || 0
                    });
                }
            }
        } else if (lastFontSizeStats.top10Sizes && lastFontSizeStats.top10Sizes.length > 0) {
            // ★★★ top10Sizesがある場合はそれを優先使用（{size,count}形式対応） ★★★
            for (var ti2 = 0; ti2 < lastFontSizeStats.top10Sizes.length; ti2++) {
                var t10s = lastFontSizeStats.top10Sizes[ti2];
                if (typeof t10s === 'object' && t10s !== null && t10s.size > 0) {
                    currentTop10.push({ size: t10s.size, count: t10s.count || 0 });
                } else if (typeof t10s === 'number' && t10s > 0) {
                    currentTop10.push({ size: t10s, count: 0 });
                }
            }
        } else if (lastFontSizeStats.sizes && lastFontSizeStats.sizes.length > 0) {
            // sizes配列の場合（数値またはオブジェクト形式）
            for (var i = 0; i < lastFontSizeStats.sizes.length; i++) {
                var szItem = lastFontSizeStats.sizes[i];
                var sizeVal = 0;
                var countVal = 0;
                if (typeof szItem === 'object' && szItem !== null) {
                    sizeVal = szItem.size || 0;
                    countVal = szItem.count || 0;
                } else if (typeof szItem === 'number') {
                    sizeVal = szItem;
                }
                if (sizeVal > 0) {
                    currentTop10.push({size: sizeVal, count: countVal});
                }
            }
        }

        var editDialog = new Window("dialog", "フォントサイズ統計を編集");
        editDialog.orientation = "column";
        editDialog.alignChildren = ["fill", "top"];
        editDialog.spacing = 10;
        editDialog.margins = 15;
        editDialog.add("statictext", undefined, "【基本サイズ】");
        var freqGroup = editDialog.add("group");
        freqGroup.orientation = "row";
        freqGroup.add("statictext", undefined, "サイズ（pt）：");
        var freqSizeField = freqGroup.add("edittext", undefined, currentFreqSize.toString());
        freqSizeField.preferredSize.width = 80;
        editDialog.add("statictext", undefined, "【ルビサイズ想定範囲】");
        var rangeGroup = editDialog.add("group");
        rangeGroup.orientation = "row";
        rangeGroup.add("statictext", undefined, "最小（pt）：");
        var rangeMinField = rangeGroup.add("edittext", undefined, currentRangeMin.toFixed(1));
        rangeMinField.preferredSize.width = 80;
        rangeGroup.add("statictext", undefined, "最大（pt）：");
        var rangeMaxField = rangeGroup.add("edittext", undefined, currentRangeMax.toFixed(1));
        rangeMaxField.preferredSize.width = 80;
        editDialog.add("statictext", undefined, "【使用頻度の高いサイズ（Top10）】");
        editDialog.add("statictext", undefined, "※フォントサイズ（pt）を / で区切って入力（例: 12/14/16）");
        var top10Field = editDialog.add("edittext", undefined, "");
        top10Field.preferredSize.width = 350;

        var top10Text = "";
        if (currentTop10) {
            // ★★★ 小さい順にソートして表示 ★★★
            var sortedTop10 = currentTop10.slice().sort(function(a, b) { return a.size - b.size; });
            for (var i = 0; i < sortedTop10.length; i++) {
                if (i > 0) top10Text += "/";
                top10Text += sortedTop10[i].size;
            }
        }
        top10Field.text = top10Text;

        // ★★★ 白フチサイズ編集欄を追加 ★★★
        editDialog.add("statictext", undefined, "【白フチ（境界線）サイズと対応フォントサイズ】");
        editDialog.add("statictext", undefined, "※形式: 白フチpx:フォントpt,pt / 白フチpx:フォントpt（例: 2:12,14 / 4:16）");
        var strokeSizeField = editDialog.add("edittext", undefined, "");
        strokeSizeField.preferredSize.width = 350;

        var strokeText = "";
        if (lastStrokeStats && lastStrokeStats.sizes && lastStrokeStats.sizes.length > 0) {
            // ★★★ 小さい順にソートして表示（白フチサイズ:対応フォントサイズ形式）★★★
            var sortedStroke = lastStrokeStats.sizes.slice().sort(function(a, b) { return a.size - b.size; });
            var strokeParts = [];
            for (var i = 0; i < sortedStroke.length; i++) {
                var strokeItem = sortedStroke[i];
                var part = strokeItem.size;
                if (strokeItem.fontSizes && strokeItem.fontSizes.length > 0) {
                    part += ":" + strokeItem.fontSizes.join(",");
                }
                strokeParts.push(part);
            }
            strokeText = strokeParts.join(" / ");
        }
        strokeSizeField.text = strokeText;

        var buttons = editDialog.add("group");
        var okBtn = buttons.add("button", undefined, "保存");
        var cancelBtn = buttons.add("button", undefined, "キャンセル");
        
        okBtn.onClick = function() {
            try {
                var newFreqSize = parseFloat(freqSizeField.text);
                if (isNaN(newFreqSize)) {
                    alert("最頻出フォントサイズの値が不正です。"); return;
                }
                var newFreqCount = 0;
                if (lastFontSizeStats.mostFrequent && typeof lastFontSizeStats.mostFrequent === 'object') {
                    newFreqCount = lastFontSizeStats.mostFrequent.count || 0;
                }
                lastFontSizeStats.mostFrequent = { size: newFreqSize, count: newFreqCount };
                
                var newRangeMin = parseFloat(rangeMinField.text);
                var newRangeMax = parseFloat(rangeMaxField.text);
                if (isNaN(newRangeMin) || isNaN(newRangeMax)) {
                    alert("除外範囲の値が不正です。"); return;
                }
                lastFontSizeStats.excludeRange = { min: newRangeMin, max: newRangeMax };
                
                var top10Parts = top10Field.text.split("/");
                var newTop10 = [];
                var newSizesForExport = [];

                for (var i = 0; i < top10Parts.length; i++) {
                    var part = trimString(top10Parts[i]);
                    if (part === "") continue;
                    var size = parseFloat(part);
                    if (isNaN(size)) {
                        alert("フォントサイズの" + (i + 1) + "番目の値「" + part + "」が不正です。数値を入力してください。"); return;
                    }
                    newTop10.push({size: size, count: 0});
                    newSizesForExport.push(size);
                }
                lastFontSizeStats.top10 = newTop10;

                // ★★★ top10Sizesは{size, count}形式で入力順を維持 ★★★
                var newTop10Sizes = [];
                for (var t = 0; t < Math.min(newTop10.length, 10); t++) {
                    newTop10Sizes.push({ size: newTop10[t].size, count: newTop10[t].count || 0 });
                }

                newSizesForExport.sort(function(a, b) { return a - b; });
                lastFontSizeStats.forExport = {
                    mostFrequent: newFreqSize,
                    sizes: newSizesForExport,
                    top10Sizes: newTop10Sizes,  // ★★★ {size, count}形式、出現数順 ★★★
                    excludeRange: {
                        min: newRangeMin,
                        max: newRangeMax
                    }
                };

                if (lastFontSizeStats.sizes) delete lastFontSizeStats.sizes;

                // ★★★ 白フチサイズの保存処理（対応フォントサイズも含む）★★★
                // 形式: 白フチpx:フォントpt,pt / 白フチpx:フォントpt（例: 2:12,14 / 4:16）
                var strokeParts = strokeSizeField.text.split("/");
                var newStrokeSizes = [];
                for (var j = 0; j < strokeParts.length; j++) {
                    var strokePart = trimString(strokeParts[j]);
                    if (strokePart === "") continue;

                    var strokeSize = 0;
                    var fontSizesArr = [];

                    // コロンで分割（白フチサイズ:フォントサイズ）
                    if (strokePart.indexOf(":") >= 0) {
                        var colonParts = strokePart.split(":");
                        strokeSize = parseFloat(trimString(colonParts[0]));
                        if (colonParts[1]) {
                            var fontParts = colonParts[1].split(",");
                            for (var fp = 0; fp < fontParts.length; fp++) {
                                var fVal = parseFloat(trimString(fontParts[fp]));
                                if (!isNaN(fVal) && fVal > 0) {
                                    fontSizesArr.push(fVal);
                                }
                            }
                        }
                    } else {
                        strokeSize = parseFloat(strokePart);
                    }

                    if (isNaN(strokeSize) || strokeSize <= 0) {
                        alert("白フチサイズの" + (j + 1) + "番目の値「" + strokePart + "」が不正です。"); return;
                    }
                    newStrokeSizes.push({ size: strokeSize, count: 0, fontSizes: fontSizesArr });
                }
                // lastStrokeStatsを更新
                if (!lastStrokeStats) {
                    lastStrokeStats = { sizes: [], stats: {} };
                }
                lastStrokeStats.sizes = newStrokeSizes;
                // 白フチサイズ表示を更新
                updateStrokeListDisplay(lastStrokeStats);

                updateFontSizeStatsDisplay();
                updateSummaryDisplay();
                alert("フォントサイズ統計と白フチサイズを更新しました。");
                    editDialog.close();
            } catch (e) {
                alert("エラー: " + e.message);
            }
        };
        cancelBtn.onClick = function() { editDialog.close(); };
        editDialog.center();
        editDialog.show();
    };

    genreDropdown.onChange = function() { updateLabelDropdown(); };
    authorRadioSingle.onClick = function() {
        if (this.value) {
            authorSingleGroup.visible = true;
            authorDualGroup.visible = false;
            authorNoneGroup.visible = false;
        }
    };
    authorRadioDual.onClick = function() {
        if (this.value) {
            authorSingleGroup.visible = false;
            authorDualGroup.visible = true;
            authorNoneGroup.visible = false;
        }
    };
    authorRadioNone.onClick = function() {
        if (this.value) {
            authorSingleGroup.visible = false;
            authorDualGroup.visible = false;
            authorNoneGroup.visible = true;
        }
    };

    // ★★★ Notionからペーストボタン ★★★
    notionPasteButton.onClick = function() {
        // 入力ダイアログを表示
        var inputDialog = new Window("dialog", "Notionからペースト");
        inputDialog.orientation = "column";
        inputDialog.alignChildren = ["fill", "top"];
        inputDialog.add("statictext", undefined, "著者情報を貼り付けてください:");
        inputDialog.add("statictext", undefined, "例: 作画：あまつひかり");
        inputDialog.add("statictext", undefined, "例: 原作：山野しらす");
        inputDialog.add("statictext", undefined, "例: 著者名のみ（作画/原作なし）");
        var inputText = inputDialog.add("edittext", undefined, "", {multiline: true});
        inputText.preferredSize = [300, 80];
        var btnGroup = inputDialog.add("group");
        btnGroup.add("button", undefined, "OK", {name: "ok"});
        btnGroup.add("button", undefined, "キャンセル", {name: "cancel"});
        if (inputDialog.show() !== 1) {
            return;
        }
        var clipboardText = inputText.text.replace(/^\s+|\s+$/g, "");

        if (!clipboardText) {
            alert("テキストが入力されていません。");
            return;
        }

        // テキストをパースして振り分け
        var lines = clipboardText.split("\n");
        var artist = "";   // 作画
        var original = ""; // 原作
        var author = "";   // 著者

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].replace(/^\s+|\s+$/g, "");
            if (!line) continue;

            // 「作画：」または「作画:」で始まる行
            var artistMatch = line.match(/^作画[：:]\s*(.+)$/);
            if (artistMatch) {
                artist = artistMatch[1].replace(/^\s+|\s+$/g, "");
                continue;
            }

            // 「原作：」または「原作:」で始まる行
            var originalMatch = line.match(/^原作[：:]\s*(.+)$/);
            if (originalMatch) {
                original = originalMatch[1].replace(/^\s+|\s+$/g, "");
                continue;
            }

            // それ以外は著者として扱う（最初の1行のみ）
            if (!author && !artistMatch && !originalMatch) {
                author = line;
            }
        }

        // UIに反映
        if (artist || original) {
            // 作画/原作モードに切り替え
            authorRadioDual.value = true;
            authorRadioSingle.value = false;
            authorRadioNone.value = false;
            authorSingleGroup.visible = false;
            authorDualGroup.visible = true;
            authorNoneGroup.visible = false;
            artistInput.text = artist;
            originalInput.text = original;
            alert("作画／原作モードで設定しました。\n\n作画: " + (artist || "(なし)") + "\n原作: " + (original || "(なし)"));
        } else if (author) {
            // 著者モードに切り替え
            authorRadioSingle.value = true;
            authorRadioDual.value = false;
            authorRadioNone.value = false;
            authorSingleGroup.visible = true;
            authorDualGroup.visible = false;
            authorNoneGroup.visible = false;
            authorSingleInput.text = author;
            alert("著者モードで設定しました。\n\n著者: " + author);
        } else {
            alert("著者情報が見つかりませんでした。\n\n入力例:\n作画：あまつひかり\n原作：山野しらす\nまたは\n著者名のみ");
        }
    };

    addFromDetectedButton.onClick = function() {
        if (!missingFontDropdown.selection || missingFontDataList.length === 0) {
            alert("追加するフォントを選択してください。");
            // ボタンを確実に無効化
            addFromDetectedButton.enabled = false;
            addAllDetectedButton.enabled = false;
            return;
        }
        var selectedIndex = missingFontDropdown.selection.index;
        if (selectedIndex < 0 || selectedIndex >= missingFontDataList.length) {
            alert("有効なフォントを選択してください。");
            return;
        }
        var fontData = missingFontDataList[selectedIndex];
        var addedFontName = fontData.name; // 追加するフォント名を保存

        var addDialog = new Window("dialog", "プリセットを追加");
        addDialog.orientation = "column";
        addDialog.alignChildren = ["fill", "top"];
        addDialog.spacing = 10;
        addDialog.margins = 15;
        addDialog.add("statictext", undefined, "プリセット名：");
        var nameField = addDialog.add("edittext", undefined, fontData.displayName || "");
        nameField.preferredSize.width = 250;
        addDialog.add("statictext", undefined, "サブ名称（任意）：");
        var autoSubName = getAutoSubName(fontData.name);
        var subNameField = addDialog.add("edittext", undefined, autoSubName);
        subNameField.preferredSize.width = 250;
        addDialog.add("statictext", undefined, "フォント（PostScript名）：");
        var fontField = addDialog.add("edittext", undefined, fontData.name || "");
        fontField.preferredSize.width = 250;
        addDialog.add("statictext", undefined, "現在の表示名: " + getFontDisplayName(fontData.name));

        addDialog.add("statictext", undefined, "説明：");
        var descField = addDialog.add("edittext", undefined, "使用回数: " + (fontData.count || 0), { multiline: true });
        descField.preferredSize.height = 60;

        var buttons = addDialog.add("group");
        var okBtn = buttons.add("button", undefined, "追加");
        var cancelBtn = buttons.add("button", undefined, "キャンセル");

        var fontAdded = false; // フォントが追加されたかのフラグ

        okBtn.onClick = function() {
            if (!nameField.text) {
                alert("プリセット名を入力してください。"); return;
            }
            if (!fontField.text) {
                alert("フォント名を入力してください。"); return;
            }
            var preset = {
                name: nameField.text,
                subName: subNameField.text || "",
                font: fontField.text,
                description: descField.text
            };
            allPresetSets[currentSetName].push(preset);
            fontAdded = true;
            addDialog.close();
        };
        cancelBtn.onClick = function() { addDialog.close(); };
        addDialog.center();
        addDialog.show();

        // ★★★ ダイアログが閉じた後にプリセットリストとボタン状態を更新 ★★★
        if (fontAdded) {
            updatePresetList();
            // ボタン状態を更新（missingFontDataListは updateMissingFontList() で更新済み）
            var hasUnregistered = missingFontDataList.length > 0;
            addFromDetectedButton.enabled = hasUnregistered;
            addAllDetectedButton.enabled = hasUnregistered;
        }
    };

    addAllDetectedButton.onClick = function() {
        if (missingFontDataList.length === 0) {
            alert("追加するフォントがありません。");
            // ボタンを確実に無効化
            addFromDetectedButton.enabled = false;
            addAllDetectedButton.enabled = false;
            return;
        }
        if (!confirm("未登録の " + missingFontDataList.length + " 個のフォントを全てプリセットに追加しますか？")) {
            return;
        }
        var addedCount = 0;
        for (var i = 0; i < missingFontDataList.length; i++) {
            var fontData = missingFontDataList[i];
            var suggestedSize = "";
            if (fontData.sizes && fontData.sizes.length > 0) {
                suggestedSize = fontData.sizes[0].size.toString();
            }
            var preset = {
                name: fontData.displayName,
                subName: getAutoSubName(fontData.name),
                font: fontData.name,
                fontSize: suggestedSize,
                description: "使用回数: " + fontData.count
            };
            allPresetSets[currentSetName].push(preset);
            addedCount++;
        }
        // ★★★ ドロップダウンを直接更新して「すべて登録済み」表示に ★★★
        missingFontDropdown.removeAll();
        missingFontDataList = [];
        missingFontDropdown.add("item", "（すべてのフォントが登録済みです）");
        missingFontDropdown.selection = 0;
        // ★★★ ボタンを無効化（アラート前）★★★
        addFromDetectedButton.enabled = false;
        addAllDetectedButton.enabled = false;
        // プリセットリストを更新
        updatePresetList();
        // ★★★ アラート表示 ★★★
        alert(addedCount + "個のフォントをプリセットに追加しました。\n全てのフォントが登録されました。");
        // ★★★ アラート後にも再度ボタンを無効化（念のため）★★★
        addFromDetectedButton.enabled = false;
        addAllDetectedButton.enabled = false;
    };

    // ★★★ タブ2の追加ボタン（新規フォントセット追加）★★★
    tab2AddButton.onClick = function() {
        var addDialog = new Window("dialog", "フォントセットを新規追加");
        addDialog.orientation = "column";
        addDialog.alignChildren = ["fill", "top"];
        addDialog.spacing = 10;
        addDialog.margins = 15;

        // プリセット名
        addDialog.add("statictext", undefined, "プリセット名：");
        var nameField = addDialog.add("edittext", undefined, "");
        nameField.preferredSize.width = 300;

        // サブ名称
        addDialog.add("statictext", undefined, "サブ名称（任意）：");
        var subNameField = addDialog.add("edittext", undefined, "");
        subNameField.preferredSize.width = 300;

        // ★★★ フォント選択（ドロップダウンで和名表示）★★★
        addDialog.add("statictext", undefined, "フォントを選択（和名表示）：");
        var fontDropdown = addDialog.add("dropdownlist", undefined, []);
        fontDropdown.preferredSize.width = 300;

        // ★★★ システムフォント一覧を取得して和名でドロップダウンに追加 ★★★
        var fontList = [];
        try {
            for (var i = 0; i < app.fonts.length; i++) {
                var font = app.fonts[i];
                var displayName = font.family + " " + font.style;
                var postScriptName = font.postScriptName;
                fontList.push({
                    display: displayName,
                    postScript: postScriptName
                });
            }
            // 表示名でソート
            fontList.sort(function(a, b) {
                return a.display.localeCompare(b.display);
            });
            // ドロップダウンに追加
            for (var j = 0; j < fontList.length; j++) {
                var item = fontDropdown.add("item", fontList[j].display);
                item.postScriptName = fontList[j].postScript;
            }
            if (fontDropdown.items.length > 0) {
                fontDropdown.selection = 0;
            }
        } catch (e) {
            addDialog.add("statictext", undefined, "※フォント一覧の取得に失敗しました");
        }

        // ★★★ 手動入力用（PostScript名を直接入力する場合）★★★
        var manualGroup = addDialog.add("group");
        manualGroup.orientation = "row";
        manualGroup.alignChildren = ["left", "center"];
        var useManualCheck = manualGroup.add("checkbox", undefined, "手動でPostScript名を入力");
        var manualFontField = addDialog.add("edittext", undefined, "");
        manualFontField.preferredSize.width = 300;
        manualFontField.enabled = false;

        useManualCheck.onClick = function() {
            fontDropdown.enabled = !useManualCheck.value;
            manualFontField.enabled = useManualCheck.value;
        };

        // 選択中フォントのPostScript名を表示
        var postScriptLabel = addDialog.add("statictext", undefined, "PostScript名: ");
        postScriptLabel.preferredSize.width = 300;

        fontDropdown.onChange = function() {
            if (fontDropdown.selection) {
                postScriptLabel.text = "PostScript名: " + fontDropdown.selection.postScriptName;
                // ★★★ 選択したフォント名をプリセット名として自動入力 ★★★
                nameField.text = fontDropdown.selection.text;
            }
        };
        // 初期表示
        if (fontDropdown.selection) {
            postScriptLabel.text = "PostScript名: " + fontDropdown.selection.postScriptName;
            // ★★★ 初期選択時もプリセット名を自動設定 ★★★
            nameField.text = fontDropdown.selection.text;
        }

        // 説明
        addDialog.add("statictext", undefined, "説明（任意）：");
        var descField = addDialog.add("edittext", undefined, "", { multiline: true });
        descField.preferredSize.height = 60;

        // ボタン
        var buttons = addDialog.add("group");
        buttons.alignment = "center";
        var okBtn = buttons.add("button", undefined, "追加");
        var cancelBtn = buttons.add("button", undefined, "キャンセル");

        okBtn.onClick = function() {
            if (!nameField.text) {
                alert("プリセット名を入力してください。");
                return;
            }
            var fontPostScript = "";
            if (useManualCheck.value) {
                if (!manualFontField.text) {
                    alert("フォントのPostScript名を入力してください。");
                    return;
                }
                fontPostScript = manualFontField.text;
            } else {
                if (!fontDropdown.selection) {
                    alert("フォントを選択してください。");
                    return;
                }
                fontPostScript = fontDropdown.selection.postScriptName;
            }

            // 新しいプリセットを追加
            if (!allPresetSets[currentSetName]) {
                allPresetSets[currentSetName] = [];
            }
            allPresetSets[currentSetName].push({
                name: nameField.text,
                subName: subNameField.text || "",
                font: fontPostScript,
                description: descField.text || ""
            });

            updatePresetList();
            addDialog.close();
            alert("フォントセット「" + nameField.text + "」を追加しました。");
        };
        cancelBtn.onClick = function() { addDialog.close(); };

        addDialog.center();
        addDialog.show();
    };

    // ★★★ タブ2の編集ボタン ★★★
    tab2EditButton.onClick = function() {
        if (!tab2PresetList.selection || !tab2PresetList.selection.preset) return;
        var preset = tab2PresetList.selection.preset;
        var index = tab2PresetList.selection.presetIndex;

        var editDialog = new Window("dialog", "プリセットを編集");
        editDialog.orientation = "column";
        editDialog.alignChildren = ["fill", "top"];
        editDialog.spacing = 10;
        editDialog.margins = 15;
        editDialog.add("statictext", undefined, "プリセット名：");
        var nameField = editDialog.add("edittext", undefined, preset.name);
        nameField.preferredSize.width = 250;
        editDialog.add("statictext", undefined, "サブ名称（任意）：");
        var subNameField = editDialog.add("edittext", undefined, preset.subName || "");
        subNameField.preferredSize.width = 250;
        editDialog.add("statictext", undefined, "フォント（PostScript名）：");
        var fontField = editDialog.add("edittext", undefined, preset.font);
        fontField.preferredSize.width = 250;
        editDialog.add("statictext", undefined, "現在の表示名: " + getFontDisplayName(preset.font));

        editDialog.add("statictext", undefined, "説明：");
        var descField = editDialog.add("edittext", undefined, preset.description || "", { multiline: true });
        descField.preferredSize.height = 60;

        var buttons = editDialog.add("group");
        var okBtn = buttons.add("button", undefined, "更新");
        var cancelBtn = buttons.add("button", undefined, "キャンセル");

        okBtn.onClick = function() {
            if (!nameField.text) {
                alert("プリセット名を入力してください。"); return;
            }
            if (!fontField.text) {
                alert("フォント名を入力してください。"); return;
            }
            allPresetSets[currentSetName][index].name = nameField.text;
            allPresetSets[currentSetName][index].subName = subNameField.text || "";
            allPresetSets[currentSetName][index].font = fontField.text;
            allPresetSets[currentSetName][index].description = descField.text;
            updatePresetList();
            tab2PresetList.selection = index;
            editDialog.close();
        };
        cancelBtn.onClick = function() { editDialog.close(); };
        editDialog.center();
        editDialog.show();
    };

    // ★★★ タブ2の削除ボタン ★★★
    tab2DeleteButton.onClick = function() {
        if (!tab2PresetList.selection || !tab2PresetList.selection.preset) return;
        var preset = tab2PresetList.selection.preset;
        var index = tab2PresetList.selection.presetIndex;
        if (confirm("プリセット「" + preset.name + "」を削除しますか？")) {
            allPresetSets[currentSetName].splice(index, 1);
            updatePresetList();
        }
    };

    importButton.onClick = function() {
        var file = showJsonFileSelector("プリセットファイルを選択");

        // ★★★ 文字列"NEW"かどうかをtypeofでチェック ★★★
        if (typeof file === "string" && file === "NEW") {
            // ★★★ 新規作成：データをクリアして新しいセットを開始 ★★★
            allPresetSets = {"デフォルト": []};
            currentSetName = "デフォルト";
            workInfo = {
                genre: "", label: "", authorType: "single", author: "",
                artist: "", original: "", title: "", subtitle: "",
                editor: "", volume: 1, completedPath: "", typesettingPath: "", coverPath: ""
            };
            lastUsedFile = null;
            saveButton.enabled = false;
            importedFileName.text = "（新規作成）";

            // UIをクリア
            titleInput.text = "";
            subtitleInput.text = "";
            editorInput.text = "";
            authorSingleInput.text = "";
            artistInput.text = "";
            originalInput.text = "";
            completedPathInput.text = "";
            typesettingPathInput.text = "";
            coverPathInput.text = "";
            genreDropdown.selection = 0;
            volumeDropdown.selection = 0;
            updateLabelDropdown();

            updatePresetList();
            updateWorkInfoDisplay();
            updateSummaryDisplay();
            updateTextStatsDisplay();

            alert("新規作成モードです。\n作品情報を入力してください。");
            switchToTab(1);
        } else if (file && typeof file === "object") {
            // ★★★ ファイルオブジェクトの場合のみインポート ★★★
            importJsonData(file, true);
        }
    };

    // ★★★ 上書き保存ボタンのonClick ★★★
    saveButton.onClick = function() {
        if (!lastUsedFile) {
            alert("上書き保存するファイルがありません。");
            return;
        }

        // UIから作品情報を自動収集
        var currentVolume = volumeDropdown.selection ? (volumeDropdown.selection.index + 1) : 1;
        var currentWorkInfo = {
            genre: genreDropdown.selection ? genreDropdown.selection.text : "",
            label: labelDropdown.selection ? labelDropdown.selection.text : "",
            authorType: authorRadioSingle.value ? "single" : (authorRadioDual.value ? "dual" : "none"),
            author: authorRadioSingle.value ? authorSingleInput.text : "",
            artist: authorRadioDual.value ? artistInput.text : "",
            original: authorRadioDual.value ? originalInput.text : "",
            title: titleInput.text,
            subtitle: subtitleInput.text,
            editor: editorInput.text,
            volume: currentVolume,
            storagePath: storagePathInput.text,
            notes: notesInput.text
        };

        if (currentWorkInfo.title || currentWorkInfo.label) {
            workInfo = currentWorkInfo;
            if (scanData) {
                scanData.workInfo = workInfo;
                scanData.startVolume = currentVolume;
            }
        }

        // タイトル変更チェック
        var oldFileName = decodeURI(lastUsedFile.name);
        var oldFileNameWithoutExt = oldFileName.replace(/\.json$/i, "");
        var newTitle = workInfo && workInfo.title ? workInfo.title : "";
        var titleChanged = newTitle && (newTitle !== oldFileNameWithoutExt);
        var oldFilePath = lastUsedFile.fsName;

        var confirmMsg = "";
        if (titleChanged) {
            confirmMsg = "タイトルが変更されました。\n\n";
            confirmMsg += "【旧ファイル】" + oldFileName + "\n";
            confirmMsg += "【新ファイル】" + newTitle + ".json\n\n";
            confirmMsg += "旧ファイルを削除して、新しいタイトルで保存しますか？";
        } else {
            confirmMsg = "以下のファイルに上書き保存しますか？\n\n" + oldFileName + "\n" + decodeURI(lastUsedFile.path);
        }

        if (!confirm(confirmMsg)) {
            return;
        }

        try {
            // ★★★ 既存ファイルのデータを読み込み（一部修正モード）★★★
            var existingData = {};
            if (lastUsedFile.exists) {
                lastUsedFile.encoding = "UTF-8";
                if (lastUsedFile.open("r")) {
                    var existingContent = lastUsedFile.read();
                    lastUsedFile.close();
                    try {
                        var parsedExisting = JSON.parse(existingContent);
                        existingData = parsedExisting.presetData || {};
                    } catch (parseErr) {
                        existingData = {};
                    }
                }
            }

            // ★★★ 変更があった部分のみ更新（既存データを保持）★★★
            var exportData = existingData; // 既存データをベースにする

            // 各項目を更新（データがある場合のみ）
            var hasPresetData = false;
            for (var pKey in allPresetSets) {
                if (allPresetSets.hasOwnProperty(pKey)) { hasPresetData = true; break; }
            }
            if (allPresetSets && hasPresetData) {
                exportData.presets = convertPresetsForExport(allPresetSets);
            }
            if (lastFontSizeStats) {
                exportData.fontSizeStats = convertStatsForExport(lastFontSizeStats);
            }
            if (lastStrokeStats && lastStrokeStats.sizes && lastStrokeStats.sizes.length > 0) {
                exportData.strokeSizes = convertStrokeSizesForExport(lastStrokeStats);
            }
            if (lastGuideData) {
                exportData.guides = lastGuideData;
            }
            // ★★★ 全てのガイドセット情報を保存（未選択含む）★★★
            if (allGuides.sets && allGuides.sets.length > 0) {
                exportData.guideSets = allGuides.sets;
                // ★★★ 選択されているガイドセットのインデックスを保存 ★★★
                for (var gsi = 0; gsi < allGuides.sets.length; gsi++) {
                    if (lastGuideData &&
                        allGuides.sets[gsi].horizontal && lastGuideData.horizontal &&
                        allGuides.sets[gsi].vertical && lastGuideData.vertical &&
                        allGuides.sets[gsi].horizontal.length === lastGuideData.horizontal.length &&
                        allGuides.sets[gsi].vertical.length === lastGuideData.vertical.length) {
                        var isMatch = true;
                        for (var gh = 0; gh < lastGuideData.horizontal.length; gh++) {
                            if (Math.abs(allGuides.sets[gsi].horizontal[gh] - lastGuideData.horizontal[gh]) > 0.1) {
                                isMatch = false;
                                break;
                            }
                        }
                        if (isMatch) {
                            for (var gv = 0; gv < lastGuideData.vertical.length; gv++) {
                                if (Math.abs(allGuides.sets[gsi].vertical[gv] - lastGuideData.vertical[gv]) > 0.1) {
                                    isMatch = false;
                                    break;
                                }
                            }
                        }
                        if (isMatch) {
                            exportData.selectedGuideSetIndex = gsi;
                            break;
                        }
                    }
                }
            }
            // ★★★ 除外されたガイドセットインデックスを保存 ★★★
            if (excludedGuideIndices && excludedGuideIndices.length > 0) {
                exportData.excludedGuideIndices = excludedGuideIndices.slice();
            }
            if (workInfo && workInfo.title) {
                exportData.workInfo = workInfo;
            }
            // ★★★ selectionRanges, createdAt, その他の既存データは自動的に保持される ★★★

            var targetFile = lastUsedFile;
            var deletedOldFile = false;

            if (titleChanged) {
                var newFilePath = lastUsedFile.parent.fsName + "/" + newTitle + ".json";
                targetFile = new File(newFilePath);
                var oldFile = new File(oldFilePath);
                if (oldFile.exists) {
                    oldFile.remove();
                    deletedOldFile = true;
                }
            }

            if (targetFile.open("w")) {
                targetFile.encoding = "UTF-8";
                targetFile.write(formatJsonCompactNumberArrays(JSON.stringify({presetData: exportData}, null, 2)));
                targetFile.close();

                lastUsedFile = targetFile;
                importedFileName.text = decodeURI(targetFile.name);

                var scanDataSaved = false;
                if (scanData && workInfo && workInfo.title && workInfo.label) {
                    var newScanDataPath = saveScanDataWithInfo(scanData, workInfo.label, workInfo.title, workInfo.volume);
                    if (newScanDataPath) {
                        scanDataSaved = true;
                    }
                }

                var message = "========================================\n";
                if (titleChanged) {
                    message += "  タイトル変更＆保存完了\n";
                } else {
                    message += "  上書き保存完了\n";
                }
                message += "========================================\n\n";

                if (deletedOldFile) {
                    message += "【削除】" + oldFileName + " (JSON)\n";
                }
                message += "【保存ファイル】\n" + decodeURI(targetFile.name) + "\n";
                if (scanDataSaved) {
                    message += "【scandata保存】完了\n";
                }

                message += "\n【書き込み内容】\n";
                message += "----------------------------\n";

                var presetCount = 0;
                for (var setName in allPresetSets) {
                    if (allPresetSets.hasOwnProperty(setName)) {
                        presetCount += allPresetSets[setName].length;
                    }
                }
                message += "- プリセット: " + presetCount + "件\n";

                if (lastFontSizeStats) {
                    var sizeCount = 0;
                    for (var size in lastFontSizeStats) {
                        if (lastFontSizeStats.hasOwnProperty(size)) sizeCount++;
                    }
                    message += "- フォントサイズ: " + sizeCount + "種類\n";
                }
                if (lastStrokeStats && lastStrokeStats.sizes && lastStrokeStats.sizes.length > 0) {
                    message += "- 白フチサイズ: " + lastStrokeStats.sizes.length + "種類\n";
                }
                if (lastGuideData) {
                    var hCount = lastGuideData.horizontal ? lastGuideData.horizontal.length : 0;
                    var vCount = lastGuideData.vertical ? lastGuideData.vertical.length : 0;
                    if (hCount + vCount > 0) {
                        message += "- ガイド線: " + (hCount + vCount) + "本";
                        message += " (水平:" + hCount + " / 垂直:" + vCount + ")\n";
                    }
                }

                if (workInfo && workInfo.title) {
                    message += "\n【作品情報】\n";
                    message += "----------------------------\n";
                    if (workInfo.genre) message += "- ジャンル: " + workInfo.genre + "\n";
                    if (workInfo.label) message += "- レーベル: " + workInfo.label + "\n";
                    if (workInfo.authorType === "single" && workInfo.author) {
                        message += "- 著者: " + workInfo.author + "\n";
                    } else if (workInfo.authorType === "dual") {
                        if (workInfo.artist) message += "- 作画: " + workInfo.artist + "\n";
                        if (workInfo.original) message += "- 原作: " + workInfo.original + "\n";
                    }
                    message += "- タイトル: " + workInfo.title + "\n";
                    if (workInfo.subtitle) message += "- サブタイトル: " + workInfo.subtitle + "\n";
                    if (workInfo.editor) message += "- 編集者: " + workInfo.editor + "\n";
                    if (workInfo.storagePath) message += "- 格納場所: " + workInfo.storagePath + "\n";
                    if (workInfo.notes) message += "- 備考: " + workInfo.notes + "\n";
                }

                message += "\n========================================";
                alert(message);
            }
        } catch (e) {
            alert("上書き保存エラー: " + e.message);
        }
    };
    
    exportCurrentButton.onClick = function() {
        try {
            if (!allPresetSets[currentSetName]) {
                alert("プリセットデータが存在しません。"); return;
            }
            var currentSetPresets = {};
            currentSetPresets[currentSetName] = allPresetSets[currentSetName];

            // ★★★ UIから作品情報を自動収集（保存ボタンを押さなくてもOK）★★★
            var expVolume1 = volumeDropdown.selection ? (volumeDropdown.selection.index + 1) : 1;
            var currentWorkInfo = {
                genre: genreDropdown.selection ? genreDropdown.selection.text : "",
                label: labelDropdown.selection ? labelDropdown.selection.text : "",
                authorType: authorRadioSingle.value ? "single" : (authorRadioDual.value ? "dual" : "none"),
                author: authorRadioSingle.value ? authorSingleInput.text : "",
                artist: authorRadioDual.value ? artistInput.text : "",
                original: authorRadioDual.value ? originalInput.text : "",
                title: titleInput.text,
                subtitle: subtitleInput.text,
                editor: editorInput.text,
                volume: expVolume1,
                storagePath: storagePathInput.text,
                notes: notesInput.text
            };

            // ★★★ 新規登録時に作品情報が未入力の場合は警告 ★★★
            if (isNewCreation) {
                var missingFields = [];
                if (!currentWorkInfo.title || trimString(currentWorkInfo.title) === "") {
                    missingFields.push("タイトル");
                }
                if (!currentWorkInfo.label || trimString(currentWorkInfo.label) === "") {
                    missingFields.push("レーベル");
                }
                if (missingFields.length > 0) {
                    var warningMsg = "【警告】以下の作品情報が入力されていません：\n\n";
                    warningMsg += "・" + missingFields.join("\n・");
                    warningMsg += "\n\n作品情報タブで入力してから書き出すことを推奨します。\n\nこのまま続行しますか？";
                    if (!confirm(warningMsg)) {
                        return;
                    }
                }
            }

            // ★★★ workInfo変数を更新（UIの内容を反映）★★★
            if (currentWorkInfo.title || currentWorkInfo.label) {
                workInfo = currentWorkInfo;
                if (scanData) {
                    scanData.workInfo = workInfo;
                    scanData.startVolume = expVolume1;
                }
            }

            var defaultFileName;
            if (workInfo && workInfo.title) {
                defaultFileName = workInfo.title + ".json";
            } else {
                defaultFileName = currentSetName + ".json";
            }

            // レーベル名をサブフォルダとして提案
            var suggestedFolder = null;
            if (workInfo && workInfo.label) {
                suggestedFolder = workInfo.label;
            }

            var file = showJsonFileSaveDialog(defaultFileName, suggestedFolder);

            if (file) {
                try {
                    // ★★★ 既存ファイルがある場合はデータを読み込み（一部修正モード）★★★
                    var existingExpData = {};
                    if (file.exists) {
                        file.encoding = "UTF-8";
                        if (file.open("r")) {
                            var existingExpContent = file.read();
                            file.close();
                            try {
                                var parsedExpData = JSON.parse(existingExpContent);
                                existingExpData = parsedExpData.presetData || {};
                            } catch (parseErr3) {
                                existingExpData = {};
                            }
                        }
                    }

                    // ★★★ 既存データをベースに変更部分のみ更新 ★★★
                    var exportData = existingExpData;
                    exportData.presets = convertPresetsForExport(currentSetPresets);
                    if (lastFontSizeStats) {
                        exportData.fontSizeStats = convertStatsForExport(lastFontSizeStats);
                    }
                    if (lastStrokeStats && lastStrokeStats.sizes && lastStrokeStats.sizes.length > 0) {
                        exportData.strokeSizes = convertStrokeSizesForExport(lastStrokeStats);
                    }
                    if (lastGuideData) {
                        exportData.guides = lastGuideData;
                    }
                    // ★★★ 全てのガイドセット情報を保存（未選択含む）★★★
                    if (allGuides.sets && allGuides.sets.length > 0) {
                        exportData.guideSets = allGuides.sets;
                        // ★★★ 選択されているガイドセットのインデックスを保存 ★★★
                        for (var gsi2 = 0; gsi2 < allGuides.sets.length; gsi2++) {
                            if (lastGuideData &&
                                allGuides.sets[gsi2].horizontal && lastGuideData.horizontal &&
                                allGuides.sets[gsi2].vertical && lastGuideData.vertical &&
                                allGuides.sets[gsi2].horizontal.length === lastGuideData.horizontal.length &&
                                allGuides.sets[gsi2].vertical.length === lastGuideData.vertical.length) {
                                var isMatch2 = true;
                                for (var gh2 = 0; gh2 < lastGuideData.horizontal.length; gh2++) {
                                    if (Math.abs(allGuides.sets[gsi2].horizontal[gh2] - lastGuideData.horizontal[gh2]) > 0.1) {
                                        isMatch2 = false;
                                        break;
                                    }
                                }
                                if (isMatch2) {
                                    for (var gv2 = 0; gv2 < lastGuideData.vertical.length; gv2++) {
                                        if (Math.abs(allGuides.sets[gsi2].vertical[gv2] - lastGuideData.vertical[gv2]) > 0.1) {
                                            isMatch2 = false;
                                            break;
                                        }
                                    }
                                }
                                if (isMatch2) {
                                    exportData.selectedGuideSetIndex = gsi2;
                                    break;
                                }
                            }
                        }
                    }
                    // ★★★ 除外されたガイドセットインデックスを保存 ★★★
                    if (excludedGuideIndices && excludedGuideIndices.length > 0) {
                        exportData.excludedGuideIndices = excludedGuideIndices.slice();
                    }
                    if (workInfo && workInfo.title) {
                        exportData.workInfo = workInfo;
                    }
                    // ★★★ selectionRanges, createdAt等は既存データから保持される ★★★

                    // ★★★ 保存先サブフォルダの相対パスを記録 ★★★
                    var jsonRootFolder = getJsonFolder();
                    if (jsonRootFolder && file.parent) {
                        var rootPath = decodeURI(jsonRootFolder.fsName);
                        var filePath = decodeURI(file.parent.fsName);
                        var relativePath = filePath.replace(rootPath, "").replace(/^[\\\/]/, "");
                        exportData.saveLocation = relativePath || "(ルート)";
                    }

                    if (file.open("w")) {
                        file.encoding = "UTF-8";
                        file.write(formatJsonCompactNumberArrays(JSON.stringify({presetData: exportData}, null, 2)));
                        file.close();

                        lastUsedFile = file;
                        saveButton.enabled = true;

                        // ★★★ scandataも更新（タイトル変更時は旧ファイル削除→新規保存）★★★
                        var scanDataSaved = false;
                        if (scanData && workInfo && workInfo.title && workInfo.label) {
                            var newScanDataPath = saveScanDataWithInfo(scanData, workInfo.label, workInfo.title, workInfo.volume);
                            if (newScanDataPath) {
                                scanDataSaved = true;
                            }
                        }

                        // ★★★ 書き込んだ内容のサマリーを詳細表示 ★★★
                        var message = "========================================\n";
                        message += "　　「" + tabNames[currentTabNumber] + "」を保存完了\n";
                        message += "========================================\n\n";
                        message += "【保存ファイル】\n" + decodeURI(file.name) + "\n";
                        if (exportData.saveLocation) {
                            message += "【保存先】\n" + exportData.saveLocation + "\n";
                        }
                        if (scanDataSaved) {
                            message += "【scandata保存】完了\n";
                        }

                        message += "\n【書き込み内容】\n";
                        message += "----------------------------\n";

                        // プリセット情報
                        var presetCount = allPresetSets[currentSetName] ? allPresetSets[currentSetName].length : 0;
                        message += "- プリセット: " + presetCount + "件 (セット: " + currentSetName + ")\n";

                        // フォントサイズ統計
                        if (lastFontSizeStats) {
                            var sizeCount = 0;
                            for (var size in lastFontSizeStats) {
                                if (lastFontSizeStats.hasOwnProperty(size)) sizeCount++;
                            }
                            message += "- フォントサイズ: " + sizeCount + "種類\n";
                        }

                        // 白フチサイズ
                        if (lastStrokeStats && lastStrokeStats.sizes && lastStrokeStats.sizes.length > 0) {
                            message += "- 白フチサイズ: " + lastStrokeStats.sizes.length + "種類\n";
                        }

                        // ガイド線
                        if (lastGuideData) {
                            var hCount = lastGuideData.horizontal ? lastGuideData.horizontal.length : 0;
                            var vCount = lastGuideData.vertical ? lastGuideData.vertical.length : 0;
                            if (hCount + vCount > 0) {
                                message += "- ガイド線: " + (hCount + vCount) + "本";
                                message += " (水平:" + hCount + " / 垂直:" + vCount + ")\n";
                            }
                        }

                        // 作品情報（順序: ジャンル → レーベル → 著者 → タイトル → サブタイトル）
                        if (workInfo && workInfo.title) {
                            message += "\n【作品情報】\n";
                            message += "----------------------------\n";
                            if (workInfo.genre) message += "- ジャンル: " + workInfo.genre + "\n";
                            if (workInfo.label) message += "- レーベル: " + workInfo.label + "\n";
                            if (workInfo.authorType === "single" && workInfo.author) {
                                message += "- 著者: " + workInfo.author + "\n";
                            } else if (workInfo.authorType === "dual") {
                                if (workInfo.artist) message += "- 作画: " + workInfo.artist + "\n";
                                if (workInfo.original) message += "- 原作: " + workInfo.original + "\n";
                            }
                            message += "- タイトル: " + workInfo.title + "\n";
                            if (workInfo.subtitle) message += "- サブタイトル: " + workInfo.subtitle + "\n";
                            if (workInfo.editor) message += "- 編集者: " + workInfo.editor + "\n";
                            if (workInfo.completedPath) message += "- 完成原稿: " + workInfo.completedPath + "\n";
                            if (workInfo.typesettingPath) message += "- 写植校了: " + workInfo.typesettingPath + "\n";
                            if (workInfo.coverPath) message += "- 表紙: " + workInfo.coverPath + "\n";
                        }

                        message += "\n========================================";

                        // ★★★ JSONエクスポートではscandataを上書きしない ★★★
                        // （JSONはプリセット用、scandataはフルスキャンデータ用で別管理）

                        alert(message);
                    }
                } catch (e) {
                    alert("書き出しエラー: " + e.message);
                }
            }
        } catch (e) {
            alert("エクスポート処理エラー: " + e.message);
        }
    };

    // ★★★ 追加スキャンボタン（フォルダを追加してスキャン）★★★
    additionalScanButton.onClick = function() {
        try {
            // ★★★ scanDataがない場合は新規作成 ★★★
            if (!scanData) {
                scanData = {
                    scannedFolders: {},
                    detectedFonts: [],
                    detectedGuideSets: [],
                    detectedStrokeStats: { sizes: [] },
                    processedFiles: 0,
                    errorFiles: 0,
                    timestamp: new Date().toString()
                };
            }
            if (!scanData.scannedFolders) {
                scanData.scannedFolders = {};
            }

            // ★★★ 複数巻選択ダイアログを表示 ★★★
            var dialogResult = showAdditionalScanDialog();
            if (!dialogResult || !dialogResult.folderVolumeList || dialogResult.folderVolumeList.length === 0) {
                return; // キャンセルまたはフォルダ未選択
            }

            // 現在開いているドキュメントを保存
            var existingDocs = [];
            for (var ed = 0; ed < app.documents.length; ed++) {
                existingDocs.push(app.documents[ed]);
            }

            // ★★★ folderVolumeMappingを更新（既存のマッピングに追加）★★★
            if (!scanData.folderVolumeMapping) {
                scanData.folderVolumeMapping = {};
            }

            // 各フォルダをスキャンして追記
            var addedCount = 0;
            var skippedFolders = [];
            var newFolderNames = []; // 追加されたフォルダ名

            for (var i = 0; i < dialogResult.folderVolumeList.length; i++) {
                var fvItem = dialogResult.folderVolumeList[i];
                var tf = fvItem.folder;
                var volume = fvItem.volume;

                // 既にスキャン済みのフォルダはスキップ
                if (scanData && scanData.scannedFolders && scanData.scannedFolders[tf.fsName]) {
                    skippedFolders.push(decodeURI(tf.name));
                    continue;
                }

                // フォルダをスキャンして結果をマージ
                var scanResult = scanFolderForMerge(tf, existingDocs);
                if (scanResult) {
                    mergeScanResult(scanData, scanResult, tf.fsName);
                    addedCount++;
                    newFolderNames.push(tf.name);  // decodeURIを削除（textLogByFolderのキーと一致させる）

                    // ★★★ folderVolumeMappingに追加（フォルダ名 → 巻数）★★★
                    scanData.folderVolumeMapping[tf.name] = volume;
                }
            }

            if (addedCount > 0) {
                // ★★★ 追記前に現在のrubyListDataをscanDataに同期 ★★★
                saveRubyListToScanData();

                // ★★★ ルビデータを追記（既存のeditedRubyListに新しいルビを追加）★★★
                appendRubyFromNewFolders(newFolderNames);

                // 結果を保存
                saveScandataToFile(scanData);

                // ★★★ ルビ一覧を外部ファイルにも保存 ★★★
                saveRubyListToExternalFile();

                // ★★★ UIを更新 ★★★
                // フォント一覧を更新
                scanDataFonts = scanData.detectedFonts || [];
                allDetectedFonts = scanDataFonts.slice();
                updateMissingFontList();

                // ガイド線一覧を更新
                var newGuideSets = scanData.detectedGuideSets || [];
                if (newGuideSets.length > 0) {
                    allGuides.sets = newGuideSets;
                    updateGuideListDisplay();
                }

                // 白フチ統計を更新
                lastStrokeStats = scanData.detectedStrokeStats || null;

                // フォントサイズ統計を更新
                lastFontSizeStats = scanData.detectedSizeStats || null;

                // ★★★ フォントサイズ統計UIを更新（その他のサイズも含む）★★★
                updateFontSizeStatsDisplay();

                // ★★★ 白フチ統計UIを更新 ★★★
                if (lastStrokeStats) {
                    updateStrokeListDisplay(lastStrokeStats);
                }

                // ★★★ テキストログを作成（新規作成）★★★
                if (scanData.textLogByFolder && scanData.workInfo && scanData.workInfo.label && scanData.workInfo.title) {
                    var logVolume = scanData.startVolume || scanData.workInfo.volume || 1;
                    var editedRubyList = scanData.editedRubyList || null;
                    var textLogPath = exportTextLog(
                        scanData.textLogByFolder,
                        scanData.workInfo.label,
                        scanData.workInfo.title,
                        logVolume,
                        scanData.folderVolumeMapping,
                        editedRubyList
                    );
                    if (textLogPath) {
                        alert("テキストログを更新しました:\n" + textLogPath);
                    }
                }

                // ★★★ 保存ファイル一覧を更新 ★★★
                updateTextStatsDisplay();
            }

            // 結果メッセージ
            var resultMsg = "スキャン追記完了\n\n";
            resultMsg += "追加フォルダ数: " + addedCount + "\n";
            if (newFolderNames.length > 0) {
                resultMsg += "追加: " + newFolderNames.join(", ") + "\n";
            }
            if (skippedFolders.length > 0) {
                resultMsg += "スキップ（スキャン済み）: " + skippedFolders.length + "\n";
                resultMsg += "  " + skippedFolders.join(", ");
            }
            if (addedCount === 0 && skippedFolders.length === 0) {
                resultMsg = "追加するフォルダがありませんでした。";
            }
            alert(resultMsg);
        } catch (e) {
            alert("追加スキャン中にエラーが発生しました: " + e.message + "\n" + e.line);
        }
    };

    // ★★★ 閉じるボタン（ダイアログを閉じてスクリプト終了）★★★
    closeButton.onClick = function() {
        // ★★★ 上書き保存確認ダイアログを表示 ★★★
        var closeConfirmDialog = new Window("dialog", "終了確認");
        closeConfirmDialog.orientation = "column";
        closeConfirmDialog.alignChildren = ["fill", "top"];
        closeConfirmDialog.spacing = 10;
        closeConfirmDialog.margins = 15;

        closeConfirmDialog.add("statictext", undefined, "スクリプトを終了します。");
        closeConfirmDialog.add("statictext", undefined, "上書き保存しますか？");

        var closeBtnGroup = closeConfirmDialog.add("group");
        closeBtnGroup.orientation = "row";
        closeBtnGroup.alignment = ["center", "top"];
        var saveAndCloseBtn = closeBtnGroup.add("button", undefined, "上書き保存して閉じる");
        var closeWithoutSaveBtn = closeBtnGroup.add("button", undefined, "保存せずに閉じる");
        var cancelCloseBtn = closeBtnGroup.add("button", undefined, "キャンセル");

        var closeChoice = null;
        saveAndCloseBtn.onClick = function() { closeChoice = "save"; closeConfirmDialog.close(); };
        closeWithoutSaveBtn.onClick = function() { closeChoice = "nosave"; closeConfirmDialog.close(); };
        cancelCloseBtn.onClick = function() { closeChoice = "cancel"; closeConfirmDialog.close(); };

        closeConfirmDialog.show();

        if (closeChoice === "cancel" || closeChoice === null) {
            return; // キャンセルした場合は閉じない
        }

        if (closeChoice === "save") {
            // ★★★ 上書き保存を実行 ★★★
            if (saveButton.enabled && saveButton.onClick) {
                saveButton.onClick();
            } else {
                alert("保存先が設定されていないため、上書き保存できません。\n\n先に通常の保存を行ってください。");
                return; // 閉じない
            }
        }

        // ★★★ アクティブファイルがあればすべて保存せずに閉じる（自動）★★★
        while (app.documents.length > 0) {
            try {
                app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);
            } catch (closeErr) {
                break;
            }
        }
        dialog.close();
    };

    // ★★★ 新規作成判定フラグ（autoDetect=true かつ jsonToImport=null）★★★
    var isNewCreation = autoDetect && !jsonToImport;

    // ★★★ scanDataからデータを表示（PSDは閉じているのでキャッシュを使用）★★★
    // ★★★ プロパティ名の互換性対応（旧形式/新形式両対応）★★★
    var scanFonts = scanData ? (scanData.detectedFonts || scanData.fonts) : null;
    var scanSizeStats = scanData ? (scanData.detectedSizeStats || scanData.sizeStats) : null;
    var scanStrokeStats = scanData ? (scanData.detectedStrokeStats || scanData.strokeStats) : null;
    var scanTextLayers = scanData ? (scanData.detectedTextLayers || scanData.textLayersByDoc) : null;
    var scanGuideSetsList = scanData ? (scanData.detectedGuideSets || scanData.guideSets) : null;

    if (scanData) {
        // ★★★ フォント情報をscanDataから表示 ★★★
        if (scanFonts && scanFonts.length > 0) {
            var detectResult = {
                fonts: scanFonts,
                sizeStats: scanSizeStats,
                strokeStats: scanStrokeStats,
                textLayersByDoc: scanTextLayers
            };
            updateDetectionInfo(detectResult);
        }

        // ★★★ 白フチ情報をscanDataから表示 ★★★
        if (scanStrokeStats) {
            // ★★★ fontSizesをオブジェクト形式から配列形式に変換 ★★★
            if (scanStrokeStats.sizes) {
                for (var fsi = 0; fsi < scanStrokeStats.sizes.length; fsi++) {
                    var item = scanStrokeStats.sizes[fsi];
                    // fontSizesがオブジェクト形式の場合は配列に変換（配列はlengthを持つ）
                    if (item.fontSizes && typeof item.fontSizes === 'object' && item.fontSizes.length === undefined) {
                        var fontSizeArray = [];
                        for (var fsKey in item.fontSizes) {
                            if (item.fontSizes.hasOwnProperty(fsKey)) {
                                fontSizeArray.push(parseFloat(fsKey));
                            }
                        }
                        fontSizeArray.sort(function(a, b) { return b - a; });
                        item.fontSizes = fontSizeArray;
                    } else if (!item.fontSizes) {
                        item.fontSizes = [];
                    }
                }
            }

            lastStrokeStats = scanStrokeStats;
            updateStrokeListDisplay(scanStrokeStats);
        }

        // ★★★ ガイド線情報をscanDataから表示 ★★★
        if (scanGuideSetsList && scanGuideSetsList.length > 0) {
            allGuides.sets = scanGuideSetsList;
            var totalSets = scanGuideSetsList.length;
            guideStatusText.text = "ガイド線: " + totalSets + "種類のセット検出 (" + (scanData.processedFiles || 0) + "ページ中)";

            // ★★★ 最も使用頻度の高いセットを直接 lastGuideData に設定 ★★★
            var mostUsedSet = scanGuideSetsList[0];
            lastGuideData = {
                horizontal: (mostUsedSet.horizontal && mostUsedSet.horizontal.length > 0) ? mostUsedSet.horizontal.slice() : [],
                vertical: (mostUsedSet.vertical && mostUsedSet.vertical.length > 0) ? mostUsedSet.vertical.slice() : []
            };

            // ★★★ 新規作成時のみ、ガイド不足セットを自動で除外リストに追加 ★★★
            if (isNewCreation) {
                for (var gi = 0; gi < allGuides.sets.length; gi++) {
                    var guideSetToCheck = allGuides.sets[gi];
                    if (!isValidTachikiriGuideSet(guideSetToCheck)) {
                        // 重複チェック
                        var alreadyExcluded = false;
                        for (var exi = 0; exi < excludedGuideIndices.length; exi++) {
                            if (excludedGuideIndices[exi] === gi) {
                                alreadyExcluded = true;
                                break;
                            }
                        }
                        if (!alreadyExcluded) {
                            excludedGuideIndices.push(gi);
                        }
                    }
                }
            }

            // ガイド線リスト表示を更新（選択状態を反映）
            updateGuideListDisplay();

            // 最初のセットを選択状態にする
            if (guideListBox.items.length > 0) {
                guideListBox.selection = 0;
            }

            // 右パネルの表示を更新
            updateGuideDisplay();

            // ポップアップ表示（autoDetectの場合のみ）
            if (autoDetect && totalSets > 1) {
                var mostUsedCount = mostUsedSet.count || 0;
                alert("ガイド線セットが" + totalSets + "種類検出されました。\n\n最も使用頻度の高いセット（" + mostUsedCount + "ページで使用）を自動選択しました。");
            }
        } else {
            guideStatusText.text = "ガイド線: 検出されませんでした";
        }

        // ★★★ テキストレイヤーキャッシュを確実に設定 ★★★
        if (scanTextLayers) {
            lastTextLayersByDoc = scanTextLayers;
        }
    }

    // ★★★ JSONファイルをインポート（scanDataより後に処理して上書き可能に）★★★
    if (jsonToImport) {
        importJsonData(jsonToImport, false);
    }

    // ★★★ 初期化（scanDataとJSONの両方が設定された後に実行）★★★
    initialize();

    // ★★★ 検出データがある場合はフォント種類タブに切り替え ★★★
    if (scanData && (scanFonts || scanSizeStats || scanGuideSetsList)) {
        switchToTab(2);
    }

    // ★★★ 新規作成の場合、フォント種類を自動で全て追加 ★★★
    if (isNewCreation && missingFontDataList.length > 0) {
        var addedCount = 0;
        for (var i = 0; i < missingFontDataList.length; i++) {
            var fontData = missingFontDataList[i];
            var suggestedSize = "";
            if (fontData.sizes && fontData.sizes.length > 0) {
                suggestedSize = fontData.sizes[0].size.toString();
            }
            var preset = {
                name: fontData.displayName,
                subName: getAutoSubName(fontData.name),
                font: fontData.name,
                fontSize: suggestedSize,
                description: "使用回数: " + fontData.count
            };
            allPresetSets[currentSetName].push(preset);
            addedCount++;
        }
        updatePresetList();
        if (typeof updateTab2PresetList === "function") {
            updateTab2PresetList();
        }
    }

    updateSummaryDisplay();
    updateTextStatsDisplay();
    updateJsonLabelList();

    // ★★★ 新規作成の場合、自動で新規保存（UIなし）★★★
    if (isNewCreation && workInfo && workInfo.label && workInfo.title) {
        try {
            var jsonRootFolder = getJsonFolder();
            if (jsonRootFolder) {
                // レーベル名のフォルダを作成（存在しない場合）
                var labelFolder = new Folder(jsonRootFolder.fsName + "/" + workInfo.label);
                if (!labelFolder.exists) {
                    labelFolder.create();
                }

                // タイトル名でファイルを保存
                var autoSaveFile = new File(labelFolder.fsName + "/" + workInfo.title + ".json");

                // ★★★ 既存ファイルがある場合はデータを読み込み（一部修正モード）★★★
                var existingAutoData = {};
                if (autoSaveFile.exists) {
                    autoSaveFile.encoding = "UTF-8";
                    if (autoSaveFile.open("r")) {
                        var existingAutoContent = autoSaveFile.read();
                        autoSaveFile.close();
                        try {
                            var parsedAutoData = JSON.parse(existingAutoContent);
                            existingAutoData = parsedAutoData.presetData || {};
                        } catch (parseErr2) {
                            existingAutoData = {};
                        }
                    }
                }

                // ★★★ 既存データをベースに変更部分のみ更新 ★★★
                var exportData = existingAutoData;
                var hasPresetData2 = false;
                for (var pKey2 in allPresetSets) {
                    if (allPresetSets.hasOwnProperty(pKey2)) { hasPresetData2 = true; break; }
                }
                if (allPresetSets && hasPresetData2) {
                    exportData.presets = convertPresetsForExport(allPresetSets);
                }
                if (lastFontSizeStats) {
                    exportData.fontSizeStats = convertStatsForExport(lastFontSizeStats);
                }
                if (lastStrokeStats && lastStrokeStats.sizes && lastStrokeStats.sizes.length > 0) {
                    exportData.strokeSizes = convertStrokeSizesForExport(lastStrokeStats);
                }
                if (lastGuideData) {
                    exportData.guides = lastGuideData;
                }
                // ★★★ 全てのガイドセット情報を保存（未選択含む）★★★
                if (allGuides.sets && allGuides.sets.length > 0) {
                    exportData.guideSets = allGuides.sets;
                    // ★★★ 選択されているガイドセットのインデックスを保存 ★★★
                    for (var gsi3 = 0; gsi3 < allGuides.sets.length; gsi3++) {
                        if (lastGuideData &&
                            allGuides.sets[gsi3].horizontal && lastGuideData.horizontal &&
                            allGuides.sets[gsi3].vertical && lastGuideData.vertical &&
                            allGuides.sets[gsi3].horizontal.length === lastGuideData.horizontal.length &&
                            allGuides.sets[gsi3].vertical.length === lastGuideData.vertical.length) {
                            var isMatch3 = true;
                            for (var gh3 = 0; gh3 < lastGuideData.horizontal.length; gh3++) {
                                if (Math.abs(allGuides.sets[gsi3].horizontal[gh3] - lastGuideData.horizontal[gh3]) > 0.1) {
                                    isMatch3 = false;
                                    break;
                                }
                            }
                            if (isMatch3) {
                                for (var gv3 = 0; gv3 < lastGuideData.vertical.length; gv3++) {
                                    if (Math.abs(allGuides.sets[gsi3].vertical[gv3] - lastGuideData.vertical[gv3]) > 0.1) {
                                        isMatch3 = false;
                                        break;
                                    }
                                }
                            }
                            if (isMatch3) {
                                exportData.selectedGuideSetIndex = gsi3;
                                break;
                            }
                        }
                    }
                }
                // ★★★ 除外されたガイドセットインデックスを保存 ★★★
                if (excludedGuideIndices && excludedGuideIndices.length > 0) {
                    exportData.excludedGuideIndices = excludedGuideIndices.slice();
                }
                exportData.workInfo = workInfo;
                exportData.saveLocation = workInfo.label;
                // ★★★ selectionRanges, createdAt等は既存データから保持される ★★★

                if (autoSaveFile.open("w")) {
                    autoSaveFile.encoding = "UTF-8";
                    autoSaveFile.write(formatJsonCompactNumberArrays(JSON.stringify({presetData: exportData}, null, 2)));
                    autoSaveFile.close();

                    lastUsedFile = autoSaveFile;
                    saveButton.enabled = true;
                    importedFileName.text = workInfo.title + ".json";

                    // scandataも保存
                    if (scanData) {
                        saveScanDataWithInfo(scanData, workInfo.label, workInfo.title, workInfo.volume || 1);
                    }
                }
            }
        } catch (e) {
            // エラー時は無視（後で手動保存可能）
        }
    }

    // ★★★ 初期タブ状態を設定 ★★★
    switchToTab(1);

    dialog.center();
    dialog.show();
}