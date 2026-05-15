import { useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { usePsdStore } from "../store/psdStore";
import { useTiffStore } from "../store/tiffStore";
import { useViewStore } from "../store/viewStore";
import { usePsdLoader } from "./usePsdLoader";

export function useFolderPicker() {
  const loadingStatus = usePsdStore((state) => state.loadingStatus);
  const { loadFolder, loadFolderWithSubfolders } = usePsdLoader();

  const openFolderPicker = useCallback(async () => {
    if (usePsdStore.getState().loadingStatus === "loading") return;
    const activeView = useViewStore.getState().activeView;
    if (activeView === "replace" || activeView === "rename") return;

    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "フォルダを選択",
      });

      if (!selected || typeof selected !== "string") return;

      usePsdStore.getState().setDroppedFolderPaths([selected]);

      const includeSubfolders = useTiffStore.getState().settings.includeSubfolders;
      if (activeView === "tiff" && includeSubfolders) {
        await loadFolderWithSubfolders([selected]);
        return;
      }

      await loadFolder(selected);
    } catch (error) {
      console.error("Failed to open folder:", error);
    }
  }, [loadFolder, loadFolderWithSubfolders]);

  return { openFolderPicker, isOpeningDisabled: loadingStatus === "loading" };
}
