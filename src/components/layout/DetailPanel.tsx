import { usePsdStore } from "../../store/psdStore";
import { MetadataPanel } from "../metadata/MetadataPanel";

export function DetailPanel() {
  const activeFile = usePsdStore((state) => state.getActiveFile());

  return (
    <aside className="w-80 flex-shrink-0 bg-bg-secondary border-l border-white/5 flex flex-col overflow-hidden relative z-10">
      {/* Header */}
      <div className="px-4 py-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent-secondary/20 flex items-center justify-center">
            <svg
              className="w-4 h-4 text-accent-secondary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="text-sm font-display font-medium text-text-primary">
            詳細情報
          </h2>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeFile ? (
          <MetadataPanel file={activeFile} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            {/* かわいいイラスト風アイコン */}
            <div className="w-20 h-20 rounded-2xl bg-bg-tertiary flex items-center justify-center mb-4">
              <svg
                className="w-10 h-10 text-text-muted"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75"
                />
              </svg>
            </div>
            <p className="text-text-muted text-sm">
              ファイルを選択すると
              <br />
              詳細が表示されます
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
