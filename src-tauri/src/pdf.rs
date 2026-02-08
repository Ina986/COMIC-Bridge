use image::DynamicImage;
use pdfium_render::prelude::*;
use std::path::Path;

/// Default DPI for Photoshop PDF opening (manga standard)
const PDF_TARGET_DPI: f64 = 600.0;

/// PDF points are at 72 DPI
const PDF_POINTS_DPI: f64 = 72.0;

/// Resolve the path to the PDFium library.
/// Searches:
///   1. CARGO_MANIFEST_DIR/resources/pdfium/ (dev)
///   2. Executable directory
///   3. System library path
fn find_pdfium_library() -> Result<String, String> {
    // Dev: check CARGO_MANIFEST_DIR/resources/pdfium/
    if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
        let dev_path = Path::new(&manifest_dir).join("resources").join("pdfium");
        let dll_path = dev_path.join("pdfium.dll");
        if dll_path.exists() {
            return Ok(dll_path.to_string_lossy().to_string());
        }
    }

    // Production: check next to executable
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let dll_path = exe_dir.join("pdfium.dll");
            if dll_path.exists() {
                return Ok(dll_path.to_string_lossy().to_string());
            }
            // Also check resources/pdfium subdirectory
            let dll_path = exe_dir.join("resources").join("pdfium").join("pdfium.dll");
            if dll_path.exists() {
                return Ok(dll_path.to_string_lossy().to_string());
            }
        }
    }

    Err("PDFium library (pdfium.dll) not found. Place it in src-tauri/resources/pdfium/".to_string())
}

/// Create a new Pdfium instance.
/// Note: Pdfium is !Send + !Sync, so this must be called within the thread
/// that will use it (e.g., inside spawn_blocking).
fn create_pdfium() -> Result<Pdfium, String> {
    let lib_path = find_pdfium_library()?;
    eprintln!("PDF - Loading PDFium from: {}", lib_path);

    let bindings = Pdfium::bind_to_library(&lib_path)
        .map_err(|e| format!("Failed to load PDFium library: {:?}", e))?;

    Ok(Pdfium::new(bindings))
}

#[derive(Debug, Clone)]
pub struct PdfPageInfo {
    pub width_px: u32,
    pub height_px: u32,
}

#[derive(Debug, Clone)]
pub struct PdfInfo {
    pub page_count: usize,
    pub pages: Vec<PdfPageInfo>,
}

/// Get PDF page count and dimensions (at target DPI for Photoshop compatibility).
/// Must be called from a blocking thread.
pub fn get_pdf_info_sync(file_path: &str) -> Result<PdfInfo, String> {
    let pdfium = create_pdfium()?;

    let document = pdfium
        .load_pdf_from_file(file_path, None)
        .map_err(|e| format!("Failed to open PDF: {:?}", e))?;

    let page_count = document.pages().len();
    let dpi_scale = PDF_TARGET_DPI / PDF_POINTS_DPI;

    let mut pages = Vec::with_capacity(page_count as usize);
    for i in 0..page_count {
        let page = document
            .pages()
            .get(i)
            .map_err(|e| format!("Failed to get page {}: {:?}", i, e))?;

        let width_pts = page.width().value as f64;
        let height_pts = page.height().value as f64;

        pages.push(PdfPageInfo {
            width_px: (width_pts * dpi_scale).round() as u32,
            height_px: (height_pts * dpi_scale).round() as u32,
        });
    }

    Ok(PdfInfo {
        page_count: page_count as usize,
        pages,
    })
}

/// Render a PDF page to a DynamicImage at the given max size.
/// The image is scaled to fit within max_size x max_size while preserving aspect ratio.
/// Must be called from a blocking thread.
pub fn render_pdf_page_sync(
    file_path: &str,
    page_index: usize,
    max_size: u32,
) -> Result<(DynamicImage, u32, u32), String> {
    let pdfium = create_pdfium()?;

    let document = pdfium
        .load_pdf_from_file(file_path, None)
        .map_err(|e| format!("Failed to open PDF: {:?}", e))?;

    let page = document
        .pages()
        .get(page_index as u16)
        .map_err(|e| format!("Failed to get page {}: {:?}", page_index, e))?;

    // Original dimensions at target DPI (what Photoshop will see)
    let dpi_scale = PDF_TARGET_DPI / PDF_POINTS_DPI;
    let original_width = (page.width().value as f64 * dpi_scale).round() as u32;
    let original_height = (page.height().value as f64 * dpi_scale).round() as u32;

    // Render at a size that fits within max_size
    let render_config = PdfRenderConfig::new()
        .set_target_width(max_size as i32)
        .set_maximum_height(max_size as i32);

    let bitmap = page
        .render_with_config(&render_config)
        .map_err(|e| format!("Failed to render PDF page: {:?}", e))?;

    let image = bitmap
        .as_image();

    Ok((image, original_width, original_height))
}
