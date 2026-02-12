import { useViewStore } from "../../store/viewStore";
import { SpecCheckView } from "../views/SpecCheckView";
import { ViewerView } from "../views/ViewerView";
import { LayerControlView } from "../views/LayerControlView";
import { SplitView } from "../views/SplitView";
import { ReplaceView } from "../views/ReplaceView";
import { RenameView } from "../views/RenameView";
import { TiffView } from "../views/TiffView";

export function ViewRouter() {
  const activeView = useViewStore((s) => s.activeView);

  return (
    <div className="flex-1 overflow-hidden bg-bg-primary relative">
      {activeView === "specCheck" && <SpecCheckView />}
      {activeView === "viewer" && <ViewerView />}
      {activeView === "layers" && <LayerControlView />}
      {activeView === "split" && <SplitView />}
      {activeView === "replace" && <ReplaceView />}
      {activeView === "rename" && <RenameView />}
      {activeView === "tiff" && <TiffView />}
    </div>
  );
}
