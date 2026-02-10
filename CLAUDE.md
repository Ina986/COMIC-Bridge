# COMIC-Bridge (manga-psd-manager)

漫画入稿データ（PSD）の確認・調整を行うデスクトップアプリケーション

## 概要

漫画制作者や編集者が入稿前にPSDファイルの仕様をチェックし、必要に応じてPhotoshopと連携して一括修正できるツール。

## 技術スタック

- **フレームワーク**: Tauri 2.0
- **フロントエンド**: React 18 + TypeScript + Vite
- **スタイリング**: Tailwind CSS
- **状態管理**: Zustand
- **PSD処理**: ag-psd（読み取り専用）、Photoshop ExtendScript（変換・書き込み）
- **PDF処理**: pdfium-render（プレビュー/サムネイル）、Photoshop PDFOpenOptions（分割処理）
- **バックエンド**: Rust

## 設計思想

**「検出はアプリ、修正はPhotoshop」**

- PSDメタデータの読み込み・チェックはag-psdで高速に実行
- 実際の画像変換（DPIリサンプリング、カラーモード変換等）はPhotoshop JSXスクリプトで実行
- **ag-psd の writePsd() はPSDバイナリを破壊する** → PSD書き込みは必ずPhotoshop JSX経由
- Photoshopの高品質な画像処理エンジンを活用

## 主要機能

### 1. PSD読み込み・プレビュー
- ドラッグ&ドロップでファイル/フォルダ読み込み（グローバルD&D: AppLayout常時リスナー、全対応形式を受付）
- 自然順ソート: ファイル名の数字部分を数値比較（"1巻 (2)" < "1巻 (10)"）
- 埋め込みサムネイル表示（高速）
- メタデータ抽出（サイズ、DPI、カラーモード、ビット深度、レイヤー構造、αチャンネル等）
- レイヤーツリー表示: 種別アイコン（グループ/テキスト/調整/スマートオブジェクト/シェイプ/レイヤー）
- マスク情報表示: クリッピングマスク(`clip`バッジ)、レイヤーマスク、ベクトルマスク

### 2. 自動仕様チェック
- ファイル読み込み後に仕様選択モーダルを表示
- モノクロ/カラー選択で即座にチェック開始
- 「次回から自動選択」で前回の仕様を記憶
- チェック結果をサムネイルとToolbarに表示（OK/NG件数）
- NGファイルはホバーで理由を表示

**チェック項目:**
- カラーモード（RGB / Grayscale）
- 解像度（350dpi / 600dpi）
- ビット深度（8bit / 16bit）
- αチャンネルの有無

**仕様チェックロジック:**
- 複数の仕様定義（モノクロ原稿、カラー原稿等）
- ファイルがいずれか1つの仕様に完全合格すればOK

### 3. NG時の修正ガイド
- NGファイル選択時にDetailPanelで修正ガイドを表示
- 問題点（現在値 → 必要値）を明示
- Photoshopでの修正方法を説明
- 「この1件を変換」「NGすべて変換」ボタン
- サムネイル複数選択（Ctrl+Click / Shift+Click）で選択中のNGファイルのみ変換可能
- サムネ領域外クリックで複数選択を解除（`data-preview-grid`/`data-sidebar`/`data-detail-panel`属性で判定、サイドバー・詳細パネル内クリックは除外）

### 4. Photoshop連携変換
- NGファイルを一括で仕様に合わせて変換
- 変換処理:
  - DPI変更（BICUBICリサンプリング）
  - カラーモード変換
  - ビット深度変換
  - αチャンネル削除
- 変換完了後にConversionToastで結果通知（成功:チェックマーク / エラー:シェイク）
- 処理完了後にアプリウィンドウを前面に復帰（`window.set_focus()`）
- 変換後に仕様チェックを自動再実行（`usePsdStore.getState().files`で最新状態を取得）

### 5. ガイド線管理
- 高解像度プレビュー: 3層キャッシュ（メモリ→ディスク→フル生成）で高速化
  - 決定論的ファイル名: `{name}_{modified_secs}_{maxSize}.jpg`
  - JPEG品質92（トンボの細線保持）
