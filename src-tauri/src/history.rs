//! Persisted calculation history.
//!
//! The frontend appends an entry after a completed calculation and may delete
//! or clear entries; this module owns ordering, de-duplication, retention and
//! the `history.json` store (HANDOFF §3.4, §3.7).
//!
//! Retention policy: entries are newest-first, consecutive duplicates of the
//! newest entry are collapsed (repeated `=` does not spam the list), and the
//! list is truncated to `AppSettings::history_limit`.

use std::sync::{Mutex, MutexGuard};
use std::time::{SystemTime, UNIX_EPOCH};

use calc_core::{ErrorCode, ErrorInfo, Mode};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};
use tauri_plugin_log::log::{error, warn};
use tauri_plugin_store::StoreExt;

use crate::settings::SettingsState;

const HISTORY_FILE: &str = "history.json";
const HISTORY_KEY: &str = "entries";
const MAX_TEXT_CHARS: usize = 1_000;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub id: String,
    pub mode: Mode,
    pub expression: String,
    pub value: String,
    /// Unix epoch milliseconds.
    pub ts: i64,
}

#[derive(Debug, Default)]
struct HistoryLog {
    entries: Vec<HistoryEntry>,
}

impl HistoryLog {
    fn restored(entries: Vec<HistoryEntry>, limit: usize) -> Self {
        let mut log = Self {
            entries: entries
                .into_iter()
                .filter(|entry| !entry.id.is_empty() && !entry.value.is_empty())
                .collect(),
        };
        // Stable sort keeps the stored order for equal timestamps.
        log.entries.sort_by_key(|entry| std::cmp::Reverse(entry.ts));
        log.truncate(limit);
        log
    }

    fn snapshot(&self) -> Vec<HistoryEntry> {
        self.entries.clone()
    }

    fn record(&mut self, entry: HistoryEntry, limit: usize) {
        if let Some(newest) = self.entries.first_mut() {
            if newest.mode == entry.mode
                && newest.expression == entry.expression
                && newest.value == entry.value
            {
                newest.id = entry.id;
                newest.ts = entry.ts;
                return;
            }
        }
        self.entries.insert(0, entry);
        self.truncate(limit);
    }

    fn remove(&mut self, id: &str) -> bool {
        let before = self.entries.len();
        self.entries.retain(|entry| entry.id != id);
        self.entries.len() != before
    }

    fn clear_mode(&mut self, mode: Mode) {
        self.entries.retain(|entry| entry.mode != mode);
    }

    fn truncate(&mut self, limit: usize) {
        self.entries.truncate(limit.max(1));
    }
}

pub struct HistoryState(Mutex<HistoryLog>);

impl HistoryState {
    pub fn load(app: &AppHandle, limit: usize) -> Self {
        Self(Mutex::new(HistoryLog::restored(read_entries(app), limit)))
    }

    pub fn snapshot(&self) -> Vec<HistoryEntry> {
        self.lock().snapshot()
    }

    /// Applies a new retention limit. Persistence failures are logged but do
    /// not fail the settings update that triggered the trim.
    pub fn trim(&self, app: &AppHandle, limit: usize) {
        let mut log = self.lock();
        if log.entries.len() <= limit {
            return;
        }
        log.truncate(limit);
        if let Err(failure) = write_entries(app, &log.entries) {
            warn!("history trim could not be persisted: {failure:?}");
        }
    }

    fn record(
        &self,
        app: &AppHandle,
        mode: Mode,
        expression: String,
        value: String,
        limit: usize,
    ) -> Result<Vec<HistoryEntry>, ErrorInfo> {
        let entry = HistoryEntry {
            id: next_id(),
            mode,
            expression,
            value,
            ts: now_ms(),
        };
        let mut log = self.lock();
        log.record(entry, limit);
        let snapshot = log.snapshot();
        write_entries(app, &snapshot)?;
        Ok(snapshot)
    }

    fn lock(&self) -> MutexGuard<'_, HistoryLog> {
        self.0
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

#[tauri::command]
pub fn history_list(state: State<'_, HistoryState>) -> Vec<HistoryEntry> {
    state.snapshot()
}

#[tauri::command]
pub fn history_add(
    app: AppHandle,
    state: State<'_, HistoryState>,
    settings: State<'_, SettingsState>,
    mode: Mode,
    expression: String,
    value: String,
) -> Result<Vec<HistoryEntry>, ErrorInfo> {
    let settings = settings.get();
    if !settings.history_enabled {
        return Ok(state.snapshot());
    }
    if !valid_text(&expression) || !valid_text(&value) {
        return Err(ErrorInfo::new(ErrorCode::InvalidInput));
    }
    state.record(
        &app,
        mode,
        expression,
        value,
        settings.history_limit as usize,
    )
}

#[tauri::command]
pub fn history_delete(
    app: AppHandle,
    state: State<'_, HistoryState>,
    id: String,
) -> Result<Vec<HistoryEntry>, ErrorInfo> {
    let mut log = state.lock();
    if !log.remove(&id) {
        return Ok(log.snapshot());
    }
    let snapshot = log.snapshot();
    write_entries(&app, &snapshot)?;
    Ok(snapshot)
}

#[tauri::command]
pub fn history_clear(
    app: AppHandle,
    state: State<'_, HistoryState>,
    mode: Mode,
) -> Result<Vec<HistoryEntry>, ErrorInfo> {
    let mut log = state.lock();
    log.clear_mode(mode);
    let snapshot = log.snapshot();
    write_entries(&app, &snapshot)?;
    Ok(snapshot)
}

fn valid_text(text: &str) -> bool {
    !text.is_empty() && text.chars().count() <= MAX_TEXT_CHARS
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis() as i64)
        .unwrap_or_default()
}

