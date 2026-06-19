use image::DynamicImage;
use pdfium_render::prelude::*;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

/// Default DPI for Photoshop PDF opening (manga standard)
const PDF_TARGET_DPI: f64 = 600.0;

/// PDF points are at 72 DPI
const PDF_POINTS_DPI: f64 = 72.0;

/// ローカルキャッシュの pdfium 配置先（%LOCALAPPDATA%\COMIC-Bridge\pdfium\pdfium.dll）。
/// G:(配布元)から取得した実体をここに置き、実行時はここから読む（=オフラインでもPDFが動く）。
fn local_pdfium_path() -> Option<PathBuf> {
    let lad = std::env::var("LOCALAPPDATA").ok()?;
    Some(
        Path::new(&lad)
            .join("COMIC-Bridge")
            .join("pdfium")
            .join("pdfium.dll"),
    )
}

/// pdfium をローカルへ用意して、そのパスを返す。
/// 方針: G:(参照アドレス `pdf.pdfiumPath`)を「配布元」、ローカル(%LOCALAPPDATA%)を「実行時の実体」とする。
///   1. ローカルが期待ハッシュ(`pdf.pdfiumSha256`)と一致 → ローカルを使う（**G:接続不要＝オフライン可**）。
///   2. 不在/不一致(=配布元で版が更新された) → G:から取得（**配布元・コピー後の両方でハッシュ検証**）してローカルへ原子的に配置（=最新化）。
///   3. 期待ハッシュ未設定(dev/未シール) → Err（呼び出し側の従来フォールバックに委ねる）。
fn ensure_local_pdfium() -> Result<String, String> {
    let expected = crate::address_ref::get_opt("pdf.pdfiumSha256")
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .ok_or("pdf.pdfiumSha256 未設定")?;
    let local = local_pdfium_path().ok_or("LOCALAPPDATA を取得できません")?;

    // 1) ローカルが期待ハッシュと一致なら、それを使う（G:を見に行かない＝オフライン動作）。
    if local.exists() {
        if let Ok(h) = crate::integrity::sha256_file(&local) {
            if h.eq_ignore_ascii_case(&expected) {
                return Ok(local.to_string_lossy().to_string());
            }
        }
    }

    // 2) 不一致/不在 → 配布元(G:)から取得して最新化を試みる。
    let src = crate::address_ref::get_opt("pdf.pdfiumPath")
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .ok_or("pdf.pdfiumPath 未設定（配布元が不明）")?;
    let src_path = Path::new(&src);
    if !src_path.exists() {
        return Err(
            "配布元(G:)の pdfium.dll に到達できません（初回はG:に接続して起動してください）。".to_string(),
        );
    }
    // 配布元の版ズレ/改ざんを弾く（汚染ファイルをローカルに残さない）。
    let src_hash = crate::integrity::sha256_file(src_path)?;
    if !src_hash.eq_ignore_ascii_case(&expected) {
        return Err("配布元(G:)の pdfium.dll が期待ハッシュと一致しません（版ズレ/改ざんの可能性）。addresses の pdf.pdfiumSha256 を再シールしてください。".to_string());
    }
    // 親フォルダ作成 → 一時ファイルへコピー → 検証 → リネーム（原子的差し替え）。
    if let Some(parent) = local.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("pdfium ローカル保存先を作成できません: {}", e))?;
    }
    let tmp = local.with_extension("dll.tmp");
    std::fs::copy(src_path, &tmp).map_err(|e| format!("pdfium のローカルコピーに失敗: {}", e))?;
    let copied_hash = crate::integrity::sha256_file(&tmp)?;
    if !copied_hash.eq_ignore_ascii_case(&expected) {
        let _ = std::fs::remove_file(&tmp);
        return Err("pdfium のローカルコピーが検証に失敗しました（コピー破損の可能性）。".to_string());
    }
    std::fs::rename(&tmp, &local).map_err(|e| format!("pdfium のローカル配置に失敗: {}", e))?;
    Ok(local.to_string_lossy().to_string())
}

