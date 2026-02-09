import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { usePsdStore } from "../../store/psdStore";
import { useLayerStore, PRESET_CONDITIONS } from "../../store/layerStore";
import { useOpenFolder } from "../../hooks/useOpenFolder";
import { useHighResPreview } from "../../hooks/useHighResPreview";
import { classifyLayerRisk, isTextFolder, type MatchRisk } from "../../lib/layerMatcher";
import type { LayerNode } from "../../types";
import type { PsdFile } from "../../types";
import type { HideCondition } from "../../store/layerStore";

// --- Annotated tree types ---

interface AnnotatedLayer {
  node: LayerNode;
  matched: boolean;
  risk: MatchRisk;
  willChange: boolean;
  children: AnnotatedLayer[];
}

interface FileStats {
  matched: number;
  warnings: number;
  willChange: number;
}

interface FileAnnotation {
  file: PsdFile;
  layerTree: LayerNode[];
  annotatedTree: AnnotatedLayer[];
  stats: FileStats;
}

function annotateTree(
  layers: LayerNode[],
  conditions: HideCondition[],
  isHideMode: boolean,
  parentIsTextFolder = false
): AnnotatedLayer[] {
  return [...layers].reverse().map((layer) => {
    const textFolder = isTextFolder(layer);
    const { matched, risk } = classifyLayerRisk(layer, conditions, parentIsTextFolder);
    const willChange = matched && (isHideMode ? layer.visible : !layer.visible);
    return {
      node: layer,
      matched,
      risk,
      willChange,
      children: layer.children
        ? annotateTree(layer.children, conditions, isHideMode, parentIsTextFolder || textFolder)
        : [],
    };
  });
}

function countStats(tree: AnnotatedLayer[]): FileStats {
  let matched = 0;
  let warnings = 0;
  let willChange = 0;
  for (const item of tree) {
    if (item.matched) matched++;
    if (item.risk === "warning" && item.willChange) warnings++;
    if (item.willChange) willChange++;
    const child = countStats(item.children);
    matched += child.matched;
    warnings += child.warnings;
    willChange += child.willChange;
  }
  return { matched, warnings, willChange };
}

// --- Main component ---

interface LayerPreviewPanelProps {
  onOpenInPhotoshop?: (filePath: string) => void;
}

