import { useCallback } from "react";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import { readPsd, writePsd, type Layer } from "ag-psd";
import { usePsdStore } from "../store/psdStore";
import { useLayerStore, type HideCondition, type LayerActionMode } from "../store/layerStore";
import type { LayerNode } from "../types";

// テキストフォルダ名のパターン
const TEXT_FOLDER_PATTERNS = ["text", "写植", "セリフ", "テキスト", "セリフ層"];

export function useLayerControl() {
  const files = usePsdStore((state) => state.files);
  const selectedFileIds = usePsdStore((state) => state.selectedFileIds);
  const updateFile = usePsdStore((state) => state.updateFile);
  const setIsProcessing = useLayerStore((state) => state.setIsProcessing);
  const getSelectedConditions = useLayerStore((state) => state.getSelectedConditions);
  const actionMode = useLayerStore((state) => state.actionMode);

  // レイヤーが条件に一致するかチェック
  const matchesCondition = useCallback(
    (layer: LayerNode, condition: HideCondition, parentIsTextFolder = false): boolean => {
      switch (condition.type) {
        case "textLayers":
          return layer.type === "text";

        case "textFolder":
          // テキストフォルダ内のレイヤー、またはテキストフォルダ自体
          if (layer.type === "group") {
            const lowerName = layer.name.toLowerCase();
            return TEXT_FOLDER_PATTERNS.some((pattern) =>
              lowerName.includes(pattern.toLowerCase())
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
    },
    []
  );

  // レイヤーツリーを走査して条件に一致するレイヤーのパスを収集
  // mode: "hide" = 表示中のレイヤーを収集, "show" = 非表示のレイヤーを収集
  const collectMatchingLayers = useCallback(
    (
      layers: LayerNode[],
      conditions: HideCondition[],
      mode: LayerActionMode = "hide",
      path: string[] = [],
      parentIsTextFolder = false
    ): string[] => {
      const matchingPaths: string[] = [];

      for (const layer of layers) {
        const currentPath = [...path, layer.name];
        const pathStr = currentPath.join("/");

        // このレイヤーがテキストフォルダかどうか
        const isTextFolder =
          layer.type === "group" &&
          TEXT_FOLDER_PATTERNS.some((pattern) =>
            layer.name.toLowerCase().includes(pattern.toLowerCase())
          );

        // 条件に一致するかチェック
        const matches = conditions.some((condition) =>
          matchesCondition(layer, condition, parentIsTextFolder)
        );

        // モードに応じて可視性をチェック
        const visibilityMatches = mode === "hide" ? layer.visible : !layer.visible;

        if (matches && visibilityMatches) {
          matchingPaths.push(pathStr);
        }

        // 子レイヤーを再帰的にチェック
        if (layer.children && layer.children.length > 0) {
          const childMatches = collectMatchingLayers(
            layer.children,
            conditions,
            mode,
            currentPath,
            isTextFolder || parentIsTextFolder
          );
          matchingPaths.push(...childMatches);
        }
      }

      return matchingPaths;
    },
    [matchesCondition]
  );

  // PSDファイルのレイヤー可視性を変更して保存
  // setHidden: true = 非表示にする, false = 表示する
  const applyVisibilityChanges = useCallback(
    async (
      filePath: string,
      layerPaths: string[],
      setHidden: boolean = true
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        // ファイルを読み込み
        const data = await readFile(filePath);
        const buffer = data.buffer;
        const psd = readPsd(new Uint8Array(buffer), {
          skipCompositeImageData: true,
          skipLayerImageData: true,
          skipThumbnail: true,
        });

        if (!psd.children) {
          return { success: false, error: "レイヤーが見つかりません" };
        }

        // レイヤー可視性を変更
        const updateLayerVisibility = (
          layers: Layer[],
          targetPaths: Set<string>,
          currentPath: string[] = []
        ) => {
          for (const layer of layers) {
            const layerPath = [...currentPath, layer.name || ""].join("/");

            if (targetPaths.has(layerPath)) {
              layer.hidden = setHidden;
            }

            if (layer.children && layer.children.length > 0) {
              updateLayerVisibility(
                layer.children,
                targetPaths,
                [...currentPath, layer.name || ""]
              );
            }
          }
        };

        const pathsSet = new Set(layerPaths);
        updateLayerVisibility(psd.children, pathsSet);

        // 保存
        const outputBuffer = writePsd(psd);
        await writeFile(filePath, new Uint8Array(outputBuffer));

        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    []
  );

  // 選択したファイルに対して表示/非表示処理を実行
  const applyLayerVisibility = useCallback(async () => {
    const conditions = getSelectedConditions();
    if (conditions.length === 0) return;

    const targetFiles = selectedFileIds.length > 0
      ? files.filter((f) => selectedFileIds.includes(f.id))
      : files;

    if (targetFiles.length === 0) return;

    setIsProcessing(true);

    const isHideMode = actionMode === "hide";
    const results: { fileName: string; success: boolean; changedCount: number; error?: string }[] = [];

    for (const file of targetFiles) {
      if (!file.metadata?.layerTree) continue;

      // 条件に一致するレイヤーを収集
      const layersToChange = collectMatchingLayers(
        file.metadata.layerTree,
        conditions,
        actionMode
      );

      if (layersToChange.length === 0) {
        results.push({
          fileName: file.fileName,
          success: true,
          changedCount: 0,
        });
        continue;
      }

      // 可視性変更処理を実行
      const result = await applyVisibilityChanges(file.filePath, layersToChange, isHideMode);

      results.push({
        fileName: file.fileName,
        success: result.success,
        changedCount: result.success ? layersToChange.length : 0,
        error: result.error,
      });

      // 成功した場合、ファイルのメタデータを更新（レイヤー可視性を反映）
      if (result.success && file.metadata) {
        const updatedLayerTree = updateLayerTreeVisibility(
          file.metadata.layerTree,
          new Set(layersToChange),
          !isHideMode // showの場合はvisible = true
        );
        updateFile(file.id, {
          metadata: {
            ...file.metadata,
            layerTree: updatedLayerTree,
          },
        });
      }
    }

    setIsProcessing(false);
    return results;
  }, [
    files,
    selectedFileIds,
    actionMode,
    getSelectedConditions,
    collectMatchingLayers,
    applyVisibilityChanges,
    setIsProcessing,
    updateFile,
  ]);

  // 後方互換性のためのエイリアス
  const hideLayersInSelectedFiles = applyLayerVisibility;

  return {
    applyLayerVisibility,
    hideLayersInSelectedFiles,
    collectMatchingLayers,
  };
}

// レイヤーツリーの可視性を更新するヘルパー
// setVisible: true = 表示に変更, false = 非表示に変更
function updateLayerTreeVisibility(
  layers: LayerNode[],
  targetPaths: Set<string>,
  setVisible: boolean = false,
  currentPath: string[] = []
): LayerNode[] {
  return layers.map((layer) => {
    const layerPath = [...currentPath, layer.name].join("/");
    const isTarget = targetPaths.has(layerPath);

    const updatedLayer: LayerNode = {
      ...layer,
      visible: isTarget ? setVisible : layer.visible,
    };

    if (layer.children && layer.children.length > 0) {
      updatedLayer.children = updateLayerTreeVisibility(
        layer.children,
        targetPaths,
        setVisible,
        [...currentPath, layer.name]
      );
    }

    return updatedLayer;
  });
}
