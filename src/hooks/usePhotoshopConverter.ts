import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { usePsdStore } from "../store/psdStore";
import { useSpecStore, type ConversionResult } from "../store/specStore";

// Rust command types
interface PhotoshopConversionOptions {
  target_dpi: number | null;
  target_color_mode: string | null;
  target_bit_depth: number | null;
  remove_hidden_layers: boolean;
  remove_alpha_channels: boolean;
}

interface PhotoshopFileSettings {
  path: string;
  needs_dpi_change: boolean;
  needs_color_mode_change: boolean;
  needs_bit_depth_change: boolean;
  needs_alpha_removal: boolean;
}

interface PhotoshopConversionSettings {
  files: PhotoshopFileSettings[];
  options: PhotoshopConversionOptions;
  outputPath: string;
}

interface PhotoshopResult {
  filePath: string;
  success: boolean;
  changes: string[];
  error: string | null;
}

interface PhotoshopStatus {
  installed: boolean;
  path: string | null;
}

export function usePhotoshopConverter() {
  const [isPhotoshopInstalled, setIsPhotoshopInstalled] = useState<boolean | null>(null);
  const [photoshopPath, setPhotoshopPath] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  const files = usePsdStore((state) => state.files);
  const updateFile = usePsdStore((state) => state.updateFile);

  const checkResults = useSpecStore((state) => state.checkResults);
  const conversionSettings = useSpecStore((state) => state.conversionSettings);
  const addConversionResult = useSpecStore((state) => state.addConversionResult);
  const clearConversionResults = useSpecStore((state) => state.clearConversionResults);

  // Check if Photoshop is installed on mount
  useEffect(() => {
    const checkPhotoshop = async () => {
      try {
        const status = await invoke<PhotoshopStatus>("check_photoshop_installed");
        setIsPhotoshopInstalled(status.installed);
        setPhotoshopPath(status.path);
      } catch (error) {
        console.error("Failed to check Photoshop:", error);
        setIsPhotoshopInstalled(false);
      }
    };
    checkPhotoshop();
  }, []);

  // Convert NG files using Photoshop
  const convertWithPhotoshop = useCallback(async () => {
    if (!isPhotoshopInstalled) {
      console.error("Photoshop is not installed");
      return;
    }

    // Get NG files
    const ngFiles = files.filter((file) => {
      const result = checkResults.get(file.id);
      return result && !result.passed;
    });

    if (ngFiles.length === 0) {
      console.log("No NG files to convert");
      return;
    }

    setIsConverting(true);
    clearConversionResults();

    try {
      // Build file settings based on what each file needs
      const fileSettings: PhotoshopFileSettings[] = ngFiles.map((file) => {
        const result = checkResults.get(file.id);
        const failedChecks = result?.results.filter((r) => !r.passed) ?? [];

        return {
          path: file.filePath,
          needs_dpi_change: failedChecks.some((r) => r.rule.type === "dpi"),
          needs_color_mode_change: failedChecks.some((r) => r.rule.type === "colorMode"),
          needs_bit_depth_change: failedChecks.some((r) => r.rule.type === "bitsPerChannel"),
          needs_alpha_removal: failedChecks.some((r) => r.rule.type === "hasAlphaChannels"),
        };
      });

      // Build conversion options
      const options: PhotoshopConversionOptions = {
        target_dpi: conversionSettings.targetDpi,
        target_color_mode: conversionSettings.targetColorMode,
        target_bit_depth: conversionSettings.targetBitDepth,
        remove_hidden_layers: false, // 現在は使用しない
        remove_alpha_channels: true, // αチャンネル削除は常に有効
      };

      const settings: PhotoshopConversionSettings = {
        files: fileSettings,
        options,
        outputPath: "", // Will be set by Rust
      };

      // Call Rust to run Photoshop
      const results = await invoke<PhotoshopResult[]>("run_photoshop_conversion", {
        settings,
      });

      // Process results
      for (const result of results) {
        // Find the file
        const file = ngFiles.find((f) => f.filePath === result.filePath);
        if (!file) continue;

        const conversionResult: ConversionResult = {
          fileId: file.id,
          fileName: file.fileName,
          success: result.success,
          changes: result.changes,
          error: result.error ?? undefined,
        };

        addConversionResult(conversionResult);

        // Update file metadata if successful
        if (result.success && result.changes.length > 0 && !result.changes.includes("No changes needed")) {
          if (file.metadata) {
            const updates: Record<string, unknown> = {};

            if (conversionSettings.targetBitDepth !== null) {
              updates.bitsPerChannel = conversionSettings.targetBitDepth;
            }
            if (conversionSettings.targetColorMode !== null) {
              updates.colorMode = conversionSettings.targetColorMode;
            }
            if (conversionSettings.targetDpi !== null) {
              updates.dpi = conversionSettings.targetDpi;
            }

            // αチャンネル削除された場合
            if (result.changes.some((c) => c.includes("alpha") || c.includes("チャンネル"))) {
              updates.hasAlphaChannels = false;
              updates.alphaChannelCount = 0;
              updates.alphaChannelNames = [];
            }

            updateFile(file.id, {
              metadata: {
                ...file.metadata,
                ...updates,
              },
            });
          }
        }
      }
    } catch (error) {
      console.error("Photoshop conversion failed:", error);
      // Add error result for all files
      for (const file of ngFiles) {
        addConversionResult({
          fileId: file.id,
          fileName: file.fileName,
          success: false,
          changes: [],
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } finally {
      setIsConverting(false);
    }
  }, [
    isPhotoshopInstalled,
    files,
    checkResults,
    conversionSettings,
    clearConversionResults,
    addConversionResult,
    updateFile,
  ]);

  return {
    isPhotoshopInstalled,
    photoshopPath,
    isConverting,
    convertWithPhotoshop,
  };
}
