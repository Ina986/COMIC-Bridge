import { useFolderPicker } from "../../hooks/useFolderPicker";

interface DropZoneProps {
  showPdf?: boolean;
}

export function DropZone({ showPdf = false }: DropZoneProps) {
  const { openFolderPicker, isOpeningDisabled } = useFolderPicker();

  const preventDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div
      className="
        flex flex-col items-center justify-center h-full
        border-2 border-dashed rounded-3xl m-6 transition-all duration-300
        border-text-muted/20 hover:border-accent/40 hover:bg-accent/5
      "
      onDragOver={preventDrag}
      onDragLeave={preventDrag}
      onDrop={preventDrag}
    >
      <div className="text-center p-8">
        <div className="w-24 h-24 mx-auto mb-6 rounded-3xl flex items-center justify-center bg-bg-tertiary">
          <svg
            className="w-12 h-12 text-text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </div>

        <p className="text-xl font-display font-medium mb-3 text-text-primary">
          PSDファイルをドロップ
        </p>
        <p className="text-sm text-text-muted mb-6">
          フォルダまたはファイルをドラッグ＆ドロップ
        </p>

        <button
          type="button"
          onClick={openFolderPicker}
          disabled={isOpeningDisabled}
          className="
            inline-flex items-center justify-center gap-2 mb-5 px-5 py-2.5
            rounded-xl bg-accent text-white text-sm font-medium
            hover:bg-accent/90 active:scale-[0.98]
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all shadow-sm
          "
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
          フォルダを選択
        </button>

        <div className="flex items-center justify-center gap-2">
          <span className="px-3 py-1 bg-manga-pink/20 text-manga-pink text-xs rounded-full">
            .psd
          </span>
          <span className="px-3 py-1 bg-manga-lavender/20 text-manga-lavender text-xs rounded-full">
            .psb
          </span>
          {showPdf && (
            <span className="px-3 py-1 bg-manga-lavender/20 text-manga-lavender text-xs rounded-full">
              .pdf
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
