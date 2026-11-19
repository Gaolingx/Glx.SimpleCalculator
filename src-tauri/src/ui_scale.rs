//! OS interface scaling.
//!
//! WebView2 maps CSS pixels to physical pixels for the monitor DPI, so layout
//! already follows Display → Scale. This module forwards the additional
//! Accessibility → Text size preference (`HKCU\Software\Microsoft\Accessibility`
//! `TextScaleFactor`, an integer percentage) to the rem-based UI.

use serde::Serialize;

const TEXT_SCALE_MIN: u32 = 100;
const TEXT_SCALE_MAX: u32 = 225;

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UiScale {
    /// 1.0 = 100%; values outside 100–225 are clamped.
    pub text_scale: f64,
}

pub fn text_scale_from_percent(percent: Option<u32>) -> f64 {
    let percent = percent
        .unwrap_or(TEXT_SCALE_MIN)
        .clamp(TEXT_SCALE_MIN, TEXT_SCALE_MAX);
    f64::from(percent) / 100.0
}

#[cfg(windows)]
fn read_percent() -> Option<u32> {
    use winreg::RegKey;
    use winreg::enums::HKEY_CURRENT_USER;

    let key = RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey(r"Software\Microsoft\Accessibility")
        .ok()?;
    // The documented value is REG_DWORD; some builds expose a string.
    if let Ok(value) = key.get_value::<u32, _>("TextScaleFactor") {
        return Some(value);
    }
    key.get_value::<String, _>("TextScaleFactor")
        .ok()
        .and_then(|value| value.trim().parse().ok())
}

#[cfg(not(windows))]
fn read_percent() -> Option<u32> {
    None
}

#[tauri::command]
pub fn ui_scale_get() -> UiScale {
    UiScale {
        text_scale: text_scale_from_percent(read_percent()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_text_scale_defaults_to_100_percent() {
        assert_eq!(text_scale_from_percent(None), 1.0);
    }

    #[test]
    fn text_scale_is_clamped_to_the_windows_range() {
        assert_eq!(text_scale_from_percent(Some(50)), 1.0);
        assert_eq!(text_scale_from_percent(Some(125)), 1.25);
        assert_eq!(text_scale_from_percent(Some(225)), 2.25);
        assert_eq!(text_scale_from_percent(Some(400)), 2.25);
    }

    #[test]
    fn serde_exposes_camel_case() {
        let value = serde_json::to_value(UiScale { text_scale: 1.25 }).expect("serialize");
        assert_eq!(value["textScale"], 1.25);
    }
}
