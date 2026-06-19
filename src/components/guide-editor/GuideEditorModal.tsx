import { useState, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { JsonFileBrowser } from "../scanPsd/JsonFileBrowser";
import { useGuideStore } from "../../store/guideStore";
import { usePsdStore } from "../../store/psdStore";
import { useScanPsdStore } from "../../store/scanPsdStore";
import { useSpecStore } from "../../store/specStore";
import { GuideCanvas } from "./GuideCanvas";
import { GuideList } from "./GuideList";
import { usePreparePsd } from "../../hooks/usePreparePsd";
import { useHighResPreview } from "../../hooks/useHighResPreview";
import type { ScanGuideSet } from "../../types/scanPsd";
import { extractGuideSetsFromJson, guideSetToGuides } from "../../lib/guideJsonLoader";

export function GuideEditorModal() {
  const closeEditor = useGuideStore((state) => state.closeEditor);
  const guides = useGuideStore((state) => state.guides);
  const clearGuides = useGuideStore((state) => state.clearGuides);
  const setGuides = useGuideStore((state) => state.setGuides);
  const undo = useGuideStore((state) => state.undo);
  const redo = useGuideStore((state) => state.redo);
  const history = useGuideStore((state) => state.history);
  const future = useGuideStore((state) => state.future);

  const files = usePsdStore((state) => state.files);
  const selectedFileIds = usePsdStore((state) => state.selectedFileIds);
  const activeFile = usePsdStore((state) => state.getActiveFile());
  const jsonFolderPath = useScanPsdStore((state) => state.jsonFolderPath);

  const { isProcessing, tasks, progress, prepareFiles, reset } = usePreparePsd();
  const activeSpecId = useSpecStore((state) => state.activeSpecId);
  const checkResults = useSpecStore((state) => state.checkResults);

  const [applyTarget, setApplyTarget] = useState<"selected" | "all">("all");
  const [jsonGuideSets, setJsonGuideSets] = useState<ScanGuideSet[] | null>(null);
  const [jsonLoading, setJsonLoading] = useState(false);
  const [showJsonDialog, setShowJsonDialog] = useState(false);

  // Get high-resolution preview for the active file
  const activeFilePath = activeFile?.filePath || files[0]?.filePath;
  const {
    imageUrl: highResImageUrl,
    originalSize,
    isLoading: isPreviewLoading,
  } = useHighResPreview(activeFilePath, { maxSize: 1200 });

  // Computed values for target files
  const targetFileIds = useMemo(
    () => (applyTarget === "selected" ? selectedFileIds : files.map((f) => f.id)),
    [applyTarget, selectedFileIds, files],
  );

  const ngTargetCount = useMemo(
    () =>
      targetFileIds.filter((id) => {
        const r = checkResults.get(id);
        return r && !r.passed;
      }).length,
    [targetFileIds, checkResults],
  );

  const existingGuideCount = useMemo(
    () =>
      targetFileIds.filter((id) => {
        const f = files.find((file) => file.id === id);
        return f?.metadata?.hasGuides;
      }).length,
    [targetFileIds, files],
  );

  // Result summary
  const successCount = tasks.filter((t) => t.status === "success").length;
  const errorCount = tasks.filter((t) => t.status === "error").length;
  const isDone = !isProcessing && tasks.length > 0;
  const hasErrors = errorCount > 0;
  const errorTasks = tasks.filter((t) => t.status === "error");

  const handleApply = async () => {
    reset();
    await prepareFiles({
      fixSpec: !!activeSpecId && ngTargetCount > 0,
      applyGuides: true,
      fileIds: targetFileIds,
    });
  };

  const handleClose = () => {
    closeEditor();
  };

  // Use original size from high-res preview, or fall back to metadata
  const canvasSize = originalSize
    ? { width: originalSize.width, height: originalSize.height }
    : activeFile?.metadata
      ? { width: activeFile.metadata.width, height: activeFile.metadata.height }
      : files[0]?.metadata
        ? { width: files[0].metadata.width, height: files[0].metadata.height }
        : { width: 1920, height: 2716 }; // Default B5 at 350dpi

  const imageUrl = highResImageUrl;

  // 固定リンク(JSON_BASE_PATH＝アドレスファイルの content.jsonFolder)から
  // 選んだJSONのガイド線を読み込む（スキャナー/TIFFと同じ参照先）
  const loadGuidesFromJsonPath = async (jsonPath?: string) => {
    setShowJsonDialog(false);
    if (!jsonPath) return;
    try {
      setJsonLoading(true);
      const content = await invoke<string>("read_text_file", { filePath: jsonPath });
      const sets = extractGuideSetsFromJson(content);
      if (sets.length === 0) {
        alert("このJSONにはガイドセットが見つかりませんでした。");
        return;
      }
      setJsonGuideSets(sets);
    } catch (e) {
      console.error("Failed to load guide JSON:", e);
    } finally {
      setJsonLoading(false);
    }
  };

  // 一覧から選択したガイドセットをキャンバスサイズに合わせて読み込む
  const handlePickGuideSet = (gs: ScanGuideSet) => {
    setGuides(guideSetToGuides(gs, canvasSize));
    setJsonGuideSets(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="bg-bg-secondary rounded-lg shadow-2xl w-[95vw] max-w-6xl h-[90vh] flex flex-col overflow-hidden relative">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-text-muted/10">
          <h2 className="text-lg font-medium text-text-primary">ガイド編集</h2>
          <div className="flex items-center gap-2">
            {/* Undo/Redo */}
            <button
              className="p-2 rounded hover:bg-bg-tertiary disabled:opacity-30"
              onClick={undo}
              disabled={history.length === 0}
              title="元に戻す"
            >
              <svg className="w-4 h-4 text-text-secondary" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            <button
              className="p-2 rounded hover:bg-bg-tertiary disabled:opacity-30"
              onClick={redo}
              disabled={future.length === 0}
              title="やり直す"
            >
              <svg className="w-4 h-4 text-text-secondary" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M12.293 3.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 9H9a5 5 0 00-5 5v2a1 1 0 11-2 0v-2a7 7 0 017-7h5.586l-2.293-2.293a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            <button
              className="p-2 rounded hover:bg-bg-tertiary"
              onClick={handleClose}
              title="閉じる"
            >
              <svg className="w-5 h-5 text-text-secondary" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Canvas Area */}
          <div className="flex-1 p-4 overflow-hidden">
            <GuideCanvas
              imageUrl={imageUrl ?? undefined}
              imageSize={canvasSize}
              isLoading={isPreviewLoading}
            />
          </div>

          {/* Right Panel */}
          <div className="w-72 border-l border-text-muted/10 flex flex-col">
            {/* Guide List */}
            <div className="flex-1 overflow-auto p-4">
              <GuideList />
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-text-muted/10 space-y-3">
              <button
                className="w-full btn btn-secondary text-sm flex items-center justify-center gap-1.5"
                onClick={() => setShowJsonDialog(true)}
                disabled={jsonLoading}
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
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                {jsonLoading ? "読込中..." : "JSONからガイドを読込"}
              </button>

              <button
                className="w-full btn btn-secondary text-sm"
                onClick={clearGuides}
                disabled={guides.length === 0}
              >
                すべてクリア
              </button>

              {/* Apply Target */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-text-muted">適用先:</span>
                  <label className="flex items-center gap-1">
                    <input
                      type="radio"
                      name="applyTarget"
                      checked={applyTarget === "all"}
                      onChange={() => setApplyTarget("all")}
                      className="accent-accent"
                    />
                    <span className="text-text-secondary">全ファイル ({files.length})</span>
                  </label>
                  <label className="flex items-center gap-1">
                    <input
                      type="radio"
                      name="applyTarget"
                      checked={applyTarget === "selected"}
                      onChange={() => setApplyTarget("selected")}
                      className="accent-accent"
                    />
                    <span className="text-text-secondary">選択中 ({selectedFileIds.length})</span>
                  </label>
                </div>

                {/* Inline file selector when "選択中" is active */}
                {applyTarget === "selected" && (
                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-2 py-1 bg-bg-tertiary/50 border-b border-border/50">
                      <span className="text-[10px] text-text-muted">
                        {selectedFileIds.length}/{files.length} 選択
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          className="text-[10px] text-text-muted hover:text-accent transition-colors"
                          onClick={() => usePsdStore.getState().selectAll()}
                        >
                          全選択
                        </button>
                        {selectedFileIds.length > 0 && (
                          <button
                            className="text-[10px] text-text-muted hover:text-accent transition-colors"
                            onClick={() => usePsdStore.getState().clearSelection()}
                          >
                            解除
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="max-h-32 overflow-auto">
                      {files.map((file) => {
                        const isChecked = selectedFileIds.includes(file.id);
                        return (
                          <div
                            key={file.id}
                            className={`flex items-center gap-1.5 px-2 py-1 cursor-pointer transition-colors text-[11px] border-b border-border/20 last:border-b-0 ${
                              isChecked ? "bg-accent/8" : "hover:bg-bg-tertiary/50"
                            }`}
                            onClick={(e) => {
                              if (e.ctrlKey || e.metaKey) {
                                usePsdStore.getState().selectFile(file.id, true);
                              } else if (e.shiftKey) {
                                usePsdStore.getState().selectRange(file.id);
                              } else {
                                usePsdStore.getState().selectFile(file.id, true);
                              }
                            }}
                          >
                            <div
                              className={`w-3 h-3 rounded flex items-center justify-center flex-shrink-0 ${
                                isChecked
                                  ? "bg-gradient-to-br from-accent to-accent-secondary"
                                  : "border border-text-muted/30"
                              }`}
                            >
                              {isChecked && (
                                <svg
                                  className="w-2 h-2 text-white"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={3}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              )}
                            </div>
                            <span className="truncate text-text-primary">{file.fileName}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Info banners */}
              {activeSpecId && ngTargetCount > 0 && (
                <div className="text-xs bg-accent/10 border border-accent/20 rounded-lg px-3 py-2 text-accent">
                  仕様NG {ngTargetCount}件 → 適用時に自動修正
                </div>
              )}
              {existingGuideCount > 0 && (
                <div className="text-xs bg-warning/10 border border-warning/20 rounded-lg px-3 py-2 text-warning">
                  {existingGuideCount}件のファイルに既存ガイドあり → 置き換えられます
                </div>
              )}

              <button
                className="w-full btn btn-primary"
                onClick={handleApply}
                disabled={guides.length === 0 || isProcessing || targetFileIds.length === 0}
              >
                {isProcessing
                  ? `処理中... (${progress.current}/${progress.total})`
                  : activeSpecId && ngTargetCount > 0
                    ? "適用 + 仕様修正"
                    : "適用する"}
              </button>

              {/* Result summary (kept in sidebar for reference) */}
              {isDone && (
                <div
                  className={`rounded-xl px-3 py-2 text-sm ${
                    hasErrors
                      ? "bg-error/10 border border-error/20"
                      : "bg-success/10 border border-success/20"
                  }`}
                >
                  {hasErrors ? (
                    <>
                      <p className="text-error font-medium">
                        {successCount}/{tasks.length} 件成功 / {errorCount} 件エラー
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {errorTasks.map((t) => (
                          <li key={t.fileId} className="text-error/70 text-xs truncate">
                            {t.fileName}: {t.error}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="text-success font-medium">{successCount} 件すべて適用完了</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* JSON選択（JSONファイルを直接選択。範囲選択ラベルを介さずに選べる） */}
        {showJsonDialog && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center bg-black/50"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setShowJsonDialog(false);
            }}
          >
            <div
              className="w-[460px] max-h-[80%] flex flex-col"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <JsonFileBrowser
                basePath={jsonFolderPath}
                mode="open"
                onSelect={(filePath) => loadGuidesFromJsonPath(filePath)}
                onCancel={() => setShowJsonDialog(false)}
              />
            </div>
          </div>
        )}

        {/* JSONガイドセット選択オーバーレイ（手動選択） */}
        {jsonGuideSets && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center bg-black/50"
            onMouseDown={() => setJsonGuideSets(null)}
          >
            <div
              className="bg-bg-secondary rounded-lg shadow-2xl w-[460px] max-h-[70vh] flex flex-col overflow-hidden border border-border"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-text-muted/10">
                <h3 className="text-sm font-medium text-text-primary">
                  ガイドセットを選択 ({jsonGuideSets.length})
                </h3>
                <button
                  className="p-1 rounded hover:bg-bg-tertiary"
                  onClick={() => setJsonGuideSets(null)}
                  title="閉じる"
                >
                  <svg
                    className="w-4 h-4 text-text-secondary"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-auto p-3 space-y-1.5">
                {jsonGuideSets.map((gs, i) => (
                  <button
                    key={i}
                    onClick={() => handlePickGuideSet(gs)}
                    className="w-full text-left rounded-xl px-3 py-2 border border-border/30 bg-bg-tertiary/40 hover:border-accent/40 hover:bg-bg-tertiary/70 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-text-primary">
                        ガイドセット {i + 1}
                      </span>
                      <span className="text-[10px] text-text-muted font-mono">
                        H:{gs.horizontal.length} V:{gs.vertical.length}
                      </span>
                      {gs.docWidth > 0 && (
                        <span className="text-[9px] text-text-muted font-mono">
                          {gs.docWidth}×{gs.docHeight}
                        </span>
                      )}
                      {gs.count > 0 && (
                        <span className="ml-auto text-[9px] text-text-muted bg-bg-primary px-1.5 py-0.5 rounded">
                          {gs.count}p
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
