import { useState, useCallback } from "react";
import { usePsdStore } from "../store/psdStore";
import { useSpecStore } from "../store/specStore";
import type { Specification, SpecCheckResult, SpecRule, PsdMetadata } from "../types";

export function useSpecChecker() {
  const [isChecking, setIsChecking] = useState(false);

  const files = usePsdStore((state) => state.files);
  const setCheckResult = useSpecStore((state) => state.setCheckResult);
  const clearCheckResults = useSpecStore((state) => state.clearCheckResults);

  const checkFile = useCallback(
    (fileId: string, metadata: PsdMetadata, specs: Specification[]): SpecCheckResult => {
      // 各仕様ごとにチェックし、いずれか1つに合格すればOK
      let bestMatch: { spec: Specification; results: SpecCheckResult["results"]; allPassed: boolean } | null = null;

      for (const spec of specs) {
        if (!spec.enabled) continue;

        const specResults: SpecCheckResult["results"] = [];
        for (const rule of spec.rules) {
          const result = checkRule(metadata, rule);
          specResults.push(result);
        }

        const allPassed = specResults.every((r) => r.passed);

        // この仕様に完全合格した場合
        if (allPassed) {
          return {
            fileId,
            passed: true,
            results: specResults,
            matchedSpec: spec.name,
          };
        }

        // 最も合格数が多い仕様を記録（NGの場合に表示用）
        const passedCount = specResults.filter((r) => r.passed).length;
        if (!bestMatch || passedCount > bestMatch.results.filter((r) => r.passed).length) {
          bestMatch = { spec, results: specResults, allPassed };
        }
      }

      // どの仕様にも合格しなかった場合、最も近い仕様の結果を返す
      if (bestMatch) {
        return {
          fileId,
          passed: false,
          results: bestMatch.results,
          matchedSpec: bestMatch.spec.name,
        };
      }

      // 有効な仕様がない場合
      return {
        fileId,
        passed: true,
        results: [],
      };
    },
    []
  );

  const checkAllFiles = useCallback(
    (specs: Specification[]) => {
      setIsChecking(true);
      clearCheckResults();

      for (const file of files) {
        if (!file.metadata) continue;

        const result = checkFile(file.id, file.metadata, specs);
        setCheckResult(file.id, result);
      }

      setIsChecking(false);
    },
    [files, checkFile, setCheckResult, clearCheckResults]
  );

  return {
    checkFile,
    checkAllFiles,
    isChecking,
  };
}

function checkRule(
  metadata: PsdMetadata,
  rule: SpecRule
): { rule: SpecRule; passed: boolean; actualValue: string | number | boolean } {
  let actualValue: string | number | boolean;
  let passed: boolean;

  switch (rule.type) {
    case "colorMode":
      actualValue = metadata.colorMode;
      passed = evaluateCondition(actualValue, rule.operator, rule.value);
      break;

    case "dpi":
      actualValue = metadata.dpi;
      passed = evaluateCondition(actualValue, rule.operator, rule.value);
      break;

    case "bitsPerChannel":
      actualValue = metadata.bitsPerChannel;
      passed = evaluateCondition(actualValue, rule.operator, rule.value);
      break;

    case "hasGuides":
      actualValue = metadata.hasGuides;
      passed = evaluateCondition(actualValue, rule.operator, rule.value);
      break;

    case "hasAlphaChannels":
      actualValue = metadata.hasAlphaChannels;
      passed = evaluateCondition(actualValue, rule.operator, rule.value);
      break;

    case "dimensions":
      actualValue = `${metadata.width}x${metadata.height}`;
      // For dimensions, we might want to check if it falls within a range
      passed = true; // Size check is optional per plan
      break;

    default:
      actualValue = "unknown";
      passed = false;
  }

  return { rule, passed, actualValue };
}

function evaluateCondition(
  actual: string | number | boolean,
  operator: string,
  expected: string | number | boolean | number[]
): boolean {
  switch (operator) {
    case "equals":
      return actual === expected;

    case "greaterThan":
      return typeof actual === "number" && typeof expected === "number"
        ? actual >= expected
        : false;

    case "lessThan":
      return typeof actual === "number" && typeof expected === "number"
        ? actual <= expected
        : false;

    case "between":
      if (typeof actual === "number" && Array.isArray(expected) && expected.length === 2) {
        return actual >= expected[0] && actual <= expected[1];
      }
      return false;

    case "includes":
      if (Array.isArray(expected)) {
        return expected.includes(actual as never);
      }
      return false;

    default:
      return false;
  }
}
