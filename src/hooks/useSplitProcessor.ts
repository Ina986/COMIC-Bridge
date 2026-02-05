import { useCallback } from "react";
import { readFile, writeFile, mkdir, exists } from "@tauri-apps/plugin-fs";
import { join, desktopDir } from "@tauri-apps/api/path";
import { readPsd, writePsd, type Psd, type Layer } from "ag-psd";
import { usePsdStore } from "../store/psdStore";
import { useSplitStore, type SplitSettings, type SplitResult } from "../store/splitStore";

export function useSplitProcessor() {
  const files = usePsdStore((state) => state.files);
  const selectedFileIds = usePsdStore((state) => state.selectedFileIds);
  const settings = useSplitStore((state) => state.settings);
  const setIsProcessing = useSplitStore((state) => state.setIsProcessing);
  const setProgress = useSplitStore((state) => state.setProgress);
  const setCurrentFile = useSplitStore((state) => state.setCurrentFile);
  const addResult = useSplitStore((state) => state.addResult);
  const clearResults = useSplitStore((state) => state.clearResults);

  // PSDを左右に分割
  const splitPsd = useCallback(
    async (
      psd: Psd,
      splitPoint: number
    ): Promise<{ left: Psd; right: Psd }> => {
      const originalWidth = psd.width;
      const height = psd.height;

      // 左半分
      const leftPsd: Psd = {
        width: splitPoint,
        height: height,
        channels: psd.channels,
        bitsPerChannel: psd.bitsPerChannel,
        colorMode: psd.colorMode,
        children: psd.children ? cloneLayersForSplit(psd.children, 0, splitPoint, 0, height) : [],
      };

      // 右半分
      const rightWidth = originalWidth - splitPoint;
      const rightPsd: Psd = {
        width: rightWidth,
        height: height,
        channels: psd.channels,
        bitsPerChannel: psd.bitsPerChannel,
        colorMode: psd.colorMode,
        children: psd.children ? cloneLayersForSplit(psd.children, splitPoint, originalWidth, 0, height, -splitPoint) : [],
      };

      return { left: leftPsd, right: rightPsd };
    },
    []
  );

  // レイヤーを分割用にクローン（オフセット適用）
  const cloneLayersForSplit = (
    layers: Layer[],
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    offsetX: number = 0
  ): Layer[] => {
    return layers
      .filter((layer) => {
        // 完全にキャンバス外のレイヤーを除外
        if (layer.left !== undefined && layer.right !== undefined) {
          if (layer.right <= minX || layer.left >= maxX) {
            return false;
          }
        }
        return true;
      })
      .map((layer) => {
        const cloned: Layer = { ...layer };

        // 位置をオフセット
        if (cloned.left !== undefined) {
          cloned.left = cloned.left + offsetX;
        }
        if (cloned.right !== undefined) {
          cloned.right = cloned.right + offsetX;
        }

        // 子レイヤーを再帰的に処理
        if (cloned.children && cloned.children.length > 0) {
          cloned.children = cloneLayersForSplit(
            cloned.children,
            minX,
            maxX,
            minY,
            maxY,
            offsetX
          );
        }

        return cloned;
      });
  };

  // 出力ディレクトリを準備
  const prepareOutputDir = useCallback(async (settings: SplitSettings): Promise<string> => {
    let outputDir = settings.outputDirectory;

    if (!outputDir) {
      const desktop = await desktopDir();
      outputDir = await join(desktop, "manga-psd-output", "split");
    }

    // ディレクトリ作成
    const dirExists = await exists(outputDir);
    if (!dirExists) {
      await mkdir(outputDir, { recursive: true });
    }

    return outputDir;
  }, []);

  // ファイル名を生成
  const generateOutputFileName = (
    baseName: string,
    index: number,
    side: "L" | "R",
    format: "psd" | "jpg"
  ): string => {
    const paddedIndex = String(index).padStart(3, "0");
    return `${baseName}_${paddedIndex}_${side}.${format}`;
  };

  // 単一ファイルを処理
  const processFile = useCallback(
    async (
      filePath: string,
      fileName: string,
      outputDir: string,
      fileIndex: number,
      settings: SplitSettings
    ): Promise<SplitResult> => {
      try {
        // PSDを読み込み
        const data = await readFile(filePath);
        const buffer = data.buffer;
        const psd = readPsd(new Uint8Array(buffer), {
          skipCompositeImageData: false,
          skipLayerImageData: false,
          skipThumbnail: true,
        });

        if (!psd.width || !psd.height) {
          return {
            fileName,
            success: false,
            outputFiles: [],
            error: "Invalid PSD dimensions",
          };
        }

        const outputFiles: string[] = [];
        const baseName = fileName.replace(/\.(psd|psb)$/i, "");

        if (settings.mode === "none") {
          // 分割なし - そのまま保存
          const outputPath = await join(
            outputDir,
            `${baseName}.${settings.outputFormat}`
          );
          const outputBuffer = writePsd(psd);
          await writeFile(outputPath, new Uint8Array(outputBuffer));
          outputFiles.push(outputPath);
        } else {
          // 分割ポイントを計算
          let splitPoint: number;

          if (settings.mode === "even") {
            // 均等分割
            splitPoint = Math.floor(psd.width / 2);
          } else {
            // 不均等分割（マージン考慮）
            splitPoint = Math.floor(psd.width / 2) + settings.leftMargin - settings.rightMargin;
          }

          // 分割実行
          const { left, right } = await splitPsd(psd, splitPoint);

          // 右ページを先に保存（漫画は右から左に読む）
          const rightFileName = generateOutputFileName(
            baseName,
            fileIndex * 2 + 1,
            "R",
            settings.outputFormat
          );
          const rightPath = await join(outputDir, rightFileName);
          const rightBuffer = writePsd(right);
          await writeFile(rightPath, new Uint8Array(rightBuffer));
          outputFiles.push(rightPath);

          // 左ページを保存
          const leftFileName = generateOutputFileName(
            baseName,
            fileIndex * 2 + 2,
            "L",
            settings.outputFormat
          );
          const leftPath = await join(outputDir, leftFileName);
          const leftBuffer = writePsd(left);
          await writeFile(leftPath, new Uint8Array(leftBuffer));
          outputFiles.push(leftPath);
        }

        return {
          fileName,
          success: true,
          outputFiles,
        };
      } catch (error) {
        return {
          fileName,
          success: false,
          outputFiles: [],
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    [splitPsd]
  );

  // 選択ファイルを一括処理
  const splitSelectedFiles = useCallback(async () => {
    const targetFiles =
      selectedFileIds.length > 0
        ? files.filter((f) => selectedFileIds.includes(f.id))
        : files;

    if (targetFiles.length === 0) return;

    setIsProcessing(true);
    clearResults();

    try {
      const outputDir = await prepareOutputDir(settings);

      for (let i = 0; i < targetFiles.length; i++) {
        const file = targetFiles[i];
        setCurrentFile(file.fileName);
        setProgress(i + 1, targetFiles.length);

        const result = await processFile(
          file.filePath,
          file.fileName,
          outputDir,
          i,
          settings
        );
        addResult(result);
      }
    } catch (error) {
      console.error("Split processing error:", error);
    } finally {
      setIsProcessing(false);
      setCurrentFile(null);
    }
  }, [
    files,
    selectedFileIds,
    settings,
    setIsProcessing,
    clearResults,
    prepareOutputDir,
    processFile,
    setCurrentFile,
    setProgress,
    addResult,
  ]);

  return {
    splitSelectedFiles,
  };
}
