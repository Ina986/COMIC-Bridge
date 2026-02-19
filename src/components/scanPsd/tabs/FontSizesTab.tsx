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

  return (
    <div className="space-y-3">
      {/* ベースサイズ */}
      <div className="bg-bg-tertiary rounded-xl p-3">
        <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">ベースフォントサイズ</h4>
        {sizeStats.mostFrequent ? (
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-accent">{sizeStats.mostFrequent.size}Q</span>
            <span className="text-[10px] text-text-muted">({sizeStats.mostFrequent.count}回使用)</span>
          </div>
        ) : (
          <p className="text-xs text-text-muted">検出なし</p>
        )}
      </div>

      {/* Top10サイズ */}
      <div className="bg-bg-tertiary rounded-xl p-3">
        <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">
          登録サイズ Top10
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {top10.map((s, i) => (
            <div
              key={s.size}
              className={`
                px-2.5 py-1 rounded-lg text-xs font-medium
                ${i === 0
                  ? "bg-accent/20 text-accent border border-accent/30"
                  : "bg-bg-elevated text-text-secondary border border-white/5"
                }
              `}
            >
              {s.size}Q
              <span className="text-[9px] ml-1 opacity-60">{s.count}</span>
            </div>
          ))}
        </div>
        {remaining.length > 0 && (
          <details className="mt-2">
            <summary className="text-[10px] text-text-muted cursor-pointer hover:text-text-secondary">
              その他 ({remaining.length}サイズ)
            </summary>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {remaining.map((s) => (
                <span key={s.size} className="text-[9px] text-text-muted bg-bg-elevated px-1.5 py-0.5 rounded">
                  {s.size}Q({s.count})
                </span>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* ルビ除外範囲 */}
      {sizeStats.excludeRange && (
        <div className="bg-bg-tertiary rounded-xl p-3">
          <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">
            ルビ除外範囲
          </h4>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-primary font-medium">
              {sizeStats.excludeRange.min}Q 〜 {sizeStats.excludeRange.max}Q
            </span>
            <span className="text-[9px] text-text-muted">
              (ベースサイズの約半分 ±1pt)
            </span>
          </div>
        </div>
      )}

      {/* ストローク/フチサイズ */}
      <div className="bg-bg-tertiary rounded-xl p-3">
        <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">
          白フチサイズ ({strokeStats.sizes.length})
        </h4>
        {strokeStats.sizes.length === 0 ? (
          <p className="text-xs text-text-muted">検出なし</p>
        ) : (
          <div className="space-y-1.5">
            {strokeStats.sizes.map((s) => (
              <div key={s.size} className="bg-bg-elevated rounded-lg px-2.5 py-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-primary">{s.size}px</span>
                  <span className="text-[9px] text-text-muted">{s.count}回</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {s.fontSizes.slice(0, 8).map((fs) => (
                    <span key={fs} className="text-[9px] text-text-muted bg-bg-tertiary px-1 py-0.5 rounded">
                      {fs}Q
                    </span>
                  ))}
                  {s.fontSizes.length > 8 && (
                    <span className="text-[9px] text-text-muted">+{s.fontSizes.length - 8}</span>
                  )}
                </div>
                {s.maxFontSize && (
                  <span className="text-[9px] text-text-muted mt-0.5 block">
                    最大フォント: {s.maxFontSize}Q
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
