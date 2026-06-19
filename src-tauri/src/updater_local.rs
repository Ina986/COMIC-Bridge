//! G:ドライブ(共有)からの更新 — GitHub 非依存。
//!
//! 更新置き場(参照アドレス `updater.localDir`)に置かれた
//! `<App>_X.Y.Z_x64-setup.exe` ＋ 同名 `.sig`(minisign 署名) を探し、
//! **アプリ内蔵の公開鍵(参照アドレス `updater.pubkey`)で署名検証**してから適用する。
//! 署名のない/改ざんされた/別鍵の exe は拒否する（共有に悪意 exe を置かれても弾く）。
//! 取得元が GitHub から G: に替わるだけで、信頼基盤は従来と同じ minisign。

use serde::Serialize;
use std::path::PathBuf;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalUpdateInfo {
    pub version: String,
    pub current_version: String,
    pub setup_path: String,
    pub modified_secs: Option<u64>,
}

fn current_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

/// 更新置き場(共有)内の「このアプリ専用サブフォルダ」名。
/// 1つの更新置き場を複数アプリで共有し、各アプリは自分のフォルダ(更新置き場\<App>)だけを見る。
/// 横展開時はアプリ名へ置換する。サブフォルダが無ければ直下を見る（旧レイアウト＝移行用フォールバック）。
const APP_UPDATE_SUBDIR: &str = "COMIC-Bridge";

/// 更新を探すフォルダを解決する。
/// `updater.localDir`（共有の更新置き場）配下の **アプリ別サブフォルダ** を優先し、
/// 無ければ更新置き場直下を使う（旧レイアウトからの移行を壊さないため）。
fn resolve_update_dir() -> Result<Option<PathBuf>, String> {
    let base = match crate::address_ref::get_opt("updater.localDir") {
        Some(d) if !d.trim().is_empty() => d,
        _ => return Ok(None), // 参照先未解決(G:未接続/パッチ未適用)＝更新なし扱い
    };
    let base_dir = crate::security::ensure_directory_read_path(&base)?; // 許可リスト＋canonical
    // アプリ別サブフォルダ(更新置き場\<App>)を優先。無ければ直下＝旧レイアウト(移行用)。
    let sub = base_dir.join(APP_UPDATE_SUBDIR);
    if sub.is_dir() {
        Ok(Some(crate::security::ensure_directory_read_path(&sub)?))
    } else {
        Ok(Some(base_dir))
    }
}

/// "1.9.35" → (1,9,35)。比較用。余分が付くと None。
fn version_tuple(v: &str) -> Option<(u32, u32, u32)> {
    let mut it = v.split('.');
    let a = it.next()?.trim().parse::<u32>().ok()?;
    let b = it.next()?.trim().parse::<u32>().ok()?;
    let c = it.next()?.trim().parse::<u32>().ok()?;
    if it.next().is_some() {
        return None;
    }
    Some((a, b, c))
}

/// "Comic-Bridge_1.9.35_x64-setup.exe" → "1.9.35"（末尾 _x64-setup.exe の直前の塊）。
fn version_from_filename(name: &str) -> Option<String> {
    const SUFFIX: &str = "_x64-setup.exe";
    if !name.to_ascii_lowercase().ends_with(SUFFIX) {
        return None;
    }
    let stem = &name[..name.len() - SUFFIX.len()];
    let ver = stem.rsplit('_').next()?;
    version_tuple(ver).map(|_| ver.to_string())
}

fn b64_decode(s: &str) -> Result<Vec<u8>, String> {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD
        .decode(s.trim())
        .map_err(|e| format!("base64 デコード失敗: {}", e))
}

/// minisign 署名検証。
/// `pubkey_b64` = 参照アドレスの updater.pubkey（minisign 公開鍵ファイルの base64）。
/// `sig_file_b64` = `<exe>.sig` の中身（minisign 署名ファイルの base64。Tauri 生成形式）。
fn verify_minisign(pubkey_b64: &str, sig_file_b64: &str, data: &[u8]) -> Result<(), String> {
    let pk_text = String::from_utf8(b64_decode(pubkey_b64)?)
        .map_err(|e| format!("公開鍵のUTF-8変換失敗: {}", e))?;
    let public_key = minisign_verify::PublicKey::decode(pk_text.trim())
        .map_err(|e| format!("公開鍵の解析に失敗: {}", e))?;
    let sig_text = String::from_utf8(b64_decode(sig_file_b64)?)
        .map_err(|e| format!("署名のUTF-8変換失敗: {}", e))?;
    let signature = minisign_verify::Signature::decode(&sig_text)
        .map_err(|e| format!("署名の解析に失敗: {}", e))?;
    public_key
        .verify(data, &signature, true)
        .map_err(|e| format!("署名検証に失敗（未署名/改ざん/別鍵の可能性）: {}", e))
}

