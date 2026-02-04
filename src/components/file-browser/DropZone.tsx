import { useState, useCallback } from "react";
import { usePsdLoader } from "../../hooks/usePsdLoader";

export function DropZone() {
  const [isDragging, setIsDragging] = useState(false);
  const { loadFiles } = usePsdLoader();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const items = e.dataTransfer.items;
      if (!items || items.length === 0) return;

      const paths: string[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) {
            // Get full path from webkitRelativePath or name
            // In Tauri, we need to use the file path from the drop event
            const path = (file as any).path || file.name;
            if (path.toLowerCase().endsWith(".psd") || path.toLowerCase().endsWith(".psb")) {
              paths.push(path);
            }
          }
        }
      }

      if (paths.length > 0) {
        await loadFiles(paths);
      }
    },
    [loadFiles]
  );

  return (
    <div
      className={`
        flex flex-col items-center justify-center h-full
        border-2 border-dashed rounded-lg m-4 transition-colors
        ${isDragging
          ? "border-accent bg-accent/10"
          : "border-text-muted/30 hover:border-text-muted/50"
        }
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="text-center p-8">
        <svg
          className={`w-16 h-16 mx-auto mb-4 ${
            isDragging ? "text-accent" : "text-text-muted"
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
        <p className="text-lg font-medium text-text-secondary mb-2">
          PSDファイルをドロップ
        </p>
        <p className="text-sm text-text-muted">
          または左側のパネルからフォルダ/ファイルを選択
        </p>
      </div>
    </div>
  );
}
