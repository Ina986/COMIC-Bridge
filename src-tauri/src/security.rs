use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use tauri_plugin_dialog::DialogExt;

// 共有ドライブ・フォントサーバ等の機密パスは直打ちせず、参照アドレスリストから
// 実行時に解決して許可ルートへ追加する(roots() を参照)。
//   content.jsonFolder    … JSON検索ベース
//   content.jsonAccessLog … JSONアクセスログ出力先
//   font.sharePath       … 共有フォントフォルダ(UNC)
const FORBIDDEN_PATH: &str = "forbidden path";

static ALLOWED_ROOTS: OnceLock<Mutex<HashSet<PathBuf>>> = OnceLock::new();

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DialogFilter {
    pub name: String,
    pub extensions: Vec<String>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SecureOpenDialogOptions {
    pub directory: Option<bool>,
    pub multiple: Option<bool>,
    pub title: Option<String>,
    pub default_path: Option<String>,
    pub filters: Option<Vec<DialogFilter>>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SecureSaveDialogOptions {
    pub title: Option<String>,
    pub default_path: Option<String>,
    pub filters: Option<Vec<DialogFilter>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SecureDirEntry {
    pub name: String,
    pub is_file: bool,
    pub is_directory: bool,
    pub is_symlink: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SecureMetadata {
    pub is_file: bool,
    pub is_directory: bool,
    pub is_symlink: bool,
    pub size: u64,
    pub modified_secs: Option<u64>,
}

pub fn app_temp_dir() -> PathBuf {
    std::env::temp_dir().join("COMIC-Bridge")
}

/// 一時フォルダ(Temp\COMIC-Bridge)を作成し、ACLを「現ユーザ＋SYSTEMのみ」に絞る（初回1回）。
/// 継承された広い許可を切り、他アカウント/管理者グループからの一時ファイル閲覧を抑止する緩和策。
/// （同一ユーザ権限で動くプロセスは対象外＝強固な隔離ではなく defense-in-depth）。
pub fn harden_temp_dir() {
    static DONE: OnceLock<()> = OnceLock::new();
    let _ = DONE.get_or_init(|| {
        let dir = app_temp_dir();
        let _ = fs::create_dir_all(&dir);
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            if let Ok(user) = std::env::var("USERNAME") {
                let icacls_out = std::process::Command::new("icacls")
                    .arg(&dir)
                    .args([
                        "/inheritance:r",
                        "/grant:r",
                        &format!("{}:(OI)(CI)F", user),
                        "/grant:r",
                        "SYSTEM:(OI)(CI)F",
                    ])
                    .creation_flags(CREATE_NO_WINDOW)
                    .output();
                // icacls 失敗をサイレントにせず可視化する（temp が継承ACLのまま＝
                // 他アカウント閲覧の余地になり得るため。診断用に release でも eprintln）。
                match icacls_out {
                    Ok(o) if o.status.success() => {}
                    Ok(o) => eprintln!(
                        "[temp-acl] icacls 非成功(code {:?})。Temp\\COMIC-Bridge が継承ACLのままの可能性",
                        o.status.code()
                    ),
                    Err(e) => {
                        eprintln!("[temp-acl] icacls 実行不可: {}。Temp\\COMIC-Bridge が継承ACLのまま", e)
                    }
                }
            }
        }
    });
}

/// 一時データのカテゴリ別サブフォルダ `%TEMP%\COMIC-Bridge\<category>` を返す（無ければ作成）。
/// 姉妹アプリ統一仕様。カテゴリ: update/preview/convert/pdf/work/print。
/// ルートは harden_temp_dir() で ACL 強化済みのため、サブフォルダは (OI)(CI) 継承で保護される。
pub fn temp_subdir(category: &str) -> PathBuf {
    let dir = app_temp_dir().join(category);
    let _ = fs::create_dir_all(&dir);
    dir
}

/// 起動時に前回セッションの残存一時ファイルを掃除（best-effort・使用中はスキップ）。
/// `%TEMP%\COMIC-Bridge` 配下は再生成可能な一時データのみのため全削除して問題ない。
/// 掃除後にカテゴリ dir を作り直す。旧バージョンで `%TEMP%` 直下に散在させていた作業 dir も後始末する。
/// ※永続キャッシュ（`%LOCALAPPDATA%`/`%APPDATA%` 側）は対象外。
pub fn cleanup_temp_on_startup() {
    let root = app_temp_dir();
    let _ = fs::create_dir_all(&root);
    // ルートを ACL 強化（以降のサブフォルダが (OI)(CI) 継承）。
    harden_temp_dir();
    // ルート配下を全削除（再生成可能な一時データのみ。ロック中はスキップ）。
    if let Ok(entries) = fs::read_dir(&root) {
        for e in entries.flatten() {
            let p = e.path();
            if p.is_dir() {
                let _ = fs::remove_dir_all(&p);
            } else {
                let _ = fs::remove_file(&p);
            }
        }
    }
    // 旧バージョンが `%TEMP%` 直下に作っていた作業 dir / 固定名の後始末（best-effort）。
    let t = std::env::temp_dir();
    for old in ["comicbridge_work", "cb_pdf_jpeg", "comic_bridge_preview"] {
        let _ = fs::remove_dir_all(t.join(old));
    }
    // カテゴリ dir を用意。
    for c in ["update", "preview", "convert", "pdf", "work"] {
        let _ = fs::create_dir_all(root.join(c));
    }
}

pub fn init() {
    let _ = roots();
}

fn roots() -> &'static Mutex<HashSet<PathBuf>> {
    ALLOWED_ROOTS.get_or_init(|| {
        let mut set = HashSet::new();

        // (A) アプリ内部用(JSX連携の交換ファイル・ポインタ・フォント導入)。常に必要。
        add_default_root(&mut set, app_temp_dir(), true);
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            add_default_root(
                &mut set,
                Path::new(&local_app_data).join("COMIC-Bridge"),
                true,
            );
            add_default_root(
                &mut set,
                Path::new(&local_app_data)
                    .join("Microsoft")
                    .join("Windows")
                    .join("Fonts"),
                true,
            );
        }

        // (B) ホーム配下の標準フォルダ(allowedRoots.userProfileFolders)。
        //     物理パス USERPROFILE\<name> と、OneDrive リダイレクト先
        //     (USERPROFILE\OneDrive*)を丸ごと許可してリダイレクト環境にも対応する。
        if let Ok(home) = std::env::var("USERPROFILE") {
            let home = Path::new(&home);
            for name in crate::address_ref::allowed_user_folders() {
                add_default_root(&mut set, home.join(&name), false);
            }
            if let Ok(entries) = fs::read_dir(home) {
                for e in entries.flatten() {
                    let p = e.path();
                    if p.is_dir() {
                        if let Some(n) = p.file_name().and_then(|n| n.to_str()) {
                            if n.starts_with("OneDrive") {
                                add_default_root(&mut set, p, false);
                            }
                        }
                    }
                }
            }
        }

        // (C) addresses.json の許可フォルダ: extraPaths(指定フォルダ)＋
        //     addresses 内の各パス値(content.* / font.sharePath 等)。
        for p in crate::address_ref::allowed_extra_paths() {
            add_default_root(&mut set, PathBuf::from(p), false);
        }
        for p in crate::address_ref::address_path_values() {
            add_default_root(&mut set, PathBuf::from(p), false);
        }

        // (D) 利用者がアプリのダイアログ等で選択したファイルのフォルダは
        //     実行時に grant_user_path() で動的に追加される(secure_open_dialog 等)。

        Mutex::new(set)
    })
}

fn add_default_root(set: &mut HashSet<PathBuf>, path: PathBuf, create: bool) {
    if create {
        let _ = fs::create_dir_all(&path);
    }
    if let Ok(canon) = fs::canonicalize(&path) {
        set.insert(canon);
    }
}

pub fn grant_user_path(path: impl AsRef<Path>) -> Result<(), String> {
    let path = path.as_ref();
    let root = if path.exists() {
        let canon = canonicalize_existing(path)?;
        if canon.is_file() {
            canon
                .parent()
                .ok_or_else(|| FORBIDDEN_PATH.to_string())?
                .to_path_buf()
        } else {
            canon
        }
    } else {
        let parent = path.parent().ok_or_else(|| FORBIDDEN_PATH.to_string())?;
        canonicalize_existing(parent)?
    };

    reject_protected_path(&root)?;
    let mut guard = roots().lock().map_err(|_| FORBIDDEN_PATH.to_string())?;
    guard.insert(root);
    Ok(())
}

pub fn grant_user_paths<I, P>(paths: I) -> Result<(), String>
where
    I: IntoIterator<Item = P>,
    P: AsRef<Path>,
{
    for path in paths {
        grant_user_path(path)?;
    }
    Ok(())
}

pub fn ensure_read_path(path: impl AsRef<Path>) -> Result<PathBuf, String> {
    let canon = canonicalize_existing(path.as_ref())?;
    reject_protected_path(&canon)?;
    ensure_allowed(&canon)?;
    Ok(canon)
}

pub fn ensure_directory_read_path(path: impl AsRef<Path>) -> Result<PathBuf, String> {
    let canon = ensure_read_path(path)?;
    if !canon.is_dir() {
        return Err(FORBIDDEN_PATH.to_string());
    }
    Ok(canon)
}

pub fn ensure_write_path(path: impl AsRef<Path>) -> Result<PathBuf, String> {
    let path = path.as_ref();
    let target = if path.exists() {
        canonicalize_existing(path)?
    } else {
        canonicalize_for_new_path(path)?
    };
    reject_protected_path(&target)?;
    ensure_allowed(&target)?;
    Ok(target)
}

pub fn ensure_query_path(path: impl AsRef<Path>) -> Result<PathBuf, String> {
    let path = path.as_ref();
    if path.exists() {
        ensure_read_path(path)
    } else {
        ensure_write_path(path)
    }
}

pub fn validate_json_paths(value: &serde_json::Value) -> Result<(), String> {
    match value {
        serde_json::Value::String(s) => {
            if looks_like_absolute_path(s) {
                ensure_query_path(s)?;
            }
        }
        serde_json::Value::Array(items) => {
            for item in items {
                validate_json_paths(item)?;
            }
        }
        serde_json::Value::Object(map) => {
            for item in map.values() {
                validate_json_paths(item)?;
            }
        }
        _ => {}
    }
    Ok(())
}

pub fn validate_file_name(file_name: &str) -> Result<(), String> {
    if file_name.is_empty() {
        return Err(FORBIDDEN_PATH.to_string());
    }
    if file_name.trim() != file_name || file_name.ends_with('.') {
        return Err(FORBIDDEN_PATH.to_string());
    }
    if file_name == "." || file_name == ".." {
        return Err(FORBIDDEN_PATH.to_string());
    }
    if file_name.contains('\\') || file_name.contains('/') {
        return Err(FORBIDDEN_PATH.to_string());
    }
    if file_name
        .chars()
        .any(|c| c.is_control() || matches!(c, ':' | '*' | '?' | '"' | '<' | '>' | '|'))
    {
        return Err(FORBIDDEN_PATH.to_string());
    }

    let stem = file_name
        .split('.')
        .next()
        .unwrap_or(file_name)
        .to_ascii_uppercase();
    let reserved = matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || stem
            .strip_prefix("COM")
            .and_then(|n| n.parse::<u8>().ok())
            .map(|n| (1..=9).contains(&n))
            .unwrap_or(false)
        || stem
            .strip_prefix("LPT")
            .and_then(|n| n.parse::<u8>().ok())
            .map(|n| (1..=9).contains(&n))
            .unwrap_or(false);
    if reserved {
        return Err(FORBIDDEN_PATH.to_string());
    }

    Ok(())
}

fn canonicalize_existing(path: &Path) -> Result<PathBuf, String> {
    fs::canonicalize(path).map_err(|_| FORBIDDEN_PATH.to_string())
}

fn canonicalize_for_new_path(path: &Path) -> Result<PathBuf, String> {
    let mut missing_components = Vec::new();
    let mut cursor = path;

    while !cursor.exists() {
        let name = cursor
            .file_name()
            .and_then(|n| n.to_str())
            .ok_or_else(|| FORBIDDEN_PATH.to_string())?;
        validate_file_name(name)?;
        missing_components.push(name.to_string());
        cursor = cursor.parent().ok_or_else(|| FORBIDDEN_PATH.to_string())?;
    }

    let mut canon = canonicalize_existing(cursor)?;
    for name in missing_components.iter().rev() {
        canon.push(name);
    }
    Ok(canon)
}

fn ensure_allowed(canon: &Path) -> Result<(), String> {
    // 許可リスト(ALLOWED_ROOTS)方式を有効化(ユーザー判断・2026-06-03再厳格化)。
    // 許可される場所は roots() が構築する: ホーム標準フォルダ + addresses.json の
    // allowedRoots/各パス値 + 利用者が選択したファイルのフォルダ(grant_user_path) のみ。
    let guard = roots().lock().map_err(|_| FORBIDDEN_PATH.to_string())?;
    if guard
        .iter()
        .any(|root| canon == root || canon.starts_with(root))
    {
        return Ok(());
    }
    Err(FORBIDDEN_PATH.to_string())
}

fn looks_like_absolute_path(value: &str) -> bool {
    let normalized = value.replace('/', "\\");
    let bytes = normalized.as_bytes();
    normalized.starts_with(r"\\")
        || (bytes.len() >= 3
            && bytes[1] == b':'
            && bytes[2] == b'\\'
            && bytes[0].is_ascii_alphabetic())
}

fn reject_protected_path(path: &Path) -> Result<(), String> {
    if is_drive_root(path) || is_user_home_root(path) || is_under_system_root(path) {
        return Err(FORBIDDEN_PATH.to_string());
    }
    Ok(())
}

fn is_drive_root(path: &Path) -> bool {
    path.parent().is_none()
        || path
            .components()
            .filter(|c| !matches!(c, Component::Prefix(_) | Component::RootDir))
            .count()
            == 0
}

fn is_user_home_root(path: &Path) -> bool {
    std::env::var("USERPROFILE")
        .ok()
        .and_then(|home| fs::canonicalize(home).ok())
        .map(|home| path == home)
        .unwrap_or(false)
}

fn is_under_system_root(path: &Path) -> bool {
    let mut protected = Vec::new();
    for var in ["WINDIR", "ProgramFiles", "ProgramFiles(x86)", "ProgramData"] {
        if let Ok(value) = std::env::var(var) {
            if let Ok(canon) = fs::canonicalize(value) {
                protected.push(canon);
            }
        }
    }

    protected
        .iter()
        .any(|root| path == root || path.starts_with(root))
}

fn apply_filters<R: tauri::Runtime>(
    mut builder: tauri_plugin_dialog::FileDialogBuilder<R>,
    filters: Option<Vec<DialogFilter>>,
) -> tauri_plugin_dialog::FileDialogBuilder<R> {
    if let Some(filters) = filters {
        for filter in filters {
            let extensions = filter
                .extensions
                .iter()
                .map(String::as_str)
                .collect::<Vec<_>>();
            builder = builder.add_filter(filter.name, &extensions);
        }
    }
    builder
}

fn apply_default_path<R: tauri::Runtime>(
    mut builder: tauri_plugin_dialog::FileDialogBuilder<R>,
    default_path: Option<String>,
    is_save: bool,
) -> tauri_plugin_dialog::FileDialogBuilder<R> {
    let Some(default_path) = default_path else {
        return builder;
    };
    let path = PathBuf::from(default_path);
    if is_save {
        if let Some(parent) = path.parent() {
            builder = builder.set_directory(parent);
        }
        if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
            builder = builder.set_file_name(name);
        }
    } else if path.is_dir() {
        builder = builder.set_directory(path);
    } else if let Some(parent) = path.parent() {
        builder = builder.set_directory(parent);
    }
    builder
}

