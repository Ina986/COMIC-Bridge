import { useState } from "react";
import { createPortal } from "react-dom";
import { usePsdStore } from "../../store/psdStore";
import { useTiffStore } from "../../store/tiffStore";
import type { PartialBlurEntry } from "../../types/tiff";

const MAX_ENTRIES = 5;

export function TiffPartialBlurModal({ onClose }: { onClose: () => void }) {
  const files = usePsdStore((state) => state.files);
  const partialBlurEntries = useTiffStore((state) => state.settings.partialBlurEntries);
  const setPartialBlurEntries = useTiffStore((state) => state.setPartialBlurEntries);

  const [entries, setEntries] = useState<PartialBlurEntry[]>(() => {
    // 最大5行まで、空きスロットはpageNumber=0で初期化
    const initial = [...partialBlurEntries];
    while (initial.length < MAX_ENTRIES) {
      initial.push({ pageNumber: 0, blurRadius: 0 });
    }
    return initial;
  });

  const updateEntry = (index: number, partial: Partial<PartialBlurEntry>) => {
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, ...partial } : e)));
  };

  const handleSave = () => {
    // pageNumber > 0 のエントリだけ保存
    const valid = entries.filter((e) => e.pageNumber > 0);
    setPartialBlurEntries(valid);
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-bg-secondary border border-border rounded-2xl shadow-xl max-w-2xl w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-sm font-display font-bold text-text-primary">部分ぼかし設定</h3>
          <p className="text-xs text-text-muted mt-1">
            特定ページにのみ異なるぼかし半径を適用（最大{MAX_ENTRIES}ページ）
          </p>
        </div>

        {/* Content */}
        <div className="flex gap-4 p-6">
          {/* Left: Entry Rows */}
          <div className="flex-1 space-y-2">
            {entries.map((entry, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-text-muted w-4">{i + 1}.</span>
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-text-secondary">ページ:</label>
                  <input
                    type="number"
                    min="0"
                    value={entry.pageNumber}
                    onChange={(e) => updateEntry(i, { pageNumber: parseInt(e.target.value) || 0 })}
                    className="w-16 px-2 py-1 text-sm bg-bg-elevated border border-border/50 rounded-lg text-text-primary focus:outline-none focus:border-accent-warm/50"
                    placeholder="0"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-text-secondary">半径:</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={entry.blurRadius}
                    onChange={(e) => updateEntry(i, { blurRadius: parseFloat(e.target.value) || 0 })}
                    className="w-20 px-2 py-1 text-sm bg-bg-elevated border border-border/50 rounded-lg text-text-primary focus:outline-none focus:border-accent-warm/50"
                  />
                  <span className="text-xs text-text-muted">px</span>
                </div>
              </div>
            ))}
          </div>

          {/* Right: File List Reference */}
          <div className="w-56 flex-shrink-0">
            <h4 className="text-[10px] font-medium text-text-muted mb-1.5">ファイル一覧（順番参照）</h4>
            <div className="bg-bg-tertiary rounded-lg p-2 max-h-[200px] overflow-auto space-y-0.5">
              {files.map((file, i) => (
                <div key={file.id} className="flex items-center gap-1.5 text-xs">
                  <span className="text-text-muted font-mono w-6 text-right">{i + 1}.</span>
                  <span className="text-text-secondary truncate">{file.fileName}</span>
                </div>
              ))}
              {files.length === 0 && (
                <p className="text-xs text-text-muted text-center py-2">ファイルなし</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-text-secondary bg-bg-tertiary rounded-xl hover:bg-bg-tertiary/80 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-accent-warm to-accent rounded-xl hover:-translate-y-0.5 transition-all shadow-sm"
          >
            OK
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
