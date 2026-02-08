import { useMemo } from "react";
import { usePsdStore } from "../store/psdStore";

export interface CanvasSizeInfo {
  majoritySize: string | null;
  majorityWidth: number;
  majorityHeight: number;
  outlierFileIds: Set<string>;
  sizeGroups: Map<string, string[]>;
  totalChecked: number;
}

/**
 * 全ファイルのキャンバスサイズを比較し、多数派と異なる外れ値を検出するhook
 */
export function useCanvasSizeCheck(): CanvasSizeInfo {
  const files = usePsdStore((state) => state.files);

  return useMemo(() => {
    const sizeGroups = new Map<string, string[]>();
    let totalChecked = 0;

    for (const file of files) {
      if (!file.metadata) continue;
      totalChecked++;
      const key = `${file.metadata.width}×${file.metadata.height}`;
      const group = sizeGroups.get(key) || [];
      group.push(file.id);
      sizeGroups.set(key, group);
    }

    if (sizeGroups.size <= 1) {
      const majoritySize = sizeGroups.size === 1 ? [...sizeGroups.keys()][0] : null;
      return {
        majoritySize,
        majorityWidth: 0,
        majorityHeight: 0,
        outlierFileIds: new Set<string>(),
        sizeGroups,
        totalChecked,
      };
    }

    // 最も件数が多いサイズを多数派として特定
    let maxCount = 0;
    let majoritySize: string | null = null;
    for (const [size, ids] of sizeGroups) {
      if (ids.length > maxCount) {
        maxCount = ids.length;
        majoritySize = size;
      }
    }

    const outlierFileIds = new Set<string>();
    for (const [size, ids] of sizeGroups) {
      if (size !== majoritySize) {
        ids.forEach((id) => outlierFileIds.add(id));
      }
    }

    const [mw, mh] = (majoritySize || "0×0").split("×").map(Number);

    return {
      majoritySize,
      majorityWidth: mw,
      majorityHeight: mh,
      outlierFileIds,
      sizeGroups,
      totalChecked,
    };
  }, [files]);
}
