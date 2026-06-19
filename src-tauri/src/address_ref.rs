//! 参照アドレスリゾルバ。
//!
//! 機密性のあるパス・URL・固有名詞をソースコードに直打ちせず、外部の
//! 「参照アドレスリスト」(addresses.json) から実行時に読み込む。
//!
//! 解決の流れ:
//!   1. 環境変数 `COMICBRIDGE_ADDRESS_REF` があれば、それを addresses.json の
//!      フルパスとして直接使う(CI / 検証用のショートカット)。
//!   2. なければポインタファイル
//!        `%LOCALAPPDATA%\COMIC-Bridge\address-ref-location.json`
//!      を読み、その `referenceListPath` が指す addresses.json を使う。
//!      このポインタはパッチ(はじめに実行_参照先登録.bat)が書き込む。
//!
//! 見つからない / 壊れている場合はエラーを返し、呼び出し側の機能は停止する
//! (直打ちフォールバックは行わない = セキュリティ要件)。

use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

/// ポインタファイル(中立なローカル位置)。ソースに残る唯一のパスはこれだけ。
const POINTER_RELATIVE: &str = r"COMIC-Bridge\address-ref-location.json";
/// addresses.json を直接指す環境変数(パッチより優先)。
const ENV_DIRECT: &str = "COMICBRIDGE_ADDRESS_REF";
/// 暗号化済み参照リスト(割符方式)。アドレスフォルダに置く。これがあれば平文より優先。
const ENC_FILE: &str = "addresses.enc";
/// 割符(鍵の片割れ B)ファイル。アドレスフォルダに置く。16進64文字。
const SEAL_KEY_FILE: &str = "address-seal.key";

#[derive(Debug, Deserialize)]
struct Pointer {
    #[serde(rename = "referenceListPath")]
    reference_list_path: String,
}

/// 読み込み済みの参照データ。
pub struct RefData {
    addresses: HashMap<String, String>,
    photoshop_paths: Vec<String>,
    /// allowedRoots.userProfileFolders: ホーム配下の標準フォルダ名(Documents 等)。
    allowed_user_folders: Vec<String>,
    /// allowedRoots.extraPaths: 追加で許可する固定フォルダ(G:の指定フォルダ等)。
    allowed_extra_paths: Vec<String>,
}

impl RefData {
    pub fn get(&self, key: &str) -> Option<&str> {
        self.addresses.get(key).map(|s| s.as_str())
    }
    pub fn addresses(&self) -> &HashMap<String, String> {
        &self.addresses
    }
    pub fn photoshop_paths(&self) -> &[String] {
        &self.photoshop_paths
    }
    pub fn allowed_user_folders(&self) -> &[String] {
        &self.allowed_user_folders
    }
    pub fn allowed_extra_paths(&self) -> &[String] {
        &self.allowed_extra_paths
    }
}

/// 読み込み済みデータのキャッシュ(成功時のみ Some)。
/// 失敗時は None のままなので次回アクセスで再試行され、(アプリ起動後に)
/// パッチを当てれば回復できる。reload() で明示的に再読込もできる。
static CACHE: OnceLock<Mutex<Option<RefData>>> = OnceLock::new();

fn cell() -> &'static Mutex<Option<RefData>> {
    CACHE.get_or_init(|| Mutex::new(None))
}

/// キャッシュ(なければロード)に対してクロージャを適用する。
fn with_data<T>(f: impl FnOnce(&RefData) -> T) -> Result<T, String> {
    let mut guard = cell()
        .lock()
        .map_err(|_| "address_ref lock poisoned".to_string())?;
    if guard.is_none() {
        *guard = Some(load()?);
    }
    Ok(f(guard.as_ref().expect("just loaded")))
}

/// 参照リストを強制的に再読込する(アプリ内UIでポインタを更新した後などに使う)。
pub fn reload() -> Result<(), String> {
    let data = load()?;
    let mut guard = cell()
        .lock()
        .map_err(|_| "address_ref lock poisoned".to_string())?;
    *guard = Some(data);
    Ok(())
}

fn strip_bom(s: &str) -> &str {
    s.strip_prefix('\u{feff}').unwrap_or(s)
}

