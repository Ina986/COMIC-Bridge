import { useCallback } from "react";
import { readDir, readFile, stat } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import { usePsdStore } from "../store/psdStore";
import { useSpecStore } from "../store/specStore";
import { useViewStore } from "../store/viewStore";
import { parsePsdBufferFast, parsePsdBuffer } from "../lib/psd/parser";
import { naturalCompare } from "../lib/naturalSort";
import { isSupportedFile, isPsdFile, isPdfFile } from "../types";
import type { PsdFile } from "../types";

interface PdfInfoResult {
  page_count: number;
  pages: { width: number; height: number }[];
}

export function usePsdLoader() {
  const setFiles = usePsdStore((state) => state.setFiles);
  const updateFile = usePsdStore((state) => state.updateFile);
  const replaceFile = usePsdStore((state) => state.replaceFile);
  const setLoadingStatus = usePsdStore((state) => state.setLoadingStatus);
  const setCurrentFolderPath = usePsdStore((state) => state.setCurrentFolderPath);
  const setErrorMessage = usePsdStore((state) => state.setErrorMessage);

  const selectSpecAndCheck = useSpecStore((state) => state.selectSpecAndCheck);

  const loadFolder = useCallback(
    async (folderPath: string) => {
      setLoadingStatus("loading");
      setErrorMessage(null);
      setCurrentFolderPath(folderPath);

      try {
        const entries = await readDir(folderPath);
        const imagePaths: string[] = [];

        for (const entry of entries) {
          if (entry.isFile && entry.name && isSupportedFile(entry.name)) {
            imagePaths.push(`${folderPath}\\${entry.name}`);
          }
        }

        if (imagePaths.length === 0) {
          setFiles([]);
          setLoadingStatus("idle");
          return;
        }

        await loadFilesInternal(imagePaths);
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
      const PARALLEL_LIMIT = 6;
      const filesNeedingThumbnail: string[] = []; // PSDでサムネイルがなかったファイル

      for (let i = 0; i < initialFiles.length; i += PARALLEL_LIMIT) {
        const chunk = initialFiles.slice(i, i + PARALLEL_LIMIT);
        await Promise.all(
          chunk.map(async (file) => {
            try {
              if (isPsdFile(file.fileName)) {
                // PSD/PSB: ag-psdでパース
                updateFile(file.id, { thumbnailStatus: "loading" });

                const buffer = await readFile(file.filePath);
                const arrayBuffer = buffer.buffer.slice(
                  buffer.byteOffset,
                  buffer.byteOffset + buffer.byteLength
                );

                const result = await parsePsdBufferFast(arrayBuffer);

                updateFile(file.id, {
                  metadata: result.metadata,
                  thumbnailUrl: result.thumbnailData,
                  thumbnailStatus: result.thumbnailData ? "ready" : "pending",
                  fileSize: buffer.byteLength,
                });

                if (!result.thumbnailData) {
                  filesNeedingThumbnail.push(file.id);
                }
              } else if (isPdfFile(file.fileName)) {
                // PDF: ページ情報取得 → ページ数分のエントリーに展開
                try {
                  updateFile(file.id, { thumbnailStatus: "loading" });
                  const fileStat = await stat(file.filePath);

                  const pdfInfo = await invoke<PdfInfoResult>("get_pdf_info", {
                    filePath: file.filePath,
                  });

                  if (pdfInfo.page_count === 0) {
                    updateFile(file.id, {
                      fileSize: fileStat.size,
                      thumbnailStatus: "ready",
                    });
                    return;
                  }

                  // Create page entries
                  const pageFiles: PsdFile[] = pdfInfo.pages.map((page, pageIdx) => ({
                    id: `${file.id}-p${pageIdx}`,
                    filePath: file.filePath,
                    fileName: `${file.fileName} [p${pageIdx + 1}]`,
                    fileSize: fileStat.size,
                    modifiedTime: file.modifiedTime,
                    sourceType: "pdf" as const,
                    pdfSourcePath: file.filePath,
                    pdfPageIndex: pageIdx,
                    metadata: {
                      width: page.width,
                      height: page.height,
                      dpi: 72,
                      colorMode: "RGB" as const,
                      bitsPerChannel: 8,
                      hasGuides: false,
                      guides: [],
                      layerCount: 0,
                      layerTree: [],
                      hasAlphaChannels: false,
                      alphaChannelCount: 0,
                      alphaChannelNames: [],
                      hasTombo: false,
                    },
                    thumbnailStatus: "pending",
                  }));

                  replaceFile(file.id, pageFiles);

                  // Generate thumbnails for each page
                  for (const pageFile of pageFiles) {
                    try {
                      const thumbnail = await invoke<string>("get_pdf_thumbnail", {
                        filePath: pageFile.pdfSourcePath,
                        pageIndex: pageFile.pdfPageIndex,
                        maxSize: 200,
                      });
                      updateFile(pageFile.id, {
                        thumbnailUrl: `data:image/jpeg;base64,${thumbnail}`,
                        thumbnailStatus: "ready",
                      });
                    } catch (thumbErr) {
                      console.error(`Failed to generate PDF thumbnail for page ${pageFile.pdfPageIndex}:`, thumbErr);
                      updateFile(pageFile.id, { thumbnailStatus: "ready" });
                    }
                  }
                } catch (pdfErr) {
                  console.error(`Failed to load PDF ${file.fileName}:`, pdfErr);
                  // Fallback: keep as single file entry without preview
                  updateFile(file.id, {
                    thumbnailStatus: "ready",
                    error: pdfErr instanceof Error ? pdfErr.message : "PDF読み込みエラー",
                  });
                }
              } else {
                // 非PSD/非PDF: ファイルサイズのみ取得（Photoshopが開ける前提）
                try {
                  const fileStat = await stat(file.filePath);
                  updateFile(file.id, {
                    fileSize: fileStat.size,
                    thumbnailStatus: "ready",
                  });
                } catch {
                  updateFile(file.id, { thumbnailStatus: "ready" });
                }
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

      // PSDでサムネイルがなかったファイルはフル読み込みでフォールバック
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

      // 前回選択があれば自動で仕様を選択してチェック開始
      const { lastSelectedSpecId: lastSpec } = useSpecStore.getState();
      if (lastSpec) {
        selectSpecAndCheck(lastSpec);
      }
    },
    [setFiles, updateFile, replaceFile, setLoadingStatus, selectSpecAndCheck]
  );

  return { loadFolder, loadFiles };
}
