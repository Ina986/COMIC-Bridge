import { useCallback } from "react";
import { readDir, readFile } from "@tauri-apps/plugin-fs";
import { usePsdStore } from "../store/psdStore";
import { parsePsdBuffer } from "../lib/psd/parser";
import type { PsdFile } from "../types";

export function usePsdLoader() {
  const setFiles = usePsdStore((state) => state.setFiles);
  const updateFile = usePsdStore((state) => state.updateFile);
  const setLoadingStatus = usePsdStore((state) => state.setLoadingStatus);
  const setCurrentFolderPath = usePsdStore((state) => state.setCurrentFolderPath);
  const setErrorMessage = usePsdStore((state) => state.setErrorMessage);

  const loadFolder = useCallback(
    async (folderPath: string) => {
      setLoadingStatus("loading");
      setErrorMessage(null);
      setCurrentFolderPath(folderPath);

      try {
        const entries = await readDir(folderPath);
        const psdPaths: string[] = [];

        for (const entry of entries) {
          if (entry.isFile && entry.name) {
            const name = entry.name.toLowerCase();
            if (name.endsWith(".psd") || name.endsWith(".psb")) {
              psdPaths.push(`${folderPath}\\${entry.name}`);
            }
          }
        }

        if (psdPaths.length === 0) {
          setFiles([]);
          setLoadingStatus("idle");
          return;
        }

        await loadFilesInternal(psdPaths);
      } catch (error) {
        console.error("Failed to load folder:", error);
        setErrorMessage(error instanceof Error ? error.message : "フォルダの読み込みに失敗しました");
        setLoadingStatus("error");
      }
    },
    [setFiles, setLoadingStatus, setCurrentFolderPath, setErrorMessage]
  );

  const loadFiles = useCallback(
    async (filePaths: string[]) => {
      setLoadingStatus("loading");
      setErrorMessage(null);

      try {
        await loadFilesInternal(filePaths);
      } catch (error) {
        console.error("Failed to load files:", error);
        setErrorMessage(error instanceof Error ? error.message : "ファイルの読み込みに失敗しました");
        setLoadingStatus("error");
      }
    },
    [setLoadingStatus, setErrorMessage]
  );

  const loadFilesInternal = useCallback(
    async (filePaths: string[]) => {
      // Create initial file entries
      const initialFiles: PsdFile[] = filePaths.map((filePath, index) => {
        const fileName = filePath.split(/[/\\]/).pop() || "unknown.psd";
        return {
          id: `file-${Date.now()}-${index}`,
          filePath,
          fileName,
          fileSize: 0,
          modifiedTime: Date.now(),
          thumbnailStatus: "pending",
        };
      });

      setFiles(initialFiles);
      setLoadingStatus("idle");

      // Load metadata and thumbnails in parallel (with limit)
      const PARALLEL_LIMIT = 4;
      for (let i = 0; i < initialFiles.length; i += PARALLEL_LIMIT) {
        const chunk = initialFiles.slice(i, i + PARALLEL_LIMIT);
        await Promise.all(
          chunk.map(async (file) => {
            try {
              updateFile(file.id, { thumbnailStatus: "loading" });

              const buffer = await readFile(file.filePath);
              const arrayBuffer = buffer.buffer.slice(
                buffer.byteOffset,
                buffer.byteOffset + buffer.byteLength
              );

              const result = await parsePsdBuffer(arrayBuffer);

              updateFile(file.id, {
                metadata: result.metadata,
                thumbnailUrl: result.thumbnailData,
                thumbnailStatus: "ready",
                fileSize: buffer.byteLength,
              });
            } catch (error) {
              console.error(`Failed to load ${file.fileName}:`, error);
              updateFile(file.id, {
                thumbnailStatus: "error",
                error: error instanceof Error ? error.message : "読み込みエラー",
              });
            }
          })
        );
      }
    },
    [setFiles, updateFile, setLoadingStatus]
  );

  return { loadFolder, loadFiles };
}
