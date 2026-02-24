import { useScanPsdStore } from "../../store/scanPsdStore";
import { useScanPsdProcessor } from "../../hooks/useScanPsdProcessor";
import { WorkInfoTab } from "./tabs/WorkInfoTab";
import { FontTypesTab } from "./tabs/FontTypesTab";
import { FontSizesTab } from "./tabs/FontSizesTab";
import { GuideLinesTab } from "./tabs/GuideLinesTab";
import { TextRubyTab } from "./tabs/TextRubyTab";

export function ScanPsdEditView() {
  const setMode = useScanPsdStore((s) => s.setMode);
  const reset = useScanPsdStore((s) => s.reset);
  const currentJsonFilePath = useScanPsdStore((s) => s.currentJsonFilePath);
  const phase = useScanPsdStore((s) => s.phase);
  const workInfo = useScanPsdStore((s) => s.workInfo);
  const pendingTitleLabel = useScanPsdStore((s) => s.pendingTitleLabel);
  const { savePresetJson } = useScanPsdProcessor();

  const fileName = currentJsonFilePath
    ? currentJsonFilePath.split(/[\\/]/).pop() || ""
    : "";

  const handleSave = async () => {
    try {
      await savePresetJson();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-bg-primary">
      {/* Header */}
      <div className="px-5 py-2.5 border-b border-border bg-white flex items-center gap-3 flex-shrink-0 shadow-soft">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
          style={{ background: "linear-gradient(135deg, #ff5a8a, #7c5cff)" }}
        >
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-text-primary font-display leading-tight">
            PSDスキャナー
          </p>
          <p className="text-[10px] text-text-muted truncate">{fileName}</p>
        </div>
        {pendingTitleLabel && (
          <span className="text-[10px] text-warning font-semibold bg-warning/10 px-2.5 py-1 rounded-full border border-warning/20">
            仮保存中
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={phase !== "idle"}
          className={`btn px-4 py-2 text-[11px] font-bold text-white rounded-xl
            disabled:opacity-40 disabled:cursor-not-allowed transition-all
            ${pendingTitleLabel && workInfo.title && workInfo.label
              ? "bg-gradient-to-r from-success to-emerald-500 shadow-glow-success animate-pulse"
              : ""
            }`}
          style={!(pendingTitleLabel && workInfo.title && workInfo.label) ? {
            background: "linear-gradient(135deg, #ff5a8a, #7c5cff)",
            boxShadow: "0 4px 15px rgba(255, 90, 138, 0.3)",
          } : undefined}
        >
          {pendingTitleLabel && workInfo.title && workInfo.label ? "正式保存" : "保存"}
        </button>
        <button
          onClick={() => { reset(); setMode(null); }}
          className="text-[11px] text-text-muted hover:text-text-primary px-3 py-2 rounded-xl hover:bg-bg-tertiary transition-colors"
        >
          戻る
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-tone">
        <div className="px-5 py-4">
          <div className="grid grid-cols-3 gap-5 items-start">
            {/* Column 1: Work Info */}
            <div>
              <SectionHeader icon="info" color="pink">作品情報</SectionHeader>
              <div className="bg-white rounded-2xl border border-border/60 shadow-card p-4">
                <WorkInfoTab />
              </div>
            </div>
            {/* Column 2: Fonts + Guides */}
            <div className="space-y-5">
              <div>
                <SectionHeader icon="font" color="purple">フォント種類</SectionHeader>
                <div className="bg-white rounded-2xl border border-border/60 shadow-card p-4">
                  <FontTypesTab />
                </div>
              </div>
              <div>
                <SectionHeader icon="guide" color="mint">ガイド線</SectionHeader>
                <div className="bg-white rounded-2xl border border-border/60 shadow-card p-4">
                  <GuideLinesTab />
                </div>
              </div>
            </div>
            {/* Column 3: Sizes + Ruby */}
            <div className="space-y-5">
              <div>
                <SectionHeader icon="size" color="warm">サイズ統計</SectionHeader>
                <div className="bg-white rounded-2xl border border-border/60 shadow-card p-4">
                  <FontSizesTab />
                </div>
              </div>
              <div>
                <SectionHeader icon="ruby" color="sky">テキスト / ルビ</SectionHeader>
                <div className="bg-white rounded-2xl border border-border/60 shadow-card p-4">
                  <TextRubyTab />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const SECTION_COLORS = {
  pink: { from: "#ff5a8a", to: "#ff8ab5", bg: "rgba(255,90,138,0.08)", text: "#ff5a8a" },
  purple: { from: "#7c5cff", to: "#a78bff", bg: "rgba(124,92,255,0.08)", text: "#7c5cff" },
  mint: { from: "#00c9a7", to: "#5ce0c9", bg: "rgba(0,201,167,0.08)", text: "#00c9a7" },
  warm: { from: "#ffb142", to: "#ffc875", bg: "rgba(255,177,66,0.08)", text: "#e69a00" },
  sky: { from: "#4db8ff", to: "#85cfff", bg: "rgba(77,184,255,0.08)", text: "#2d9cdb" },
};

const SECTION_ICONS: Record<string, React.ReactNode> = {
  info: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  ),
  font: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
  ),
  size: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
  ),
  guide: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
  ),
  ruby: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
  ),
};

function SectionHeader({ icon, color, children }: {
  icon: string;
  color: keyof typeof SECTION_COLORS;
  children: React.ReactNode;
}) {
  const c = SECTION_COLORS[color];
  return (
    <div className="flex items-center gap-2 mb-2.5">
      <div
        className="w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: c.bg }}
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke={c.text} strokeWidth={2.5}>
          {SECTION_ICONS[icon]}
        </svg>
      </div>
      <span
        className="text-[11px] font-bold font-display tracking-wide"
        style={{ color: c.text }}
      >
        {children}
      </span>
      <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, ${c.from}30, transparent)` }} />
    </div>
  );
}
