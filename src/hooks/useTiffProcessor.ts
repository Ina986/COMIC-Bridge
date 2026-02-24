import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { join, desktopDir } from "@tauri-apps/api/path";
import { usePsdStore } from "../store/psdStore";
import { useTiffStore } from "../store/tiffStore";
import type { TiffResult, TiffFileOverride } from "../types/tiff";
import type { PsdFile } from "../types";

interface TiffConvertResult {
  fileName: string;
  success: boolean;
  outputPath: string | null;
  error: string | null;
}

interface TiffConvertResponse {
  results: TiffConvertResult[];
  outputDir: string;
  jpgOutputDir: string | null;
}

export function useTiffProcessor() {

  // 出力ディレクトリを準備
  const getOutputDir = useCallback(async (): Promise<string> => {
    const settings = useTiffStore.getState().settings;
    if (settings.output.outputDirectory) {
      return settings.output.outputDirectory;
    }
    const desktop = await desktopDir();
    // JPGのみ（TIFF OFF）の場合は JPG_Output
    const folderName = !settings.output.proceedAsTiff && settings.output.outputJpg
      ? "JPG_Output" : "TIF_Output";
    return await join(desktop, "Script_Output", folderName);
  }, []);

  // ファイル毎の最終設定をマージして設定JSONを構築
  const buildSettingsJson = useCallback(async (targetFiles: PsdFile[]) => {
    const store = useTiffStore.getState();
    const settings = store.settings;
    const fileOverrides = store.fileOverrides;
    const outputDir = await getOutputDir();
    const flatten = settings.rename.flattenSubfolders;

    // サブフォルダ別インデックスを事前計算（flatten=false時に各サブフォルダで連番リセット）
    const subfolderIndices: number[] = [];
    if (!flatten) {
      const counters = new Map<string, number>();
      for (const file of targetFiles) {
        const key = file.subfolderName || "";
        const idx = counters.get(key) ?? 0;
        subfolderIndices.push(idx);
        counters.set(key, idx + 1);
      }
    }

    const files = targetFiles.map((file, index) => {
      const override: TiffFileOverride | undefined = fileOverrides.get(file.id);
      const skip = override?.skip ?? false;

      // flatten=false時はサブフォルダ内インデックス、flatten=true時はグローバルインデックス
      const fileIndex = flatten ? index : subfolderIndices[index];

      // カラーモード解決
      let colorMode: string = settings.colorMode;
      if (settings.colorMode === "perPage") {
        const pageNum = fileIndex + 1;
        const matched = settings.pageRangeRules.find(
          (r) => pageNum >= r.fromPage && pageNum <= r.toPage
        );
        colorMode = matched?.colorMode ?? settings.defaultColorForPerPage;
      }
      if (override?.colorMode && override.colorMode !== "perPage") {
        colorMode = override.colorMode;
      }

      // ぼかし解決
      const applyBlur = override?.blurEnabled ?? settings.blur.enabled;
      const blurRadius = override?.blurRadius ?? settings.blur.radius;

      // 部分ぼかし
      const pageNum = fileIndex + 1;
      const partialBlurEntry = settings.partialBlurEntries.find((e) => e.pageNumber === pageNum);

      // リネーム解決
      // 拡張子: TIFF ON → .tif、JPGのみ → .jpg、PSD → .psd
      const ext = settings.output.proceedAsTiff ? ".tif"
        : settings.output.outputJpg ? ".jpg" : ".psd";
      let outputName: string;
      if (settings.rename.keepOriginalName) {
        const baseName = file.fileName.replace(/\.[^.]+$/, "");
        outputName = baseName + ext;
      } else if (settings.rename.extractPageNumber) {
        const match = file.fileName.match(/(\d+)\s*\.[^.]+$/);
        const extractedNum = match ? parseInt(match[1]) : fileIndex + 1;
        const num = extractedNum + (settings.rename.startNumber - 1);
        outputName = String(num).padStart(settings.rename.padding, "0") + ext;
      } else {
        const num = fileIndex + settings.rename.startNumber;
        outputName = String(num).padStart(settings.rename.padding, "0") + ext;
      }

      // サブフォルダ出力パス解決
      // flatten=false && subfolderNameあり → outputDir/subfolderName/
      // flatten=true または subfolderNameなし → outputDir/
      let fileOutputDir = outputDir;
      if (!flatten && file.subfolderName) {
        fileOutputDir = outputDir + "/" + file.subfolderName;
      }

      // TIFF+JPG同時出力時: JPG出力先を計算（TIF_Outputの兄弟にJPG_Output）
      let jpgOutputPath: string | null = null;
      if (settings.output.proceedAsTiff && settings.output.outputJpg) {
        const jpgBaseDir = outputDir.replace(/TIF_Output/g, "JPG_Output");
        let jpgFileDir = jpgBaseDir;
        if (!flatten && file.subfolderName) {
          jpgFileDir = jpgBaseDir + "/" + file.subfolderName;
        }
        jpgOutputPath = jpgFileDir.replace(/\\/g, "/");
      }

      return {
        path: file.filePath.replace(/\\/g, "/"),
        outputPath: fileOutputDir.replace(/\\/g, "/"),
        outputName,
        colorMode,
        applyBlur: applyBlur && colorMode === "mono", // ぼかしはモノクロ時のみ
        blurRadius,
        partialBlur: partialBlurEntry
          ? {
              blurRadius: partialBlurEntry.blurRadius,
              bounds: settings.crop.bounds,
            }
          : null,
        skipCrop: skip || !settings.crop.enabled,
        cropBounds: settings.crop.bounds,
        psbConvert: settings.psbConvertToTiff,
        subfolderName: file.subfolderName || "",
        jpgOutputPath,
      };
    });

    // スキップされたファイルを除外
    const activeFiles = files.filter((_, i) => {
      const override = fileOverrides.get(targetFiles[i].id);
      return !(override?.skip);
    });

    const settingsJson = JSON.stringify({
      files: activeFiles,
      globalSettings: {
        targetWidth: settings.resize.targetWidth,
        targetHeight: settings.resize.targetHeight,
        aspectRatio: [settings.crop.aspectRatio.w, settings.crop.aspectRatio.h],
        reorganizeText: settings.text.reorganize,
        proceedAsTiff: settings.output.proceedAsTiff,
        outputJpg: settings.output.outputJpg,
        saveIntermediatePsd: settings.output.saveIntermediatePsd,
        mergeAfterColor: settings.output.mergeAfterColorConvert,
      },
    }, null, 2);

    // TIFF+JPG同時出力時のJPG出力先ベースディレクトリ
    const jpgOutputDir = settings.output.proceedAsTiff && settings.output.outputJpg
      ? outputDir.replace(/TIF_Output/g, "JPG_Output")
      : null;

    return { settingsJson, outputDir, jpgOutputDir, activeCount: activeFiles.length };
  }, [getOutputDir]);

  // 共通処理実行
  const processFiles = useCallback(async (targetFiles: PsdFile[]) => {
    if (targetFiles.length === 0) return;

    const store = useTiffStore.getState();
    const { settings } = store;

    // クロップ有効だが範囲未設定の場合は実行を阻止
    if (settings.crop.enabled && !settings.crop.bounds) {
      alert("クロップ範囲が設定されていません。\nクロップエディタで範囲を設定してください。");
      return;
    }

    store.setIsProcessing(true);
    store.clearResults();
    store.setProgress(0, targetFiles.length);
    store.setProcessingDuration(null);
    const startTime = Date.now();

    try {
      const { settingsJson, outputDir, jpgOutputDir, activeCount } = await buildSettingsJson(targetFiles);

      if (activeCount === 0) {
        store.setIsProcessing(false);
        return;
      }

      store.setCurrentFile("Photoshopで処理中...");

      const response = await invoke<TiffConvertResponse>("run_photoshop_tiff_convert", {
        settingsJson,
        outputDir,
        jpgOutputDir: jpgOutputDir ?? "",
      });

      // 結果を処理
      for (const r of response.results) {
        const result: TiffResult = {
          fileName: r.fileName,
          success: r.success,
          outputPath: r.outputPath ?? undefined,
          error: r.error ?? undefined,
        };
        store.addResult(result);
      }

      store.setLastOutputDir(response.outputDir);
      store.setLastJpgOutputDir(response.jpgOutputDir ?? null);
      store.setProcessingDuration(Date.now() - startTime);
      store.setProgress(response.results.length, response.results.length);
      store.setShowResultDialog(true);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      store.addResult({
        fileName: "処理エラー",
        success: false,
        error: errorMsg,
      });
      store.setProcessingDuration(Date.now() - startTime);
      store.setShowResultDialog(true);
    } finally {
      store.setIsProcessing(false);
      store.setCurrentFile(null);
    }
  }, [buildSettingsJson]);

  const convertSelectedFiles = useCallback(async () => {
    const files = usePsdStore.getState().files;
    const selectedIds = usePsdStore.getState().selectedFileIds;
    const selected = files.filter((f) => selectedIds.includes(f.id));
    await processFiles(selected);
  }, [processFiles]);

  const convertAllFiles = useCallback(async () => {
    const files = usePsdStore.getState().files;
    await processFiles(files);
  }, [processFiles]);

  return { convertSelectedFiles, convertAllFiles };
}
