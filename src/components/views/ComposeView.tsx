import { ComposePanel } from "../compose/ComposePanel";
import { ComposeDropZone } from "../compose/ComposeDropZone";

export function ComposeView() {
  return (
    <div className="flex h-full overflow-hidden" data-tool-panel>
      <div className="w-[360px] flex-shrink-0 border-r border-border overflow-hidden">
        <ComposePanel />
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <ComposeDropZone />
      </div>
    </div>
  );
}
