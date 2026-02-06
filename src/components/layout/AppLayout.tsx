import { useCallback } from "react";
import { Sidebar } from "./Sidebar";
import { MainView } from "./MainView";
import { DetailPanel } from "./DetailPanel";
import { GuideEditorModal } from "../guide-editor/GuideEditorModal";
import { SpecSelectionModal } from "../spec-checker/SpecSelectionModal";
import { ConversionToast } from "../spec-checker/ConversionToast";
import { usePsdStore } from "../../store/psdStore";
import { useGuideStore } from "../../store/guideStore";
import { useSpecChecker } from "../../hooks/useSpecChecker";

export function AppLayout() {
  const isEditorOpen = useGuideStore((state) => state.isEditorOpen);
  const clearSelection = usePsdStore((state) => state.clearSelection);

  // 自動チェック機能を有効化（useEffectが発火するようにする）
  useSpecChecker();

  // サムネ領域外クリックで複数選択を解除
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // サムネグリッド内のクリックは無視
      if ((e.target as HTMLElement).closest("[data-preview-grid]")) return;
      // サイドバー・詳細パネル内のクリックは無視
      if ((e.target as HTMLElement).closest("[data-sidebar], [data-detail-panel]")) return;
      // ボタンやインタラクティブ要素のクリックは無視
      if ((e.target as HTMLElement).closest("button, a, input, select, textarea, label")) return;
      clearSelection();
    },
    [clearSelection]
  );

  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden" onMouseDown={handleMouseDown}>
      {/* 背景のトーンパターン */}
      <div className="fixed inset-0 bg-tone pointer-events-none" />

      {/* Sidebar - File Browser */}
      <Sidebar />

      {/* Main View - Preview Area */}
      <MainView />

      {/* Detail Panel - Metadata */}
      <DetailPanel />

      {/* Guide Editor Modal */}
      {isEditorOpen && <GuideEditorModal />}

      {/* Spec Selection Modal */}
      <SpecSelectionModal />

      {/* Photoshop変換完了トースト */}
      <ConversionToast />
    </div>
  );
}