#[tauri::command]
pub async fn secure_open_dialog(
    app_handle: tauri::AppHandle,
    options: SecureOpenDialogOptions,
) -> Result<Option<serde_json::Value>, String> {
    let mut builder = app_handle.dialog().file();
    if let Some(title) = options.title {
        builder = builder.set_title(title);
    }
    builder = apply_default_path(builder, options.default_path, false);
    builder = apply_filters(builder, options.filters);

    let directory = options.directory.unwrap_or(false);
    let multiple = options.multiple.unwrap_or(false);

    if directory {
        if multiple {
            let paths = builder
                .blocking_pick_folders()
                .map(|paths| {
                    paths
                        .into_iter()
                        .map(|path| path.into_path().map_err(|e| e.to_string()))
                        .collect::<Result<Vec<_>, _>>()
                })
                .transpose()?;
            if let Some(paths) = paths {
                grant_user_paths(&paths)?;
                return Ok(Some(serde_json::json!(paths
                    .iter()
                    .map(|path| path.to_string_lossy().to_string())
                    .collect::<Vec<_>>())));
            }
            return Ok(None);
        }

        let path = builder
            .blocking_pick_folder()
            .map(|path| path.into_path().map_err(|e| e.to_string()))
            .transpose()?;
        if let Some(path) = path {
            grant_user_path(&path)?;
            return Ok(Some(serde_json::json!(path.to_string_lossy().to_string())));
        }
        return Ok(None);
    }

    if multiple {
        let paths = builder
            .blocking_pick_files()
            .map(|paths| {
                paths
                    .into_iter()
                    .map(|path| path.into_path().map_err(|e| e.to_string()))
                    .collect::<Result<Vec<_>, _>>()
            })
            .transpose()?;
        if let Some(paths) = paths {
            grant_user_paths(&paths)?;
            return Ok(Some(serde_json::json!(paths
                .iter()
                .map(|path| path.to_string_lossy().to_string())
                .collect::<Vec<_>>())));
        }
        return Ok(None);
    }

    let path = builder
        .blocking_pick_file()
        .map(|path| path.into_path().map_err(|e| e.to_string()))
        .transpose()?;
    if let Some(path) = path {
        grant_user_path(&path)?;
        return Ok(Some(serde_json::json!(path.to_string_lossy().to_string())));
    }
    Ok(None)
}

