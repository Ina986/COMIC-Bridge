import { usePsdStore } from "../../store/psdStore";
import { useSpecStore } from "../../store/specStore";

export function CompactFileList({ className = "" }: { className?: string }) {
  const files = usePsdStore((state) => state.files);
  const selectedFileIds = usePsdStore((state) => state.selectedFileIds);
  const activeFileId = usePsdStore((state) => state.activeFileId);
  const selectFile = usePsdStore((state) => state.selectFile);
  const selectRange = usePsdStore((state) => state.selectRange);
  const selectAll = usePsdStore((state) => state.selectAll);
  const clearSelection = usePsdStore((state) => state.clearSelection);
  const checkResults = useSpecStore((state) => state.checkResults);

  const handleClick = (fileId: string, e: React.MouseEvent) => {
    if (e.shiftKey) {
      selectRange(fileId);
    } else if (e.ctrlKey || e.metaKey) {
      selectFile(fileId, true);
    } else {
      selectFile(fileId);
    }
  };

  return (
    <div className={`flex flex-col bg-bg-secondary ${className}`}>
      {/* Header */}
      <div className="px-3 py-2 border-b border-border flex items-center justify-between flex-shrink-0">
        <span className="text-xs font-medium text-text-muted">
          {files.length} ファイル
        </span>
        <div className="flex items-center gap-2">
          <button
            className="text-[10px] text-text-muted hover:text-accent transition-colors"
            onClick={selectAll}
          >
            全選択
          </button>
          {selectedFileIds.length > 0 && (
            <button
              className="text-[10px] text-text-muted hover:text-accent transition-colors"
              onClick={clearSelection}
            >
              解除
            </button>
          )}
        </div>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-auto">
        {files.map((file) => {
          const isSelected = selectedFileIds.includes(file.id);
          const isActive = activeFileId === file.id;
          const checkResult = checkResults.get(file.id);
          const hasError = checkResult && !checkResult.passed;

          return (
            <div
              key={file.id}
              className={`
                flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors
                border-b border-border/30 text-xs
                ${isActive
                  ? "bg-accent/15"
                  : isSelected
                    ? "bg-accent/8"
                    : "hover:bg-bg-tertiary/50"
                }
              `}
              onClick={(e) => handleClick(file.id, e)}
            >
              {/* Selection indicator */}
              <div
                className={`w-3 h-3 rounded flex items-center justify-center flex-shrink-0
                  ${isSelected
                    ? "bg-gradient-to-br from-accent to-accent-secondary"
                    : "border border-text-muted/30"
                  }
                `}
              >
                {isSelected && (
                  <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>

              {/* Status dot */}
              {checkResult && (
                <span
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    checkResult.passed ? "bg-success" : "bg-error"
                  }`}
                />
              )}

              {/* Filename */}
              <span
                className={`truncate ${hasError ? "text-error/80" : "text-text-primary"}`}
                title={file.fileName}
              >
                {file.fileName}
              </span>
            </div>
          );
        })}

        {files.length === 0 && (
          <div className="flex items-center justify-center h-24 text-text-muted text-xs">
            ファイルなし
          </div>
        )}
      </div>

      {/* Footer */}
      {selectedFileIds.length > 0 && (
        <div className="px-3 py-1.5 border-t border-border flex-shrink-0">
          <span className="text-[10px] text-accent font-medium">
            {selectedFileIds.length} 件選択中
          </span>
        </div>
      )}
    </div>
  );
}
