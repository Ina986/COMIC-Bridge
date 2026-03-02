import { usePsdStore } from "../../store/psdStore";
import { TypesettingViewerPanel } from "../typesetting-check/TypesettingViewerPanel";
import { TypesettingCheckPanel } from "../typesetting-check/TypesettingCheckPanel";

export function TypesettingCheckView() {
  const files = usePsdStore((s) => s.files);

  if (files.length === 0) {
    return (
      <div className="flex h-full">
        {/* Left: empty viewer */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <svg className="w-12 h-12 mx-auto text-text-muted/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-xs text-text-muted">PSDファイルをドロップして読み込んでください</p>
          </div>
        </div>
        {/* Right: check panel (can load JSON without PSD) */}
        <div className="w-[480px] flex-shrink-0 border-l border-border overflow-hidden flex flex-col bg-bg-secondary">
          <TypesettingCheckPanel />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left Panel: PSD Viewer */}
      <div className="flex-1 overflow-hidden">
        <TypesettingViewerPanel />
      </div>

      {/* Right Panel: Check Table */}
      <div className="w-[480px] flex-shrink-0 border-l border-border overflow-hidden flex flex-col bg-bg-secondary">
        <TypesettingCheckPanel />
      </div>
    </div>
  );
}
