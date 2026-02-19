import { useState } from "react";
import { useScanPsdStore } from "../../../store/scanPsdStore";
import { getAutoSubName } from "../../../types/scanPsd";
import type { FontPreset } from "../../../types/scanPsd";

export function FontTypesTab() {
  const scanData = useScanPsdStore((s) => s.scanData);
  const presetSets = useScanPsdStore((s) => s.presetSets);
  const currentSetName = useScanPsdStore((s) => s.currentSetName);
  const setCurrentSetName = useScanPsdStore((s) => s.setCurrentSetName);
  const addPresetSet = useScanPsdStore((s) => s.addPresetSet);
  const removePresetSet = useScanPsdStore((s) => s.removePresetSet);
  const renamePresetSet = useScanPsdStore((s) => s.renamePresetSet);
  const addFontToPreset = useScanPsdStore((s) => s.addFontToPreset);
  const removeFontFromPreset = useScanPsdStore((s) => s.removeFontFromPreset);

  const [editMode, setEditMode] = useState<"none" | "add" | "rename">("none");
  const [inputValue, setInputValue] = useState("");

  const currentPresets = presetSets[currentSetName] || [];
  const setNames = Object.keys(presetSets);

  // 未登録フォント（スキャン結果にあるがプリセットにないフォント）
  const registeredFonts = new Set(
    Object.values(presetSets).flatMap((ps) => ps.map((p) => p.font))
  );
  const unregisteredFonts = scanData?.fonts
    ? scanData.fonts.filter((f) => !registeredFonts.has(f.name))
    : [];

  const handleAddSet = () => {
    if (inputValue.trim()) {
      addPresetSet(inputValue.trim());
      setCurrentSetName(inputValue.trim());
      setInputValue("");
      setEditMode("none");
    }
  };

  const handleRenameSet = () => {
    if (inputValue.trim() && inputValue.trim() !== currentSetName) {
      renamePresetSet(currentSetName, inputValue.trim());
      setInputValue("");
      setEditMode("none");
    }
  };

  const handleAddUnregistered = (fontName: string, displayName: string, count: number) => {
    const preset: FontPreset = {
      name: displayName || fontName,
      subName: getAutoSubName(fontName),
      font: fontName,
      description: `使用回数: ${count}`,
    };
    addFontToPreset(currentSetName, preset);
  };

  const handleAddAllUnregistered = () => {
    for (const f of unregisteredFonts) {
      const preset: FontPreset = {
        name: f.displayName || f.name,
        subName: getAutoSubName(f.name),
        font: f.name,
        description: `使用回数: ${f.count}`,
      };
      addFontToPreset(currentSetName, preset);
    }
  };

  return (
    <div className="space-y-3">
      {/* プリセットセット選択 */}
      <div className="bg-bg-tertiary rounded-xl p-3">
        <div className="flex items-center gap-2 mb-2">
          <select
            value={currentSetName}
            onChange={(e) => setCurrentSetName(e.target.value)}
            className="flex-1 bg-bg-elevated border border-white/10 rounded-lg px-2 py-1 text-xs text-text-primary"
          >
            {setNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <button
            onClick={() => { setEditMode("add"); setInputValue(""); }}
            className="text-[10px] text-accent hover:text-accent-secondary px-1.5 py-1 rounded hover:bg-accent/10"
            title="セット追加"
          >
            +
          </button>
          <button
            onClick={() => { setEditMode("rename"); setInputValue(currentSetName); }}
            className="text-[10px] text-text-muted hover:text-text-primary px-1.5 py-1 rounded hover:bg-bg-elevated"
            title="名前変更"
          >
            名前変更
          </button>
          {setNames.length > 1 && (
            <button
              onClick={() => removePresetSet(currentSetName)}
              className="text-[10px] text-error/70 hover:text-error px-1.5 py-1 rounded hover:bg-error/10"
              title="セット削除"
            >
              削除
            </button>
          )}
        </div>

        {editMode !== "none" && (
          <div className="flex items-center gap-2 mt-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") editMode === "add" ? handleAddSet() : handleRenameSet();
                if (e.key === "Escape") setEditMode("none");
              }}
              placeholder={editMode === "add" ? "新規セット名" : "新しいセット名"}
              className="flex-1 bg-bg-elevated border border-accent/50 rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none"
              autoFocus
            />
            <button
              onClick={editMode === "add" ? handleAddSet : handleRenameSet}
              className="text-[10px] text-accent px-2 py-1 rounded-lg bg-accent/10 hover:bg-accent/20"
            >
              OK
            </button>
            <button
              onClick={() => setEditMode("none")}
              className="text-[10px] text-text-muted px-2 py-1"
            >
              取消
            </button>
          </div>
        )}
      </div>

      {/* フォントプリセットリスト */}
      <div className="bg-bg-tertiary rounded-xl p-3">
        <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">
          プリセット ({currentPresets.length})
        </h4>
        {currentPresets.length === 0 ? (
          <p className="text-[10px] text-text-muted py-4 text-center">
            プリセットがありません
          </p>
        ) : (
          <div className="space-y-1 max-h-60 overflow-auto">
            {currentPresets.map((p, i) => (
              <div
                key={i}
                className="flex items-center gap-2 bg-bg-elevated rounded-lg px-2.5 py-1.5 group"
              >
                {p.subName && (
                  <span className="text-[9px] text-accent bg-accent/10 px-1.5 py-0.5 rounded flex-shrink-0">
                    {p.subName}
                  </span>
                )}
                <span className="text-xs text-text-primary flex-1 truncate">{p.name}</span>
                <span className="text-[9px] text-text-muted truncate max-w-[80px]">{p.font}</span>
                <button
                  onClick={() => removeFontFromPreset(currentSetName, i)}
                  className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-error transition-all"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 未登録フォント */}
      {scanData && (
        <div className="bg-bg-tertiary rounded-xl p-3">
          <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">
            未登録フォント ({unregisteredFonts.length})
          </h4>
          {unregisteredFonts.length === 0 ? (
            <p className="text-[10px] text-success py-2 text-center">
              全てのフォントが登録済みです
            </p>
          ) : (
            <>
              <div className="space-y-1 max-h-40 overflow-auto mb-2">
                {unregisteredFonts.map((f) => (
                  <div
                    key={f.name}
                    className="flex items-center gap-2 bg-bg-elevated rounded-lg px-2.5 py-1.5"
                  >
                    <span className="text-xs text-text-primary flex-1 truncate">
                      {f.displayName || f.name}
                    </span>
                    <span className="text-[9px] text-text-muted">{f.count}回</span>
                    <button
                      onClick={() => handleAddUnregistered(f.name, f.displayName, f.count)}
                      className="text-[10px] text-accent hover:text-accent-secondary px-1.5 py-0.5 rounded hover:bg-accent/10"
                    >
                      追加
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={handleAddAllUnregistered}
                className="w-full py-1.5 text-[10px] font-medium text-accent bg-accent/10 rounded-lg hover:bg-accent/20 transition-colors"
              >
                検出フォントを全て追加
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
