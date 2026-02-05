import { useState } from "react";
import { FileBrowser } from "../file-browser/FileBrowser";
import { SpecCheckerPanel } from "../spec-checker/SpecCheckerPanel";
import { LayerControlPanel } from "../layer-control/LayerControlPanel";
import { SplitPanel } from "../split/SplitPanel";

export function Sidebar() {
  const [activeTab, setActiveTab] = useState<"files" | "spec" | "layers" | "split">("files");

  return (
    <aside className="w-72 flex-shrink-0 bg-bg-secondary border-r border-white/5 flex flex-col relative z-10">
      {/* ロゴ・タイトルエリア */}
      <div className="px-4 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          {/* ロゴアイコン */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent-secondary flex items-center justify-center shadow-glow-pink">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </div>
          <div>
            <h1 className="font-display font-bold text-text-primary">
              漫画PSD管理
            </h1>
            <p className="text-xs text-text-muted">Manga PSD Manager</p>
          </div>
        </div>
      </div>

      {/* Tab Header */}
      <div className="flex p-2 gap-1 border-b border-white/5">
        <button
          className={`flex-1 px-3 py-2 text-xs font-medium rounded-xl transition-all duration-200 ${
            activeTab === "files"
              ? "text-white bg-gradient-to-r from-accent to-accent-secondary shadow-glow-pink"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
          }`}
          onClick={() => setActiveTab("files")}
        >
          <span className="flex items-center justify-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            ファイル
          </span>
        </button>
        <button
          className={`flex-1 px-3 py-2 text-xs font-medium rounded-xl transition-all duration-200 ${
            activeTab === "spec"
              ? "text-white bg-gradient-to-r from-accent to-accent-secondary shadow-glow-pink"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
          }`}
          onClick={() => setActiveTab("spec")}
        >
          <span className="flex items-center justify-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            仕様
          </span>
        </button>
        <button
          className={`flex-1 px-3 py-2 text-xs font-medium rounded-xl transition-all duration-200 ${
            activeTab === "layers"
              ? "text-white bg-gradient-to-r from-accent to-accent-secondary shadow-glow-pink"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
          }`}
          onClick={() => setActiveTab("layers")}
        >
          <span className="flex items-center justify-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
            非表示
          </span>
        </button>
        <button
          className={`flex-1 px-3 py-2 text-xs font-medium rounded-xl transition-all duration-200 ${
            activeTab === "split"
              ? "text-white bg-gradient-to-r from-accent-tertiary to-accent-secondary shadow-[0_4px_15px_rgba(0,212,170,0.3)]"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
          }`}
          onClick={() => setActiveTab("split")}
        >
          <span className="flex items-center justify-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            分割
          </span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "files" && <FileBrowser />}
        {activeTab === "spec" && <SpecCheckerPanel />}
        {activeTab === "layers" && <LayerControlPanel />}
        {activeTab === "split" && <SplitPanel />}
      </div>
    </aside>
  );
}
