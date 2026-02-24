import { useScanPsdStore } from "../../store/scanPsdStore";
import { ScanPsdModeSelector } from "../scanPsd/ScanPsdModeSelector";
import { ScanPsdPanel } from "../scanPsd/ScanPsdPanel";
import { ScanPsdContent } from "../scanPsd/ScanPsdContent";
import { ScanPsdEditView } from "../scanPsd/ScanPsdEditView";

export function ScanPsdView() {
  const mode = useScanPsdStore((s) => s.mode);
  const currentJsonFilePath = useScanPsdStore((s) => s.currentJsonFilePath);

  if (!mode) {
    return <ScanPsdModeSelector />;
  }

  // Edit mode with JSON loaded → single-page scrollable view
  if (mode === "edit" && currentJsonFilePath) {
    return <ScanPsdEditView />;
  }

  return (
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
  );
}
