import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useScanPsdStore } from "../../../store/scanPsdStore";

/**
 * テキストログセクション（テキスト・ルビタブ内）。
 * 保存済みの「〇巻.txt」「ルビ一覧.txt」をボタンで開く＋「まとめてテキストコピー」。
 */
export function TextMemoSection() {
  const workInfo = useScanPsdStore((s) => s.workInfo);
  const textLogFolderPath = useScanPsdStore((s) => s.textLogFolderPath);
  // phase変化をトリガーにしてスキャン/保存完了後にファイル一覧を再取得
  const phase = useScanPsdStore((s) => s.phase);

  const label = workInfo.label;
  const title = workInfo.title;

  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copying" | "done" | "error">("idle");

  useEffect(() => {
    if (!label || !title || !textLogFolderPath) {
      setFiles([]);
      return;
    }

    const folderPath = `${textLogFolderPath}/${label}/${title}`.replace(/\\/g, "/");

    let cancelled = false;
    setLoading(true);
    invoke<string[]>("list_all_files", { folderPath })
      .then((result) => {
        if (!cancelled) setFiles(result);
      })
      .catch(() => {
        if (!cancelled) setFiles([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [label, title, textLogFolderPath, phase]);

  const volumePattern = /(\d+)巻\.txt$/;
  const folderPath =
    textLogFolderPath && label && title
      ? `${textLogFolderPath}/${label}/${title}`.replace(/\\/g, "/")
      : null;

  // 表示順: 巻（昇順）→ その他 → ルビ
  const volumeFiles = files
    .filter((f) => volumePattern.test(f))
    .sort((a, b) => parseInt(a.match(volumePattern)![1]) - parseInt(b.match(volumePattern)![1]));
  const rubyFiles = files.filter((f) => /ルビ/.test(f) && f.endsWith(".txt"));
  const otherFiles = files.filter((f) => !volumePattern.test(f) && !rubyFiles.includes(f));

  // まとめてコピーの対象（ルビは含めない）
  const copyTargets = [...volumeFiles, ...otherFiles.filter((f) => f.endsWith(".txt"))];

  // ボタンを押すと該当のテキストメモを開く
  const handleOpenFile = (fileName: string) => {
    if (!folderPath) return;
    invoke("open_with_default_app", { filePath: `${folderPath}/${fileName}` }).catch(console.error);
  };

  // テキストが保存されているフォルダを開く
  const handleOpenFolder = () => {
    if (!folderPath) return;
    invoke("open_folder_in_explorer", { folderPath: folderPath.replace(/\//g, "\\") }).catch(
      console.error,
    );
  };

  // テキストログ（巻＋その他。ルビは除外）を「■ 見出し」付きで連結してクリップボードへ
  const handleCopyAll = async () => {
    if (!folderPath || copyTargets.length === 0) return;
    setCopyState("copying");
    try {
      const parts: string[] = [];
      for (const f of copyTargets) {
        const content = await invoke<string>("read_text_file", {
          filePath: `${folderPath}/${f}`,
        });
        const heading = volumePattern.test(f)
          ? `■ ${f.match(volumePattern)![1]}巻`
          : `■ ${f.replace(/\.txt$/, "")}`;
        parts.push(`${heading}\n${content.trim()}`);
      }
      await navigator.clipboard.writeText(parts.join("\n\n"));
      setCopyState("done");
      setTimeout(() => setCopyState("idle"), 2500);
    } catch (e) {
      console.error("Failed to copy text logs:", e);
      setCopyState("error");
      setTimeout(() => setCopyState("idle"), 2500);
    }
  };

  if (!label || !title) return null;

  return (
    <div className="space-y-1.5">
      <h4 className="text-[10px] font-bold text-text-secondary">テキストログ</h4>

      {loading ? (
        <p className="text-[11px] text-text-muted">読み込み中...</p>
      ) : files.length === 0 ? (
        <p className="text-[11px] text-text-muted">
          テキストログなし（スキャン時に出力されると表示されます）
        </p>
      ) : (
        <>
          {/* 巻・ルビのボタン（押すと該当のテキストメモが開く） */}
          <div className="flex flex-wrap gap-1.5">
            {volumeFiles.map((f) => (
              <button
                key={f}
                onClick={() => handleOpenFile(f)}
                title={`${f} を開く`}
                className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-accent/10 text-accent border border-accent/25 hover:bg-accent/20 hover:-translate-y-0.5 transition-all shadow-sm"
              >
                {f.match(volumePattern)![1]}巻
              </button>
            ))}
            {rubyFiles.map((f) => (
              <button
                key={f}
                onClick={() => handleOpenFile(f)}
                title={`${f} を開く`}
                className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-accent-tertiary/10 text-accent-tertiary border border-accent-tertiary/25 hover:bg-accent-tertiary/20 hover:-translate-y-0.5 transition-all shadow-sm"
              >
                ルビ
              </button>
            ))}
            {otherFiles.map((f) => (
              <button
                key={f}
                onClick={() => handleOpenFile(f)}
                title={`${f} を開く`}
                className="px-3 py-1.5 text-[11px] font-medium rounded-lg bg-bg-tertiary text-text-secondary border border-border hover:text-text-primary hover:bg-bg-tertiary/70 transition-all"
              >
                {f.replace(/\.txt$/, "")}
              </button>
            ))}
          </div>

          {/* まとめてテキストコピー（ルビ除く）＋ フォルダを開く */}
          <div className="flex gap-1.5">
            <button
              onClick={handleCopyAll}
              disabled={copyState === "copying" || copyTargets.length === 0}
              className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 ${
                copyState === "done"
                  ? "text-white bg-gradient-to-r from-success to-emerald-500"
                  : copyState === "error"
                    ? "text-white bg-error"
                    : "text-white bg-gradient-to-r from-accent to-accent-secondary hover:-translate-y-0.5"
              }`}
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
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              {copyState === "copying"
                ? "コピー中..."
                : copyState === "done"
                  ? `コピーしました（${copyTargets.length}巻分）`
                  : copyState === "error"
                    ? "コピーに失敗しました"
                    : "まとめてテキストコピー"}
            </button>
            <button
              onClick={handleOpenFolder}
              title="テキストが保存されているフォルダを開く"
              className="flex-1 py-3 text-sm font-bold rounded-xl border border-border bg-bg-tertiary/60 text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-all flex items-center justify-center gap-1.5"
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
              フォルダを開く
            </button>
          </div>
        </>
      )}
    </div>
  );
}
