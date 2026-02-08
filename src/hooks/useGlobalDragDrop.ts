import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { readDir } from "@tauri-apps/plugin-fs";
import { usePsdLoader } from "./usePsdLoader";
import { useViewStore } from "../store/viewStore";
import { isSupportedFile } from "../types";

/**
 * グローバルなドラッグ＆ドロップリスナー
 * AppLayout でマウントし、常にファイル/フォルダのドロップを受け付ける
 * (replace タブは ReplaceDropZone が独自に処理するためスキップ)
 */
export function useGlobalDragDrop() {
  const { loadFiles } = usePsdLoader();

  useEffect(() => {
    const currentWindow = getCurrentWindow();
    let unlisten: (() => void) | undefined;
    let mounted = true;

    const setup = async () => {
      const fn = await currentWindow.onDragDropEvent(async (event) => {
        if (useViewStore.getState().activeView === "replace") return;

        if (event.payload.type === "drop") {
          const paths = event.payload.paths;
          if (!paths || paths.length === 0) return;

          const imageFiles: string[] = [];

          for (const path of paths) {
            try {
              const entries = await readDir(path);
              for (const entry of entries) {
                if (entry.isFile && entry.name && isSupportedFile(entry.name)) {
                  imageFiles.push(`${path}\\${entry.name}`);
                }
              }
            } catch {
              if (isSupportedFile(path)) {
                imageFiles.push(path);
              }
            }
          }

          if (imageFiles.length > 0) {
            await loadFiles(imageFiles);
          }
        }
      });

      if (mounted) {
        unlisten = fn;
      } else {
        fn();
      }
    };

    setup();
    return () => {
      mounted = false;
      if (unlisten) unlisten();
    };
  }, [loadFiles]);
}
