import { useState } from "react";
import { FileBrowser } from "../file-browser/FileBrowser";
import { SpecCheckerPanel } from "../spec-checker/SpecCheckerPanel";

export function Sidebar() {
  const [activeTab, setActiveTab] = useState<"files" | "spec">("files");

  return (
    <aside className="w-72 flex-shrink-0 bg-bg-secondary border-r border-text-muted/10 flex flex-col">
      {/* Tab Header */}
      <div className="flex border-b border-text-muted/10">
        <button
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "files"
              ? "text-text-primary border-b-2 border-accent"
              : "text-text-secondary hover:text-text-primary"
          }`}
          onClick={() => setActiveTab("files")}
        >
          ファイル
        </button>
        <button
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === "spec"
              ? "text-text-primary border-b-2 border-accent"
              : "text-text-secondary hover:text-text-primary"
          }`}
          onClick={() => setActiveTab("spec")}
        >
          仕様チェック
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "files" ? <FileBrowser /> : <SpecCheckerPanel />}
      </div>
    </aside>
  );
}
