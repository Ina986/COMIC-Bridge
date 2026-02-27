use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

// ============================================
// File changed event payload
// ============================================

#[derive(Serialize, Clone, Debug)]
pub struct FileChangedPayload {
    #[serde(rename = "filePath")]
    pub file_path: String,
    #[serde(rename = "modifiedSecs")]
    pub modified_secs: u64,
}

// ============================================
// Watcher state (global singleton)
// ============================================

struct WatcherState {
    _watcher: RecommendedWatcher,
    _debounce_handle: tokio::task::JoinHandle<()>,
}

static WATCHER: OnceLock<Mutex<Option<WatcherState>>> = OnceLock::new();

fn get_watcher_slot() -> &'static Mutex<Option<WatcherState>> {
    WATCHER.get_or_init(|| Mutex::new(None))
}

// Supported extensions for filtering
const WATCH_EXTENSIONS: &[&str] = &[
    "psd", "psb", "jpg", "jpeg", "png", "tif", "tiff", "bmp", "gif", "pdf", "eps",
];

fn is_watched_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| WATCH_EXTENSIONS.contains(&e.to_lowercase().as_str()))
        .unwrap_or(false)
}

fn get_modified_secs(path: &Path) -> u64 {
    std::fs::metadata(path)
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

// ============================================
// Public API
// ============================================

pub fn start(app_handle: AppHandle, file_paths: Vec<String>) -> Result<(), String> {
    // Stop existing watcher first
    stop()?;

    // Collect unique parent directories and build watched file set
    let mut dirs: HashSet<PathBuf> = HashSet::new();
    let mut watched_files: HashSet<PathBuf> = HashSet::new();
    for fp in &file_paths {
        let p = PathBuf::from(fp);
        if let Some(parent) = p.parent() {
            dirs.insert(parent.to_path_buf());
        }
        watched_files.insert(p);
    }

    if dirs.is_empty() {
        return Ok(());
    }

    // Shared state for debouncing
    let pending: Arc<Mutex<HashMap<PathBuf, Instant>>> = Arc::new(Mutex::new(HashMap::new()));
    let watched_files = Arc::new(watched_files);

    // Create the watcher
    let pending_clone = pending.clone();
    let watched_clone = watched_files.clone();
    let mut watcher = RecommendedWatcher::new(
        move |result: Result<Event, notify::Error>| {
            if let Ok(event) = result {
                match event.kind {
                    EventKind::Modify(_) | EventKind::Create(_) => {
                        for path in &event.paths {
                            if is_watched_extension(path) && watched_clone.contains(path) {
                                if let Ok(mut map) = pending_clone.lock() {
                                    map.insert(path.clone(), Instant::now());
                                }
                            }
                        }
                    }
                    _ => {}
                }
            }
        },
        Config::default(),
    )
    .map_err(|e| format!("Failed to create watcher: {}", e))?;

    // Watch each directory
    for dir in &dirs {
        if dir.exists() {
            let _ = watcher.watch(dir, RecursiveMode::NonRecursive);
        }
    }

    // Debounce task: check pending events every 500ms, emit after 2s stability
    let debounce_handle = tokio::spawn(async move {
        let debounce_duration = Duration::from_secs(2);
        let check_interval = Duration::from_millis(500);

        loop {
            tokio::time::sleep(check_interval).await;

            let ready: Vec<PathBuf> = {
                let Ok(mut map) = pending.lock() else {
                    continue;
                };
                let now = Instant::now();
                let mut ready = Vec::new();
                map.retain(|path, last_event| {
                    if now.duration_since(*last_event) >= debounce_duration {
                        ready.push(path.clone());
                        false // remove from pending
                    } else {
                        true // keep waiting
                    }
                });
                ready
            };

            for path in ready {
                let modified_secs = get_modified_secs(&path);
                let payload = FileChangedPayload {
                    file_path: path.to_string_lossy().to_string(),
                    modified_secs,
                };
                let _ = app_handle.emit("file-changed", &payload);
            }
        }
    });

    // Store state
    if let Ok(mut slot) = get_watcher_slot().lock() {
        *slot = Some(WatcherState {
            _watcher: watcher,
            _debounce_handle: debounce_handle,
        });
    }

    Ok(())
}

pub fn stop() -> Result<(), String> {
    if let Ok(mut slot) = get_watcher_slot().lock() {
        if let Some(state) = slot.take() {
            state._debounce_handle.abort();
            // watcher is dropped here, which stops watching
        }
    }
    Ok(())
}
