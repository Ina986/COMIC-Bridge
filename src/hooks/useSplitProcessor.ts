import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { join, desktopDir } from "@tauri-apps/api/path";
import { usePsdStore } from "../store/psdStore";
import { useSplitStore, type SplitResult } from "../store/splitStore";

interface PhotoshopResult {
  filePath: string;
  success: boolean;
  changes: string[];
  error: string | null;
}

export function useSplitProcessor() {
  const files = usePsdStore((state) => state.files);
  const selectedFileIds = usePsdStore((state) => state.selectedFileIds);
  const settings = useSplitStore((state) => state.settings);
  const setIsProcessing = useSplitStore((state) => state.setIsProcessing);
  const setProgress = useSplitStore((state) => state.setProgress);
  const setCurrentFile = useSplitStore((state) => state.setCurrentFile);
  const addResult = useSplitStore((state) => state.addResult);
  const clearResults = useSplitStore((state) => state.clearResults);

  // 出力ディレクトリを準備
  const getOutputDir = useCallback(async (): Promise<string> => {
    if (settings.outputDirectory) {
      return settings.outputDirectory;
    }
    const desktop = await desktopDir();
    return await join(desktop, "manga-psd-output", "split");
  }, [settings.outputDirectory]);

  // 選択ファイルを一括処理（Photoshop JSX経由）
  const splitSelectedFiles = useCallback(async () => {
    const targetFiles =
      selectedFileIds.length > 0
        ? files.filter((f) => selectedFileIds.includes(f.id))
        : files;

    if (targetFiles.length === 0) return;

    setIsProcessing(true);
    clearResults();
    setProgress(0, targetFiles.length);

    try {
      const outputDir = await getOutputDir();
      const filePaths = targetFiles.map((f) => f.filePath);

      setCurrentFile("Photoshopで処理中...");

      // Tauriコマンドを実行（全ファイル一括）
      const psResults = await invoke<PhotoshopResult[]>(
        "run_photoshop_split",
        {
          filePaths,
          mode: settings.mode,
          outputFormat: settings.outputFormat,
          jpgQuality: settings.outputFormat === "jpg"
            ? Math.round((settings.jpgQuality / 100) * 12)
            : 12,
          outerMargin: settings.outerMargin,
          deleteHiddenLayers: settings.deleteHiddenLayers,
          deleteOffCanvasText: settings.deleteOffCanvasText,
          outputDir,
        }
      );

      // 結果を処理
      for (let i = 0; i < psResults.length; i++) {
        const psResult = psResults[i];
        const normalizedPath = psResult.filePath.replace(/\//g, "\\");
        const file = targetFiles.find(
          (f) => f.filePath === psResult.filePath || f.filePath === normalizedPath
        );

        const result: SplitResult = {
          fileName: file?.fileName || psResult.filePath.split("/").pop() || "unknown",
          success: psResult.success,
          outputFiles: psResult.changes || [],
          error: psResult.error || undefined,
        };
        addResult(result);
        setProgress(i + 1, psResults.length);
      }
    } catch (error) {
      console.error("Split processing error:", error);
      addResult({
        fileName: "Error",
        success: false,
        outputFiles: [],
        error: error instanceof Error ? error.message : "Photoshopの実行に失敗しました",
      });
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
    getOutputDir,
    setCurrentFile,
    setProgress,
    addResult,
  ]);

  return {
    splitSelectedFiles,
  };
}