#[tauri::command]
pub async fn secure_save_dialog(
    app_handle: tauri::AppHandle,
    options: SecureSaveDialogOptions,
) -> Result<Option<String>, String> {
    let mut builder = app_handle.dialog().file();
    if let Some(title) = options.title {
        builder = builder.set_title(title);
    }
    builder = apply_default_path(builder, options.default_path, true);
    builder = apply_filters(builder, options.filters);

    let path = builder
        .blocking_save_file()
        .map(|path| path.into_path().map_err(|e| e.to_string()))
        .transpose()?;
    if let Some(path) = path {
        grant_user_path(&path)?;
        ensure_write_path(&path)?;
        return Ok(Some(path.to_string_lossy().to_string()));
    }
    Ok(None)
}

#[tauri::command]
pub async fn secure_read_dir(path: String) -> Result<Vec<SecureDirEntry>, String> {
    let dir = ensure_directory_read_path(path)?;
    let mut entries = Vec::new();
    for entry in fs::read_dir(&dir).map_err(|_| FORBIDDEN_PATH.to_string())? {
        let entry = entry.map_err(|_| FORBIDDEN_PATH.to_string())?;
        let file_type = entry.file_type().map_err(|_| FORBIDDEN_PATH.to_string())?;
        entries.push(SecureDirEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            is_file: file_type.is_file(),
            is_directory: file_type.is_dir(),
            is_symlink: file_type.is_symlink(),
        });
    }
    Ok(entries)
}

#[tauri::command]
pub async fn secure_stat(path: String) -> Result<SecureMetadata, String> {
    let canon = ensure_read_path(path)?;
    let metadata = fs::symlink_metadata(&canon).map_err(|_| FORBIDDEN_PATH.to_string())?;
    let modified_secs = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|duration| duration.as_secs());
    Ok(SecureMetadata {
        is_file: metadata.is_file(),
        is_directory: metadata.is_dir(),
        is_symlink: metadata.file_type().is_symlink(),
        size: metadata.len(),
        modified_secs,
    })
}

#[tauri::command]
pub async fn secure_read_binary_file(file_path: String) -> Result<Vec<u8>, String> {
    let path = ensure_read_path(file_path)?;
    if !path.is_file() {
        return Err(FORBIDDEN_PATH.to_string());
    }
    fs::read(path).map_err(|_| FORBIDDEN_PATH.to_string())
}
