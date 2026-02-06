import { useRef, useEffect, useCallback } from "react";

interface CanvasRulerProps {
  direction: "horizontal" | "vertical";
  length: number;
  imageSize: { width: number; height: number };
  scaledImageSize: number;
  offset: number;
  zoom: number;
  onDragStart: (direction: "horizontal" | "vertical", e: React.MouseEvent) => void;
}

const RULER_SIZE = 22;

export function CanvasRuler({
  direction,
  length,
  imageSize,
  scaledImageSize,
  offset,
  zoom,
  onDragStart,
}: CanvasRulerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const getTickIntervals = useCallback((pixelsPerUnit: number) => {
    if (pixelsPerUnit > 2) {
      return { major: 100, minor: 10 };
    } else if (pixelsPerUnit > 0.5) {
      return { major: 500, minor: 50 };
    } else {
      return { major: 1000, minor: 100 };
    }
  }, []);

  const drawRuler = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const isHorizontal = direction === "horizontal";

    const displayW = isHorizontal ? length : RULER_SIZE;
    const displayH = isHorizontal ? RULER_SIZE : length;

    canvas.width = displayW * dpr;
    canvas.height = displayH * dpr;
    canvas.style.width = `${displayW}px`;
    canvas.style.height = `${displayH}px`;

    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = "#f8f6f3";
    ctx.fillRect(0, 0, displayW, displayH);

    // Image area background (slightly different)
    ctx.fillStyle = "#f0eeeb";
    if (isHorizontal) {
      ctx.fillRect(offset, 0, scaledImageSize, RULER_SIZE);
    } else {
      ctx.fillRect(0, offset, RULER_SIZE, scaledImageSize);
    }

    const imgDim = isHorizontal ? imageSize.width : imageSize.height;
    const scale = scaledImageSize / imgDim;
    const pixelsPerUnit = scale;
    const { major: majorStep, minor: minorStep } = getTickIntervals(pixelsPerUnit);

    if (isHorizontal) {
      for (let unit = 0; unit <= imgDim; unit += minorStep) {
        const px = offset + unit * scale;
        if (px < 0 || px > length) continue;

        const isMajor = unit % majorStep === 0;
        const isMedium = unit % (majorStep / 2) === 0;

        if (isMajor) {
          ctx.fillStyle = "#4a4a58";
          ctx.fillRect(Math.round(px), 0, 1, RULER_SIZE);
        } else if (isMedium) {
          ctx.fillStyle = "#8a8a98";
          ctx.fillRect(Math.round(px), RULER_SIZE - 11, 1, 11);
        } else {
          ctx.fillStyle = "#a8a8b4";
          ctx.fillRect(Math.round(px), RULER_SIZE - 6, 1, 6);
        }
      }

      // Bottom edge
      ctx.fillStyle = "#ddd8d3";
      ctx.fillRect(0, RULER_SIZE - 1, length, 1);
    } else {
      for (let unit = 0; unit <= imgDim; unit += minorStep) {
        const py = offset + unit * scale;
        if (py < 0 || py > length) continue;

        const isMajor = unit % majorStep === 0;
        const isMedium = unit % (majorStep / 2) === 0;

        if (isMajor) {
          ctx.fillStyle = "#4a4a58";
          ctx.fillRect(0, Math.round(py), RULER_SIZE, 1);
        } else if (isMedium) {
          ctx.fillStyle = "#8a8a98";
          ctx.fillRect(RULER_SIZE - 11, Math.round(py), 11, 1);
        } else {
          ctx.fillStyle = "#a8a8b4";
          ctx.fillRect(RULER_SIZE - 6, Math.round(py), 6, 1);
        }
      }

      // Right edge
      ctx.fillStyle = "#ddd8d3";
      ctx.fillRect(RULER_SIZE - 1, 0, 1, length);
    }
  }, [direction, length, imageSize, scaledImageSize, offset, getTickIntervals]);

  useEffect(() => {
    drawRuler();
  }, [drawRuler, zoom]);

  const handleMouseDown = (e: React.MouseEvent) => {
    onDragStart(direction, e);
  };

  const cursorStyle = direction === "horizontal" ? "s-resize" : "e-resize";

  return (
    <canvas
      ref={canvasRef}
      style={{
        cursor: cursorStyle,
        display: "block",
      }}
      onMouseDown={handleMouseDown}
    />
  );
}

export { RULER_SIZE };
