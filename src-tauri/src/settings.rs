//! Persisted application settings.
//!
//! The Rust side is the only writer; the frontend keeps a cache for the
//! pre-React theme/language bootstrap and treats command results as
//! authoritative (see HANDOFF §3.4, §3.7).

use std::sync::Mutex;

use calc_core::{AngleUnit, ErrorCode, ErrorInfo, Radix, WordSize};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};
use tauri_plugin_log::log::{error, warn};
use tauri_plugin_store::StoreExt;

const SETTINGS_FILE: &str = "settings.json";
const SETTINGS_KEY: &str = "settings";
const HISTORY_LIMIT_MIN: u32 = 100;
const HISTORY_LIMIT_MAX: u32 = 1_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum ThemeSetting {
    Light,
    Dark,
    #[default]
    System,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum AppLanguage {
    #[default]
    #[serde(rename = "zh-CN")]
    ZhCn,
    #[serde(rename = "en-US")]
    EnUs,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AppSettings {
    pub theme: ThemeSetting,
    pub language: AppLanguage,
    pub grouping: bool,
    pub angle_unit: AngleUnit,
    pub word_size: WordSize,
    pub radix: Radix,
    pub history_enabled: bool,
    pub history_limit: u32,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: ThemeSetting::System,
            language: AppLanguage::ZhCn,
            grouping: true,
            angle_unit: AngleUnit::Deg,
            word_size: WordSize::Qword,
            radix: Radix::Decimal,
            history_enabled: true,
            history_limit: 500,
        }
    }
}

impl AppSettings {
    /// Clamp stored values so a hand-edited or outdated file cannot push the
    /// UI outside its documented ranges.
    pub fn sanitized(mut self) -> Self {
        self.history_limit = self
            .history_limit
            .clamp(HISTORY_LIMIT_MIN, HISTORY_LIMIT_MAX);
        self
    }
}

pub struct SettingsState(Mutex<AppSettings>);

impl SettingsState {
    pub fn new(settings: AppSettings) -> Self {
        Self(Mutex::new(settings))
    }

    fn get(&self) -> AppSettings {
        self.0
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .clone()
    }

    fn set(&self, settings: AppSettings) {
        *self
            .0
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner()) = settings;
    }
}

pub fn load(app: &AppHandle) -> AppSettings {
    let store = match app.store(SETTINGS_FILE) {
        Ok(store) => store,
        Err(error) => {
            warn!("settings store unavailable, using defaults: {error}");
            return AppSettings::default();
        }
    };

    match store.get(SETTINGS_KEY) {
        Some(value) => serde_json::from_value::<AppSettings>(value)
            .map(AppSettings::sanitized)
            .unwrap_or_else(|error| {
                warn!("settings payload invalid, using defaults: {error}");
                AppSettings::default()
            }),
        None => AppSettings::default(),
    }
}

fn persist(app: &AppHandle, settings: &AppSettings) -> Result<(), ErrorInfo> {
    let store = app
        .store(SETTINGS_FILE)
        .map_err(|error| storage_error("open", error))?;
    let value =
        serde_json::to_value(settings).map_err(|error| storage_error("serialize", error))?;
    store.set(SETTINGS_KEY, value);
    store.save().map_err(|error| storage_error("save", error))?;
    Ok(())
}

fn storage_error(stage: &str, error: impl std::fmt::Display) -> ErrorInfo {
    error!("settings {stage} failed: {error}");
    ErrorInfo::new(ErrorCode::StorageError)
}

#[tauri::command]
pub fn settings_get(state: State<'_, SettingsState>) -> AppSettings {
    state.get()
}

#[tauri::command]
pub fn settings_set(
    app: AppHandle,
    state: State<'_, SettingsState>,
    settings: AppSettings,
) -> Result<AppSettings, ErrorInfo> {
    let settings = settings.sanitized();
    persist(&app, &settings)?;
    state.set(settings.clone());
    Ok(settings)
}

#[tauri::command]
pub fn settings_reset(
    app: AppHandle,
    state: State<'_, SettingsState>,
) -> Result<AppSettings, ErrorInfo> {
    let settings = AppSettings::default();
    persist(&app, &settings)?;
    state.set(settings.clone());
    Ok(settings)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_match_the_documented_baseline() {
        let settings = AppSettings::default();
        assert_eq!(settings.theme, ThemeSetting::System);
        assert_eq!(settings.language, AppLanguage::ZhCn);
        assert!(settings.grouping);
        assert_eq!(settings.angle_unit, AngleUnit::Deg);
        assert_eq!(settings.word_size, WordSize::Qword);
        assert_eq!(settings.radix, Radix::Decimal);
        assert!(settings.history_enabled);
        assert_eq!(settings.history_limit, 500);
    }

    #[test]
    fn serde_uses_camel_case_and_contract_enum_spellings() {
        let value = serde_json::to_value(AppSettings::default()).expect("serialize");
        assert_eq!(value["theme"], "system");
        assert_eq!(value["language"], "zh-CN");
        assert_eq!(value["angleUnit"], "deg");
        assert_eq!(value["wordSize"], "qword");
        assert_eq!(value["radix"], "decimal");
        assert_eq!(value["historyEnabled"], true);
        assert_eq!(value["historyLimit"], 500);
    }

    #[test]
    fn missing_fields_fall_back_to_defaults() {
        let value = serde_json::json!({ "theme": "dark", "historyLimit": 900 });
        let settings: AppSettings = serde_json::from_value(value).expect("deserialize");
        assert_eq!(settings.theme, ThemeSetting::Dark);
        assert_eq!(settings.history_limit, 900);
        assert_eq!(settings.language, AppLanguage::ZhCn);
        assert_eq!(settings.radix, Radix::Decimal);
    }

    #[test]
    fn history_limit_is_clamped() {
        let low = AppSettings {
            history_limit: 1,
            ..AppSettings::default()
        }
        .sanitized();
        let high = AppSettings {
            history_limit: 99_999,
            ..AppSettings::default()
        }
        .sanitized();
        assert_eq!(low.history_limit, HISTORY_LIMIT_MIN);
        assert_eq!(high.history_limit, HISTORY_LIMIT_MAX);
    }

    #[test]
    fn unknown_enum_values_are_rejected_at_the_boundary() {
        let value = serde_json::json!({ "language": "fr-FR" });
        assert!(serde_json::from_value::<AppSettings>(value).is_err());
    }
}
