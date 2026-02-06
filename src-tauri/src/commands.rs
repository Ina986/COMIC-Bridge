use image::{DynamicImage, GenericImageView, ImageBuffer, Rgba, RgbaImage, imageops::FilterType};
use psd::Psd;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{BufReader, Read, Seek, SeekFrom};
use std::path::Path;
use std::sync::{Mutex, OnceLock};
use tauri::Manager;
use thiserror::Error;
use std::time::{SystemTime, UNIX_EPOCH};

// ============================================
// PSD Cache (for faster repeated access)
// ============================================

/// PSD画像キャッシュ（プレビュー用）
/// キー: ファイルパス、値: (画像データ, 幅, 高さ)
static PSD_CACHE: OnceLock<Mutex<HashMap<String, (Vec<u8>, u32, u32)>>> = OnceLock::new();

/// PSDキャッシュの最大エントリ数
const MAX_PSD_CACHE_ENTRIES: usize = 10;

/// PSDキャッシュのハンドルを取得
fn get_psd_cache() -> &'static Mutex<HashMap<String, (Vec<u8>, u32, u32)>> {
    PSD_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

// ============================================
// Preview Result Cache (for instant repeated access)
// ============================================

/// プレビュー結果キャッシュ（ガイドエディタ用）
/// キー: "{file_path}_{modified_secs}_{max_size}", 値: HighResPreviewResult
static PREVIEW_RESULT_CACHE: OnceLock<Mutex<HashMap<String, HighResPreviewResult>>> = OnceLock::new();

/// プレビュー結果キャッシュの最大エントリ数
const MAX_PREVIEW_CACHE_ENTRIES: usize = 20;

/// プレビュー結果キャッシュのハンドルを取得
fn get_preview_result_cache() -> &'static Mutex<HashMap<String, HighResPreviewResult>> {
    PREVIEW_RESULT_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

/// PSDキャッシュをクリア
#[tauri::command]
pub async fn clear_psd_cache() {
    if let Ok(mut cache) = get_psd_cache().lock() {
        cache.clear();
    }
    if let Ok(mut cache) = get_preview_result_cache().lock() {
        cache.clear();
    }
}

/// ファイルの更新日時をUNIXエポックからの秒数で取得
fn get_file_modified_secs(path: &Path) -> u64 {
    fs::metadata(path)
        .and_then(|m| m.modified())
        .map(|t| t.duration_since(UNIX_EPOCH).unwrap_or_default().as_secs())
        .unwrap_or(0)
}

/// PSDヘッダーから寸法のみを高速読み取り（26バイトのみ）
fn read_psd_dimensions(path: &Path) -> Result<(u32, u32), String> {
    let mut file = File::open(path).map_err(|e| format!("Failed to open: {}", e))?;
    let mut header = [0u8; 26];
    file.read_exact(&mut header).map_err(|e| format!("Header read error: {}", e))?;
    if &header[0..4] != b"8BPS" {
        return Err("Not a valid PSD file".to_string());
    }
    let height = u32::from_be_bytes([header[14], header[15], header[16], header[17]]);
    let width = u32::from_be_bytes([header[18], header[19], header[20], header[21]]);
    Ok((width, height))
}

/// PSDキャッシュから画像を取得、またはキャッシュに追加
fn get_or_cache_psd(path: &Path) -> Result<DynamicImage, String> {
    let path_str = path.to_string_lossy().to_string();

    // キャッシュをチェック
    if let Ok(cache) = get_psd_cache().lock() {
        if let Some((rgba_data, width, height)) = cache.get(&path_str) {
            if let Some(img) = ImageBuffer::from_raw(*width, *height, rgba_data.clone()) {
                return Ok(DynamicImage::ImageRgba8(img));
            }
        }
    }

    // キャッシュになければ読み込み
    let img = load_psd_fast(path)?;
    let rgba = img.to_rgba8();
    let (width, height) = rgba.dimensions();

    // キャッシュに追加
    if let Ok(mut cache) = get_psd_cache().lock() {
        // メモリ制限: エントリ数を制限
        if cache.len() >= MAX_PSD_CACHE_ENTRIES {
            cache.clear();
        }
        cache.insert(path_str, (rgba.as_raw().clone(), width, height));
    }

    Ok(img)
}

#[derive(Error, Debug)]
pub enum ImageProcessError {
    #[error("Failed to read file: {0}")]
    FileRead(String),
    #[error("Failed to write file: {0}")]
    FileWrite(String),
    #[error("Failed to parse PSD: {0}")]
    PsdParse(String),
    #[error("Failed to process image: {0}")]
    ImageProcess(String),
    #[error("Invalid parameters: {0}")]
    InvalidParams(String),
}

