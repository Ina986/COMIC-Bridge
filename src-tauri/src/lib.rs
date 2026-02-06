use tauri::Manager;

mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::resample_image,
            commands::batch_resample_images,
            commands::convert_color_mode,
            commands::get_image_info,
            commands::check_photoshop_installed,
            commands::run_photoshop_conversion,
            commands::run_photoshop_guide_apply,
            commands::run_photoshop_layer_visibility,
            commands::run_photoshop_split,
            commands::get_high_res_preview,
            commands::cleanup_preview_files,
            commands::clear_psd_cache,
            commands::list_folder_files,
            commands::list_subfolders,
            commands::run_photoshop_replace,
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
