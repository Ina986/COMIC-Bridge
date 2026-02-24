import { useScanPsdStore } from "../../../store/scanPsdStore";

export function FontSizesTab() {
  const scanData = useScanPsdStore((s) => s.scanData);

  if (!scanData) {
    return (
      <div className="text-center py-8">
        <p className="text-xs text-text-muted">スキャンデータがありません</p>
      </div>
    );
  }

  const sizeStats = scanData.sizeStats ?? { mostFrequent: null, sizes: [], excludeRange: null, allSizes: {} };
  const strokeStats = scanData.strokeStats ?? { sizes: [] };
  const top10 = (sizeStats.sizes ?? []).slice(0, 10);
  const remaining = (sizeStats.sizes ?? []).slice(10);
  const maxCount = top10.length > 0 ? top10[0].count : 1;

  return (
    <div className="space-y-4">
      {/* ベースサイズ — ヒーロー表示 */}
      <div
        className="rounded-xl p-4 text-center relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, rgba(255,177,66,0.1), rgba(255,90,138,0.08))" }}
      >
        <div className="absolute inset-0 bg-tone opacity-50" />
        <div className="relative">
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">ベースフォントサイズ</p>
          {sizeStats.mostFrequent ? (
            <>
              <span
                className="text-3xl font-black font-display"
                style={{ background: "linear-gradient(135deg, #ff5a8a, #7c5cff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
              >
                {sizeStats.mostFrequent.size}
              </span>
              <span className="text-sm font-bold text-text-muted ml-0.5">pt</span>
              <p className="text-[10px] text-text-muted mt-0.5">{sizeStats.mostFrequent.count}回使用</p>
            </>
          ) : (
            <p className="text-sm text-text-muted">検出なし</p>
          )}
        </div>
      </div>

      {/* Top10サイズ — バー付き */}
      <div>
        <h4 className="text-[10px] font-bold text-text-secondary mb-2">登録サイズ Top10</h4>
        <div className="space-y-1">
          {top10.map((s, i) => (
            <div key={s.size} className="flex items-center gap-2">
              <span className={`text-[11px] font-bold w-10 text-right flex-shrink-0 ${
                i === 0 ? "text-accent" : "text-text-primary"
              }`}>
                {s.size}pt
              </span>
              <div className="flex-1 h-4 bg-bg-tertiary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max((s.count / maxCount) * 100, 4)}%`,
                    background: i === 0
                      ? "linear-gradient(90deg, #ff5a8a, #7c5cff)"
                      : `rgba(124, 92, 255, ${0.5 - i * 0.04})`,
                  }}
                />
              </div>
              <span className="text-[9px] text-text-muted w-7 text-right flex-shrink-0">{s.count}</span>
            </div>
          ))}
        </div>
        {remaining.length > 0 && (
          <details className="mt-2">
            <summary className="text-[10px] text-accent cursor-pointer hover:text-accent-hover font-medium">
              その他 ({remaining.length}サイズ)
            </summary>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {remaining.map((s) => (
                <span key={s.size} className="text-[9px] text-text-muted bg-bg-tertiary px-1.5 py-0.5 rounded-lg border border-border/30">
                  {s.size}pt({s.count})
                </span>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* ルビ除外範囲 */}
      {sizeStats.excludeRange && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-manga-lavender/30 rounded-xl border border-accent-secondary/15">
          <svg className="w-3.5 h-3.5 text-accent-secondary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <span className="text-[10px] font-bold text-accent-secondary block">ルビ除外範囲</span>
            <span className="text-xs text-text-primary font-medium">
              {sizeStats.excludeRange.min}pt 〜 {sizeStats.excludeRange.max}pt
            </span>
            <span className="text-[9px] text-text-muted ml-1.5">(ベースの約半分 ±1pt)</span>
          </div>
        </div>
      )}

      {/* 白フチサイズ */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <h4 className="text-[10px] font-bold text-text-secondary">白フチサイズ</h4>
          <span className="text-[9px] font-bold text-accent-tertiary bg-accent-tertiary/10 px-2 py-0.5 rounded-full">
            {strokeStats.sizes.length}
          </span>
        </div>
        {strokeStats.sizes.length === 0 ? (
          <p className="text-xs text-text-muted py-2 text-center bg-bg-tertiary/30 rounded-xl border border-dashed border-border">検出なし</p>
        ) : (
          <div className="space-y-1.5">
            {strokeStats.sizes.map((s) => (
              <div key={s.size} className="bg-bg-tertiary/40 rounded-lg px-3 py-2 border border-border/30 hover:border-accent-tertiary/30 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-accent-tertiary">{s.size}px</span>
                  <span className="text-[9px] text-text-muted bg-bg-primary px-1.5 py-0.5 rounded">{s.count}回</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {s.fontSizes.slice(0, 8).map((fs) => (
                    <span key={fs} className="text-[9px] text-text-secondary bg-white px-1.5 py-0.5 rounded border border-border/40">
                      {fs}pt
                    </span>
                  ))}
                  {s.fontSizes.length > 8 && (
                    <span className="text-[9px] text-text-muted">+{s.fontSizes.length - 8}</span>
                  )}
                </div>
                {s.maxFontSize && (
                  <span className="text-[9px] text-text-muted mt-1 block">
                    最大フォント: {s.maxFontSize}pt
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
