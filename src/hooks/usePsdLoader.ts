import { useCallback } from "react";
import { readDir, readFile, stat } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import { usePsdStore } from "../store/psdStore";
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
  const batchUpdateFiles = usePsdStore((state) => state.batchUpdateFiles);
  const replaceFile = usePsdStore((state) => state.replaceFile);
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

  // サブフォルダ込みのフォルダ読み込み（1階層深さ）
  const loadFolderWithSubfolders = useCallback(
    async (folderPaths: string[]) => {
      setLoadingStatus("loading");
      setErrorMessage(null);
      if (folderPaths.length > 0) {
        setCurrentFolderPath(folderPaths[0]);
      }

      try {
        type FileWithSub = { path: string; subfolderName: string };
        const allFiles: FileWithSub[] = [];

        for (const folderPath of folderPaths) {
          const entries = await readDir(folderPath);

          // ルート直下のファイル
          for (const entry of entries) {
            if (entry.isFile && entry.name && isSupportedFile(entry.name)) {
              allFiles.push({ path: `${folderPath}\\${entry.name}`, subfolderName: "" });
            }
          }

          // 1階層サブフォルダ
          for (const entry of entries) {
            if (!entry.isFile && entry.name) {
              try {
                const subPath = `${folderPath}\\${entry.name}`;
                const subEntries = await readDir(subPath);
                for (const subEntry of subEntries) {
                  if (subEntry.isFile && subEntry.name && isSupportedFile(subEntry.name)) {
                    allFiles.push({ path: `${subPath}\\${subEntry.name}`, subfolderName: entry.name });
                  }
                }
              } catch { /* サブフォルダ読み込みエラーは無視 */ }
            }
          }
        }

        if (allFiles.length === 0) {
          setFiles([]);
          setLoadingStatus("idle");
          return;
        }

        // ソート: サブフォルダ名→ファイル名の自然順
        allFiles.sort((a, b) => {
          if (a.subfolderName !== b.subfolderName) {
            return naturalCompare(a.subfolderName, b.subfolderName);
          }
          return naturalCompare(a.path, b.path);
        });

        await loadFilesInternal(
          allFiles.map((f) => f.path),
          allFiles.map((f) => f.subfolderName),
        );
      } catch (error) {
        console.error("Failed to load folder with subfolders:", error);
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
    async (filePaths: string[], subfolderNames?: string[]) => {
      // replace タブ時はスキップ（ReplaceDropZone が独自に処理する）
      if (useViewStore.getState().activeView === "replace") return;

      // subfolderNamesが渡されていない場合のみソート（サブフォルダ付きは呼び出し元でソート済み）
      if (!subfolderNames) {
        filePaths.sort((a, b) => naturalCompare(a, b));
      }

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
          subfolderName: subfolderNames?.[index],
        };
      });

      setFiles(initialFiles);
      setLoadingStatus("idle");

      // Load metadata and thumbnails in parallel (with limit)
      const PARALLEL_LIMIT = 6;
      const filesNeedingThumbnail: string[] = []; // PSDでサムネイルがなかったファイル

      for (let i = 0; i < initialFiles.length; i += PARALLEL_LIMIT) {
        const chunk = initialFiles.slice(i, i + PARALLEL_LIMIT);
        // チャンク内の更新をバッチ化（個別updateFileを避けて再レンダリングを最小化）
        const chunkUpdates = new Map<string, Partial<PsdFile>>();

        await Promise.all(
          chunk.map(async (file) => {
            try {
              if (isPsdFile(file.fileName)) {
                // PSD/PSB: ag-psdでパース
                const buffer = await readFile(file.filePath);
                const arrayBuffer = buffer.buffer.slice(
                  buffer.byteOffset,
                  buffer.byteOffset + buffer.byteLength
                );

                const result = await parsePsdBufferFast(arrayBuffer);

                chunkUpdates.set(file.id, {
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
                  const fileStat = await stat(file.filePath);

                  const pdfInfo = await invoke<PdfInfoResult>("get_pdf_info", {
                    filePath: file.filePath,
                  });

                  if (pdfInfo.page_count === 0) {
                    chunkUpdates.set(file.id, {
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

                  // Generate thumbnails for each page (batch per PDF)
                  const pdfThumbUpdates = new Map<string, Partial<PsdFile>>();
                  for (const pageFile of pageFiles) {
                    try {
                      const thumbnail = await invoke<string>("get_pdf_thumbnail", {
                        filePath: pageFile.pdfSourcePath,
                        pageIndex: pageFile.pdfPageIndex,
                        maxSize: 200,
                      });
                      pdfThumbUpdates.set(pageFile.id, {
                        thumbnailUrl: `data:image/jpeg;base64,${thumbnail}`,
                        thumbnailStatus: "ready",
                      });
                    } catch (thumbErr) {
                      console.error(`Failed to generate PDF thumbnail for page ${pageFile.pdfPageIndex}:`, thumbErr);
                      pdfThumbUpdates.set(pageFile.id, { thumbnailStatus: "ready" });
                    }
                  }
                  if (pdfThumbUpdates.size > 0) {
                    batchUpdateFiles(pdfThumbUpdates);
                  }
                } catch (pdfErr) {
                  console.error(`Failed to load PDF ${file.fileName}:`, pdfErr);
                  chunkUpdates.set(file.id, {
                    thumbnailStatus: "ready",
                    error: pdfErr instanceof Error ? pdfErr.message : "PDF読み込みエラー",
                  });
                }
              } else {
                // 非PSD/非PDF: ファイルサイズのみ取得
                try {
                  const fileStat = await stat(file.filePath);
                  chunkUpdates.set(file.id, {
                    fileSize: fileStat.size,
                    thumbnailStatus: "ready",
                  });
                } catch {
                  chunkUpdates.set(file.id, { thumbnailStatus: "ready" });
                }
              }
            } catch (error) {
              console.error(`Failed to load ${file.fileName}:`, error);
              chunkUpdates.set(file.id, {
                thumbnailStatus: "error",
                error: error instanceof Error ? error.message : "読み込みエラー",
              });
            }
          })
        );

        // チャンク完了後に1回のset()でまとめて反映
        if (chunkUpdates.size > 0) {
          batchUpdateFiles(chunkUpdates);
        }
      }

      // PSDでサムネイルがなかったファイルはフル読み込みでフォールバック
      if (filesNeedingThumbnail.length > 0) {
        const files = usePsdStore.getState().files;
        const thumbUpdates = new Map<string, Partial<PsdFile>>();
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
            thumbUpdates.set(file.id, {
              thumbnailUrl: result.thumbnailData,
              thumbnailStatus: result.thumbnailData ? "ready" : "error",
            });
          } catch (error) {
            console.error(`Failed to generate thumbnail for ${file.fileName}:`, error);
          }
        }
        if (thumbUpdates.size > 0) {
          batchUpdateFiles(thumbUpdates);
        }
      }

      // 仕様チェックはSpecCheckViewでのみ実行される（useSpecCheckerが自動検出）
    },
    [setFiles, updateFile, batchUpdateFiles, replaceFile, setLoadingStatus]
  );

  return { loadFolder, loadFolderWithSubfolders, loadFiles };
}
