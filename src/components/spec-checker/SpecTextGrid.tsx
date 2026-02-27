import { useState, useMemo } from "react";
import { usePsdStore } from "../../store/psdStore";
import {
  useFontResolver,
  collectTextLayers,
  MISSING_FONT_COLOR,
  type FontHelpers,
  type TextLayerEntry,
} from "../../hooks/useFontResolver";

export function SpecTextGrid() {
  const files = usePsdStore((s) => s.files);
  const activeFileId = usePsdStore((s) => s.activeFileId);
  const selectFile = usePsdStore((s) => s.selectFile);

  const { fontInfo, allFonts, totalTextLayers, missingFonts } = useFontResolver(files);

  const [useActualFont, setUseActualFont] = useState(false);
  const [sortDesc, setSortDesc] = useState(false);

  // サイズ統計の集計（頻度順）
  const sizeStats = useMemo(() => {
    const sizeCount = new Map<number, number>();
    for (const file of files) {
      if (!file.metadata?.layerTree) continue;
      for (const entry of collectTextLayers(file.metadata.layerTree)) {
        if (!entry.textInfo) continue;
        for (const size of entry.textInfo.fontSizes) {
          sizeCount.set(size, (sizeCount.get(size) || 0) + 1);
        }
      }
    }
    return [...sizeCount.entries()].sort((a, b) => b[1] - a[1]);
  }, [files]);

  // 白フチ統計の集計（サイズ別頻度順）
  const strokeStats = useMemo(() => {
    const strokeCount = new Map<number, number>();
    let totalWithStroke = 0;
    for (const file of files) {
      if (!file.metadata?.layerTree) continue;
      for (const entry of collectTextLayers(file.metadata.layerTree)) {
        const s = entry.textInfo?.strokeSize;
        if (s != null && s > 0) {
          strokeCount.set(s, (strokeCount.get(s) || 0) + 1);
          totalWithStroke++;
        }
      }
    }
    return {
      entries: [...strokeCount.entries()].sort((a, b) => b[1] - a[1]),
      total: totalWithStroke,
    };
  }, [files]);

  return (
    <div className="h-full overflow-auto p-4 select-none">
      {/* Summary row: Font + Size + Stroke */}
      {(allFonts.length > 0 || sizeStats.length > 0 || strokeStats.entries.length > 0) && (
        <div className="mb-4 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          {/* Font Summary */}
          {allFonts.length > 0 && (
            <div className="p-3 bg-bg-secondary/80 border border-border rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-3.5 h-3.5 text-[#f06292]" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M5 4h10v2.5h-1.2V5.5H10.6V14h1.5v1.5h-4.2V14h1.5V5.5H6.2v1H5V4z" />
                </svg>
                <span className="text-[11px] font-medium text-text-primary">
                  使用フォント
                </span>
                <span className="text-[10px] text-text-muted">
                  {allFonts.length} 種類 / {totalTextLayers} レイヤー
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {allFonts.map(([font, count]) => {
                  const color = fontInfo.getFontColor(font);
                  const missing = fontInfo.isMissing(font);
                  return (
                    <span
                      key={font}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[10px]"
                      style={{
                        backgroundColor: `${color}10`,
                        borderColor: `${color}30`,
                      }}
                      title={missing ? `${font} (未インストール)` : font}
                    >
                      <span className="font-medium" style={{ color }}>
                        {fontInfo.getFontLabel(font)}
                      </span>
                      <span className="text-text-muted">({count})</span>
                      {missing && (
                        <span className="text-[8px] px-1 py-px rounded font-bold" style={{ backgroundColor: `${MISSING_FONT_COLOR}20`, color: MISSING_FONT_COLOR }}>
                          未インストール
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Size Summary */}
          {sizeStats.length > 0 && (
            <div className="p-3 bg-bg-secondary/80 border border-border rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-3.5 h-3.5 text-[#64b5f6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h6" />
                </svg>
                <span className="text-[11px] font-medium text-text-primary">
                  サイズ統計
                </span>
                <span className="text-[12px] font-semibold text-[#64b5f6]">
                  基本 {sizeStats[0][0]}pt
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {sizeStats.map(([size, count]) => (
                  <span
                    key={size}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[#64b5f6]/30 bg-[#64b5f6]/10 text-[10px]"
                  >
                    <span className="font-medium text-[#64b5f6]">{size}pt</span>
                    <span className="text-text-muted">({count})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Stroke Summary */}
          {strokeStats.entries.length > 0 && (
            <div className="p-3 bg-bg-secondary/80 border border-border rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-3.5 h-3.5 text-accent-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-[11px] font-medium text-text-primary">
                  白フチ統計
                </span>
                <span className="text-[10px] text-text-muted">
                  {strokeStats.total} レイヤー
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {strokeStats.entries.map(([size, count]) => (
                  <span
                    key={size}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-accent-tertiary/30 bg-accent-tertiary/10 text-[10px]"
                  >
                    <span className="font-medium text-accent-tertiary">{size}px</span>
                    <span className="text-text-muted">({count})</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Missing font warning banner */}
      {missingFonts.size > 0 && (
        <div className="mb-4 p-3 bg-red-500/5 border border-red-500/30 rounded-xl flex items-start gap-2">
          <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <div className="text-[11px] font-medium text-red-400">
              未インストールフォント ({missingFonts.size}件)
            </div>
            <div className="text-[10px] text-red-400/70 mt-0.5">
              {[...missingFonts].join("、")}
            </div>
          </div>
        </div>
      )}

      {/* Toolbar: font toggle + sort toggle */}
      <div className="mb-3 flex items-center gap-3">
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setUseActualFont(false)}
            className={`px-2.5 py-1 text-[10px] transition-all ${
              !useActualFont
                ? "bg-bg-tertiary text-text-primary font-medium"
                : "bg-bg-secondary/50 text-text-muted hover:text-text-secondary"
            }`}
          >
            デフォルト
          </button>
          <button
            onClick={() => setUseActualFont(true)}
            className={`px-2.5 py-1 text-[10px] border-l border-border transition-all ${
              useActualFont
                ? "bg-bg-tertiary text-text-primary font-medium"
                : "bg-bg-secondary/50 text-text-muted hover:text-text-secondary"
            }`}
          >
            プレビュー
          </button>
        </div>
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setSortDesc(false)}
            className={`px-2.5 py-1 text-[10px] transition-all ${
              !sortDesc
                ? "bg-bg-tertiary text-text-primary font-medium"
                : "bg-bg-secondary/50 text-text-muted hover:text-text-secondary"
            }`}
          >
            昇順
          </button>
          <button
            onClick={() => setSortDesc(true)}
            className={`px-2.5 py-1 text-[10px] border-l border-border transition-all ${
              sortDesc
                ? "bg-bg-tertiary text-text-primary font-medium"
                : "bg-bg-secondary/50 text-text-muted hover:text-text-secondary"
            }`}
          >
            降順
          </button>
        </div>
      </div>

      {/* Per-file text layers */}
      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
        }}
      >
        {files.map((file) => {
          const raw = file.metadata?.layerTree
            ? collectTextLayers(file.metadata.layerTree)
            : [];
          const textLayers = sortDesc ? [...raw].reverse() : raw;

          return (
            <div
              key={file.id}
              className={`
                border rounded-xl cursor-pointer bg-bg-secondary/50 transition-all
                hover:bg-bg-secondary/80
                ${activeFileId === file.id
                  ? "border-accent/50 ring-1 ring-accent/20"
                  : "border-border hover:border-border-strong/50"
                }
              `}
              onClick={() => selectFile(file.id)}
            >
              {/* Header */}
              <div className="px-3 py-2 border-b border-border/60 flex items-center gap-2">
                <span
                  className={`text-[11px] font-medium truncate flex-1 ${
                    activeFileId === file.id ? "text-accent" : "text-text-primary"
                  }`}
                >
                  {file.fileName.replace(/\.(psd|psb)$/i, "")}
                </span>
                <span className="text-[10px] text-text-muted flex-shrink-0">
                  {textLayers.length > 0
                    ? `${textLayers.length} テキスト`
                    : "テキストなし"
                  }
                </span>
              </div>

              {/* Text layer list */}
              <div className="p-2 space-y-1">
                {textLayers.length === 0 ? (
                  <div className="flex items-center justify-center py-6 text-[10px] text-text-muted">
                    テキストレイヤーなし
                  </div>
                ) : (
                  textLayers.map((entry, i) => (
                    <TextLayerRow key={i} entry={entry} fontInfo={fontInfo} useActualFont={useActualFont} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TextLayerRow({ entry, fontInfo, useActualFont = false }: { entry: TextLayerEntry; fontInfo: FontHelpers; useActualFont?: boolean }) {
  const info = entry.textInfo;
  const rawText = info?.text ?? "";
  // テキスト内容がなければレイヤー名をフォールバック
  const displayText = rawText.length > 0 ? rawText : entry.layerName;

  return (
    <div
      className={`
        px-2.5 py-1.5 rounded-lg bg-bg-tertiary/50 border border-border/30
        ${entry.visible ? "" : "opacity-50"}
      `}
    >
      {/* Font badges + size + visibility */}
      <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
        <svg className="w-3 h-3 text-[#f06292] flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path d="M5 4h10v2.5h-1.2V5.5H10.6V14h1.5v1.5h-4.2V14h1.5V5.5H6.2v1H5V4z" />
        </svg>
        {info?.fonts.map((font) => {
          const color = fontInfo.getFontColor(font);
          const missing = fontInfo.isMissing(font);
          return (
            <span
              key={font}
              className="text-[9px] px-1.5 py-0.5 rounded font-medium"
              style={{
                backgroundColor: `${color}15`,
                color,
                ...(missing ? { textDecoration: "line-through", textDecorationColor: `${color}60` } : {}),
              }}
              title={missing ? `${font} (未インストール)` : font}
            >
              {fontInfo.getFontLabel(font)}
              {missing && " !"}
            </span>
          );
        })}
        {info && info.fontSizes.length > 0 && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-text-muted">
            {info.fontSizes.join(" / ")}pt
          </span>
        )}
        {info?.strokeSize != null && info.strokeSize > 0 && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent-tertiary/15 text-accent-tertiary">
            白フチ{info.strokeSize}px
          </span>
        )}
        {!entry.visible && (
          <span className="text-[9px] px-1 py-px rounded bg-text-muted/10 text-text-muted">
            非表示
          </span>
        )}
      </div>

      {/* Text content (with line breaks preserved) */}
      <div
        className="text-[10px] text-text-primary leading-relaxed pl-[18px] whitespace-pre-wrap"
        style={{
          fontFamily: useActualFont && info?.fonts[0] ? fontInfo.getFontFamily(info.fonts[0]) : undefined,
        }}
      >
        {displayText}
      </div>
    </div>
  );
}
