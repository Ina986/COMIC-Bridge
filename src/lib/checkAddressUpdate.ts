// =====================================================================
//  共有参照アドレスリストの更新チェック(起動時・自動)
// ---------------------------------------------------------------------
//  起動のたびに、共有先(addresses.json)の最終更新時刻を確認する。
//  前回起動時に記録した値から変わっていたら、確認は求めず【自動で】
//  参照アドレスを再読み込みして反映する。
//
//  取得に失敗した場合(共有ドライブ未接続・パッチ未適用など)は、何もせず
//  静かに終了する(起動を妨げない)。
// =====================================================================
import { invoke } from "@tauri-apps/api/core";
import { reapplyAddresses } from "./initAddresses";

/** 前回起動時に反映した参照リストの mtime(UNIX秒)を保存する localStorage キー。 */
export const LAST_MTIME_KEY = "addressRef.lastMtime";

/** 共有参照リストの mtime をチェックし、変化していれば自動で再読込する(確認なし)。 */
export async function checkSharedListUpdate(): Promise<void> {
  let mtime: number | null = null;
  try {
    mtime = await invoke<number | null>("get_reference_list_mtime");
  } catch {
    return; // 取得不可(未接続/未適用)。起動を妨げない。
  }
  if (mtime == null) return;

  const current = String(mtime);
  const last = localStorage.getItem(LAST_MTIME_KEY);

  // 初回(記録なし) → 記録するだけ
  if (last === null) {
    localStorage.setItem(LAST_MTIME_KEY, current);
    return;
  }
  // 変化なし → 何もしない
  if (last === current) return;

  // 変化あり → 確認せず自動で再読込
  try {
    await reapplyAddresses();
    localStorage.setItem(LAST_MTIME_KEY, current);
    console.info("[address-ref] 共有参照リストの更新を自動で反映しました。");
  } catch (e) {
    console.error("[address-ref] 参照アドレスの自動再読込に失敗しました。", e);
    // 失敗時は記録を更新しない → 次回起動で再試行
  }
}
