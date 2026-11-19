//! Tauri adapter layer.
//!
//! Boundaries (see `PLAN/TODO/01-Addfeatures/HANDOFF.md` §3.10):
//! - session state, persistence, network and IPC commands live here;
//! - arithmetic is delegated to `calc-core`;
//! - IPC contracts mirror `calc-core::{view,error,command}`.

mod clipboard;
mod history;
mod session;
mod settings;

use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_log::Builder::default().build())
        .setup(|app| {
            let loaded = settings::load(app.handle());
            let history_limit = loaded.history_limit as usize;
            app.manage(settings::SettingsState::new(loaded));
            app.manage(history::HistoryState::load(app.handle(), history_limit));
            app.manage(session::SessionMap::new());
            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(event, tauri::WindowEvent::Destroyed) {
                if let Some(sessions) = window.try_state::<session::SessionMap>() {
                    sessions.remove(window.label());
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            settings::settings_get,
            settings::settings_set,
            settings::settings_reset,
            session::calc_command,
            session::session_reset,
            history::history_list,
            history::history_add,
            history::history_delete,
            history::history_clear,
            clipboard::clipboard_copy,
            clipboard::clipboard_read,
        ])
        .run(tauri::generate_context!())
        .expect("failed to launch Glx Calculator");
}
