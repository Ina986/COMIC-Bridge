import { Sidebar } from "./Sidebar";
import { MainView } from "./MainView";
import { DetailPanel } from "./DetailPanel";
import { GuideEditorModal } from "../guide-editor/GuideEditorModal";
import { useGuideStore } from "../../store/guideStore";

export function AppLayout() {
  const isEditorOpen = useGuideStore((state) => state.isEditorOpen);

  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden">
      {/* Sidebar - File Browser */}
      <Sidebar />

      {/* Main View - Preview Area */}
      <MainView />

      {/* Detail Panel - Metadata */}
      <DetailPanel />

      {/* Guide Editor Modal */}
      {isEditorOpen && <GuideEditorModal />}
    </div>
  );
}
