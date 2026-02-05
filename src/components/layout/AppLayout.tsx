import { Sidebar } from "./Sidebar";
import { MainView } from "./MainView";
import { DetailPanel } from "./DetailPanel";
import { GuideEditorModal } from "../guide-editor/GuideEditorModal";
import { SpecSelectionModal } from "../spec-checker/SpecSelectionModal";
import { useGuideStore } from "../../store/guideStore";
import { useSpecChecker } from "../../hooks/useSpecChecker";

export function AppLayout() {
  const isEditorOpen = useGuideStore((state) => state.isEditorOpen);

  // 自動チェック機能を有効化（useEffectが発火するようにする）
  useSpecChecker();

  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden">
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
    </div>
  );
}
