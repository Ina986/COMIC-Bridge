import { useCallback } from "react";
import { readDir, readFile } from "@tauri-apps/plugin-fs";
import { usePsdStore } from "../store/psdStore";
import { useSpecStore } from "../store/specStore";
import { useViewStore } from "../store/viewStore";
import { parsePsdBufferFast, parsePsdBuffer } from "../lib/psd/parser";
import { naturalCompare } from "../lib/naturalSort";
import type { PsdFile } from "../types";

export function usePsdLoader() {
  const setFiles = usePsdStore((state) => state.setFiles);
  const updateFile = usePsdStore((state) => state.updateFile);
  const setLoadingStatus = usePsdStore((state) => state.setLoadingStatus);
  const setCurrentFolderPath = usePsdStore((state) => state.setCurrentFolderPath);
  const setErrorMessage = usePsdStore((state) => state.setErrorMessage);

  // 仕様選択モーダル関連
  const openSpecSelectionModal = useSpecStore((state) => state.openSpecSelectionModal);
  const selectSpecAndCheck = useSpecStore((state) => state.selectSpecAndCheck);

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
      // replace タブ時はスキップ（ReplaceDropZone が独自に処理する）
      if (useViewStore.getState().activeView === "replace") return;

      // 自然順ソート（数字部分を数値比較）
      filePaths.sort((a, b) => naturalCompare(a, b));

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
      // 高速版を使用 - 埋め込みサムネイルがあれば使用、なければ後でフォールバック
      const PARALLEL_LIMIT = 6; // 高速版は並列数を増やせる
      const filesNeedingThumbnail: string[] = []; // サムネイルがなかったファイル

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

              // 高速版で読み込み（合成画像をスキップ）
              const result = await parsePsdBufferFast(arrayBuffer);

              updateFile(file.id, {
                metadata: result.metadata,
                thumbnailUrl: result.thumbnailData,
                thumbnailStatus: result.thumbnailData ? "ready" : "pending",
                fileSize: buffer.byteLength,
              });

              // サムネイルがなければ後で再読み込みリストに追加
              if (!result.thumbnailData) {
                filesNeedingThumbnail.push(file.id);
              }
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

      // サムネイルがなかったファイルはフル読み込みでフォールバック（バックグラウンド）
      if (filesNeedingThumbnail.length > 0) {
        const files = usePsdStore.getState().files;
        for (const fileId of filesNeedingThumbnail) {
          const file = files.find((f) => f.id === fileId);
          if (!file) continue;

          try {
            const buffer = await readFile(file.filePath);
            const arrayBuffer = buffer.buffer.slice(
              buffer.byteOffset,
              buffer.byteOffset + buffer.byteLength
            );

            // フル版で読み込み（合成画像から生成）
            const result = await parsePsdBuffer(arrayBuffer);
            updateFile(file.id, {
              thumbnailUrl: result.thumbnailData,
              thumbnailStatus: result.thumbnailData ? "ready" : "error",
            });
          } catch (error) {
            console.error(`Failed to generate thumbnail for ${file.fileName}:`, error);
          }
        }
      }

      // 仕様選択: 自動チェックが有効で前回選択があれば自動選択、なければモーダル表示
      const { autoCheckEnabled: autoEnabled, lastSelectedSpecId: lastSpec } =
        useSpecStore.getState();
      if (autoEnabled && lastSpec) {
        // 自動で前回の仕様を選択してチェック開始
        selectSpecAndCheck(lastSpec);
      } else {
        // モーダルを表示
        openSpecSelectionModal(initialFiles.length);
      }
    },
    [setFiles, updateFile, setLoadingStatus, openSpecSelectionModal, selectSpecAndCheck]
  );

  return { loadFolder, loadFiles };
}
