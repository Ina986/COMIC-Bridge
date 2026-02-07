import { useViewStore } from "../../store/viewStore";
import { FileView } from "../views/FileView";
import { SpecCheckView } from "../views/SpecCheckView";
import { LayerControlView } from "../views/LayerControlView";
import { SplitView } from "../views/SplitView";
import { ReplaceView } from "../views/ReplaceView";

export function ViewRouter() {
  const activeView = useViewStore((s) => s.activeView);

  return (
    <div className="flex-1 overflow-hidden bg-bg-primary relative">
      {activeView === "files" && <FileView />}
      {activeView === "specCheck" && <SpecCheckView />}
      {activeView === "layers" && <LayerControlView />}
      {activeView === "split" && <SplitView />}
      {activeView === "replace" && <ReplaceView />}
    </div>
  );
}
