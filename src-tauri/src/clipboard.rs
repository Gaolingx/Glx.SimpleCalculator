//! Clipboard bridge for the frontend.
//!
//! Rust owns the system clipboard so the UI does not need the plugin's JS
//! package; paste/read support lands with T7.

use calc_core::{ErrorCode, ErrorInfo};
use tauri::AppHandle;
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_log::log::error;

const MAX_COPY_CHARS: usize = 10_000;

#[tauri::command]
pub fn clipboard_copy(app: AppHandle, text: String) -> Result<(), ErrorInfo> {
    if text.is_empty() || text.chars().count() > MAX_COPY_CHARS {
        return Err(ErrorInfo::new(ErrorCode::InvalidInput));
    }
    app.clipboard().write_text(text).map_err(|failure| {
        error!("clipboard write failed: {failure}");
        ErrorInfo::new(ErrorCode::Internal)
    })
}
