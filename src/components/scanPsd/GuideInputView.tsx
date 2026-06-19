import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { usePsdStore } from "../../store/psdStore";
import { useTiffStore } from "../../store/tiffStore";
import { useScanPsdStore } from "../../store/scanPsdStore";
import { useTiffProcessor } from "../../hooks/useTiffProcessor";
import { performLoadPresetJson } from "../../hooks/useScanPsdProcessor";
import { TiffCropEditor } from "../tiff/TiffCropEditor";
import { JsonFileBrowser } from "./JsonFileBrowser";
import type { ScanGuideSet } from "../../types/scanPsd";
import { extractGuideSetsFromJson, saveGuideSetToJson } from "../../lib/guideJsonLoader";

/** タチキリ範囲の規定比率（TIFF化と同一） */
const ASPECT_W = 640;
const ASPECT_H = 909;

/** JSONピッカーを開く目的（読込 or 保存前の選択） */
type JsonDialogMode = "load" | "saveGuides" | "saveRange";

/**
 * ガイド／断ち切りタブ（スキャナー内・フォント帳の横）。
 * TIFF化のクロップUI（TiffCropEditor）を流用し、1つのキャンバスで
 * 「ガイド線（cropGuides）」と「範囲（crop.bounds・比率640:909）」を同時に編集できる。
 * - 対象JSON: スキャナーのJSON編集で開いているJSON（currentJsonFilePath）と自動連動。
 *   ここで明示的に読み込んだJSON（cropSourceJsonPath）があればそちらを優先。
 * - 未選択のまま保存ボタンを押した場合は、JSON選択ダイアログを出してから保存する。
 */
