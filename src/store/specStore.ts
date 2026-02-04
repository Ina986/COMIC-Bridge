import { create } from "zustand";
import type { Specification, SpecCheckResult } from "../types";

// Default specifications based on user requirements
const DEFAULT_SPECIFICATIONS: Specification[] = [
  {
    id: "mono-spec",
    name: "モノクロ原稿",
    enabled: true,
    rules: [
      {
        type: "colorMode",
        operator: "equals",
        value: "Grayscale",
        message: "カラーモードがグレースケールではありません",
      },
      {
        type: "dpi",
        operator: "equals",
        value: 600,
        message: "解像度が600dpiではありません",
      },
      {
        type: "bitsPerChannel",
        operator: "equals",
        value: 8,
        message: "ビット深度が8bitではありません",
      },
    ],
  },
  {
    id: "color-spec",
    name: "カラー原稿",
    enabled: true,
    rules: [
      {
        type: "colorMode",
        operator: "equals",
        value: "RGB",
        message: "カラーモードがRGBではありません",
      },
      {
        type: "dpi",
        operator: "equals",
        value: 350,
        message: "解像度が350dpiではありません",
      },
      {
        type: "bitsPerChannel",
        operator: "equals",
        value: 8,
        message: "ビット深度が8bitではありません",
      },
    ],
  },
];

interface SpecStore {
  specifications: Specification[];
  checkResults: Map<string, SpecCheckResult>;
  activeSpecId: string | null;

  // Actions
  setSpecifications: (specs: Specification[]) => void;
  addSpecification: (spec: Specification) => void;
  updateSpecification: (id: string, updates: Partial<Specification>) => void;
  removeSpecification: (id: string) => void;
  toggleSpecification: (id: string) => void;
  setActiveSpec: (id: string | null) => void;

  // Check results
  setCheckResult: (fileId: string, result: SpecCheckResult) => void;
  clearCheckResults: () => void;
  getCheckResult: (fileId: string) => SpecCheckResult | undefined;
}

export const useSpecStore = create<SpecStore>((set, get) => ({
  specifications: DEFAULT_SPECIFICATIONS,
  checkResults: new Map(),
  activeSpecId: null,

  setSpecifications: (specifications) => set({ specifications }),

  addSpecification: (spec) =>
    set((state) => ({
      specifications: [...state.specifications, spec],
    })),

  updateSpecification: (id, updates) =>
    set((state) => ({
      specifications: state.specifications.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    })),

  removeSpecification: (id) =>
    set((state) => ({
      specifications: state.specifications.filter((s) => s.id !== id),
      activeSpecId: state.activeSpecId === id ? null : state.activeSpecId,
    })),

  toggleSpecification: (id) =>
    set((state) => ({
      specifications: state.specifications.map((s) =>
        s.id === id ? { ...s, enabled: !s.enabled } : s
      ),
    })),

  setActiveSpec: (activeSpecId) => set({ activeSpecId }),

  setCheckResult: (fileId, result) =>
    set((state) => {
      const newResults = new Map(state.checkResults);
      newResults.set(fileId, result);
      return { checkResults: newResults };
    }),

  clearCheckResults: () => set({ checkResults: new Map() }),

  getCheckResult: (fileId) => get().checkResults.get(fileId),
}));
