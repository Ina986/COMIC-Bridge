import { useState } from "react";
import { useGuideStore } from "../../store/guideStore";

export function GuidePresets() {
  const presets = useGuideStore((state) => state.presets);
  const guides = useGuideStore((state) => state.guides);
  const loadPreset = useGuideStore((state) => state.loadPreset);
  const saveAsPreset = useGuideStore((state) => state.saveAsPreset);

  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [presetName, setPresetName] = useState("");

  const handleSave = () => {
    if (presetName.trim()) {
      saveAsPreset(presetName.trim());
      setPresetName("");
      setShowSaveDialog(false);
    }
  };

  return (
    <div>
      <h4 className="text-xs font-medium text-text-muted mb-2">プリセット</h4>

      {/* Preset Buttons */}
      <div className="space-y-1">
        {presets.map((preset) => (
          <button
            key={preset.id}
            className="w-full text-left px-3 py-2 rounded bg-bg-tertiary hover:bg-bg-elevated transition-colors text-sm"
            onClick={() => loadPreset(preset.id)}
          >
            <span className="text-text-primary">{preset.name}</span>
            <span className="text-text-muted text-xs ml-2">
              ({preset.guides.length}本)
            </span>
          </button>
        ))}
      </div>

      {/* Save as Preset */}
      {showSaveDialog ? (
        <div className="mt-3 space-y-2">
          <input
            type="text"
            className="input w-full text-sm"
            placeholder="プリセット名"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") setShowSaveDialog(false);
            }}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              className="flex-1 btn btn-secondary text-xs"
              onClick={() => setShowSaveDialog(false)}
            >
              キャンセル
            </button>
            <button
              className="flex-1 btn btn-primary text-xs"
              onClick={handleSave}
              disabled={!presetName.trim()}
            >
              保存
            </button>
          </div>
        </div>
      ) : (
        <button
          className="w-full mt-3 btn btn-secondary text-sm"
          onClick={() => setShowSaveDialog(true)}
          disabled={guides.length === 0}
        >
          現在のガイドを保存
        </button>
      )}
    </div>
  );
}
