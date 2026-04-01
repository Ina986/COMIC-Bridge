import { useState, useMemo } from "react";
import { useScanPsdStore } from "../../store/scanPsdStore";
import { getAllMissingFields } from "../../types/scanPsd";
import { ScanPsdModeSelector } from "../scanPsd/ScanPsdModeSelector";
import { ScanPsdPanel } from "../scanPsd/ScanPsdPanel";
import { ScanPsdContent } from "../scanPsd/ScanPsdContent";
import { ScanPsdEditView } from "../scanPsd/ScanPsdEditView";
import { FontBookView } from "./FontBookView";

type ScanSubTab = "scanner" | "fontBook";

export function ScanPsdView() {
  const mode = useScanPsdStore((s) => s.mode);
  const currentJsonFilePath = useScanPsdStore((s) => s.currentJsonFilePath);
  const scanData = useScanPsdStore((s) => s.scanData);
  const presetSets = useScanPsdStore((s) => s.presetSets);
  const workInfo = useScanPsdStore((s) => s.workInfo);
  const selectedGuideIndex = useScanPsdStore((s) => s.selectedGuideIndex);
  const selectionRanges = useScanPsdStore((s) => s.selectionRanges);
  const rubyList = useScanPsdStore((s) => s.rubyList);
  const [subTab, setSubTab] = useState<ScanSubTab>("scanner");

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
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {subTab === "fontBook" ? (
          <FontBookView />
        ) : (
          <>
            {!mode && <ScanPsdModeSelector />}
            {mode === "edit" && currentJsonFilePath && <ScanPsdEditView />}
            {mode && !(mode === "edit" && currentJsonFilePath) && (
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
      </div>
    </div>
  );
}
