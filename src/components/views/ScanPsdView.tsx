import { useState, useMemo } from "react";
import { useScanPsdStore } from "../../store/scanPsdStore";
import { usePsdStore } from "../../store/psdStore";
import { performLoadPresetJson } from "../../hooks/useScanPsdProcessor";
import { getAllMissingFields } from "../../types/scanPsd";
import { ScanPsdModeSelector } from "../scanPsd/ScanPsdModeSelector";
import { ScanPsdPanel } from "../scanPsd/ScanPsdPanel";
import { ScanPsdContent } from "../scanPsd/ScanPsdContent";
import { ScanPsdEditView } from "../scanPsd/ScanPsdEditView";
import { FontBookView } from "./FontBookView";
import { SpecScanJsonDialog } from "../spec-checker/SpecScanJsonDialog";
import { GuideInputView } from "../scanPsd/GuideInputView";

type ScanSubTab = "scanner" | "fontBook" | "guideInput";

export function ScanPsdView() {
  const mode = useScanPsdStore((s) => s.mode);
  const setMode = useScanPsdStore((s) => s.setMode);
  const reset = useScanPsdStore((s) => s.reset);
  const currentJsonFilePath = useScanPsdStore((s) => s.currentJsonFilePath);
  const scanData = useScanPsdStore((s) => s.scanData);
  const presetSets = useScanPsdStore((s) => s.presetSets);
  const workInfo = useScanPsdStore((s) => s.workInfo);
  const selectedGuideIndex = useScanPsdStore((s) => s.selectedGuideIndex);
  const selectionRanges = useScanPsdStore((s) => s.selectionRanges);
  const rubyList = useScanPsdStore((s) => s.rubyList);
  const [subTab, setSubTab] = useState<ScanSubTab>("scanner");
  const [showScanJsonDialog, setShowScanJsonDialog] = useState(false);
  const files = usePsdStore((s) => s.files);
  const showBackButton = subTab === "scanner" && mode !== null;
  const [reloading, setReloading] = useState(false);

  // 現在のJSONをディスクから再読込（他タブ/他端末の保存を取り込む）
  const handleReload = async () => {
    const path = useScanPsdStore.getState().currentJsonFilePath;
    if (!path) return;
    setReloading(true);
    try {
      await performLoadPresetJson(path);
    } catch (e) {
      console.error("Failed to reload JSON:", e);
    } finally {
      setReloading(false);
    }
  };

  // 全タブの未記入・未設定項目数
  const missingCount = useMemo(
    () =>
      getAllMissingFields({
        workInfo,
        presetSets,
        scanData,
        selectedGuideIndex,
        selectionRanges,
        rubyList,
      }).length,
    [workInfo, presetSets, scanData, selectedGuideIndex, selectionRanges, rubyList],
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sub-tab bar */}
      <div className="px-4 py-2 bg-bg-secondary border-b border-border flex items-center gap-4 flex-shrink-0">
        <div className="flex bg-bg-elevated rounded-md p-0.5 border border-white/5 flex-shrink-0">
          <button
            onClick={() => setSubTab("scanner")}
            className={`px-2 py-1 text-[10px] rounded transition-all ${
              subTab === "scanner"
                ? "bg-bg-tertiary text-text-primary font-medium shadow-sm"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            スキャナー
            {missingCount > 0 && subTab !== "scanner" && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-warning/10 text-warning">
                {missingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setSubTab("fontBook")}
            className={`px-2 py-1 text-[10px] rounded transition-all ${
              subTab === "fontBook"
                ? "bg-bg-tertiary text-text-primary font-medium shadow-sm"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            フォント帳
          </button>
          <button
            onClick={() => setSubTab("guideInput")}
            className={`px-2 py-1 text-[10px] rounded transition-all ${
              subTab === "guideInput"
                ? "bg-bg-tertiary text-text-primary font-medium shadow-sm"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            ガイド／断ち切り
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {/* 更新：現在のJSONをディスクから再読込（他タブ/他端末の保存を取り込む） */}
          {currentJsonFilePath && (
            <button
              onClick={handleReload}
              disabled={reloading}
              className="h-9 px-4 text-xs font-bold text-accent rounded-xl border border-accent/30 bg-accent/10 hover:bg-accent/20 transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
              title="現在のJSONをディスクから再読み込み（他タブの保存を取り込む）"
            >
              <svg
                className={`w-3.5 h-3.5 ${reloading ? "animate-spin" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.4}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {reloading ? "更新中..." : "更新"}
            </button>
          )}
          {showBackButton && (
            <button
              onClick={() => {
                reset();
                setMode(null);
              }}
              className="h-9 px-4 text-xs font-bold text-text-secondary hover:text-text-primary rounded-xl border border-border hover:border-accent/40 hover:bg-bg-tertiary transition-colors inline-flex items-center gap-1.5"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.4}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              戻る
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {subTab === "fontBook" ? (
          <FontBookView />
        ) : subTab === "guideInput" ? (
          <GuideInputView />
        ) : (
          <>
            {!mode && <ScanPsdModeSelector />}
            {mode === "edit" && currentJsonFilePath && <ScanPsdEditView />}
            {mode === "edit" && !currentJsonFilePath && (
              <div className="h-full overflow-hidden">
                <ScanPsdContent />
              </div>
            )}
            {mode === "new" && (
              <div className="flex h-full overflow-hidden">
                {/* Left Panel: 5-Tab Manager */}
                <div className="w-[400px] flex-shrink-0 border-r border-border overflow-hidden flex flex-col">
                  <ScanPsdPanel />
                </div>

                {/* Right Panel: Content Area */}
                <div className="flex-1 overflow-hidden">
                  <ScanPsdContent />
                </div>
              </div>
            )}
          </>
        )}

        {/* 簡易スキャン（JSON登録）フローティングボタン — 写植ビューと同一スタイル */}
        {subTab === "scanner" && files.length > 0 && (
          <div className="absolute bottom-6 right-6 z-10 flex flex-col items-end gap-4">
            <button
              className="h-16 min-w-[220px] px-8 text-lg font-bold rounded-2xl shadow-2xl transition-all duration-200 flex items-center justify-center gap-3 bg-bg-secondary border-2 border-accent/40 text-accent hover:bg-bg-elevated hover:border-accent/60 hover:shadow-[0_6px_24px_rgba(255,90,138,0.25)] active:scale-[0.97]"
              onClick={() => setShowScanJsonDialog(true)}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              簡易スキャン
              <span className="px-2 py-1 rounded-lg bg-accent/10 text-accent text-sm font-bold">
                {files.length}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* JSON登録ダイアログ */}
      {showScanJsonDialog && <SpecScanJsonDialog onClose={() => setShowScanJsonDialog(false)} />}
    </div>
  );
}
