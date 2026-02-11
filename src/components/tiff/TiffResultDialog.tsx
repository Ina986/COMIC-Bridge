import { createPortal } from "react-dom";
import { useTiffStore } from "../../store/tiffStore";
import { invoke } from "@tauri-apps/api/core";

export function TiffResultDialog() {
  const showResultDialog = useTiffStore((state) => state.showResultDialog);
  const setShowResultDialog = useTiffStore((state) => state.setShowResultDialog);
  const results = useTiffStore((state) => state.results);
  const lastOutputDir = useTiffStore((state) => state.lastOutputDir);
  const processingDurationMs = useTiffStore((state) => state.processingDurationMs);

  if (!showResultDialog || results.length === 0) return null;

  const successCount = results.filter((r) => r.success).length;
  const errorCount = results.filter((r) => !r.success).length;
  const allSuccess = errorCount === 0;

  const durationStr = processingDurationMs
    ? processingDurationMs >= 60000
      ? `${Math.floor(processingDurationMs / 60000)}分${Math.round((processingDurationMs % 60000) / 1000)}秒`
      : `${Math.round(processingDurationMs / 1000)}秒`
    : null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) setShowResultDialog(false); }}
    >
      <div className="bg-bg-secondary border border-border rounded-2xl shadow-xl max-w-lg w-full mx-4 max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center gap-3">
          <div className={`
            w-10 h-10 rounded-xl flex items-center justify-center
            ${allSuccess
              ? "bg-success/10 text-success"
              : "bg-warning/10 text-warning"
            }
          `}>
            {allSuccess ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
          </div>
          <div>
            <h3 className="text-base font-display font-bold text-text-primary">TIFF化完了</h3>
            <p className="text-xs text-text-muted">
              {successCount}/{results.length} 成功
              {errorCount > 0 && <span className="text-error ml-1">({errorCount} エラー)</span>}
              {durationStr && <span className="ml-2">({durationStr})</span>}
            </p>
          </div>
          <div className="flex-1" />
          <button
            onClick={() => setShowResultDialog(false)}
            className="p-1.5 text-text-muted hover:text-text-primary rounded-lg hover:bg-bg-tertiary transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* File List */}
        <div className="flex-1 overflow-auto">
          <div className="divide-y divide-border/30">
            {results.map((result, i) => (
              <div key={i} className="flex items-center gap-2.5 px-6 py-2.5">
                {result.success ? (
                  <svg className="w-4 h-4 text-success flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-error flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary truncate">{result.fileName}</p>
                  {result.error && (
                    <p className="text-[10px] text-error truncate">{result.error}</p>
                  )}
                  {result.outputPath && (
                    <p className="text-[10px] text-text-muted truncate">{result.outputPath}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          {lastOutputDir && (
            <button
              onClick={async () => {
                try {
                  await invoke("open_folder_in_explorer", { folderPath: lastOutputDir });
                } catch { /* ignore */ }
              }}
              className="px-4 py-2 text-sm font-medium text-accent-warm bg-accent-warm/10 border border-accent-warm/30 rounded-xl hover:bg-accent-warm/20 transition-colors"
            >
              出力フォルダを開く
            </button>
          )}
          <button
            onClick={() => setShowResultDialog(false)}
            className="px-4 py-2 text-sm font-medium text-text-primary bg-bg-tertiary rounded-xl hover:bg-bg-tertiary/80 transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
