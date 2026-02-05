# COMIC-Bridge (manga-psd-manager)

漫画入稿データ（PSD）の確認・調整を行うデスクトップアプリケーション

## 概要

漫画制作者や編集者が入稿前にPSDファイルの仕様をチェックし、必要に応じてPhotoshopと連携して一括修正できるツール。

## 技術スタック

- **フレームワーク**: Tauri 2.0
- **フロントエンド**: React 18 + TypeScript + Vite
- **スタイリング**: Tailwind CSS
- **状態管理**: Zustand
- **PSD処理**: ag-psd（フロントエンド）、Photoshop ExtendScript（変換処理）
- **バックエンド**: Rust

## 設計思想

**「検出はアプリ、修正はPhotoshop」**

- PSDメタデータの読み込み・チェックはag-psdで高速に実行
- 実際の画像変換（DPIリサンプリング、カラーモード変換等）はPhotoshop JSXスクリプトで実行
- Photoshopの高品質な画像処理エンジンを活用

## 主要機能

### 1. PSD読み込み・プレビュー
- ドラッグ&ドロップでファイル/フォルダ読み込み
- 埋め込みサムネイル表示（高速）
- メタデータ抽出（サイズ、DPI、カラーモード、ビット深度、レイヤー構造、αチャンネル等）

### 2. 仕様チェック
- 複数の仕様定義（モノクロ原稿、カラー原稿等）
- ファイルがいずれか1つの仕様に完全合格すればOK
- チェック項目:
  - カラーモード（RGB / Grayscale）
  - 解像度（350dpi / 600dpi）
  - ビット深度（8bit / 16bit）
  - αチャンネルの有無

### 3. Photoshop連携変換
- NGファイルを一括で仕様に合わせて変換
- 変換処理:
  - DPI変更（BICUBICリサンプリング）
  - カラーモード変換
  - ビット深度変換
  - αチャンネル削除

### 4. ガイド線管理
- ガイド線の表示・編集
- プリセット（B5同人誌、A4商業誌等）
- 複数ファイルへの一括適用

### 5. レイヤー制御（計画中）
- レイヤー表示/非表示の切り替え
- 条件指定一括操作

### 6. 見開き分割（計画中）
- 均等/不均等分割
- プレビュー表示
- バッチ処理

## ディレクトリ構造

```
src/
├── components/
│   ├── file-browser/     # ファイル選択・ドロップゾーン
│   ├── layout/           # AppLayout, Sidebar, MainView, DetailPanel
│   ├── metadata/         # MetadataPanel, LayerTree
│   ├── preview/          # ThumbnailCard
│   ├── spec-checker/     # SpecCheckerPanel
│   ├── layer-control/    # レイヤー制御UI
│   ├── split/            # 見開き分割UI
│   └── ui/               # 共通UIコンポーネント
├── hooks/
│   ├── usePsdLoader.ts         # PSD読み込み
│   ├── useSpecChecker.ts       # 仕様チェックロジック
│   ├── usePhotoshopConverter.ts # Photoshop連携
│   └── ...
├── lib/
│   └── psd/
│       └── parser.ts     # ag-psdラッパー、メタデータ抽出
├── store/
│   ├── psdStore.ts       # ファイル一覧状態
│   ├── specStore.ts      # 仕様・チェック結果・変換設定
│   └── ...
├── styles/
│   └── globals.css       # グローバルスタイル、CSS変数
└── types/
    └── index.ts          # 型定義

src-tauri/
├── scripts/
│   └── convert_psd.jsx   # Photoshop ExtendScript
└── src/
    ├── lib.rs            # Tauriコマンド登録
    └── commands.rs       # Rustコマンド実装
```

## 重要な型定義

```typescript
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
```

## Photoshop JSX連携の注意点

1. **設定ファイルの受け渡し**: `Folder.temp` にJSONファイルを配置
2. **UTF-8 BOM**: 日本語パス対応のため `0xEF, 0xBB, 0xBF` を先頭に付与
3. **パス変換**: Windows `\\` → `/` に変換（JSX互換性）
4. **JSON処理**: ExtendScriptにはネイティブJSONがないため自作パーサーを使用
5. **DPIリサンプリング**: `ResampleMethod.BICUBIC` で実際のピクセル処理

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

## UIテーマ

ポップで愛らしい漫画風UIを採用:
- ダークベース（深いパープルグレー）
- ビビッドなアクセントカラー（ピンク、パープル、ミント）
- グラデーション、グロー効果
- 角丸の大きいカード・ボタン

## 開発コマンド

```bash
# 開発サーバー起動
npm run tauri dev

# ビルド
npm run tauri build

# フロントエンドのみ
npm run dev
```
