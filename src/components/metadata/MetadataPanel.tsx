import type { PsdFile } from "../../types";
import { LayerTree } from "./LayerTree";

interface MetadataPanelProps {
  file: PsdFile;
}

export function MetadataPanel({ file }: MetadataPanelProps) {
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="p-4 space-y-4">
      {/* File Name */}
      <div>
        <h3 className="text-xs font-medium text-text-muted mb-1">ファイル名</h3>
        <p className="text-sm text-text-primary break-all">{file.fileName}</p>
        {file.fileSize > 0 && (
          <p className="text-xs text-text-muted mt-0.5">
            {formatFileSize(file.fileSize)}
          </p>
        )}
      </div>

      {/* Thumbnail Preview */}
      {file.thumbnailUrl && (
        <div>
          <h3 className="text-xs font-medium text-text-muted mb-2">プレビュー</h3>
          <div className="bg-bg-tertiary rounded-lg p-2 flex items-center justify-center">
            <img
              src={file.thumbnailUrl}
              alt={file.fileName}
              className="max-w-full max-h-48 object-contain"
            />
          </div>
        </div>
      )}

      {file.metadata ? (
        <>
          {/* Color Mode */}
          <div>
            <h3 className="text-xs font-medium text-text-muted mb-1">
              カラーモード
            </h3>
            <span
              className={`badge ${
                file.metadata.colorMode === "RGB"
                  ? "badge-rgb"
                  : file.metadata.colorMode === "Grayscale"
                  ? "badge-grayscale"
                  : file.metadata.colorMode === "CMYK"
                  ? "bg-cyan-500/20 text-cyan-400"
                  : "bg-text-muted/20 text-text-muted"
              }`}
            >
              {file.metadata.colorMode}
            </span>
            <span className="text-xs text-text-muted ml-2">
              {file.metadata.bitsPerChannel}bit
            </span>
          </div>

          {/* Canvas Size */}
          <div>
            <h3 className="text-xs font-medium text-text-muted mb-1">
              キャンバスサイズ
            </h3>
            <p className="text-sm text-text-primary font-mono">
              {file.metadata.width} × {file.metadata.height} px
            </p>
            <p className="text-xs text-text-secondary">
              {file.metadata.dpi} dpi
            </p>
          </div>

          {/* Guides */}
          <div>
            <h3 className="text-xs font-medium text-text-muted mb-1">ガイド</h3>
            {file.metadata.hasGuides ? (
              <div className="space-y-1">
                <p className="text-sm text-success">
                  {file.metadata.guides.length} 本のガイド
                </p>
                <div className="bg-bg-tertiary rounded p-2 max-h-32 overflow-auto">
                  {file.metadata.guides.map((guide, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 text-xs py-0.5"
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          guide.direction === "horizontal"
                            ? "bg-guide-h"
                            : "bg-guide-v"
                        }`}
                      />
                      <span className="text-text-secondary">
                        {guide.direction === "horizontal" ? "水平" : "垂直"}
                      </span>
                      <span className="font-mono text-text-primary">
                        {guide.position} px
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-text-muted">ガイドなし</p>
            )}
          </div>

          {/* Layer Tree */}
          <div>
            <h3 className="text-xs font-medium text-text-muted mb-1">
              レイヤー ({file.metadata.layerCount})
            </h3>
            <div className="bg-bg-tertiary rounded p-2 max-h-64 overflow-auto">
              <LayerTree layers={file.metadata.layerTree} />
            </div>
          </div>
        </>
      ) : file.thumbnailStatus === "loading" ? (
        <div className="text-sm text-text-muted text-center py-4">
          読み込み中...
        </div>
      ) : file.thumbnailStatus === "error" ? (
        <div className="text-sm text-error text-center py-4">
          読み込みエラー
          {file.error && (
            <p className="text-xs text-text-muted mt-1">{file.error}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
