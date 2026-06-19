//! 参照アドレス関連の Tauri コマンド。
//!
//! commands.rs(PS連携中心の巨大モジュール)から、結合度の低い
//! 「参照アドレスリストの状態取得・再読込・許可登録」系を分離したもの。
//! 実体は `crate::address_ref` / `crate::security` に委譲するだけの薄い層。

use serde::Serialize;
use std::path::Path;

/// フロントエンド向け: 参照アドレスリストの addresses マップ全体を JSON 文字列で返す。
/// パッチ未適用 / 参照リスト不在の場合は Err を返し、フロント側で機能を停止させる。
#[tauri::command]
pub fn get_reference_addresses() -> Result<String, String> {
    crate::address_ref::all_addresses_json()
}

/// アプリ内UI向け: 参照アドレス設定の現在状態を返す。
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AddressRefStatus {
    pub pointer_exists: bool,
    pub pointer_path: Option<String>,
    pub reference_list_path: Option<String>,
    pub list_reachable: bool,
    pub address_count: usize,
    pub error: Option<String>,
}

#[tauri::command]
pub fn get_address_ref_status() -> AddressRefStatus {
    let pointer_path =
        crate::address_ref::pointer_file_path().map(|p| p.to_string_lossy().to_string());
    let pointer_exists = pointer_path
        .as_ref()
        .map(|p| Path::new(p).exists())
        .unwrap_or(false);

    let (reference_list_path, mut error) = match crate::address_ref::current_reference_list_path() {
        Ok(p) => (Some(p), None),
        Err(e) => (None, Some(e)),
    };
    let list_reachable = reference_list_path
        .as_ref()
        .map(|p| Path::new(p).exists())
        .unwrap_or(false);

    let address_count = match crate::address_ref::all_addresses_json() {
        Ok(_) => crate::address_ref::address_count(),
        Err(e) => {
            if error.is_none() {
                error = Some(e);
            }
            0
        }
    };

    AddressRefStatus {
        pointer_exists,
        pointer_path,
        reference_list_path,
        list_reachable,
        address_count,
        error,
    }
}

// 参照先(ポインタ)の【変更】はアプリからは行わない。変更はパッチ
// (はじめに実行_参照先登録.bat)の適用時のみ。旧 apply_address_patch コマンドは廃止。

/// アプリ内UI向け: 参照アドレスリストを強制再読込し、件数を返す。
#[tauri::command]
pub fn reload_reference_addresses() -> Result<usize, String> {
    crate::address_ref::reload()?;
    Ok(crate::address_ref::address_count())
}

/// 起動時チェック向け: 共有の参照リスト(addresses.json)の最終更新時刻(UNIX秒)を返す。
/// フロント側で前回値と比較し、変化していれば更新を確認する。取得不可なら null。
#[tauri::command]
pub fn get_reference_list_mtime() -> Result<Option<u64>, String> {
    crate::address_ref::current_reference_list_mtime()
}

/// 利用者が読み込んだ(D&D/選択した)パスのフォルダを許可リストへ登録する。
/// 個別ファイルのD&Dではフォルダが未許可のままになり、後続の書き込み操作が
/// forbidden path で失敗するため、それを補う(ユーザー意図に基づく許可)。
/// 保護対象パスは grant_user_path 内の reject_protected_path で引き続き拒否される。
/// 失敗は無視(best-effort)。
#[tauri::command]
pub fn register_user_paths(paths: Vec<String>) {
    for p in &paths {
        let _ = crate::security::grant_user_path(p);
    }
}