/// 起動時の割符(わりふ)チェック。
/// - アドレスフォルダに `addresses.enc` がある(=暗号化運用)場合は、割符
///   `address-seal.key` での復号が成功することを必須で確認する → 成功で `Ok(true)`。
/// - `addresses.enc` が無い(平文運用)場合はチェック対象外 → `Ok(false)`。
/// - 参照先が未解決(共有未接続/パッチ未適用)もチェック対象外 → `Ok(false)`。
///   (起動自体は妨げない。各機能は実際の参照時にエラー停止する従来挙動)
/// - enc はあるのに割符が無い/一致しない/壊れている場合のみ `Err`。
pub fn verify_seal() -> Result<bool, String> {
    let list_path = match resolve_list_path() {
        Ok(p) => p,
        Err(_) => return Ok(false),
    };
    let folder = match list_path.parent() {
        Some(f) => f,
        None => return Ok(false),
    };
    if !folder.join(ENC_FILE).exists() {
        return Ok(false);
    }
    decrypt_enc(folder)?;
    Ok(true)
}

/// addresses.json のフルパスを解決する。
fn resolve_list_path() -> Result<PathBuf, String> {
    if let Ok(direct) = std::env::var(ENV_DIRECT) {
        if !direct.trim().is_empty() {
            return Ok(PathBuf::from(direct));
        }
    }

    let local = std::env::var("LOCALAPPDATA")
        .map_err(|_| "LOCALAPPDATA 環境変数を取得できません".to_string())?;
    let pointer_path = Path::new(&local).join(POINTER_RELATIVE);

    let raw = fs::read_to_string(&pointer_path).map_err(|e| {
        format!(
            "参照アドレスのポインタを読み込めません ({}): {}。\
             パッチ はじめに実行_参照先登録.bat を実行してください。",
            pointer_path.display(),
            e
        )
    })?;
    let ptr: Pointer = serde_json::from_str(strip_bom(&raw))
        .map_err(|e| format!("ポインタJSONの解析に失敗しました: {}", e))?;

    let list_path = ptr.reference_list_path.trim().to_string();
    if list_path.is_empty() {
        return Err("ポインタの referenceListPath が空です".to_string());
    }
    Ok(PathBuf::from(list_path))
}

/// 割符(鍵の片割れ B)をアドレスフォルダから読む。32バイト。
fn read_seal_b(folder: &Path) -> Result<[u8; 32], String> {
    let key_path = folder.join(SEAL_KEY_FILE);
    let text = fs::read_to_string(&key_path).map_err(|e| {
        format!(
            "割符ファイルを読み込めません ({}): {}。\
             アドレスフォルダに {} を配置してください。",
            key_path.display(),
            e,
            SEAL_KEY_FILE
        )
    })?;
    crate::crypto::parse_seal_hex(&text)
}

/// アドレスフォルダの `addresses.enc` を割符で復号し、平文バイト列を返す。
/// (enc の存在チェックは呼び出し側で行う。verify_seal / read_addresses_raw で共用。)
fn decrypt_enc(folder: &Path) -> Result<Vec<u8>, String> {
    let enc_path = folder.join(ENC_FILE);
    let enc = fs::read(&enc_path).map_err(|e| {
        format!(
            "暗号化参照リストを読み込めません ({}): {}",
            enc_path.display(),
            e
        )
    })?;
    let seal_b = read_seal_b(folder)?;
    crate::crypto::decrypt(&enc, &seal_b)
}

/// 参照リストの平文(JSON文字列)を取得する。
/// アドレスフォルダに `addresses.enc` があれば割符で復号し、無ければ
/// 従来どおり平文 `addresses.json`(= list_path)を読む(移行期フォールバック)。
fn read_addresses_raw(list_path: &Path) -> Result<String, String> {
    let folder = list_path
        .parent()
        .ok_or_else(|| "参照リストの親フォルダを特定できません".to_string())?;
    if folder.join(ENC_FILE).exists() {
        let plain = decrypt_enc(folder)?;
        return String::from_utf8(plain)
            .map_err(|e| format!("復号結果がUTF-8ではありません: {}", e));
    }
    // フォールバック: 平文 addresses.json(暗号化前/未シール環境)。
    fs::read_to_string(list_path).map_err(|e| {
        format!(
            "参照アドレスリストを読み込めません ({}): {}",
            list_path.display(),
            e
        )
    })
}

