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
        group relative bg-bg-tertiary rounded-2xl overflow-hidden cursor-pointer
        transition-all duration-200
        hover:-translate-y-1 hover:shadow-lg
        ${isActive
          ? "ring-2 ring-accent shadow-glow-pink"
          : isSelected
          ? "ring-2 ring-accent/50 shadow-md"
          : "hover:ring-1 hover:ring-accent/30"
        }
        ${hasError ? "ring-2 ring-error" : ""}
      `}
      style={{ aspectRatio: "1 / 1.4142" }} // A4/B5 aspect ratio
      onClick={onClick}
    >
      {/* Thumbnail Image */}
      <div className="absolute inset-0 flex items-center justify-center bg-bg-elevated">
        {file.thumbnailStatus === "loading" && (
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-full border-3 border-accent/30 border-t-accent animate-spin" />
            <span className="text-xs text-text-muted">読み込み中...</span>
          </div>
        )}
        {file.thumbnailStatus === "error" && (
          <div className="text-error text-xs text-center p-4">
            <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-error/20 flex items-center justify-center">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
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
          <div className="text-text-muted text-xs flex flex-col items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-bg-tertiary flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            待機中
          </div>
        )}
      </div>

      {/* Overlay with file info */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 pt-8">
        <p className="text-xs text-white font-medium truncate mb-1.5" title={file.fileName}>
          {file.fileName}
        </p>
        {file.metadata && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                file.metadata.colorMode === "RGB"
                  ? "bg-accent-tertiary/30 text-accent-tertiary"
                  : file.metadata.colorMode === "Grayscale"
                  ? "bg-white/20 text-white/80"
                  : "bg-manga-sky/30 text-manga-sky"
              }`}
            >
              {file.metadata.colorMode}
            </span>
            <span className="text-[10px] text-white/70 bg-white/10 px-1.5 py-0.5 rounded-md">
              {file.metadata.dpi}dpi
            </span>
            {file.metadata.hasGuides && (
              <span className="text-[10px] text-guide-v bg-guide-v/20 px-1.5 py-0.5 rounded-md">
                Guide
              </span>
            )}
          </div>
        )}
      </div>

      {/* Selection Checkbox */}
      <div
        className={`
          absolute top-3 left-3 w-6 h-6 rounded-lg transition-all duration-200
          flex items-center justify-center
          ${isSelected
            ? "bg-gradient-to-br from-accent to-accent-secondary shadow-glow-pink"
            : "border-2 border-white/40 bg-black/40 opacity-0 group-hover:opacity-100"
          }
        `}
      >
        {isSelected && (
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )}
      </div>

      {/* Spec Check Indicator */}
      {hasError && (
        <div className="absolute top-3 right-3 w-6 h-6 bg-error rounded-lg flex items-center justify-center shadow-lg animate-pulse">
          <span className="text-white text-xs font-bold">!</span>
        </div>
      )}

      {/* Active indicator glow */}
      {isActive && (
        <div className="absolute inset-0 pointer-events-none border-2 border-accent rounded-2xl" />
      )}
    </div>
  );
}
