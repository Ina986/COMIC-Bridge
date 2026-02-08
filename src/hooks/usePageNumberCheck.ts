import { useMemo } from "react";
import { usePsdStore } from "../store/psdStore";

export interface PageNumberCheckResult {
  pageNumbers: Map<string, number | null>;
  missingNumbers: number[];
  pageRange: [number, number] | null;
  hasGaps: boolean;
}

/**
 * ファイル名から連番を抽出し、欠番を検出するhook
 */
export function usePageNumberCheck(): PageNumberCheckResult {
  const files = usePsdStore((state) => state.files);

  return useMemo(() => {
    const pageNumbers = new Map<string, number | null>();
    const extractedNumbers: number[] = [];

    for (const file of files) {
      const num = extractPageNumber(file.fileName);
      pageNumbers.set(file.id, num);
      if (num !== null) {
        extractedNumbers.push(num);
      }
    }

    if (extractedNumbers.length < 2) {
      return {
        pageNumbers,
        missingNumbers: [],
        pageRange: null,
        hasGaps: false,
      };
    }

    extractedNumbers.sort((a, b) => a - b);
    const min = extractedNumbers[0];
    const max = extractedNumbers[extractedNumbers.length - 1];
    const numberSet = new Set(extractedNumbers);

    const missingNumbers: number[] = [];
    for (let i = min; i <= max; i++) {
      if (!numberSet.has(i)) {
        missingNumbers.push(i);
      }
    }

    return {
      pageNumbers,
      missingNumbers,
      pageRange: [min, max],
      hasGaps: missingNumbers.length > 0,
    };
  }, [files]);
}

/**
 * ファイル名からページ番号を抽出
 * 拡張子直前の最後の連続数字を優先的に取得
 * 例: "タイトル_003.psd" → 3, "p12_仕上げ.psd" → 12
 */
function extractPageNumber(fileName: string): number | null {
  // 拡張子を除去
  const nameWithoutExt = fileName.replace(/\.[^.]+$/, "");
  // 最後の連続数字を抽出
  const match = nameWithoutExt.match(/(\d+)(?=[^\d]*$)/);
  if (!match) return null;
  return parseInt(match[1], 10);
}
