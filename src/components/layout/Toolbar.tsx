import { usePsdStore } from "../../store/psdStore";
import { useSpecStore } from "../../store/specStore";
import { THUMBNAIL_SIZES, type ThumbnailSize } from "../../types";

export function Toolbar() {
  const viewMode = usePsdStore((state) => state.viewMode);
  const thumbnailSize = usePsdStore((state) => state.thumbnailSize);
  const setViewMode = usePsdStore((state) => state.setViewMode);
  const setThumbnailSize = usePsdStore((state) => state.setThumbnailSize);
  const files = usePsdStore((state) => state.files);
  const selectAll = usePsdStore((state) => state.selectAll);
  const clearSelection = usePsdStore((state) => state.clearSelection);

  // 仕様チェック結果
  const checkResults = useSpecStore((state) => state.checkResults);
  const specifications = useSpecStore((state) => state.specifications);
  const activeSpecId = useSpecStore((state) => state.activeSpecId);

  // チェック統計を計算
  const passedCount = Array.from(checkResults.values()).filter((r) => r.passed).length;
  const failedCount = Array.from(checkResults.values()).filter((r) => !r.passed).length;
  const uncheckedCount = files.length - passedCount - failedCount;

  // アクティブな仕様名
  const activeSpec = specifications.find((s) => s.id === activeSpecId);

  return (
    <div className="px-4 py-3 bg-bg-secondary shadow-soft border-b border-border flex items-center justify-between relative z-10">
      {/* Left: View Controls */}
      <div className="flex items-center gap-4">
        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-bg-tertiary rounded-xl p-1">
          <button
            className={`p-2 rounded-lg transition-all duration-200 ${
              viewMode === "grid"
                ? "bg-gradient-to-r from-accent to-accent-secondary text-white shadow-sm"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
            }`}
            onClick={() => setViewMode("grid")}
            title="グリッド表示"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          <button
            className={`p-2 rounded-lg transition-all duration-200 ${
              viewMode === "list"
                ? "bg-gradient-to-r from-accent to-accent-secondary text-white shadow-sm"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
            }`}
            onClick={() => setViewMode("list")}
            title="リスト表示"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Thumbnail Size */}
        {viewMode === "grid" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">サイズ:</span>
            <select
              className="bg-bg-tertiary border border-border rounded-lg text-xs py-1.5 px-3 text-text-primary focus:border-accent focus:outline-none transition-colors shadow-soft"
              value={thumbnailSize}
              onChange={(e) => setThumbnailSize(e.target.value as ThumbnailSize)}
            >
              {Object.entries(THUMBNAIL_SIZES).map(([key, { label }]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Center: Check Results Summary */}
      {files.length > 0 && (
        <div className="flex items-center gap-3">
          {activeSpec && (
            <span className="text-xs text-text-muted px-2 py-1 rounded-lg bg-bg-tertiary">
              {activeSpec.name}
            </span>
          )}
          {checkResults.size > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-bg-tertiary">
              {/* OK */}
              <div className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5 text-success" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-xs font-medium text-success">{passedCount}</span>
              </div>
              <span className="w-px h-4 bg-border" />
              {/* NG */}
              <div className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5 text-error" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-xs font-medium text-error">{failedCount}</span>
              </div>
              {uncheckedCount > 0 && (
                <>
                  <span className="w-px h-4 bg-border" />
                  <span className="text-xs text-text-muted">{uncheckedCount} 未確認</span>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Right: Selection Controls */}
      <div className="flex items-center gap-3">
        {files.length > 0 && (
          <>
            <button
              className="text-xs text-text-secondary hover:text-accent transition-colors"
              onClick={selectAll}
            >
              すべて選択
            </button>
            <span className="w-px h-4 bg-white/10" />
            <button
              className="text-xs text-text-secondary hover:text-accent transition-colors"
              onClick={clearSelection}
            >
              選択解除
            </button>
          </>
        )}
      </div>
    </div>
  );
}
