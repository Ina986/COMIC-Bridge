import { useState } from "react";
import { useLayerStore, PRESET_CONDITIONS, type HideCondition, type LayerActionMode } from "../../store/layerStore";
import { usePsdStore } from "../../store/psdStore";
import { useLayerControl } from "../../hooks/useLayerControl";

export function LayerControlPanel() {
  const [customName, setCustomName] = useState("");
  const [customType, setCustomType] = useState<"layerName" | "folderName">("layerName");
  const [partialMatch, setPartialMatch] = useState(true);
  const [resultMessage, setResultMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const selectedConditions = useLayerStore((state) => state.selectedConditions);
  const customConditions = useLayerStore((state) => state.customConditions);
  const toggleCondition = useLayerStore((state) => state.toggleCondition);
  const addCustomCondition = useLayerStore((state) => state.addCustomCondition);
  const removeCustomCondition = useLayerStore((state) => state.removeCustomCondition);
  const isProcessing = useLayerStore((state) => state.isProcessing);
  const actionMode = useLayerStore((state) => state.actionMode);
  const setActionMode = useLayerStore((state) => state.setActionMode);

  const files = usePsdStore((state) => state.files);
  const selectedFileIds = usePsdStore((state) => state.selectedFileIds);

  const { applyLayerVisibility } = useLayerControl();

  const targetCount = selectedFileIds.length > 0 ? selectedFileIds.length : files.length;
  const isHideMode = actionMode === "hide";

  const handleAddCustom = () => {
    if (!customName.trim()) return;
    addCustomCondition({
      name: `「${customName}」${customType === "layerName" ? "レイヤー" : "フォルダ"}`,
      type: customType,
      value: customName,
      partialMatch,
    });
    setCustomName("");
  };

  const handleApply = async () => {
    setResultMessage(null);
    try {
      const results = await applyLayerVisibility();
      if (results) {
        const successCount = results.filter((r) => r.success).length;
        const totalChanged = results.reduce((acc, r) => acc + r.changedCount, 0);
        const errorCount = results.filter((r) => !r.success).length;

        if (errorCount > 0) {
          setResultMessage({
            text: `${errorCount}件でエラーが発生しました`,
            type: "error",
          });
        } else if (totalChanged > 0) {
          setResultMessage({
            text: `${successCount}ファイル, ${totalChanged}レイヤーを${isHideMode ? "非表示" : "表示"}にしました`,
            type: "success",
          });
        } else {
          setResultMessage({
            text: "条件に一致するレイヤーがありませんでした",
            type: "success",
          });
        }

        // 5秒後にメッセージを消す
        setTimeout(() => setResultMessage(null), 5000);
      }
    } catch (error) {
      setResultMessage({
        text: error instanceof Error ? error.message : "Photoshopの実行に失敗しました",
        type: "error",
      });
      setTimeout(() => setResultMessage(null), 8000);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* ヘッダー */}
      <div className="px-4 py-3 border-b border-white/5">
        <h3 className="text-sm font-display font-medium text-text-primary flex items-center gap-2">
          <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          レイヤー可視性
        </h3>
        <p className="text-xs text-text-muted mt-1">
          条件を選択してレイヤーを一括操作
        </p>
      </div>

      {/* 条件リスト */}
      <div className="flex-1 overflow-auto p-3 space-y-4">
        {/* モード切り替え */}
        <div className="bg-bg-tertiary rounded-xl p-1 flex gap-1">
          <ModeButton
            mode="hide"
            label="非表示にする"
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            }
            currentMode={actionMode}
            onChange={setActionMode}
          />
          <ModeButton
            mode="show"
            label="表示する"
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            }
            currentMode={actionMode}
            onChange={setActionMode}
          />
        </div>

        {/* プリセット条件 */}
        <div>
          <h4 className="text-xs font-medium text-text-muted mb-2">プリセット条件</h4>
          <div className="space-y-1.5">
            {PRESET_CONDITIONS.map((condition) => (
              <ConditionItem
                key={condition.id}
                condition={condition}
                isSelected={selectedConditions.includes(condition.id)}
                onToggle={() => toggleCondition(condition.id)}
                isHideMode={isHideMode}
              />
            ))}
          </div>
        </div>

        {/* カスタム条件 */}
        {customConditions.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-text-muted mb-2">カスタム条件</h4>
            <div className="space-y-1.5">
              {customConditions.map((condition) => (
                <ConditionItem
                  key={condition.id}
                  condition={condition}
                  isSelected={selectedConditions.includes(condition.id)}
                  onToggle={() => toggleCondition(condition.id)}
                  onRemove={() => removeCustomCondition(condition.id)}
                  isCustom
                  isHideMode={isHideMode}
                />
              ))}
            </div>
          </div>
        )}

        {/* カスタム条件追加 */}
        <div className="bg-bg-tertiary rounded-xl p-3">
          <h4 className="text-xs font-medium text-text-muted mb-2">条件を追加</h4>
          <div className="space-y-2">
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="レイヤー/フォルダ名"
              className="w-full bg-bg-elevated border border-white/10 rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent focus:outline-none"
            />
            <div className="flex gap-2">
              <select
                value={customType}
                onChange={(e) => setCustomType(e.target.value as "layerName" | "folderName")}
                className="flex-1 bg-bg-elevated border border-white/10 rounded-lg px-2 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
              >
                <option value="layerName">レイヤー名</option>
                <option value="folderName">フォルダ名</option>
              </select>
              <label className="flex items-center gap-1.5 text-xs text-text-secondary">
                <input
                  type="checkbox"
                  checked={partialMatch}
                  onChange={(e) => setPartialMatch(e.target.checked)}
                  className="rounded"
                />
                部分一致
              </label>
            </div>
            <button
              onClick={handleAddCustom}
              disabled={!customName.trim()}
              className="
                w-full px-3 py-2 text-xs font-medium rounded-lg
                bg-bg-elevated text-text-primary
                border border-white/10 hover:border-accent/30
                hover:bg-accent/10
                transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              + 追加
            </button>
          </div>
        </div>
      </div>

      {/* アクションバー */}
      <div className="p-3 border-t border-white/5 space-y-2">
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>対象: {targetCount} ファイル</span>
          <span>{selectedConditions.length} 条件選択中</span>
        </div>
        <button
          onClick={handleApply}
          disabled={isProcessing || selectedConditions.length === 0 || files.length === 0}
          className={`
            w-full px-4 py-3 text-sm font-medium rounded-xl text-white
            ${isHideMode
              ? "bg-gradient-to-r from-accent to-accent-secondary shadow-glow-pink hover:shadow-[0_6px_20px_rgba(255,107,157,0.4)]"
              : "bg-gradient-to-r from-accent-tertiary to-manga-sky shadow-[0_4px_15px_rgba(0,212,170,0.3)] hover:shadow-[0_6px_20px_rgba(0,212,170,0.4)]"
            }
            hover:-translate-y-0.5
            transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
            flex items-center justify-center gap-2
          `}
        >
          {isProcessing ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              処理中...
            </>
          ) : isHideMode ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
              非表示を適用
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              表示を適用
            </>
          )}
        </button>
        {/* 結果メッセージ */}
        {resultMessage && (
          <div
            className={`text-xs px-3 py-2 rounded-lg text-center transition-all duration-300 ${
              resultMessage.type === "success"
                ? "bg-success/15 text-success"
                : "bg-error/15 text-error"
            }`}
          >
            {resultMessage.text}
          </div>
        )}
      </div>
    </div>
  );
}

