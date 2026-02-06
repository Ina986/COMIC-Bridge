import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { usePsdStore } from "../store/psdStore";
import { useLayerStore, type HideCondition, type LayerControlResult } from "../store/layerStore";
import type { LayerNode } from "../types";

interface PhotoshopResult {
  filePath: string;
  success: boolean;
  changes: string[];
  error: string | null;
}

interface LayerCondition {
  type: string;
  value?: string;
  partialMatch?: boolean;
  caseSensitive?: boolean;
}

export function useLayerControl() {
  const files = usePsdStore((state) => state.files);
  const selectedFileIds = usePsdStore((state) => state.selectedFileIds);
  const updateFile = usePsdStore((state) => state.updateFile);
  const setIsProcessing = useLayerStore((state) => state.setIsProcessing);
  const getSelectedConditions = useLayerStore((state) => state.getSelectedConditions);
  const actionMode = useLayerStore((state) => state.actionMode);
  const setLastResults = useLayerStore((state) => state.setLastResults);

  // HideCondition を JSX スクリプトが理解できる形式に変換
  const conditionsToLayerConditions = useCallback(
    (conditions: HideCondition[]): LayerCondition[] => {
      return conditions.map((c) => ({
        type: c.type,
        value: c.value,
        partialMatch: c.partialMatch ?? false,
        caseSensitive: c.caseSensitive ?? false,
      }));
    },
    []
  );

  // Photoshop JSX スクリプト経由でレイヤー可視性を変更
  const applyLayerVisibility = useCallback(async () => {
    const conditions = getSelectedConditions();
    if (conditions.length === 0) return;

    const targetFiles = selectedFileIds.length > 0
      ? files.filter((f) => selectedFileIds.includes(f.id))
      : files;

    if (targetFiles.length === 0) return;

    setIsProcessing(true);

    try {
      const filePaths = targetFiles
        .filter((f) => f.metadata?.layerTree)
        .map((f) => f.filePath);

      if (filePaths.length === 0) {
        setIsProcessing(false);
        return;
      }

      const layerConditions = conditionsToLayerConditions(conditions);

      // Tauriコマンドを実行（Photoshop JSX経由）
      const psResults = await invoke<PhotoshopResult[]>(
        "run_photoshop_layer_visibility",
        {
          filePaths,
          conditions: layerConditions,
          mode: actionMode,
        }
      );

      const isHideMode = actionMode === "hide";
      const results: LayerControlResult[] = [];

      // 結果を処理してUIのレイヤーツリーを更新
      for (const psResult of psResults) {
        const normalizedPath = psResult.filePath.replace(/\//g, "\\");
        const file = targetFiles.find(
          (f) => f.filePath === psResult.filePath || f.filePath === normalizedPath
        );

        if (!file) continue;

        // changesからサマリー行の変更数を抽出（詳細行は "  → " で始まる）
        const summaryLine = psResult.changes.find((c: string) => !c.startsWith("  "));
        const changedMatch = summaryLine ? summaryLine.match(/(\d+) layer/) : null;
        const changedCount = changedMatch ? parseInt(changedMatch[1], 10) : 0;

        results.push({
          fileName: file.fileName,
          success: psResult.success,
          changedCount,
          changes: psResult.changes,
          error: psResult.error || undefined,
        });

        // 成功した場合、メタデータのレイヤーツリーを更新（UI反映）
        if (psResult.success && file.metadata && changedCount > 0) {
          // レイヤーツリーを条件に基づいて更新
          const updatedLayerTree = updateLayerTreeByConditions(
            file.metadata.layerTree,
            conditions,
            !isHideMode // showの場合はvisible=true
          );
          updateFile(file.id, {
            metadata: {
              ...file.metadata,
              layerTree: updatedLayerTree,
            },
          });
        }
      }

      // Store results for toast display
      setLastResults(results, actionMode);

      return results;
    } catch (error) {
      console.error("Layer visibility change failed:", error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [
    files,
    selectedFileIds,
    actionMode,
    getSelectedConditions,
    conditionsToLayerConditions,
    setIsProcessing,
    setLastResults,
    updateFile,
  ]);

  return {
    applyLayerVisibility,
  };
}

// テキストフォルダ名のパターン
const TEXT_FOLDER_PATTERNS = ["text", "写植", "セリフ", "テキスト", "セリフ層"];

// 条件に基づいてレイヤーツリーの可視性を更新するヘルパー
function updateLayerTreeByConditions(
  layers: LayerNode[],
  conditions: HideCondition[],
  setVisible: boolean,
  parentIsTextFolder = false
): LayerNode[] {
  return layers.map((layer) => {
    const isTextFolder =
      layer.type === "group" &&
      TEXT_FOLDER_PATTERNS.some((p) =>
        layer.name.toLowerCase() === p.toLowerCase()
      );

    const matches = conditions.some((cond) =>
      matchesCondition(layer, cond, parentIsTextFolder)
    );

    const updatedLayer: LayerNode = {
      ...layer,
      visible: matches ? setVisible : layer.visible,
    };

    if (layer.children && layer.children.length > 0) {
      updatedLayer.children = updateLayerTreeByConditions(
        layer.children,
        conditions,
        setVisible,
        parentIsTextFolder || isTextFolder
      );
    }

    return updatedLayer;
  });
}

function matchesCondition(
  layer: LayerNode,
  condition: HideCondition,
  parentIsTextFolder: boolean
): boolean {
  switch (condition.type) {
    case "textLayers":
      return layer.type === "text";

    case "textFolder":
      if (layer.type === "group") {
        return TEXT_FOLDER_PATTERNS.some(
          (p) => layer.name.toLowerCase() === p.toLowerCase()
        );
      }
      return parentIsTextFolder;

    case "layerName":
    case "folderName":
    case "custom":
      if (!condition.value) return false;
      const searchValue = condition.caseSensitive
        ? condition.value
        : condition.value.toLowerCase();
      const layerName = condition.caseSensitive
        ? layer.name
        : layer.name.toLowerCase();

      if (condition.partialMatch) {
        return layerName.includes(searchValue);
      }
      return layerName === searchValue;

    default:
      return false;
  }
}
