import { useState } from "react";
import { useGuideStore } from "../../store/guideStore";
import { usePsdStore } from "../../store/psdStore";
import { GuideCanvas } from "./GuideCanvas";
import { GuideList } from "./GuideList";
import { GuidePresets } from "./GuidePresets";
import { useBatchProcessor } from "../../hooks/useBatchProcessor";

export function GuideEditorModal() {
  const closeEditor = useGuideStore((state) => state.closeEditor);
  const guides = useGuideStore((state) => state.guides);
  const clearGuides = useGuideStore((state) => state.clearGuides);
  const undo = useGuideStore((state) => state.undo);
  const redo = useGuideStore((state) => state.redo);
  const history = useGuideStore((state) => state.history);
  const future = useGuideStore((state) => state.future);

  const files = usePsdStore((state) => state.files);
  const selectedFileIds = usePsdStore((state) => state.selectedFileIds);
  const activeFile = usePsdStore((state) => state.getActiveFile());

  const { processFiles, isProcessing, progress } = useBatchProcessor();

  const [applyTarget, setApplyTarget] = useState<"selected" | "all">("all");

  const handleApply = async () => {
    const targetFileIds =
      applyTarget === "selected" && selectedFileIds.length > 0
        ? selectedFileIds
        : files.map((f) => f.id);

    await processFiles(targetFileIds, guides);
  };

  const handleClose = () => {
    closeEditor();
  };

  // Use first file's dimensions for canvas if no active file
  const canvasSize = activeFile?.metadata
    ? { width: activeFile.metadata.width, height: activeFile.metadata.height }
    : files[0]?.metadata
    ? { width: files[0].metadata.width, height: files[0].metadata.height }
    : { width: 1920, height: 2716 }; // Default B5 at 350dpi

  const imageData = activeFile?.thumbnailUrl || files[0]?.thumbnailUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-bg-secondary rounded-lg shadow-2xl w-[95vw] max-w-6xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-text-muted/10">
          <h2 className="text-lg font-medium text-text-primary">ガイド編集</h2>
          <div className="flex items-center gap-2">
            {/* Undo/Redo */}
            <button
              className="p-2 rounded hover:bg-bg-tertiary disabled:opacity-30"
              onClick={undo}
              disabled={history.length === 0}
              title="元に戻す"
            >
              <svg className="w-4 h-4 text-text-secondary" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              className="p-2 rounded hover:bg-bg-tertiary disabled:opacity-30"
              onClick={redo}
              disabled={future.length === 0}
              title="やり直す"
            >
              <svg className="w-4 h-4 text-text-secondary" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12.293 3.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 9H9a5 5 0 00-5 5v2a1 1 0 11-2 0v-2a7 7 0 017-7h5.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              className="p-2 rounded hover:bg-bg-tertiary"
              onClick={handleClose}
              title="閉じる"
            >
              <svg className="w-5 h-5 text-text-secondary" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Canvas Area */}
          <div className="flex-1 p-4 overflow-hidden">
            <GuideCanvas imageData={imageData} imageSize={canvasSize} />
          </div>

          {/* Right Panel */}
          <div className="w-72 border-l border-text-muted/10 flex flex-col">
            {/* Presets */}
            <div className="p-4 border-b border-text-muted/10">
              <GuidePresets />
            </div>

            {/* Guide List */}
            <div className="flex-1 overflow-auto p-4">
              <GuideList />
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-text-muted/10 space-y-3">
              <button
                className="w-full btn btn-secondary text-sm"
                onClick={clearGuides}
                disabled={guides.length === 0}
              >
                すべてクリア
              </button>

              {/* Apply Target */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-text-muted">適用先:</span>
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    name="applyTarget"
                    checked={applyTarget === "all"}
                    onChange={() => setApplyTarget("all")}
                    className="accent-accent"
                  />
                  <span className="text-text-secondary">全ファイル ({files.length})</span>
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    name="applyTarget"
                    checked={applyTarget === "selected"}
                    onChange={() => setApplyTarget("selected")}
                    className="accent-accent"
                    disabled={selectedFileIds.length === 0}
                  />
                  <span className="text-text-secondary">
                    選択中 ({selectedFileIds.length})
                  </span>
                </label>
              </div>

              <button
                className="w-full btn btn-primary"
                onClick={handleApply}
                disabled={guides.length === 0 || isProcessing}
              >
                {isProcessing
                  ? `適用中... (${progress.current}/${progress.total})`
                  : "適用する"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
