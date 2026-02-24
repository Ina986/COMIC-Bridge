import { useState, useMemo } from "react";
import { usePsdStore } from "../../store/psdStore";
import { useTiffStore } from "../../store/tiffStore";
import type { TiffFileOverride } from "../../types/tiff";

export function TiffBatchQueue() {
  const files = usePsdStore((state) => state.files);
  const selectedFileIds = usePsdStore((state) => state.selectedFileIds);
  const selectFile = usePsdStore((state) => state.selectFile);
  const selectRange = usePsdStore((state) => state.selectRange);
  const selectAll = usePsdStore((state) => state.selectAll);
  const clearSelection = usePsdStore((state) => state.clearSelection);
  const settings = useTiffStore((state) => state.settings);
  const fileOverrides = useTiffStore((state) => state.fileOverrides);
  const toggleFileSkip = useTiffStore((state) => state.toggleFileSkip);
  const setFileOverride = useTiffStore((state) => state.setFileOverride);
  const removeFileOverride = useTiffStore((state) => state.removeFileOverride);
  const results = useTiffStore((state) => state.results);
  const isProcessing = useTiffStore((state) => state.isProcessing);
  const currentFile = useTiffStore((state) => state.currentFile);

  const [expandedFileId, setExpandedFileId] = useState<string | null>(null);

  const handleRowClick = (fileId: string, e: React.MouseEvent) => {
    if (e.shiftKey) {
      selectRange(fileId);
    } else if (e.ctrlKey || e.metaKey) {
      selectFile(fileId, true);
    } else {
      selectFile(fileId);
    }
  };

  // ファイル毎の最終設定を計算
  const resolvedFiles = useMemo(() => {
    const flatten = settings.rename.flattenSubfolders;

    // サブフォルダ別インデックスを事前計算（flatten=false時に各サブフォルダで連番リセット）
    const subfolderIndices: number[] = [];
    if (!flatten) {
      const counters = new Map<string, number>();
      for (const file of files) {
        const key = file.subfolderName || "";
        const idx = counters.get(key) ?? 0;
        subfolderIndices.push(idx);
        counters.set(key, idx + 1);
      }
    }

    return files.map((file, index) => {
      const override = fileOverrides.get(file.id);
      const skip = override?.skip ?? false;

      // flatten=false時はサブフォルダ内インデックス、flatten=true時はグローバルインデックス
      const fileIndex = flatten ? index : subfolderIndices[index];

      // カラーモード解決
      let colorMode: string = settings.colorMode;
      if (settings.colorMode === "perPage") {
        const pageNum = fileIndex + 1;
        const matchedRule = settings.pageRangeRules.find(
          (r) => pageNum >= r.fromPage && pageNum <= r.toPage
        );
        colorMode = matchedRule?.colorMode ?? settings.defaultColorForPerPage;
      }
      if (override?.colorMode && override.colorMode !== "perPage") {
        colorMode = override.colorMode;
      }

      // ぼかし解決
      const blurEnabled = override?.blurEnabled ?? settings.blur.enabled;
      const blurRadius = override?.blurRadius ?? settings.blur.radius;

      // リネーム解決
      const ext = settings.output.proceedAsTiff ? ".tif"
        : settings.output.outputJpg ? ".jpg" : ".psd";
      let outputName: string;
      if (settings.rename.keepOriginalName) {
        const baseName = file.fileName.replace(/\.[^.]+$/, "");
        outputName = baseName + ext;
      } else if (settings.rename.extractPageNumber) {
        const match = file.fileName.match(/(\d+)\s*\.[^.]+$/);
        const extractedNum = match ? parseInt(match[1]) : fileIndex + 1;
        const pageNum = extractedNum + (settings.rename.startNumber - 1);
        outputName = String(pageNum).padStart(settings.rename.padding, "0") + ext;
      } else {
        const pageNum = fileIndex + settings.rename.startNumber;
        outputName = String(pageNum).padStart(settings.rename.padding, "0") + ext;
      }

      // 処理結果
      const result = results.find((r) => r.fileName === file.fileName);

      return {
        file,
        index,
        skip,
        colorMode,
        blurEnabled,
        blurRadius,
        outputName,
        result,
        hasOverride: !!override && (override.colorMode !== undefined || override.blurEnabled !== undefined || override.blurRadius !== undefined),
        subfolderName: file.subfolderName,
      };
    });
  }, [files, fileOverrides, settings, results]);

  // 統計
  const stats = useMemo(() => {
    const active = resolvedFiles.filter((f) => !f.skip);
    return {
      total: resolvedFiles.length,
      active: active.length,
      skipped: resolvedFiles.length - active.length,
      mono: active.filter((f) => f.colorMode === "mono").length,
      color: active.filter((f) => f.colorMode === "color").length,
    };
  }, [resolvedFiles]);

  // サブフォルダ別ファイル数を計算
  const subfolderCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of resolvedFiles) {
      const key = item.subfolderName || "";
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }, [resolvedFiles]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-border flex items-center gap-3">
        <span className="text-xs font-medium text-text-primary">バッチキュー</span>
        <div className="flex items-center gap-2">
          <button onClick={selectAll} className="text-[10px] text-text-muted hover:text-accent transition-colors">全選択</button>
          {selectedFileIds.length > 0 && (
            <>
              <button onClick={clearSelection} className="text-[10px] text-text-muted hover:text-accent transition-colors">解除</button>
              <span className="text-[10px] text-accent font-medium">{selectedFileIds.length}件</span>
            </>
          )}
        </div>
        <div className="flex-1" />
        <span className="text-[10px] text-text-muted">
          {stats.active} 対象 / {stats.skipped > 0 && `${stats.skipped} スキップ / `}{stats.total} 合計
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="divide-y divide-border/50">
          {resolvedFiles.map((item, idx) => {
            // サブフォルダ区切りヘッダー
            const prevSubfolder = idx > 0 ? (resolvedFiles[idx - 1].subfolderName || "") : null;
            const currentSubfolder = item.subfolderName || "";
            const showSubfolderHeader = currentSubfolder && prevSubfolder !== currentSubfolder;
            const fileCount = subfolderCounts.get(currentSubfolder) || 0;

            return (
              <div key={item.file.id}>
                {showSubfolderHeader && (
                  <SubfolderHeader name={currentSubfolder} fileCount={fileCount} />
                )}
                <QueueRow
                  item={item}
                  isSelected={selectedFileIds.includes(item.file.id)}
                  isCurrentProcessing={isProcessing && currentFile === item.file.fileName}
                  isExpanded={expandedFileId === item.file.id}
                  onRowClick={(e) => handleRowClick(item.file.id, e)}
                  onToggleSkip={() => toggleFileSkip(item.file.id)}
                  onToggleExpand={() => setExpandedFileId(
                    expandedFileId === item.file.id ? null : item.file.id
                  )}
                  onSetOverride={(partial) => setFileOverride(item.file.id, partial)}
                  onResetOverride={() => removeFileOverride(item.file.id)}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Stats */}
      <div className="px-4 py-2 border-t border-border flex items-center gap-3 text-[10px] text-text-muted">
        {stats.mono > 0 && (
          <span className="px-1.5 py-0.5 rounded bg-bg-tertiary">
            Grayscale: {stats.mono}
          </span>
        )}
        {stats.color > 0 && (
          <span className="px-1.5 py-0.5 rounded bg-accent-tertiary/10 text-accent-tertiary">
            RGB: {stats.color}
          </span>
        )}
      </div>
    </div>
  );
}

// --- Subfolder Header ---

function SubfolderHeader({ name, fileCount }: { name: string; fileCount: number }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-accent-warm/5 border-b border-accent-warm/20 sticky top-0 z-10">
      <svg className="w-3.5 h-3.5 text-accent-warm/60 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
      <span className="text-[11px] font-semibold text-accent-warm/80 truncate">{name}</span>
      <span className="text-[10px] text-accent-warm/50 flex-shrink-0">{fileCount}</span>
    </div>
  );
}

