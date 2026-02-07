import { create } from "zustand";
import type {
  ReplaceMode,
  TextSubMode,
  PairingMode,
  SubfolderMode,
  ProcessingPhase,
  ReplaceSettings,
  FolderSelection,
  PairingJob,
  ReplaceResult,
} from "../types/replace";

export interface BatchFolder {
  name: string;
  path: string;
}

interface ReplaceState {
  // フォルダ選択
  folders: FolderSelection;

  // バッチモード用サブフォルダ
  batchFolders: BatchFolder[];

  // 設定
  settings: ReplaceSettings;

  // モーダル状態
  isModalOpen: boolean;

  // ペアリング結果
  pairingJobs: PairingJob[];
  detectedLinkChar: string | null;

  // 処理状態
  phase: ProcessingPhase;
  progress: number;
  totalPairs: number;
  currentPair: string | null;
  results: ReplaceResult[];

  // Actions - フォルダ
  setSourceFolder: (path: string | null, files?: string[] | null) => void;
  setTargetFolder: (path: string | null, files?: string[] | null) => void;
  setBatchFolders: (folders: BatchFolder[]) => void;
  addBatchFolder: (folder: BatchFolder) => void;
  removeBatchFolder: (path: string) => void;
  setNamedBatchFolder: (name: string, path: string) => void;
  clearBatchFolders: () => void;

  // Actions - 設定
  setMode: (mode: ReplaceMode) => void;
  setTextSubMode: (subMode: TextSubMode) => void;
  setTextGroupName: (name: string) => void;
  setTextPartialMatch: (value: boolean) => void;
  setImageSettings: (
    settings: Partial<ReplaceSettings["imageSettings"]>
  ) => void;
  setPairingMode: (mode: PairingMode) => void;
  setLinkCharacter: (char: string) => void;
  setGeneralSettings: (
    settings: Partial<ReplaceSettings["generalSettings"]>
  ) => void;
  setSubfolderMode: (mode: SubfolderMode) => void;

  // Actions - モーダル
  openModal: () => void;
  closeModal: () => void;

  // Actions - ペアリング
  setPairingJobs: (jobs: PairingJob[]) => void;
  setDetectedLinkChar: (char: string | null) => void;

  // Actions - 処理
  setPhase: (phase: ProcessingPhase) => void;
  setProgress: (current: number, total: number) => void;
  setCurrentPair: (name: string | null) => void;
  addResult: (result: ReplaceResult) => void;
  clearResults: () => void;
  reset: () => void;
}

const defaultSettings: ReplaceSettings = {
  mode: "text",
  textSettings: {
    subMode: "textLayers",
    groupName: "text",
    partialMatch: false,
  },
  imageSettings: {
    replaceBackground: false,
    replaceSpecialLayer: false,
    specialLayerName: "白消し",
    specialLayerPartialMatch: true,
    replaceNamedGroup: false,
    namedGroupName: "棒消し",
    namedGroupPartialMatch: true,
    placeFromBottom: false,
  },
  pairingSettings: {
    mode: "fileOrder",
    linkCharacter: "",
  },
  generalSettings: {
    skipResize: false,
    roundFontSize: true,
    saveFileName: "target",
    outputFolderName: "",
  },
  subfolderSettings: {
    mode: "none",
  },
};

export const useReplaceStore = create<ReplaceState>((set) => ({
  folders: { sourceFolder: null, targetFolder: null, sourceFiles: null, targetFiles: null },
  batchFolders: [],
  settings: defaultSettings,
  isModalOpen: false,
  pairingJobs: [],
  detectedLinkChar: null,
  phase: "idle",
  progress: 0,
  totalPairs: 0,
  currentPair: null,
  results: [],

  // フォルダ
  setSourceFolder: (path, files) =>
    set((state) => ({ folders: { ...state.folders, sourceFolder: path, sourceFiles: files ?? null } })),
  setTargetFolder: (path, files) =>
    set((state) => ({ folders: { ...state.folders, targetFolder: path, targetFiles: files ?? null } })),
  setBatchFolders: (folders) => set({ batchFolders: folders }),
  addBatchFolder: (folder) =>
    set((state) => {
      // 同じパスの重複を防ぐ
      if (state.batchFolders.some((f) => f.path === folder.path)) return state;
      return { batchFolders: [...state.batchFolders, folder] };
    }),
  removeBatchFolder: (path) =>
    set((state) => ({
      batchFolders: state.batchFolders.filter((f) => f.path !== path),
    })),
  setNamedBatchFolder: (name, path) =>
    set((state) => {
      const filtered = state.batchFolders.filter((f) => f.name !== name);
      return { batchFolders: [...filtered, { name, path }] };
    }),
  clearBatchFolders: () => set({ batchFolders: [] }),

  // モード
  setMode: (mode) =>
    set((state) => ({
      settings: { ...state.settings, mode },
    })),

  // テキスト設定
  setTextSubMode: (subMode) =>
    set((state) => ({
      settings: {
        ...state.settings,
        textSettings: { ...state.settings.textSettings, subMode },
      },
    })),
  setTextGroupName: (name) =>
    set((state) => ({
      settings: {
        ...state.settings,
        textSettings: { ...state.settings.textSettings, groupName: name },
      },
    })),
  setTextPartialMatch: (value) =>
    set((state) => ({
      settings: {
        ...state.settings,
        textSettings: { ...state.settings.textSettings, partialMatch: value },
      },
    })),

  // 画像設定
  setImageSettings: (newSettings) =>
    set((state) => ({
      settings: {
        ...state.settings,
        imageSettings: { ...state.settings.imageSettings, ...newSettings },
      },
    })),

  // ペアリング設定
  setPairingMode: (mode) =>
    set((state) => ({
      settings: {
        ...state.settings,
        pairingSettings: { ...state.settings.pairingSettings, mode },
      },
    })),
  setLinkCharacter: (char) =>
    set((state) => ({
      settings: {
        ...state.settings,
        pairingSettings: {
          ...state.settings.pairingSettings,
          linkCharacter: char,
        },
      },
    })),

  // 全般設定
  setGeneralSettings: (newSettings) =>
    set((state) => ({
      settings: {
        ...state.settings,
        generalSettings: { ...state.settings.generalSettings, ...newSettings },
      },
    })),

  // サブフォルダ設定
  setSubfolderMode: (mode) =>
    set((state) => ({
      settings: {
        ...state.settings,
        subfolderSettings: { mode },
      },
    })),

  // モーダル
  openModal: () => set({ isModalOpen: true }),
  closeModal: () => set({ isModalOpen: false }),

  // ペアリング
  setPairingJobs: (jobs) => set({ pairingJobs: jobs }),
  setDetectedLinkChar: (char) => set({ detectedLinkChar: char }),

  // 処理
  setPhase: (phase) => set({ phase }),
  setProgress: (current, total) =>
    set({ progress: current, totalPairs: total }),
  setCurrentPair: (name) => set({ currentPair: name }),
  addResult: (result) =>
    set((state) => ({ results: [...state.results, result] })),
  clearResults: () => set({ results: [] }),
  reset: () =>
    set({
      phase: "idle",
      progress: 0,
      totalPairs: 0,
      currentPair: null,
      results: [],
      pairingJobs: [],
      detectedLinkChar: null,
    }),
}));
