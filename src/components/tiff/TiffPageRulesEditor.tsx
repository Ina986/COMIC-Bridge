import { createPortal } from "react-dom";
import { usePsdStore } from "../../store/psdStore";
import { useTiffStore } from "../../store/tiffStore";

export function TiffPageRulesEditor({ onClose }: { onClose: () => void }) {
  const files = usePsdStore((state) => state.files);
  const settings = useTiffStore((state) => state.settings);
  const setSettings = useTiffStore((state) => state.setSettings);
  const addPageRangeRule = useTiffStore((state) => state.addPageRangeRule);
  const updatePageRangeRule = useTiffStore((state) => state.updatePageRangeRule);
  const removePageRangeRule = useTiffStore((state) => state.removePageRangeRule);

  const rules = settings.pageRangeRules;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-bg-secondary border border-border rounded-2xl shadow-xl max-w-2xl w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-sm font-display font-bold text-text-primary">個別カラー設定</h3>
          <p className="text-xs text-text-muted mt-1">
            ページ範囲ごとにカラーモードとぼかしを指定（最大3ルール）
          </p>
        </div>

        {/* Content */}
        <div className="flex gap-4 p-6">
          {/* Left: Rules */}
          <div className="flex-1 space-y-3">
            <h4 className="text-[10px] font-medium text-text-muted">1. 個別ルール指定</h4>

            {rules.map((rule, i) => (
              <div key={rule.id} className="flex items-center gap-2 p-2 bg-bg-tertiary rounded-lg">
                <span className="text-xs text-text-muted w-4">{i + 1}.</span>

                <input
                  type="number"
                  min="1"
                  value={rule.fromPage}
                  onChange={(e) => updatePageRangeRule(rule.id, { fromPage: parseInt(e.target.value) || 1 })}
                  className="w-14 px-1.5 py-1 text-xs bg-bg-elevated border border-border/50 rounded text-text-primary text-center focus:outline-none focus:border-accent-warm/50"
                />
                <span className="text-xs text-text-muted">〜</span>
                <input
                  type="number"
                  min="1"
                  value={rule.toPage}
                  onChange={(e) => updatePageRangeRule(rule.id, { toPage: parseInt(e.target.value) || 1 })}
                  className="w-14 px-1.5 py-1 text-xs bg-bg-elevated border border-border/50 rounded text-text-primary text-center focus:outline-none focus:border-accent-warm/50"
                />

                <select
                  value={rule.colorMode}
                  onChange={(e) => updatePageRangeRule(rule.id, { colorMode: e.target.value as "mono" | "color" | "noChange" })}
                  className="px-2 py-1 text-xs bg-bg-elevated border border-border/50 rounded text-text-primary focus:outline-none"
                >
                  <option value="color">カラー</option>
                  <option value="mono">モノクロ</option>
                  <option value="noChange">変更なし</option>
                </select>

                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rule.applyBlur}
                    onChange={(e) => updatePageRangeRule(rule.id, { applyBlur: e.target.checked })}
                    className="rounded accent-accent-warm"
                  />
                  <span className="text-[10px] text-text-secondary">ぼかし</span>
                </label>

                <button
                  onClick={() => removePageRangeRule(rule.id)}
                  className="p-1 text-text-muted hover:text-error transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}

            {rules.length < 3 && (
              <button
                onClick={addPageRangeRule}
                className="w-full px-3 py-2 text-xs text-text-muted border border-dashed border-border rounded-lg hover:border-accent-warm/50 hover:text-accent-warm transition-colors"
              >
                + ルールを追加
              </button>
            )}

            {/* Default Mode */}
            <div className="mt-4 space-y-1.5">
              <h4 className="text-[10px] font-medium text-text-muted">2. デフォルト処理（ルール外のページ）</h4>
              <div className="flex gap-2">
                {(["mono", "color", "noChange"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setSettings({ defaultColorForPerPage: mode })}
                    className={`
                      flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-all
                      ${settings.defaultColorForPerPage === mode
                        ? "bg-accent-warm text-white"
                        : "bg-bg-elevated text-text-secondary hover:text-text-primary border border-border/50"
                      }
                    `}
                  >
                    {mode === "mono" ? "モノクロ" : mode === "color" ? "カラー" : "変更なし"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: File Reference */}
          <div className="w-56 flex-shrink-0">
            <h4 className="text-[10px] font-medium text-text-muted mb-1.5">ファイル一覧（順番参照）</h4>
            <div className="bg-bg-tertiary rounded-lg p-2 max-h-[300px] overflow-auto space-y-0.5">
              {files.map((file, i) => (
                <div key={file.id} className="flex items-center gap-1.5 text-xs">
                  <span className="text-text-muted font-mono w-8 text-right">({i + 1})</span>
                  <span className="text-text-secondary truncate">{file.fileName}</span>
                </div>
              ))}
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
            onClick={onClose}
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
