import { useRef, useState, useEffect, useCallback } from "react";
import { useGuideStore } from "../../store/guideStore";
import { CanvasRuler, RULER_SIZE } from "./CanvasRuler";

interface GuideCanvasProps {
  imageUrl?: string;
  imageSize: { width: number; height: number };
  isLoading?: boolean;
}

/**
 * Guide editing canvas with Photoshop-style rulers.
 * Supports drag-to-create guides, zoom, and pan.
 */
export function GuideCanvas({ imageUrl, imageSize, isLoading }: GuideCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragDirection, setDragDirection] = useState<"horizontal" | "vertical" | null>(null);
  const [previewPosition, setPreviewPosition] = useState<number | null>(null);

  // Pan state
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, scrollX: 0, scrollY: 0 });

  const guides = useGuideStore((state) => state.guides);
  const addGuide = useGuideStore((state) => state.addGuide);
  const selectedGuideIndex = useGuideStore((state) => state.selectedGuideIndex);
  const setSelectedGuideIndex = useGuideStore((state) => state.setSelectedGuideIndex);
  const removeGuide = useGuideStore((state) => state.removeGuide);
  const undo = useGuideStore((state) => state.undo);
  const redo = useGuideStore((state) => state.redo);

  // Calculate preview area dimensions (excluding rulers)
  const previewAreaWidth = Math.max(0, containerSize.width - RULER_SIZE);
  const previewAreaHeight = Math.max(0, containerSize.height - RULER_SIZE);

  // Calculate scale to fit image in preview area
  const baseScale = Math.min(
    previewAreaWidth / imageSize.width,
    previewAreaHeight / imageSize.height,
    1
  );
  const scale = baseScale * zoom;

  const scaledWidth = imageSize.width * scale;
  const scaledHeight = imageSize.height * scale;

  // Calculate offset to center the image in the preview area
  const offsetX = Math.max(0, (previewAreaWidth - scaledWidth) / 2);
  const offsetY = Math.max(0, (previewAreaHeight - scaledHeight) / 2);

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

  // Convert screen position (relative to preview container) to image position
  const screenToImage = useCallback(
    (screenX: number, screenY: number) => {
      return {
        x: Math.round((screenX - offsetX) / scale),
        y: Math.round((screenY - offsetY) / scale),
      };
    },
    [offsetX, offsetY, scale]
  );

  // Ruler drag start
  const handleRulerDragStart = (direction: "horizontal" | "vertical", e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragDirection(direction);
  };

  // Mouse move during drag
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // Handle panning
      if (isPanning && previewContainerRef.current) {
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        previewContainerRef.current.scrollLeft = panStart.scrollX - dx;
        previewContainerRef.current.scrollTop = panStart.scrollY - dy;
        return;
      }

      if (!isDragging || !dragDirection || !previewContainerRef.current) return;

      const rect = previewContainerRef.current.getBoundingClientRect();
      const scrollLeft = previewContainerRef.current.scrollLeft;
      const scrollTop = previewContainerRef.current.scrollTop;

      const pos = screenToImage(
        e.clientX - rect.left + scrollLeft,
        e.clientY - rect.top + scrollTop
      );

      const position = dragDirection === "horizontal" ? pos.y : pos.x;
      const max = dragDirection === "horizontal" ? imageSize.height : imageSize.width;

      if (position >= 0 && position <= max) {
        setPreviewPosition(position);
      }
    },
    [isDragging, isPanning, dragDirection, screenToImage, imageSize, panStart]
  );

  // Mouse up - add guide or end pan
  const handleMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (isDragging && dragDirection && previewPosition !== null) {
      addGuide({
        direction: dragDirection,
        position: previewPosition,
      });
    }
    setIsDragging(false);
    setDragDirection(null);
    setPreviewPosition(null);
  }, [isDragging, isPanning, dragDirection, previewPosition, addGuide]);

  // Click on guide to select
  const handleGuideClick = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedGuideIndex(selectedGuideIndex === index ? null : index);
  };

  // Keyboard events (Photoshop/tachimi-style shortcuts)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete selected guide
      if ((e.key === "Delete" || e.key === "Backspace") && selectedGuideIndex !== null) {
        removeGuide(selectedGuideIndex);
      }

      // Space for panning
      if (e.key === " " && !isSpacePressed) {
        e.preventDefault();
        setIsSpacePressed(true);
      }

      // Ctrl + (+/=): Zoom in
      if (e.ctrlKey && (e.key === "+" || e.key === "=" || e.key === ";")) {
        e.preventDefault();
        setZoom((z) => Math.min(4, z * 1.25));
      }

      // Ctrl + (-): Zoom out
      if (e.ctrlKey && e.key === "-") {
        e.preventDefault();
        setZoom((z) => Math.max(0.25, z * 0.8));
      }

      // Ctrl + 0: Reset zoom (fit)
      if (e.ctrlKey && e.key === "0") {
        e.preventDefault();
        setZoom(1);
      }

      // Ctrl + Z: Undo / Ctrl + Shift + Z or Ctrl + Y: Redo
      if (e.ctrlKey && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (e.ctrlKey && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === " ") {
        setIsSpacePressed(false);
        setIsPanning(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [selectedGuideIndex, removeGuide, isSpacePressed, undo, redo]);

  // Zoom controls (Ctrl + wheel)
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom((z) => Math.max(0.25, Math.min(4, z * delta)));
    }
  };

  // Pan start (Space + click)
  const handlePanStart = (e: React.MouseEvent) => {
    if (isSpacePressed && zoom > 1 && previewContainerRef.current) {
      setIsPanning(true);
      setPanStart({
        x: e.clientX,
        y: e.clientY,
        scrollX: previewContainerRef.current.scrollLeft,
        scrollY: previewContainerRef.current.scrollTop,
      });
      e.preventDefault();
    }
  };

  // Deselect guide when clicking on empty area
  const handleCanvasClick = () => {
    if (selectedGuideIndex !== null) {
      setSelectedGuideIndex(null);
    }
  };

  // Determine if scrollbars should be shown
  const showScrollbars = zoom > 1;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-bg-tertiary rounded-lg overflow-hidden select-none"
      onWheel={handleWheel}
    >
      {/* Grid Layout: Ruler corner + Rulers + Preview */}
      <div
        className="absolute inset-0 grid"
        style={{
          gridTemplateColumns: `${RULER_SIZE}px 1fr`,
          gridTemplateRows: `${RULER_SIZE}px 1fr`,
        }}
      >
        {/* Ruler Corner */}
        <div
          className="bg-[#535353]"
          style={{
            background: "linear-gradient(135deg, #6a6a6a 0%, #535353 50%, #3a3a3a 100%)",
          }}
        />

        {/* Horizontal Ruler (creates vertical guides) */}
        <div className="overflow-hidden">
          <CanvasRuler
            direction="horizontal"
            canvasWidth={scaledWidth}
            canvasHeight={RULER_SIZE}
            imageSize={imageSize}
            zoom={zoom}
            onDragStart={handleRulerDragStart}
          />
        </div>

        {/* Vertical Ruler (creates horizontal guides) */}
        <div className="overflow-hidden">
          <CanvasRuler
            direction="vertical"
            canvasWidth={RULER_SIZE}
            canvasHeight={scaledHeight}
            imageSize={imageSize}
            zoom={zoom}
            onDragStart={handleRulerDragStart}
          />
        </div>

        {/* Preview Container */}
        <div
          ref={previewContainerRef}
          className="relative bg-bg-elevated"
          style={{
            overflow: showScrollbars ? "auto" : "hidden",
            cursor: isSpacePressed && zoom > 1 ? (isPanning ? "grabbing" : "grab") : "default",
          }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onMouseDown={handlePanStart}
          onClick={handleCanvasClick}
        >
          {/* Zoom Wrapper */}
          <div
            className="relative"
            style={{
              width: showScrollbars ? scaledWidth : "100%",
              height: showScrollbars ? scaledHeight : "100%",
              minWidth: "100%",
              minHeight: "100%",
              display: "flex",
              alignItems: showScrollbars ? "flex-start" : "center",
              justifyContent: showScrollbars ? "flex-start" : "center",
            }}
          >
            {/* Image Container */}
            <div
              className="relative"
              style={{
                width: scaledWidth,
                height: scaledHeight,
                marginLeft: showScrollbars ? 0 : offsetX,
                marginTop: showScrollbars ? 0 : offsetY,
              }}
            >
              {/* Loading State */}
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-bg-elevated z-10">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-text-muted">読み込み中...</span>
                  </div>
                </div>
              )}

              {/* Image */}
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="w-full h-full object-fill pointer-events-none"
                  draggable={false}
                />
              ) : (
                <div className="w-full h-full bg-bg-elevated flex items-center justify-center text-text-muted">
                  プレビューなし
                </div>
              )}

              {/* Guide Lines */}
              {guides.map((guide, index) => {
                const isSelected = selectedGuideIndex === index;
                const screenPos =
                  guide.direction === "horizontal"
                    ? guide.position * scale
                    : guide.position * scale;

                return guide.direction === "horizontal" ? (
                  <div
                    key={index}
                    className={`absolute left-0 right-0 cursor-pointer transition-all group ${
                      isSelected ? "z-20" : "z-10"
                    }`}
                    style={{
                      top: screenPos,
                      height: isSelected ? 3 : 1,
                      marginTop: isSelected ? -1 : 0,
                      background: isSelected
                        ? "linear-gradient(90deg, #00e5ff, #00bcd4, #00e5ff)"
                        : "linear-gradient(90deg, #00e5ff99, #00bcd499, #00e5ff99)",
                      boxShadow: isSelected
                        ? "0 0 8px rgba(0, 229, 255, 0.8)"
                        : "0 0 4px rgba(0, 229, 255, 0.4)",
                    }}
                    onClick={(e) => handleGuideClick(index, e)}
                  >
                    {/* Selection handle */}
                    {isSelected && (
                      <div
                        className="absolute -left-1 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
                        style={{
                          background: "linear-gradient(135deg, #00e5ff, #00bcd4)",
                          boxShadow: "0 0 4px rgba(0, 229, 255, 0.8)",
                        }}
                      />
                    )}
                  </div>
                ) : (
                  <div
                    key={index}
                    className={`absolute top-0 bottom-0 cursor-pointer transition-all group ${
                      isSelected ? "z-20" : "z-10"
                    }`}
                    style={{
                      left: screenPos,
                      width: isSelected ? 3 : 1,
                      marginLeft: isSelected ? -1 : 0,
                      background: isSelected
                        ? "linear-gradient(180deg, #ff4081, #e91e63, #ff4081)"
                        : "linear-gradient(180deg, #ff408199, #e91e6399, #ff408199)",
                      boxShadow: isSelected
                        ? "0 0 8px rgba(233, 30, 99, 0.8)"
                        : "0 0 4px rgba(233, 30, 99, 0.4)",
                    }}
                    onClick={(e) => handleGuideClick(index, e)}
                  >
                    {/* Selection handle */}
                    {isSelected && (
                      <div
                        className="absolute top-1/2 -translate-y-1/2 -left-1 w-3 h-3 rounded-full"
                        style={{
                          background: "linear-gradient(135deg, #ff4081, #e91e63)",
                          boxShadow: "0 0 4px rgba(233, 30, 99, 0.8)",
                        }}
                      />
                    )}
                  </div>
                );
              })}

              {/* Preview Guide (while dragging) */}
              {isDragging && previewPosition !== null && (
                dragDirection === "horizontal" ? (
                  <div
                    className="absolute left-0 right-0 pointer-events-none z-30"
                    style={{
                      top: previewPosition * scale,
                      height: 2,
                      background: "linear-gradient(90deg, #00e5ff, #00bcd4, #00e5ff)",
                      opacity: 0.8,
                      boxShadow: "0 0 8px rgba(0, 229, 255, 0.6)",
                    }}
                  />
                ) : (
                  <div
                    className="absolute top-0 bottom-0 pointer-events-none z-30"
                    style={{
                      left: previewPosition * scale,
                      width: 2,
                      background: "linear-gradient(180deg, #ff4081, #e91e63, #ff4081)",
                      opacity: 0.8,
                      boxShadow: "0 0 8px rgba(233, 30, 99, 0.6)",
                    }}
                  />
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Zoom indicator */}
      <div className="absolute bottom-2 right-2 bg-bg-secondary/90 px-3 py-1.5 rounded-md text-xs text-text-muted backdrop-blur-sm border border-text-muted/10">
        {Math.round(zoom * 100)}%
      </div>

      {/* Instructions */}
      <div className="absolute bottom-2 left-2 bg-bg-secondary/90 px-3 py-1.5 rounded-md text-xs text-text-muted backdrop-blur-sm border border-text-muted/10">
        定規からドラッグでガイド作成 | Ctrl+/-/0 でズーム | Space+ドラッグでパン | Delete で削除
      </div>
    </div>
  );
}
