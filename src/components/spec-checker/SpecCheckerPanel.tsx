import { useMemo } from "react";
import { usePsdStore } from "../../store/psdStore";
import { useSpecStore } from "../../store/specStore";
import { useSpecChecker } from "../../hooks/useSpecChecker";

export function SpecCheckerPanel() {
  const files = usePsdStore((state) => state.files);
  const specifications = useSpecStore((state) => state.specifications);
  const activeSpecId = useSpecStore((state) => state.activeSpecId);
  const setActiveSpec = useSpecStore((state) => state.setActiveSpec);
  const toggleSpecification = useSpecStore((state) => state.toggleSpecification);
  const checkResults = useSpecStore((state) => state.checkResults);

  const { checkAllFiles, isChecking } = useSpecChecker();

  // Count passed/failed files
  const stats = useMemo(() => {
    let passed = 0;
    let failed = 0;
    let unchecked = 0;

    files.forEach((file) => {
      const result = checkResults.get(file.id);
      if (!result) {
        unchecked++;
      } else if (result.passed) {
        passed++;
      } else {
        failed++;
      }
    });

    return { passed, failed, unchecked };
  }, [files, checkResults]);

  const handleCheckAll = () => {
    const enabledSpecs = specifications.filter((s) => s.enabled);
    if (enabledSpecs.length > 0) {
      checkAllFiles(enabledSpecs);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Stats */}
      <div className="p-3 border-b border-text-muted/10">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-success/10 rounded p-2">
            <div className="text-lg font-bold text-success">{stats.passed}</div>
            <div className="text-xs text-text-muted">OK</div>
          </div>
          <div className="bg-error/10 rounded p-2">
            <div className="text-lg font-bold text-error">{stats.failed}</div>
            <div className="text-xs text-text-muted">NG</div>
          </div>
          <div className="bg-text-muted/10 rounded p-2">
            <div className="text-lg font-bold text-text-secondary">
              {stats.unchecked}
            </div>
            <div className="text-xs text-text-muted">未チェック</div>
          </div>
        </div>
      </div>

      {/* Specifications List */}
      <div className="flex-1 overflow-auto p-3">
        <h4 className="text-xs font-medium text-text-muted mb-2">仕様</h4>
        <div className="space-y-2">
          {specifications.map((spec) => (
            <div
              key={spec.id}
              className={`
                p-3 rounded-lg cursor-pointer transition-colors
                ${activeSpecId === spec.id
                  ? "bg-accent/20 border border-accent/50"
                  : "bg-bg-tertiary hover:bg-bg-elevated"
                }
              `}
              onClick={() => setActiveSpec(spec.id === activeSpecId ? null : spec.id)}
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={spec.enabled}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleSpecification(spec.id);
                  }}
                  className="accent-accent"
                />
                <span className="text-sm text-text-primary font-medium">
                  {spec.name}
                </span>
              </div>

              {/* Rules summary */}
              <div className="mt-2 pl-6 space-y-1">
                {spec.rules.map((rule, index) => (
                  <div key={index} className="text-xs text-text-secondary">
                    {formatRule(rule)}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Check Button */}
      <div className="p-3 border-t border-text-muted/10">
        <button
          className="w-full btn btn-primary"
          onClick={handleCheckAll}
          disabled={
            isChecking ||
            files.length === 0 ||
            specifications.filter((s) => s.enabled).length === 0
          }
        >
          {isChecking ? "チェック中..." : "すべてチェック"}
        </button>
      </div>
    </div>
  );
}

function formatRule(rule: { type: string; operator: string; value: any }): string {
  const typeLabels: Record<string, string> = {
    colorMode: "カラーモード",
    dpi: "解像度",
    bitsPerChannel: "ビット深度",
    hasGuides: "ガイド",
    dimensions: "サイズ",
  };

  const type = typeLabels[rule.type] || rule.type;

  switch (rule.operator) {
    case "equals":
      return `${type}: ${rule.value}`;
    case "greaterThan":
      return `${type}: ${rule.value} 以上`;
    case "lessThan":
      return `${type}: ${rule.value} 以下`;
    default:
      return `${type}: ${rule.value}`;
  }
}