export function GuideInputView() {
  const files = usePsdStore((s) => s.files);
  const referenceFileIndex = useTiffStore((s) => s.referenceFileIndex);
  const cropGuides = useTiffStore((s) => s.cropGuides);
  const clearCropGuides = useTiffStore((s) => s.clearCropGuides);
  const addCropGuide = useTiffStore((s) => s.addCropGuide);
  const setCropBounds = useTiffStore((s) => s.setCropBounds);
  const pushCropHistory = useTiffStore((s) => s.pushCropHistory);
  const setCropStep = useTiffStore((s) => s.setCropStep);
  const setCropSourceJsonPath = useTiffStore((s) => s.setCropSourceJsonPath);
  const cropSourceJsonPath = useTiffStore((s) => s.cropSourceJsonPath);
  const referenceImageSize = useTiffStore((s) => s.referenceImageSize);
  // スキャナーのJSON編集で開いているJSONと連動
  const currentJsonFilePath = useScanPsdStore((s) => s.currentJsonFilePath);
  const jsonFolderPath = useScanPsdStore((s) => s.jsonFolderPath);
  const { saveSelectionRangeOnly } = useTiffProcessor();

  const [savingRange, setSavingRange] = useState(false);
  const [savingGuides, setSavingGuides] = useState(false);
  const [jsonGuideSets, setJsonGuideSets] = useState<ScanGuideSet[] | null>(null);
  const [jsonDialogMode, setJsonDialogMode] = useState<JsonDialogMode | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const referenceFile = files[Math.max(0, Math.min(referenceFileIndex - 1, files.length - 1))];

  // 保存先の対象JSON：明示読込 > スキャナーJSON編集のJSON
  const effectiveJsonPath = cropSourceJsonPath || currentJsonFilePath || null;
  const effectiveJsonName = effectiveJsonPath
    ?.split(/[\\/]/)
    .pop()
    ?.replace(/\.json$/, "");

  // 固定リンク(JSON_BASE_PATH＝アドレスファイル)から選んだJSONを読込。
  // 全タブ共有: performLoadPresetJson で scanPsdStore.currentJsonFilePath を設定し、
  // スキャナー・フォント帳・他タブと同じJSONを共有する（連動scandata/ガイド/ルビも復元）。
  // これにより保存先(effectiveJsonPath)も currentJsonFilePath = この読み込んだJSON に揃う。
  const loadGuidesFromJsonPath = async (jsonPath?: string) => {
    if (!jsonPath) return;
    // JSONを読み込んで全タブ共有するのみ。ガイドセットがあっても選択欄は自動表示しない
    // （右サイドバーの「JSONのガイドを呼び出す」から任意に開く）。
    try {
      await performLoadPresetJson(jsonPath);
      setMessage({ ok: true, text: "JSONを読み込みました（全タブ共有）。" });
    } catch (e) {
      console.error("Failed to load JSON:", e);
      setMessage({ ok: false, text: "JSONの読み込みに失敗しました。" });
    }
  };

  // 右サイドバーから明示的に、現在のJSONのガイドセット選択を開く
  const openGuideSetPicker = async () => {
    const jsonPath = effectiveJsonPath;
    if (!jsonPath) {
      setMessage({ ok: false, text: "先にJSONを読み込んでください。" });
      return;
    }
    try {
      const content = await invoke<string>("read_text_file", { filePath: jsonPath });
      const sets = extractGuideSetsFromJson(content);
      if (sets.length === 0) {
        setMessage({ ok: false, text: "このJSONにはガイドセットがありません。" });
        return;
      }
      setJsonGuideSets(sets);
    } catch (e) {
      console.error("Failed to read guide sets:", e);
      setMessage({ ok: false, text: "ガイドの読み込みに失敗しました。" });
    }
  };

  // 選んだガイドセットをキャンバスのガイド線(cropGuides)として読み込む
  const pickGuideSet = (gs: ScanGuideSet) => {
    clearCropGuides();
    for (const h of gs.horizontal) addCropGuide({ direction: "horizontal", position: Math.round(h) });
    for (const v of gs.vertical) addCropGuide({ direction: "vertical", position: Math.round(v) });
    setJsonGuideSets(null);
    setMessage({ ok: true, text: `ガイドを読み込みました（H:${gs.horizontal.length} V:${gs.vertical.length}）` });
  };

  // ガイド線から範囲を自動測定（TIFF化の「PSDガイドから自動設定」と同じ規則）。
  // キャンバスに見えているガイド＝「手動で引いたガイド」＋「PSDに埋め込まれたガイド」の
  // 両方を対象に外接矩形を取り、縦を維持・左基点で横幅を調整して**正確に 640:909** にする。
  // ガイド線（手動＋PSD内蔵）から 640:909 の範囲を導出する（副作用なし）。各2本未満なら null。
  const computeRangeFromGuides = (): {
    left: number;
    top: number;
    right: number;
    bottom: number;
  } | null => {
    const psdGuides = referenceFile?.metadata?.guides ?? [];
    const allGuides = [...cropGuides, ...psdGuides];
    const hPositions = allGuides
      .filter((g) => g.direction === "horizontal")
      .map((g) => g.position)
      .sort((a, b) => a - b);
    const vPositions = allGuides
      .filter((g) => g.direction === "vertical")
      .map((g) => g.position)
      .sort((a, b) => a - b);
    if (hPositions.length < 2 || vPositions.length < 2) return null;
    const left = Math.round(vPositions[0]);
    const top = Math.round(hPositions[0]);
    const bottom = Math.round(hPositions[hPositions.length - 1]);
    // 640:909 ちょうどに調整（縦を維持、左基点で横幅を算出）
    const height = bottom - top;
    const targetWidth = Math.round(height * (ASPECT_W / ASPECT_H));
    return { left, top, right: left + targetWidth, bottom };
  };

  const handleGuidesToRange = () => {
    const bounds = computeRangeFromGuides();
    if (!bounds) {
      const psd = referenceFile?.metadata?.guides ?? [];
      const all = [...cropGuides, ...psd];
      const h = all.filter((g) => g.direction === "horizontal").length;
      const v = all.filter((g) => g.direction === "vertical").length;
      setMessage({
        ok: false,
        text: `範囲の自動測定には水平・垂直ガイドが各2本以上必要です（現在 H:${h} V:${v}。手動ガイドとPSD内蔵ガイドの合計）。`,
      });
      return;
    }
    pushCropHistory();
    setCropBounds(bounds);
    setCropStep("confirm");
    setMessage({
      ok: true,
      text: `範囲を設定しました（${bounds.right - bounds.left}×${bounds.bottom - bounds.top}px・比率640:909）。`,
    });
  };

  // ガイド線を対象JSONへ保存する実処理（presetData.guideSets / guides）。
  // 自動測定と同様、「手動ガイド＋PSD内蔵ガイド」＝キャンバスに見えている全ガイドを保存する（重複位置は除去）。
  const performSaveGuides = async (jsonPath: string) => {
    const psdGuides = referenceFile?.metadata?.guides ?? [];
    const allGuides = [...cropGuides, ...psdGuides];
    const horizontal = [
      ...new Set(
        allGuides
          .filter((g) => g.direction === "horizontal")
          .map((g) => Math.round(g.position)),
      ),
    ].sort((a, b) => a - b);
    const vertical = [
      ...new Set(
        allGuides.filter((g) => g.direction === "vertical").map((g) => Math.round(g.position)),
      ),
    ].sort((a, b) => a - b);
    if (horizontal.length === 0 && vertical.length === 0) {
      setMessage({ ok: false, text: "保存するガイド線がありません。" });
      return;
    }
    setSavingGuides(true);
    setMessage(null);
    try {
      const docWidth = referenceImageSize?.width ?? referenceFile?.metadata?.width ?? 0;
      const docHeight = referenceImageSize?.height ?? referenceFile?.metadata?.height ?? 0;
      await saveGuideSetToJson(jsonPath, {
        horizontal,
        vertical,
        count: 1,
        docNames: referenceFile ? [referenceFile.fileName] : [],
        docWidth,
        docHeight,
      });
      const name = jsonPath
        .split(/[\\/]/)
        .pop()
        ?.replace(/\.json$/, "");
      setMessage({ ok: true, text: `ガイドをJSONに保存しました${name ? `（${name}）` : ""}` });
    } catch (e) {
      console.error("Failed to save guides:", e);
      setMessage({ ok: false, text: "ガイドの保存に失敗しました。" });
    } finally {
      setSavingGuides(false);
    }
  };

  // ガイド保存：対象JSON（明示読込 or スキャナーJSON編集）が無ければ選択ダイアログを出す
  const handleSaveGuides = async () => {
    if (!effectiveJsonPath) {
      setJsonDialogMode("saveGuides");
      return;
    }
    await performSaveGuides(effectiveJsonPath);
  };

  // 範囲を対象JSONへ保存する実処理（cropSourceJsonPath→currentJsonFilePath の順で解決）
  const performSaveRange = async () => {
    // 範囲(crop bounds)が未設定なら、まずガイド線から自動導出して設定してから保存する
    // （ガイド線だけ引いて「範囲をJSONに保存」を押したケースを救済）。
    if (!useTiffStore.getState().settings.crop.bounds) {
      const derived = computeRangeFromGuides();
      if (derived) {
        pushCropHistory();
        setCropBounds(derived); // zustand は同期更新 → 直後の saveSelectionRangeOnly が読める
        setCropStep("confirm");
      } else {
        setMessage({
          ok: false,
          text: "範囲が未設定です。画像上でドラッグするか「ガイド線から範囲を自動測定」で範囲を作成してください。",
        });
        return;
      }
    }
    setSavingRange(true);
    setMessage(null);
    try {
      // ガイド保存と同じJSON（現在の対象JSON）へ確実に書き込む
      const res = await saveSelectionRangeOnly(effectiveJsonPath ?? undefined);
      if (res.success) {
        const name = res.jsonPath
          ?.split(/[\\/]/)
          .pop()
          ?.replace(/\.json$/, "");
        setMessage({ ok: true, text: `範囲をJSONに保存しました${name ? `（${name}）` : ""}` });
      } else {
        setMessage({ ok: false, text: res.error ?? "保存に失敗しました。" });
      }
    } finally {
      setSavingRange(false);
    }
  };

  // 範囲保存：対象JSONが無ければ選択ダイアログを出す
  const handleSaveRange = async () => {
    if (!effectiveJsonPath) {
      setJsonDialogMode("saveRange");
      return;
    }
    await performSaveRange();
  };

  // JSON選択ダイアログの確定：目的（読込/保存）に応じて続きの処理を行う
  const handleJsonPicked = async (jsonPath?: string) => {
    const mode = jsonDialogMode;
    setJsonDialogMode(null);
    if (!jsonPath || !mode) return;
    setCropSourceJsonPath(jsonPath); // 以後の保存先として固定
    if (mode === "load") {
      await loadGuidesFromJsonPath(jsonPath);
    } else if (mode === "saveGuides") {
      await performSaveGuides(jsonPath);
    } else if (mode === "saveRange") {
      await performSaveRange(); // saveSelectionRangeOnly は実行時に cropSourceJsonPath を読む
    }
  };

  // JSON未選択時：まずJSONを選択（フォント帳と同様・全タブ共有）
  if (!effectiveJsonPath) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="w-20 h-20 mb-5 rounded-3xl flex items-center justify-center bg-bg-tertiary">
          <svg
            className="w-10 h-10 text-text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <p className="text-lg font-display font-medium text-text-primary mb-1">
          作品のJSONを選択してください
        </p>
        <p className="text-xs text-text-muted mb-5">
          読み込んだJSONはスキャナー・フォント帳・他タブと共有されます
        </p>
        <button
          className="px-4 py-2 text-xs font-medium text-white bg-gradient-to-r from-accent to-accent-secondary rounded-xl hover:-translate-y-0.5 transition-all shadow-sm"
          onClick={() => setJsonDialogMode("load")}
        >
          JSONを選択
        </button>

        {jsonDialogMode && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setJsonDialogMode(null);
            }}
          >
            <div
              className="w-[460px] max-h-[80%] flex flex-col"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <JsonFileBrowser
                basePath={jsonFolderPath}
                mode="open"
                onSelect={(filePath) => handleJsonPicked(filePath)}
                onCancel={() => setJsonDialogMode(null)}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // PSD未読み込み時：ドロップ案内
  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="w-20 h-20 mb-5 rounded-3xl flex items-center justify-center bg-bg-tertiary">
          <svg
            className="w-10 h-10 text-text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </div>
        <p className="text-lg font-display font-medium text-text-primary mb-1">
          PSDファイルをドロップ
        </p>
        <p className="text-xs text-text-muted">
          画像上でガイド線と範囲（比率640:909）を同時に設定できます
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* キャンバス：ガイド線＋範囲を同時に編集（TIFF化UIを再現） */}
      <div className="flex-1 min-w-0">
        <TiffCropEditor onSwitchToQueue={() => {}} />
      </div>

      {/* 右：アクション */}
      <div className="w-60 flex-shrink-0 border-l border-border flex flex-col bg-bg-secondary">
        <div className="px-3 py-2 border-b border-border/50">
          <h4 className="text-xs font-bold text-text-primary">ガイド／断ち切り</h4>
          <p className="text-[10px] text-text-muted mt-0.5">
            定規からドラッグでガイド線、画像ドラッグで範囲（比率維持）
          </p>
        </div>

        <div className="flex-1 overflow-auto p-3 space-y-3">
          {/* 対象JSON（スキャナーのJSON編集と連動） */}
          <div
            className={`text-[10px] rounded-lg px-2.5 py-1.5 border ${
              effectiveJsonPath
                ? "bg-accent-tertiary/8 border-accent-tertiary/25 text-text-secondary"
                : "bg-bg-tertiary/40 border-border/30 text-text-muted"
            }`}
            title={effectiveJsonPath ?? undefined}
          >
            <span className="font-bold text-text-muted">対象JSON: </span>
            {effectiveJsonPath ? (
              <span className="font-medium text-accent-tertiary break-all">
                {effectiveJsonName}
                {!cropSourceJsonPath && currentJsonFilePath && (
                  <span className="text-text-muted font-normal">（JSON編集と連動）</span>
                )}
              </span>
            ) : (
              <span>未選択（保存時に選択ダイアログを表示）</span>
            )}
          </div>

          {/* JSONのガイドを呼び出す（読込時は自動表示せず、ここから任意に開く） */}
          <button
            onClick={openGuideSetPicker}
            disabled={!effectiveJsonPath}
            className="w-full py-2 text-[11px] font-bold rounded-xl border border-accent-tertiary/30 bg-accent-tertiary/10 text-accent-tertiary hover:bg-accent-tertiary/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            title="現在のJSONに保存されているガイドセットを呼び出して読み込みます"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 4h18M3 20h18M4 3v18M20 3v18"
              />
            </svg>
            JSONのガイドを呼び出す
          </button>

          {/* ガイド数（手動＋PSD内蔵） */}
          <div className="text-[11px] text-text-muted bg-bg-tertiary/40 rounded-lg px-3 py-2 border border-border/30 space-y-0.5">
            <div className="flex items-center justify-between">
              <span>手動ガイド</span>
              <span className="font-mono text-text-primary">
                H:{cropGuides.filter((g) => g.direction === "horizontal").length}{" "}
                V:{cropGuides.filter((g) => g.direction === "vertical").length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>PSD内蔵ガイド</span>
              <span className="font-mono text-text-primary">
                H:
                {(referenceFile?.metadata?.guides ?? []).filter(
                  (g) => g.direction === "horizontal",
                ).length}{" "}
                V:
                {(referenceFile?.metadata?.guides ?? []).filter((g) => g.direction === "vertical")
                  .length}
              </span>
            </div>
          </div>

          {/* ガイド線から範囲を自動測定 */}
          <button
            onClick={handleGuidesToRange}
            className="w-full py-2 text-[11px] font-bold rounded-xl border border-accent-warm/30 bg-accent-warm/10 text-accent-warm hover:bg-accent-warm/20 transition-all flex items-center justify-center gap-1.5"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
              />
            </svg>
            ガイド線から範囲を自動測定
          </button>

          {message && (
            <div
              className={`text-[11px] rounded-lg px-2.5 py-1.5 border ${
                message.ok
                  ? "bg-success/10 border-success/20 text-success"
                  : "bg-error/10 border-error/20 text-error"
              }`}
            >
              {message.text}
            </div>
          )}
        </div>

        {/* 下部アクション */}
        <div className="p-3 border-t border-border/50 space-y-2">
          <button
            onClick={handleSaveGuides}
            disabled={savingGuides}
            className="w-full py-2.5 text-xs font-bold rounded-xl border border-accent-tertiary/30 bg-accent-tertiary/10 text-accent-tertiary hover:bg-accent-tertiary/20 transition-all disabled:opacity-50"
          >
            {savingGuides ? "保存中..." : "ガイドをJSONに保存"}
          </button>
          <button
            onClick={handleSaveRange}
            disabled={savingRange}
            className="w-full py-2.5 text-xs font-bold rounded-xl border border-accent/30 bg-accent/10 text-accent hover:bg-accent/20 transition-all disabled:opacity-50"
          >
            {savingRange ? "保存中..." : "範囲をJSONに保存"}
          </button>
        </div>
      </div>

      {/* JSON選択（JSONファイルを直接選択＝範囲設定ラベルを介さない）。
          読込のほか、対象JSON未選択のまま保存ボタンを押した時にも開き、選択後に保存を続行する */}
      {jsonDialogMode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setJsonDialogMode(null);
          }}
        >
          <div
            className="w-[460px] max-h-[80%] flex flex-col"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <JsonFileBrowser
              basePath={jsonFolderPath}
              mode="open"
              onSelect={(filePath) => handleJsonPicked(filePath)}
              onCancel={() => setJsonDialogMode(null)}
            />
          </div>
        </div>
      )}

      {/* ガイドセット選択（手動選択） */}
      {jsonGuideSets && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onMouseDown={() => setJsonGuideSets(null)}
        >
          <div
            className="bg-bg-secondary rounded-lg shadow-2xl w-[460px] max-h-[70vh] flex flex-col overflow-hidden border border-border"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-text-muted/10">
              <h3 className="text-sm font-medium text-text-primary">
                ガイドセットを選択 ({jsonGuideSets.length})
              </h3>
              <button
                className="p-1 rounded hover:bg-bg-tertiary text-text-secondary"
                onClick={() => setJsonGuideSets(null)}
                title="閉じる"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-auto p-3 space-y-1.5">
              {jsonGuideSets.map((gs, i) => (
                <button
                  key={i}
                  onClick={() => pickGuideSet(gs)}
                  className="w-full text-left rounded-xl px-3 py-2 border border-border/30 bg-bg-tertiary/40 hover:border-accent/40 hover:bg-bg-tertiary/70 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-text-primary">
                      ガイドセット {i + 1}
                    </span>
                    <span className="text-[10px] text-text-muted font-mono">
                      H:{gs.horizontal.length} V:{gs.vertical.length}
                    </span>
                    {gs.docWidth > 0 && (
                      <span className="text-[9px] text-text-muted font-mono">
                        {gs.docWidth}×{gs.docHeight}
                      </span>
                    )}
                    {gs.count > 0 && (
                      <span className="ml-auto text-[9px] text-text-muted bg-bg-primary px-1.5 py-0.5 rounded">
                        {gs.count}p
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
