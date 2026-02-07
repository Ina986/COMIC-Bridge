import { useMemo, useEffect, useState } from "react";
import { usePsdStore } from "../../store/psdStore";
import { useSpecStore } from "../../store/specStore";
import { useGuideStore } from "../../store/guideStore";
import { useSpecChecker } from "../../hooks/useSpecChecker";
import { usePhotoshopConverter } from "../../hooks/usePhotoshopConverter";
import { usePreparePsd } from "../../hooks/usePreparePsd";
import { usePhotoshopShortcut } from "../../hooks/useOpenInPhotoshop";
import { SpecCheckTable } from "../spec-checker/SpecCheckTable";
import { PreviewGrid } from "../preview/PreviewGrid";
import { DetailSlidePanel } from "../common/DetailSlidePanel";
import { DropZone } from "../file-browser/DropZone";
import { THUMBNAIL_SIZES, type ThumbnailSize } from "../../types";

export function SpecCheckView() {
  const files = usePsdStore((state) => state.files);
  const selectedFileIds = usePsdStore((state) => state.selectedFileIds);
  const viewMode = usePsdStore((state) => state.viewMode);
  const thumbnailSize = usePsdStore((state) => state.thumbnailSize);
  const setViewMode = usePsdStore((state) => state.setViewMode);
  const setThumbnailSize = usePsdStore((state) => state.setThumbnailSize);
  const selectAll = usePsdStore((state) => state.selectAll);
  const clearSelection = usePsdStore((state) => state.clearSelection);

  const specifications = useSpecStore((state) => state.specifications);
  const activeSpecId = useSpecStore((state) => state.activeSpecId);
  const setActiveSpec = useSpecStore((state) => state.setActiveSpec);
  const checkResults = useSpecStore((state) => state.checkResults);
  const conversionSettings = useSpecStore((state) => state.conversionSettings);
  const setConversionSettings = useSpecStore((state) => state.setConversionSettings);
  const conversionResults = useSpecStore((state) => state.conversionResults);
  const clearConversionResults = useSpecStore((state) => state.clearConversionResults);

  const guides = useGuideStore((state) => state.guides);
  const openEditor = useGuideStore((state) => state.openEditor);

  const [fixSpec, setFixSpec] = useState(true);
  const [applyGuidesChecked, setApplyGuidesChecked] = useState(true);
  const [showResults, setShowResults] = useState(false);

  const { checkAllFiles, isChecking } = useSpecChecker();
  const { isPhotoshopInstalled, isConverting } = usePhotoshopConverter();
  const { isProcessing, prepareFiles } = usePreparePsd();
  usePhotoshopShortcut();

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

  // 変換結果が追加されたらバナーを表示
  useEffect(() => {
    if (conversionResults.length > 0) {
      setShowResults(true);
    }
  }, [conversionResults.length]);

  const stats = useMemo(() => {
    let passed = 0;
    let failed = 0;
    let unchecked = 0;
    let noGuides = 0;
    files.forEach((file) => {
      const result = checkResults.get(file.id);
      if (!result) unchecked++;
      else if (result.passed) passed++;
      else failed++;
      if (file.metadata && !file.metadata.hasGuides) noGuides++;
    });
    return { passed, failed, unchecked, noGuides };
  }, [files, checkResults]);

  // NG ファイルのみ選択
  const selectNGOnly = () => {
    const ngIds = files
      .filter((f) => {
        const r = checkResults.get(f.id);
        return r && !r.passed;
      })
      .map((f) => f.id);
    usePsdStore.setState({ selectedFileIds: ngIds, activeFileId: ngIds[0] || null });
  };

  // ガイドなしファイルのみ選択
  const selectNoGuidesOnly = () => {
    const noGuideIds = files
      .filter((f) => f.metadata && !f.metadata.hasGuides)
      .map((f) => f.id);
    usePsdStore.setState({ selectedFileIds: noGuideIds, activeFileId: noGuideIds[0] || null });
  };

  // 手動再チェック
  const handleRecheck = () => {
    const enabledSpecs = specifications.filter((s) => s.enabled);
    if (enabledSpecs.length > 0) {
      checkAllFiles(enabledSpecs);
    }
  };

  // 変換結果の集計
  const resultStats = useMemo(() => {
    if (conversionResults.length === 0) return null;
    const successCount = conversionResults.filter((r) => r.success).length;
    const errorCount = conversionResults.filter((r) => !r.success).length;
    const allChanges = conversionResults.flatMap((r) => r.changes).filter((c) => c !== "No changes needed");
    return { successCount, errorCount, totalChanges: allChanges.length };
  }, [conversionResults]);

  // 一括処理対象の説明テキスト
  const processTargetText = useMemo(() => {
    if (selectedFileIds.length > 0) {
      return `選択中${selectedFileIds.length}件`;
    }
    return "全対象";
  }, [selectedFileIds.length]);

  const hasFiles = files.length > 0;

  if (!hasFiles) {
    return <DropZone />;
  }

  const noSpecSelected = !activeSpecId;
  const hasChecked = checkResults.size > 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="px-4 py-2 bg-bg-secondary border-b border-border flex items-center gap-4 flex-shrink-0">
        {/* Spec Presets */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted flex-shrink-0">仕様:</span>
          {specifications.map((spec) => (
            <button
              key={spec.id}
              className={`
                px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200
                ${activeSpecId === spec.id
                  ? "text-white bg-gradient-to-r from-accent to-accent-secondary shadow-sm"
                  : "text-text-secondary bg-bg-tertiary hover:text-text-primary hover:bg-bg-elevated border border-border"
                }
              `}
              onClick={() => setActiveSpec(spec.id === activeSpecId ? null : spec.id)}
            >
              {spec.name}
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="w-px h-5 bg-border flex-shrink-0" />

        {/* Stats */}
        <div className="flex items-center gap-3">
          {hasChecked && (
            <>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-success" />
                <span className="text-xs font-medium text-success">{stats.passed}</span>
                <span className="text-xs text-text-muted">OK</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-error" />
                <span className="text-xs font-medium text-error">{stats.failed}</span>
                <span className="text-xs text-text-muted">NG</span>
              </div>
            </>
          )}
          {stats.noGuides > 0 && (
            <>
              <div className="w-px h-3 bg-border flex-shrink-0" />
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-warning" />
                <span className="text-xs font-medium text-warning">{stats.noGuides}</span>
                <span className="text-xs text-text-muted">ガイドなし</span>
              </div>
            </>
          )}
          {/* Re-check button (subtle) */}
          {hasChecked && (
            <button
              onClick={handleRecheck}
              disabled={isChecking}
              className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors disabled:opacity-50"
              title="再チェック"
            >
              <svg className={`w-3.5 h-3.5 ${isChecking ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* View Mode Toggle + Thumbnail Size */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-bg-tertiary rounded-lg p-0.5">
            <button
              className={`p-1.5 rounded-md transition-all duration-200 ${
                viewMode === "grid"
                  ? "bg-gradient-to-r from-accent to-accent-secondary text-white shadow-sm"
                  : "text-text-secondary hover:text-text-primary"
              }`}
              onClick={() => setViewMode("grid")}
              title="グリッド表示"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              className={`p-1.5 rounded-md transition-all duration-200 ${
                viewMode === "list"
                  ? "bg-gradient-to-r from-accent to-accent-secondary text-white shadow-sm"
                  : "text-text-secondary hover:text-text-primary"
              }`}
              onClick={() => setViewMode("list")}
              title="テーブル表示"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {viewMode === "grid" && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">サイズ:</span>
              <select
                className="bg-bg-tertiary border border-border rounded-md text-xs py-1 px-2 text-text-primary focus:border-accent focus:outline-none"
                value={thumbnailSize}
                onChange={(e) => setThumbnailSize(e.target.value as ThumbnailSize)}
              >
                {Object.entries(THUMBNAIL_SIZES).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Guidance Banner - when no spec selected */}
      {noSpecSelected && !hasChecked && (
        <div className="px-4 py-3 bg-accent/5 border-b border-accent/20 flex items-center gap-3 flex-shrink-0">
          <div className="w-6 h-6 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-xs text-text-primary font-medium">
              上の仕様ボタンを選択するとチェックが自動実行されます
            </p>
            <p className="text-[11px] text-text-muted mt-0.5">
              モノクロ原稿 (Grayscale/600dpi/8bit) またはカラー原稿 (RGB/350dpi/8bit) を選択
            </p>
          </div>
        </div>
      )}

      {/* Conversion Results Banner */}
      {showResults && resultStats && (
        <div className={`px-4 py-2 border-b flex items-center gap-3 flex-shrink-0 ${
          resultStats.errorCount > 0
            ? "bg-warning/5 border-warning/20"
            : "bg-success/5 border-success/20"
        }`}>
          <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
            resultStats.errorCount > 0 ? "bg-warning/15" : "bg-success/15"
          }`}>
            {resultStats.errorCount > 0 ? (
              <svg className="w-3 h-3 text-warning" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-3 h-3 text-success" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <div className="flex-1 text-xs">
            <span className="text-text-primary font-medium">
              処理完了:
            </span>
            {resultStats.successCount > 0 && (
              <span className="text-success ml-1.5">
                {resultStats.successCount}件成功
              </span>
            )}
            {resultStats.errorCount > 0 && (
              <span className="text-error ml-1.5">
                {resultStats.errorCount}件エラー
              </span>
            )}
            {resultStats.totalChanges > 0 && (
              <span className="text-text-muted ml-1.5">
                ({resultStats.totalChanges}変更)
              </span>
            )}
          </div>
          <button
            onClick={() => {
              setShowResults(false);
              clearConversionResults();
            }}
            className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-hidden relative" data-preview-grid>
        {viewMode === "grid" ? <PreviewGrid /> : <SpecCheckTable />}
        <DetailSlidePanel />
      </div>

      {/* Bottom Action Bar */}
      <div className="px-4 py-2.5 bg-bg-secondary border-t border-border flex-shrink-0 space-y-2">
        {/* Top row: File info + Selection */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-text-muted">
            {files.length} ファイル
          </span>
          {selectedFileIds.length > 0 && (
            <>
              <span className="text-text-muted">/</span>
              <span className="text-accent font-medium">
                {selectedFileIds.length}件選択中
              </span>
            </>
          )}
          <div className="flex-1" />
          {stats.failed > 0 && (
            <button
              className="px-2 py-0.5 text-[11px] text-error hover:bg-error/10 rounded transition-colors font-medium"
              onClick={selectNGOnly}
            >
              NGのみ
            </button>
          )}
          {stats.noGuides > 0 && (
            <button
              className="px-2 py-0.5 text-[11px] text-warning hover:bg-warning/10 rounded transition-colors font-medium"
              onClick={selectNoGuidesOnly}
            >
              ガイドなし
            </button>
          )}
          <button
            className="px-2 py-0.5 text-[11px] text-text-muted hover:text-text-primary hover:bg-bg-tertiary rounded transition-colors"
            onClick={selectedFileIds.length > 0 ? clearSelection : selectAll}
          >
            {selectedFileIds.length > 0 ? "選択解除" : "全選択"}
          </button>
        </div>

        {/* Bottom row: Action buttons */}
        <div className="flex items-center gap-2">
          {/* Guide Edit Button */}
          <button
            className="h-9 px-4 text-sm font-medium rounded-lg bg-bg-tertiary text-text-primary border border-border hover:border-guide-v/40 hover:bg-guide-v/10 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            onClick={openEditor}
            disabled={files.length === 0}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
            ガイド編集
            {guides.length > 0 && (
              <span className="px-1.5 py-0.5 bg-guide-v/20 text-guide-v rounded text-[11px] font-semibold">
                {guides.length}
              </span>
            )}
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Batch Processing Controls */}
          {isPhotoshopInstalled && (stats.failed > 0 || (stats.noGuides > 0 && guides.length > 0)) && (
            <>
              {/* Toggle Buttons */}
              <div className="flex items-center gap-1 bg-bg-tertiary rounded-lg p-0.5">
                {stats.failed > 0 && (
                  <button
                    onClick={() => setFixSpec(!fixSpec)}
                    className={`
                      h-8 px-3 text-xs font-medium rounded-md transition-all duration-200
                      flex items-center gap-1.5
                      ${fixSpec
                        ? "bg-error/15 text-error shadow-sm"
                        : "text-text-muted hover:text-text-secondary"
                      }
                    `}
                  >
                    <span className={`w-2 h-2 rounded-full transition-colors ${fixSpec ? "bg-error" : "bg-text-muted/30"}`} />
                    仕様修正
                  </button>
                )}
                {stats.noGuides > 0 && guides.length > 0 && (
                  <button
                    onClick={() => setApplyGuidesChecked(!applyGuidesChecked)}
                    className={`
                      h-8 px-3 text-xs font-medium rounded-md transition-all duration-200
                      flex items-center gap-1.5
                      ${applyGuidesChecked
                        ? "bg-guide-v/15 text-guide-v shadow-sm"
                        : "text-text-muted hover:text-text-secondary"
                      }
                    `}
                  >
                    <span className={`w-2 h-2 rounded-full transition-colors ${applyGuidesChecked ? "bg-guide-v" : "bg-text-muted/30"}`} />
                    ガイド適用
                  </button>
                )}
              </div>

              {/* Unified Process Button */}
              <button
                className="h-9 px-5 text-sm font-semibold rounded-lg text-white bg-gradient-to-r from-[#31A8FF] to-[#0066CC] shadow-[0_2px_10px_rgba(49,168,255,0.3)] hover:shadow-[0_4px_15px_rgba(49,168,255,0.4)] hover:brightness-110 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                onClick={() => prepareFiles({
                  fixSpec: fixSpec && stats.failed > 0,
                  applyGuides: applyGuidesChecked && stats.noGuides > 0 && guides.length > 0,
                  fileIds: selectedFileIds.length > 0 ? selectedFileIds : undefined,
                })}
                disabled={
                  isConverting || isProcessing ||
                  (!fixSpec && !applyGuidesChecked) ||
                  (fixSpec && stats.failed > 0 && !activeSpecId)
                }
              >
                {isConverting || isProcessing ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    処理中...
                  </>
                ) : (
                  <>
                    <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9.85 8.42c-.37-.15-.77-.21-1.18-.2H7.2v3.03h1.35c.41 0 .82-.07 1.18-.23.26-.12.47-.31.61-.56.14-.25.21-.54.21-.86 0-.32-.07-.61-.2-.85a1.3 1.3 0 0 0-.5-.33zM12 0C5.38 0 0 5.38 0 12s5.38 12 12 12 12-5.38 12-12S18.62 0 12 0zm-2.8 14.48H7.2v2.7H5V6.77h3.72c.67-.01 1.33.09 1.96.3.53.17 1.01.44 1.42.82.37.35.66.77.85 1.24.19.47.29.97.28 1.48 0 .51-.1 1.01-.28 1.48-.19.47-.48.89-.85 1.24-.41.38-.89.65-1.42.82-.63.21-1.3.32-1.96.33h.48zm7.44.72c.2.24.48.4.79.46.34.07.69.06 1.02-.03.25-.06.5-.16.72-.29.24-.14.44-.32.6-.53l1.17 1.05c-.33.4-.75.72-1.23.91-.53.23-1.11.34-1.69.33-.51 0-1.01-.09-1.48-.28-.43-.17-.82-.43-1.14-.77-.31-.34-.55-.74-.71-1.18-.17-.48-.25-.99-.25-1.5 0-.51.08-1.02.26-1.5.16-.44.4-.84.72-1.19.31-.34.69-.6 1.11-.78.46-.19.96-.29 1.46-.28.45-.01.91.07 1.33.24.37.15.71.38.97.68.27.32.47.69.58 1.09.13.46.19.94.18 1.43v.77h-4.65c.01.3.12.58.31.8zm2.31-3.03c-.17-.26-.4-.48-.67-.63-.28-.15-.59-.22-.91-.21-.31 0-.62.07-.91.22-.26.13-.49.32-.67.56-.18.24-.31.51-.39.8h3.62c-.04-.27-.12-.53-.26-.77z" />
                    </svg>
                    一括処理 ({processTargetText})
                  </>
                )}
              </button>
            </>
          )}
          {(stats.failed > 0 || stats.noGuides > 0) && !isPhotoshopInstalled && (
            <span className="text-xs text-text-muted">
              Photoshopが見つかりません
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
