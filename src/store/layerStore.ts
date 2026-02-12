import { create } from "zustand";

// 操作モード
export type LayerActionMode = "hide" | "show";

// レイヤー非表示条件の型
export interface HideCondition {
  id: string;
  name: string;
  type: "textLayers" | "textFolder" | "layerName" | "folderName" | "custom";
  value?: string; // layerName, folderName, custom の場合の検索文字列
  partialMatch?: boolean; // 部分一致
  caseSensitive?: boolean; // 大文字小文字を区別
}

// プリセット条件
export const PRESET_CONDITIONS: HideCondition[] = [
  {
    id: "text-layers",
    name: "テキストレイヤー全て",
    type: "textLayers",
  },
  {
    id: "text-folder",
    name: "「Text」「写植」「セリフ」フォルダ",
    type: "textFolder",
  },
  {
    id: "kihonwaku",
    name: "「基本枠」レイヤー",
    type: "layerName",
    value: "基本枠",
    partialMatch: false,
  },
  {
    id: "shirokesu",
    name: "「白消し」レイヤー",
    type: "layerName",
    value: "白消し",
    partialMatch: true,
  },
];

// 処理結果（ファイルごと）
export interface LayerControlResult {
  fileName: string;
  success: boolean;
  changedCount: number;
  changes: string[]; // 個別マッチ詳細含む
  error?: string;
}

// 保存モード
export type LayerSaveMode = "overwrite" | "copyToFolder";

interface LayerVisibilityState {
  // ファイルごとの変更されたレイヤー可視性を追跡
  // Map<fileId, Map<layerPath, visible>>
  pendingChanges: Map<string, Map<string, boolean>>;

  // 操作モード（非表示/表示）
  actionMode: LayerActionMode;

  // 保存モード（上書き/別フォルダ）
  saveMode: LayerSaveMode;

  // 選択中の非表示条件
  selectedConditions: string[];

  // カスタム条件
  customConditions: HideCondition[];

  // 処理中フラグ
  isProcessing: boolean;

  // 処理結果
  lastResults: LayerControlResult[];
  lastActionMode: LayerActionMode | null;

  // アクション
  setLayerVisibility: (fileId: string, layerPath: string, visible: boolean) => void;
  clearPendingChanges: (fileId?: string) => void;
  setActionMode: (mode: LayerActionMode) => void;
  setSaveMode: (mode: LayerSaveMode) => void;
  toggleCondition: (conditionId: string) => void;
  addCustomCondition: (condition: Omit<HideCondition, "id">) => void;
  removeCustomCondition: (id: string) => void;
  setIsProcessing: (processing: boolean) => void;
  getSelectedConditions: () => HideCondition[];
  setLastResults: (results: LayerControlResult[], mode: LayerActionMode) => void;
  clearLastResults: () => void;
}

export const useLayerStore = create<LayerVisibilityState>((set, get) => ({
  pendingChanges: new Map(),
  actionMode: "hide",
  saveMode: "overwrite",
  selectedConditions: [],
  customConditions: [],
  isProcessing: false,
  lastResults: [],
  lastActionMode: null,

  setLayerVisibility: (fileId, layerPath, visible) => {
    set((state) => {
      const newPendingChanges = new Map(state.pendingChanges);
      const fileChanges = newPendingChanges.get(fileId) || new Map();
      fileChanges.set(layerPath, visible);
      newPendingChanges.set(fileId, fileChanges);
      return { pendingChanges: newPendingChanges };
    });
  },

  clearPendingChanges: (fileId) => {
    set((state) => {
      if (fileId) {
        const newPendingChanges = new Map(state.pendingChanges);
        newPendingChanges.delete(fileId);
        return { pendingChanges: newPendingChanges };
      }
      return { pendingChanges: new Map() };
    });
  },

  setActionMode: (mode) => {
    set({ actionMode: mode });
  },

  setSaveMode: (mode) => {
    set({ saveMode: mode });
  },

  toggleCondition: (conditionId) => {
    set((state) => {
      const newSelected = state.selectedConditions.includes(conditionId)
        ? state.selectedConditions.filter((id) => id !== conditionId)
        : [...state.selectedConditions, conditionId];
      return { selectedConditions: newSelected };
    });
  },

  addCustomCondition: (condition) => {
    const id = `custom-${Date.now()}`;
    set((state) => ({
      customConditions: [...state.customConditions, { ...condition, id }],
    }));
  },

  removeCustomCondition: (id) => {
    set((state) => ({
      customConditions: state.customConditions.filter((c) => c.id !== id),
      selectedConditions: state.selectedConditions.filter((cid) => cid !== id),
    }));
  },

  setIsProcessing: (processing) => {
    set({ isProcessing: processing });
  },

  getSelectedConditions: () => {
    const state = get();
    const allConditions = [...PRESET_CONDITIONS, ...state.customConditions];
    return allConditions.filter((c) => state.selectedConditions.includes(c.id));
  },

  setLastResults: (results, mode) => {
    set({ lastResults: results, lastActionMode: mode });
  },
  clearLastResults: () => {
    set({ lastResults: [], lastActionMode: null });
  },
}));
