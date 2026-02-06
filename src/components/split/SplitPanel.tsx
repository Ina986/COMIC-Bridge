import { usePsdStore } from "../../store/psdStore";
import { useSplitStore, type SplitMode, type OutputFormat } from "../../store/splitStore";
import { useSplitProcessor } from "../../hooks/useSplitProcessor";

export function SplitPanel() {
  const files = usePsdStore((state) => state.files);
  const selectedFileIds = usePsdStore((state) => state.selectedFileIds);

  const settings = useSplitStore((state) => state.settings);
  const setSettings = useSplitStore((state) => state.setSettings);
  const isProcessing = useSplitStore((state) => state.isProcessing);
  const progress = useSplitStore((state) => state.progress);
  const totalFiles = useSplitStore((state) => state.totalFiles);
  const currentFile = useSplitStore((state) => state.currentFile);
  const results = useSplitStore((state) => state.results);

  const { splitSelectedFiles } = useSplitProcessor();

  const targetCount = selectedFileIds.length > 0 ? selectedFileIds.length : files.length;

  const successCount = results.filter((r) => r.success).length;
  const totalOutputFiles = results.reduce((acc, r) => acc + r.outputFiles.length, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5">
        <h3 className="text-sm font-display font-medium text-text-primary flex items-center gap-2">
          <svg className="w-4 h-4 text-accent-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          見開き分割
        </h3>
        <p className="text-xs text-text-muted mt-1">
          Photoshopで見開きページを左右に分割
        </p>
      </div>

      {/* Settings */}
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {/* Split Mode */}
        <div className="bg-bg-tertiary rounded-xl p-3">
          <h4 className="text-xs font-medium text-text-muted mb-2">分割モード</h4>
          <div className="space-y-1.5">
            <ModeOption
              mode="even"
              label="均等分割"
              description="中央で左右均等に分割"
              currentMode={settings.mode}
              onChange={(mode) => setSettings({ mode })}
            />
            <ModeOption
              mode="uneven"
              label="不均等分割"
              description="ノド側に余白を追加して均等化"
              currentMode={settings.mode}
              onChange={(mode) => setSettings({ mode })}
            />
            <ModeOption
              mode="none"
              label="分割なし"
              description="フォーマット変換のみ"
              currentMode={settings.mode}
              onChange={(mode) => setSettings({ mode })}
            />
          </div>
        </div>

        {/* Uneven Split Settings */}
        {settings.mode === "uneven" && (
          <div className="bg-bg-tertiary rounded-xl p-3">
            <h4 className="text-xs font-medium text-text-muted mb-2">ノド余白</h4>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={settings.outerMargin}
                onChange={(e) => setSettings({ outerMargin: parseInt(e.target.value) || 0 })}
                className="flex-1 bg-bg-elevated border border-white/10 rounded-lg px-3 py-2 text-sm text-text-primary focus:border-accent-tertiary focus:outline-none"
                min={0}
              />
              <span className="text-xs text-text-muted">px</span>
            </div>
            <p className="text-[10px] text-text-muted mt-1.5">
              ノド（綴じ）側に追加する余白。左右の余白が均等になるように調整されます
            </p>
          </div>
        )}

        {/* Output Format */}
        <div className="bg-bg-tertiary rounded-xl p-3">
          <h4 className="text-xs font-medium text-text-muted mb-2">出力形式</h4>
          <div className="flex gap-2">
            <FormatButton
              format="psd"
              label="PSD"
              currentFormat={settings.outputFormat}
              onChange={(format) => setSettings({ outputFormat: format })}
            />
            <FormatButton
              format="jpg"
              label="JPG"
              currentFormat={settings.outputFormat}
              onChange={(format) => setSettings({ outputFormat: format })}
            />
          </div>
          {settings.outputFormat === "jpg" && (
            <div className="mt-3">
              <label className="text-xs text-text-secondary mb-1 block">
                画質: {settings.jpgQuality}%
              </label>
              <input
                type="range"
                min="50"
                max="100"
                value={settings.jpgQuality}
                onChange={(e) => setSettings({ jpgQuality: parseInt(e.target.value) })}
                className="w-full accent-accent-tertiary"
              />
            </div>
          )}
        </div>

        {/* Options */}
        {settings.mode !== "none" && (
          <div className="bg-bg-tertiary rounded-xl p-3">
            <h4 className="text-xs font-medium text-text-muted mb-2">オプション</h4>
            <div className="space-y-2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.deleteHiddenLayers}
                  onChange={(e) => setSettings({ deleteHiddenLayers: e.target.checked })}
                  className="rounded accent-accent-tertiary"
                />
                <div>
                  <span className="text-sm text-text-primary">非表示レイヤーを削除</span>
                  <p className="text-[10px] text-text-muted">ファイルサイズを削減</p>
                </div>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.deleteOffCanvasText}
                  onChange={(e) => setSettings({ deleteOffCanvasText: e.target.checked })}
                  className="rounded accent-accent-tertiary"
                />
                <div>
                  <span className="text-sm text-text-primary">はみ出しテキストを削除</span>
                  <p className="text-[10px] text-text-muted">反対側にはみ出したテキストレイヤーを除去</p>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Processing Status */}
        {isProcessing && (
          <div className="bg-accent-tertiary/10 rounded-xl p-3 border border-accent-tertiary/30">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-4 h-4 rounded-full border-2 border-accent-tertiary/30 border-t-accent-tertiary animate-spin" />
              <span className="text-sm text-accent-tertiary font-medium">Photoshopで処理中...</span>
            </div>
            {currentFile && (
              <p className="text-xs text-text-muted truncate">{currentFile}</p>
            )}
            <div className="mt-2 bg-bg-elevated rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-accent-tertiary to-accent-secondary transition-all duration-300"
                style={{ width: `${totalFiles > 0 ? (progress / totalFiles) * 100 : 0}%` }}
              />
            </div>
            <p className="text-xs text-text-muted mt-1 text-right">
              {progress} / {totalFiles}
            </p>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && !isProcessing && (
          <div className="bg-bg-tertiary rounded-xl p-3">
            <h4 className="text-xs font-medium text-text-muted mb-2">処理結果</h4>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full bg-success" />
                <span className="text-success">{successCount} ファイル成功</span>
              </div>
              {totalOutputFiles > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full bg-accent-tertiary" />
                  <span className="text-text-secondary">{totalOutputFiles} ファイル出力</span>
                </div>
              )}
              {results.some((r) => !r.success) && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full bg-error" />
                  <span className="text-error">
                    {results.filter((r) => !r.success).length} ファイル失敗
                  </span>
                </div>
              )}
              {/* Error details */}
              {results
                .filter((r) => !r.success && r.error)
                .slice(0, 3)
                .map((r, i) => (
                  <p key={i} className="text-[10px] text-error/80 truncate pl-4">
                    {r.fileName}: {r.error}
                  </p>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Action Bar */}
      <div className="p-3 border-t border-white/5 space-y-2">
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>対象: {targetCount} ファイル</span>
          <span>
            {settings.mode === "none"
              ? "変換のみ"
              : settings.mode === "uneven"
                ? "不均等分割"
                : "均等分割"}
          </span>
        </div>
        <button
          onClick={splitSelectedFiles}
          disabled={isProcessing || files.length === 0}
          className="
            w-full px-4 py-3 text-sm font-medium rounded-xl text-white
            bg-gradient-to-r from-accent-tertiary to-accent-secondary
            shadow-[0_4px_15px_rgba(0,212,170,0.3)]
            hover:shadow-[0_6px_20px_rgba(0,212,170,0.4)]
            hover:-translate-y-0.5
            transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
            flex items-center justify-center gap-2
          "
        >
          {isProcessing ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Photoshopで処理中...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              分割を実行
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// Mode Option Component
function ModeOption({
  mode,
  label,
  description,
  currentMode,
  onChange,
}: {
  mode: SplitMode;
  label: string;
  description: string;
  currentMode: SplitMode;
  onChange: (mode: SplitMode) => void;
}) {
  const isSelected = currentMode === mode;

  return (
    <div
      className={`
        flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all duration-200
        ${isSelected
          ? "bg-accent-tertiary/15 border border-accent-tertiary/50"
          : "bg-bg-elevated border border-white/5 hover:border-white/10"
        }
      `}
      onClick={() => onChange(mode)}
    >
      <div
        className={`
          w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200
          ${isSelected
            ? "border-accent-tertiary bg-accent-tertiary"
            : "border-text-muted/50"
          }
        `}
      >
        {isSelected && (
          <div className="w-2 h-2 rounded-full bg-white" />
        )}
      </div>
      <div className="flex-1">
        <span className="text-sm text-text-primary">{label}</span>
        <p className="text-xs text-text-muted">{description}</p>
      </div>
    </div>
  );
}

// Format Button Component
function FormatButton({
  format,
  label,
  currentFormat,
  onChange,
}: {
  format: OutputFormat;
  label: string;
  currentFormat: OutputFormat;
  onChange: (format: OutputFormat) => void;
}) {
  const isSelected = currentFormat === format;

  return (
    <button
      className={`
        flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200
        ${isSelected
          ? "bg-accent-tertiary text-white"
          : "bg-bg-elevated text-text-secondary hover:text-text-primary border border-white/10"
        }
      `}
      onClick={() => onChange(format)}
    >
      {label}
    </button>
  );
}