fn resolve_pdfium_library() -> Result<String, String> {
    // 0a. 配布元(G: pdf.pdfiumPath)→ローカル(%LOCALAPPDATA%)へ用意して使う。
    //     一度ローカルに置けば、以後はG:未接続でもPDFが使える（オフライン対応）。
    //     G:接続時は期待ハッシュ(pdf.pdfiumSha256)と照合し、版が変われば自動で取り直す（最新化）。
    match ensure_local_pdfium() {
        Ok(local) => return Ok(local),
        Err(e) => crate::dlog!("[pdfium] ローカル用意を見送り: {}", e),
    }

    // 0b. フォールバック: ローカルに用意できない時は配布元(G:)を直接使う（従来動作・要G:接続）。
    if let Some(p) = crate::address_ref::get_opt("pdf.pdfiumPath") {
        if !p.trim().is_empty() && Path::new(&p).exists() {
            return Ok(p);
        }
    }

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

    Err("PDFium(pdfium.dll)が見つかりません。初回はG:(共有の配布元 pdf.pdfiumPath)に接続して起動し、ローカルへ取得してください。".to_string())
}

/// Resolve the path to the PDFium library（セッション内で1回だけ解決・成功時のみ記憶）。
/// G:→ローカル同期は起動時の check_pdfium で1回実行され、以後はキャッシュを使う。
/// 失敗(=G:未接続でローカルも無い等)は記憶しない＝あとでG:に繋いで再試行すれば回復する。
fn find_pdfium_library() -> Result<String, String> {
    static RESOLVED: OnceLock<String> = OnceLock::new();
    if let Some(p) = RESOLVED.get() {
        return Ok(p.clone());
    }
    let p = resolve_pdfium_library()?;
    let _ = RESOLVED.set(p.clone());
    Ok(p)
}

/// 起動時/事前チェック用: pdfium を解決し整合性検証して、使うパスを返す。
/// 失敗時は Err（PDF機能はその時点でエラー停止する）。
pub fn check_pdfium() -> Result<String, String> {
    let lib_path = find_pdfium_library()?;
    crate::integrity::verify_pdfium(Path::new(&lib_path))?;
    Ok(lib_path)
}

/// Create a new Pdfium instance.
/// Note: Pdfium is !Send + !Sync, so this must be called within the thread
/// that will use it (e.g., inside spawn_blocking).
fn create_pdfium() -> Result<Pdfium, String> {
    let lib_path = find_pdfium_library()?;
    // 整合性の門番: pdfium.dll が差し替えられていないかロード前に検証（初回のみ算出）。
    crate::integrity::verify_pdfium(Path::new(&lib_path))?;
    crate::dlog!("PDF - Loading PDFium from: {}", lib_path);

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

/// PDFのマジックバイト(%PDF-)を確認（拡張子偽装/非PDFをpdfiumに渡さない門番）。
/// 先頭1KB内に %PDF- が無ければ拒否（pdfiumへ不正データを渡すリスクを減らす）。
fn check_pdf_magic(file_path: &str) -> Result<(), String> {
    use std::io::Read;
    let mut f = std::fs::File::open(file_path).map_err(|e| format!("PDFを開けません: {}", e))?;
    let mut buf = [0u8; 1024];
    let n = f
        .read(&mut buf)
        .map_err(|e| format!("PDF読み取りエラー: {}", e))?;
    if !buf[..n].windows(5).any(|w| w == b"%PDF-") {
        return Err("PDFファイルではありません（%PDF- シグネチャがありません）。".to_string());
    }
    Ok(())
}

/// Get PDF page count and dimensions (at target DPI for Photoshop compatibility).
/// Must be called from a blocking thread.
pub fn get_pdf_info_sync(file_path: &str) -> Result<PdfInfo, String> {
    check_pdf_magic(file_path)?;
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
    check_pdf_magic(file_path)?;
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

    let image = bitmap.as_image();

    Ok((image, original_width, original_height))
}
