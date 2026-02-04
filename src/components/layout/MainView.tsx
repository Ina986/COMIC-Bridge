import { usePsdStore } from "../../store/psdStore";
import { useGuideStore } from "../../store/guideStore";
import { PreviewGrid } from "../preview/PreviewGrid";
import { Toolbar } from "./Toolbar";
import { DropZone } from "../file-browser/DropZone";

export function MainView() {
  const files = usePsdStore((state) => state.files);
  const selectedFileIds = usePsdStore((state) => state.selectedFileIds);
  const openEditor = useGuideStore((state) => state.openEditor);

  const hasFiles = files.length > 0;

  return (
    <main className="flex-1 flex flex-col overflow-hidden bg-bg-primary">
      {/* Toolbar */}
      <Toolbar />

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {hasFiles ? (
          <PreviewGrid />
        ) : (
          <DropZone />
        )}
      </div>

      {/* Bottom Action Bar */}
      {hasFiles && (
        <div className="px-4 py-3 bg-bg-secondary border-t border-text-muted/10 flex items-center justify-between">
          <div className="text-sm text-text-secondary">
            {files.length} ファイル
            {selectedFileIds.length > 0 && (
              <span className="ml-2">
                ({selectedFileIds.length} 件選択中)
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              className="btn btn-secondary text-sm"
              onClick={openEditor}
              disabled={files.length === 0}
            >
              ガイド編集
            </button>
            <button
              className="btn btn-primary text-sm"
              disabled={selectedFileIds.length === 0}
            >
              すべてに適用
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
