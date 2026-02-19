import { useScanPsdStore } from "../../../store/scanPsdStore";

export function GuideLinesTab() {
  const scanData = useScanPsdStore((s) => s.scanData);
  const selectedGuideIndex = useScanPsdStore((s) => s.selectedGuideIndex);
  const excludedGuideIndices = useScanPsdStore((s) => s.excludedGuideIndices);
  const setSelectedGuideIndex = useScanPsdStore((s) => s.setSelectedGuideIndex);
  const toggleExcludedGuide = useScanPsdStore((s) => s.toggleExcludedGuide);

  if (!scanData) {
    return (
      <div className="text-center py-8">
        <p className="text-xs text-text-muted">スキャンデータがありません</p>
        <p className="text-[10px] text-text-muted mt-1">
          JSON読み込み時にリンクされたscandataが見つからない場合、ガイド一覧は表示できません
        </p>
      </div>
    );
  }

  const guideSets = scanData.guideSets ?? [];
  const focusedIndex = selectedGuideIndex;
  const focusedSet = focusedIndex != null ? guideSets[focusedIndex] ?? null : null;

  // タチキリ妥当性チェック（元スクリプト isValidTachikiriGuideSet 準拠）
  // 中心から±1pxのガイドは除外し、上下左右それぞれに1本以上必要
  function isValidTachikiri(gs: typeof guideSets[0]): boolean {
    if (!gs.docWidth || !gs.docHeight) return true; // 後方互換性
    const centerX = gs.docWidth / 2;
    const centerY = gs.docHeight / 2;
    const tolerance = 1;

    let hasAbove = false, hasBelow = false;
    for (const h of gs.horizontal) {
      if (Math.abs(h - centerY) <= tolerance) continue;
      if (h < centerY) hasAbove = true;
      else hasBelow = true;
    }

    let hasLeft = false, hasRight = false;
    for (const v of gs.vertical) {
      if (Math.abs(v - centerX) <= tolerance) continue;
      if (v < centerX) hasLeft = true;
      else hasRight = true;
    }

    return hasAbove && hasBelow && hasLeft && hasRight;
  }

  return (
    <div className="space-y-3">
      {/* ガイドセット一覧 */}
      <div className="bg-bg-tertiary rounded-xl p-3">
        <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">
          ガイドセット ({guideSets.length})
        </h4>
        {guideSets.length === 0 ? (
          <p className="text-xs text-text-muted text-center py-4">ガイドが検出されませんでした</p>
        ) : (
          <div className="space-y-1 max-h-64 overflow-auto">
            {guideSets.map((gs, i) => {
              const isSelected = selectedGuideIndex === i;
              const isExcluded = excludedGuideIndices.has(i);
              const isFocused = focusedIndex === i;
              const valid = isValidTachikiri(gs);

              return (
                <button
                  key={i}
                  onClick={() => setSelectedGuideIndex(isSelected ? null : i)}
                  className={`
                    w-full text-left rounded-lg px-2.5 py-2 transition-colors
                    ${isSelected
                      ? "bg-accent/10 border border-accent/30"
                      : isExcluded
                        ? "bg-bg-elevated/50 border border-transparent opacity-50"
                        : isFocused
                          ? "bg-bg-elevated border border-white/20"
                          : "bg-bg-elevated border border-transparent hover:border-white/10"
                    }
                  `}
                >
                  <div className="flex items-center gap-2">
                    {/* ステータスアイコン */}
                    <span className={`text-[10px] flex-shrink-0 ${
                      isSelected ? "text-accent" : isExcluded ? "text-error" : "text-text-muted"
                    }`}>
                      {isSelected ? "✓" : isExcluded ? "✕" : "-"}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-text-primary">
                          H:{gs.horizontal.length} V:{gs.vertical.length}
                        </span>
                        <span className="text-[9px] text-text-muted">
                          {gs.docWidth}x{gs.docHeight}
                        </span>
                        {!valid && (
                          <span className="text-[9px] text-warning bg-warning/10 px-1 rounded">
                            非タチキリ
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 状態バッジ */}
                    {isSelected ? (
                      <span className="text-[8px] font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded flex-shrink-0">
                        選択中
                      </span>
                    ) : isExcluded ? (
                      <span className="text-[8px] font-medium text-error/60 px-1.5 py-0.5 flex-shrink-0">
                        除外
                      </span>
                    ) : (
                      <span className="text-[8px] font-medium text-text-muted/60 px-1.5 py-0.5 flex-shrink-0">
                        未選択
                      </span>
                    )}

                    <span className="text-[9px] text-text-muted flex-shrink-0">
                      {gs.count}p
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* 操作ボタン */}
        {guideSets.length > 0 && selectedGuideIndex != null && (
          <div className="flex gap-2 mt-2">
            {excludedGuideIndices.has(selectedGuideIndex) ? (
              <button
                onClick={() => toggleExcludedGuide(selectedGuideIndex)}
                className="flex-1 py-1.5 text-[10px] font-medium text-success bg-success/10 rounded-lg hover:bg-success/20 transition-colors"
              >
                除外解除
              </button>
            ) : (
              <button
                onClick={() => toggleExcludedGuide(selectedGuideIndex)}
                className="flex-1 py-1.5 text-[10px] font-medium text-error bg-error/10 rounded-lg hover:bg-error/20 transition-colors"
              >
                除外
              </button>
            )}
          </div>
        )}
      </div>

      {/* ガイド詳細 */}
      {focusedSet && (
        <div className="bg-bg-tertiary rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
              ガイド詳細
            </h4>
            {selectedGuideIndex === focusedIndex && (
              <span className="text-[8px] font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                選択中
              </span>
            )}
          </div>
          <div className="space-y-2">
            <div>
              <span className="text-[10px] text-text-muted">水平ガイド ({focusedSet.horizontal.length}本)</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {focusedSet.horizontal.map((h, i) => (
                  <span key={i} className="text-[10px] text-text-secondary bg-bg-elevated px-1.5 py-0.5 rounded">
                    {h}px
                  </span>
                ))}
              </div>
            </div>
            <div>
              <span className="text-[10px] text-text-muted">垂直ガイド ({focusedSet.vertical.length}本)</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {focusedSet.vertical.map((v, i) => (
                  <span key={i} className="text-[10px] text-text-secondary bg-bg-elevated px-1.5 py-0.5 rounded">
                    {v}px
                  </span>
                ))}
              </div>
            </div>
            <div className="text-[10px] text-text-muted">
              ドキュメントサイズ: {focusedSet.docWidth} x {focusedSet.docHeight} px
            </div>
            <details>
              <summary className="text-[10px] text-text-muted cursor-pointer hover:text-text-secondary">
                使用ページ ({focusedSet.docNames.length}件)
              </summary>
              <div className="mt-1 max-h-32 overflow-auto space-y-0.5">
                {focusedSet.docNames.map((name, i) => (
                  <div key={i} className="text-[9px] text-text-muted truncate">{name}</div>
                ))}
              </div>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}
