import { CompactFileList } from "../common/CompactFileList";
import { LayerControlPanel } from "../layer-control/LayerControlPanel";
import { LayerPreviewPanel } from "../layer-control/LayerPreviewPanel";
import { usePsdStore } from "../../store/psdStore";
import { DropZone } from "../file-browser/DropZone";
import { useOpenInPhotoshop } from "../../hooks/useOpenInPhotoshop";

export function LayerControlView() {
  const files = usePsdStore((state) => state.files);
  const hasFiles = files.length > 0;
  const { openFileInPhotoshop } = useOpenInPhotoshop();

  if (!hasFiles) {
    return <DropZone />;
  }

  return (
    <div className="flex h-full overflow-hidden" data-tool-panel>
      {/* File List */}
      <CompactFileList className="w-52 flex-shrink-0 border-r border-border" />

      {/* Settings */}
      <div className="w-[360px] flex-shrink-0 border-r border-border overflow-hidden">
        <LayerControlPanel />
      </div>

      {/* Layer Preview */}
      <div className="flex-1 overflow-hidden">
        <LayerPreviewPanel onOpenInPhotoshop={openFileInPhotoshop} />
      </div>
    </div>
  );
}
