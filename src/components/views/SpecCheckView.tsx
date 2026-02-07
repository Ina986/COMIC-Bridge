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

  const guides = useGuideStore((state) => state.guides);
  const openEditor = useGuideStore((state) => state.openEditor);

  const [fixSpec, setFixSpec] = useState(true);
  const [applyGuidesChecked, setApplyGuidesChecked] = useState(true);

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

  const handleCheckAll = () => {
    const enabledSpecs = specifications.filter((s) => s.enabled);
    if (enabledSpecs.length > 0) {
      checkAllFiles(enabledSpecs);
    }
  };

  // 選択中の NG ファイル数
  const selectedNGCount = useMemo(() => {
    return selectedFileIds.filter((id) => {
      const r = checkResults.get(id);
      return r && !r.passed;
    }).length;
  }, [selectedFileIds, checkResults]);

  const hasFiles = files.length > 0;

  if (!hasFiles) {
    return <DropZone />;
  }

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
          {checkResults.size > 0 && (
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
          {stats.unchecked > 0 && (
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-text-muted/30" />
              <span className="text-xs text-text-muted">{stats.unchecked} 未確認</span>
            </div>
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

          {/* Check Button */}
          <button
            className="px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-gradient-to-r from-accent to-accent-secondary shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            onClick={handleCheckAll}
            disabled={isChecking || files.length === 0 || specifications.filter((s) => s.enabled).length === 0}
          >
            {isChecking ? (
              <>
                <div className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                チェック中...
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                チェック
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden relative" data-preview-grid>
        {viewMode === "grid" ? <PreviewGrid /> : <SpecCheckTable />}
        <DetailSlidePanel />
      </div>

      {/* Bottom Action Bar */}
      <div className="px-4 py-2 bg-bg-secondary border-t border-border flex items-center justify-between flex-shrink-0">
        {/* Left: File Info + Selection Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2.5 py-1 bg-bg-tertiary rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-tertiary" />
            <span className="text-xs text-text-primary font-medium">{files.length} ファイル</span>
          </div>
          {selectedFileIds.length > 0 && (
            <div className="flex items-center gap-2 px-2.5 py-1 bg-accent/10 border border-accent/30 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              <span className="text-xs text-accent font-medium">
                {selectedFileIds.length} 件選択中
                {selectedNGCount > 0 && ` (NG: ${selectedNGCount})`}
              </span>
            </div>
          )}
          {stats.failed > 0 && (
            <button
              className="text-xs text-error hover:text-error/80 transition-colors font-medium"
              onClick={selectNGOnly}
            >
              NGのみ選択
            </button>
          )}
          {stats.noGuides > 0 && (
            <button
              className="text-xs text-warning hover:text-warning/80 transition-colors font-medium"
              onClick={selectNoGuidesOnly}
            >
              ガイドなしのみ
            </button>
          )}
          <button
            className="text-xs text-text-secondary hover:text-text-primary transition-colors"
            onClick={selectAll}
          >
            すべて選択
          </button>
          {selectedFileIds.length > 0 && (
            <button
              className="text-xs text-text-secondary hover:text-text-primary transition-colors"
              onClick={clearSelection}
            >
              選択解除
            </button>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          {/* Guide Edit Button */}
          <button
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-bg-tertiary text-text-primary border border-border hover:border-accent/30 hover:bg-bg-elevated transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            onClick={openEditor}
            disabled={files.length === 0}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
            ガイド編集
            {guides.length > 0 && (
              <span className="px-1.5 py-0.5 bg-guide-v/20 text-guide-v rounded text-[10px] font-medium">
                {guides.length}
              </span>
            )}
          </button>

          {/* Batch Processing Controls */}
          {isPhotoshopInstalled && (stats.failed > 0 || (stats.noGuides > 0 && guides.length > 0)) && (
            <>
              <div className="w-px h-5 bg-border flex-shrink-0" />

              {/* Checkboxes */}
              <div className="flex items-center gap-3">
                {stats.failed > 0 && (
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={fixSpec}
                      onChange={(e) => setFixSpec(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-border text-accent focus:ring-accent/30 cursor-pointer"
                    />
                    <span className="text-xs text-text-secondary">仕様修正</span>
                  </label>
                )}
                {stats.noGuides > 0 && guides.length > 0 && (
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={applyGuidesChecked}
                      onChange={(e) => setApplyGuidesChecked(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-border text-guide-v focus:ring-guide-v/30 cursor-pointer"
                    />
                    <span className="text-xs text-text-secondary">ガイド適用</span>
                  </label>
                )}
              </div>

              {/* Unified Process Button */}
              <button
                className="px-4 py-2 text-xs font-medium rounded-lg text-white bg-gradient-to-r from-[#31A8FF] to-[#001E36] shadow-[0_2px_10px_rgba(49,168,255,0.3)] hover:shadow-[0_4px_15px_rgba(49,168,255,0.4)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    処理中...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9.85 8.42c-.37-.15-.77-.21-1.18-.2H7.2v3.03h1.35c.41 0 .82-.07 1.18-.23.26-.12.47-.31.61-.56.14-.25.21-.54.21-.86 0-.32-.07-.61-.2-.85a1.3 1.3 0 0 0-.5-.33zM12 0C5.38 0 0 5.38 0 12s5.38 12 12 12 12-5.38 12-12S18.62 0 12 0zm-2.8 14.48H7.2v2.7H5V6.77h3.72c.67-.01 1.33.09 1.96.3.53.17 1.01.44 1.42.82.37.35.66.77.85 1.24.19.47.29.97.28 1.48 0 .51-.1 1.01-.28 1.48-.19.47-.48.89-.85 1.24-.41.38-.89.65-1.42.82-.63.21-1.3.32-1.96.33h.48zm7.44.72c.2.24.48.4.79.46.34.07.69.06 1.02-.03.25-.06.5-.16.72-.29.24-.14.44-.32.6-.53l1.17 1.05c-.33.4-.75.72-1.23.91-.53.23-1.11.34-1.69.33-.51 0-1.01-.09-1.48-.28-.43-.17-.82-.43-1.14-.77-.31-.34-.55-.74-.71-1.18-.17-.48-.25-.99-.25-1.5 0-.51.08-1.02.26-1.5.16-.44.4-.84.72-1.19.31-.34.69-.6 1.11-.78.46-.19.96-.29 1.46-.28.45-.01.91.07 1.33.24.37.15.71.38.97.68.27.32.47.69.58 1.09.13.46.19.94.18 1.43v.77h-4.65c.01.3.12.58.31.8zm2.31-3.03c-.17-.26-.4-.48-.67-.63-.28-.15-.59-.22-.91-.21-.31 0-.62.07-.91.22-.26.13-.49.32-.67.56-.18.24-.31.51-.39.8h3.62c-.04-.27-.12-.53-.26-.77z" />
                    </svg>
                    Photoshopで一括処理
                  </>
                )}
              </button>
            </>
          )}
          {(stats.failed > 0 || stats.noGuides > 0) && !isPhotoshopInstalled && (
            <span className="text-[10px] text-text-muted">
              Photoshopが見つかりません
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
