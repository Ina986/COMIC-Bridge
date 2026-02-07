import { useCallback } from "react";
import { TopNav } from "./TopNav";
import { ViewRouter } from "./ViewRouter";
import { GuideEditorModal } from "../guide-editor/GuideEditorModal";
import { SpecSelectionModal } from "../spec-checker/SpecSelectionModal";
import { ConversionToast } from "../spec-checker/ConversionToast";
import { usePsdStore } from "../../store/psdStore";
import { useGuideStore } from "../../store/guideStore";
import { useSpecChecker } from "../../hooks/useSpecChecker";

export function AppLayout() {
  const isEditorOpen = useGuideStore((state) => state.isEditorOpen);
  const clearSelection = usePsdStore((state) => state.clearSelection);

  // 自動チェック機能を有効化
  useSpecChecker();

  // サムネ領域外クリックで複数選択を解除
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest("[data-preview-grid]")) return;
      if ((e.target as HTMLElement).closest("[data-sidebar], [data-detail-panel]")) return;
      if ((e.target as HTMLElement).closest("[data-tool-panel]")) return;
      if ((e.target as HTMLElement).closest("button, a, input, select, textarea, label")) return;
      clearSelection();
    },
    [clearSelection]
  );

  return (
    <div className="flex flex-col h-screen bg-bg-primary overflow-hidden" onMouseDown={handleMouseDown}>
      {/* 背景のトーンパターン */}
      <div className="fixed inset-0 bg-tone pointer-events-none" />

      {/* Top Navigation */}
      <TopNav />

      {/* View Content */}
      <ViewRouter />

      {/* Guide Editor Modal */}
      {isEditorOpen && <GuideEditorModal />}

      {/* Spec Selection Modal */}
      <SpecSelectionModal />

      {/* Photoshop変換完了トースト */}
      <ConversionToast />
    </div>
  );
}
