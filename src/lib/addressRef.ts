// =====================================================================
//  参照アドレスローダ (フロントエンド)
// ---------------------------------------------------------------------
//  共有ドライブのパス・フォントサーバ・固有名詞などの「アドレス」は
//  ソースに直打ちせず、Rust コマンド get_reference_addresses 経由で
//  外部の参照アドレスリスト(addresses.json)から実行時に取得する。
//
//  値は Windows ネイティブ表記(バックスラッシュ / UNC)で届くため、
//  従来スラッシュ表記を使っていた箇所には toSlash() で正規化して渡す。
//  UNC パス(\\server\...)はバックスラッシュのまま使う(toSlash しない)。
//
//  参照リストが見つからない / 壊れている場合、invoke は reject する。
//  呼び出し側はそれを捕捉して該当機能をエラー停止させること。
// =====================================================================
import { invoke } from "@tauri-apps/api/core";

export type AddressMap = Record<string, string>;

let cache: AddressMap | null = null;
let loadError: string | null = null;
let inflight: Promise<AddressMap> | null = null;

/** バックスラッシュ → スラッシュ正規化(非UNCパス用)。 */
export function toSlash(value: string): string {
  return value.replace(/\\/g, "/");
}

/** 参照アドレスリストを取得(初回のみ invoke、以降はキャッシュ)。失敗時は reject。 */
export function loadAddresses(): Promise<AddressMap> {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = invoke<string>("get_reference_addresses")
    .then((json) => {
      const map = JSON.parse(json) as AddressMap;
      cache = map;
      loadError = null;
      return map;
    })
    .catch((e) => {
      loadError = String(e);
      cache = null;
      throw e;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** TS側キャッシュをクリアして参照アドレスリストを再フェッチする(共有先更新後の再読込用)。
 *  Rust側キャッシュの reload は呼び出し側で先に行うこと。 */
export function reloadAddresses(): Promise<AddressMap> {
  cache = null;
  inflight = null;
  return loadAddresses();
}

/** キャッシュ済みアドレスを同期取得(未ロード/欠落なら ""). 生の値(バックスラッシュ)。 */
export function getAddress(key: string): string {
  return cache?.[key] ?? "";
}

/** キャッシュ済みアドレスをスラッシュ正規化して同期取得。 */
export function getAddressSlash(key: string): string {
  const v = cache?.[key];
  return v ? toSlash(v) : "";
}

export function hasAddresses(): boolean {
  return cache !== null;
}

export function getLoadError(): string | null {
  return loadError;
}

// ---------------------------------------------------------------------
//  実行時に設定される共有パス(ライブバインディング)。
//  initAddresses() がロード後に setter で代入する。
//  import 側はライブバインディングとして最新値を参照できる。
// ---------------------------------------------------------------------

/** 共有フォントフォルダ(UNC, バックスラッシュのまま)。 */
export let FONT_SHARE_PATH = "";

export function __setFontSharePath(value: string): void {
  FONT_SHARE_PATH = value;
}
