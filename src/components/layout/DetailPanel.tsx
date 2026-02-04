import { usePsdStore } from "../../store/psdStore";
import { MetadataPanel } from "../metadata/MetadataPanel";

export function DetailPanel() {
  const activeFile = usePsdStore((state) => state.getActiveFile());

  return (
    <aside className="w-80 flex-shrink-0 bg-bg-secondary border-l border-text-muted/10 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-text-muted/10">
        <h2 className="text-sm font-medium text-text-primary">詳細情報</h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeFile ? (
          <MetadataPanel file={activeFile} />
        ) : (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">
            ファイルを選択してください
          </div>
        )}
      </div>
    </aside>
  );
}
