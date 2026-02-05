import { useRef, useEffect, useCallback } from "react";

interface CanvasRulerProps {
  direction: "horizontal" | "vertical";
  canvasWidth: number;
  canvasHeight: number;
  imageSize: { width: number; height: number };
  zoom: number;
  onDragStart: (direction: "horizontal" | "vertical", e: React.MouseEvent) => void;
}

// Photoshop-style ruler colors
const COLORS = {
  background: "#535353",
  backgroundLight: "#606060",
  backgroundDark: "#404040",
  tick: "#1a1a1a",
  text: "#1a1a1a",
  highlight: "#6a6a6a",
  shadow: "#3a3a3a",
};

const RULER_SIZE = 22; // Fixed ruler thickness in pixels

/**
 * Canvas-based ruler component with Photoshop-style appearance.
 * Supports dynamic tick intervals based on zoom level.
 */
export function CanvasRuler({
  direction,
  canvasWidth,
  canvasHeight,
  imageSize,
  zoom,
  onDragStart,
}: CanvasRulerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Calculate the appropriate tick interval based on zoom level
  const getTickIntervals = useCallback((pixelsPerUnit: number) => {
    if (pixelsPerUnit > 2) {
      return { major: 100, minor: 10 };
    } else if (pixelsPerUnit > 0.5) {
      return { major: 500, minor: 50 };
    } else {
      return { major: 1000, minor: 100 };
    }
  }, []);

  // Draw the ruler
  const drawRuler = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isHorizontal = direction === "horizontal";

    // Set canvas dimensions
    if (isHorizontal) {
      canvas.width = canvasWidth;
      canvas.height = RULER_SIZE;
    } else {
      canvas.width = RULER_SIZE;
      canvas.height = canvasHeight;
    }

    // Calculate scale factor
    const scale = isHorizontal
      ? imageSize.width / canvasWidth
      : imageSize.height / canvasHeight;

    const pixelsPerUnit = 1 / scale;
    const { major: majorStep, minor: minorStep } = getTickIntervals(pixelsPerUnit);

    // Draw gradient background
    const grad = isHorizontal
      ? ctx.createLinearGradient(0, 0, 0, RULER_SIZE)
      : ctx.createLinearGradient(0, 0, RULER_SIZE, 0);

    grad.addColorStop(0, COLORS.highlight);
    grad.addColorStop(0.1, COLORS.backgroundLight);
    grad.addColorStop(0.9, COLORS.background);
    grad.addColorStop(1, COLORS.shadow);

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Configure text style
    ctx.fillStyle = COLORS.tick;
    ctx.strokeStyle = COLORS.tick;
    ctx.font = "bold 9px Arial, sans-serif";

    if (isHorizontal) {
      ctx.textBaseline = "top";

      // Draw ticks
      const minorStepPx = minorStep / scale;
      for (let px = 0; px < canvasWidth; px += minorStepPx) {
        const realPx = Math.round(px * scale);
        const isMajor = realPx % majorStep === 0;
        const isMedium = realPx % (majorStep / 2) === 0;

        if (isMajor) {
          // Major tick with number
          ctx.fillRect(Math.floor(px), 2, 1, RULER_SIZE - 3);
          ctx.fillText(realPx.toString(), Math.floor(px) + 3, 3);
        } else if (isMedium) {
          // Medium tick
          ctx.fillRect(Math.floor(px), RULER_SIZE - 10, 1, 9);
        } else {
          // Minor tick
          ctx.fillRect(Math.floor(px), RULER_SIZE - 6, 1, 5);
        }
      }

      // Bottom edge line
      ctx.fillStyle = COLORS.shadow;
      ctx.fillRect(0, RULER_SIZE - 1, canvasWidth, 1);
    } else {
      ctx.textBaseline = "middle";

      // Draw ticks
      const minorStepPx = minorStep / scale;
      for (let py = 0; py < canvasHeight; py += minorStepPx) {
        const realPy = Math.round(py * scale);
        const isMajor = realPy % majorStep === 0;
        const isMedium = realPy % (majorStep / 2) === 0;

        if (isMajor) {
          // Major tick with rotated number
          ctx.fillRect(2, Math.floor(py), RULER_SIZE - 3, 1);
          ctx.save();
          ctx.translate(10, Math.floor(py) + 3);
          ctx.rotate(-Math.PI / 2);
          ctx.textBaseline = "middle";
          ctx.fillText(realPy.toString(), 0, 0);
          ctx.restore();
        } else if (isMedium) {
          // Medium tick
          ctx.fillRect(RULER_SIZE - 10, Math.floor(py), 9, 1);
        } else {
          // Minor tick
          ctx.fillRect(RULER_SIZE - 6, Math.floor(py), 5, 1);
        }
      }

      // Right edge line
      ctx.fillStyle = COLORS.shadow;
      ctx.fillRect(RULER_SIZE - 1, 0, 1, canvasHeight);
    }
  }, [direction, canvasWidth, canvasHeight, imageSize, getTickIntervals]);

  // Redraw when dependencies change
  useEffect(() => {
    drawRuler();
  }, [drawRuler, zoom]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Horizontal ruler creates horizontal guides (Y position)
    // Vertical ruler creates vertical guides (X position)
    // This matches Photoshop/tachimi behavior
    onDragStart(direction, e);
  };

  const cursorStyle = direction === "horizontal" ? "s-resize" : "e-resize";

  return (
    <canvas
      ref={canvasRef}
      className={`ruler ruler-${direction}`}
      style={{
        cursor: cursorStyle,
        display: "block",
      }}
      onMouseDown={handleMouseDown}
    />
  );
}

export { RULER_SIZE };
