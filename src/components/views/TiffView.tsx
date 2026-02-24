import { useState } from "react";
import { TiffSettingsPanel } from "../tiff/TiffSettingsPanel";
import { TiffBatchQueue } from "../tiff/TiffBatchQueue";
import { TiffCropEditor } from "../tiff/TiffCropEditor";
import { usePsdStore } from "../../store/psdStore";
import { DropZone } from "../file-browser/DropZone";

export function TiffView() {
  const files = usePsdStore((state) => state.files);
  const selectedFileIds = usePsdStore((state) => state.selectedFileIds);
  const hasFiles = files.length > 0;
  const [centerView, setCenterView] = useState<"preview" | "queue">("preview");

  if (!hasFiles) {
    return <DropZone />;
  }

  return (
    <div className="flex h-full overflow-hidden" data-tool-panel>
      {/* Left Sidebar */}
      <div className="w-[440px] flex-shrink-0 border-r border-border overflow-hidden">
        <TiffSettingsPanel />
      </div>

      {/* Center Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* View toggle */}
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border/50 bg-bg-primary flex-shrink-0">
          <button
            onClick={() => setCenterView("preview")}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${
              centerView === "preview"
                ? "bg-accent-warm/10 text-accent-warm"
                : "text-text-muted hover:text-text-secondary hover:bg-bg-tertiary/50"
            }`}
          >
            プレビュー
          </button>
          <button
            onClick={() => setCenterView("queue")}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${
              centerView === "queue"
                ? "bg-accent-warm/10 text-accent-warm"
                : "text-text-muted hover:text-text-secondary hover:bg-bg-tertiary/50"
            }`}
          >
            一覧
          </button>
          <div className="flex-1" />
          {selectedFileIds.length > 0 && (
            <span className="text-[10px] text-accent font-medium">{selectedFileIds.length}件選択中</span>
          )}
        </div>

        <div className="flex-1 overflow-hidden">
          {centerView === "preview" ? <TiffCropEditor /> : <TiffBatchQueue />}
        </div>
      </div>
    </div>
  );
}
