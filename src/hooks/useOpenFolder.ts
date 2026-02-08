import { useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { usePsdStore } from "../store/psdStore";

/**
 * ファイルが含まれるフォルダをエクスプローラーで開くユーティリティhook
 */
export function useOpenFolder() {
  /** 単一ファイルを選択状態でエクスプローラーを開く */
  const openFolderForFile = useCallback(async (filePath: string) => {
    const normalized = filePath.replace(/\//g, "\\");
    try {
      await invoke("open_folder_in_explorer", { folderPath: normalized });
    } catch (error) {
      console.error("Failed to open folder:", error);
    }
  }, []);

  /** 複数ファイルを選択状態でエクスプローラーを開く */
  const revealFiles = useCallback(async (filePaths: string[]) => {
    if (filePaths.length === 0) return;
    const normalized = filePaths.map((p) => p.replace(/\//g, "\\"));
    try {
      await invoke("reveal_files_in_explorer", { filePaths: normalized });
    } catch (error) {
      console.error("Failed to reveal files:", error);
    }
  }, []);

  return { openFolderForFile, revealFiles };
}

/**
 * "F"キーでファイルのフォルダを開くショートカットhook
 * 複数選択時は複数ファイルを選択状態で表示
 * AppLayoutに配置して全タブで有効にする
 */
export function useOpenFolderShortcut() {
  const getActiveFile = usePsdStore((s) => s.getActiveFile);
  const selectedFileIds = usePsdStore((s) => s.selectedFileIds);
  const files = usePsdStore((s) => s.files);
  const { openFolderForFile, revealFiles } = useOpenFolder();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === "f" || e.key === "F") {
        e.preventDefault();

        if (selectedFileIds.length > 1) {
          // 複数選択: 選択中のファイルをすべて選択状態で開く
          const paths = selectedFileIds
            .map((id) => files.find((f) => f.id === id)?.filePath)
            .filter((p): p is string => !!p);
          if (paths.length > 0) {
            revealFiles(paths);
          }
        } else {
          // 単一: アクティブファイルを選択状態で開く
          const file = getActiveFile();
          if (file?.filePath) {
            openFolderForFile(file.filePath);
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [getActiveFile, selectedFileIds, files, openFolderForFile, revealFiles]);
}
