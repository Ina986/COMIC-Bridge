import { useScanPsdStore } from "../../store/scanPsdStore";
import { ScanPsdModeSelector } from "../scanPsd/ScanPsdModeSelector";
import { ScanPsdPanel } from "../scanPsd/ScanPsdPanel";
import { ScanPsdContent } from "../scanPsd/ScanPsdContent";

export function ScanPsdView() {
  const mode = useScanPsdStore((s) => s.mode);

  if (!mode) {
    return <ScanPsdModeSelector />;
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
