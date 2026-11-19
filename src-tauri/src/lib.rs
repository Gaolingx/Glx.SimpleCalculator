//! Tauri adapter layer.
//!
//! Boundaries (see `PLAN/TODO/01-Addfeatures/HANDOFF.md` §3.10):
//! - session state, persistence, network and IPC commands live here;
//! - arithmetic is delegated to `calc-core`;
//! - IPC contracts mirror `calc-core::{view,error,command}`.

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_log::Builder::default().build())
        .run(tauri::generate_context!())
        .expect("failed to launch Glx Calculator");
}