- Photoshop風Canvas定規（グラデーション、ズーム対応目盛り）
- 定規からドラッグでガイド作成
- ガイドクリックで選択 → ドラッグで移動 → 矢印キーで微調整（+Shift 10px）
- ガイド線は常に1px表示（選択時は色とグローで区別）
- `moveGuide`アクション: ドラッグ中は履歴を積まず、開始時に1回だけpushHistory
- Undo/Redo対応（Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z）
- ズーム/パン操作（Ctrl+/-/0、Space+ドラッグ）
- プリセット（B5同人誌、A4商業誌等）
- 複数ファイルへの一括適用（Photoshop JSX経由、`apply_guides.jsx`）
- 適用完了後に結果サマリー表示（成功/エラー件数）
- 処理完了後にアプリウィンドウを前面に復帰（`window.set_focus()`）

### 6. レイヤー制御（Photoshop JSX経由）
- レイヤー表示/非表示の一括切り替え（`hide_layers.jsx`）
- 条件指定: テキストレイヤー、テキストフォルダ、レイヤー名、フォルダ名、カスタム条件
- 部分一致/完全一致、大文字小文字の区別オプション
- 非表示→表示（復元）モード: `doc.info.caption`にメタデータ保存、親グループの可視性も自動復元
- 選択ファイルのみ / 全ファイル処理対応
- **詳細レポートダイアログ**: 処理完了後に中央モーダル（createPortal）でファイル別ツリー表示。親フォルダ∈情報付きでグループ/レイヤーの階層関係を表示（F/G/T/L種別バッジ）
- JSX側: `changedNames`に`"テキスト「name」∈「parent」"`形式で親フォルダ情報を記録。フロント側`extractMatchedItems()`→`buildTree()`でツリー構築
- **ビューアーモード**: LayerPreviewPanel内タブ切替（レイヤー構造/ビューアー）。全ファイルを対象に高解像度プレビュー表示（useHighResPreview maxSize=2000）。矢印キー/マウスホイール/矢印ボタンでページ送り（端でクランプ、循環なし）。P/Fショートカットはキャプチャフェーズでインターセプトしてビューアーの現在ファイルに対応
- **ビューアー高速化**: フロントエンドURLキャッシュ（30エントリ、`urlCache` Map）でキャッシュヒット時は即座に表示。隣接ファイル（±1）の`prefetchPreview()`でプリフェッチ。ロード中は前の画像をopacity-40で維持（ちらつき防止）。サムネイルフォールバック（高解像度未取得時にopacity-60で即表示）。ローディングスピナーは右上に小型表示

### 7. レイヤー差替え（Photoshop JSX経由）
- **テキスト差替え**: 植字データ → 画像データへテキストレイヤー/特定名グループを差替え
- **画像差替え**: 画像データ → 植字データへ背景レイヤー/特定名レイヤー/特定名グループを差替え
- **同時処理（バッチモード）**: 白消し・棒消しフォルダを自動検出して一括差替え
- ペアリング: ファイル順/数字キー/リンク文字（手動・自動検出）。セグメント型ピルボタンで方式切替
- 中央エリアにD&Dドロップゾーン（Tauri物理座標→CSS座標のDPR補正付き）
- **ドロップゾーン中央インジケータ**: 準備完了バッジ + モード連動方向矢印（text=→、image/batch=←）。divベースの円形矢印（Tailwindクラスで描画、SVG inline strokeにはCSS変数が効かないためcurrentColorパターンを使用）
- バッチモード: 親フォルダ⇔個別指定の排他制御、サブフォルダ自動検出
- ファイル数カウント（再帰対応）、0件時の警告表示
- **設定の再配置**: 全般設定セクションを廃止。フォントサイズを丸める→テキストモード内、サイズ変更を行わない→画像モード内、サブフォルダ対応→フォルダ選択セクション内に配置。バッチモードは両設定を表示
- **ペアリング確認ダイアログ**: 自動ペアリング/手動マッチのタブ切替（ReplacePairingModal）
  - **自動タブ（PairingAutoTab）**: チェックボックス付きペアテーブル、行ごとの鉛筆アイコン（編集）/×ボタン（解除）、ヘッダーに「編集」「解除」明記。未マッチファイル折りたたみセクション（クリックでペア作成）。モード切替時はopacity transitionでスムーズ遷移。マッチキーバッジ（ファイル順=#N、数字キー=pN、リンク文字=キー文字）。マッチ進捗バー（分母は左列=差し替え元ファイル数）
  - **手動タブ（PairingManualTab）**: 2カラムファイルリスト + クリック/ドラッグでペア作成
  - **出力設定（PairingOutputSettings）**: 折りたたみ式。出力フォルダ名入力 + 保存ファイル名トグル + 出力パスプレビュー
