use tauri::Manager;

mod commands;
pub mod pdf;

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
            commands::launch_kenban_diff,
            commands::resolve_font_names,
            commands::run_photoshop_scan_psd,
            commands::poll_scan_psd_progress,
            commands::detect_psd_folders,
            commands::list_all_files,
            commands::open_with_default_app,
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
