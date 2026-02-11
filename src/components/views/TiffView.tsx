import { CompactFileList } from "../common/CompactFileList";
import { TiffSettingsPanel } from "../tiff/TiffSettingsPanel";
import { TiffCropSidePanel } from "../tiff/TiffCropSidePanel";
import { TiffBatchQueue } from "../tiff/TiffBatchQueue";
import { TiffCropEditor } from "../tiff/TiffCropEditor";
import { usePsdStore } from "../../store/psdStore";
import { useTiffStore } from "../../store/tiffStore";
import { DropZone } from "../file-browser/DropZone";

export function TiffView() {
  const files = usePsdStore((state) => state.files);
  const hasFiles = files.length > 0;
  const phase = useTiffStore((state) => state.phase);

  if (!hasFiles) {
    return <DropZone />;
  }

  return (
    <div className="flex h-full overflow-hidden" data-tool-panel>
      {/* File List */}
      <CompactFileList className="w-52 flex-shrink-0 border-r border-border" />

      {/* Center Area */}
      <div className="flex-1 overflow-hidden">
        {phase === "cropSelection" ? (
          <TiffCropEditor />
        ) : (
          <TiffBatchQueue />
        )}
      </div>

      {/* Right Sidebar — phase に応じて切替 */}
      <div className="w-[360px] flex-shrink-0 border-l border-border overflow-hidden">
        {phase === "cropSelection" ? (
          <TiffCropSidePanel />
        ) : (
          <TiffSettingsPanel />
        )}
      </div>
    </div>
  );
}
