import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { usePsdStore } from "../store/psdStore";
import type { Guide } from "../types";

interface PhotoshopResult {
  filePath: string;
  success: boolean;
  changes: string[];
  error: string | null;
}

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

  const updateTask = useCallback(
    (fileId: string, updates: Partial<BatchTask>) => {
      setTasks((prev) =>
        prev.map((t) => (t.fileId === fileId ? { ...t, ...updates } : t))
      );
    },
    []
  );

  const processFiles = useCallback(
    async (fileIds: string[], guides: Guide[]) => {
      setIsProcessing(true);

      const targetFiles = files.filter((f) => fileIds.includes(f.id));

      // Initialize tasks
      const initialTasks: BatchTask[] = targetFiles.map((f) => ({
        fileId: f.id,
        fileName: f.fileName,
        status: "processing",
      }));
      setTasks(initialTasks);
      setProgress({ current: 0, total: targetFiles.length });

      try {
        const filePaths = targetFiles.map((f) => f.filePath);

        // Photoshop JSX via Rust command
        const results = await invoke<PhotoshopResult[]>(
          "run_photoshop_guide_apply",
          {
            filePaths,
            guides: guides.map((g) => ({
              direction: g.direction,
              position: g.position,
            })),
          }
        );

        // Map results back to tasks
        // JSX returns paths with forward slashes, normalize for comparison
        for (const result of results) {
          const normalizedPath = result.filePath.replace(/\//g, "\\");
          const file = targetFiles.find(
            (f) => f.filePath === result.filePath || f.filePath === normalizedPath
          );
          if (!file) continue;

          if (result.success) {
            updateTask(file.id, { status: "success" });
            updateFile(file.id, {
              metadata: file.metadata
                ? {
                    ...file.metadata,
                    hasGuides: guides.length > 0,
                    guides: guides,
                  }
                : undefined,
            });
          } else {
            updateTask(file.id, {
              status: "error",
              error: result.error || "処理エラー",
            });
          }

          setProgress((p) => ({ ...p, current: p.current + 1 }));
        }
      } catch (error) {
        console.error("Photoshop guide apply failed:", error);
        // Mark all tasks as error
        for (const file of targetFiles) {
          updateTask(file.id, {
            status: "error",
            error: error instanceof Error ? error.message : String(error),
          });
        }
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
