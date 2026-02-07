import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { readDir } from "@tauri-apps/plugin-fs";
import { usePsdLoader } from "../../hooks/usePsdLoader";
import { useViewStore } from "../../store/viewStore";

export function DropZone() {
  const [isDragging, setIsDragging] = useState(false);
  const { loadFiles, loadFolder } = usePsdLoader();

  // Tauri drag-drop event listener
  useEffect(() => {
    const currentWindow = getCurrentWindow();
    let unlisten: (() => void) | undefined;
    let mounted = true;

    const setupListener = async () => {
      const fn = await currentWindow.onDragDropEvent(async (event) => {
        // replace タブ時はスキップ（ReplaceDropZone が処理する）
        if (useViewStore.getState().activeView === "replace") return;

        if (event.payload.type === "over") {
          setIsDragging(true);
        } else if (event.payload.type === "leave") {
          setIsDragging(false);
        } else if (event.payload.type === "drop") {
          setIsDragging(false);
          const paths = event.payload.paths;

          if (paths && paths.length > 0) {
            // Check if it's a folder or files
            const psdFiles: string[] = [];

            for (const path of paths) {
              // Check if path is a directory
              try {
                const entries = await readDir(path);
                // It's a directory - collect PSD files from it
                for (const entry of entries) {
                  if (entry.isFile && entry.name) {
                    const name = entry.name.toLowerCase();
                    if (name.endsWith(".psd") || name.endsWith(".psb")) {
                      psdFiles.push(`${path}\\${entry.name}`);
                    }
                  }
                }
              } catch {
                // Not a directory, check if it's a PSD file
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
        }
      });

      // 非同期セットアップ中にアンマウントされた場合、即座にクリーンアップ
      if (mounted) {
        unlisten = fn;
      } else {
        fn();
      }
    };

    setupListener();

    return () => {
      mounted = false;
      if (unlisten) {
        unlisten();
      }
    };
  }, [loadFiles, loadFolder]);

  // Prevent default browser drag behavior
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Actual drop handling is done by Tauri's onDragDropEvent
  };

  return (
    <div
      className={`
        flex flex-col items-center justify-center h-full
        border-2 border-dashed rounded-3xl m-6 transition-all duration-300
        ${isDragging
          ? "border-accent bg-accent/10 shadow-[inset_0_0_60px_rgba(255,107,157,0.15)] scale-[1.01]"
          : "border-text-muted/20 hover:border-accent/40 hover:bg-accent/5"
        }
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="text-center p-8">
        {/* アイコン */}
        <div
          className={`
            w-24 h-24 mx-auto mb-6 rounded-3xl flex items-center justify-center
            transition-all duration-300
            ${isDragging
              ? "bg-gradient-to-br from-accent to-accent-secondary shadow-glow-pink scale-110"
              : "bg-bg-tertiary"
            }
          `}
        >
          <svg
            className={`w-12 h-12 transition-colors duration-300 ${
              isDragging ? "text-white" : "text-text-muted"
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </div>

        {/* テキスト */}
        <p
          className={`
            text-xl font-display font-medium mb-3 transition-colors duration-300
            ${isDragging ? "text-accent" : "text-text-primary"}
          `}
        >
          PSDファイルをドロップ
        </p>
        <p className="text-sm text-text-muted mb-6">
          または左側のパネルからフォルダ/ファイルを選択
        </p>

        {/* 対応形式バッジ */}
        <div className="flex items-center justify-center gap-2">
          <span className="px-3 py-1 bg-manga-pink/20 text-manga-pink text-xs rounded-full">
            .psd
          </span>
          <span className="px-3 py-1 bg-manga-lavender/20 text-manga-lavender text-xs rounded-full">
            .psb
          </span>
        </div>
      </div>
    </div>
  );
}
