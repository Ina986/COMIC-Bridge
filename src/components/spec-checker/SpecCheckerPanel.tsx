import { useMemo, useEffect } from "react";
import { usePsdStore } from "../../store/psdStore";
import { useSpecStore } from "../../store/specStore";
import { useSpecChecker } from "../../hooks/useSpecChecker";
import { usePhotoshopConverter } from "../../hooks/usePhotoshopConverter";

export function SpecCheckerPanel() {
  const files = usePsdStore((state) => state.files);
  const specifications = useSpecStore((state) => state.specifications);
  const activeSpecId = useSpecStore((state) => state.activeSpecId);
  const setActiveSpec = useSpecStore((state) => state.setActiveSpec);
  const toggleSpecification = useSpecStore((state) => state.toggleSpecification);
  const checkResults = useSpecStore((state) => state.checkResults);
  const conversionSettings = useSpecStore((state) => state.conversionSettings);
  const setConversionSettings = useSpecStore((state) => state.setConversionSettings);
  const conversionResults = useSpecStore((state) => state.conversionResults);

  const { checkAllFiles, isChecking } = useSpecChecker();
  const {
    isPhotoshopInstalled,
    isConverting: isPhotoshopConverting,
    convertWithPhotoshop,
  } = usePhotoshopConverter();

  // アクティブな仕様から変換設定を自動設定
  useEffect(() => {
    if (activeSpecId) {
      const activeSpec = specifications.find((s) => s.id === activeSpecId);
      if (activeSpec) {
        const newSettings: Partial<typeof conversionSettings> = {};

        for (const rule of activeSpec.rules) {
          if (rule.type === "colorMode" && rule.operator === "equals") {
            newSettings.targetColorMode = rule.value as "RGB" | "Grayscale";
          }
          if (rule.type === "bitsPerChannel" && rule.operator === "equals") {
            newSettings.targetBitDepth = rule.value as 8 | 16;
          }
          if (rule.type === "dpi" && rule.operator === "equals") {
            newSettings.targetDpi = rule.value as number;
          }
        }

        setConversionSettings(newSettings);
      }
    }
  }, [activeSpecId, specifications, setConversionSettings]);

  // Count passed/failed files
  const stats = useMemo(() => {
    let passed = 0;
    let failed = 0;
    let unchecked = 0;

    files.forEach((file) => {
      const result = checkResults.get(file.id);
      if (!result) {
        unchecked++;
      } else if (result.passed) {
        passed++;
      } else {
        failed++;
      }
    });

    return { passed, failed, unchecked };
  }, [files, checkResults]);

  const handleCheckAll = () => {
    const enabledSpecs = specifications.filter((s) => s.enabled);
    if (enabledSpecs.length > 0) {
      checkAllFiles(enabledSpecs);
    }
  };

  // 変換結果サマリー
  const conversionStats = useMemo(() => {
    const success = conversionResults.filter((r) => r.success).length;
    const failed = conversionResults.filter((r) => !r.success).length;
    return { success, failed, total: conversionResults.length };
  }, [conversionResults]);

  return (
    <div className="flex flex-col h-full">
      {/* Stats */}
      <div className="p-3 border-b border-white/5">
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-success/10 rounded-xl p-3 text-center border border-success/20">
            <div className="text-xl font-bold text-success">{stats.passed}</div>
            <div className="text-[10px] text-success/70 font-medium">OK</div>
          </div>
          <div className="bg-error/10 rounded-xl p-3 text-center border border-error/20">
            <div className="text-xl font-bold text-error">{stats.failed}</div>
            <div className="text-[10px] text-error/70 font-medium">NG</div>
          </div>
          <div className="bg-text-muted/10 rounded-xl p-3 text-center border border-text-muted/20">
            <div className="text-xl font-bold text-text-secondary">
              {stats.unchecked}
            </div>
            <div className="text-[10px] text-text-muted font-medium">未確認</div>
          </div>
        </div>
      </div>

      {/* Specifications List */}
      <div className="flex-1 overflow-auto p-3 space-y-4">
        <div>
          <h4 className="text-xs font-medium text-text-muted mb-2 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            仕様プリセット
          </h4>
          <div className="space-y-2">
            {specifications.map((spec) => (
              <div
                key={spec.id}
                className={`
                  p-3 rounded-xl cursor-pointer transition-all duration-200
                  ${activeSpecId === spec.id
                    ? "bg-accent/15 border-2 border-accent/50 shadow-glow-pink"
                    : "bg-bg-tertiary hover:bg-bg-elevated border border-white/5 hover:border-white/10"
                  }
                `}
                onClick={() => setActiveSpec(spec.id === activeSpecId ? null : spec.id)}
              >
                <div className="flex items-center gap-3">
                  <label className="relative flex items-center">
                    <input
                      type="checkbox"
                      checked={spec.enabled}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleSpecification(spec.id);
                      }}
                      className="sr-only peer"
                    />
                    <div className={`
                      w-5 h-5 rounded-lg border-2 transition-all duration-200
                      flex items-center justify-center
                      ${spec.enabled
                        ? "bg-gradient-to-br from-accent to-accent-secondary border-accent"
                        : "border-text-muted/50 hover:border-accent/50"
                      }
                    `}>
                      {spec.enabled && (
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </label>
                  <span className="text-sm text-text-primary font-medium">
                    {spec.name}
                  </span>
                </div>

                {/* Rules summary */}
                <div className="mt-2 pl-8 space-y-1">
                  {spec.rules.map((rule, index) => (
                    <div key={index} className="flex items-center gap-2 text-xs text-text-secondary">
                      <span className="w-1 h-1 rounded-full bg-text-muted" />
                      {formatRule(rule)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 変換設定 (NGファイルがある場合に表示) */}
        {stats.failed > 0 && activeSpecId && (
          <div className="bg-bg-tertiary rounded-xl p-3">
            <h4 className="text-xs font-medium text-text-muted mb-2 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              変換設定
            </h4>
            <div className="space-y-2">
              {conversionSettings.targetColorMode && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary">カラーモード</span>
                  <span className="text-accent font-medium">{conversionSettings.targetColorMode}</span>
                </div>
              )}
              {conversionSettings.targetBitDepth && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary">ビット深度</span>
                  <span className="text-accent font-medium">{conversionSettings.targetBitDepth}bit</span>
                </div>
              )}
              {conversionSettings.targetDpi && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary">解像度</span>
                  <span className="text-accent-tertiary font-medium">{conversionSettings.targetDpi}dpi (リサンプリング)</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 変換結果 */}
        {conversionResults.length > 0 && (
          <div className="bg-bg-tertiary rounded-xl p-3">
            <h4 className="text-xs font-medium text-text-muted mb-2 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              変換結果
            </h4>
            <div className="space-y-1 mb-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full bg-success" />
                <span className="text-success">{conversionStats.success} 成功</span>
              </div>
              {conversionStats.failed > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full bg-error" />
                  <span className="text-error">{conversionStats.failed} 失敗</span>
                </div>
              )}
            </div>
            <div className="max-h-32 overflow-auto space-y-1">
              {conversionResults.map((result) => (
                <div
                  key={result.fileId}
                  className={`text-xs p-2 rounded-lg ${
                    result.success ? "bg-success/10" : "bg-error/10"
                  }`}
                >
                  <div className="font-medium text-text-primary truncate">{result.fileName}</div>
                  {result.changes.map((change, i) => (
                    <div key={i} className="text-text-secondary">{change}</div>
                  ))}
                  {result.error && <div className="text-error">{result.error}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="p-3 border-t border-white/5 space-y-2">
        {/* Check Button */}
        <button
          className="
            w-full px-4 py-3 text-sm font-medium rounded-xl text-white
            bg-gradient-to-r from-accent to-accent-secondary
            shadow-glow-pink
            hover:shadow-[0_6px_20px_rgba(255,107,157,0.4)]
            hover:-translate-y-0.5
            transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
            flex items-center justify-center gap-2
          "
          onClick={handleCheckAll}
          disabled={
            isChecking ||
            files.length === 0 ||
            specifications.filter((s) => s.enabled).length === 0
          }
        >
          {isChecking ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              チェック中...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              すべてチェック
            </>
          )}
        </button>

        {/* Convert Button (NGファイルがある場合) */}
        {stats.failed > 0 && (
          <div className="space-y-2">
            {/* Photoshop変換ボタン */}
            {isPhotoshopInstalled ? (
              <button
                className="
                  w-full px-4 py-3 text-sm font-medium rounded-xl text-white
                  bg-gradient-to-r from-[#31A8FF] to-[#001E36]
                  shadow-[0_4px_15px_rgba(49,168,255,0.3)]
                  hover:shadow-[0_6px_20px_rgba(49,168,255,0.4)]
                  hover:-translate-y-0.5
                  transition-all duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
                  flex items-center justify-center gap-2
                "
                onClick={convertWithPhotoshop}
                disabled={isPhotoshopConverting || !activeSpecId}
              >
                {isPhotoshopConverting ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Photoshopで変換中...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9.85 8.42c-.37-.15-.77-.21-1.18-.2H7.2v3.03h1.35c.41 0 .82-.07 1.18-.23.26-.12.47-.31.61-.56.14-.25.21-.54.21-.86 0-.32-.07-.61-.2-.85a1.3 1.3 0 0 0-.5-.33zM12 0C5.38 0 0 5.38 0 12s5.38 12 12 12 12-5.38 12-12S18.62 0 12 0zm-2.8 14.48H7.2v2.7H5V6.77h3.72c.67-.01 1.33.09 1.96.3.53.17 1.01.44 1.42.82.37.35.66.77.85 1.24.19.47.29.97.28 1.48 0 .51-.1 1.01-.28 1.48-.19.47-.48.89-.85 1.24-.41.38-.89.65-1.42.82-.63.21-1.3.32-1.96.33h.48zm7.44.72c.2.24.48.4.79.46.34.07.69.06 1.02-.03.25-.06.5-.16.72-.29.24-.14.44-.32.6-.53l1.17 1.05c-.33.4-.75.72-1.23.91-.53.23-1.11.34-1.69.33-.51 0-1.01-.09-1.48-.28-.43-.17-.82-.43-1.14-.77-.31-.34-.55-.74-.71-1.18-.17-.48-.25-.99-.25-1.5 0-.51.08-1.02.26-1.5.16-.44.4-.84.72-1.19.31-.34.69-.6 1.11-.78.46-.19.96-.29 1.46-.28.45-.01.91.07 1.33.24.37.15.71.38.97.68.27.32.47.69.58 1.09.13.46.19.94.18 1.43v.77h-4.65c.01.3.12.58.31.8zm2.31-3.03c-.17-.26-.4-.48-.67-.63-.28-.15-.59-.22-.91-.21-.31 0-.62.07-.91.22-.26.13-.49.32-.67.56-.18.24-.31.51-.39.8h3.62c-.04-.27-.12-.53-.26-.77z"/>
                    </svg>
                    Photoshopで変換 ({stats.failed}件)
                  </>
                )}
              </button>
            ) : (
              <div className="text-xs text-text-muted text-center px-2 py-3 bg-bg-tertiary rounded-xl">
                ※ Photoshopが見つかりません。変換にはPhotoshopが必要です。
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatRule(rule: { type: string; operator: string; value: unknown }): string {
  const typeLabels: Record<string, string> = {
    colorMode: "カラーモード",
    dpi: "解像度",
    bitsPerChannel: "ビット深度",
    hasGuides: "ガイド",
    dimensions: "サイズ",
  };

  const type = typeLabels[rule.type] || rule.type;

  switch (rule.operator) {
    case "equals":
      return `${type}: ${rule.value}`;
    case "greaterThan":
      return `${type}: ${rule.value} 以上`;
    case "lessThan":
      return `${type}: ${rule.value} 以下`;
    default:
      return `${type}: ${rule.value}`;
  }
}
