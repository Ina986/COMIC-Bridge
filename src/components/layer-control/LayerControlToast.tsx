import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useLayerStore } from "../../store/layerStore";

export function LayerControlToast() {
  const lastResults = useLayerStore((s) => s.lastResults);
  const lastActionMode = useLayerStore((s) => s.lastActionMode);
  const isProcessing = useLayerStore((s) => s.isProcessing);
  const clearLastResults = useLayerStore((s) => s.clearLastResults);

  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevProcessingRef = useRef(isProcessing);

  useEffect(() => {
    if (prevProcessingRef.current && !isProcessing && lastResults.length > 0) {
      if (timerRef.current) clearTimeout(timerRef.current);
      requestAnimationFrame(() => setVisible(true));

      const hasError = lastResults.some((r) => !r.success);
      const duration = hasError ? 10000 : 6000;
      timerRef.current = setTimeout(() => dismiss(), duration);
    }
    prevProcessingRef.current = isProcessing;
  }, [isProcessing, lastResults]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    setTimeout(() => clearLastResults(), 300);
  };

  if (lastResults.length === 0) return null;

  const successCount = lastResults.filter((r) => r.success).length;
  const errorCount = lastResults.filter((r) => !r.success).length;
  const totalChanged = lastResults.reduce((acc, r) => acc + r.changedCount, 0);
  const isHideMode = lastActionMode === "hide";

  const toastType: "success" | "error" | "partial" =
    errorCount === 0 ? "success" : successCount === 0 ? "error" : "partial";

  const colors = {
    success: {
      border: "border-success/30",
      iconBg: "bg-success/15",
      iconColor: "text-success",
      textColor: "text-success",
      progressBg: "bg-success/40",
      glow: "shadow-[0_4px_24px_rgba(34,197,94,0.2)]",
    },
    error: {
      border: "border-error/30",
      iconBg: "bg-error/15",
      iconColor: "text-error",
      textColor: "text-error",
      progressBg: "bg-error/40",
      glow: "shadow-[0_4px_24px_rgba(239,68,68,0.2)]",
    },
    partial: {
      border: "border-warning/30",
      iconBg: "bg-warning/15",
      iconColor: "text-warning",
      textColor: "text-warning",
      progressBg: "bg-warning/40",
      glow: "shadow-[0_4px_24px_rgba(245,158,11,0.2)]",
    },
  };

  const c = colors[toastType];
  const duration = errorCount > 0 ? 10 : 6;

  const toast = (
    <div
      className={`
        fixed top-4 left-1/2 z-[60] px-5 py-3.5 rounded-2xl border
        bg-white ${c.border} ${c.glow}
        flex items-start gap-3.5
        transition-all duration-300
        ${visible ? "opacity-100 -translate-x-1/2 translate-y-0" : "opacity-0 -translate-x-1/2 -translate-y-4"}
      `}
      style={{ minWidth: "340px", maxWidth: "520px" }}
    >
      {/* Icon */}
      {toastType === "success" ? (
        <div
          className={`w-10 h-10 rounded-xl ${c.iconBg} flex items-center justify-center flex-shrink-0`}
          style={{ animation: visible ? "check-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s both" : "none" }}
        >
          <svg className={`w-5 h-5 ${c.iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
              style={{
                strokeDasharray: 24,
                strokeDashoffset: 24,
                animation: visible ? "check-draw 0.4s ease-out 0.3s forwards" : "none",
              }}
            />
          </svg>
        </div>
      ) : toastType === "error" ? (
        <div
          className={`w-10 h-10 rounded-xl ${c.iconBg} flex items-center justify-center flex-shrink-0`}
          style={{ animation: visible ? "shake 0.5s ease-in-out 0.15s" : "none" }}
        >
          <svg className={`w-5 h-5 ${c.iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      ) : (
        <div
          className={`w-10 h-10 rounded-xl ${c.iconBg} flex items-center justify-center flex-shrink-0`}
          style={{ animation: visible ? "shake 0.3s ease-in-out 0.15s" : "none" }}
        >
          <svg className={`w-5 h-5 ${c.iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${c.textColor}`}>
          {toastType === "success"
            ? `${successCount} ファイル, ${totalChanged} レイヤーを${isHideMode ? "非表示" : "表示"}に`
            : toastType === "error"
              ? `${lastResults.length} ファイルでエラー`
              : `${successCount}/${lastResults.length} 成功 / ${errorCount} エラー`}
        </p>
        <p className="text-xs text-text-muted mt-0.5">
          {toastType === "error"
            ? lastResults.find((r) => !r.success)?.error || ""
            : totalChanged === 0
              ? "条件に一致するレイヤーがありませんでした"
              : `${isHideMode ? "非表示" : "表示"}処理が完了しました`}
        </p>
      </div>

      {/* Close button */}
      <button
        className="flex-shrink-0 p-1.5 rounded-lg hover:bg-bg-tertiary transition-colors mt-0.5"
        onClick={dismiss}
      >
        <svg className="w-3.5 h-3.5 text-text-muted" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Auto-dismiss progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl overflow-hidden">
        <div
          className={`h-full ${c.progressBg}`}
          style={{
            animation: visible ? `toast-progress ${duration}s linear forwards` : "none",
          }}
        />
      </div>
    </div>
  );

  return createPortal(toast, document.body);
}
