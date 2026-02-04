import type { PsdFile } from "../../types";
import { useSpecStore } from "../../store/specStore";

interface ThumbnailCardProps {
  file: PsdFile;
  size: number;
  isSelected: boolean;
  isActive: boolean;
  onClick: (e: React.MouseEvent) => void;
}

export function ThumbnailCard({
  file,
  size: _size,
  isSelected,
  isActive,
  onClick,
}: ThumbnailCardProps) {
  const checkResults = useSpecStore((state) => state.checkResults);
  const checkResult = checkResults.get(file.id);
  const hasError = checkResult && !checkResult.passed;

  return (
    <div
      className={`
        group relative bg-bg-secondary rounded-lg overflow-hidden cursor-pointer
        transition-all duration-150
        ${isActive
          ? "ring-2 ring-accent shadow-lg shadow-accent/20"
          : isSelected
          ? "ring-1 ring-accent/50"
          : "hover:ring-1 hover:ring-text-muted/30"
        }
        ${hasError ? "ring-1 ring-error" : ""}
      `}
      style={{ aspectRatio: "1 / 1.4142" }} // A4/B5 aspect ratio
      onClick={onClick}
    >
      {/* Thumbnail Image */}
      <div className="absolute inset-0 flex items-center justify-center bg-bg-tertiary">
        {file.thumbnailStatus === "loading" && (
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        )}
        {file.thumbnailStatus === "error" && (
          <div className="text-error text-xs text-center p-2">
            <svg className="w-8 h-8 mx-auto mb-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            読込エラー
          </div>
        )}
        {file.thumbnailStatus === "ready" && file.thumbnailUrl && (
          <img
            src={file.thumbnailUrl}
            alt={file.fileName}
            className="max-w-full max-h-full object-contain"
            draggable={false}
          />
        )}
        {file.thumbnailStatus === "pending" && (
          <div className="text-text-muted text-xs">待機中...</div>
        )}
      </div>

      {/* Overlay with file info */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
        <p className="text-xs text-white truncate" title={file.fileName}>
          {file.fileName}
        </p>
        {file.metadata && (
          <div className="flex items-center gap-1 mt-1">
            <span
              className={`text-[9px] px-1 py-0.5 rounded ${
                file.metadata.colorMode === "RGB"
                  ? "bg-success/30 text-success"
                  : file.metadata.colorMode === "Grayscale"
                  ? "bg-white/20 text-white/80"
                  : "bg-cyan-500/30 text-cyan-300"
              }`}
            >
              {file.metadata.colorMode}
            </span>
            <span className="text-[9px] text-white/60">
              {file.metadata.dpi}dpi
            </span>
            {file.metadata.hasGuides && (
              <span className="text-[9px] text-guide-v">G</span>
            )}
          </div>
        )}
      </div>

      {/* Selection Checkbox */}
      <div
        className={`
          absolute top-2 left-2 w-5 h-5 rounded border-2 transition-all
          ${isSelected
            ? "bg-accent border-accent"
            : "border-white/50 bg-black/30 opacity-0 group-hover:opacity-100"
          }
        `}
      >
        {isSelected && (
          <svg className="w-full h-full text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )}
      </div>

      {/* Spec Check Indicator */}
      {hasError && (
        <div className="absolute top-2 right-2 w-5 h-5 bg-error rounded-full flex items-center justify-center">
          <span className="text-white text-xs font-bold">!</span>
        </div>
      )}
    </div>
  );
}
