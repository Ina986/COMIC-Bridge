// === ダイアログモード ===
export type PairingDialogMode = "auto" | "manual";

// === スキャン済みファイルグループ ===
export interface ScannedFileGroup {
  groupKey: string;        // ジョブ識別子（"通常処理", サブフォルダ名等）
  sourceFiles: string[];   // フルパス、ソート済み
  targetFiles: string[];   // フルパス、ソート済み
  outputDirSuffix: string; // outBase以降のパス（"" or "/{name}_差替え後PSD"）
}

// === 差替えモード ===
export type ReplaceMode = "text" | "image" | "batch";
export type TextSubMode = "textLayers" | "namedGroup";
export type PairingMode =
  | "fileOrder"
  | "numericKey"
  | "linkCharManual"
  | "linkCharAuto";
export type SubfolderMode = "none" | "advanced";
export type ProcessingPhase =
  | "idle"
  | "scanning"
  | "pairing"
  | "processing"
  | "complete"
  | "error";

// === テキストモード設定 ===
export interface TextModeSettings {
  subMode: TextSubMode;
  groupName: string; // e.g. "text"
  partialMatch: boolean;
}

// === 画像モード設定 ===
export interface ImageModeSettings {
  replaceBackground: boolean; // 最下層レイヤー差替え
  replaceSpecialLayer: boolean; // 特定名レイヤー差替え
  specialLayerName: string; // e.g. "白消し"
  specialLayerPartialMatch: boolean;
  replaceNamedGroup: boolean; // 特定名グループ差替え
  namedGroupName: string; // e.g. "棒消し"
  namedGroupPartialMatch: boolean;
  placeFromBottom: boolean; // 下から数えて同じ位置に配置
}

// === ペアリング設定 ===
export interface PairingSettings {
  mode: PairingMode;
  linkCharacter: string;
}

// === 全般設定 ===
export interface GeneralSettings {
  skipResize: boolean;
  roundFontSize: boolean;
  saveFileName: "target" | "source";
  outputFolderName: string; // 出力サブフォルダ名（空ならタイムスタンプ）
}

// === サブフォルダ設定 ===
export interface SubfolderSettings {
  mode: SubfolderMode;
}

// === 統合設定 ===
export interface ReplaceSettings {
  mode: ReplaceMode;
  textSettings: TextModeSettings;
  imageSettings: ImageModeSettings;
  pairingSettings: PairingSettings;
  generalSettings: GeneralSettings;
  subfolderSettings: SubfolderSettings;
}

// === フォルダ選択 ===
export interface FolderSelection {
  sourceFolder: string | null; // 植字データフォルダ
  targetFolder: string | null; // 画像データフォルダ
  sourceFiles: string[] | null; // 個別ファイル指定（ファイルドロップ時）
  targetFiles: string[] | null; // 個別ファイル指定（ファイルドロップ時）
}

// === ファイルペア ===
export interface FilePair {
  sourceFile: string; // フルパス
  sourceName: string; // 表示名
  targetFile: string;
  targetName: string;
  pairIndex: number;
}

// === ペアリングジョブ ===
export interface PairingJob {
  description: string;
  pairs: FilePair[];
  outputDir: string;
}

// === 差替え結果 ===
export interface ReplaceResult {
  pairIndex: number;
  sourceName: string;
  targetName: string;
  success: boolean;
  outputFile: string;
  operations: string[];
  error?: string;
}
