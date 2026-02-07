import { useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { usePsdStore } from "../store/psdStore";

/**
 * Utility hook that provides a function to open files in Photoshop.
 * Does NOT register any keyboard shortcuts - callers handle that themselves.
 */
export function useOpenInPhotoshop() {
  const openFileInPhotoshop = useCallback(async (filePath: string) => {
    try {
      await invoke("open_file_in_photoshop", { filePath });
    } catch (error) {
      console.error("Failed to open in Photoshop:", error);
    }
  }, []);

  return { openFileInPhotoshop };
}

/**
 * Hook that registers "P" keyboard shortcut to open the active file in Photoshop.
 * Use in views where single-file P shortcut is desired (e.g. SpecCheckView).
 */
export function usePhotoshopShortcut() {
  const getActiveFile = usePsdStore((s) => s.getActiveFile);
  const { openFileInPhotoshop } = useOpenInPhotoshop();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        const file = getActiveFile();
        if (file?.filePath) {
          openFileInPhotoshop(file.filePath);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [getActiveFile, openFileInPhotoshop]);
}
