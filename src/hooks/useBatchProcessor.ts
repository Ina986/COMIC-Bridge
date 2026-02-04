import { useState, useCallback } from "react";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import { usePsdStore } from "../store/psdStore";
import { writeGuidesToPsd } from "../lib/psd/parser";
import type { Guide } from "../types";

interface BatchTask {
  fileId: string;
  fileName: string;
  status: "pending" | "processing" | "success" | "error";
  error?: string;
}

export function useBatchProcessor() {
  const [tasks, setTasks] = useState<BatchTask[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const files = usePsdStore((state) => state.files);
  const updateFile = usePsdStore((state) => state.updateFile);

  const updateTask = useCallback((fileId: string, updates: Partial<BatchTask>) => {
    setTasks((prev) =>
      prev.map((t) => (t.fileId === fileId ? { ...t, ...updates } : t))
    );
  }, []);

  const processFiles = useCallback(
    async (fileIds: string[], guides: Guide[]) => {
      const PARALLEL_LIMIT = 4;
      setIsProcessing(true);

      // Get file info for selected IDs
      const targetFiles = files.filter((f) => fileIds.includes(f.id));

      // Initialize tasks
      const initialTasks: BatchTask[] = targetFiles.map((f) => ({
        fileId: f.id,
        fileName: f.fileName,
        status: "pending",
      }));
      setTasks(initialTasks);
      setProgress({ current: 0, total: targetFiles.length });

      // Process in chunks
      for (let i = 0; i < targetFiles.length; i += PARALLEL_LIMIT) {
        const chunk = targetFiles.slice(i, i + PARALLEL_LIMIT);

        await Promise.all(
          chunk.map(async (file) => {
            updateTask(file.id, { status: "processing" });

            try {
              // Read file
              const buffer = await readFile(file.filePath);
              const arrayBuffer = buffer.buffer.slice(
                buffer.byteOffset,
                buffer.byteOffset + buffer.byteLength
              );

              // Apply guides
              const modifiedBuffer = writeGuidesToPsd(arrayBuffer, guides);

              // Write back
              await writeFile(file.filePath, new Uint8Array(modifiedBuffer));

              // Update file metadata
              updateFile(file.id, {
                metadata: file.metadata
                  ? {
                      ...file.metadata,
                      hasGuides: guides.length > 0,
                      guides: guides,
                    }
                  : undefined,
              });

              updateTask(file.id, { status: "success" });
            } catch (error) {
              console.error(`Failed to process ${file.fileName}:`, error);
              updateTask(file.id, {
                status: "error",
                error: error instanceof Error ? error.message : "処理エラー",
              });
            }

            setProgress((p) => ({ ...p, current: p.current + 1 }));
          })
        );
      }

      setIsProcessing(false);
    },
    [files, updateFile, updateTask]
  );

  const reset = useCallback(() => {
    setTasks([]);
    setProgress({ current: 0, total: 0 });
  }, []);

  return {
    tasks,
    isProcessing,
    progress,
    processFiles,
    reset,
  };
}