// --- Queue Row ---

interface QueueRowItem {
  file: { id: string; fileName: string; thumbnail?: string };
  index: number;
  skip: boolean;
  colorMode: string;
  blurEnabled: boolean;
  blurRadius: number;
  outputName: string;
  result?: { success: boolean; error?: string };
  hasOverride: boolean;
  subfolderName?: string;
}

function QueueRow({
  item,
  isSelected,
  isCurrentProcessing,
  isExpanded,
  onRowClick,
  onToggleSkip,
  onToggleExpand,
  onSetOverride,
  onResetOverride,
}: {
  item: QueueRowItem;
  isSelected: boolean;
  isCurrentProcessing: boolean;
  isExpanded: boolean;
  onRowClick: (e: React.MouseEvent) => void;
  onToggleSkip: () => void;
  onToggleExpand: () => void;
  onSetOverride: (partial: Partial<TiffFileOverride>) => void;
  onResetOverride: () => void;
}) {
  return (
    <div
      className={`
        ${item.skip ? "opacity-50" : ""}
        ${isSelected ? "bg-accent/5" : ""}
        ${isCurrentProcessing ? "bg-accent-warm/10" : ""}
      `}
    >
      {/* Main Row */}
      <div className="flex items-center gap-2 px-3 py-2 min-h-[44px] cursor-pointer" onClick={onRowClick}>
        {/* Skip Checkbox */}
        <input
          type="checkbox"
          checked={!item.skip}
          onChange={onToggleSkip}
          onClick={(e) => e.stopPropagation()}
          className="rounded accent-accent-warm flex-shrink-0"
          title="処理対象に含める"
        />

        {/* Thumbnail */}
        <div className="w-8 h-11 rounded bg-bg-tertiary flex-shrink-0 overflow-hidden flex items-center justify-center">
          {item.file.thumbnail ? (
            <img src={item.file.thumbnail} className="w-full h-full object-cover" alt="" />
          ) : (
            <svg className="w-4 h-4 text-text-muted/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
            </svg>
          )}
        </div>

        {/* File Name → Output Name */}
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <span className="text-xs text-text-secondary truncate max-w-[140px]" title={item.file.fileName}>
            {item.file.fileName}
          </span>
          <svg className="w-3 h-3 text-text-muted/40 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          <span className="text-xs font-medium text-text-primary truncate max-w-[100px]" title={item.outputName}>
            {item.outputName}
          </span>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Color Mode Badge */}
          <span className={`
            px-1.5 py-0.5 text-[10px] font-medium rounded
            ${item.colorMode === "mono"
              ? "bg-bg-tertiary text-text-secondary"
              : item.colorMode === "color"
                ? "bg-accent-tertiary/10 text-accent-tertiary"
                : "bg-bg-tertiary text-text-muted"
            }
          `}>
            {item.colorMode === "mono" ? "Grayscale" : item.colorMode === "color" ? "RGB" : "—"}
          </span>

          {/* Blur Badge */}
          {item.blurEnabled && (
            <span className="px-1.5 py-0.5 text-[10px] rounded bg-accent-secondary/10 text-accent-secondary">
              {item.blurRadius}px
            </span>
          )}

          {/* Result Status */}
          {item.result && (
            item.result.success ? (
              <svg className="w-4 h-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )
          )}

          {/* Processing Spinner */}
          {isCurrentProcessing && (
            <div className="w-4 h-4 rounded-full border-2 border-accent-warm/30 border-t-accent-warm animate-spin" />
          )}
        </div>

        {/* Override Toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
          className={`
            p-1 rounded-md transition-all flex-shrink-0
            ${item.hasOverride
              ? "text-accent-warm bg-accent-warm/10"
              : "text-text-muted/40 hover:text-text-muted hover:bg-bg-tertiary"
            }
          `}
          title="ファイル別設定"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        </button>
      </div>

      {/* Expanded Override Panel */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-0">
          <div className="bg-bg-tertiary rounded-lg p-3 space-y-2.5 border border-accent-warm/20">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-accent-warm">ファイル別上書き</span>
              {item.hasOverride && (
                <button
                  onClick={onResetOverride}
                  className="text-[10px] text-text-muted hover:text-error transition-colors"
                >
                  リセット
                </button>
              )}
            </div>

            {/* Color Mode Override */}
            <div>
              <label className="text-[10px] text-text-muted block mb-1">カラーモード</label>
              <div className="flex gap-1">
                {(["mono", "color", "noChange"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => onSetOverride({ colorMode: mode })}
                    className={`
                      flex-1 px-2 py-1 text-[10px] font-medium rounded-md transition-all
                      ${item.colorMode === mode
                        ? "bg-accent-warm text-white"
                        : "bg-bg-elevated text-text-secondary hover:text-text-primary"
                      }
                    `}
                  >
                    {mode === "mono" ? "Mono" : mode === "color" ? "Color" : "変更なし"}
                  </button>
                ))}
              </div>
            </div>

            {/* Blur Override */}
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-text-muted">ぼかし:</label>
              <input
                type="checkbox"
                checked={item.blurEnabled}
                onChange={(e) => onSetOverride({ blurEnabled: e.target.checked })}
                className="rounded accent-accent-warm"
              />
              {item.blurEnabled && (
                <>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={item.blurRadius}
                    onChange={(e) => onSetOverride({ blurRadius: parseFloat(e.target.value) || 0 })}
                    className="w-16 px-1.5 py-0.5 text-[10px] bg-bg-elevated border border-border/50 rounded text-text-primary focus:outline-none"
                  />
                  <span className="text-[10px] text-text-muted">px</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