- **カスタム出力フォルダ名**: ダイアログ内出力設定で任意のサブフォルダ名を指定可能（空欄ならタイムスタンプで自動生成）
- **詳細マッチレポート**: 処理完了後に結果テーブルの各行にマッチしたレイヤー/グループ名をインラインタグバッジで表示（resultMatchMap）
- **完了トースト通知**: モーダル閉じ後にも成功/エラー結果をReplaceToastで表示、出力フォルダを開くボタン付き
- Photoshop JSX経由で差替え実行（`replace_layers.jsx`）

### 8. 見開き分割（Photoshop JSX経由）
- **均等分割**: 中央で左右に分割（`_R`/`_L`サフィックス）
- **不均等分割**: ノド（綴じ）側に余白を追加して均等化（`outerMargin`設定）
- **分割なし**: フォーマット変換のみ
- 単ページ自動検出: 先頭/末尾ファイルが標準幅の70%未満なら分割スキップ
- ページ番号: `_R/_L` または連番 `_001, _002...`
- **1ファイル目の右側が白紙**: `firstPageBlank`チェックで白紙右ページを破棄し、左ページから`_001`で開始（連番モード時のみ表示）
- **最終ファイルの左側が白紙**: `lastPageBlank`チェックで最終ファイルの左ページを破棄し、右ページで連番を終了（連番モード時のみ表示）
- オプション: 非表示レイヤー削除、はみ出しテキスト除去
- 出力形式: PSD / JPG（品質0-100%、JSX側は0-12スケールに変換）
- **マルチフォーマット対応**: PSD/PSB以外にJPG, PNG, TIFF, PDF, BMP, GIF, EPSも読み込み可（Photoshopが開ける全形式）
- **PDF対応**: PDFドロップ時にページ単位で展開表示。プレビュー/サムネイルは`pdfium-render`でレンダリング。分割処理はPhotoshop `PDFOpenOptions`で600dpiオープン
- **実行ボタン分離**: 「選択のみ (N)」「全て実行 (N)」の2ボタンで対象を明示
- **SplitPreview**: 定規ドラッグで垂直ガイド操作、ズーム/パン、Undo/Redo対応
- **splitStore**: `selectionHistory`/`selectionFuture`でUndo/Redo。`startDragSelection()`でドラッグ中は履歴スパム防止
- Photoshop JSX経由で全ファイル一括処理（`split_psd.jsx`、タイムアウト5分）

### 9. リネーム（レイヤーリネーム / ファイルリネーム）
- **サブモード切替**: 「ファイルリネーム」「レイヤーリネーム」のタブ切替
- **モードA: レイヤーリネーム（Photoshop JSX経由）**
  - 最下位/背景レイヤーを指定名に変更
  - レイヤー/グループ名の検索→置換（複数ルール対応、完全一致/部分一致/正規表現）
  - ファイルを連番で別名保存（ベース名+セパレータ+ゼロ埋め）
  - 出力先フォルダ選択
  - ライブプレビュー（psdStoreのlayerTreeデータで変更前→変更後を表示）
  - Photoshop JSX経由で実行（`rename_psd.jsx`）
- **モードB: ファイルリネーム（Rust直接処理、Photoshop不要）**
  - 対応形式: PSD, PSB, TIFF, JPG, PNG, BMP, GIF, PDF, EPS
  - 連番リネーム: ベース名+セパレータ+ゼロ埋め連番
  - 文字列置換: 検索→置換（部分一致/正規表現）
  - プレフィックス/サフィックス追加
  - フォルダ追加ボタンで複数フォルダ対応（フォルダ名ヘッダー付き表示）
  - ドラッグ並替え: ファイル順序変更→連番割り当てに反映
  - チェックボックスで一部だけリネーム対象に選択
  - ダブルクリックで個別ファイル名編集
  - 出力方式: 「Script_Outputにコピー」 or 「元の場所で上書きリネーム」
  - プレビュー: 変更前→変更後を一覧表示
  - invoke `batch_rename_files` でRust直接fs::copy/fs::rename
