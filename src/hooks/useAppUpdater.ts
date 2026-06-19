import { useState, useEffect, useCallback, useRef } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";

/** Rust(updater_local) の check_local_update が返す情報 */
interface LocalUpdateInfo {
  version: string;
  currentVersion: string;
  setupPath: string;
  modifiedSecs: number | null;
}

interface UpdateInfo {
  version: string;
  body: string;
  /** G:更新置き場の検証済み setup.exe パス */
  setupPath: string;
}

type UpdatePhase =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "ready"
  | "error"
  | "up-to-date";

/**
 * 自動更新（G:共有ドライブ方式・GitHub非依存）。
 * 更新置き場(参照アドレス updater.localDir)の署名検証済み新版を Rust 側で探し、
 * あれば通知 → インストーラ起動で更新する。実行時に GitHub へは接続しない。
 */
export function useAppUpdater() {
  const [phase, setPhase] = useState<UpdatePhase>("idle");
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState<string>("");
  const [showPrompt, setShowPrompt] = useState(false);
  const startupChecked = useRef(false);

  // 現在のバージョンを取得
  useEffect(() => {
    getVersion()
      .then(setAppVersion)
      .catch(() => {});
  }, []);

  const checkForUpdate = useCallback(async (silent = false) => {
    if (!silent) setPhase("checking");
    setError(null);

    try {
      const info = await invoke<LocalUpdateInfo | null>("check_local_update");

      if (info) {
        const dateStr = info.modifiedSecs
          ? new Date(info.modifiedSecs * 1000).toLocaleString()
          : "";
        setUpdateInfo({
          version: info.version,
          body: dateStr ? `更新日: ${dateStr}` : "",
          setupPath: info.setupPath,
        });
        setPhase("available");
        setShowPrompt(true); // 手動・自動どちらでも「まず通知」（適用はユーザー操作後）
      } else {
        setPhase(silent ? "idle" : "up-to-date");
        if (!silent) {
          setTimeout(() => setPhase("idle"), 3000);
        }
      }
    } catch (e: any) {
      // 失敗理由は常に保持（起動サイレント時も「なぜ更新されないか」を後から見えるように）。
      setError(e?.message || String(e));
      // 起動サイレント時は画面を妨げない。手動チェック時のみエラー表示に遷移。
      if (!silent) setPhase("error");
    }
  }, []);

  // 起動時自動チェック。
  // G:接続/参照アドレス(updater.localDir/pubkey)の読込が起動直後は間に合わないことがあるため、
  // 更新が見つかるまで数回リトライする（見つかれば即通知、無ければ静かに終了）。
  useEffect(() => {
    if (startupChecked.current) return;
    startupChecked.current = true;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    const MAX_ATTEMPTS = 5;

    const tryCheck = async () => {
      if (cancelled) return;
      attempts++;
      try {
        const info = await invoke<LocalUpdateInfo | null>("check_local_update");
        if (cancelled) return;
        if (info) {
          const dateStr = info.modifiedSecs
            ? new Date(info.modifiedSecs * 1000).toLocaleString()
            : "";
          setUpdateInfo({
            version: info.version,
            body: dateStr ? `更新日: ${dateStr}` : "",
            setupPath: info.setupPath,
          });
          setPhase("available");
          setShowPrompt(true); // ← まず通知（モーダル）。適用はユーザー操作後のみ。
          return; // 見つかったら終了
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e)); // 静かに保持（手動チェックで確認可能）
      }
      // 未検出/未準備ならリトライ（4秒間隔）
      if (!cancelled && attempts < MAX_ATTEMPTS) {
        timer = setTimeout(tryCheck, 4000);
      }
    };

    timer = setTimeout(tryCheck, 2500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const downloadAndInstall = useCallback(async () => {
    if (!updateInfo?.setupPath) return;

    setPhase("downloading");
    try {
      // 適用：Rust が再検証 → temp へコピー → インストーラ起動 → アプリ終了。
      await invoke("apply_local_update", { setupPath: updateInfo.setupPath });
      setPhase("ready");
      // この後アプリは終了し、NSIS インストーラが上書き更新する。
    } catch (e: any) {
      setError(e?.message || String(e));
      setPhase("error");
    }
  }, [updateInfo]);

  const dismiss = useCallback(() => {
    setPhase("idle");
    setError(null);
  }, []);

  const dismissPrompt = useCallback(() => {
    setShowPrompt(false);
  }, []);

  return {
    phase,
    updateInfo,
    error,
    appVersion,
    showPrompt,
    checkForUpdate,
    downloadAndInstall,
    dismiss,
    dismissPrompt,
  };
}