export function LayerPreviewPanel({ onOpenInPhotoshop }: LayerPreviewPanelProps) {
  const files = usePsdStore((s) => s.files);
  const selectedFileIds = usePsdStore((s) => s.selectedFileIds);
  const selectedConditions = useLayerStore((s) => s.selectedConditions);
  const customConditions = useLayerStore((s) => s.customConditions);
  const actionMode = useLayerStore((s) => s.actionMode);
  const { openFolderForFile, revealFiles } = useOpenFolder();

  // Tab mode: layers or viewer
  const [viewMode, setViewMode] = useState<"layers" | "viewer">("layers");
  // Viewer: which file index to display
  const [viewerFileIndex, setViewerFileIndex] = useState(0);
  const viewerRef = useRef<HTMLDivElement>(null);

  // Local checked state for multi-select within the layer tree
  const [checkedFileIds, setCheckedFileIds] = useState<Set<string>>(new Set());

  const handleCheck = useCallback((fileId: string, shiftKey: boolean) => {
    setCheckedFileIds((prev) => {
      if (shiftKey) {
        // Shift+click: toggle in multi-select
        const next = new Set(prev);
        if (next.has(fileId)) {
          next.delete(fileId);
        } else {
          next.add(fileId);
        }
        return next;
      } else {
        // Normal click: single toggle (select only this, or deselect if already sole)
        if (prev.size === 1 && prev.has(fileId)) {
          return new Set<string>();
        }
        return new Set([fileId]);
      }
    });
  }, []);

  // Show selected files from sidebar, or all files if none selected
  const targetFiles = useMemo(() => {
    if (selectedFileIds.length > 0) {
      return files.filter((f) => selectedFileIds.includes(f.id));
    }
    return files;
  }, [files, selectedFileIds]);

  const conditions = useMemo(() => {
    const all = [...PRESET_CONDITIONS, ...customConditions];
    return all.filter((c) => selectedConditions.includes(c.id));
  }, [selectedConditions, customConditions]);

  const hasConditions = conditions.length > 0;
  const isHideMode = actionMode === "hide";

  const fileAnnotations = useMemo((): FileAnnotation[] => {
    return targetFiles.map((file) => {
      const layerTree = file.metadata?.layerTree ?? [];
      const annotatedTree = hasConditions ? annotateTree(layerTree, conditions, isHideMode) : [];
      const stats = hasConditions ? countStats(annotatedTree) : { matched: 0, warnings: 0, willChange: 0 };
      return { file, layerTree, annotatedTree, stats };
    });
  }, [targetFiles, conditions, hasConditions, isHideMode]);

  const totalStats = useMemo(() => {
    return fileAnnotations.reduce(
      (acc, fa) => ({
        matched: acc.matched + fa.stats.matched,
        warnings: acc.warnings + fa.stats.warnings,
        willChange: acc.willChange + fa.stats.willChange,
      }),
      { matched: 0, warnings: 0, willChange: 0 }
    );
  }, [fileAnnotations]);

  // Viewer: use ALL files (not just selected)
  const viewerFiles = files;
  const viewerFile = viewerFiles[viewerFileIndex] ?? viewerFiles[0] ?? null;

  // High-res preview for viewer tab
  const {
    imageUrl: viewerImageUrl,
    isLoading: viewerIsLoading,
    error: viewerError,
    reload: viewerReload,
  } = useHighResPreview(viewerFile?.filePath, {
    maxSize: 2000,
    enabled: viewMode === "viewer" && !!viewerFile,
    pdfPageIndex: viewerFile?.pdfPageIndex,
    pdfSourcePath: viewerFile?.pdfSourcePath,
  });

  // Reset viewer index when files change
  useEffect(() => {
    setViewerFileIndex(0);
  }, [files.length]);

  // Sync viewer index when sidebar selection changes
  useEffect(() => {
    if (viewMode !== "viewer" || selectedFileIds.length === 0) return;
    const idx = files.findIndex((f) => f.id === selectedFileIds[0]);
    if (idx >= 0) setViewerFileIndex(idx);
  }, [viewMode, selectedFileIds, files]);

  // Viewer keyboard navigation
  useEffect(() => {
    if (viewMode !== "viewer" || viewerFiles.length <= 1) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setViewerFileIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setViewerFileIndex((i) => Math.min(viewerFiles.length - 1, i + 1));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewMode, viewerFiles.length]);

  // Viewer mouse wheel navigation
  useEffect(() => {
    const el = viewerRef.current;
    if (!el || viewMode !== "viewer" || viewerFiles.length <= 1) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY > 0) {
        setViewerFileIndex((i) => Math.min(viewerFiles.length - 1, i + 1));
      } else if (e.deltaY < 0) {
        setViewerFileIndex((i) => Math.max(0, i - 1));
      }
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [viewMode, viewerFiles.length]);

  // Viewer P/F shortcuts — operate on the currently displayed file
  useEffect(() => {
    if (viewMode !== "viewer") return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (!viewerFile) return;

      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (onOpenInPhotoshop) onOpenInPhotoshop(viewerFile.filePath);
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        e.stopImmediatePropagation();
        openFolderForFile(viewerFile.filePath);
      }
    };
    // Use capture phase to intercept before global handlers
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [viewMode, viewerFile, onOpenInPhotoshop, openFolderForFile]);

  // Clean up checked IDs when target files change
  useEffect(() => {
    const targetIds = new Set(targetFiles.map((f) => f.id));
    setCheckedFileIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (targetIds.has(id)) next.add(id);
      }
      return next.size !== prev.size ? next : prev;
    });
  }, [targetFiles]);

  // P key handler: open checked files (or single active file) in Photoshop
  useEffect(() => {
    if (!onOpenInPhotoshop) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        if (checkedFileIds.size > 0) {
          // Open all checked files
          for (const fa of fileAnnotations) {
            if (checkedFileIds.has(fa.file.id)) {
              onOpenInPhotoshop(fa.file.filePath);
            }
          }
        } else if (targetFiles.length === 1) {
          // Single file mode: open that file
          onOpenInPhotoshop(targetFiles[0].filePath);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onOpenInPhotoshop, checkedFileIds, fileAnnotations, targetFiles]);

  // Empty
  if (targetFiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <div className="w-12 h-12 rounded-2xl bg-bg-tertiary flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </div>
        <p className="text-[11px] text-text-muted">ファイルを選択</p>
      </div>
    );
  }

  const isMulti = targetFiles.length > 1;
  const noChangeCount = totalStats.matched - totalStats.willChange;

  return (
    <div className="flex flex-col h-full bg-bg-primary select-none">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          {/* Tab Switcher */}
          <div className="flex bg-bg-elevated rounded-md p-0.5 border border-white/5 flex-shrink-0">
            <button
              onClick={() => setViewMode("layers")}
              className={`px-2 py-1 text-[10px] rounded transition-all ${
                viewMode === "layers"
                  ? "bg-bg-tertiary text-text-primary font-medium shadow-sm"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              <svg className="w-3 h-3 inline mr-0.5 -mt-px" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              レイヤー構造
            </button>
            <button
              onClick={() => setViewMode("viewer")}
              className={`px-2 py-1 text-[10px] rounded transition-all ${
                viewMode === "viewer"
                  ? "bg-bg-tertiary text-text-primary font-medium shadow-sm"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              <svg className="w-3 h-3 inline mr-0.5 -mt-px" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              ビューアー
            </button>
          </div>

          {/* File info */}
          {viewMode === "layers" && (
            <>
              {!isMulti ? (
                <span className="text-xs font-display font-medium text-text-primary truncate">
                  {targetFiles[0].fileName}
                </span>
              ) : (
                <span className="text-xs font-display font-medium text-text-primary">
                  レイヤー構造
                </span>
              )}
              <span className="text-[10px] text-text-muted ml-auto flex-shrink-0">
                {isMulti ? `${targetFiles.length} ファイル` : `${targetFiles[0].metadata?.layerCount ?? 0} レイヤー`}
              </span>
            </>
          )}

          {viewMode === "viewer" && viewerFile && (
            <>
              <span className="text-xs font-display font-medium text-text-primary truncate">
                {viewerFile.fileName}
              </span>
              {viewerFiles.length > 1 && (
                <span className="text-[10px] text-text-muted ml-auto flex-shrink-0">
                  {viewerFileIndex + 1} / {viewerFiles.length}
                </span>
              )}
            </>
          )}

          {/* Action buttons - layers mode */}
          {viewMode === "layers" && !isMulti && (
            <FolderButton onClick={() => openFolderForFile(targetFiles[0].filePath)} />
          )}
          {viewMode === "layers" && !isMulti && onOpenInPhotoshop && (
            <PsButton onClick={() => onOpenInPhotoshop(targetFiles[0].filePath)} />
          )}
          {viewMode === "layers" && isMulti && checkedFileIds.size > 0 && (
            <button
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-text-muted hover:text-text-primary bg-bg-tertiary/50 hover:bg-bg-tertiary transition-colors flex-shrink-0"
              onClick={() => {
                const paths = fileAnnotations
                  .filter((fa) => checkedFileIds.has(fa.file.id))
                  .map((fa) => fa.file.filePath);
                if (paths.length > 1) {
                  revealFiles(paths);
                } else if (paths.length === 1) {
                  openFolderForFile(paths[0]);
                }
              }}
              title={`${checkedFileIds.size}件をエクスプローラーで選択 (F)`}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              {checkedFileIds.size}件
            </button>
          )}
          {viewMode === "layers" && isMulti && checkedFileIds.size > 0 && onOpenInPhotoshop && (
            <button
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-[#31A8FF] bg-[#31A8FF]/10 hover:bg-[#31A8FF]/20 transition-colors flex-shrink-0"
              onClick={() => {
                for (const fa of fileAnnotations) {
                  if (checkedFileIds.has(fa.file.id)) {
                    onOpenInPhotoshop(fa.file.filePath);
                  }
                }
              }}
              title={`${checkedFileIds.size}件をPhotoshopで開く (P)`}
            >
              <span className="text-[10px] font-bold leading-none">P</span>
              {checkedFileIds.size}件を開く
            </button>
          )}

          {/* Action buttons - viewer mode */}
          {viewMode === "viewer" && viewerFile && (
            <FolderButton onClick={() => openFolderForFile(viewerFile.filePath)} />
          )}
          {viewMode === "viewer" && viewerFile && onOpenInPhotoshop && (
            <PsButton onClick={() => onOpenInPhotoshop(viewerFile.filePath)} />
          )}
        </div>
        {viewMode === "layers" && hasConditions && (
          <div className="flex items-center gap-2.5 mt-0.5">
            {totalStats.willChange > 0 ? (
              <span className={`text-[11px] font-medium ${isHideMode ? "text-accent" : "text-accent-tertiary"}`}>
                {totalStats.willChange} 件{isHideMode ? "非表示" : "表示"}予定
              </span>
            ) : totalStats.matched > 0 ? (
              <span className="text-[11px] text-text-muted">
                変更なし（{isHideMode ? "非表示" : "表示"}済）
              </span>
            ) : null}
            {noChangeCount > 0 && totalStats.willChange > 0 && (
              <span className="text-[11px] text-text-muted">
                {noChangeCount} 件済
              </span>
            )}
            {totalStats.warnings > 0 && (
              <span className="text-[11px] font-medium text-amber-500 flex items-center gap-0.5">
                <WarnIcon className="w-2.5 h-2.5" />
                {totalStats.warnings}
              </span>
            )}
          </div>
        )}
        {viewMode === "viewer" && viewerFile?.metadata && (
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-text-muted">
              {viewerFile.metadata.width} x {viewerFile.metadata.height}
            </span>
            <span className="text-[10px] text-text-muted">
              {viewerFile.metadata.dpi} dpi
            </span>
            <span className="text-[10px] text-text-muted">
              {viewerFile.metadata.colorMode}
            </span>
          </div>
        )}
      </div>

      {/* Content - Layers Mode */}
      {viewMode === "layers" && (
        <div className="flex-1 overflow-y-auto min-h-0">
          {!isMulti ? (
            <div className="p-1.5">
              <SingleFileTree
                annotation={fileAnnotations[0]}
                hasConditions={hasConditions}
                isHideMode={isHideMode}
              />
            </div>
          ) : (
            <div
              className="grid h-fit"
              style={{
                gridTemplateColumns: `repeat(${Math.min(fileAnnotations.length, 3)}, 1fr)`,
              }}
            >
              {fileAnnotations.map((fa) => (
                <FileColumn
                  key={fa.file.id}
                  annotation={fa}
                  hasConditions={hasConditions}
                  isHideMode={isHideMode}
                  isChecked={checkedFileIds.has(fa.file.id)}
                  onToggleCheck={(shiftKey) => handleCheck(fa.file.id, shiftKey)}
                  onOpenInPhotoshop={onOpenInPhotoshop ? () => onOpenInPhotoshop(fa.file.filePath) : undefined}
                  onOpenFolder={() => openFolderForFile(fa.file.filePath)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Content - Viewer Mode */}
      {viewMode === "viewer" && (
        <div ref={viewerRef} className="flex-1 overflow-hidden min-h-0 relative flex items-center justify-center bg-[#1a1a1e]">
          {viewerIsLoading && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="w-8 h-8 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
            </div>
          )}
          {viewerError && (
            <div className="flex flex-col items-center gap-2 text-center px-6">
              <svg className="w-8 h-8 text-error/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <p className="text-[11px] text-text-muted">プレビューの読み込みに失敗</p>
              <button
                onClick={viewerReload}
                className="text-[10px] text-accent hover:text-accent/80 transition-colors"
              >
                再試行
              </button>
            </div>
          )}
          {viewerImageUrl && !viewerIsLoading && (
            <img
              src={viewerImageUrl}
              alt={viewerFile?.fileName}
              className="max-w-full max-h-full object-contain select-none"
              draggable={false}
            />
          )}
          {!viewerFile && (
            <p className="text-[11px] text-text-muted">ファイルを選択</p>
          )}

          {/* Navigation arrows for multi-file */}
          {viewerFiles.length > 1 && (
            <>
              {viewerFileIndex > 0 && (
                <button
                  onClick={() => setViewerFileIndex((i) => i - 1)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white/70 hover:text-white transition-all backdrop-blur-sm"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              {viewerFileIndex < viewerFiles.length - 1 && (
                <button
                  onClick={() => setViewerFileIndex((i) => i + 1)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white/70 hover:text-white transition-all backdrop-blur-sm"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Legend */}
      {viewMode === "layers" && hasConditions && (
        <div className="px-3 py-1.5 border-t border-border flex-shrink-0 flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-sm ${isHideMode ? "bg-accent/30" : "bg-accent-tertiary/30"}`} />
            <span className="text-[9px] text-text-muted">{isHideMode ? "→非表示" : "→表示"}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-amber-500/30" />
            <span className="text-[9px] text-text-muted">要確認</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-text-muted/20" />
            <span className="text-[9px] text-text-muted">済</span>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Single file tree ---

function SingleFileTree({ annotation, hasConditions, isHideMode }: {
  annotation: FileAnnotation;
  hasConditions: boolean;
  isHideMode: boolean;
}) {
  if (annotation.layerTree.length === 0) {
    return (
      <div className="flex items-center justify-center py-6 text-[11px] text-text-muted">
        レイヤー情報なし
      </div>
    );
  }

  return hasConditions ? (
    <AnnotatedTree items={annotation.annotatedTree} depth={0} isHideMode={isHideMode} />
  ) : (
    <PlainTree layers={annotation.layerTree} depth={0} />
  );
}

// --- File column (multi-file) ---

function FileColumn({ annotation, hasConditions, isHideMode, isChecked, onToggleCheck, onOpenInPhotoshop, onOpenFolder }: {
  annotation: FileAnnotation;
  hasConditions: boolean;
  isHideMode: boolean;
  isChecked: boolean;
  onToggleCheck: (shiftKey: boolean) => void;
  onOpenInPhotoshop?: () => void;
  onOpenFolder?: () => void;
}) {
  const { file, layerTree, annotatedTree, stats } = annotation;

  return (
    <div
      className={`
        flex flex-col min-w-0 cursor-pointer border-r border-b border-border
        ${isChecked ? "bg-[#31A8FF]/[0.03]" : ""}
      `}
      onClick={(e) => onToggleCheck(e.shiftKey)}
    >
      {/* Column header */}
      <div
        className={`
          px-2 py-1.5 border-b flex-shrink-0 flex items-center gap-1.5 group
          transition-colors hover:bg-bg-tertiary/50
          ${isChecked ? "border-[#31A8FF]/30 bg-[#31A8FF]/8" : "border-border/60 bg-bg-secondary/30"}
        `}
      >
        {/* Checkbox */}
        <div className={`
          w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-all
          ${isChecked
            ? "border-[#31A8FF] bg-[#31A8FF] text-white"
            : "border-border-strong/40 group-hover:border-text-muted"
          }
        `}>
          {isChecked && (
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <span className={`text-[11px] font-medium truncate flex-1 ${isChecked ? "text-[#31A8FF]" : "text-text-primary"}`}>
          {file.fileName.replace(/\.(psd|psb)$/i, "")}
        </span>
        {hasConditions && stats.willChange > 0 && (
          <span className={`text-[9px] px-1 py-px rounded flex-shrink-0 ${
            isHideMode ? "bg-accent/10 text-accent" : "bg-accent-tertiary/10 text-accent-tertiary"
          }`}>
            {stats.willChange}
          </span>
        )}
        {stats.warnings > 0 && (
          <span className="text-[9px] px-1 py-px rounded bg-amber-500/10 text-amber-500 flex-shrink-0 flex items-center gap-px">
            <WarnIcon className="w-2 h-2" />
            {stats.warnings}
          </span>
        )}
        <span className="text-[9px] text-text-muted/60 flex-shrink-0">
          {file.metadata?.layerCount ?? 0}
        </span>
        {onOpenFolder && (
          <FolderButton
            onClick={(e) => { e.stopPropagation(); onOpenFolder(); }}
            compact
            className="opacity-0 group-hover:opacity-100"
          />
        )}
        {onOpenInPhotoshop && (
          <PsButton
            onClick={(e) => { e.stopPropagation(); onOpenInPhotoshop(); }}
            compact
            className="opacity-0 group-hover:opacity-100"
          />
        )}
      </div>

      {/* Tree body */}
      <div className="p-1">
        {layerTree.length === 0 ? (
          <div className="flex items-center justify-center py-4 text-[10px] text-text-muted">
            レイヤー情報なし
          </div>
        ) : hasConditions ? (
          <AnnotatedTree items={annotatedTree} depth={0} isHideMode={isHideMode} />
        ) : (
          <PlainTree layers={layerTree} depth={0} />
        )}
      </div>
    </div>
  );
}

// --- Plain tree ---

function PlainTree({ layers, depth }: { layers: LayerNode[]; depth: number }) {
  const reversed = useMemo(() => [...layers].reverse(), [layers]);
  return (
    <div className="text-[11px]">
      {reversed.map((layer) => (
        <PlainItem key={layer.id} layer={layer} depth={depth} />
      ))}
    </div>
  );
}

function PlainItem({ layer, depth }: { layer: LayerNode; depth: number }) {
  const [isExpanded, setIsExpanded] = useState(depth < 2);
  const hasChildren = layer.children && layer.children.length > 0;

  return (
    <div>
      <div
        className={`
          flex items-center gap-1 py-[3px] px-1 rounded transition-colors
          hover:bg-bg-tertiary/50 cursor-default
          ${!layer.visible ? "opacity-35" : ""}
        `}
        style={{ paddingLeft: `${depth * 12 + 2}px` }}
      >
        <ExpandBtn has={!!hasChildren} open={isExpanded} toggle={() => setIsExpanded(!isExpanded)} />
        <VisIcon visible={layer.visible} />
        <TypeIcon type={layer.type} />
        <span className={`truncate flex-1 ${layer.visible ? "text-text-primary" : "text-text-muted"}`} title={layer.name}>
          {layer.name || <span className="italic text-text-muted/50">名称なし</span>}
        </span>
        <Badges layer={layer} />
      </div>
      {hasChildren && isExpanded && (
        <div className="relative">
          <div className="absolute left-0 top-0 bottom-1 w-px bg-border/40" style={{ marginLeft: `${depth * 12 + 9}px` }} />
          <PlainTree layers={layer.children!} depth={depth + 1} />
        </div>
      )}
    </div>
  );
}

// --- Annotated tree ---

function AnnotatedTree({ items, depth, isHideMode }: { items: AnnotatedLayer[]; depth: number; isHideMode: boolean }) {
  return (
    <div className="text-[11px]">
      {items.map((item) => (
        <AnnotatedItem key={item.node.id} item={item} depth={depth} isHideMode={isHideMode} />
      ))}
    </div>
  );
}

function AnnotatedItem({ item, depth, isHideMode }: { item: AnnotatedLayer; depth: number; isHideMode: boolean }) {
  const [isExpanded, setIsExpanded] = useState(depth < 2);
  const { node, matched, risk, willChange, children } = item;
  const hasChildren = children.length > 0;

  let rowBg = "";
  let borderLeft = "";
  let rowOpacity = "";

  if (willChange && risk === "warning") {
    rowBg = "bg-amber-500/8";
    borderLeft = "border-l-[2px] border-amber-500";
  } else if (willChange) {
    rowBg = isHideMode ? "bg-accent/8" : "bg-accent-tertiary/8";
    borderLeft = isHideMode ? "border-l-[2px] border-accent/50" : "border-l-[2px] border-accent-tertiary/50";
  } else if (matched) {
    rowBg = "bg-bg-tertiary/30";
    borderLeft = "border-l-[2px] border-text-muted/15";
    rowOpacity = "opacity-55";
  } else {
    rowOpacity = "opacity-35";
  }

  return (
    <div>
      <div
        className={`
          flex items-center gap-1 py-[3px] px-1 rounded transition-colors
          hover:bg-bg-tertiary/50 cursor-default
          ${rowBg} ${borderLeft} ${rowOpacity}
        `}
        style={{ paddingLeft: `${depth * 12 + 2}px` }}
      >
        <ExpandBtn has={hasChildren} open={isExpanded} toggle={() => setIsExpanded(!isExpanded)} />
        <VisIcon visible={node.visible} />
        <TypeIcon type={node.type} />
        <span
          className={`truncate flex-1 ${node.visible ? "text-text-primary" : "text-text-muted"}`}
          title={node.name}
        >
          {node.name || <span className="italic text-text-muted/50">名称なし</span>}
        </span>

        {/* Warning badge */}
        {risk === "warning" && willChange && (
          <span
            className="flex items-center gap-px px-1 py-px rounded bg-amber-500/15 text-amber-600 text-[9px] font-medium flex-shrink-0"
            title="ラスターレイヤー: フキダシや描画の可能性"
          >
            <WarnIcon className="w-2 h-2" />
            確認
          </span>
        )}
        {risk === "warning" && !willChange && matched && (
          <span className="px-1 py-px rounded bg-text-muted/8 text-text-muted/70 text-[9px] flex-shrink-0">
            ラスタ
          </span>
        )}

        {/* Status */}
        {matched && (
          <span
            className={`text-[9px] px-1 py-px rounded flex-shrink-0 leading-none ${
              willChange
                ? isHideMode
                  ? "bg-accent/12 text-accent font-medium"
                  : "bg-accent-tertiary/12 text-accent-tertiary font-medium"
                : "bg-text-muted/8 text-text-muted/70"
            }`}
          >
            {willChange
              ? isHideMode ? "→非表示" : "→表示"
              : isHideMode ? "非表示済" : "表示済"
            }
          </span>
        )}

        <Badges layer={node} />
      </div>
      {hasChildren && isExpanded && (
        <div className="relative">
          <div className="absolute left-0 top-0 bottom-1 w-px bg-border/40" style={{ marginLeft: `${depth * 12 + 9}px` }} />
          <AnnotatedTree items={children} depth={depth + 1} isHideMode={isHideMode} />
        </div>
      )}
    </div>
  );
}

// --- Compact sub-components ---

function ExpandBtn({ has, open, toggle }: { has: boolean; open: boolean; toggle: () => void }) {
  if (!has) return <div className="w-3.5" />;
  return (
    <button
      className="w-3.5 h-3.5 flex items-center justify-center text-text-muted hover:text-accent transition-colors"
      onClick={(e) => { e.stopPropagation(); toggle(); }}
    >
      <svg
        className={`w-2.5 h-2.5 transition-transform duration-150 ${open ? "rotate-90" : ""}`}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
      </svg>
    </button>
  );
}

function VisIcon({ visible }: { visible: boolean }) {
  return (
    <div className={`w-3.5 h-3.5 flex items-center justify-center ${visible ? "text-accent-tertiary" : "text-text-muted/50"}`}>
      {visible ? (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
          <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
        </svg>
      ) : (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
          <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
        </svg>
      )}
    </div>
  );
}

function TypeIcon({ type }: { type: LayerNode["type"] }) {
  const cls = "w-3 h-3";
  switch (type) {
    case "group":
      return (
        <svg className={`${cls} text-manga-lavender`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        </svg>
      );
    case "text":
      return (
        <svg className={`${cls} text-manga-pink`} viewBox="0 0 20 20" fill="currentColor">
          <path d="M5 4h10v2.5h-1.2V5.5H10.6V14h1.5v1.5h-4.2V14h1.5V5.5H6.2v1H5V4z" />
        </svg>
      );
    case "adjustment":
      return (
        <svg className={`${cls} text-accent-warm`} viewBox="0 0 20 20" fill="currentColor">
          <path d="M10 2a8 8 0 100 16 8 8 0 000-16zM4 10a6 6 0 0112 0H4z" />
        </svg>
      );
    case "smartObject":
      return (
        <svg className={`${cls} text-accent-tertiary`} viewBox="0 0 20 20" fill="currentColor">
          <path d="M10 2L3 6v8l7 4 7-4V6l-7-4zm0 2.24L14.5 7 10 9.76 5.5 7 10 4.24z" />
        </svg>
      );
    case "shape":
      return (
        <svg className={`${cls} text-[#59a8f8]`} viewBox="0 0 20 20" fill="currentColor">
          <path d="M3 3h14v14H3V3zm2 2v10h10V5H5z" />
        </svg>
      );
    default:
      return (
        <svg className={`${cls} text-manga-sky`} viewBox="0 0 20 20" fill="currentColor">
          <path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm2 0v6.586l3.293-3.293a1 1 0 011.414 0L13 12.586l1.293-1.293a1 1 0 011.414 0L16 11.586V5H4zm0 10v-1l3.293-3.293L12 15.414V15H4zm12 0v-1.586l-2-2-1.293 1.293L15.414 15H16zM13.5 8a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
        </svg>
      );
  }
}

function WarnIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  );
}

function FolderButton({ onClick, compact, className }: {
  onClick: (e: React.MouseEvent) => void;
  compact?: boolean;
  className?: string;
}) {
  return (
    <button
      className={`
        flex-shrink-0 flex items-center justify-center rounded transition-all
        text-text-muted hover:text-text-primary hover:bg-bg-tertiary active:scale-95
        ${compact ? "w-5 h-5" : "w-6 h-6"}
        ${className ?? ""}
      `}
      onClick={onClick}
      title="フォルダを開く (F)"
    >
      <svg className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    </button>
  );
}

function PsButton({ onClick, compact, className }: {
  onClick: (e: React.MouseEvent) => void;
  compact?: boolean;
  className?: string;
}) {
  return (
    <button
      className={`
        flex-shrink-0 flex items-center justify-center rounded transition-all
        text-[#31A8FF] hover:bg-[#31A8FF]/15 active:scale-95
        ${compact ? "w-5 h-5" : "w-6 h-6"}
        ${className ?? ""}
      `}
      onClick={onClick}
      title="Photoshopで開く (P)"
    >
      <span className={`font-bold leading-none ${compact ? "text-xs" : "text-sm"}`}>P</span>
    </button>
  );
}

function Badges({ layer }: { layer: LayerNode }) {
  return (
    <>
      {layer.clipping && (
        <span className="text-[8px] px-0.5 rounded bg-accent/12 text-accent flex-shrink-0" title="クリッピングマスク">
          clip
        </span>
      )}
      {layer.hasMask && (
        <span className="flex-shrink-0" title="レイヤーマスク">
          <svg className="w-2.5 h-2.5 text-text-muted/60" viewBox="0 0 16 16" fill="currentColor">
            <rect x="1" y="1" width="14" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="8" cy="8" r="4" />
          </svg>
        </span>
      )}
      {layer.hasVectorMask && (
        <span className="flex-shrink-0" title="ベクトルマスク">
          <svg className="w-2.5 h-2.5 text-[#59a8f8]/60" viewBox="0 0 16 16" fill="currentColor">
            <rect x="1" y="1" width="14" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M4 12L8 4l4 8H4z" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </span>
      )}
      {layer.opacity < 100 && (
        <span className="text-[9px] px-0.5 rounded bg-bg-tertiary text-text-muted/60 flex-shrink-0">
          {layer.opacity}%
        </span>
      )}
    </>
  );
}