// モードボタンコンポーネント
function ModeButton({
  mode,
  label,
  icon,
  currentMode,
  onChange,
}: {
  mode: LayerActionMode;
  label: string;
  icon: React.ReactNode;
  currentMode: LayerActionMode;
  onChange: (mode: LayerActionMode) => void;
}) {
  const isSelected = currentMode === mode;
  const isHide = mode === "hide";

  return (
    <button
      className={`
        flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-all duration-200
        flex items-center justify-center gap-1.5
        ${isSelected
          ? isHide
            ? "bg-accent text-white"
            : "bg-accent-tertiary text-white"
          : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
        }
      `}
      onClick={() => onChange(mode)}
    >
      {icon}
      {label}
    </button>
  );
}

// 条件アイテムコンポーネント
function ConditionItem({
  condition,
  isSelected,
  onToggle,
  onRemove,
  isCustom = false,
  isHideMode = true,
}: {
  condition: HideCondition;
  isSelected: boolean;
  onToggle: () => void;
  onRemove?: () => void;
  isCustom?: boolean;
  isHideMode?: boolean;
}) {
  return (
    <div
      className={`
        flex items-center gap-2 p-2.5 rounded-xl cursor-pointer transition-all duration-200
        ${isSelected
          ? isHideMode
            ? "bg-accent/15 border border-accent/50"
            : "bg-accent-tertiary/15 border border-accent-tertiary/50"
          : "bg-bg-tertiary border border-white/5 hover:border-white/10"
        }
      `}
      onClick={onToggle}
    >
      <div
        className={`
          w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all duration-200
          ${isSelected
            ? isHideMode
              ? "bg-gradient-to-br from-accent to-accent-secondary border-accent"
              : "bg-gradient-to-br from-accent-tertiary to-manga-sky border-accent-tertiary"
            : "border-text-muted/50"
          }
        `}
      >
        {isSelected && (
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )}
      </div>
      <span className="text-sm text-text-primary flex-1">{condition.name}</span>
      {isCustom && onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="p-1 text-text-muted hover:text-error transition-colors rounded"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
