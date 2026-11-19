//! Clipboard bridge for the frontend.
//!
//! Rust owns the system clipboard so the UI does not need the plugin's JS
//! package. The frontend applies the 1,000-character expression limit; this
//! layer only protects the IPC boundary.

use calc_core::{ErrorCode, ErrorInfo};
use tauri::AppHandle;
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_log::log::{debug, error};

const MAX_COPY_CHARS: usize = 10_000;
const MAX_READ_CHARS: usize = 10_000;

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

#[tauri::command]
pub fn clipboard_read(app: AppHandle) -> Result<String, ErrorInfo> {
    // Windows reports an error when the clipboard holds no text; treat that as
    // an empty paste so the UI can show a benign message instead of INTERNAL.
    let text = match app.clipboard().read_text() {
        Ok(text) => text,
        Err(failure) => {
            debug!("clipboard read returned no text: {failure}");
            String::new()
        }
    };
    if text.chars().count() > MAX_READ_CHARS {
        return Err(ErrorInfo::new(ErrorCode::InvalidInput));
    }
    Ok(text)
}
