import type { LayerNode } from "../types";
import type { HideCondition } from "../store/layerStore";

export const TEXT_FOLDER_PATTERNS = ["text", "写植", "セリフ", "テキスト", "セリフ層"];

export type MatchRisk = "safe" | "warning" | "none";

export interface LayerMatchStatus {
  matched: boolean;
  risk: MatchRisk;
}

export function isTextFolder(layer: LayerNode): boolean {
  return (
    layer.type === "group" &&
    TEXT_FOLDER_PATTERNS.some(
      (p) => layer.name.toLowerCase() === p.toLowerCase()
    )
  );
}

export function matchesCondition(
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
    case "custom": {
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
    }

    default:
      return false;
  }
}

/**
 * レイヤーのマッチ状態とリスクを分類する。
 *
 * - safe: テキストレイヤー、テキストフォルダグループ等、型で明確に判別可能
 * - warning: テキストフォルダ内のラスタライズレイヤー → フキダシや描画の可能性
 * - none: どの条件にもマッチしない
 */
export function classifyLayerRisk(
  layer: LayerNode,
  conditions: HideCondition[],
  parentIsTextFolder: boolean
): LayerMatchStatus {
  const matched = conditions.some((cond) =>
    matchesCondition(layer, cond, parentIsTextFolder)
  );

  if (!matched) {
    return { matched: false, risk: "none" };
  }

  // テキストレイヤーは明確に安全
  if (layer.type === "text") {
    return { matched: true, risk: "safe" };
  }

  // テキストフォルダグループ自体は安全
  if (layer.type === "group" && isTextFolder(layer)) {
    return { matched: true, risk: "safe" };
  }

  // テキストフォルダ内のラスタライズレイヤー → フキダシ・描画の可能性
  if (layer.type === "layer" && parentIsTextFolder) {
    return { matched: true, risk: "warning" };
  }

  // adjustment/smartObject/shape は型で判別可能
  return { matched: true, risk: "safe" };
}