/// 更新置き場(G:)で「現行より新しい・署名検証済みの最新版」を探す。無ければ Ok(None)。
fn find_verified_latest() -> Result<Option<LocalUpdateInfo>, String> {
    let dir = match resolve_update_dir()? {
        Some(d) => d,
        None => return Ok(None), // 参照先未解決(G:未接続/パッチ未適用)＝更新なし扱い
    };
    let cur = version_tuple(current_version()).ok_or("現行バージョンの解析に失敗")?;
    let pubkey = crate::address_ref::get_opt("updater.pubkey")
        .filter(|s| !s.trim().is_empty())
        .ok_or("更新の公開鍵(updater.pubkey)が未解決")?;

    // 現行より新しい最大バージョンを選ぶ
    let mut best: Option<((u32, u32, u32), String, PathBuf)> = None;
    for entry in std::fs::read_dir(&dir).map_err(|e| format!("更新置き場を読めません: {}", e))? {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let path = entry.path();
        let name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n,
            None => continue,
        };
        let ver = match version_from_filename(name) {
            Some(v) => v,
            None => continue,
        };
        let vt = version_tuple(&ver).unwrap();
        if vt <= cur {
            continue; // 現行以下は対象外
        }
        if best.as_ref().map(|(b, _, _)| vt > *b).unwrap_or(true) {
            best = Some((vt, ver, path));
        }
    }
    let (_, ver, exe) = match best {
        Some(b) => b,
        None => return Ok(None),
    };

    // 署名検証（.sig = <exe>.sig）。ここで未署名/改ざん exe を拒否する。
    let sig_path = format!("{}.sig", exe.to_string_lossy());
    let data = std::fs::read(&exe).map_err(|e| format!("更新exeを読めません: {}", e))?;
    let sig = std::fs::read_to_string(&sig_path)
        .map_err(|e| format!("署名(.sig)を読めません（未署名のため適用しません）: {}", e))?;
    verify_minisign(&pubkey, &sig, &data)?;

    let modified_secs = std::fs::metadata(&exe)
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs());

    Ok(Some(LocalUpdateInfo {
        version: ver,
        current_version: current_version().to_string(),
        setup_path: exe.to_string_lossy().to_string(),
        modified_secs,
    }))
}

/// 起動時/手動で呼ぶ。更新があれば情報を返す（署名検証済みのもののみ）。
#[tauri::command]
pub async fn check_local_update() -> Result<Option<LocalUpdateInfo>, String> {
    find_verified_latest()
}

/// 更新を適用：再探索＋再検証 → ローカル temp へコピー → 再検証 → インストーラ起動 → アプリ終了。
#[tauri::command]
pub async fn apply_local_update(app: tauri::AppHandle, setup_path: String) -> Result<(), String> {
    // フロントから来たパスを丸ごと信用せず、再探索＋再検証して一致を確認する。
    let info = find_verified_latest()?.ok_or("適用可能な更新が見つかりません")?;
    if info.setup_path != setup_path {
        return Err("更新対象が変化しました。もう一度確認してください。".to_string());
    }
    let exe = crate::security::ensure_read_path(&info.setup_path)?;

    // 共有から直接実行せず、ローカル temp(update カテゴリ)へコピーしてから起動する。
    let temp = crate::security::temp_subdir("update");
    let local = temp.join(exe.file_name().ok_or("ファイル名を取得できません")?);
    std::fs::copy(&exe, &local).map_err(|e| format!("更新exeのコピーに失敗: {}", e))?;

    // コピー後にもう一度署名検証（temp 差し替え対策＝同一ユーザーTOCTOU緩和）。
    let pubkey = crate::address_ref::get_opt("updater.pubkey").ok_or("公開鍵が未解決")?;
    let sig = std::fs::read_to_string(format!("{}.sig", exe.to_string_lossy()))
        .map_err(|e| format!("署名(.sig)を読めません: {}", e))?;
    let copied = std::fs::read(&local).map_err(|e| format!("コピー先を読めません: {}", e))?;
    verify_minisign(&pubkey, &sig, &copied)?;

    // インストーラ(NSIS setup.exe)を**サイレント自動更新**で起動する（本家 Tauri updater と同じ引数）。
    //   /S      = サイレント（セットアップ画面を出さない）
    //   /R      = インストール完了後にアプリを自動再起動
    //   /UPDATE = 更新モード（実行中アプリの終了待ち・上書き等を内部処理）
    // ※ ShellExecute 経由は G: 由来の Mark-of-the-Web により SmartScreen で阻まれ得るため、
    //    CreateProcess(直接生成)で起動する（MOTW/SmartScreen 非経由＝確実に起動）。引数解釈は同じ。
    std::process::Command::new(&local)
        .args(["/S", "/R", "/UPDATE"])
        .current_dir(&temp)
        .spawn()
        .map_err(|e| format!("インストーラの起動に失敗: {}", e))?;
    // アプリを終了してインストーラに上書きさせる（/R により更新後に自動再起動される）。
    app.exit(0);
    Ok(())
}
