import { usePsdStore } from "../../store/psdStore";
import { FileList } from "./FileList";
import { open } from "@tauri-apps/plugin-dialog";
import { usePsdLoader } from "../../hooks/usePsdLoader";

export function FileBrowser() {
  const currentFolderPath = usePsdStore((state) => state.currentFolderPath);
  const loadingStatus = usePsdStore((state) => state.loadingStatus);
  const setCurrentFolderPath = usePsdStore((state) => state.setCurrentFolderPath);
  const { loadFolder, loadFiles } = usePsdLoader();

  const handleOpenFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "フォルダを選択",
      });

      if (selected && typeof selected === "string") {
        setCurrentFolderPath(selected);
        await loadFolder(selected);
      }
    } catch (error) {
      console.error("Failed to open folder:", error);
    }
  };

  const handleOpenFiles = async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: "PSD Files",
            extensions: ["psd", "psb"],
          },
        ],
        title: "PSDファイルを選択",
      });

      if (selected && Array.isArray(selected) && selected.length > 0) {
        await loadFiles(selected);
      }
    } catch (error) {
      console.error("Failed to open files:", error);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Actions */}
      <div className="p-3 border-b border-text-muted/10 space-y-2">
        <button
          className="w-full btn btn-secondary text-sm"
          onClick={handleOpenFolder}
          disabled={loadingStatus === "loading"}
        >
          フォルダを開く
        </button>
        <button
          className="w-full btn btn-secondary text-sm"
          onClick={handleOpenFiles}
          disabled={loadingStatus === "loading"}
        >
          ファイルを選択
        </button>
      </div>

      {/* Current Path */}
      {currentFolderPath && (
        <div className="px-3 py-2 bg-bg-tertiary/50 border-b border-text-muted/10">
          <p className="text-xs text-text-muted truncate" title={currentFolderPath}>
            {currentFolderPath}
          </p>
        </div>
      )}

      {/* File List */}
      <div className="flex-1 overflow-auto">
        <FileList />
      </div>
    </div>
  );
}
