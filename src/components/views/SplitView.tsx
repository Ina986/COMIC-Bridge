import { CompactFileList } from "../common/CompactFileList";
import { SplitPanel } from "../split/SplitPanel";
import { usePsdStore } from "../../store/psdStore";
import { DropZone } from "../file-browser/DropZone";

export function SplitView() {
  const files = usePsdStore((state) => state.files);
  const hasFiles = files.length > 0;

  if (!hasFiles) {
    return <DropZone />;
  }

  return (
    <div className="flex h-full overflow-hidden" data-tool-panel>
      {/* File List */}
      <CompactFileList className="w-52 flex-shrink-0 border-r border-border" />

      {/* Settings */}
      <div className="w-[360px] flex-shrink-0 border-r border-border overflow-hidden">
        <SplitPanel />
      </div>

      {/* Info area */}
      <div className="flex-1 overflow-hidden flex items-center justify-center bg-bg-primary">
        <div className="text-center max-w-sm px-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-bg-tertiary flex items-center justify-center">
            <svg className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <h3 className="text-sm font-display font-medium text-text-primary mb-2">
            見開きページの分割
          </h3>
          <p className="text-xs text-text-muted leading-relaxed">
            左のリストからファイルを選択し、分割モードと出力形式を設定して
            Photoshopで見開きページを左右に分割します。
            <br />
            選択がない場合は全ファイルが対象になります。
          </p>
        </div>
      </div>
    </div>
  );
}
