// =====================================================================
//  参照アドレス初期化オーケストレータ
// ---------------------------------------------------------------------
//  アプリ描画前(main.tsx)に呼び出し、参照アドレスリストを読み込んで
//  各ストア / モジュール定数へ既定値を注入する。
//
//  読み込みに失敗してもアプリ自体は起動する。ただし共有パス類は未解決の
//  ままなので、それらを使う機能は実行時にエラー停止する(セキュリティ要件:
//  直打ちフォールバックを持たない)。
// =====================================================================
import {
  loadAddresses,
  reloadAddresses,
  getAddress,
  getAddressSlash,
  __setFontSharePath,
} from "./addressRef";
import { __setJsonBasePath } from "../types/tiff";
import { __setGenreLabels } from "../types/scanPsd";
import { useScanPsdStore } from "../store/scanPsdStore";
import { useTypesettingCheckStore } from "../store/typesettingCheckStore";

let done = false;

/** ロード済みアドレスを各ストア/モジュール定数へ注入する(初回・再読込で共用)。 */
function applyAddressInjections(): void {
  // 共有フォントフォルダ(UNC)はバックスラッシュのまま使う
  const fontShare = getAddress("font.sharePath");
  if (fontShare) __setFontSharePath(fontShare);

  // ジャンル→レーベル名マッピング(固有名詞)を参照リストから注入。JSON文字列で格納。
  const genreRaw = getAddress("content.genreLabels");
  if (genreRaw) {
    try {
      __setGenreLabels(JSON.parse(genreRaw) as Record<string, string[]>);
    } catch (e) {
      console.error("[address-ref] content.genreLabels の解析に失敗しました。", e);
    }
  }

  // 共有JSONフォルダ(スラッシュ正規化)
  const jsonFolder = getAddressSlash("content.jsonFolder");
  if (jsonFolder) __setJsonBasePath(jsonFolder);

  // 各ストアの既定パス(未設定フィールドのみ注入。localStorage上書きは保持)
  useScanPsdStore.getState().hydrateDefaultPaths({
    jsonFolderPath: getAddressSlash("content.jsonFolder"),
    saveDataBasePath: getAddressSlash("content.saveDataBase"),
    textLogFolderPath: getAddressSlash("content.textLogFolder"),
  });
  useTypesettingCheckStore
    .getState()
    .hydrateDefaultPath(getAddressSlash("content.textLogBase"));
}

export async function initAddresses(): Promise<void> {
  if (done) return;
  try {
    await loadAddresses();
  } catch (e) {
    console.error(
      "[address-ref] 参照アドレスリストを読み込めませんでした。" +
        "パッチ(はじめに実行_参照先登録.bat)の適用と共有ドライブ接続を確認してください。",
      e,
    );
    return; // フォールバックなし: 各機能側でエラー停止
  }

  applyAddressInjections();
  done = true;
}

/**
 * 共有先が更新されたときに、参照アドレスリストを再取得して再注入する。
 * Rust 側キャッシュも reload してから TS 側キャッシュをクリア→再フェッチする。
 */
export async function reapplyAddresses(): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("reload_reference_addresses"); // Rust キャッシュを最新の addresses.json で再構築
  await reloadAddresses(); // TS キャッシュをクリアして再フェッチ
  applyAddressInjections();
}