- **fileEntries→psdStore自動同期**: ファイルリネームに追加されたPSD/PSBを自動的にpsdStoreへ同期（レイヤーリネーム用のレイヤーツリー取得）
- **RenameResultDialog**: 処理完了ダイアログ（成功/失敗一覧 + 出力フォルダを開くボタン）

## UI構成

### レイアウト
- **TopNav**: 上部ナビゲーション。タブでビュー切替（ファイル/レイヤー制御/仕様チェック/差替え/見開き分割/リネーム）
- **ViewRouter + viewStore**: タブベースのビュー切替管理（AppView: specCheck | layers | split | replace | rename）
- **AppLayout**: TopNav + フルワイドビュー構成（旧3カラムサイドバーは廃止済み）、グローバルD&Dリスナー（useGlobalDragDrop）

### ビュー
- **FileView**: ファイル一覧・サムネイル・メタデータ表示
- **LayerControlView**: レイヤー制御パネル + LayerPreviewPanel（レイヤー構造タブ + ビューアータブ）
- **SpecCheckView**: 仕様チェックテーブル（SpecCheckTable）
- **ReplaceView**: レイヤー差替え
- **SplitView**: 見開き分割
- **RenameView**: リネーム（レイヤーリネーム / ファイルリネーム）

### レイヤーツリー (LayerPreviewPanel)
- **タブ切替**: 「レイヤー構造」（デフォルト）/ 「ビューアー」のセグメントボタン
- **レイヤー構造モード**:
  - 表示順: ag-psdのbottom-to-topを`.reverse()`でPhotoshop表示順（上がforeground）に変換
  - マルチカラムグリッド: 最大3列、4ファイル以上は次の行へ。CSS Gridで同一行の高さを揃え
  - サイドバー連動: selectedFileIdsがあればそのファイルのみ、なければ全ファイル表示
  - ローカル複数選択: クリックで単一選択、Shift+クリックで複数選択。チェック済みファイルはPhotoshop Blue (#31A8FF)でハイライト
  - Pキー: チェック済みファイルをPhotoshopで一括起動（単一ファイル時はそのまま起動）
  - モード連動: actionMode (hide/show) に応じて willChange / 済 / 要確認 をバッジ表示
  - リスク分類: layerMatcher.ts で safe/warning/none を判定。ラスターレイヤーの誤非表示をwarning表示
- **ビューアーモード**:
  - 全ファイル対象の高解像度プレビュー（useHighResPreview, maxSize=2000）
  - ナビゲーション: 矢印キー/マウスホイール/矢印ボタン（端でクランプ、循環なし）
  - サイドバー選択変更時にビューアー位置を同期
  - P/Fショートカット: キャプチャフェーズ(`addEventListener(..., true)`)で現在表示中ファイルに対応（グローバルハンドラーより優先）
- **select-none**: テキスト選択防止（全インタラクティブリストコンテナに適用）

### UIフロー
```
1. ファイル読み込み（D&D or フォルダ選択）
         ↓
2. 仕様選択モーダル表示
   - 自動選択有効 & 前回選択あり → 自動でチェック開始
   - そうでなければモーダル表示
         ↓
3. モノクロ/カラー選択 → 自動チェック実行
         ↓
4. OK/NG結果をサムネイル・Toolbarに表示
         ↓
5. NGファイル選択 → 修正ガイド表示
         ↓
6. 「変換」ボタン → Photoshopで一括修正
```

## ディレクトリ構造

```
src/
├── components/
│   ├── common/            # 共通コンポーネント
│   │   ├── CompactFileList.tsx    # コンパクトファイル一覧
│   │   └── DetailSlidePanel.tsx   # スライドイン詳細パネル
│   ├── file-browser/      # ファイル選択・ドロップゾーン
│   │   └── DropZone.tsx          # UI表示のみ（D&DリスナーはuseGlobalDragDrop）
│   ├── layout/            # レイアウトコンポーネント
│   │   ├── AppLayout.tsx         # メインレイアウト（TopNav + ビュー）
│   │   ├── TopNav.tsx            # 上部ナビゲーション（タブ切替）
│   │   └── ViewRouter.tsx        # ビュー切替ルーター
│   ├── views/             # ビューコンポーネント
│   │   ├── FileView.tsx          # ファイル一覧ビュー
│   │   ├── LayerControlView.tsx  # レイヤー制御ビュー
│   │   ├── SpecCheckView.tsx     # 仕様チェックビュー
│   │   ├── ReplaceView.tsx       # レイヤー差替えビュー
│   │   ├── SplitView.tsx         # 見開き分割ビュー
│   │   └── RenameView.tsx        # リネームビュー（fileEntries→psdStore自動同期）
│   ├── metadata/          # メタデータ表示
│   │   ├── MetadataPanel.tsx
│   │   └── LayerTree.tsx
│   ├── preview/           # プレビュー
│   │   ├── PreviewGrid.tsx
│   │   └── ThumbnailCard.tsx
│   ├── spec-checker/      # 仕様チェック
│   │   ├── SpecCheckerPanel.tsx
│   │   ├── SpecCheckTable.tsx    # 仕様チェック結果テーブル
│   │   ├── SpecSelectionModal.tsx
│   │   ├── FixGuidePanel.tsx
│   │   └── ConversionToast.tsx
│   ├── guide-editor/      # ガイド線編集
│   │   ├── GuideEditorModal.tsx
│   │   ├── GuideCanvas.tsx
│   │   └── CanvasRuler.tsx
│   ├── layer-control/     # レイヤー制御
│   │   ├── LayerControlPanel.tsx        # 条件指定UIと実行ボタン
│   │   ├── LayerPreviewPanel.tsx        # レイヤーツリープレビュー（グリッド・選択・Ps連携）
│   │   └── LayerControlResultDialog.tsx # 処理結果レポートダイアログ
│   ├── replace/           # レイヤー差替え
│   │   ├── ReplacePanel.tsx
│   │   ├── ReplaceDropZone.tsx
│   │   ├── ReplacePairingModal.tsx      # ペアリング確認ダイアログ（タブ切替シェル）
│   │   ├── PairingAutoTab.tsx           # 自動ペアリングタブ（チェック/編集/解除付きテーブル）
│   │   ├── PairingManualTab.tsx         # 手動マッチタブ（2カラム+クリック/ドラッグ）
│   │   ├── PairingOutputSettings.tsx    # 出力設定（保存ファイル名・フォルダ名）
│   │   └── ReplaceToast.tsx
│   ├── split/             # 見開き分割
│   │   ├── SplitPanel.tsx
│   │   ├── SplitPreview.tsx       # 定規ドラッグ・ガイド操作・ズーム/パン
│   │   └── SplitResultDialog.tsx  # 分割処理結果ダイアログ
│   ├── rename/            # リネーム
│   │   ├── LayerRenamePanel.tsx   # レイヤーリネーム設定UI
│   │   ├── FileRenamePanel.tsx    # ファイルリネーム設定UI
│   │   ├── RenamePreview.tsx      # プレビュー表示（両モード共通）
│   │   └── RenameResultDialog.tsx # 処理結果ダイアログ
│   └── ui/                # 共通UIコンポーネント
│       ├── Modal.tsx
│       └── PopButton.tsx
├── hooks/
│   ├── usePsdLoader.ts           # PSD読み込み・自然順ソート
│   ├── useGlobalDragDrop.ts      # グローバルD&Dリスナー（AppLayoutで常時有効）
│   ├── useSpecChecker.ts
│   ├── usePhotoshopConverter.ts
│   ├── useBatchProcessor.ts
│   ├── useHighResPreview.ts
│   ├── useLayerControl.ts
│   ├── useSplitProcessor.ts
│   ├── useRenameProcessor.ts
│   ├── useReplaceProcessor.ts
│   └── useOpenInPhotoshop.ts    # Photoshopファイル起動（ユーティリティ + Pキーショートカット）
├── lib/
│   ├── psd/
│   │   └── parser.ts            # ag-psdラッパー、メタデータ抽出
│   ├── layerMatcher.ts          # レイヤーマッチング・リスク分類（共有ロジック）+ 差替え対象マッチング
│   └── naturalSort.ts           # 自然順ソート（数字部分を数値比較）
├── store/
│   ├── psdStore.ts        # ファイル一覧・選択状態
│   ├── specStore.ts       # 仕様・チェック結果
│   ├── guideStore.ts      # ガイド線状態
│   ├── layerStore.ts      # レイヤー制御: actionMode, selectedConditions, customConditions
│   ├── viewStore.ts       # ビュー切替状態（activeView）
│   ├── splitStore.ts      # 分割設定
│   ├── replaceStore.ts    # 差替え設定
│   └── renameStore.ts     # リネーム設定（subMode, layerSettings, fileSettings, fileEntries）
├── styles/
│   └── globals.css
└── types/
    ├── index.ts
    ├── replace.ts
    └── rename.ts          # RenameSubMode, RenameRule, FileRenameEntry, etc.

src-tauri/
├── scripts/
│   ├── convert_psd.jsx
│   ├── apply_guides.jsx
│   ├── hide_layers.jsx
│   ├── split_psd.jsx
│   ├── replace_layers.jsx
│   └── rename_psd.jsx        # レイヤーリネーム用JSX
├── resources/
│   └── pdfium/
│       └── pdfium.dll         # PDFiumバイナリ（.gitignore管理、別途DL）
└── src/
    ├── lib.rs
    ├── commands.rs       # Rustコマンド（open_file_in_photoshop含む）
    └── pdf.rs            # PDFレンダリング（pdfium-render）
```

## 重要な型定義

```typescript
// 対応ファイル形式 (types/index.ts)
const IMAGE_EXTENSIONS = [".psd", ".psb", ".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp", ".pdf", ".gif", ".eps"];
const PSD_EXTENSIONS = [".psd", ".psb"];  // ag-psdでパース可能なもの
// isSupportedFile(fileName) / isPsdFile(fileName) / isPdfFile(fileName) ヘルパー関数あり

// PsdFile PDF関連フィールド（PDFページ展開時に設定）
interface PsdFile {
  // ... 既存フィールド ...
  sourceType?: "psd" | "image" | "pdf";  // ファイル種別
  pdfSourcePath?: string;                // PDF元ファイルパス
  pdfPageIndex?: number;                 // 0-based ページ番号
}

// PSDメタデータ
interface PsdMetadata {
  width: number;
  height: number;
  dpi: number;
  colorMode: ColorMode;
  bitsPerChannel: number;
  hasGuides: boolean;
  guides: Guide[];
  layerCount: number;
  layerTree: LayerNode[];
  hasAlphaChannels: boolean;
  alphaChannelCount: number;
  alphaChannelNames: string[];
}

// レイヤーノード
interface LayerNode {
  id: string;
  name: string;
  type: "layer" | "group" | "text" | "adjustment" | "smartObject" | "shape";
  visible: boolean;
  opacity: number;
  blendMode: string;
  hasMask?: boolean;        // レイヤーマスク（ag-psd: mask/realMask）
  hasVectorMask?: boolean;  // ベクトルマスク（ag-psd: vectorMask）
  clipping?: boolean;       // クリッピングマスク（ag-psd: clipping）
  children?: LayerNode[];
}

// 仕様定義
interface Specification {
  id: string;
  name: string;
  enabled: boolean;
  rules: SpecRule[];
}

// チェックルール
interface SpecRule {
  type: "colorMode" | "dpi" | "bitsPerChannel" | "hasAlphaChannels" | ...;
  operator: "equals" | "greaterThan" | "lessThan" | ...;
  value: string | number | boolean;
  message: string;
}

// チェック結果
interface SpecCheckResult {
  fileId: string;
  passed: boolean;
  results: { rule: SpecRule; passed: boolean; actualValue: any }[];
  matchedSpec?: string;
}
```

## 自動チェックの実装ポイント

```typescript
// useSpecChecker.ts
// 重要: files.lengthではなくfilesWithMetadataCountを監視する
// PSD読み込みは非同期でメタデータが後から追加されるため
const filesWithMetadataCount = files.filter((f) => f.metadata).length;

useEffect(() => {
  const specChanged = activeSpecId !== prevActiveSpecIdRef.current;
  const metadataAdded = filesWithMetadataCount > prevFilesWithMetadataRef.current;

  if (activeSpecId && filesWithMetadataCount > 0 && (specChanged || metadataAdded)) {
    checkAllFiles(enabledSpecs);
  }
}, [activeSpecId, filesWithMetadataCount, ...]);
```

## Photoshop JSX連携の注意点

1. **設定ファイルの受け渡し**: `Folder.temp` にJSONファイルを配置
2. **UTF-8 BOM**: 日本語パス対応のため `0xEF, 0xBB, 0xBF` を先頭に付与
3. **パス変換**: Windows `\\` → `/` に変換（JSX互換性）
4. **JSON処理**: ExtendScriptにはネイティブJSONがないため自作パーサーを使用
5. **DPIリサンプリング**: `ResampleMethod.BICUBIC` で実際のピクセル処理
6. **結果パスの正規化**: JSXからの結果パスは `/` 区切り → フロントでの比較時に `\` へ正規化が必要（`useBatchProcessor.ts`と`usePhotoshopConverter.ts`の両方で`.replace(/\//g, "\\")`）
7. **ウィンドウ前面化**: 処理完了後に `window.set_focus()` でアプリを前面に復帰（全Photoshop連携コマンド）
8. **Zustandのstale closure回避**: `useCallback`内で最新のstoreデータが必要な場合は`usePsdStore.getState().files`を使用（`files`をdepsに入れると古い値が参照される）
9. **Tauri D&D座標のDPR補正**: `onDragDropEvent`は物理ピクセル座標を返すが`getBoundingClientRect()`はCSS座標。`pos.x / window.devicePixelRatio`で補正が必要（Windows 150%スケーリング等）
10. **`<button>`は`<label>`のlabelable要素**: `<button>`を`<label>`内に配置するとクリック時に二重トグルが発生する。カスタムCheckBoxには`<div role="checkbox">`を使用
11. **JSX詳細レポート（差替え）**: `result.changes`に`"  → レイヤー「name」"`/`"  → グループ「name」"`/`"  → テキストフォルダ「name」"`形式で個別マッチを記録。フロント側`extractMatchedNames()`で正規表現パース
12. **JSX詳細レポート（レイヤー制御）**: `changedNames`に`"テキスト「name」∈「parent」"`形式で親フォルダ情報付きで記録。フロント側`extractMatchedItems()`→`buildTree()`でツリー構築。親フォルダが結果に含まれない場合はコンテキストとして`グループ`ノード（G）を自動生成
13. **Photoshopスクリプト実行パターン**: 全コマンド共通で「直接パス + `.output()` + ポーリング」を使用。`.spawn()`やtemp copyは問題を起こすので使わない
14. **非PSDファイルの読み込み**: `isPsdFile()`で判定し、PSD以外は`stat()`でファイルサイズのみ取得。ag-psdパースはスキップ。Photoshopが開ける前提でファイル一覧に表示
15. **ExtendScript `File.name` のURI符号化**: `File.name`は非ASCII文字をURIエンコードして返す（例: `校正_堀川` → `%E6%A0%A1%E6%AD%A3_%E5%A0%80%E5%B7%9D`）。`decodeURI(file.name)`で正しいファイル名を取得すること
16. **PDF分割処理**: JSX側で`pdfPageIndex >= 0`の場合、`PDFOpenOptions`（`page`, `resolution: 600`, `mode: OpenDocumentMode.RGB`）でページ指定オープン。`fileInfos`は`{ path, pdfPageIndex }`形式で渡す（`pdfPageIndex: -1`は通常ファイル）

## 高速PSD読み込み（Rust側）

tachimi_standaloneから移植した高速PSD読み込み機能:

1. **直接Image Data読み込み**: レイヤー解析をスキップして合成画像のみ取得
2. **RLE/PackBits圧縮デコード**: PSD独自の圧縮形式を直接デコード
3. **PSDキャッシュ**: `OnceLock<Mutex<HashMap>>` で最大10エントリをキャッシュ
4. **非同期処理**: `tokio::task::spawn_blocking` でUIフリーズ防止
5. **高速リサイズ**: `FilterType::CatmullRom`（Lanczos3より高速）
6. **asset://プロトコル**: `convertFileSrc()` でファイルパスをURLに変換

```rust
// commands.rs - 高速PSD読み込みの流れ
load_psd_fast(path)
  → load_psd_composite(path)  // 直接Image Dataセクション読み込み
  → 失敗時: psd crateにフォールバック
```

## PDFレンダリング（Rust側）

pdfium-renderによるPDFプレビュー/サムネイル生成:

1. **PDFium DLL**: `src-tauri/resources/pdfium/pdfium.dll`から遅延ロード（`OnceLock<Pdfium>`でシングルトン管理）
2. **DLL探索順**: リソースディレクトリ → `CARGO_MANIFEST_DIR/resources/` → システムPATH
3. **Tauriコマンド**: `get_pdf_info`（ページ数・寸法）、`get_pdf_preview`（高解像度）、`get_pdf_thumbnail`（Base64サムネイル）
4. **ページ展開**: PDFドロップ時に`get_pdf_info`で全ページ情報取得 → `psdStore.replaceFile()`で1ファイルを複数ページエントリーに置換
5. **キャッシュ**: ディスクキャッシュ `manga_pdf_preview_{name}_{mtime}_{page}_{size}.jpg`（既存PSDキャッシュと同一パターン）
6. **pdfium-render API注意**: ページインデックスは`u16`型（`PdfPageIndex`）、`PdfPoints`は`.value: f32`、`as_image()`は`DynamicImage`を直接返す

## デフォルト仕様

### モノクロ原稿
- カラーモード: Grayscale
- 解像度: 600dpi
- ビット深度: 8bit
- αチャンネル: なし

### カラー原稿
- カラーモード: RGB
- 解像度: 350dpi
- ビット深度: 8bit
- αチャンネル: なし

## UIテーマ（ライトテーマ）

明るくポップな漫画風UIを採用:

### カラーパレット
```javascript
// 背景
bg-primary: "#faf8f5"    // クリームホワイト（メイン背景）
bg-secondary: "#ffffff"  // 純白（パネル）
bg-tertiary: "#f5f3f0"   // 柔らかいグレー（カード）

// テキスト
text-primary: "#2d2d3a"  // ダークパープル
text-secondary: "#5a5a6e"
text-muted: "#9090a0"

// アクセント
accent: "#ff5a8a"        // ビビッドピンク
accent-secondary: "#7c5cff" // パープル
accent-tertiary: "#00c9a7"  // ミントグリーン

// ステータス
success: "#22c55e"       // 鮮やかな緑
error: "#ef4444"         // 鮮やかな赤
warning: "#f59e0b"       // オレンジ
```

### デザイン要素
- 角丸の大きいカード・ボタン（rounded-xl, rounded-2xl）
- ソフトシャドウ（shadow-soft, shadow-card）
- グラデーション（gradient-pop: pink → purple）
- グロー効果（shadow-glow-pink, shadow-glow-error）

## 開発コマンド

```bash
# 開発サーバー起動
npm run tauri dev
# または
start-dev.bat

# ビルド
npm run tauri build
# または
build.bat

# フロントエンドのみ
npm run dev
```

## localStorage永続化

```typescript
// specStore.ts
autoCheckEnabled: boolean     // 自動チェック有効/無効
lastSelectedSpecId: string    // 前回選択した仕様ID
```

## ガイドエディタのショートカット

| 操作 | キー |
|------|------|
| 元に戻す | Ctrl + Z |
| やり直す | Ctrl + Y / Ctrl + Shift + Z |
| ズームイン | Ctrl + (+/=) |
| ズームアウト | Ctrl + (-) |
| ズームリセット | Ctrl + 0 |
| パン | Space + ドラッグ |
| ガイド削除 | Delete / Backspace |

- 水平定規からドラッグ → 水平ガイド（Y軸位置）
- 垂直定規からドラッグ → 垂直ガイド（X軸位置）
- ガイドクリックで選択 → 選択中はハイライト表示
- Undo/Redo: 最大20ステップの履歴管理（guideStore）

## グローバルショートカット

| 操作 | キー | ビュー |
|------|------|--------|
| 全選択 | Ctrl+A | 全タブ（INPUT/TEXTAREA/SELECT内は除外） |
| Photoshopで開く | P | レイヤー制御・仕様チェック（ビューアーモードでは表示中ファイル） |
| フォルダを開く | F | 全タブ（ビューアーモードでは表示中ファイル） |
| 前のページ | ←/↑ | レイヤー制御ビューアー |
| 次のページ | →/↓ | レイヤー制御ビューアー |
| ページ送り | マウスホイール | レイヤー制御ビューアー |
