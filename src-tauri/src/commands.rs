use image::{DynamicImage, GenericImageView, ImageBuffer, Rgba, imageops::FilterType};
use psd::Psd;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tauri::Manager;
use thiserror::Error;

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

        Ok(results)
    } else {
        Err("Photoshop did not produce output file. Script may have failed. Check if Photoshop opened and ran the script.".to_string())
    }
}
