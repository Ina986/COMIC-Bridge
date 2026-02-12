import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { usePsdStore } from "../../store/psdStore";
import { useHighResPreview, prefetchPreview } from "../../hooks/useHighResPreview";
import { useOpenFolder } from "../../hooks/useOpenFolder";
import { useFontResolver, collectTextLayers } from "../../hooks/useFontResolver";
import { TextLayerRow } from "./SpecTextGrid";
import { LayerTree } from "../metadata/LayerTree";

interface SpecViewerPanelProps {
  onOpenInPhotoshop?: (filePath: string) => void;
}

export function SpecViewerPanel({ onOpenInPhotoshop }: SpecViewerPanelProps) {
  const files = usePsdStore((s) => s.files);
  const selectedFileIds = usePsdStore((s) => s.selectedFileIds);
  const { openFolderForFile } = useOpenFolder();

  // Viewer index state
  const [viewerFileIndex, setViewerFileIndex] = useState(0);
  const viewerRef = useRef<HTMLDivElement>(null);

  // Sidebar tab
  const [sidebarTab, setSidebarTab] = useState<"text" | "layers">("text");
  // Text display options
  const [useActualFont, setUseActualFont] = useState(false);
  const [sortDesc, setSortDesc] = useState(false);

  // Fullscreen mode (true OS fullscreen via Tauri)
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showEscHint, setShowEscHint] = useState(false);
  // Splash phases: "hidden" → "in" (fade-in) → "hold" (covering) → "out" (fade-out) → "hidden"
  const [splashPhase, setSplashPhase] = useState<"hidden" | "in" | "hold" | "out">("hidden");
  const transitionLock = useRef(false);

  const toggleFullscreen = useCallback(async (force?: boolean) => {
    const next = force !== undefined ? force : !isFullscreen;
    if (next === isFullscreen || transitionLock.current) return;
    transitionLock.current = true;

    // 1) Show splash (fade in white cover)
    setSplashPhase("in");
    await new Promise((r) => setTimeout(r, 200));

    // 2) Splash now fully covers screen — toggle OS fullscreen behind it
    setSplashPhase("hold");
    try {
      await getCurrentWindow().setFullscreen(next);
    } catch { /* ignore */ }
    setIsFullscreen(next);

    // 3) Let OS settle while splash still covers
    await new Promise((r) => setTimeout(r, 200));

    // 4) Fade splash out, revealing new layout
    setSplashPhase("out");
    await new Promise((r) => setTimeout(r, 350));

    setSplashPhase("hidden");
    transitionLock.current = false;

    if (next) {
      setShowEscHint(true);
    }
  }, [isFullscreen]);

  // Auto-hide ESC hint after 2.5s
  useEffect(() => {
    if (!showEscHint) return;
    const timer = setTimeout(() => setShowEscHint(false), 2500);
    return () => clearTimeout(timer);
  }, [showEscHint]);

  // Restore window when component unmounts (e.g. tab switch)
  useEffect(() => {
    return () => {
      if (isFullscreen) {
        getCurrentWindow().setFullscreen(false).catch(() => {});
      }
    };
  }, [isFullscreen]);

  const viewerFile = files[viewerFileIndex] ?? files[0] ?? null;

  // Font resolver (for all files, consistent colors)
  const { fontInfo } = useFontResolver(files);

  // High-res preview
  const {
    imageUrl,
    isLoading,
    error: viewerError,
    reload: viewerReload,
  } = useHighResPreview(viewerFile?.filePath, {
    maxSize: 2000,
    enabled: !!viewerFile,
    pdfPageIndex: viewerFile?.pdfPageIndex,
    pdfSourcePath: viewerFile?.pdfSourcePath,
  });

  // Text layers for current file
  const textLayers = useMemo(() => {
    if (!viewerFile?.metadata?.layerTree) return [];
    return collectTextLayers(viewerFile.metadata.layerTree);
  }, [viewerFile]);

  // Per-file font summary
  const fileFonts = useMemo(() => {
    const fontSet = new Set<string>();
    for (const entry of textLayers) {
      if (!entry.textInfo) continue;
      for (const font of entry.textInfo.fonts) {
        fontSet.add(font);
      }
    }
    return [...fontSet];
  }, [textLayers]);

  // Reset index when files change
  useEffect(() => {
    setViewerFileIndex(0);
  }, [files.length]);

  // Sync index when sidebar selection changes
  useEffect(() => {
    if (selectedFileIds.length === 0) return;
    const idx = files.findIndex((f) => f.id === selectedFileIds[0]);
    if (idx >= 0) setViewerFileIndex(idx);
  }, [selectedFileIds, files]);

  // Prefetch adjacent files (±3)
  useEffect(() => {
    if (files.length <= 1) return;
    for (let offset = 1; offset <= 3; offset++) {
      for (const idx of [viewerFileIndex - offset, viewerFileIndex + offset]) {
        if (idx < 0 || idx >= files.length) continue;
        const f = files[idx];
        if (!f?.filePath) continue;
        prefetchPreview(f.filePath, 2000, f.pdfPageIndex, f.pdfSourcePath);
      }
    }
  }, [viewerFileIndex, files]);

  // Keyboard navigation + Escape for fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "Escape" && isFullscreen) {
        e.preventDefault();
        toggleFullscreen(false);
        return;
      }
      if (files.length <= 1) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setViewerFileIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setViewerFileIndex((i) => Math.min(files.length - 1, i + 1));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [files.length, isFullscreen, toggleFullscreen]);

  // Mouse wheel navigation
  useEffect(() => {
    const el = viewerRef.current;
    if (!el || files.length <= 1) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY > 0) {
        setViewerFileIndex((i) => Math.min(files.length - 1, i + 1));
      } else if (e.deltaY < 0) {
        setViewerFileIndex((i) => Math.max(0, i - 1));
      }
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [files.length, isFullscreen]);

  // P/F shortcuts (capture phase)
  useEffect(() => {
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
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [viewerFile, onOpenInPhotoshop, openFolderForFile]);

  if (files.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[11px] text-text-muted">
        ファイルを読み込んでください
      </div>
    );
  }

  const viewerContent = (
    <div
      className={`flex select-none ${isFullscreen ? "fixed inset-0 z-[9999] bg-[#0e0e10]" : "h-full"}`}
    >
      {/* Image Viewer */}
      <div
        ref={viewerRef}
        className="flex-1 overflow-hidden relative flex items-center justify-center bg-[#1a1a1e]"
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={viewerFile?.fileName}
            className={`max-w-full max-h-full object-contain select-none transition-opacity duration-150 ${isLoading ? "opacity-40" : "opacity-100"}`}
            draggable={false}
          />
        ) : viewerFile?.thumbnailUrl ? (
          <img
            src={viewerFile.thumbnailUrl}
            alt={viewerFile.fileName}
            className="max-w-full max-h-full object-contain select-none opacity-60"
            draggable={false}
          />
        ) : null}

        {/* Loading spinner */}
        {isLoading && (
          <div className="absolute top-3 right-3 z-10">
            <div className="w-5 h-5 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
          </div>
        )}

        {/* Error state */}
        {viewerError && !imageUrl && (
          <div className="flex flex-col items-center gap-2 text-center px-6">
            <svg className="w-8 h-8 text-error/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <p className="text-[11px] text-text-muted">プレビューの読み込みに失敗</p>
            <button onClick={viewerReload} className="text-[10px] text-accent hover:text-accent/80 transition-colors">
              再試行
            </button>
          </div>
        )}

        {/* Fullscreen toggle */}
        <button
          onClick={() => toggleFullscreen()}
          className="absolute top-3 left-3 z-10 w-8 h-8 rounded-lg bg-black/50 hover:bg-black/70 flex items-center justify-center text-white/70 hover:text-white transition-all backdrop-blur-sm"
          title={isFullscreen ? "全画面を解除 (Esc)" : "全画面表示"}
        >
          {isFullscreen ? (
            /* Minimize / exit fullscreen: inward arrows at corners */
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4l4 4M4 4v3m0-3h3" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 4l-4 4M20 4v3m0-3h-3" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 20l4-4M4 20v-3m0 3h3" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 20l-4-4M20 20v-3m0 3h-3" />
            </svg>
          ) : (
            /* Maximize / enter fullscreen: outward arrows at corners */
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 3h6m0 0v6m0-6l-7 7" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 21H3m0 0v-6m0 6l7-7" />
            </svg>
          )}
        </button>

        {/* ESC hint (auto-fade) */}
        {isFullscreen && showEscHint && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-xl bg-black/60 backdrop-blur-md text-white/90 text-xs font-medium animate-fade-hint pointer-events-none">
            Esc で全画面を解除
          </div>
        )}

        {/* Navigation arrows */}
        {files.length > 1 && (
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
            {viewerFileIndex < files.length - 1 && (
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

      {/* Sidebar */}
      <div className="w-[320px] flex-shrink-0 border-l border-border bg-bg-secondary flex flex-col">
        {/* File header */}
        <div className="px-3 py-2 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-display font-medium text-text-primary truncate flex-1">
              {viewerFile?.fileName}
            </span>
            {files.length > 1 && (
              <span className="text-[10px] text-text-muted flex-shrink-0">
                {viewerFileIndex + 1} / {files.length}
              </span>
            )}
            {viewerFile && (
              <button
                className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded transition-all text-text-muted hover:text-text-primary hover:bg-bg-tertiary active:scale-95"
                onClick={() => openFolderForFile(viewerFile.filePath)}
                title="フォルダを開く (F)"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </button>
            )}
            {onOpenInPhotoshop && viewerFile && (
              <button
                className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded transition-all text-[#31A8FF] hover:bg-[#31A8FF]/15 active:scale-95"
                onClick={() => onOpenInPhotoshop(viewerFile.filePath)}
                title="Photoshopで開く (P)"
              >
                <span className="text-sm font-bold leading-none">P</span>
              </button>
            )}
          </div>
          {/* Metadata badges */}
          {viewerFile?.metadata && (
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

        {/* Sidebar tab switcher */}
        <div className="px-3 py-1.5 border-b border-border flex-shrink-0">
          <div className="flex bg-bg-elevated rounded-md p-0.5 border border-white/5">
            <button
              onClick={() => setSidebarTab("text")}
              className={`flex-1 px-2 py-1 text-[10px] rounded transition-all ${
                sidebarTab === "text"
                  ? "bg-bg-tertiary text-text-primary font-medium shadow-sm"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              写植仕様
            </button>
            <button
              onClick={() => setSidebarTab("layers")}
              className={`flex-1 px-2 py-1 text-[10px] rounded transition-all ${
                sidebarTab === "layers"
                  ? "bg-bg-tertiary text-text-primary font-medium shadow-sm"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              レイヤー構造
            </button>
          </div>
        </div>

        {/* Sidebar content */}
        <div className="flex-1 overflow-auto min-h-0">
          {sidebarTab === "text" ? (
            <div className="p-2 space-y-1.5">
              {/* Per-file font badges */}
              {fileFonts.length > 0 && (
                <div className="flex flex-wrap gap-1 px-1 pb-1.5 border-b border-border/30 mb-1.5">
                  {fileFonts.map((font) => {
                    const color = fontInfo.getFontColor(font);
                    const missing = fontInfo.isMissing(font);
                    return (
                      <span
                        key={font}
                        className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                        style={{
                          backgroundColor: `${color}15`,
                          color,
                          ...(missing ? { textDecoration: "line-through" } : {}),
                        }}
                        title={missing ? `${font} (未インストール)` : font}
                      >
                        {fontInfo.getFontLabel(font)}
                        {missing && " !"}
                      </span>
                    );
                  })}
                </div>
              )}
              {/* Toggle controls */}
              {textLayers.length > 0 && (
                <div className="flex items-center gap-2 px-1 pb-1">
                  <div className="flex rounded-md border border-border/40 overflow-hidden">
                    <button
                      onClick={() => setUseActualFont(false)}
                      className={`px-2 py-0.5 text-[9px] transition-all ${
                        !useActualFont
                          ? "bg-bg-tertiary text-text-primary font-medium"
                          : "bg-bg-elevated/50 text-text-muted hover:text-text-secondary"
                      }`}
                    >
                      デフォルト
                    </button>
                    <button
                      onClick={() => setUseActualFont(true)}
                      className={`px-2 py-0.5 text-[9px] border-l border-border/40 transition-all ${
                        useActualFont
                          ? "bg-bg-tertiary text-text-primary font-medium"
                          : "bg-bg-elevated/50 text-text-muted hover:text-text-secondary"
                      }`}
                    >
                      プレビュー
                    </button>
                  </div>
                  <div className="flex rounded-md border border-border/40 overflow-hidden">
                    <button
                      onClick={() => setSortDesc(false)}
                      className={`px-2 py-0.5 text-[9px] transition-all ${
                        !sortDesc
                          ? "bg-bg-tertiary text-text-primary font-medium"
                          : "bg-bg-elevated/50 text-text-muted hover:text-text-secondary"
                      }`}
                    >
                      昇順
                    </button>
                    <button
                      onClick={() => setSortDesc(true)}
                      className={`px-2 py-0.5 text-[9px] border-l border-border/40 transition-all ${
                        sortDesc
                          ? "bg-bg-tertiary text-text-primary font-medium"
                          : "bg-bg-elevated/50 text-text-muted hover:text-text-secondary"
                      }`}
                    >
                      降順
                    </button>
                  </div>
                </div>
              )}
              {textLayers.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-[10px] text-text-muted">
                  テキストレイヤーなし
                </div>
              ) : (
                (sortDesc ? [...textLayers].reverse() : textLayers).map((entry, i) => (
                  <TextLayerRow key={i} entry={entry} fontInfo={fontInfo} useActualFont={useActualFont} />
                ))
              )}
            </div>
          ) : (
            <div className="p-1.5">
              {viewerFile?.metadata?.layerTree?.length ? (
                <LayerTree layers={viewerFile.metadata.layerTree} />
              ) : (
                <div className="flex items-center justify-center py-8 text-[10px] text-text-muted">
                  レイヤー情報なし
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const splashOverlay = splashPhase !== "hidden" && createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-white pointer-events-none transition-opacity ease-in-out"
      style={{
        opacity: splashPhase === "in" || splashPhase === "out" ? 0 : 1,
        transitionDuration: splashPhase === "in" ? "200ms" : splashPhase === "out" ? "350ms" : "0ms",
      }}
      ref={(el) => {
        // Force reflow so "in" transition actually animates from 0→1
        if (el && splashPhase === "in") {
          void el.offsetHeight;
          el.style.opacity = "1";
        }
      }}
    >
      <div className="flex flex-col items-center gap-3">
        <span
          className="font-display font-bold tracking-wide"
          style={{
            fontSize: "min(8vw, 8vh)",
            lineHeight: 1.3,
            background: "linear-gradient(135deg, #ff6b9d, #c084fc, #60a5fa, #34d399)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          COMIC-Bridge
        </span>
        <span
          className="font-medium tracking-[0.3em] uppercase text-black/20"
          style={{ fontSize: "min(1.5vw, 1.5vh)" }}
        >
          viewer
        </span>
      </div>
    </div>,
    document.body
  );

  if (isFullscreen) {
    return (
      <>
        {createPortal(viewerContent, document.body)}
        {splashOverlay}
      </>
    );
  }

  return (
    <>
      {viewerContent}
      {splashOverlay}
    </>
  );
}
