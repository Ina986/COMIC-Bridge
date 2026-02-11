import { useState, useMemo } from "react";
import { usePsdStore } from "../../store/psdStore";
import { useTiffStore } from "../../store/tiffStore";
import { TiffResultDialog } from "./TiffResultDialog";
import { TiffPartialBlurModal } from "./TiffPartialBlurModal";
import { TiffPageRulesEditor } from "./TiffPageRulesEditor";
import { useTiffProcessor } from "../../hooks/useTiffProcessor";
import { usePsdLoader } from "../../hooks/usePsdLoader";
import type { TiffColorMode } from "../../types/tiff";

export function TiffSettingsPanel() {
  const files = usePsdStore((state) => state.files);
  const selectedFileIds = usePsdStore((state) => state.selectedFileIds);

  const settings = useTiffStore((state) => state.settings);
  const setSettings = useTiffStore((state) => state.setSettings);
  const isProcessing = useTiffStore((state) => state.isProcessing);
  const progress = useTiffStore((state) => state.progress);
  const totalFiles = useTiffStore((state) => state.totalFiles);
  const currentFile = useTiffStore((state) => state.currentFile);
  const results = useTiffStore((state) => state.results);
  const setShowResultDialog = useTiffStore((state) => state.setShowResultDialog);
  const phase = useTiffStore((state) => state.phase);
  const setPhase = useTiffStore((state) => state.setPhase);
  const partialBlurEntries = useTiffStore((state) => state.settings.partialBlurEntries);

  const { convertSelectedFiles, convertAllFiles } = useTiffProcessor();
  const { loadFolderWithSubfolders, loadFiles } = usePsdLoader();
  const droppedFolderPaths = usePsdStore((state) => state.droppedFolderPaths);

  const hasResults = results.length > 0;
  const [showPartialBlurModal, setShowPartialBlurModal] = useState(false);
  const [showPageRulesEditor, setShowPageRulesEditor] = useState(false);

  // DPI表示（カラーモード連動）
  const dpiDisplay = useMemo(() => {
    if (settings.colorMode === "mono") return "600 dpi";
    if (settings.colorMode === "color") return "350 dpi";
    if (settings.colorMode === "perPage") return "600/350 dpi";
    return "変更なし";
  }, [settings.colorMode]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-display font-medium text-text-primary flex items-center gap-2">
          <svg className="w-4 h-4 text-accent-warm" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          TIFF化
        </h3>
        <p className="text-xs text-text-muted mt-1">
          Photoshopで一括TIFF変換
        </p>
      </div>

      {/* Settings */}
      <div className="flex-1 overflow-auto p-3 space-y-3">

        {/* 1. 処理方法 */}
        <div className="bg-bg-tertiary rounded-xl p-3">
          <h4 className="text-xs font-medium text-text-muted mb-2">処理方法</h4>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.output.proceedAsTiff}
              onChange={(e) => setSettings({
                output: { ...settings.output, proceedAsTiff: e.target.checked },
              })}
              className="rounded accent-accent-warm"
            />
            <div>
              <span className="text-sm text-text-primary">TIFF化工程に進む</span>
              <p className="text-[10px] text-text-muted">
                {settings.output.proceedAsTiff ? "TIFF (LZW圧縮) で出力" : "PSD/PSB形式で出力"}
              </p>
            </div>
          </label>
        </div>

        {/* 1b. サブフォルダ */}
        <div className="bg-bg-tertiary rounded-xl p-3">
          <h4 className="text-xs font-medium text-text-muted mb-2">ファイル読み込み</h4>
          <label className="flex items-center gap-2.5 cursor-pointer p-1.5 rounded-lg hover:bg-bg-elevated/50 transition-colors">
            <input
              type="checkbox"
              checked={settings.includeSubfolders}
              onChange={async (e) => {
                const newVal = e.target.checked;
                setSettings({ includeSubfolders: newVal });
                // フォルダパスがあれば再スキャン
                if (droppedFolderPaths.length > 0) {
                  if (newVal) {
                    await loadFolderWithSubfolders(droppedFolderPaths);
                  } else {
                    // サブフォルダなしで再読み込み
                    const { readDir } = await import("@tauri-apps/plugin-fs");
                    const { isSupportedFile } = await import("../../types");
                    const imageFiles: string[] = [];
                    for (const fp of droppedFolderPaths) {
                      try {
                        const entries = await readDir(fp);
                        for (const entry of entries) {
                          if (entry.isFile && entry.name && isSupportedFile(entry.name)) {
                            imageFiles.push(`${fp}\\${entry.name}`);
                          }
                        }
                      } catch { /* ignore */ }
                    }
                    if (imageFiles.length > 0) {
                      await loadFiles(imageFiles);
                    }
                  }
                }
              }}
              className="rounded accent-accent-warm"
            />
            <div>
              <span className="text-sm text-text-primary">サブフォルダも含める（1階層）</span>
              <p className="text-[10px] text-text-muted">親フォルダ内のサブフォルダを1階層まで走査</p>
            </div>
          </label>
        </div>

        {/* 2. カラーモード */}
        <div className="bg-bg-tertiary rounded-xl p-3">
          <h4 className="text-xs font-medium text-text-muted mb-2">カラーモード</h4>
          <div className="space-y-1.5">
            <ColorModeOption mode="mono" label="モノクロ" description="Grayscale に変換" current={settings.colorMode} onChange={(m) => setSettings({ colorMode: m })} />
            <ColorModeOption mode="color" label="カラー" description="RGB を維持/変換" current={settings.colorMode} onChange={(m) => setSettings({ colorMode: m })} />
            <ColorModeOption mode="noChange" label="変更なし" description="カラーモードを維持" current={settings.colorMode} onChange={(m) => setSettings({ colorMode: m })} />
            <ColorModeOption mode="perPage" label="個別選択..." description="ページ範囲ごとに指定" current={settings.colorMode} onChange={(m) => setSettings({ colorMode: m })} />
          </div>
          {settings.colorMode === "perPage" && (
            <button
              onClick={() => setShowPageRulesEditor(true)}
              className="mt-2 w-full px-3 py-2 text-xs font-medium text-accent-warm bg-accent-warm/10 border border-accent-warm/30 rounded-lg hover:bg-accent-warm/20 transition-colors"
            >
              ルールを編集 ({settings.pageRangeRules.length}/3)
            </button>
          )}
        </div>

        {/* 3. ガウスぼかし */}
        <div className="bg-bg-tertiary rounded-xl p-3">
          <h4 className="text-xs font-medium text-text-muted mb-2">ガウスぼかし</h4>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.blur.enabled}
              onChange={(e) => setSettings({
                blur: { ...settings.blur, enabled: e.target.checked },
              })}
              className="rounded accent-accent-warm"
            />
            <span className="text-sm text-text-primary">背景にガウスぼかしを適用</span>
          </label>
          {settings.blur.enabled && (
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-xs text-text-secondary">半径:</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={settings.blur.radius}
                  onChange={(e) => setSettings({
                    blur: { ...settings.blur, radius: parseFloat(e.target.value) || 0 },
                  })}
                  className="w-20 px-2 py-1 text-sm bg-bg-elevated border border-border/50 rounded-lg text-text-primary focus:outline-none focus:border-accent-warm/50"
                />
                <span className="text-xs text-text-muted">px</span>
              </div>
              <button
                onClick={() => setShowPartialBlurModal(true)}
                className="w-full px-3 py-1.5 text-xs text-text-secondary bg-bg-elevated border border-border/50 rounded-lg hover:bg-bg-elevated/80 transition-colors"
              >
                部分ぼかし設定 {partialBlurEntries.length > 0 && `(${partialBlurEntries.length}ページ)`}
              </button>
            </div>
          )}
        </div>

        {/* 4. クロップ範囲 */}
        <div className="bg-bg-tertiary rounded-xl p-3">
          <h4 className="text-xs font-medium text-text-muted mb-2">クロップ範囲</h4>
          <label className="flex items-center gap-2.5 cursor-pointer mb-2">
            <input
              type="checkbox"
              checked={settings.crop.enabled}
              onChange={(e) => setSettings({
                crop: { ...settings.crop, enabled: e.target.checked },
              })}
              className="rounded accent-accent-warm"
            />
            <div>
              <span className="text-sm text-text-primary">クロップを適用</span>
              <p className="text-[10px] text-text-muted">比率 {settings.crop.aspectRatio.w}:{settings.crop.aspectRatio.h}</p>
            </div>
          </label>
          {settings.crop.enabled && (
            <div className="space-y-2">
              {settings.crop.bounds ? (
                <div className="px-2 py-1.5 bg-bg-elevated rounded-lg text-xs text-text-secondary space-y-0.5">
                  <div className="flex justify-between">
                    <span>左上:</span>
                    <span className="font-mono">{settings.crop.bounds.left}, {settings.crop.bounds.top}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>右下:</span>
                    <span className="font-mono">{settings.crop.bounds.right}, {settings.crop.bounds.bottom}</span>
                  </div>
                  <div className="flex justify-between text-accent-warm">
                    <span>サイズ:</span>
                    <span className="font-mono">
                      {settings.crop.bounds.right - settings.crop.bounds.left} x {settings.crop.bounds.bottom - settings.crop.bounds.top}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-text-muted px-1">範囲未設定</p>
              )}
              <button
                onClick={() => setPhase(phase === "cropSelection" ? "idle" : "cropSelection")}
                className={`
                  w-full px-3 py-2 text-xs font-medium rounded-lg transition-all
                  ${phase === "cropSelection"
                    ? "text-white bg-accent-warm shadow-sm"
                    : "text-accent-warm bg-accent-warm/10 border border-accent-warm/30 hover:bg-accent-warm/20"
                  }
                `}
              >
                {phase === "cropSelection" ? "エディタを閉じる" : "エディタで選択"}
              </button>
            </div>
          )}
        </div>

        {/* 5. リサイズ */}
        <div className="bg-bg-tertiary rounded-xl p-3">
          <h4 className="text-xs font-medium text-text-muted mb-2">リサイズ・解像度</h4>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">出力サイズ</span>
              <span className="text-text-primary font-mono">
                {settings.resize.targetWidth} x {settings.resize.targetHeight}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">解像度</span>
              <span className="text-accent-warm font-medium">{dpiDisplay}</span>
            </div>
          </div>
          <div className="mt-2 flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-text-muted block mb-1">幅 (px)</label>
              <input
                type="number"
                value={settings.resize.targetWidth}
                onChange={(e) => setSettings({
                  resize: { ...settings.resize, targetWidth: parseInt(e.target.value) || 1280 },
                })}
                className="w-full px-2 py-1 text-sm bg-bg-elevated border border-border/50 rounded-lg text-text-primary focus:outline-none focus:border-accent-warm/50"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-text-muted block mb-1">高さ (px)</label>
              <input
                type="number"
                value={settings.resize.targetHeight}
                onChange={(e) => setSettings({
                  resize: { ...settings.resize, targetHeight: parseInt(e.target.value) || 1818 },
                })}
                className="w-full px-2 py-1 text-sm bg-bg-elevated border border-border/50 rounded-lg text-text-primary focus:outline-none focus:border-accent-warm/50"
              />
            </div>
          </div>
        </div>

        {/* 6. テキスト整理 */}
        <div className="bg-bg-tertiary rounded-xl p-3">
          <h4 className="text-xs font-medium text-text-muted mb-2">テキスト整理</h4>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.text.reorganize}
              onChange={(e) => setSettings({
                text: { ...settings.text, reorganize: e.target.checked },
              })}
              className="rounded accent-accent-warm"
            />
            <div>
              <span className="text-sm text-text-primary">テキスト整理を行う</span>
              <p className="text-[10px] text-text-muted">散在するテキストレイヤーを1グループに統合</p>
            </div>
          </label>
        </div>

        {/* 7. リネーム設定 */}
        <div className="bg-bg-tertiary rounded-xl p-3">
          <h4 className="text-xs font-medium text-text-muted mb-2">リネーム設定</h4>
          <div className="space-y-2">
            <label className="flex items-center gap-2.5 cursor-pointer p-1.5 rounded-lg hover:bg-bg-elevated/50 transition-colors">
              <input
                type="checkbox"
                checked={settings.rename.keepOriginalName}
                onChange={(e) => setSettings({
                  rename: { ...settings.rename, keepOriginalName: e.target.checked },
                })}
                className="rounded accent-accent-warm"
              />
              <div>
                <span className="text-sm text-text-primary">リネームしない</span>
                <p className="text-[10px] text-text-muted">元のファイル名を維持（拡張子のみ変更）</p>
              </div>
            </label>

            {!settings.rename.keepOriginalName && (
              <>
                <label className="flex items-center gap-2.5 cursor-pointer p-1.5 rounded-lg hover:bg-bg-elevated/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={settings.rename.extractPageNumber}
                    onChange={(e) => setSettings({
                      rename: { ...settings.rename, extractPageNumber: e.target.checked },
                    })}
                    className="rounded accent-accent-warm"
                  />
                  <div>
                    <span className="text-sm text-text-primary">ファイル名からページ数を計算</span>
                    <p className="text-[10px] text-text-muted">末尾の数字をページ番号として使用</p>
                  </div>
                </label>

                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-text-muted block mb-1">開始ページ番号</label>
                    <input
                      type="number"
                      min="0"
                      value={settings.rename.startNumber}
                      onChange={(e) => setSettings({
                        rename: { ...settings.rename, startNumber: parseInt(e.target.value) || 0 },
                      })}
                      className="w-full px-2 py-1 text-sm bg-bg-elevated border border-border/50 rounded-lg text-text-primary focus:outline-none focus:border-accent-warm/50"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-text-muted block mb-1">ゼロ埋め桁数</label>
                    <input
                      type="number"
                      min="1"
                      max="8"
                      value={settings.rename.padding}
                      onChange={(e) => setSettings({
                        rename: { ...settings.rename, padding: parseInt(e.target.value) || 4 },
                      })}
                      className="w-full px-2 py-1 text-sm bg-bg-elevated border border-border/50 rounded-lg text-text-primary focus:outline-none focus:border-accent-warm/50"
                    />
                  </div>
                </div>

                {settings.includeSubfolders && (
                  <label className="flex items-center gap-2.5 cursor-pointer p-1.5 rounded-lg hover:bg-bg-elevated/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={settings.rename.flattenSubfolders}
                      onChange={(e) => setSettings({
                        rename: { ...settings.rename, flattenSubfolders: e.target.checked },
                      })}
                      className="rounded accent-accent-warm"
                    />
                    <div>
                      <span className="text-sm text-text-primary">サブフォルダを一括リネーム</span>
                      <p className="text-[10px] text-text-muted">フォルダ構造なしで通し番号出力</p>
                    </div>
                  </label>
                )}
              </>
            )}
          </div>
        </div>

        {/* 8. 出力先・中間PSD */}
        <div className="bg-bg-tertiary rounded-xl p-3">
          <h4 className="text-xs font-medium text-text-muted mb-2">出力設定</h4>
          <div className="space-y-2">
            <div>
              <label className="text-[10px] text-text-muted block mb-1">出力先</label>
              <div className="flex items-center gap-1.5">
                <div className="flex-1 px-2 py-1.5 text-xs bg-bg-elevated border border-border/50 rounded-lg text-text-secondary truncate">
                  {settings.output.outputDirectory || "Desktop/Script_Output"}
                </div>
                <button
                  onClick={async () => {
                    const { open } = await import("@tauri-apps/plugin-dialog");
                    const dir = await open({ directory: true });
                    if (dir) setSettings({ output: { ...settings.output, outputDirectory: dir as string } });
                  }}
                  className="px-2 py-1.5 text-xs text-text-secondary bg-bg-elevated border border-border/50 rounded-lg hover:bg-bg-elevated/80 transition-colors flex-shrink-0"
                >
                  変更...
                </button>
                {settings.output.outputDirectory && (
                  <button
                    onClick={() => setSettings({ output: { ...settings.output, outputDirectory: null } })}
                    className="px-2 py-1.5 text-xs text-text-muted hover:text-error transition-colors flex-shrink-0"
                  >
                    リセット
                  </button>
                )}
              </div>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer p-1.5 rounded-lg hover:bg-bg-elevated/50 transition-colors">
              <input
                type="checkbox"
                checked={settings.output.saveIntermediatePsd}
                onChange={(e) => setSettings({
                  output: { ...settings.output, saveIntermediatePsd: e.target.checked },
                })}
                className="rounded accent-accent-warm"
              />
              <div>
                <span className="text-sm text-text-primary">中間PSDを保存する</span>
                <p className="text-[10px] text-text-muted">カラー変換後のPSDを別途保存</p>
              </div>
            </label>

            {settings.output.saveIntermediatePsd && (
              <label className="flex items-center gap-2.5 cursor-pointer p-1.5 pl-8 rounded-lg hover:bg-bg-elevated/50 transition-colors">
                <input
                  type="checkbox"
                  checked={settings.output.mergeAfterColorConvert}
                  onChange={(e) => setSettings({
                    output: { ...settings.output, mergeAfterColorConvert: e.target.checked },
                  })}
                  className="rounded accent-accent-warm"
                />
                <div>
                  <span className="text-sm text-text-primary">画像レイヤーを統合する</span>
                  <p className="text-[10px] text-text-muted">*_merged.psd として保存</p>
                </div>
              </label>
            )}
          </div>
        </div>

        {/* Processing Status */}
        {isProcessing && (
          <div className="bg-accent-warm/10 rounded-xl p-3 border border-accent-warm/30">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-4 h-4 rounded-full border-2 border-accent-warm/30 border-t-accent-warm animate-spin" />
              <span className="text-sm text-accent-warm font-medium">Photoshopで処理中...</span>
            </div>
            {currentFile && (
              <p className="text-xs text-text-muted truncate">{currentFile}</p>
            )}
            <div className="mt-2 bg-bg-elevated rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-accent-warm to-accent transition-all duration-300"
                style={{ width: `${totalFiles > 0 ? (progress / totalFiles) * 100 : 0}%` }}
              />
            </div>
            <p className="text-xs text-text-muted mt-1 text-right">
              {progress} / {totalFiles}
            </p>
          </div>
        )}

        {/* Last Results Summary */}
        {hasResults && !isProcessing && (
          <button
            onClick={() => setShowResultDialog(true)}
            className="
              w-full bg-gradient-to-r from-accent-warm/10 to-accent/5
              rounded-xl p-3 border border-accent-warm/30
              hover:border-accent-warm/50 hover:from-accent-warm/15 hover:to-accent/10
              transition-all text-left group
            "
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-accent-warm" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-text-primary">
                  処理完了 — {results.filter((r) => r.success).length}/{results.length} 成功
                </span>
              </div>
              <svg className="w-4 h-4 text-text-muted group-hover:text-accent-warm transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <p className="text-[10px] text-text-muted mt-1">クリックでレポートを表示</p>
          </button>
        )}

        {/* Result Dialog */}
        <TiffResultDialog />
      </div>

      {/* Action Bar */}
      <div className="p-3 border-t border-border space-y-2">
        {isProcessing ? (
          <button
            disabled
            className="
              w-full px-4 py-3 text-sm font-medium rounded-xl text-white
              bg-gradient-to-r from-accent-warm to-accent
              opacity-80 cursor-not-allowed
              flex items-center justify-center gap-2
            "
          >
            <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            Photoshopで処理中...
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={convertSelectedFiles}
              disabled={selectedFileIds.length === 0}
              className="
                flex-1 px-3 py-2.5 text-sm font-medium rounded-xl
                bg-bg-tertiary text-text-primary
                border border-accent-warm/40
                hover:bg-accent-warm/10 hover:border-accent-warm/60
                transition-all duration-200
                disabled:opacity-40 disabled:cursor-not-allowed
                flex items-center justify-center gap-1.5
              "
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <span>選択のみ ({selectedFileIds.length})</span>
            </button>

            <button
              onClick={convertAllFiles}
              disabled={files.length === 0}
              className="
                flex-1 px-3 py-2.5 text-sm font-medium rounded-xl text-white
                bg-gradient-to-r from-accent-warm to-accent
                shadow-[0_3px_12px_rgba(255,177,66,0.25)]
                hover:shadow-[0_5px_16px_rgba(255,177,66,0.35)]
                hover:-translate-y-0.5
                transition-all duration-200
                disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none
                flex items-center justify-center gap-1.5
              "
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
              </svg>
              <span>全て実行 ({files.length})</span>
            </button>
          </div>
        )}

        <div className="flex items-center justify-center text-[10px] text-text-muted">
          {settings.output.proceedAsTiff ? "TIFF (LZW)" : "PSD"} · {settings.colorMode === "mono" ? "モノクロ" : settings.colorMode === "color" ? "カラー" : settings.colorMode === "perPage" ? "個別" : "変更なし"}
        </div>
      </div>

      {/* Modals */}
      {showPartialBlurModal && (
        <TiffPartialBlurModal onClose={() => setShowPartialBlurModal(false)} />
      )}
      {showPageRulesEditor && (
        <TiffPageRulesEditor onClose={() => setShowPageRulesEditor(false)} />
      )}
    </div>
  );
}

// --- Sub-components ---

function ColorModeOption({
  mode, label, description, current, onChange,
}: {
  mode: TiffColorMode; label: string; description: string;
  current: TiffColorMode; onChange: (mode: TiffColorMode) => void;
}) {
  const isSelected = current === mode;
  return (
    <div
      className={`
        flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all duration-200
        ${isSelected
          ? "bg-accent-warm/15 border border-accent-warm/50"
          : "bg-bg-elevated border border-white/5 hover:border-white/10"
        }
      `}
      onClick={() => onChange(mode)}
    >
      <div className={`
        w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200
        ${isSelected ? "border-accent-warm bg-accent-warm" : "border-text-muted/50"}
      `}>
        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
      </div>
      <div className="flex-1">
        <span className="text-sm text-text-primary">{label}</span>
        <p className="text-xs text-text-muted">{description}</p>
      </div>
    </div>
  );
}
