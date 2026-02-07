import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { readDir } from "@tauri-apps/plugin-fs";
import { usePsdLoader } from "./usePsdLoader";
import { useViewStore } from "../store/viewStore";

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

          const psdFiles: string[] = [];

          for (const path of paths) {
            try {
              const entries = await readDir(path);
              for (const entry of entries) {
                if (entry.isFile && entry.name) {
                  const name = entry.name.toLowerCase();
                  if (name.endsWith(".psd") || name.endsWith(".psb")) {
                    psdFiles.push(`${path}\\${entry.name}`);
                  }
                }
              }
            } catch {
              const lowerPath = path.toLowerCase();
              if (lowerPath.endsWith(".psd") || lowerPath.endsWith(".psb")) {
                psdFiles.push(path);
              }
            }
          }

          if (psdFiles.length > 0) {
            await loadFiles(psdFiles);
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
