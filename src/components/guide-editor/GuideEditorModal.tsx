import { useState, useEffect, useRef } from "react";
import { useGuideStore } from "../../store/guideStore";
import { usePsdStore } from "../../store/psdStore";
import { GuideCanvas } from "./GuideCanvas";
import { GuideList } from "./GuideList";
import { useBatchProcessor } from "../../hooks/useBatchProcessor";
import { useHighResPreview } from "../../hooks/useHighResPreview";

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

  const { processFiles, isProcessing, progress, tasks, reset } = useBatchProcessor();

  const [applyTarget, setApplyTarget] = useState<"selected" | "all">("all");

  // Toast notification state
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
    detail?: string;
  } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevIsProcessingRef = useRef(isProcessing);

  // Get high-resolution preview for the active file
  const activeFilePath = activeFile?.filePath || files[0]?.filePath;
  const { imageUrl: highResImageUrl, originalSize, isLoading: isPreviewLoading } = useHighResPreview(
    activeFilePath,
    { maxSize: 1200 }
  );

  // Result summary
  const successCount = tasks.filter((t) => t.status === "success").length;
  const errorCount = tasks.filter((t) => t.status === "error").length;
  const isDone = !isProcessing && tasks.length > 0;
  const hasErrors = errorCount > 0;
  const errorTasks = tasks.filter((t) => t.status === "error");

  // Show toast when processing completes
  useEffect(() => {
    if (prevIsProcessingRef.current && !isProcessing && tasks.length > 0) {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);

      if (hasErrors) {
        setToast({
          type: "error",
          message: `${successCount}/${tasks.length} 件成功 / ${errorCount} 件エラー`,
          detail: errorTasks.map((t) => `${t.fileName}: ${t.error}`).join("\n"),
        });
      } else {
        setToast({
          type: "success",
          message: `${successCount} 件すべて適用完了`,
        });
      }

      toastTimerRef.current = setTimeout(() => setToast(null), 6000);
    }
    prevIsProcessingRef.current = isProcessing;
  }, [isProcessing, tasks, hasErrors, successCount, errorCount, errorTasks]);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const handleApply = async () => {
    reset();
    setToast(null);
    const targetFileIds =
      applyTarget === "selected" && selectedFileIds.length > 0
        ? selectedFileIds
        : files.map((f) => f.id);

    await processFiles(targetFileIds, guides);
  };

  const handleClose = () => {
    closeEditor();
  };

  // Use original size from high-res preview, or fall back to metadata
  const canvasSize = originalSize
    ? { width: originalSize.width, height: originalSize.height }
    : activeFile?.metadata
    ? { width: activeFile.metadata.width, height: activeFile.metadata.height }
    : files[0]?.metadata
    ? { width: files[0].metadata.width, height: files[0].metadata.height }
    : { width: 1920, height: 2716 }; // Default B5 at 350dpi

  const imageUrl = highResImageUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-bg-secondary rounded-lg shadow-2xl w-[95vw] max-w-6xl h-[90vh] flex flex-col overflow-hidden relative">
        {/* Toast Notification */}
        {toast && (
          <div
            className={`absolute top-4 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-xl shadow-elevated border flex items-center gap-3 ${
              toast.type === "success"
                ? "bg-white border-success/30"
                : "bg-white border-error/30"
            }`}
            style={{
              animation: "toast-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
              minWidth: "280px",
              maxWidth: "600px",
            }}
          >
            {/* Icon */}
            {toast.type === "success" ? (
              <div
                className="w-8 h-8 rounded-full bg-success/15 flex items-center justify-center flex-shrink-0"
                style={{ animation: "check-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s both" }}
              >
                <svg className="w-5 h-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                    style={{
                      strokeDasharray: 24,
                      strokeDashoffset: 24,
                      animation: "check-draw 0.4s ease-out 0.3s forwards",
                    }}
                  />
                </svg>
              </div>
            ) : (
              <div
                className="w-8 h-8 rounded-full bg-error/15 flex items-center justify-center flex-shrink-0"
                style={{ animation: "shake 0.5s ease-in-out 0.15s" }}
              >
                <svg className="w-5 h-5 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
            )}

            {/* Message */}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${toast.type === "success" ? "text-success" : "text-error"}`}>
                {toast.message}
              </p>
              {toast.detail && (
                <p className="text-xs text-text-muted mt-0.5 break-words">
                  {toast.detail}
                </p>
              )}
            </div>

            {/* Close */}
            <button
              className="flex-shrink-0 p-1 rounded-lg hover:bg-bg-tertiary transition-colors"
              onClick={() => setToast(null)}
            >
              <svg className="w-3.5 h-3.5 text-text-muted" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>

            {/* Progress bar (auto-dismiss) */}
            <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-xl overflow-hidden">
              <div
                className={`h-full ${toast.type === "success" ? "bg-success/40" : "bg-error/40"}`}
                style={{
                  animation: "toast-progress 6s linear forwards",
                }}
              />
            </div>
          </div>
        )}

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
            <GuideCanvas
              imageUrl={imageUrl ?? undefined}
              imageSize={canvasSize}
              isLoading={isPreviewLoading}
            />
          </div>

          {/* Right Panel */}
          <div className="w-72 border-l border-text-muted/10 flex flex-col">
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

              {/* Result summary (kept in sidebar for reference) */}
              {isDone && (
                <div
                  className={`rounded-xl px-3 py-2 text-sm ${
                    hasErrors
                      ? "bg-error/10 border border-error/20"
                      : "bg-success/10 border border-success/20"
                  }`}
                >
                  {hasErrors ? (
                    <>
                      <p className="text-error font-medium">
                        {successCount}/{tasks.length} 件成功 / {errorCount} 件エラー
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {errorTasks.map((t) => (
                          <li key={t.fileId} className="text-error/70 text-xs truncate">
                            {t.fileName}: {t.error}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="text-success font-medium">
                      {successCount} 件すべて適用完了
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Toast animations */}
      <style>{`
        @keyframes toast-in {
          0% { transform: translateX(-50%) translateY(-20px); opacity: 0; }
          100% { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
        @keyframes check-pop {
          0% { transform: scale(0); }
          100% { transform: scale(1); }
        }
        @keyframes check-draw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-4px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(2px); }
        }
        @keyframes toast-progress {
          0% { width: 100%; }
          100% { width: 0%; }
        }
      `}</style>
    </div>
  );
}