impl From<ImageProcessError> for String {
    fn from(err: ImageProcessError) -> String {
        err.to_string()
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ResampleOptions {
    pub target_dpi: u32,
    pub source_dpi: Option<u32>, // 元のDPI（指定がなければ72と仮定）
    pub filter: Option<String>,  // "lanczos", "catmullrom", "gaussian", "nearest", "linear"
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConversionOptions {
    pub target_color_mode: Option<String>, // "RGB", "Grayscale"
    pub target_bit_depth: Option<u8>,      // 8 or 16
    pub target_dpi: Option<u32>,
    pub remove_hidden_layers: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProcessResult {
    pub success: bool,
    pub file_path: String,
    pub changes: Vec<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BatchProcessResult {
    pub results: Vec<ProcessResult>,
    pub success_count: usize,
    pub failed_count: usize,
}

/// Get filter type from string
fn get_filter_type(filter: &str) -> FilterType {
    match filter.to_lowercase().as_str() {
        "nearest" => FilterType::Nearest,
        "linear" | "triangle" => FilterType::Triangle,
        "gaussian" => FilterType::Gaussian,
        "catmullrom" | "cubic" => FilterType::CatmullRom,
        "lanczos" | "lanczos3" => FilterType::Lanczos3,
        _ => FilterType::Lanczos3, // Default to high quality
    }
}

/// Resample a single image file (PSD composite or regular image)
#[tauri::command]
pub async fn resample_image(
    file_path: String,
    output_path: Option<String>,
    options: ResampleOptions,
) -> Result<ProcessResult, String> {
    let path = Path::new(&file_path);
    let mut changes = Vec::new();

    // Determine output path
    let out_path = output_path.unwrap_or_else(|| file_path.clone());

    // Read the file
    let file_bytes = fs::read(path).map_err(|e| ImageProcessError::FileRead(e.to_string()))?;

    // Check if it's a PSD file
    let extension = path.extension().and_then(|e| e.to_str()).unwrap_or("");
    let is_psd = extension.eq_ignore_ascii_case("psd") || extension.eq_ignore_ascii_case("psb");

    if is_psd {
        // Parse PSD and get composite image
        let psd = Psd::from_bytes(&file_bytes).map_err(|e| ImageProcessError::PsdParse(e.to_string()))?;

        let width = psd.width();
        let height = psd.height();

        // Get the flattened image (composite)
        let rgba = psd.rgba();

        // Create image buffer
        let img: ImageBuffer<Rgba<u8>, Vec<u8>> = ImageBuffer::from_raw(width, height, rgba)
            .ok_or_else(|| ImageProcessError::ImageProcess("Failed to create image buffer".to_string()))?;

        let dynamic_img = DynamicImage::ImageRgba8(img);

        // Get current DPI from options or assume 72
        let current_dpi = options.source_dpi.unwrap_or(72);
        let target_dpi = options.target_dpi;

        if current_dpi == target_dpi {
            return Ok(ProcessResult {
                success: true,
                file_path: out_path,
                changes: vec!["No resampling needed - DPI already matches".to_string()],
                error: None,
            });
        }

        // Calculate new dimensions based on DPI ratio
        let scale_factor = target_dpi as f64 / current_dpi as f64;
        let new_width = (width as f64 * scale_factor).round() as u32;
        let new_height = (height as f64 * scale_factor).round() as u32;

        // Get filter type
        let filter = options.filter.as_deref().unwrap_or("lanczos");
        let filter_type = get_filter_type(filter);

        // Resample the image
        let resampled = dynamic_img.resize_exact(new_width, new_height, filter_type);

        changes.push(format!(
            "Resampled: {}x{} -> {}x{} ({}dpi -> {}dpi)",
            width, height, new_width, new_height, current_dpi, target_dpi
        ));

        // Save as PNG for now (PSD writing requires more complex handling)
        let png_path = if out_path.ends_with(".psd") || out_path.ends_with(".psb") {
            format!("{}.png", out_path.trim_end_matches(".psd").trim_end_matches(".psb"))
        } else {
            out_path.clone()
        };

        resampled
            .save(&png_path)
            .map_err(|e| ImageProcessError::FileWrite(e.to_string()))?;

        changes.push(format!("Saved to: {}", png_path));

        Ok(ProcessResult {
            success: true,
            file_path: png_path,
            changes,
            error: None,
        })
    } else {
        // Handle regular image files
        let img = image::load_from_memory(&file_bytes)
            .map_err(|e| ImageProcessError::ImageProcess(e.to_string()))?;

        let (width, height) = img.dimensions();

        // Get current DPI from options or assume 72
        let current_dpi = options.source_dpi.unwrap_or(72);
        let target_dpi = options.target_dpi;

        if current_dpi == target_dpi {
            return Ok(ProcessResult {
                success: true,
                file_path: out_path,
                changes: vec!["No resampling needed".to_string()],
                error: None,
            });
        }

        let scale_factor = target_dpi as f64 / current_dpi as f64;
        let new_width = (width as f64 * scale_factor).round() as u32;
        let new_height = (height as f64 * scale_factor).round() as u32;

        let filter = options.filter.as_deref().unwrap_or("lanczos");
        let filter_type = get_filter_type(filter);

        let resampled = img.resize_exact(new_width, new_height, filter_type);

        changes.push(format!(
            "Resampled: {}x{} -> {}x{}",
            width, height, new_width, new_height
        ));

        resampled
            .save(&out_path)
            .map_err(|e| ImageProcessError::FileWrite(e.to_string()))?;

        Ok(ProcessResult {
            success: true,
            file_path: out_path,
            changes,
            error: None,
        })
    }
}

/// Batch resample multiple images
#[tauri::command]
pub async fn batch_resample_images(
    file_paths: Vec<String>,
    output_dir: Option<String>,
    options: ResampleOptions,
) -> Result<BatchProcessResult, String> {
    let mut results = Vec::new();
    let mut success_count = 0;
    let mut failed_count = 0;

    for file_path in file_paths {
        // Determine output path
        let out_path = if let Some(ref dir) = output_dir {
            let file_name = Path::new(&file_path)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("output.png");
            format!("{}/{}", dir, file_name)
        } else {
            file_path.clone()
        };

        match resample_image(file_path.clone(), Some(out_path), options.clone()).await {
            Ok(result) => {
                if result.success {
                    success_count += 1;
                } else {
                    failed_count += 1;
                }
                results.push(result);
            }
            Err(e) => {
                failed_count += 1;
                results.push(ProcessResult {
                    success: false,
                    file_path,
                    changes: vec![],
                    error: Some(e),
                });
            }
        }
    }

    Ok(BatchProcessResult {
        results,
        success_count,
        failed_count,
    })
}

/// Convert image color mode (RGB to Grayscale or vice versa)
#[tauri::command]
pub async fn convert_color_mode(
    file_path: String,
    output_path: Option<String>,
    target_mode: String, // "RGB" or "Grayscale"
) -> Result<ProcessResult, String> {
    let path = Path::new(&file_path);
    let out_path = output_path.unwrap_or_else(|| file_path.clone());
    let mut changes = Vec::new();

    // Read the file
    let file_bytes = fs::read(path).map_err(|e| ImageProcessError::FileRead(e.to_string()))?;

    // Check if it's a PSD file
    let extension = path.extension().and_then(|e| e.to_str()).unwrap_or("");
    let is_psd = extension.eq_ignore_ascii_case("psd") || extension.eq_ignore_ascii_case("psb");

    let img = if is_psd {
        let psd = Psd::from_bytes(&file_bytes).map_err(|e| ImageProcessError::PsdParse(e.to_string()))?;
        let rgba = psd.rgba();
        let img_buf: ImageBuffer<Rgba<u8>, Vec<u8>> = ImageBuffer::from_raw(psd.width(), psd.height(), rgba)
            .ok_or_else(|| ImageProcessError::ImageProcess("Failed to create image buffer".to_string()))?;
        DynamicImage::ImageRgba8(img_buf)
    } else {
        image::load_from_memory(&file_bytes)
            .map_err(|e| ImageProcessError::ImageProcess(e.to_string()))?
    };

    let converted = match target_mode.to_uppercase().as_str() {
        "GRAYSCALE" | "GRAY" => {
            changes.push("Converted to Grayscale".to_string());
            DynamicImage::ImageLuma8(img.to_luma8())
        }
        "RGB" => {
            changes.push("Converted to RGB".to_string());
            DynamicImage::ImageRgb8(img.to_rgb8())
        }
        "RGBA" => {
            changes.push("Converted to RGBA".to_string());
            DynamicImage::ImageRgba8(img.to_rgba8())
        }
        _ => {
            return Err(ImageProcessError::InvalidParams(format!(
                "Unknown color mode: {}",
                target_mode
            ))
            .into())
        }
    };

    // Save the converted image
    let save_path = if is_psd {
        // Save as PNG for PSD files since we can't write PSD easily
        format!("{}.png", out_path.trim_end_matches(".psd").trim_end_matches(".psb"))
    } else {
        out_path.clone()
    };

    converted
        .save(&save_path)
        .map_err(|e| ImageProcessError::FileWrite(e.to_string()))?;

    changes.push(format!("Saved to: {}", save_path));

    Ok(ProcessResult {
        success: true,
        file_path: save_path,
        changes,
        error: None,
    })
}

/// Get image info without full processing
#[tauri::command]
pub async fn get_image_info(file_path: String) -> Result<serde_json::Value, String> {
    let path = Path::new(&file_path);

    let file_bytes = fs::read(path).map_err(|e| ImageProcessError::FileRead(e.to_string()))?;

    let extension = path.extension().and_then(|e| e.to_str()).unwrap_or("");
    let is_psd = extension.eq_ignore_ascii_case("psd") || extension.eq_ignore_ascii_case("psb");

    if is_psd {
        let psd = Psd::from_bytes(&file_bytes).map_err(|e| ImageProcessError::PsdParse(e.to_string()))?;

        Ok(serde_json::json!({
            "width": psd.width(),
            "height": psd.height(),
            "color_mode": format!("{:?}", psd.color_mode()),
            "bit_depth": format!("{:?}", psd.depth()),
            "layer_count": psd.layers().len(),
            "is_psd": true
        }))
    } else {
        let img = image::load_from_memory(&file_bytes)
            .map_err(|e| ImageProcessError::ImageProcess(e.to_string()))?;

        let (width, height) = img.dimensions();

        Ok(serde_json::json!({
            "width": width,
            "height": height,
            "color_type": format!("{:?}", img.color()),
            "is_psd": false
        }))
    }
}

impl Clone for ResampleOptions {
    fn clone(&self) -> Self {
        ResampleOptions {
            target_dpi: self.target_dpi,
            source_dpi: self.source_dpi,
            filter: self.filter.clone(),
        }
    }
}

// ============================================
// Photoshop Integration
// ============================================

#[derive(Debug, Serialize, Deserialize)]
pub struct PhotoshopConversionOptions {
    pub target_dpi: Option<u32>,
    pub target_color_mode: Option<String>,
    pub target_bit_depth: Option<u8>,
    pub remove_hidden_layers: bool,
    pub remove_alpha_channels: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PhotoshopFileSettings {
    pub path: String,
    pub needs_dpi_change: bool,
    pub needs_color_mode_change: bool,
    pub needs_bit_depth_change: bool,
    pub needs_alpha_removal: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PhotoshopConversionSettings {
    pub files: Vec<PhotoshopFileSettings>,
    pub options: PhotoshopConversionOptions,
    #[serde(rename = "outputPath")]
    pub output_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PhotoshopResult {
    #[serde(rename = "filePath")]
    pub file_path: String,
    pub success: bool,
    pub changes: Vec<String>,
    pub error: Option<String>,
}

/// Find Photoshop executable path on Windows
fn find_photoshop_path() -> Option<String> {
    // Common Photoshop installation paths on Windows
    let possible_paths = vec![
        // CC versions (newest first)
        r"C:\Program Files\Adobe\Adobe Photoshop 2026\Photoshop.exe",
        r"C:\Program Files\Adobe\Adobe Photoshop 2025\Photoshop.exe",
        r"C:\Program Files\Adobe\Adobe Photoshop 2024\Photoshop.exe",
        r"C:\Program Files\Adobe\Adobe Photoshop 2023\Photoshop.exe",
        r"C:\Program Files\Adobe\Adobe Photoshop 2022\Photoshop.exe",
        r"C:\Program Files\Adobe\Adobe Photoshop 2021\Photoshop.exe",
        r"C:\Program Files\Adobe\Adobe Photoshop 2020\Photoshop.exe",
        r"C:\Program Files\Adobe\Adobe Photoshop CC 2019\Photoshop.exe",
        r"C:\Program Files\Adobe\Adobe Photoshop CC 2018\Photoshop.exe",
        // CS versions
        r"C:\Program Files\Adobe\Adobe Photoshop CS6 (64 Bit)\Photoshop.exe",
        r"C:\Program Files (x86)\Adobe\Adobe Photoshop CS6\Photoshop.exe",
    ];

    for path in possible_paths {
        if Path::new(path).exists() {
            return Some(path.to_string());
        }
    }

    None
}

/// Check if Photoshop is installed
#[tauri::command]
pub async fn check_photoshop_installed() -> Result<serde_json::Value, String> {
    match find_photoshop_path() {
        Some(path) => Ok(serde_json::json!({
            "installed": true,
            "path": path
        })),
        None => Ok(serde_json::json!({
            "installed": false,
            "path": null
        }))
    }
}

/// Run Photoshop conversion on specified files
#[tauri::command]
pub async fn run_photoshop_conversion(
    app_handle: tauri::AppHandle,
    settings: PhotoshopConversionSettings,
) -> Result<Vec<PhotoshopResult>, String> {
    use std::process::Command;
    use std::io::Write;

    // Find Photoshop
    let ps_path = find_photoshop_path()
        .ok_or_else(|| "Photoshop not found. Please install Adobe Photoshop.".to_string())?;

    // Get the scripts directory from app resources
    let resource_path = app_handle
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?;

    let script_path = resource_path.join("scripts").join("convert_psd.jsx");

    // If script doesn't exist in resources, use embedded script path
    let script_path_str = if script_path.exists() {
        script_path.to_string_lossy().to_string()
    } else {
        // Fallback: look in the src-tauri/scripts directory during development
        let dev_script = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("scripts")
            .join("convert_psd.jsx");
        if dev_script.exists() {
            dev_script.to_string_lossy().to_string()
        } else {
            return Err("Conversion script not found".to_string());
        }
    };

    // Create temp directory for settings and output
    let temp_dir = std::env::temp_dir();
    let settings_path = temp_dir.join("psd_convert_settings.json");
    let output_path = temp_dir.join("psd_convert_results.json");

    // Remove old output file if exists
    let _ = fs::remove_file(&output_path);

    // Update settings with output path (use forward slashes for JSX compatibility)
    let mut settings_with_output = settings;
    settings_with_output.output_path = output_path.to_string_lossy().to_string().replace("\\", "/");

    // Convert all file paths to use forward slashes for JSX compatibility
    for file in &mut settings_with_output.files {
        file.path = file.path.replace("\\", "/");
    }

    // Write settings to temp file with UTF-8 BOM for Japanese character support
    let settings_json = serde_json::to_string_pretty(&settings_with_output)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    let mut settings_file = fs::File::create(&settings_path)
        .map_err(|e| format!("Failed to create settings file: {}", e))?;
    // Write UTF-8 BOM
    settings_file.write_all(&[0xEF, 0xBB, 0xBF])
        .map_err(|e| format!("Failed to write BOM: {}", e))?;
    settings_file.write_all(settings_json.as_bytes())
        .map_err(|e| format!("Failed to write settings: {}", e))?;

    // Log for debugging
    eprintln!("Photoshop path: {}", ps_path);
    eprintln!("Script path: {}", script_path_str);
    eprintln!("Settings path: {}", settings_path.display());
    eprintln!("Output path: {}", output_path.display());
    eprintln!("Settings JSON: {}", settings_json);

    // Run Photoshop with the script
    // Using -r flag to run script (works on Windows)
    let output = Command::new(&ps_path)
        .arg("-r")
        .arg(&script_path_str)
        .output()
        .map_err(|e| format!("Failed to run Photoshop: {}", e))?;

    eprintln!("Photoshop stdout: {}", String::from_utf8_lossy(&output.stdout));
    eprintln!("Photoshop stderr: {}", String::from_utf8_lossy(&output.stderr));
    eprintln!("Photoshop exit status: {:?}", output.status);

    // Wait for Photoshop to write results (it runs asynchronously)
    // Poll for the output file with timeout
    let max_wait_secs = 120; // 2 minutes max wait
    let poll_interval_ms = 500;
    let max_polls = (max_wait_secs * 1000) / poll_interval_ms;

    for poll in 0..max_polls {
        if output_path.exists() {
            // Check if file is not empty and complete
            if let Ok(content) = fs::read_to_string(&output_path) {
                if content.trim().starts_with('[') && content.trim().ends_with(']') {
                    eprintln!("Output file ready after {} polls", poll);
                    break;
                }
            }
        }
        std::thread::sleep(std::time::Duration::from_millis(poll_interval_ms as u64));

        // Log progress every 10 seconds
        if poll > 0 && poll % 20 == 0 {
            eprintln!("Still waiting for Photoshop... ({} seconds)", poll * poll_interval_ms / 1000);
        }
    }

    // Read results
    if output_path.exists() {
        let results_json = fs::read_to_string(&output_path)
            .map_err(|e| format!("Failed to read results: {}", e))?;

        eprintln!("Results JSON: {}", results_json);

        let results: Vec<PhotoshopResult> = serde_json::from_str(&results_json)
            .map_err(|e| format!("Failed to parse results: {}. JSON was: {}", e, results_json))?;

        // Cleanup temp files
        let _ = fs::remove_file(&settings_path);
        let _ = fs::remove_file(&output_path);

        // Bring app window to foreground
        if let Some(window) = app_handle.get_webview_window("main") {
            let _ = window.set_focus();
        }

        Ok(results)
    } else {
        // Bring app window to foreground even on failure
        if let Some(window) = app_handle.get_webview_window("main") {
            let _ = window.set_focus();
        }
        Err("Photoshop did not produce output file. Script may have failed. Check if Photoshop opened and ran the script.".to_string())
    }
}

// ============================================
// Photoshop Guide Application
// ============================================

#[derive(Debug, Serialize, Deserialize)]
pub struct GuideInfo {
    pub direction: String,
    pub position: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GuideApplySettings {
    pub files: Vec<String>,
    pub guides: Vec<GuideInfo>,
    #[serde(rename = "outputPath")]
    pub output_path: String,
}

/// Run Photoshop to apply guides to PSD files
#[tauri::command]
pub async fn run_photoshop_guide_apply(
    app_handle: tauri::AppHandle,
    file_paths: Vec<String>,
    guides: Vec<GuideInfo>,
) -> Result<Vec<PhotoshopResult>, String> {
    use std::process::Command;
    use std::io::Write;

    let ps_path = find_photoshop_path()
        .ok_or_else(|| "Photoshop not found. Please install Adobe Photoshop.".to_string())?;

    // Resolve script path
    let resource_path = app_handle
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?;

    let script_path = resource_path.join("scripts").join("apply_guides.jsx");

    let script_path_str = if script_path.exists() {
        script_path.to_string_lossy().to_string()
    } else {
        let dev_script = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("scripts")
            .join("apply_guides.jsx");
        if dev_script.exists() {
            dev_script.to_string_lossy().to_string()
        } else {
            return Err("Guide apply script not found".to_string());
        }
    };

    let temp_dir = std::env::temp_dir();
    let settings_path = temp_dir.join("psd_guide_settings.json");
    let output_path = temp_dir.join("psd_guide_results.json");

    let _ = fs::remove_file(&output_path);

    // Build settings JSON
    let settings = GuideApplySettings {
        files: file_paths.iter().map(|p| p.replace("\\", "/")).collect(),
        guides,
        output_path: output_path.to_string_lossy().to_string().replace("\\", "/"),
    };

    let settings_json = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    let mut settings_file = fs::File::create(&settings_path)
        .map_err(|e| format!("Failed to create settings file: {}", e))?;
    // UTF-8 BOM for Japanese support
    settings_file.write_all(&[0xEF, 0xBB, 0xBF])
        .map_err(|e| format!("Failed to write BOM: {}", e))?;
    settings_file.write_all(settings_json.as_bytes())
        .map_err(|e| format!("Failed to write settings: {}", e))?;

    eprintln!("Guide apply - Photoshop: {}", ps_path);
    eprintln!("Guide apply - Script: {}", script_path_str);
    eprintln!("Guide apply - Files: {}", file_paths.len());

    let _output = Command::new(&ps_path)
        .arg("-r")
        .arg(&script_path_str)
        .output()
        .map_err(|e| format!("Failed to run Photoshop: {}", e))?;

    // Poll for results
    let max_wait_secs = 120;
    let poll_interval_ms = 500;
    let max_polls = (max_wait_secs * 1000) / poll_interval_ms;

    for poll in 0..max_polls {
        if output_path.exists() {
            if let Ok(content) = fs::read_to_string(&output_path) {
                if content.trim().starts_with('[') && content.trim().ends_with(']') {
                    eprintln!("Guide apply output ready after {} polls", poll);
                    break;
                }
            }
        }
        std::thread::sleep(std::time::Duration::from_millis(poll_interval_ms as u64));

        if poll > 0 && poll % 20 == 0 {
            eprintln!("Still waiting for Photoshop... ({} seconds)", poll * poll_interval_ms / 1000);
        }
    }

    if output_path.exists() {
        let results_json = fs::read_to_string(&output_path)
            .map_err(|e| format!("Failed to read results: {}", e))?;

        let results: Vec<PhotoshopResult> = serde_json::from_str(&results_json)
            .map_err(|e| format!("Failed to parse results: {}. JSON was: {}", e, results_json))?;

        let _ = fs::remove_file(&settings_path);
        let _ = fs::remove_file(&output_path);

        // Bring app window to foreground
        if let Some(window) = app_handle.get_webview_window("main") {
            let _ = window.set_focus();
        }

        Ok(results)
    } else {
        // Bring app window to foreground even on failure
        if let Some(window) = app_handle.get_webview_window("main") {
            let _ = window.set_focus();
        }
        Err("Photoshop did not produce output file. Script may have failed.".to_string())
    }
}

// ============================================
// Photoshop Layer Visibility Control
// ============================================

#[derive(Debug, Serialize, Deserialize)]
pub struct LayerCondition {
    #[serde(rename = "type")]
    pub condition_type: String,
    pub value: Option<String>,
    #[serde(rename = "partialMatch")]
    pub partial_match: Option<bool>,
    #[serde(rename = "caseSensitive")]
    pub case_sensitive: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LayerVisibilitySettings {
    pub files: Vec<String>,
    pub conditions: Vec<LayerCondition>,
    pub mode: String, // "hide" or "show"
    #[serde(rename = "outputPath")]
    pub output_path: String,
}

/// Run Photoshop to change layer visibility in PSD files
#[tauri::command]
pub async fn run_photoshop_layer_visibility(
    app_handle: tauri::AppHandle,
    file_paths: Vec<String>,
    conditions: Vec<LayerCondition>,
    mode: String,
) -> Result<Vec<PhotoshopResult>, String> {
    use std::process::Command;
    use std::io::Write;

    let ps_path = find_photoshop_path()
        .ok_or_else(|| "Photoshop not found. Please install Adobe Photoshop.".to_string())?;

    // Resolve script path
    let resource_path = app_handle
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?;

    let script_path = resource_path.join("scripts").join("hide_layers.jsx");

    let script_path_str = if script_path.exists() {
        script_path.to_string_lossy().to_string()
    } else {
        let dev_script = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("scripts")
            .join("hide_layers.jsx");
        if dev_script.exists() {
            dev_script.to_string_lossy().to_string()
        } else {
            return Err("Layer visibility script not found".to_string());
        }
    };

    let temp_dir = std::env::temp_dir();
    let settings_path = temp_dir.join("psd_layer_visibility_settings.json");
    let output_path = temp_dir.join("psd_layer_visibility_results.json");

    let _ = fs::remove_file(&output_path);

    // Build settings JSON
    let settings = LayerVisibilitySettings {
        files: file_paths.iter().map(|p| p.replace("\\", "/")).collect(),
        conditions,
        mode,
        output_path: output_path.to_string_lossy().to_string().replace("\\", "/"),
    };

    let settings_json = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    let mut settings_file = fs::File::create(&settings_path)
        .map_err(|e| format!("Failed to create settings file: {}", e))?;
    // UTF-8 BOM for Japanese support
    settings_file.write_all(&[0xEF, 0xBB, 0xBF])
        .map_err(|e| format!("Failed to write BOM: {}", e))?;
    settings_file.write_all(settings_json.as_bytes())
        .map_err(|e| format!("Failed to write settings: {}", e))?;

    eprintln!("Layer visibility - Photoshop: {}", ps_path);
    eprintln!("Layer visibility - Script: {}", script_path_str);
    eprintln!("Layer visibility - Files: {}", file_paths.len());
    eprintln!("Layer visibility - Mode: {}", settings.mode);

    let _output = Command::new(&ps_path)
        .arg("-r")
        .arg(&script_path_str)
        .output()
        .map_err(|e| format!("Failed to run Photoshop: {}", e))?;

    // Poll for results
    let max_wait_secs = 120;
    let poll_interval_ms = 500;
    let max_polls = (max_wait_secs * 1000) / poll_interval_ms;

    for poll in 0..max_polls {
        if output_path.exists() {
            if let Ok(content) = fs::read_to_string(&output_path) {
                if content.trim().starts_with('[') && content.trim().ends_with(']') {
                    eprintln!("Layer visibility output ready after {} polls", poll);
                    break;
                }
            }
        }
        std::thread::sleep(std::time::Duration::from_millis(poll_interval_ms as u64));

        if poll > 0 && poll % 20 == 0 {
            eprintln!("Still waiting for Photoshop... ({} seconds)", poll * poll_interval_ms / 1000);
        }
    }

    if output_path.exists() {
        let results_json = fs::read_to_string(&output_path)
            .map_err(|e| format!("Failed to read results: {}", e))?;

        let results: Vec<PhotoshopResult> = serde_json::from_str(&results_json)
            .map_err(|e| format!("Failed to parse results: {}. JSON was: {}", e, results_json))?;

        let _ = fs::remove_file(&settings_path);
        let _ = fs::remove_file(&output_path);

        // Bring app window to foreground
        if let Some(window) = app_handle.get_webview_window("main") {
            let _ = window.set_focus();
        }

        Ok(results)
    } else {
        if let Some(window) = app_handle.get_webview_window("main") {
            let _ = window.set_focus();
        }
        Err("Photoshop did not produce output file. Script may have failed.".to_string())
    }
}

// ============================================
// Photoshop Split Processing
// ============================================

#[derive(Debug, Serialize, Deserialize)]
pub struct SplitSettings {
    pub files: Vec<String>,
    pub mode: String, // "even", "uneven", "none"
    #[serde(rename = "outputFormat")]
    pub output_format: String, // "psd", "jpg"
    #[serde(rename = "jpgQuality")]
    pub jpg_quality: u8,
    #[serde(rename = "outerMargin")]
    pub outer_margin: i32,
    #[serde(rename = "deleteHiddenLayers")]
    pub delete_hidden_layers: bool,
    #[serde(rename = "deleteOffCanvasText")]
    pub delete_off_canvas_text: bool,
    #[serde(rename = "outputDir")]
    pub output_dir: String,
    #[serde(rename = "outputPath")]
    pub output_path: String,
}

/// Run Photoshop to split spread pages
#[tauri::command]
pub async fn run_photoshop_split(
    app_handle: tauri::AppHandle,
    file_paths: Vec<String>,
    mode: String,
    output_format: String,
    jpg_quality: u8,
    outer_margin: i32,
    delete_hidden_layers: bool,
    delete_off_canvas_text: bool,
    output_dir: String,
) -> Result<Vec<PhotoshopResult>, String> {
    use std::process::Command;
    use std::io::Write;

    let ps_path = find_photoshop_path()
        .ok_or_else(|| "Photoshop not found. Please install Adobe Photoshop.".to_string())?;

    let resource_path = app_handle
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?;

    let script_path = resource_path.join("scripts").join("split_psd.jsx");

    let script_path_str = if script_path.exists() {
        script_path.to_string_lossy().to_string()
    } else {
        let dev_script = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("scripts")
            .join("split_psd.jsx");
        if dev_script.exists() {
            dev_script.to_string_lossy().to_string()
        } else {
            return Err("Split script not found".to_string());
        }
    };

    let temp_dir = std::env::temp_dir();
    let settings_path = temp_dir.join("psd_split_settings.json");
    let output_path = temp_dir.join("psd_split_results.json");

    let _ = fs::remove_file(&output_path);

    let settings = SplitSettings {
        files: file_paths.iter().map(|p| p.replace("\\", "/")).collect(),
        mode,
        output_format,
        jpg_quality,
        outer_margin,
        delete_hidden_layers,
        delete_off_canvas_text,
        output_dir: output_dir.replace("\\", "/"),
        output_path: output_path.to_string_lossy().to_string().replace("\\", "/"),
    };

    let settings_json = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    let mut settings_file = fs::File::create(&settings_path)
        .map_err(|e| format!("Failed to create settings file: {}", e))?;
    settings_file.write_all(&[0xEF, 0xBB, 0xBF])
        .map_err(|e| format!("Failed to write BOM: {}", e))?;
    settings_file.write_all(settings_json.as_bytes())
        .map_err(|e| format!("Failed to write settings: {}", e))?;

    eprintln!("Split - Photoshop: {}", ps_path);
    eprintln!("Split - Script: {}", script_path_str);
    eprintln!("Split - Files: {}", file_paths.len());
    eprintln!("Split - Mode: {}", settings.mode);

    let _output = Command::new(&ps_path)
        .arg("-r")
        .arg(&script_path_str)
        .output()
        .map_err(|e| format!("Failed to run Photoshop: {}", e))?;

    // Poll for results (split takes longer per file)
    let max_wait_secs = 300; // 5 minutes for split
    let poll_interval_ms = 500;
    let max_polls = (max_wait_secs * 1000) / poll_interval_ms;

    for poll in 0..max_polls {
        if output_path.exists() {
            if let Ok(content) = fs::read_to_string(&output_path) {
                if content.trim().starts_with('[') && content.trim().ends_with(']') {
                    eprintln!("Split output ready after {} polls", poll);
                    break;
                }
            }
        }
        std::thread::sleep(std::time::Duration::from_millis(poll_interval_ms as u64));

        if poll > 0 && poll % 20 == 0 {
            eprintln!("Still waiting for Photoshop split... ({} seconds)", poll * poll_interval_ms / 1000);
        }
    }

    if output_path.exists() {
        let results_json = fs::read_to_string(&output_path)
            .map_err(|e| format!("Failed to read results: {}", e))?;

        let results: Vec<PhotoshopResult> = serde_json::from_str(&results_json)
            .map_err(|e| format!("Failed to parse results: {}. JSON was: {}", e, results_json))?;

        let _ = fs::remove_file(&settings_path);
        let _ = fs::remove_file(&output_path);

        if let Some(window) = app_handle.get_webview_window("main") {
            let _ = window.set_focus();
        }

        Ok(results)
    } else {
        if let Some(window) = app_handle.get_webview_window("main") {
            let _ = window.set_focus();
        }
        Err("Photoshop did not produce output file. Script may have failed.".to_string())
    }
}

// ============================================
// Fast PSD Loading (from tachimi_standalone)
// ============================================

/// PSDファイルを高速読み込み
/// まずフラット化画像を試し、失敗したらpsd crateにフォールバック
fn load_psd_fast(path: &Path) -> Result<DynamicImage, String> {
    match load_psd_composite(path) {
        Ok(img) => Ok(img),
        Err(_) => {
            // フォールバック: psd crateでレイヤー合成（遅いが確実）
            let bytes = fs::read(path).map_err(|e| format!("Failed to read file: {}", e))?;
            let psd = Psd::from_bytes(&bytes).map_err(|e| format!("Failed to parse PSD: {}", e))?;
            let width = psd.width();
            let height = psd.height();
            let rgba = psd.rgba();
            let img: RgbaImage = ImageBuffer::from_raw(width, height, rgba)
                .ok_or_else(|| "Failed to create image buffer".to_string())?;
            Ok(DynamicImage::ImageRgba8(img))
        }
    }
}

/// PSDファイルのImage Dataセクションを直接読み込む（高速版）
/// Photoshopの「互換性を最大に」で保存されたPSDには合成済み画像が含まれている
fn load_psd_composite(path: &Path) -> Result<DynamicImage, String> {
    let file = File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
    let mut file = BufReader::with_capacity(64 * 1024, file);
    let mut buf4 = [0u8; 4];
    let mut buf2 = [0u8; 2];

    // === Header (26 bytes) ===
    file.read_exact(&mut buf4).map_err(|e| format!("PSD read error: {}", e))?;
    if &buf4 != b"8BPS" {
        return Err("Invalid PSD file".to_string());
    }

    // Version
    file.read_exact(&mut buf2).map_err(|e| format!("PSD read error: {}", e))?;
    let version = u16::from_be_bytes(buf2);
    if version != 1 && version != 2 {
        return Err("Unsupported PSD version".to_string());
    }

    // Reserved (6 bytes)
    file.seek(SeekFrom::Current(6)).map_err(|e| format!("Seek error: {}", e))?;

    // Channels
    file.read_exact(&mut buf2).map_err(|e| format!("PSD read error: {}", e))?;
    let channels = u16::from_be_bytes(buf2) as usize;

    // Height
    file.read_exact(&mut buf4).map_err(|e| format!("PSD read error: {}", e))?;
    let height = u32::from_be_bytes(buf4);

    // Width
    file.read_exact(&mut buf4).map_err(|e| format!("PSD read error: {}", e))?;
    let width = u32::from_be_bytes(buf4);

    // Depth
    file.read_exact(&mut buf2).map_err(|e| format!("PSD read error: {}", e))?;
    let depth = u16::from_be_bytes(buf2);
    if depth != 8 {
        return Err(format!("Unsupported bit depth: {}", depth));
    }

    // Color Mode
    file.read_exact(&mut buf2).map_err(|e| format!("PSD read error: {}", e))?;
    let color_mode = u16::from_be_bytes(buf2);
    if color_mode != 3 && color_mode != 1 {
        return Err(format!("Unsupported color mode: {} (RGB/Grayscale only)", color_mode));
    }

    // === Color Mode Data Section ===
    file.read_exact(&mut buf4).map_err(|e| format!("PSD read error: {}", e))?;
    let color_mode_len = u32::from_be_bytes(buf4);
    file.seek(SeekFrom::Current(color_mode_len as i64)).map_err(|e| format!("Seek error: {}", e))?;

    // === Image Resources Section ===
    file.read_exact(&mut buf4).map_err(|e| format!("PSD read error: {}", e))?;
    let resources_len = u32::from_be_bytes(buf4);
    file.seek(SeekFrom::Current(resources_len as i64)).map_err(|e| format!("Seek error: {}", e))?;

    // === Layer and Mask Information Section ===
    if version == 2 {
        let mut buf8 = [0u8; 8];
        file.read_exact(&mut buf8).map_err(|e| format!("PSD read error: {}", e))?;
        let layer_len = u64::from_be_bytes(buf8);
        file.seek(SeekFrom::Current(layer_len as i64)).map_err(|e| format!("Seek error: {}", e))?;
    } else {
        file.read_exact(&mut buf4).map_err(|e| format!("PSD read error: {}", e))?;
        let layer_len = u32::from_be_bytes(buf4);
        file.seek(SeekFrom::Current(layer_len as i64)).map_err(|e| format!("Seek error: {}", e))?;
    }

    // === Image Data Section ===
    file.read_exact(&mut buf2).map_err(|e| format!("PSD read error: {}", e))?;
    let compression = u16::from_be_bytes(buf2);

    let pixels = (width as usize) * (height as usize);
    let num_channels = channels.min(4);

    match compression {
        0 => {
            // Raw (uncompressed)
            let mut channel_data = vec![vec![0u8; pixels]; num_channels];
            for ch in 0..num_channels {
                file.read_exact(&mut channel_data[ch]).map_err(|e| format!("Image data read error: {}", e))?;
            }
            channels_to_rgba(channel_data, width, height, color_mode)
        }
        1 => {
            // RLE compressed
            decode_rle_image(&mut file, width, height, num_channels, color_mode, version)
        }
        _ => {
            Err(format!("Unsupported compression: {}", compression))
        }
    }
}

/// RLE圧縮された画像データをデコード
fn decode_rle_image<R: Read>(
    file: &mut R,
    width: u32,
    height: u32,
    num_channels: usize,
    color_mode: u16,
    version: u16,
) -> Result<DynamicImage, String> {
    let rows = height as usize;
    let pixels = (width as usize) * rows;

    // 各チャンネルの各行のバイト数を読み取る
    let total_rows = rows * num_channels;
    let mut row_lengths = vec![0u16; total_rows];

    if version == 2 {
        let mut buf4 = [0u8; 4];
        for i in 0..total_rows {
            file.read_exact(&mut buf4).map_err(|e| format!("Row length read error: {}", e))?;
            row_lengths[i] = u32::from_be_bytes(buf4) as u16;
        }
    } else {
        let mut buf2 = [0u8; 2];
        for i in 0..total_rows {
            file.read_exact(&mut buf2).map_err(|e| format!("Row length read error: {}", e))?;
            row_lengths[i] = u16::from_be_bytes(buf2);
        }
    }

    // 各チャンネルをデコード
    let mut channel_data = vec![vec![0u8; pixels]; num_channels];

    for ch in 0..num_channels {
        for row in 0..rows {
            let row_idx = ch * rows + row;
            let row_len = row_lengths[row_idx] as usize;

            let mut compressed = vec![0u8; row_len];
            file.read_exact(&mut compressed).map_err(|e| format!("RLE data read error: {}", e))?;

            let row_start = row * width as usize;
            let row_data = &mut channel_data[ch][row_start..row_start + width as usize];
            decode_packbits(&compressed, row_data);
        }
    }

    channels_to_rgba(channel_data, width, height, color_mode)
}

/// PackBits RLEデコード
fn decode_packbits(input: &[u8], output: &mut [u8]) {
    let mut i = 0;
    let mut o = 0;

    while i < input.len() && o < output.len() {
        let n = input[i] as i8;
        i += 1;

        if n >= 0 {
            // Literal: copy n+1 bytes
            let count = (n as usize) + 1;
            let end = (o + count).min(output.len());
            let src_end = (i + count).min(input.len());
            let copy_len = (end - o).min(src_end - i);
            output[o..o + copy_len].copy_from_slice(&input[i..i + copy_len]);
            i += count;
            o += count;
        } else if n > -128 {
            // Repeat: repeat next byte (-n+1) times
            let count = (-n as usize) + 1;
            if i < input.len() {
                let val = input[i];
                i += 1;
                let end = (o + count).min(output.len());
                for j in o..end {
                    output[j] = val;
                }
                o += count;
            }
        }
    }
}

/// チャンネルデータをRGBA画像に変換
fn channels_to_rgba(channel_data: Vec<Vec<u8>>, width: u32, height: u32, color_mode: u16) -> Result<DynamicImage, String> {
    let pixels = (width as usize) * (height as usize);
    let mut rgba = vec![255u8; pixels * 4];

    match color_mode {
        3 => {
            // RGB
            for i in 0..pixels {
                rgba[i * 4] = channel_data.get(0).map(|c| c[i]).unwrap_or(0);
                rgba[i * 4 + 1] = channel_data.get(1).map(|c| c[i]).unwrap_or(0);
                rgba[i * 4 + 2] = channel_data.get(2).map(|c| c[i]).unwrap_or(0);
                rgba[i * 4 + 3] = channel_data.get(3).map(|c| c[i]).unwrap_or(255);
            }
        }
        1 => {
            // Grayscale
            for i in 0..pixels {
                let gray = channel_data.get(0).map(|c| c[i]).unwrap_or(0);
                rgba[i * 4] = gray;
                rgba[i * 4 + 1] = gray;
                rgba[i * 4 + 2] = gray;
                rgba[i * 4 + 3] = channel_data.get(1).map(|c| c[i]).unwrap_or(255);
            }
        }
        _ => {}
    }

    let img: RgbaImage = ImageBuffer::from_raw(width, height, rgba)
        .ok_or_else(|| format!("Failed to create RGBA image ({}x{})", width, height))?;
    Ok(DynamicImage::ImageRgba8(img))
}

// ============================================
// High Resolution Preview for Guide Editor
// ============================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HighResPreviewResult {
    pub file_path: String,
    pub original_width: u32,
    pub original_height: u32,
    pub preview_width: u32,
    pub preview_height: u32,
}

/// Generate a high-resolution preview image for the guide editor
/// Returns the path to a temporary JPEG file that can be loaded via asset:// protocol
#[tauri::command]
pub async fn get_high_res_preview(
    file_path: String,
    max_size: u32,
) -> Result<HighResPreviewResult, String> {
    // Run blocking operations in a separate thread to prevent UI freeze
    tokio::task::spawn_blocking(move || {
        get_high_res_preview_sync(&file_path, max_size)
    })
    .await
    .map_err(|e| format!("Task error: {}", e))?
}

/// Synchronous version of get_high_res_preview (runs in blocking thread)
/// 3層キャッシュ: メモリ → ディスク → フル生成
fn get_high_res_preview_sync(file_path: &str, max_size: u32) -> Result<HighResPreviewResult, String> {
    let path = Path::new(file_path);

    // ファイル更新日時でキャッシュ無効化を管理
    let modified_secs = get_file_modified_secs(path);

    let original_name = path.file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("preview");

    // 決定論的キャッシュキー（ファイル更新時に自動無効化）
    let cache_key = format!("{}_{}_{}", file_path, modified_secs, max_size);

    // ===== Layer 1: メモリキャッシュ（~0ms） =====
    if let Ok(cache) = get_preview_result_cache().lock() {
        if let Some(cached_result) = cache.get(&cache_key) {
            if Path::new(&cached_result.file_path).exists() {
                return Ok(cached_result.clone());
            }
        }
    }

    // ===== Layer 2: ディスクキャッシュ（~5-10ms） =====
    let temp_dir = std::env::temp_dir();
    let preview_filename = format!(
        "manga_psd_preview_{}_{}_{}.jpg",
        original_name, modified_secs, max_size
    );
    let preview_path = temp_dir.join(&preview_filename);

    if preview_path.exists() {
        let extension = path.extension().and_then(|e| e.to_str()).unwrap_or("");
        let is_psd = extension.eq_ignore_ascii_case("psd") || extension.eq_ignore_ascii_case("psb");

        let (original_width, original_height) = if is_psd {
            read_psd_dimensions(path)?
        } else {
            image::image_dimensions(path)
                .map_err(|e| format!("Failed to read image dimensions: {}", e))?
        };

        let (preview_width, preview_height) = image::image_dimensions(&preview_path)
            .map_err(|e| format!("Failed to read preview dimensions: {}", e))?;

        let result = HighResPreviewResult {
            file_path: preview_path.to_string_lossy().to_string(),
            original_width,
            original_height,
            preview_width,
            preview_height,
        };

        // メモリキャッシュに追加
        if let Ok(mut cache) = get_preview_result_cache().lock() {
            if cache.len() >= MAX_PREVIEW_CACHE_ENTRIES {
                cache.clear();
            }
            cache.insert(cache_key, result.clone());
        }

        return Ok(result);
    }

    // ===== Layer 3: フル生成 =====
    let extension = path.extension().and_then(|e| e.to_str()).unwrap_or("");
    let is_psd = extension.eq_ignore_ascii_case("psd") || extension.eq_ignore_ascii_case("psb");

    let (img, original_width, original_height) = if is_psd {
        let img = get_or_cache_psd(path)?;
        let (width, height) = img.dimensions();
        (img, width, height)
    } else {
        let file_bytes = fs::read(path)
            .map_err(|e| format!("Failed to read file: {}", e))?;
        let img = image::load_from_memory(&file_bytes)
            .map_err(|e| format!("Failed to load image: {}", e))?;
        let (width, height) = img.dimensions();
        (img, width, height)
    };

    // Triangleフィルタでリサイズ（高速、ガイド配置には十分な品質）
    let resized = img.resize(max_size, max_size, FilterType::Triangle);
    let (preview_width, preview_height) = resized.dimensions();

    // JPEG品質85で保存（速度と品質のバランス）
    use image::codecs::jpeg::JpegEncoder;
    let file = File::create(&preview_path)
        .map_err(|e| format!("Failed to create preview file: {}", e))?;
    let mut writer = std::io::BufWriter::new(file);
    let encoder = JpegEncoder::new_with_quality(&mut writer, 85);
    resized.write_with_encoder(encoder)
        .map_err(|e| format!("Failed to encode preview JPEG: {}", e))?;

    let result = HighResPreviewResult {
        file_path: preview_path.to_string_lossy().to_string(),
        original_width,
        original_height,
        preview_width,
        preview_height,
    };

    // メモリキャッシュに追加
    if let Ok(mut cache) = get_preview_result_cache().lock() {
        if cache.len() >= MAX_PREVIEW_CACHE_ENTRIES {
            cache.clear();
        }
        cache.insert(cache_key, result.clone());
    }

    Ok(result)
}

/// Clean up old preview files from temp directory
#[tauri::command]
pub async fn cleanup_preview_files() -> Result<u32, String> {
    let temp_dir = std::env::temp_dir();
    let mut cleaned_count = 0u32;

    if let Ok(entries) = fs::read_dir(&temp_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if let Some(filename) = path.file_name().and_then(|s| s.to_str()) {
                if filename.starts_with("manga_psd_preview_") && filename.ends_with(".jpg") {
                    // Check if file is older than 1 hour
                    if let Ok(metadata) = fs::metadata(&path) {
                        if let Ok(modified) = metadata.modified() {
                            if let Ok(age) = SystemTime::now().duration_since(modified) {
                                if age.as_secs() > 86400 {
                                    if fs::remove_file(&path).is_ok() {
                                        cleaned_count += 1;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(cleaned_count)
}

// ============================================
// Layer Replacement (差替え)
// ============================================

/// 自然順ソート用のキー生成
fn natural_sort_key(s: &str) -> Vec<(bool, String)> {
    let mut result = Vec::new();
    let mut current = String::new();
    let mut in_digit = false;

    for ch in s.chars() {
        let is_digit = ch.is_ascii_digit();
        if is_digit != in_digit && !current.is_empty() {
            if in_digit {
                // 数字部分はゼロ埋め20桁で統一
                result.push((true, format!("{:0>20}", current)));
            } else {
                result.push((false, current.to_lowercase()));
            }
            current.clear();
        }
        in_digit = is_digit;
        current.push(ch);
    }
    if !current.is_empty() {
        if in_digit {
            result.push((true, format!("{:0>20}", current)));
        } else {
            result.push((false, current.to_lowercase()));
        }
    }
    result
}

/// List files in a folder with PSD/PSB/TIF/TIFF extension filter and natural sort
#[tauri::command]
pub async fn list_folder_files(
    folder_path: String,
    recursive: bool,
) -> Result<Vec<String>, String> {
    let folder = Path::new(&folder_path);
    if !folder.exists() || !folder.is_dir() {
        return Err(format!("Folder not found: {}", folder_path));
    }

    let mut files = Vec::new();
    collect_files(folder, recursive, &mut files)?;

    // 自然順ソート
    files.sort_by(|a, b| {
        let key_a = natural_sort_key(
            Path::new(a)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or(""),
        );
        let key_b = natural_sort_key(
            Path::new(b)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or(""),
        );
        key_a.cmp(&key_b)
    });

    Ok(files)
}

/// Recursively collect PSD/PSB/TIF/TIFF files
fn collect_files(dir: &Path, recursive: bool, files: &mut Vec<String>) -> Result<(), String> {
    let entries = fs::read_dir(dir)
        .map_err(|e| format!("Failed to read dir {}: {}", dir.display(), e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Entry error: {}", e))?;
        let path = entry.path();

        if path.is_file() {
            if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                let ext_lower = ext.to_lowercase();
                if ext_lower == "psd" || ext_lower == "psb" || ext_lower == "tif" || ext_lower == "tiff" {
                    files.push(path.to_string_lossy().to_string());
                }
            }
        } else if recursive && path.is_dir() {
            collect_files(&path, recursive, files)?;
        }
    }

    Ok(())
}

/// List subfolders in a directory
#[tauri::command]
pub async fn list_subfolders(
    folder_path: String,
) -> Result<Vec<String>, String> {
    let folder = Path::new(&folder_path);
    if !folder.exists() || !folder.is_dir() {
        return Err(format!("Folder not found: {}", folder_path));
    }

    let mut subfolders = Vec::new();
    let entries = fs::read_dir(folder)
        .map_err(|e| format!("Failed to read dir: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Entry error: {}", e))?;
        let path = entry.path();
        if path.is_dir() {
            subfolders.push(path.to_string_lossy().to_string());
        }
    }

    // 自然順ソート
    subfolders.sort_by(|a, b| {
        let key_a = natural_sort_key(
            Path::new(a).file_name().and_then(|n| n.to_str()).unwrap_or(""),
        );
        let key_b = natural_sort_key(
            Path::new(b).file_name().and_then(|n| n.to_str()).unwrap_or(""),
        );
        key_a.cmp(&key_b)
    });

    Ok(subfolders)
}

// --- Replace Job Settings for JSX ---

#[derive(Debug, Serialize, Deserialize)]
pub struct ReplaceTextSettings {
    #[serde(rename = "subMode")]
    pub sub_mode: String,
    #[serde(rename = "groupName")]
    pub group_name: String,
    #[serde(rename = "partialMatch")]
    pub partial_match: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReplaceImageSettings {
    #[serde(rename = "replaceBackground")]
    pub replace_background: bool,
    #[serde(rename = "replaceSpecialLayer")]
    pub replace_special_layer: bool,
    #[serde(rename = "specialLayerName")]
    pub special_layer_name: String,
    #[serde(rename = "specialLayerPartialMatch")]
    pub special_layer_partial_match: bool,
    #[serde(rename = "replaceNamedGroup")]
    pub replace_named_group: bool,
    #[serde(rename = "namedGroupName")]
    pub named_group_name: String,
    #[serde(rename = "namedGroupPartialMatch")]
    pub named_group_partial_match: bool,
    #[serde(rename = "placeFromBottom")]
    pub place_from_bottom: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReplaceGeneralSettings {
    #[serde(rename = "skipResize")]
    pub skip_resize: bool,
    #[serde(rename = "roundFontSize")]
    pub round_font_size: bool,
    #[serde(rename = "saveFileName")]
    pub save_file_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReplacePairEntry {
    #[serde(rename = "sourceFile")]
    pub source_file: String,
    #[serde(rename = "targetFile")]
    pub target_file: String,
    #[serde(rename = "outputDir")]
    pub output_dir: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReplaceJobSettings {
    pub mode: String,
    pub pairs: Vec<ReplacePairEntry>,
    #[serde(rename = "textSettings")]
    pub text_settings: ReplaceTextSettings,
    #[serde(rename = "imageSettings")]
    pub image_settings: ReplaceImageSettings,
    #[serde(rename = "generalSettings")]
    pub general_settings: ReplaceGeneralSettings,
    #[serde(rename = "outputPath")]
    pub output_path: String,
}

/// Run Photoshop to replace layers between paired PSD files
#[tauri::command]
pub async fn run_photoshop_replace(
    app_handle: tauri::AppHandle,
    jobs: ReplaceJobSettings,
) -> Result<Vec<PhotoshopResult>, String> {
    use std::process::Command;
    use std::io::Write;

    let ps_path = find_photoshop_path()
        .ok_or_else(|| "Photoshop not found. Please install Adobe Photoshop.".to_string())?;

    // Resolve script path
    let resource_path = app_handle
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?;

    let script_path = resource_path.join("scripts").join("replace_layers.jsx");

    let script_path_str = if script_path.exists() {
        script_path.to_string_lossy().to_string()
    } else {
        let dev_script = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("scripts")
            .join("replace_layers.jsx");
        if dev_script.exists() {
            dev_script.to_string_lossy().to_string()
        } else {
            return Err("Replace script not found".to_string());
        }
    };

    let temp_dir = std::env::temp_dir();
    let settings_path = temp_dir.join("psd_replace_settings.json");
    let output_path = temp_dir.join("psd_replace_results.json");

    let _ = fs::remove_file(&output_path);

    // Update settings with output path and normalize paths
    let mut jobs_normalized = jobs;
    jobs_normalized.output_path = output_path.to_string_lossy().to_string().replace("\\", "/");
    for pair in &mut jobs_normalized.pairs {
        pair.source_file = pair.source_file.replace("\\", "/");
        pair.target_file = pair.target_file.replace("\\", "/");
        pair.output_dir = pair.output_dir.replace("\\", "/");
    }

    let settings_json = serde_json::to_string_pretty(&jobs_normalized)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    let mut settings_file = fs::File::create(&settings_path)
        .map_err(|e| format!("Failed to create settings file: {}", e))?;
    // UTF-8 BOM for Japanese support
    settings_file.write_all(&[0xEF, 0xBB, 0xBF])
        .map_err(|e| format!("Failed to write BOM: {}", e))?;
    settings_file.write_all(settings_json.as_bytes())
        .map_err(|e| format!("Failed to write settings: {}", e))?;

    eprintln!("Replace - Photoshop: {}", ps_path);
    eprintln!("Replace - Script: {}", script_path_str);
    eprintln!("Replace - Pairs: {}", jobs_normalized.pairs.len());
    eprintln!("Replace - Mode: {}", jobs_normalized.mode);

    let _output = Command::new(&ps_path)
        .arg("-r")
        .arg(&script_path_str)
        .output()
        .map_err(|e| format!("Failed to run Photoshop: {}", e))?;

    // Poll for results (replacement is slow: 2 files per pair)
    let max_wait_secs = 600; // 10 minutes
    let poll_interval_ms = 500;
    let max_polls = (max_wait_secs * 1000) / poll_interval_ms;

    for poll in 0..max_polls {
        if output_path.exists() {
            if let Ok(content) = fs::read_to_string(&output_path) {
                if content.trim().starts_with('[') && content.trim().ends_with(']') {
                    eprintln!("Replace output ready after {} polls", poll);
                    break;
                }
            }
        }
        std::thread::sleep(std::time::Duration::from_millis(poll_interval_ms as u64));

        if poll > 0 && poll % 20 == 0 {
            eprintln!("Still waiting for Photoshop replace... ({} seconds)", poll * poll_interval_ms / 1000);
        }
    }

    if output_path.exists() {
        let results_json = fs::read_to_string(&output_path)
            .map_err(|e| format!("Failed to read results: {}", e))?;

        let results: Vec<PhotoshopResult> = serde_json::from_str(&results_json)
            .map_err(|e| format!("Failed to parse results: {}. JSON was: {}", e, results_json))?;

        let _ = fs::remove_file(&settings_path);
        let _ = fs::remove_file(&output_path);

        if let Some(window) = app_handle.get_webview_window("main") {
            let _ = window.set_focus();
        }

        Ok(results)
    } else {
        if let Some(window) = app_handle.get_webview_window("main") {
            let _ = window.set_focus();
        }
        Err("Photoshop did not produce output file. Script may have failed.".to_string())
    }
}
