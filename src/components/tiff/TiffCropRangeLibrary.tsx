import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTiffStore } from "../../store/tiffStore";
import type { TiffCropPreset, TiffScandataFile } from "../../types/tiff";
import { GENRE_LABELS as genreLabels, JSON_BASE_PATH as basePath } from "../../types/tiff";

type Tab = "load" | "save" | "create";

export function TiffCropRangeLibrary({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<Tab>("load");
  const loadCropPreset = useTiffStore((state) => state.loadCropPreset);
  const addCropPreset = useTiffStore((state) => state.addCropPreset);
  const settings = useTiffStore((state) => state.settings);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-bg-secondary border border-border rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header with Tabs */}
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-sm font-display font-bold text-text-primary mb-3">選択範囲 JSONライブラリ</h3>
          <div className="flex bg-bg-tertiary rounded-lg p-0.5">
            {(["load", "save", "create"] as Tab[]).map((tab) => (
              <button
                key={tab}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  activeTab === tab
                    ? "bg-bg-secondary text-text-primary shadow-sm"
                    : "text-text-muted hover:text-text-secondary"
                }`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === "load" ? "JSONから読込" : tab === "save" ? "JSONに保存" : "JSON新規作成"}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === "load" && (
            <LoadTab onLoad={(preset) => { loadCropPreset(preset); onClose(); }} />
          )}
          {activeTab === "save" && (
            <SaveTab
              settings={settings}
              onSave={(preset) => { addCropPreset(preset); onClose(); }}
            />
          )}
          {activeTab === "create" && (
            <CreateTab onCreated={onClose} />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-text-secondary bg-bg-tertiary rounded-xl hover:bg-bg-tertiary/80 transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// --- Load Tab ---
function LoadTab({ onLoad }: { onLoad: (preset: TiffCropPreset) => void }) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [presets, setPresets] = useState<TiffCropPreset[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadJsonFile = useCallback(async (filePath: string) => {
    try {
      const { readTextFile } = await import("@tauri-apps/plugin-fs");
      const content = await readTextFile(filePath);
      const data: TiffScandataFile = JSON.parse(content);
      if (data.presetData?.selectionRanges) {
        setPresets(data.presetData.selectionRanges);
        setSelectedFile(filePath);
      } else {
        setPresets([]);
        setError("有効なプリセットが見つかりません");
      }
    } catch (e) {
      setError(`JSONの読み込みに失敗: ${e}`);
    }
  }, []);

  // Alternative: Open via dialog
  const openFileDialog = useCallback(async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const file = await open({
        filters: [{ name: "JSON", extensions: ["json"] }],
        directory: false,
        multiple: false,
        defaultPath: basePath,
      });
      if (file) {
        await loadJsonFile(file as string);
      }
    } catch { /* cancelled */ }
  }, [loadJsonFile]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={openFileDialog}
          className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-accent-warm to-accent rounded-xl hover:-translate-y-0.5 transition-all shadow-sm"
        >
          JSONファイルを選択...
        </button>
        <div className="flex-1" />
        {selectedFile && (
          <span className="text-[10px] text-text-muted self-center truncate max-w-[300px]">
            {selectedFile}
          </span>
        )}
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg bg-error/10 text-xs text-error">{error}</div>
      )}

      {presets.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-medium text-text-muted">プリセット一覧</h4>
          {presets.map((preset, i) => (
            <button
              key={i}
              onClick={() => onLoad(preset)}
              className="w-full text-left px-3 py-2.5 bg-bg-tertiary rounded-lg hover:bg-accent-warm/10 hover:border-accent-warm/30 border border-transparent transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-primary font-medium">{preset.label}</span>
                <svg className="w-4 h-4 text-text-muted group-hover:text-accent-warm transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
              <div className="flex gap-3 text-[10px] text-text-muted mt-0.5">
                <span>doc: {preset.documentSize.width}x{preset.documentSize.height}</span>
                {preset.size && <span>range: {preset.size.width}x{preset.size.height}</span>}
                {preset.savedAt && <span>{new Date(preset.savedAt).toLocaleDateString()}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Save Tab ---
function SaveTab({
  settings,
  onSave,
}: {
  settings: { crop: { bounds: any; aspectRatio: { w: number; h: number } }; blur: { radius: number }; resize: { targetWidth: number; targetHeight: number } };
  onSave: (preset: TiffCropPreset) => void;
}) {
  const [label, setLabel] = useState("");

  const suffix = `_${settings.resize.targetWidth}x${settings.resize.targetHeight}`;
  const fullLabel = (label.trim() || "基本範囲") + suffix;

  const handleSave = () => {
    if (!settings.crop.bounds) return;
    const bounds = settings.crop.bounds;
    const preset: TiffCropPreset = {
      label: fullLabel,
      units: "px",
      bounds,
      size: { width: bounds.right - bounds.left, height: bounds.bottom - bounds.top },
      documentSize: { width: settings.resize.targetWidth, height: settings.resize.targetHeight },
      savedAt: new Date().toISOString(),
    };
    onSave(preset);
  };

  return (
    <div className="space-y-4">
      {!settings.crop.bounds ? (
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-text-muted">クロップ範囲が設定されていません</p>
          <p className="text-xs text-text-muted/70 mt-1">エディタでクロップ範囲を設定してから保存してください</p>
        </div>
      ) : (
        <>
          <div>
            <label className="text-xs text-text-muted block mb-1">ラベル名（プレフィックス）</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="例: 基本範囲"
              className="w-full px-3 py-2 text-sm bg-bg-elevated border border-border/50 rounded-lg text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:border-accent-warm/50"
            />
          </div>
          <div className="px-3 py-2 bg-bg-tertiary rounded-lg">
            <span className="text-[10px] text-text-muted">プレビュー: </span>
            <span className="text-xs text-text-primary font-medium">{fullLabel || suffix}</span>
          </div>
          <div className="text-xs text-text-muted space-y-0.5">
            <div>範囲: ({settings.crop.bounds.left}, {settings.crop.bounds.top}) → ({settings.crop.bounds.right}, {settings.crop.bounds.bottom})</div>
            <div>ぼかし半径: {settings.blur.radius}px</div>
          </div>
          <button
            onClick={handleSave}
            disabled={!label.trim()}
            className="w-full px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-accent-warm to-accent rounded-xl hover:-translate-y-0.5 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            保存
          </button>
        </>
      )}
    </div>
  );
}

// --- Create Tab ---
function CreateTab({ onCreated }: { onCreated: () => void }) {
  const genres = Object.keys(genreLabels);
  const [selectedGenre, setSelectedGenre] = useState(genres[0]);
  const [selectedLabel, setSelectedLabel] = useState("");
  const [title, setTitle] = useState("");

  const labels = genreLabels[selectedGenre] || [];

  useEffect(() => {
    setSelectedLabel(labels[0] || "");
  }, [selectedGenre]);

  const handleCreate = useCallback(async () => {
    if (!title.trim()) return;
    try {
      const { writeTextFile, mkdir } = await import("@tauri-apps/plugin-fs");
      const folderPath = `${basePath}/${selectedGenre}/${selectedLabel}/${title}`;

      await mkdir(folderPath, { recursive: true });

      const emptyData: TiffScandataFile = {
        presetData: {
          workInfo: {
            genre: selectedGenre,
            label: selectedLabel,
            title: title,
          },
          selectionRanges: [],
          createdAt: new Date().toISOString(),
        },
      };

      await writeTextFile(`${folderPath}/scandata.json`, JSON.stringify(emptyData, null, 2));
      onCreated();
    } catch (e) {
      // Error handling
    }
  }, [selectedGenre, selectedLabel, title, onCreated]);

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-text-muted block mb-1">ジャンル</label>
        <select
          value={selectedGenre}
          onChange={(e) => setSelectedGenre(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-bg-elevated border border-border/50 rounded-lg text-text-primary focus:outline-none"
        >
          {genres.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs text-text-muted block mb-1">レーベル</label>
        <select
          value={selectedLabel}
          onChange={(e) => setSelectedLabel(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-bg-elevated border border-border/50 rounded-lg text-text-primary focus:outline-none"
        >
          {labels.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-xs text-text-muted block mb-1">タイトル</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="作品名を入力"
          className="w-full px-3 py-2 text-sm bg-bg-elevated border border-border/50 rounded-lg text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:border-accent-warm/50"
        />
      </div>
      <div className="px-3 py-2 bg-bg-tertiary rounded-lg text-xs text-text-muted">
        作成先: {basePath}/{selectedGenre}/{selectedLabel}/{title || "..."}
      </div>
      <button
        onClick={handleCreate}
        disabled={!title.trim()}
        className="w-full px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-accent-warm to-accent rounded-xl hover:-translate-y-0.5 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
      >
        作成
      </button>
    </div>
  );
}
