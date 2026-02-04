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
      const results: SpecCheckResult["results"] = [];

      for (const spec of specs) {
        if (!spec.enabled) continue;

        for (const rule of spec.rules) {
          const result = checkRule(metadata, rule);
          results.push(result);
        }
      }

      const passed = results.every((r) => r.passed);

      return {
        fileId,
        passed,
        results,
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