/// addresses.json を読み込んで RefData を構築する。
fn load() -> Result<RefData, String> {
    let list_path = resolve_list_path()?;
    let raw = read_addresses_raw(&list_path)?;
    let v: Value = serde_json::from_str(strip_bom(&raw))
        .map_err(|e| format!("参照アドレスリストJSONの解析に失敗しました: {}", e))?;

    let mut addresses = HashMap::new();
    match v.get("addresses").and_then(|x| x.as_object()) {
        Some(map) => {
            for (k, val) in map {
                if let Some(s) = val.as_str() {
                    addresses.insert(k.clone(), s.to_string());
                }
            }
        }
        None => return Err("参照アドレスリストに 'addresses' オブジェクトがありません".to_string()),
    }

    let mut photoshop_paths = Vec::new();
    if let Some(arr) = v
        .pointer("/photoshop/candidatePaths")
        .and_then(|x| x.as_array())
    {
        for item in arr {
            if let Some(s) = item.as_str() {
                photoshop_paths.push(s.to_string());
            }
        }
    }

    // allowedRoots: アプリが読み書きを許可する場所の正本(セキュリティ許可リスト)。
    let read_str_array = |path: &str| -> Vec<String> {
        v.pointer(path)
            .and_then(|x| x.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|i| i.as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default()
    };
    let allowed_user_folders = read_str_array("/allowedRoots/userProfileFolders");
    let allowed_extra_paths = read_str_array("/allowedRoots/extraPaths");

    Ok(RefData {
        addresses,
        photoshop_paths,
        allowed_user_folders,
        allowed_extra_paths,
    })
}

/// キー必須取得。無ければエラー(= 呼び出し側機能を停止させる)。
pub fn get(key: &str) -> Result<String, String> {
    with_data(|d| d.get(key).map(|s| s.to_string()))?
        .ok_or_else(|| format!("参照アドレスにキー '{}' がありません", key))
}

/// キー任意取得。未ロード / 欠落時は None。
pub fn get_opt(key: &str) -> Option<String> {
    with_data(|d| d.get(key).map(|s| s.to_string()))
        .ok()
        .flatten()
}

/// Photoshop 実行ファイル候補パス一覧(未ロード時は空)。
pub fn photoshop_candidate_paths() -> Vec<String> {
    with_data(|d| d.photoshop_paths().to_vec()).unwrap_or_default()
}

/// 絶対パスらしい文字列か(`X:\` / `X:/` / UNC `\\`)。
fn looks_absolute(s: &str) -> bool {
    let b = s.as_bytes();
    s.starts_with("\\\\")
        || (b.len() >= 3
            && b[1] == b':'
            && (b[2] == b'\\' || b[2] == b'/')
            && b[0].is_ascii_alphabetic())
}

/// allowedRoots.userProfileFolders(ホーム配下の標準フォルダ名。未ロード時は空)。
pub fn allowed_user_folders() -> Vec<String> {
    with_data(|d| d.allowed_user_folders().to_vec()).unwrap_or_default()
}

/// allowedRoots.extraPaths(追加で許可する固定フォルダ。未ロード時は空)。
pub fn allowed_extra_paths() -> Vec<String> {
    with_data(|d| d.allowed_extra_paths().to_vec()).unwrap_or_default()
}

/// addresses 内で絶対パスに見える値の一覧(content.* / font.sharePath 等。未ロード時は空)。
pub fn address_path_values() -> Vec<String> {
    with_data(|d| {
        d.addresses()
            .values()
            .filter(|v| looks_absolute(v))
            .cloned()
            .collect::<Vec<_>>()
    })
    .unwrap_or_default()
}

/// 参照アドレスの件数(未ロード時は 0)。
pub fn address_count() -> usize {
    with_data(|d| d.addresses().len()).unwrap_or(0)
}

/// フロントエンドへ返すための addresses マップ全体(JSON文字列)。
pub fn all_addresses_json() -> Result<String, String> {
    with_data(|d| serde_json::to_string(d.addresses()))?
        .map_err(|e| format!("参照アドレスのシリアライズに失敗しました: {}", e))
}

/// ポインタファイル(%LOCALAPPDATA%\COMIC-Bridge\address-ref-location.json)のパス。
pub fn pointer_file_path() -> Option<PathBuf> {
    std::env::var("LOCALAPPDATA")
        .ok()
        .map(|l| Path::new(&l).join(POINTER_RELATIVE))
}

/// 現在解決される参照リストのパス(env優先→ポインタ)。リスト本体は読み込まない。
pub fn current_reference_list_path() -> Result<String, String> {
    resolve_list_path().map(|p| p.to_string_lossy().to_string())
}

/// 現在解決される参照リスト(addresses.json)の最終更新時刻(UNIX epoch 秒)。
/// 共有先が更新されたかの検出に使う。メタデータ取得に失敗したら None。
pub fn current_reference_list_mtime() -> Result<Option<u64>, String> {
    let path = resolve_list_path()?;
    let secs = fs::metadata(&path)
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs());
    Ok(secs)
}

// 参照先ポインタの【書き込み】はこのリゾルバからは行わない(旧 write_pointer は廃止)。
// ポインタの作成・変更はパッチ(はじめに実行_参照先登録.bat)の適用時のみ。
// アプリは env / ポインタを【読む】だけ。
