import { create } from "zustand";

export type AppView =
  | "specCheck"
  | "layers"
  | "split"
  | "replace"
  | "rename"
  | "tiff"
  | "scanPsd"
  | "typesetting";

interface ViewState {
  activeView: AppView;
  isDetailPanelOpen: boolean;
  // フォント帳サブタブ表示中はファイルD&Dを「画像追加」として扱うため、
  // グローバルD&D(PSD読込)は譲る。フォント帳ビューがマウント中だけ true。
  fontBookDropActive: boolean;
  // 簡易スキャンのダイアログ表示中だけ true（D&Dを「PSD追加」としてダイアログ側が処理）。
  simpleScanDropActive: boolean;

  setActiveView: (view: AppView) => void;
  setDetailPanelOpen: (open: boolean) => void;
  toggleDetailPanel: () => void;
  setFontBookDropActive: (active: boolean) => void;
  setSimpleScanDropActive: (active: boolean) => void;
}

export const useViewStore = create<ViewState>((set) => ({
  activeView: "specCheck",
  isDetailPanelOpen: false,
  fontBookDropActive: false,
  simpleScanDropActive: false,

  setActiveView: (activeView) => set({ activeView }),
  setDetailPanelOpen: (isDetailPanelOpen) => set({ isDetailPanelOpen }),
  toggleDetailPanel: () => set((state) => ({ isDetailPanelOpen: !state.isDetailPanelOpen })),
  setFontBookDropActive: (fontBookDropActive) => set({ fontBookDropActive }),
  setSimpleScanDropActive: (simpleScanDropActive) => set({ simpleScanDropActive }),
}));
