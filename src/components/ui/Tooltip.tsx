import { useState, useRef, useEffect, useLayoutEffect, ReactNode } from "react";
import { createPortal } from "react-dom";

type TooltipPosition = "top" | "bottom" | "left" | "right";

interface TooltipProps {
  content: ReactNode;
  position?: TooltipPosition;
  delay?: number;
  children: ReactNode;
}

const VIEWPORT_MARGIN = 8; // 画面端からの最小マージン(px)
const GAP = 8; // トリガーとツールチップの間隔(px)

export function Tooltip({ content, position = "top", delay = 200, children }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  // 計測後の確定座標。null の間は不可視で配置計算待ち
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const timeoutRef = useRef<number>();

  const showTooltip = () => {
    timeoutRef.current = window.setTimeout(() => {
      if (triggerRef.current) {
        rectRef.current = triggerRef.current.getBoundingClientRect();
        setPos(null);
        setIsVisible(true);
      }
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
    setPos(null);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // ツールチップを実寸計測し、トリガー相対位置 → ビューポート内にクランプ
  useLayoutEffect(() => {
    if (!isVisible || !tooltipRef.current || !rectRef.current) return;
    const rect = rectRef.current;
    const tip = tooltipRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left: number;
    let top: number;

    switch (position) {
      case "top":
        left = rect.left + rect.width / 2 - tip.width / 2;
        top = rect.top - tip.height - GAP;
        break;
      case "bottom":
        left = rect.left + rect.width / 2 - tip.width / 2;
        top = rect.bottom + GAP;
        break;
      case "left":
        left = rect.left - tip.width - GAP;
        top = rect.top + rect.height / 2 - tip.height / 2;
        break;
      case "right":
      default:
        left = rect.right + GAP;
        top = rect.top + rect.height / 2 - tip.height / 2;
        break;
    }

    // 右/左に出して画面外なら反対側へフォールバック
    if (position === "right" && left + tip.width > vw - VIEWPORT_MARGIN) {
      left = rect.left - tip.width - GAP;
    } else if (position === "left" && left < VIEWPORT_MARGIN) {
      left = rect.right + GAP;
    }
    // 上/下に出して画面外なら反対側へフォールバック
    if (position === "top" && top < VIEWPORT_MARGIN) {
      top = rect.bottom + GAP;
    } else if (position === "bottom" && top + tip.height > vh - VIEWPORT_MARGIN) {
      top = rect.top - tip.height - GAP;
    }

    // 最終クランプ（どの方向でも画面内に必ず収める）
    left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(left, vw - tip.width - VIEWPORT_MARGIN),
    );
    top = Math.max(
      VIEWPORT_MARGIN,
      Math.min(top, vh - tip.height - VIEWPORT_MARGIN),
    );

    setPos({ left, top });
  }, [isVisible, position, content]);

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
      >
        {children}
      </div>
      {isVisible &&
        createPortal(
          <div
            ref={tooltipRef}
            className="
              fixed z-[100]
              max-w-[320px] w-max
              px-3 py-2 text-xs leading-relaxed
              whitespace-pre-wrap break-words
              bg-bg-elevated text-text-primary
              border border-border
              rounded-lg shadow-lg
              pointer-events-none
            "
            style={{
              left: pos ? pos.left : -9999,
              top: pos ? pos.top : -9999,
              visibility: pos ? "visible" : "hidden",
            }}
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  );
}

export default Tooltip;
