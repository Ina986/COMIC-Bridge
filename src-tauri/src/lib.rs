use tauri::{Emitter, Manager};

/// デバッグ専用ログ。release ビルドでは**何も出力しない**（本番でのパス露出・ログ漏れ防止）。
/// 重要な起動時診断([seal]/[integrity]/[pdfium])は lib.rs setup 内で意図的に eprintln を残す。
#[macro_export]
macro_rules! dlog {
    ($($arg:tt)*) => {{
        #[cfg(debug_assertions)]
        eprintln!($($arg)*);
        // release では出力しないが、引数は評価扱いにして未使用変数警告を防ぐ。
        #[cfg(not(debug_assertions))]
        { let _ = format_args!($($arg)*); }
    }};
}

mod address_ref;
mod commands;
mod commands_reference;
mod crypto;
mod integrity;
pub mod pdf;
pub mod psd_metadata;
mod psd_safety;
mod security;
mod updater_local;
pub mod watcher;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            commands::resample_image,
            commands::batch_resample_images,
            commands::convert_color_mode,
            commands::get_image_info,
            commands::check_photoshop_installed,
            commands::run_photoshop_conversion,
            commands::run_photoshop_guide_apply,
            commands::run_photoshop_prepare,
            commands::run_photoshop_layer_visibility,
            commands::run_photoshop_layer_organize,
            commands::run_photoshop_layer_move,
            commands::run_photoshop_layer_lock,
            commands::run_photoshop_merge_layers,
            commands::run_photoshop_split,
            commands::get_high_res_preview,
            commands::cleanup_preview_files,
            commands::clear_psd_cache,
            commands::list_folder_files,
            commands::list_subfolders,
            commands::list_folder_contents,
            commands::search_json_folders,
            commands::read_text_file,
            commands::write_text_file,
            commands::write_binary_file,
            security::secure_open_dialog,
            security::secure_save_dialog,
            security::secure_read_dir,
            security::secure_stat,
            security::secure_read_binary_file,
            commands::delete_file,
            commands::path_exists,
            commands::run_photoshop_replace,
            commands::run_photoshop_rename,
            commands::batch_rename_files,
            commands::open_folder_in_explorer,
            commands::reveal_files_in_explorer,
            commands::open_file_in_photoshop,
            commands::get_pdf_info,
            commands::get_pdf_preview,
            commands::get_pdf_thumbnail,
            commands::run_photoshop_tiff_convert,
            commands::launch_diff_tool,
            commands::launch_pdf_tool,
            commands::launch_typeset_tool,
            commands::resolve_font_names,
            commands::search_font_names,
            commands::list_font_folder_contents,
            commands::search_font_files,
            commands::install_font_from_path,
            commands::run_photoshop_scan_psd,
            commands::poll_scan_psd_progress,
            commands::detect_psd_folders,
            commands::list_all_files,
            commands::open_with_default_app,
            commands::parse_psd_metadata_batch,
            commands::run_photoshop_custom_operations,
            commands::start_file_watcher,
            commands::stop_file_watcher,
            commands::invalidate_file_cache,
            commands::check_handoff,
            commands_reference::get_reference_addresses,
            commands_reference::get_address_ref_status,
            commands_reference::reload_reference_addresses,
            commands_reference::get_reference_list_mtime,
            commands_reference::register_user_paths,
            updater_local::check_local_update,
            updater_local::apply_local_update,
        ])
        .setup(|app| {
            security::init();
            // 一時フォルダ(Temp\COMIC-Bridge)を ACL 強化し、前回セッションの残存一時ファイルを
            // カテゴリ別(update/preview/convert/pdf/work)ごと掃除して作り直す（姉妹アプリ統一仕様）。
            security::cleanup_temp_on_startup();

            // アップデート直後は一度だけ再起動して、クリーンな状態で起動し直す。
            if let Ok(lad) = std::env::var("LOCALAPPDATA") {
                let dir = std::path::Path::new(&lad).join("COMIC-Bridge");
                let _ = std::fs::create_dir_all(&dir);
                let marker = dir.join("last_run_version.txt");
                let cur = env!("CARGO_PKG_VERSION");
                let prev = std::fs::read_to_string(&marker).unwrap_or_default();
                let prev = prev.trim().to_string();
                let _ = std::fs::write(&marker, cur); // 先に現行版を記録（再起動ループ防止）
                if !prev.is_empty() && prev != cur {
                    eprintln!(
                        "[update] 更新検知 ({} -> {}): クリーン起動のため再起動します。",
                        prev, cur
                    );
                    app.handle().restart();
                }
            }

            // 割符(わりふ)チェック: 起動のたびにアドレスフォルダの割符
            // (address-seal.key)で addresses.enc を復号できるか確認する。
            // enc が無い(平文運用)/参照先未解決なら対象外。enc はあるのに割符が
            // 無い・一致しない場合はエラーをログし、参照解決時に各機能が停止する。
            match address_ref::verify_seal() {
                Ok(true) => eprintln!("[seal] 割符チェックOK: addresses.enc を復号できました。"),
                Ok(false) => { /* 暗号化未運用 or 参照先未解決 = チェック対象外 */
                }
                Err(e) => eprintln!("[seal] 割符チェック失敗: {}", e),
            }

            // 整合性の門番: 配布リソース(scripts/*.jsx)の改ざん/差し替えを起動時に自己チェック。
            // 実際の遮断は各 Photoshop 起動経路の resolve_verified_script が行う。
            match app.path().resource_dir() {
                Ok(rd) => integrity::self_check(&rd),
                Err(e) => eprintln!("[integrity] resource_dir 取得失敗: {}", e),
            }

            // pdfium は同梱せず、配布元(参照アドレス pdf.pdfiumPath = G:共有)から
            // ローカル(%LOCALAPPDATA%\COMIC-Bridge\pdfium)へ取得して使う。
            // 起動時にG:→ローカルの同期(最新化)＋整合性検証を行いログ。
            // 一度ローカルに置けば、以後はG:未接続でもPDFが使える（オフライン対応）。
            match pdf::check_pdfium() {
                Ok(p) => eprintln!("[pdfium] OK: {}", p),
                Err(e) => eprintln!("[pdfium] 解決/検証 NG: {}", e),
            }

            // 参照アドレスリストから取得した共有フォルダを、asset プロトコルの
            // 許可ディレクトリとして実行時に追加する（WebView が convertFileSrc で読むため）。
            // (tauri.conf.json から G: の直打ちを除去したため、ここで補う)
            //   - content.jsonFolder  : JSONプレビュー
            //   - content.textLogBase : フォント帳画像（<base>\<label>\<title>\フォント帳\*.jpg）
            for key in ["content.jsonFolder", "content.textLogBase"] {
                match address_ref::get_opt(key) {
                    Some(folder) if !folder.trim().is_empty() => {
                        if let Err(e) =
                            app.asset_protocol_scope().allow_directory(&folder, true)
                        {
                            crate::dlog!("asset プロトコルスコープへの追加に失敗 ({}): {}", key, e);
                        }
                    }
                    _ => crate::dlog!(
                        "参照アドレス({})を解決できませんでした。\
                         パッチ未適用か共有ドライブ未接続の可能性があります。",
                        key
                    ),
                }
            }

            // CLI引数から校正データJSONパスを検出してフロントエンドに通知
            let args: Vec<String> = std::env::args().collect();
            if let Some(pos) = args.iter().position(|a| a == "--proofreading-json") {
                if let Some(json_path) = args.get(pos + 1) {
                    let _ = security::grant_user_path(json_path);
                    let window = app.get_webview_window("main").unwrap();
                    let path = json_path.clone();
                    std::thread::spawn(move || {
                        // フロントエンドの初期化完了を待つ
                        std::thread::sleep(std::time::Duration::from_millis(1500));
                        let _ = window.emit("open-proofreading-json", &path);
                    });
                }
            }

            // CLI引数から写植モード用PSDパスを検出してフロントエンドに通知（外部アプリから起動された場合）
            if let Some(pos) = args.iter().position(|a| a == "--shashoku") {
                if let Some(psd_path) = args.get(pos + 1) {
                    let _ = security::grant_user_path(psd_path);
                    let window = app.get_webview_window("main").unwrap();
                    let path = psd_path.clone();
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_millis(1500));
                        let _ = window.emit("open-shashoku", &path);
                    });
                }
            }

            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .on_window_event(|_window, event| {
            match event {
                tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, .. }) => {
                    let _ = security::grant_user_paths(paths);
                }
                tauri::WindowEvent::Destroyed => {
                    let _ = commands::cleanup_current_session_preview_files();
                    // Keep recent temp handoff files intact because another app instance may still be using them.
                    let _ = commands::cleanup_temp_files(86400);
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
