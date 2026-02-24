import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useScanPsdStore } from "../../../store/scanPsdStore";
import { getAutoSubName } from "../../../types/scanPsd";
import type { FontPreset } from "../../../types/scanPsd";
import { MISSING_FONT_COLOR } from "../../../hooks/useFontResolver";
import type { FontResolveInfo } from "../../../hooks/useFontResolver";

export function FontTypesTab() {
  const scanData = useScanPsdStore((s) => s.scanData);
  const presetSets = useScanPsdStore((s) => s.presetSets);
  const currentSetName = useScanPsdStore((s) => s.currentSetName);
  const setCurrentSetName = useScanPsdStore((s) => s.setCurrentSetName);
  const addPresetSet = useScanPsdStore((s) => s.addPresetSet);
  const removePresetSet = useScanPsdStore((s) => s.removePresetSet);
  const renamePresetSet = useScanPsdStore((s) => s.renamePresetSet);
  const addFontToPreset = useScanPsdStore((s) => s.addFontToPreset);
  const removeFontFromPreset = useScanPsdStore((s) => s.removeFontFromPreset);
  const updateFontInPreset = useScanPsdStore((s) => s.updateFontInPreset);

  const [editMode, setEditMode] = useState<"none" | "add" | "rename">("none");
  const [inputValue, setInputValue] = useState("");
  const [editingPresetIndex, setEditingPresetIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: "", subName: "" });

  const currentPresets = presetSets[currentSetName] || [];
  const setNames = Object.keys(presetSets);

  const registeredFonts = new Set(
    Object.values(presetSets).flatMap((ps) => ps.map((p) => p.font))
  );
  const unregisteredFonts = scanData?.fonts
    ? scanData.fonts.filter((f) => !registeredFonts.has(f.name))
    : [];

  // --- フォントインストール状態チェック ---
  const allPresetFontNames = useMemo(() => {
    const names = new Set<string>();
    for (const presets of Object.values(presetSets)) {
      for (const p of presets) {
        if (p.font) names.add(p.font);
      }
    }
    return [...names];
  }, [presetSets]);

  const [fontResolveMap, setFontResolveMap] = useState<Record<string, FontResolveInfo>>({});
  const [fontChecked, setFontChecked] = useState(false);

  useEffect(() => {
    if (allPresetFontNames.length === 0) {
      setFontChecked(false);
      return;
    }
    setFontChecked(false);
    invoke<Record<string, FontResolveInfo>>("resolve_font_names", {
      postscriptNames: allPresetFontNames,
    })
      .then((result) => {
        setFontResolveMap(result);
        setFontChecked(true);
      })
      .catch(console.error);
  }, [allPresetFontNames]);

  const isFontMissing = (psName: string) => fontChecked && !(psName in fontResolveMap);
  const missingFontNames = useMemo(
    () => fontChecked ? allPresetFontNames.filter((n) => !(n in fontResolveMap)) : [],
    [fontChecked, allPresetFontNames, fontResolveMap]
  );

  const handleAddSet = () => {
    if (inputValue.trim()) {
      addPresetSet(inputValue.trim());
      setCurrentSetName(inputValue.trim());
      setInputValue("");
      setEditMode("none");
    }
  };

  const handleRenameSet = () => {
    if (inputValue.trim() && inputValue.trim() !== currentSetName) {
      renamePresetSet(currentSetName, inputValue.trim());
      setInputValue("");
      setEditMode("none");
    }
  };

  const handleAddUnregistered = (fontName: string, displayName: string, count: number) => {
    const preset: FontPreset = {
      name: displayName || fontName,
      subName: getAutoSubName(fontName),
      font: fontName,
      description: `使用回数: ${count}`,
    };
    addFontToPreset(currentSetName, preset);
  };

  const handleAddAllUnregistered = () => {
    for (const f of unregisteredFonts) {
      const preset: FontPreset = {
        name: f.displayName || f.name,
        subName: getAutoSubName(f.name),
        font: f.name,
        description: `使用回数: ${f.count}`,
      };
      addFontToPreset(currentSetName, preset);
    }
  };

  return (
    <div className="space-y-4">
      {/* プリセットセット選択 */}
      <div className="bg-bg-tertiary/50 rounded-xl p-3 border border-border/30">
        <div className="flex items-center gap-2 mb-2">
          <select
            value={currentSetName}
            onChange={(e) => setCurrentSetName(e.target.value)}
            className="flex-1 bg-white border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-primary
              focus:border-accent focus:outline-none"
          >
            {setNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <button
            onClick={() => { setEditMode("add"); setInputValue(""); }}
            className="w-7 h-7 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 flex items-center justify-center transition-colors"
            title="セット追加"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
          <button
            onClick={() => { setEditMode("rename"); setInputValue(currentSetName); }}
            className="text-[10px] text-text-muted hover:text-accent px-1.5 py-1 rounded-lg hover:bg-accent/5 transition-colors"
            title="名前変更"
          >
            名前変更
          </button>
          {setNames.length > 1 && (
            <button
              onClick={() => removePresetSet(currentSetName)}
              className="text-[10px] text-text-muted hover:text-error px-1.5 py-1 rounded-lg hover:bg-error/5 transition-colors"
              title="セット削除"
            >
              削除
            </button>
          )}
        </div>

        {editMode !== "none" && (
          <div className="flex items-center gap-2 mt-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") editMode === "add" ? handleAddSet() : handleRenameSet();
                if (e.key === "Escape") setEditMode("none");
              }}
              placeholder={editMode === "add" ? "新規セット名" : "新しいセット名"}
              className="flex-1 bg-white border border-accent/40 rounded-lg px-2.5 py-1.5 text-xs text-text-primary
                focus:outline-none focus:ring-2 focus:ring-accent/15"
              autoFocus
            />
            <button
              onClick={editMode === "add" ? handleAddSet : handleRenameSet}
              className="text-[10px] text-white font-medium px-3 py-1.5 rounded-lg"
              style={{ background: "linear-gradient(135deg, #ff5a8a, #7c5cff)" }}
            >
              OK
            </button>
            <button
              onClick={() => setEditMode("none")}
              className="text-[10px] text-text-muted px-2 py-1"
            >
              取消
            </button>
          </div>
        )}
      </div>

      {/* フォントプリセットリスト */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <h4 className="text-[10px] font-bold text-text-secondary">
            プリセット
          </h4>
          <span className="text-[9px] font-bold text-accent-secondary bg-accent-secondary/10 px-2 py-0.5 rounded-full">
            {currentPresets.length}
          </span>
          {fontChecked && missingFontNames.length === 0 && currentPresets.length > 0 && (
            <span className="text-[9px] font-bold text-success bg-success/10 px-2 py-0.5 rounded-full flex items-center gap-1">
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              全フォントOK
            </span>
          )}
        </div>

        {/* 未インストールフォント警告 */}
        {fontChecked && missingFontNames.length > 0 && (
          <div
            className="flex items-start gap-2 px-3 py-2 rounded-xl mb-2 border"
            style={{ backgroundColor: `${MISSING_FONT_COLOR}08`, borderColor: `${MISSING_FONT_COLOR}25` }}
          >
            <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke={MISSING_FONT_COLOR} strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-[10px] font-bold" style={{ color: MISSING_FONT_COLOR }}>
                未インストール: {missingFontNames.length}件
              </p>
              <p className="text-[9px] mt-0.5" style={{ color: `${MISSING_FONT_COLOR}cc` }}>
                {missingFontNames.map((n) => fontResolveMap[n]?.display_name || n).join(", ")}
              </p>
            </div>
          </div>
        )}

        {currentPresets.length === 0 ? (
          <p className="text-[10px] text-text-muted py-4 text-center bg-bg-tertiary/30 rounded-xl border border-dashed border-border">
            プリセットがありません
          </p>
        ) : (
          <div className="border border-border/50 rounded-xl overflow-hidden">
            {/* テーブルヘッダー */}
            <div
              className="grid items-center gap-x-2.5 px-2.5 py-1.5 bg-bg-tertiary/60 border-b border-border/40 text-[9px] font-bold text-text-muted"
              style={{ gridTemplateColumns: "20px 76px 1fr 44px" }}
            >
              <span />
              <span>カテゴリ</span>
              <span>フォント名</span>
              <span />
            </div>
            {/* テーブルボディ */}
            <div>
            {sortedPresets(currentPresets).map(({ preset: p, originalIndex }, idx) => {
              const missing = isFontMissing(p.font);
              return (
              <div key={originalIndex}>
                <div
                  className={`grid items-start gap-x-2.5 px-2.5 py-1.5 group
                    border-b last:border-b-0 transition-all ${
                      missing
                        ? "bg-red-50/60 hover:bg-red-50 border-red-200/30"
                        : idx % 2 === 0
                          ? "bg-white hover:bg-bg-secondary/60 border-border/20"
                          : "bg-bg-secondary/30 hover:bg-bg-secondary/60 border-border/20"
                    }`}
                  style={{ gridTemplateColumns: "20px 76px 1fr 44px" }}
                >
                  {/* インストール状態 */}
                  <span className="flex items-center justify-center pt-0.5">
                    {fontChecked && (
                      missing ? (
                        <span
                          className="w-4 h-4 rounded flex items-center justify-center"
                          style={{ backgroundColor: `${MISSING_FONT_COLOR}15` }}
                          title="未インストール"
                        >
                          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke={MISSING_FONT_COLOR} strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </span>
                      ) : (
                        <span
                          className="w-4 h-4 rounded flex items-center justify-center"
                          style={{ backgroundColor: "#10b98115" }}
                          title="インストール済み"
                        >
                          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="#10b981" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                      )
                    )}
                  </span>
                  {/* カテゴリ */}
                  <span>
                    {p.subName ? (
                      <span
                        className="text-[9px] font-semibold px-1.5 py-0.5 rounded border inline-block truncate max-w-full"
                        style={getSubNameStyle(p.subName)}
                      >
                        {p.subName}
                      </span>
                    ) : (
                      <span className="text-[9px] text-text-muted/40">—</span>
                    )}
                  </span>
                  {/* フォント名 + PostScript名 */}
                  <span className="min-w-0">
                    <span
                      className={`text-[11px] block ${missing ? "" : "text-text-primary"}`}
                      style={missing
                        ? { color: MISSING_FONT_COLOR, textDecoration: "line-through", textDecorationColor: `${MISSING_FONT_COLOR}50` }
                        : undefined
                      }
                    >
                      {p.name}
                    </span>
                    <span
                      className={`text-[9px] font-mono block ${missing ? "" : "text-text-muted"}`}
                      style={missing ? { color: `${MISSING_FONT_COLOR}90` } : undefined}
                    >
                      {p.font}
                    </span>
                  </span>
                  {/* アクション */}
                  <span className="flex items-center gap-1 justify-end">
                    <button
                      onClick={() => {
                        setEditingPresetIndex(originalIndex);
                        setEditForm({ name: p.name, subName: p.subName || "" });
                      }}
                      className="text-text-muted hover:text-accent transition-colors opacity-0 group-hover:opacity-100"
                      title="編集"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => removeFontFromPreset(currentSetName, originalIndex)}
                      className="text-text-muted hover:text-error transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                </div>
                {/* インライン編集フォーム */}
                {editingPresetIndex === originalIndex && (
                  <div className="mx-2 my-1 bg-bg-tertiary/60 rounded-lg px-2.5 py-2 border border-accent/20 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-text-muted w-12 flex-shrink-0">カテゴリ</span>
                      <select
                        value={editForm.subName}
                        onChange={(e) => setEditForm({ ...editForm, subName: e.target.value })}
                        className="flex-1 bg-white border border-border rounded-lg px-2 py-1 text-[10px] text-text-primary
                          focus:border-accent focus:outline-none"
                      >
                        <option value="">なし</option>
                        {UNIQUE_SUB_NAMES.map((sn) => (
                          <option key={sn} value={sn}>{sn}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-text-muted w-12 flex-shrink-0">表示名</span>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="flex-1 bg-white border border-border rounded-lg px-2 py-1 text-[10px] text-text-primary
                          focus:border-accent focus:outline-none"
                      />
                    </div>
                    <div className="flex gap-1.5 justify-end">
                      <button
                        onClick={() => {
                          updateFontInPreset(currentSetName, originalIndex, {
                            name: editForm.name,
                            subName: editForm.subName,
                          });
                          setEditingPresetIndex(null);
                        }}
                        className="text-[9px] font-bold text-white px-3 py-1 rounded-lg transition-all"
                        style={{ background: "linear-gradient(135deg, #ff5a8a, #7c5cff)" }}
                      >
                        保存
                      </button>
                      <button
                        onClick={() => setEditingPresetIndex(null)}
                        className="text-[9px] text-text-muted px-2 py-1 hover:text-text-primary transition-colors"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                )}
              </div>
              );
            })}
            </div>
          </div>
        )}
      </div>

      {/* 未登録フォント */}
      {scanData && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h4 className="text-[10px] font-bold text-text-secondary">
              未登録フォント
            </h4>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
              unregisteredFonts.length === 0
                ? "text-success bg-success/10"
                : "text-warning bg-warning/10"
            }`}>
              {unregisteredFonts.length}
            </span>
          </div>
          {unregisteredFonts.length === 0 ? (
            <div className="flex items-center gap-2 py-2.5 px-3 bg-success/5 rounded-xl border border-success/20">
              <svg className="w-3.5 h-3.5 text-success flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-[10px] text-success font-medium">全てのフォントが登録済みです</span>
            </div>
          ) : (
            <>
              <div className="space-y-1 mb-2">
                {unregisteredFonts.map((f) => (
                  <div
                    key={f.name}
                    className="flex items-center gap-2 bg-warning/5 hover:bg-warning/10 rounded-lg px-2.5 py-1.5
                      border border-warning/10 hover:border-warning/30 transition-all"
                  >
                    <span className="text-xs text-text-primary flex-1 truncate">
                      {f.displayName || f.name}
                    </span>
                    <span className="text-[9px] text-text-muted bg-bg-tertiary px-1.5 py-0.5 rounded">{f.count}回</span>
                    <button
                      onClick={() => handleAddUnregistered(f.name, f.displayName, f.count)}
                      className="text-[10px] text-accent font-medium hover:text-white hover:bg-accent px-2 py-0.5 rounded-lg transition-all"
                    >
                      追加
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={handleAddAllUnregistered}
                className="w-full py-2 text-[10px] font-bold text-white rounded-xl transition-all hover:-translate-y-0.5"
                style={{ background: "linear-gradient(135deg, #ff5a8a, #7c5cff)", boxShadow: "0 3px 12px rgba(255,90,138,0.2)" }}
              >
                検出フォントを全て追加
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// カテゴリ順ソート（FONT_SUB_NAME_MAP定義順 → カテゴリなしは末尾）
import { FONT_SUB_NAME_MAP } from "../../../types/scanPsd";

const SUB_NAME_ORDER: Record<string, number> = {};
const UNIQUE_SUB_NAMES: string[] = [];
FONT_SUB_NAME_MAP.forEach((entry, i) => {
  if (!(entry.subName in SUB_NAME_ORDER)) {
    SUB_NAME_ORDER[entry.subName] = i;
    UNIQUE_SUB_NAMES.push(entry.subName);
  }
});

function sortedPresets(presets: FontPreset[]) {
  return presets
    .map((preset, originalIndex) => ({ preset, originalIndex }))
    .sort((a, b) => {
      const aHas = a.preset.subName && a.preset.subName in SUB_NAME_ORDER;
      const bHas = b.preset.subName && b.preset.subName in SUB_NAME_ORDER;
      if (aHas && bHas) return SUB_NAME_ORDER[a.preset.subName] - SUB_NAME_ORDER[b.preset.subName];
      if (aHas) return -1;
      if (bHas) return 1;
      return 0; // 両方カテゴリなし → 元の順序維持
    });
}

// subName → パステルトーンの色分け
const SUB_NAME_PALETTE: Record<string, { color: string; bg: string; border: string }> = {
  "セリフ":         { color: "#3b7dd8", bg: "#eaf2fc", border: "#c4daF2" },
  "モノローグ":     { color: "#8b5cf6", bg: "#f0ebff", border: "#d4c4f8" },
  "回想内ネーム":   { color: "#10a37f", bg: "#e6f8f3", border: "#b4e8d8" },
  "怒鳴り（シリアス）": { color: "#e04060", bg: "#fdedf0", border: "#f4c0cc" },
  "語気強く（通常）":   { color: "#e08830", bg: "#fef4e8", border: "#f4d8b0" },
  "ナレーション":   { color: "#0ea5a5", bg: "#e6f7f7", border: "#b0e4e4" },
  "悲鳴":           { color: "#d946a8", bg: "#fdeef8", border: "#f0c0e0" },
  "SNSなど":        { color: "#2d8cc9", bg: "#e8f3fb", border: "#b8d8f0" },
  "電話・テレビ":   { color: "#6366f1", bg: "#ededfe", border: "#c8c8f8" },
  "おどろ":         { color: "#c87030", bg: "#fdf0e4", border: "#f0d0a8" },
  "ギャグテイスト": { color: "#59a829", bg: "#eef6e8", border: "#c4e4a8" },
};

function getSubNameStyle(subName: string): React.CSSProperties {
  const p = SUB_NAME_PALETTE[subName];
  if (p) return { color: p.color, backgroundColor: p.bg, borderColor: p.border };
  // 未知のsubName → ニュートラルグレー
  return { color: "#5a5a6e", backgroundColor: "#f0f0f5", borderColor: "#dcdce5" };
}
