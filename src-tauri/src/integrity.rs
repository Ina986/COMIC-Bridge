//! Runtime integrity checks for bundled resources.
//!
//! build.rs generates RESOURCE_HASHES at build time from scripts/*.jsx and
//! resources/pdfium/pdfium.dll when present. At runtime, this module compares
//! the actual file hash against the embedded expected hash before executing
//! Photoshop scripts or loading pdfium.

include!(concat!(env!("OUT_DIR"), "/integrity_manifest.rs"));

use sha2::{Digest, Sha256};
use std::path::Path;
use std::sync::OnceLock;

fn expected_hash(name: &str) -> Option<&'static str> {
    RESOURCE_HASHES
        .iter()
        .find(|(n, _)| *n == name)
        .map(|(_, h)| *h)
}

pub fn sha256_file(path: &Path) -> Result<String, String> {
    let data = std::fs::read(path).map_err(|e| {
        format!(
            "Integrity check failed: cannot read {}: {}",
            path.display(),
            e
        )
    })?;
    let mut hasher = Sha256::new();
    hasher.update(&data);
    Ok(hasher
        .finalize()
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect())
}

pub fn verify_resource(name: &str, path: &Path) -> Result<(), String> {
    match expected_hash(name) {
        Some(expected) => {
            let actual = sha256_file(path)?;
            if actual.eq_ignore_ascii_case(expected) {
                Ok(())
            } else {
                Err(format!(
                    "Integrity check failed: {} hash mismatch. Execution was stopped for safety.",
                    name
                ))
            }
        }
        None => {
            crate::dlog!(
                "[integrity] warning: no expected hash registered, skipping: {}",
                name
            );
            Ok(())
        }
    }
}

pub fn resolve_verified_script(resource_dir: &Path, name: &str) -> Result<String, String> {
    let dev = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("scripts")
        .join(name);
    let res = resource_dir.join("scripts").join(name);

    let path = if cfg!(debug_assertions) && dev.exists() {
        dev
    } else if res.exists() {
        res
    } else if dev.exists() {
        // Last-resort fallback for local non-standard runs where resource_dir is empty.
        // Release builds prefer bundled resources so source edits do not break installed apps.
        dev
    } else {
        return Err(format!("Photoshop script not found: {}", name));
    };

    verify_resource(&format!("scripts/{}", name), &path)?;
    Ok(path.to_string_lossy().to_string())
}

pub fn verify_pdfium(path: &Path) -> Result<(), String> {
    static CACHE: OnceLock<Result<(), String>> = OnceLock::new();
    CACHE
        .get_or_init(|| {
            let expected = crate::address_ref::get_opt("pdf.pdfiumSha256")
                .filter(|s| !s.trim().is_empty())
                .or_else(|| expected_hash("resources/pdfium/pdfium.dll").map(|s| s.to_string()));

            match expected {
                Some(expected) => {
                    let actual = sha256_file(path)?;
                    if actual.eq_ignore_ascii_case(expected.trim()) {
                        Ok(())
                    } else {
                        Err("Integrity check failed: pdfium.dll hash mismatch. Loading was stopped for safety.".to_string())
                    }
                }
                None => {
                    crate::dlog!(
                        "[integrity] warning: no expected pdfium hash registered, skipping"
                    );
                    Ok(())
                }
            }
        })
        .clone()
}

pub fn self_check(resource_dir: &Path) {
    let (mut ok, mut ng, mut missing) = (0u32, 0u32, 0u32);
    for (name, _) in RESOURCE_HASHES.iter() {
        if !name.starts_with("scripts/") {
            continue;
        }
        let path = resource_dir.join(name);
        if !path.exists() {
            missing += 1;
            continue;
        }
        match verify_resource(name, &path) {
            Ok(_) => ok += 1,
            Err(_) => ng += 1,
        }
    }
    eprintln!(
        "[integrity] startup check: ok={} ng={} missing={}",
        ok, ng, missing
    );
}
