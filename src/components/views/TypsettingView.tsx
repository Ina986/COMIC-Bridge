import { useState } from "react";
import { usePsdStore } from "../../store/psdStore";
import { useOpenInPhotoshop } from "../../hooks/useOpenInPhotoshop";
import { CompactFileList } from "../common/CompactFileList";
import { SpecTextGrid } from "../spec-checker/SpecTextGrid";
import { SpecViewerPanel } from "../spec-checker/SpecViewerPanel";
import { TypesettingViewerPanel } from "../typesetting-check/TypesettingViewerPanel";
import { TypesettingCheckPanel } from "../typesetting-check/TypesettingCheckPanel";
import { DropZone } from "../file-browser/DropZone";

type SubTab = "spec" | "viewer" | "check";

export function TypsettingView() {
  const files = usePsdStore((s) => s.files);
  const [subTab, setSubTab] = useState<SubTab>("spec");
  const [viewerFilterFont, setViewerFilterFont] = useState<string | null>(null);
  const { openFileInPhotoshop } = useOpenInPhotoshop();

  const hasFiles = files.length > 0;

  // 写植調整タブはPSDなしでもJSON読み込み可能
  if (!hasFiles && subTab !== "check") {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Sub-tab bar */}
        <div className="px-4 py-2 bg-bg-secondary border-b border-border flex items-center gap-4 flex-shrink-0">
          <SubTabBar subTab={subTab} setSubTab={setSubTab} />
        </div>
        <DropZone />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sub-tab bar */}
      <div className="px-4 py-2 bg-bg-secondary border-b border-border flex items-center gap-4 flex-shrink-0">
        <SubTabBar subTab={subTab} setSubTab={setSubTab} />
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {subTab === "spec" && (
          <>
            <CompactFileList className="w-52 flex-shrink-0 border-r border-border" />
            <div className="flex-1 overflow-hidden">
              <SpecTextGrid onFilterFont={(font) => { setViewerFilterFont(font); setSubTab("viewer"); }} />
            </div>
          </>
        )}

        {subTab === "viewer" && (
          <div className="flex-1 overflow-hidden">
            <SpecViewerPanel
              onOpenInPhotoshop={openFileInPhotoshop}
              initialFilterFont={viewerFilterFont}
              onFilterFontConsumed={() => setViewerFilterFont(null)}
            />
          </div>
        )}

        {subTab === "check" && (
          hasFiles ? (
            <>
              <div className="flex-1 overflow-hidden">
                <TypesettingViewerPanel />
              </div>
              <div className="w-[480px] flex-shrink-0 border-l border-border overflow-hidden flex flex-col bg-bg-secondary">
                <TypesettingCheckPanel />
              </div>
            </>
          ) : (
            <>
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-2">
                  <svg className="w-12 h-12 mx-auto text-text-muted/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-xs text-text-muted">PSDファイルをドロップして読み込んでください</p>
                </div>
              </div>
              <div className="w-[480px] flex-shrink-0 border-l border-border overflow-hidden flex flex-col bg-bg-secondary">
                <TypesettingCheckPanel />
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
}

function SubTabBar({ subTab, setSubTab }: { subTab: SubTab; setSubTab: (t: SubTab) => void }) {
  const tabs: { id: SubTab; label: string }[] = [
    { id: "spec", label: "写植仕様" },
    { id: "viewer", label: "フォントビューアー" },
    { id: "check", label: "写植調整" },
  ];

  return (
    <div className="flex bg-bg-elevated rounded-md p-0.5 border border-white/5 flex-shrink-0">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setSubTab(tab.id)}
          className={`px-2 py-1 text-[10px] rounded transition-all ${
            subTab === tab.id
              ? "bg-bg-tertiary text-text-primary font-medium shadow-sm"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
