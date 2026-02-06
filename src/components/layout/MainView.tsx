import { usePsdStore } from "../../store/psdStore";
import { useGuideStore } from "../../store/guideStore";
import { useReplaceStore } from "../../store/replaceStore";
import { PreviewGrid } from "../preview/PreviewGrid";
import { Toolbar } from "./Toolbar";
import { DropZone } from "../file-browser/DropZone";
import { ReplaceDropZone } from "../replace/ReplaceDropZone";

export function MainView() {
  const files = usePsdStore((state) => state.files);
  const selectedFileIds = usePsdStore((state) => state.selectedFileIds);
  const openEditor = useGuideStore((state) => state.openEditor);
  const sidebarTab = useReplaceStore((state) => state.sidebarTab);

  const hasFiles = files.length > 0;
  const isReplaceMode = sidebarTab === "replace";

  return (
    <main className="flex-1 flex flex-col overflow-hidden bg-bg-primary relative">
      {/* Toolbar (非表示: replace タブ時) */}
      {!isReplaceMode && <Toolbar />}

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {isReplaceMode ? (
          <ReplaceDropZone />
        ) : hasFiles ? (
          <PreviewGrid />
        ) : (
          <DropZone />
        )}
      </div>

      {/* Bottom Action Bar (非表示: replace タブ時) */}
      {!isReplaceMode && hasFiles && (
        <div className="px-4 py-3 bg-bg-secondary shadow-soft border-t border-border flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            {/* ファイル数バッジ */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-bg-tertiary rounded-full">
              <span className="w-2 h-2 rounded-full bg-accent-tertiary" />
              <span className="text-sm text-text-primary font-medium">
                {files.length} ファイル
              </span>
            </div>

            {/* 選択数 */}
            {selectedFileIds.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-accent/10 border border-accent/30 rounded-full">
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                <span className="text-sm text-accent font-medium">
                  {selectedFileIds.length} 件選択中
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              className="
                px-4 py-2 text-sm font-medium rounded-xl
                bg-bg-tertiary text-text-primary
                border border-border hover:border-accent/30
                hover:bg-bg-elevated shadow-soft
                transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center gap-2
              "
              onClick={openEditor}
              disabled={files.length === 0}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
              ガイド編集
            </button>
            <button
              className="
                px-4 py-2 text-sm font-medium rounded-xl text-white
                bg-gradient-to-r from-accent to-accent-secondary
                shadow-glow-pink
                hover:shadow-[0_6px_20px_rgba(255,107,157,0.4)]
                hover:-translate-y-0.5
                transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
                flex items-center gap-2
              "
              disabled={selectedFileIds.length === 0}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              すべてに適用
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
