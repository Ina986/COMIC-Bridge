import { usePsdStore } from "../../store/psdStore";
import { ThumbnailCard } from "./ThumbnailCard";
import { THUMBNAIL_SIZES } from "../../types";

export function PreviewGrid() {
  const files = usePsdStore((state) => state.files);
  const thumbnailSize = usePsdStore((state) => state.thumbnailSize);
  const selectedFileIds = usePsdStore((state) => state.selectedFileIds);
  const activeFileId = usePsdStore((state) => state.activeFileId);
  const selectFile = usePsdStore((state) => state.selectFile);
  const selectRange = usePsdStore((state) => state.selectRange);

  const handleClick = (fileId: string, e: React.MouseEvent) => {
    if (e.shiftKey) {
      selectRange(fileId);
    } else if (e.ctrlKey || e.metaKey) {
      selectFile(fileId, true);
    } else {
      selectFile(fileId);
    }
  };

  const size = THUMBNAIL_SIZES[thumbnailSize].value;

  return (
    <div className="h-full overflow-auto p-4" data-preview-grid>
      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: `repeat(auto-fill, minmax(${size}px, 1fr))`,
        }}
      >
        {files.map((file) => (
          <ThumbnailCard
            key={file.id}
            file={file}
            size={size}
            isSelected={selectedFileIds.includes(file.id)}
            isActive={activeFileId === file.id}
            onClick={(e) => handleClick(file.id, e)}
          />
        ))}
      </div>
    </div>
  );
}
