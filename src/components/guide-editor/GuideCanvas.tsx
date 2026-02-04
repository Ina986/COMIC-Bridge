import { useRef, useState, useEffect, useCallback } from "react";
import { useGuideStore } from "../../store/guideStore";

interface GuideCanvasProps {
  imageData?: string;
  imageSize: { width: number; height: number };
}

export function GuideCanvas({ imageData, imageSize }: GuideCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragDirection, setDragDirection] = useState<"horizontal" | "vertical" | null>(null);
  const [previewPosition, setPreviewPosition] = useState<number | null>(null);

  const guides = useGuideStore((state) => state.guides);
  const addGuide = useGuideStore((state) => state.addGuide);
  const selectedGuideIndex = useGuideStore((state) => state.selectedGuideIndex);
  const setSelectedGuideIndex = useGuideStore((state) => state.setSelectedGuideIndex);
  const removeGuide = useGuideStore((state) => state.removeGuide);

  // Calculate scale to fit image in container
  const scale = Math.min(
    (containerSize.width - 60) / imageSize.width,
    (containerSize.height - 60) / imageSize.height,
    1
  ) * zoom;

  const scaledWidth = imageSize.width * scale;
  const scaledHeight = imageSize.height * scale;

  // Offset to center the image
  const offsetX = (containerSize.width - scaledWidth - 30) / 2 + 30;
  const offsetY = (containerSize.height - scaledHeight - 30) / 2 + 30;

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Convert screen position to image position
  const screenToImage = useCallback(
    (screenX: number, screenY: number) => {
      return {
        x: Math.round((screenX - offsetX) / scale),
        y: Math.round((screenY - offsetY) / scale),
      };
    },
    [offsetX, offsetY, scale]
  );

  // Convert image position to screen position
  const imageToScreen = useCallback(
    (imageX: number, imageY: number) => {
      return {
        x: imageX * scale + offsetX,
        y: imageY * scale + offsetY,
      };
    },
    [offsetX, offsetY, scale]
  );

  // Ruler drag start
  const handleRulerMouseDown = (direction: "horizontal" | "vertical", e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragDirection(direction);
  };

  // Mouse move during drag
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !dragDirection || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const pos = screenToImage(
        e.clientX - rect.left,
        e.clientY - rect.top
      );

      const position = dragDirection === "horizontal" ? pos.y : pos.x;
      const max = dragDirection === "horizontal" ? imageSize.height : imageSize.width;

      if (position >= 0 && position <= max) {
        setPreviewPosition(position);
      }
    },
    [isDragging, dragDirection, screenToImage, imageSize]
  );

  // Mouse up - add guide
  const handleMouseUp = useCallback(() => {
    if (isDragging && dragDirection && previewPosition !== null) {
      addGuide({
        direction: dragDirection,
        position: previewPosition,
      });
    }
    setIsDragging(false);
    setDragDirection(null);
    setPreviewPosition(null);
  }, [isDragging, dragDirection, previewPosition, addGuide]);

  // Click on guide to select
  const handleGuideClick = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedGuideIndex(selectedGuideIndex === index ? null : index);
  };

  // Delete key to remove selected guide
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedGuideIndex !== null) {
        removeGuide(selectedGuideIndex);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedGuideIndex, removeGuide]);

  // Zoom controls
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom((z) => Math.max(0.1, Math.min(3, z * delta)));
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-bg-tertiary rounded-lg overflow-hidden select-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Horizontal Ruler */}
      <div
        className="absolute top-0 left-[30px] right-0 h-[30px] bg-bg-secondary border-b border-text-muted/10 cursor-s-resize"
        onMouseDown={(e) => handleRulerMouseDown("vertical", e)}
      >
        {/* Ruler ticks */}
        <svg className="w-full h-full" style={{ overflow: "visible" }}>
          {Array.from({ length: Math.ceil(imageSize.width / 100) + 1 }).map((_, i) => {
            const pos = imageToScreen(i * 100, 0);
            return (
              <g key={i}>
                <line
                  x1={pos.x - offsetX + 30}
                  y1={20}
                  x2={pos.x - offsetX + 30}
                  y2={30}
                  stroke="currentColor"
                  className="text-text-muted"
                />
                <text
                  x={pos.x - offsetX + 32}
                  y={16}
                  className="text-[8px] fill-text-muted"
                >
                  {i * 100}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Vertical Ruler */}
      <div
        className="absolute top-[30px] left-0 bottom-0 w-[30px] bg-bg-secondary border-r border-text-muted/10 cursor-e-resize"
        onMouseDown={(e) => handleRulerMouseDown("horizontal", e)}
      >
        <svg className="w-full h-full" style={{ overflow: "visible" }}>
          {Array.from({ length: Math.ceil(imageSize.height / 100) + 1 }).map((_, i) => {
            const pos = imageToScreen(0, i * 100);
            return (
              <g key={i}>
                <line
                  x1={20}
                  y1={pos.y - offsetY + 30}
                  x2={30}
                  y2={pos.y - offsetY + 30}
                  stroke="currentColor"
                  className="text-text-muted"
                />
                <text
                  x={2}
                  y={pos.y - offsetY + 34}
                  className="text-[8px] fill-text-muted"
                >
                  {i * 100}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Canvas Area */}
      <div
        className="absolute"
        style={{
          left: offsetX,
          top: offsetY,
          width: scaledWidth,
          height: scaledHeight,
        }}
      >
        {/* Image */}
        {imageData ? (
          <img
            src={imageData}
            alt="Preview"
            className="w-full h-full object-contain pointer-events-none"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full bg-bg-elevated flex items-center justify-center text-text-muted">
            プレビューなし
          </div>
        )}

        {/* Guides */}
        {guides.map((guide, index) => {
          const isSelected = selectedGuideIndex === index;
          const screenPos =
            guide.direction === "horizontal"
              ? guide.position * scale
              : guide.position * scale;

          return guide.direction === "horizontal" ? (
            <div
              key={index}
              className={`absolute left-0 right-0 h-px cursor-pointer transition-colors ${
                isSelected ? "bg-guide-h" : "bg-guide-h/70 hover:bg-guide-h"
              }`}
              style={{ top: screenPos }}
              onClick={(e) => handleGuideClick(index, e)}
            >
              {isSelected && (
                <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-guide-h rounded-full" />
              )}
            </div>
          ) : (
            <div
              key={index}
              className={`absolute top-0 bottom-0 w-px cursor-pointer transition-colors ${
                isSelected ? "bg-guide-v" : "bg-guide-v/70 hover:bg-guide-v"
              }`}
              style={{ left: screenPos }}
              onClick={(e) => handleGuideClick(index, e)}
            >
              {isSelected && (
                <div className="absolute top-1/2 -translate-y-1/2 -left-2 w-4 h-4 bg-guide-v rounded-full" />
              )}
            </div>
          );
        })}

        {/* Preview Guide (while dragging) */}
        {isDragging && previewPosition !== null && (
          dragDirection === "horizontal" ? (
            <div
              className="absolute left-0 right-0 h-px bg-white/50 pointer-events-none"
              style={{ top: previewPosition * scale }}
            />
          ) : (
            <div
              className="absolute top-0 bottom-0 w-px bg-white/50 pointer-events-none"
              style={{ left: previewPosition * scale }}
            />
          )
        )}
      </div>

      {/* Zoom indicator */}
      <div className="absolute bottom-2 right-2 bg-bg-secondary/80 px-2 py-1 rounded text-xs text-text-muted">
        {Math.round(zoom * 100)}%
      </div>

      {/* Instructions */}
      <div className="absolute bottom-2 left-2 bg-bg-secondary/80 px-2 py-1 rounded text-xs text-text-muted">
        ルーラーからドラッグしてガイド作成 | Ctrl+スクロールでズーム | Delete で削除
      </div>
    </div>
  );
}
