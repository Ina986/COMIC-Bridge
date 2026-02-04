import { usePsdStore } from "../../store/psdStore";
import { THUMBNAIL_SIZES, type ThumbnailSize } from "../../types";

export function Toolbar() {
  const viewMode = usePsdStore((state) => state.viewMode);
  const thumbnailSize = usePsdStore((state) => state.thumbnailSize);
  const setViewMode = usePsdStore((state) => state.setViewMode);
  const setThumbnailSize = usePsdStore((state) => state.setThumbnailSize);
  const files = usePsdStore((state) => state.files);
  const selectAll = usePsdStore((state) => state.selectAll);
  const clearSelection = usePsdStore((state) => state.clearSelection);

  return (
    <div className="px-4 py-2 bg-bg-secondary border-b border-text-muted/10 flex items-center justify-between">
      {/* Left: View Controls */}
      <div className="flex items-center gap-4">
        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-bg-tertiary rounded p-0.5">
          <button
            className={`p-1.5 rounded transition-colors ${
              viewMode === "grid"
                ? "bg-accent text-bg-primary"
                : "text-text-secondary hover:text-text-primary"
            }`}
            onClick={() => setViewMode("grid")}
            title="グリッド表示"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          <button
            className={`p-1.5 rounded transition-colors ${
              viewMode === "list"
                ? "bg-accent text-bg-primary"
                : "text-text-secondary hover:text-text-primary"
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
              className="input text-xs py-1 px-2"
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

      {/* Right: Selection Controls */}
      <div className="flex items-center gap-2">
        {files.length > 0 && (
          <>
            <button
              className="text-xs text-text-secondary hover:text-text-primary"
              onClick={selectAll}
            >
              すべて選択
            </button>
            <span className="text-text-muted">|</span>
            <button
              className="text-xs text-text-secondary hover:text-text-primary"
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
