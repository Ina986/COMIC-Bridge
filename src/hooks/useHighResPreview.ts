import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";

interface HighResPreviewResult {
  file_path: string;
  original_width: number;
  original_height: number;
  preview_width: number;
  preview_height: number;
}

interface UseHighResPreviewOptions {
  maxSize?: number;
  enabled?: boolean;
  pdfPageIndex?: number;
  pdfSourcePath?: string;
}

interface UseHighResPreviewReturn {
  imageUrl: string | null;
  originalSize: { width: number; height: number } | null;
  previewSize: { width: number; height: number } | null;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * High-resolution preview hook for the guide editor.
 * Loads a high-quality preview image from Rust backend.
 * Supports both PSD/image files and PDF pages.
 *
 * @param filePath - Path to the file
 * @param options - Configuration options (including optional PDF page info)
 * @returns Preview state and controls
 */
export function useHighResPreview(
  filePath: string | undefined,
  options: UseHighResPreviewOptions = {}
): UseHighResPreviewReturn {
  const { maxSize = 1200, enabled = true, pdfPageIndex, pdfSourcePath } = options;

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [originalSize, setOriginalSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [previewSize, setPreviewSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPreview = useCallback(async () => {
    if (!filePath || !enabled) {
      setImageUrl(null);
      setOriginalSize(null);
      setPreviewSize(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let result: HighResPreviewResult;

      if (pdfPageIndex !== undefined && pdfSourcePath) {
        // PDF page preview
        result = await invoke<HighResPreviewResult>("get_pdf_preview", {
          filePath: pdfSourcePath,
          pageIndex: pdfPageIndex,
          maxSize,
        });
      } else {
        // PSD/image preview
        result = await invoke<HighResPreviewResult>("get_high_res_preview", {
          filePath,
          maxSize,
        });
      }

      // Convert file path to asset:// URL for display
      const assetUrl = convertFileSrc(result.file_path);

      setImageUrl(assetUrl);
      setOriginalSize({
        width: result.original_width,
        height: result.original_height,
      });
      setPreviewSize({
        width: result.preview_width,
        height: result.preview_height,
      });
    } catch (err) {
      console.error("Failed to load high-res preview:", err);
      setError(err instanceof Error ? err.message : String(err));
      setImageUrl(null);
      setOriginalSize(null);
      setPreviewSize(null);
    } finally {
      setIsLoading(false);
    }
  }, [filePath, maxSize, enabled, pdfPageIndex, pdfSourcePath]);

  // Load preview when filePath changes
  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  // Cleanup old preview files periodically
  useEffect(() => {
    const cleanup = async () => {
      try {
        await invoke("cleanup_preview_files");
      } catch (err) {
        console.warn("Failed to cleanup preview files:", err);
      }
    };

    // Cleanup on mount
    cleanup();

    // Cleanup every 30 minutes
    const interval = setInterval(cleanup, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    imageUrl,
    originalSize,
    previewSize,
    isLoading,
    error,
    reload: loadPreview,
  };
}
