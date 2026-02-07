import { usePsdStore } from "../../store/psdStore";
import { useGuideStore } from "../../store/guideStore";
import { useSpecStore } from "../../store/specStore";
import { PreviewGrid } from "../preview/PreviewGrid";
import { DropZone } from "../file-browser/DropZone";
import { DetailSlidePanel } from "../common/DetailSlidePanel";
import { THUMBNAIL_SIZES, type ThumbnailSize } from "../../types";

export function FileView() {
  const files = usePsdStore((state) => state.files);
  const selectedFileIds = usePsdStore((state) => state.selectedFileIds);
  const viewMode = usePsdStore((state) => state.viewMode);
  const thumbnailSize = usePsdStore((state) => state.thumbnailSize);
  const setViewMode = usePsdStore((state) => state.setViewMode);
  const setThumbnailSize = usePsdStore((state) => state.setThumbnailSize);
  const selectAll = usePsdStore((state) => state.selectAll);
  const clearSelection = usePsdStore((state) => state.clearSelection);
  const openEditor = useGuideStore((state) => state.openEditor);

  const checkResults = useSpecStore((state) => state.checkResults);
  const specifications = useSpecStore((state) => state.specifications);
  const activeSpecId = useSpecStore((state) => state.activeSpecId);
  const activeSpec = specifications.find((s) => s.id === activeSpecId);
  const passedCount = Array.from(checkResults.values()).filter((r) => r.passed).length;
  const failedCount = Array.from(checkResults.values()).filter((r) => !r.passed).length;

  const hasFiles = files.length > 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      {hasFiles && (
        <div className="px-4 py-2 bg-bg-secondary border-b border-border flex items-center justify-between flex-shrink-0 z-10">
          {/* Left: View Controls */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-bg-tertiary rounded-lg p-0.5">
              <button
                className={`p-1.5 rounded-md transition-all duration-200 ${
                  viewMode === "grid"
                    ? "bg-gradient-to-r from-accent to-accent-secondary text-white shadow-sm"
                    : "text-text-secondary hover:text-text-primary"
                }`}
                onClick={() => setViewMode("grid")}
                title="グリッド表示"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                className={`p-1.5 rounded-md transition-all duration-200 ${
                  viewMode === "list"
                    ? "bg-gradient-to-r from-accent to-accent-secondary text-white shadow-sm"
                    : "text-text-secondary hover:text-text-primary"
                }`}
                onClick={() => setViewMode("list")}
                title="リスト表示"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {viewMode === "grid" && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted">サイズ:</span>
                <select
                  className="bg-bg-tertiary border border-border rounded-md text-xs py-1 px-2 text-text-primary focus:border-accent focus:outline-none"
                  value={thumbnailSize}
                  onChange={(e) => setThumbnailSize(e.target.value as ThumbnailSize)}
                >
                  {Object.entries(THUMBNAIL_SIZES).map(([key, { label }]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Center: Check Results */}
          <div className="flex items-center gap-3">
            {activeSpec && (
              <span className="text-xs text-text-muted px-2 py-0.5 rounded-md bg-bg-tertiary">
                {activeSpec.name}
              </span>
            )}
            {checkResults.size > 0 && (
              <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-bg-tertiary">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-success" />
                  <span className="text-xs font-medium text-success">{passedCount}</span>
                </div>
                <span className="w-px h-3 bg-border" />
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-error" />
                  <span className="text-xs font-medium text-error">{failedCount}</span>
                </div>
              </div>
            )}
          </div>

          {/* Right: Selection + Actions */}
          <div className="flex items-center gap-3">
            <button className="text-xs text-text-secondary hover:text-accent transition-colors" onClick={selectAll}>
              すべて選択
            </button>
            <button className="text-xs text-text-secondary hover:text-accent transition-colors" onClick={clearSelection}>
              選択解除
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden relative" data-preview-grid>
        {hasFiles ? <PreviewGrid /> : <DropZone />}
        <DetailSlidePanel />
      </div>

      {/* Bottom Action Bar */}
      {hasFiles && (
        <div className="px-4 py-2 bg-bg-secondary border-t border-border flex items-center justify-between flex-shrink-0 z-10">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-2.5 py-1 bg-bg-tertiary rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-tertiary" />
              <span className="text-xs text-text-primary font-medium">{files.length} ファイル</span>
            </div>
            {selectedFileIds.length > 0 && (
              <div className="flex items-center gap-2 px-2.5 py-1 bg-accent/10 border border-accent/30 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                <span className="text-xs text-accent font-medium">{selectedFileIds.length} 件選択中</span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-bg-tertiary text-text-primary border border-border hover:border-accent/30 hover:bg-bg-elevated transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              onClick={openEditor}
              disabled={files.length === 0}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
              ガイド編集
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
