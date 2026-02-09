import { useState } from "react";
import { useReplaceStore } from "../../store/replaceStore";

export function PairingOutputSettings() {
  const settings = useReplaceStore((s) => s.settings);
  const setGeneralSettings = useReplaceStore((s) => s.setGeneralSettings);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-t border-border">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
      >
        <svg
          className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-xs font-medium">出力設定</span>
      </button>

      {isOpen && (
        <div className="px-4 pb-3 space-y-3">
          {/* Save File Name */}
          <div>
            <label className="text-[10px] text-text-muted mb-1 block">
              保存ファイル名
            </label>
            <div className="flex gap-1.5">
              <button
                className={`flex-1 px-2 py-1.5 text-[10px] rounded-lg transition-all ${
                  settings.generalSettings.saveFileName === "target"
                    ? "bg-accent/20 text-accent border border-accent/30"
                    : "bg-bg-elevated text-text-secondary border border-white/5"
                }`}
                onClick={() => setGeneralSettings({ saveFileName: "target" })}
              >
                画像データ名
              </button>
              <button
                className={`flex-1 px-2 py-1.5 text-[10px] rounded-lg transition-all ${
                  settings.generalSettings.saveFileName === "source"
                    ? "bg-accent/20 text-accent border border-accent/30"
                    : "bg-bg-elevated text-text-secondary border border-white/5"
                }`}
                onClick={() => setGeneralSettings({ saveFileName: "source" })}
              >
                植字データ名
              </button>
            </div>
          </div>

          {/* Output Folder Name */}
          <div>
            <label className="text-[10px] text-text-muted mb-1 block">
              出力フォルダ名
            </label>
            <input
              type="text"
              value={settings.generalSettings.outputFolderName}
              onChange={(e) =>
                setGeneralSettings({ outputFolderName: e.target.value })
              }
              placeholder="空欄＝日時で自動生成"
              className="w-full bg-bg-elevated border border-white/10 rounded-lg px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted/50 focus:border-accent focus:outline-none"
            />
            <p className="text-[9px] text-text-muted/60 mt-0.5">
              デスクトップ/Script_Output/差替えファイル_出力/ 以下
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
