import { create } from "zustand";

export type SplitMode = "even" | "uneven" | "none";
export type OutputFormat = "psd" | "jpg";

export interface SplitSettings {
  mode: SplitMode;
  outputFormat: OutputFormat;
  jpgQuality: number;
  leftMargin: number;
  rightMargin: number;
  outputDirectory: string | null;
}

export interface SplitResult {
  fileName: string;
  success: boolean;
  outputFiles: string[];
  error?: string;
}

interface SplitState {
  settings: SplitSettings;
  isProcessing: boolean;
  progress: number;
  totalFiles: number;
  currentFile: string | null;
  results: SplitResult[];

  // Actions
  setSettings: (settings: Partial<SplitSettings>) => void;
  setIsProcessing: (value: boolean) => void;
  setProgress: (current: number, total: number) => void;
  setCurrentFile: (fileName: string | null) => void;
  addResult: (result: SplitResult) => void;
  clearResults: () => void;
  reset: () => void;
}

const defaultSettings: SplitSettings = {
  mode: "even",
  outputFormat: "psd",
  jpgQuality: 95,
  leftMargin: 0,
  rightMargin: 0,
  outputDirectory: null,
};

export const useSplitStore = create<SplitState>((set) => ({
  settings: defaultSettings,
  isProcessing: false,
  progress: 0,
  totalFiles: 0,
  currentFile: null,
  results: [],

  setSettings: (newSettings) =>
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    })),

  setIsProcessing: (value) => set({ isProcessing: value }),

  setProgress: (current, total) =>
    set({ progress: current, totalFiles: total }),

  setCurrentFile: (fileName) => set({ currentFile: fileName }),

  addResult: (result) =>
    set((state) => ({
      results: [...state.results, result],
    })),

  clearResults: () => set({ results: [] }),

  reset: () =>
    set({
      isProcessing: false,
      progress: 0,
      totalFiles: 0,
      currentFile: null,
      results: [],
    }),
}));
