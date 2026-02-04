// PSD File Types
export interface PsdFile {
  id: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  modifiedTime: number;
  metadata?: PsdMetadata;
  thumbnailUrl?: string;
  thumbnailStatus: "pending" | "loading" | "ready" | "error";
  error?: string;
}

export interface PsdMetadata {
  width: number;
  height: number;
  dpi: number;
  colorMode: ColorMode;
  bitsPerChannel: number;
  hasGuides: boolean;
  guides: Guide[];
  layerCount: number;
  layerTree: LayerNode[];
}

export type ColorMode =
  | "RGB"
  | "CMYK"
  | "Grayscale"
  | "Bitmap"
  | "Lab"
  | "Indexed"
  | "Multichannel"
  | "Duotone";

export interface Guide {
  direction: "horizontal" | "vertical";
  position: number; // in pixels from top/left
}

export interface LayerNode {
  id: string;
  name: string;
  type: "layer" | "group" | "text" | "adjustment" | "smartObject";
  visible: boolean;
  opacity: number;
  blendMode: string;
  children?: LayerNode[];
}

// Specification Types
export interface Specification {
  id: string;
  name: string;
  enabled: boolean;
  rules: SpecRule[];
}

export interface SpecRule {
  type: "colorMode" | "resolution" | "dimensions" | "dpi" | "hasGuides" | "bitsPerChannel";
  operator: "equals" | "greaterThan" | "lessThan" | "between" | "includes";
  value: string | number | boolean | number[];
  message: string;
}

export interface SpecCheckResult {
  fileId: string;
  passed: boolean;
  results: {
    rule: SpecRule;
    passed: boolean;
    actualValue: string | number | boolean;
  }[];
}

// UI Types
export type ViewMode = "grid" | "list";
export type ThumbnailSize = "small" | "medium" | "large" | "xlarge";

export const THUMBNAIL_SIZES: Record<ThumbnailSize, { value: number; label: string }> = {
  small: { value: 100, label: "小" },
  medium: { value: 140, label: "中" },
  large: { value: 180, label: "大" },
  xlarge: { value: 240, label: "特大" },
};

// Guide Editor Types
export interface GuidePreset {
  id: string;
  name: string;
  guides: Guide[];
}

// Default Presets (漫画原稿規格)
export const DEFAULT_GUIDE_PRESETS: GuidePreset[] = [
  {
    id: "b5-doujin",
    name: "B5 同人誌",
    guides: [
      { direction: "vertical", position: 60 },
      { direction: "vertical", position: 1740 },
      { direction: "horizontal", position: 60 },
      { direction: "horizontal", position: 2490 },
    ],
  },
  {
    id: "a4-commercial",
    name: "A4 商業誌",
    guides: [
      { direction: "vertical", position: 70 },
      { direction: "vertical", position: 2410 },
      { direction: "horizontal", position: 70 },
      { direction: "horizontal", position: 3438 },
    ],
  },
];
