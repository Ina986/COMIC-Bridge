//! 悪意ある／破損PSD・PSB への最小限の入口ガード。
//!
//! - ファイルサイズ上限（巨大ファイルでのメモリ枯渇を防ぐ）
//! - `8BPS` シグネチャ／バージョン確認
//! - ヘッダー宣言寸法のサニティ検査（細工された巨大寸法で psd/ag-psd クレートが
//!   width*height*channels 規模の過大アロケーションを行いクラッシュするのを未然に防ぐ）
//!
//! これはパース前の早期検出。最終的な堅牢性はパーサ実装に依存する（脅威モデル 11_ 参照）。

use std::fs;
use std::path::Path;

/// PSD/PSB の最大ファイルサイズ（4 GiB）。PSB の大判原稿も通る寛大な値。
const MAX_PSD_FILE_BYTES: u64 = 4 * 1024 * 1024 * 1024;
/// 1 軸あたりの最大寸法（PSB 仕様上限 = 300,000 px）。これを超える宣言は不正とみなす。
const MAX_PSD_DIMENSION: u32 = 300_000;
/// 総画素数の上限（メモリ枯渇防止）。15 億 px ≒ RGBA で約 6 GB。実原稿は十分下回る。
const MAX_PSD_PIXELS: u64 = 1_500_000_000;

/// 拡張子が PSD/PSB のときのみ、読み込み前にファイルサイズ上限を検査する。
/// 非 PSD は素通し（呼び出し側で全ファイルに対して呼んでも安全）。
pub fn guard_psd_file_size(path: &Path) -> Result<(), String> {
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
    if !(ext.eq_ignore_ascii_case("psd") || ext.eq_ignore_ascii_case("psb")) {
        return Ok(());
    }
    let len = fs::metadata(path).map(|m| m.len()).unwrap_or(0);
    if len > MAX_PSD_FILE_BYTES {
        return Err(format!(
            "PSDファイルが大きすぎます（{} bytes > 上限 {} bytes）。",
            len, MAX_PSD_FILE_BYTES
        ));
    }
    Ok(())
}

/// PSD ヘッダー（先頭 26 バイト）を検査する。
/// `8BPS` シグネチャ・バージョン・宣言寸法のサニティを確認し、
/// 細工された巨大寸法による過大アロケーションを未然に防ぐ。
/// パース直前（`Psd::from_bytes` の手前）で呼ぶ想定。
pub fn validate_psd_header(bytes: &[u8]) -> Result<(), String> {
    if bytes.len() < 26 {
        return Err("PSDヘッダーが不完全です（26バイト未満）。".to_string());
    }
    if &bytes[0..4] != b"8BPS" {
        return Err("PSDシグネチャ(8BPS)がありません。".to_string());
    }
    let version = u16::from_be_bytes([bytes[4], bytes[5]]);
    if version != 1 && version != 2 {
        return Err(format!("未対応のPSDバージョン: {}", version));
    }
    // ヘッダ: [14..18]=height, [18..22]=width（big-endian）
    let height = u32::from_be_bytes([bytes[14], bytes[15], bytes[16], bytes[17]]);
    let width = u32::from_be_bytes([bytes[18], bytes[19], bytes[20], bytes[21]]);
    if width == 0 || height == 0 || width > MAX_PSD_DIMENSION || height > MAX_PSD_DIMENSION {
        return Err(format!("PSDの寸法が不正です: {}x{}", width, height));
    }
    if (width as u64) * (height as u64) > MAX_PSD_PIXELS {
        return Err(format!(
            "PSDの画素数が大きすぎます: {}x{}（上限 {} px）。",
            width, height, MAX_PSD_PIXELS
        ));
    }
    Ok(())
}

/// 既に読み取った width/height（ヘッダ等から得た値）のサニティ検査。
/// `read_header` / `read_psd_dimensions` の補強用。
pub fn validate_psd_dimensions(width: u32, height: u32) -> Result<(), String> {
    if width == 0 || height == 0 || width > MAX_PSD_DIMENSION || height > MAX_PSD_DIMENSION {
        return Err(format!("PSDの寸法が不正です: {}x{}", width, height));
    }
    if (width as u64) * (height as u64) > MAX_PSD_PIXELS {
        return Err(format!("PSDの画素数が大きすぎます: {}x{}", width, height));
    }
    Ok(())
}