fn next_id() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_nanos().to_string())
        .unwrap_or_else(|_| "0".into())
}

fn read_entries(app: &AppHandle) -> Vec<HistoryEntry> {
    let store = match app.store(HISTORY_FILE) {
        Ok(store) => store,
        Err(failure) => {
            warn!("history store unavailable, starting empty: {failure}");
            return Vec::new();
        }
    };

    match store.get(HISTORY_KEY) {
        Some(value) => {
            serde_json::from_value::<Vec<HistoryEntry>>(value).unwrap_or_else(|failure| {
                warn!("history payload invalid, starting empty: {failure}");
                Vec::new()
            })
        }
        None => Vec::new(),
    }
}

fn write_entries(app: &AppHandle, entries: &[HistoryEntry]) -> Result<(), ErrorInfo> {
    let store = app
        .store(HISTORY_FILE)
        .map_err(|failure| history_error("open", failure))?;
    let value =
        serde_json::to_value(entries).map_err(|failure| history_error("serialize", failure))?;
    store.set(HISTORY_KEY, value);
    store
        .save()
        .map_err(|failure| history_error("save", failure))
}

fn history_error(stage: &str, failure: impl std::fmt::Display) -> ErrorInfo {
    error!("history {stage} failed: {failure}");
    ErrorInfo::new(ErrorCode::StorageError)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(id: &str, expression: &str, value: &str, ts: i64) -> HistoryEntry {
        HistoryEntry {
            id: id.into(),
            mode: Mode::Basic,
            expression: expression.into(),
            value: value.into(),
            ts,
        }
    }

    fn log(entries: Vec<HistoryEntry>, limit: usize) -> HistoryLog {
        HistoryLog::restored(entries, limit)
    }

    #[test]
    fn new_entries_go_to_the_front() {
        let mut log = log(vec![entry("a", "1 + 1 =", "2", 10)], 500);
        log.record(entry("b", "2 + 2 =", "4", 20), 500);
        assert_eq!(
            log.snapshot()
                .iter()
                .map(|item| item.id.as_str())
                .collect::<Vec<_>>(),
            ["b", "a"]
        );
    }

    #[test]
    fn consecutive_duplicates_are_collapsed() {
        let mut log = HistoryLog::default();
        log.record(entry("a", "2 + 3 =", "5", 10), 500);
        log.record(entry("b", "2 + 3 =", "5", 20), 500);
        let entries = log.snapshot();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].id, "b");
        assert_eq!(entries[0].ts, 20);
    }

    #[test]
    fn non_consecutive_duplicates_are_kept() {
        let mut log = HistoryLog::default();
        log.record(entry("a", "2 + 3 =", "5", 10), 500);
        log.record(entry("b", "7 * 2 =", "14", 20), 500);
        log.record(entry("c", "2 + 3 =", "5", 30), 500);
        assert_eq!(log.snapshot().len(), 3);
    }

    #[test]
    fn limit_evicts_the_oldest_entries() {
        let mut log = HistoryLog::default();
        for index in 0..5 {
            let expression = format!("{index} + 0 =");
            log.record(
                entry(&format!("e{index}"), &expression, "2", index as i64),
                3,
            );
        }
        assert_eq!(
            log.snapshot()
                .iter()
                .map(|item| item.id.as_str())
                .collect::<Vec<_>>(),
            ["e4", "e3", "e2"]
        );
    }

    #[test]
    fn restored_entries_are_sorted_and_truncated() {
        let log = log(
            vec![
                entry("old", "1 =", "1", 1),
                entry("new", "2 =", "2", 3),
                entry("mid", "3 =", "3", 2),
                entry("blank", "4 =", "", 4),
            ],
            2,
        );
        assert_eq!(
            log.snapshot()
                .iter()
                .map(|item| item.id.as_str())
                .collect::<Vec<_>>(),
            ["new", "mid"]
        );
    }

    #[test]
    fn remove_and_clear_update_the_log() {
        let mut entries = vec![entry("a", "1 =", "1", 1), entry("b", "2 =", "2", 2)];
        entries.push(HistoryEntry {
            mode: Mode::Scientific,
            ..entry("c", "sin(0) =", "0", 3)
        });
        let mut log = log(entries, 500);
        assert!(log.remove("a"));
        assert!(!log.remove("missing"));
        log.clear_mode(Mode::Basic);
        let remaining = log.snapshot();
        assert_eq!(remaining.len(), 1);
        assert_eq!(remaining[0].id, "c");
    }

    #[test]
    fn payload_uses_camel_case_and_contract_mode_names() {
        let value = serde_json::to_value(entry("id", "2 + 3 =", "5", 42)).expect("serialize");
        assert_eq!(value["mode"], "basic");
        assert_eq!(value["expression"], "2 + 3 =");
        assert_eq!(value["value"], "5");
        assert_eq!(value["ts"], 42);
        let decoded: HistoryEntry = serde_json::from_value(value).expect("deserialize");
        assert_eq!(decoded.mode, Mode::Basic);
    }

    #[test]
    fn stored_payloads_round_trip() {
        let entries = vec![entry("a", "1 =", "1", 1), entry("b", "2 =", "2", 2)];
        let encoded = serde_json::to_value(&entries).expect("serialize");
        let decoded: Vec<HistoryEntry> = serde_json::from_value(encoded).expect("deserialize");
        assert_eq!(decoded, entries);
    }
}
