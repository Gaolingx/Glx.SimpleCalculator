use serde::{Deserialize, Serialize};

use crate::error::ErrorInfo;
use crate::mode::{Mode, Radix, WordSize};
use crate::units::UnitCategory;
use crate::worksheet::{FieldKind, ResultKind, WorksheetId};

/// Canonical state returned to the UI after every command.
///
/// All numeric strings are unformatted. Digit grouping, locale separators and
/// significant-digit display are owned by the frontend (`lib/format.ts`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalcView {
    pub mode: Mode,
    /// Expression line, ASCII operators only.
    pub expression: String,
    /// Canonical raw value; empty when the session has no value yet.
    pub value: String,
    /// Newest-first memory slots; empty when the session has no memory.
    pub memories: Vec<MemoryView>,
    /// Present only in programmer mode.
    pub programmer: Option<ProgrammerView>,
    /// Present only in statistics mode.
    pub statistics: Option<StatisticsView>,
    pub error: Option<ErrorInfo>,
}

impl CalcView {
    pub fn empty(mode: Mode) -> Self {
        Self {
            mode,
            expression: String::new(),
            value: String::new(),
            memories: Vec::new(),
            programmer: None,
            statistics: None,
            error: None,
        }
    }
}

/// One memory slot. `id` is opaque and stable only for the session lifetime.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryView {
    pub id: String,
    pub value: String,
}

/// Programmer-mode projections of the current value.
///
/// Strings contain no separators; the UI groups them (4/4/3/3 digits) according
/// to the active radix. `bits` is MSB-first with length `word_size.bits()`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgrammerView {
    pub radix: Radix,
    pub word_size: WordSize,
    pub binary: String,
    pub octal: String,
    pub decimal: String,
    pub hexadecimal: String,
    pub bits: String,
}

/// Statistics-mode data set.
///
/// `data` holds canonical, ungrouped values in entry order. Sorting for display
/// is a frontend concern; edits address values by their original index.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StatisticsView {
    pub data: Vec<String>,
}

/// Unit registry projection for the converter page.
///
/// Categories and units arrive in navigation order; `symbol` is
/// locale-neutral and unit *names* are translated by the frontend.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnitCatalog {
    pub categories: Vec<UnitCategoryInfo>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnitCategoryInfo {
    pub id: UnitCategory,
    pub units: Vec<UnitInfo>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnitInfo {
    pub id: String,
    pub symbol: String,
}

/// Result of a pure unit conversion; the value is canonical and ungrouped.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnitConversion {
    pub value: String,
}

/// Calendar difference: non-negative Y/M/D components plus signed totals.
///
/// `total_days` is `to - from`; `total_weeks` is the truncated whole-week
/// count of `total_days`. The UI localizes and formats both.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DateDifference {
    pub years: u32,
    pub months: u32,
    pub days: u32,
    pub total_days: i64,
    pub total_weeks: i64,
}

/// Result of a date shift; `date` is a canonical ISO `YYYY-MM-DD` string.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DateShift {
    pub date: String,
}

/// Registry projection for the worksheets page.
///
/// Field/result ids double as i18n keys; bounds and defaults are canonical
/// strings so the UI can render and pre-validate the form without duplicating
/// the registry.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorksheetCatalog {
    pub worksheets: Vec<WorksheetInfo>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorksheetInfo {
    pub id: WorksheetId,
    pub fields: Vec<WorksheetFieldInfo>,
    pub results: Vec<WorksheetResultInfo>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorksheetFieldInfo {
    pub id: String,
    pub kind: FieldKind,
    /// Inclusive lower/upper bounds, canonical decimals.
    pub min: String,
    pub max: String,
    pub default_value: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorksheetResultInfo {
    pub id: String,
    pub kind: ResultKind,
}

/// Computed values in registry order; `value` is canonical and ungrouped.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorksheetResult {
    pub values: Vec<WorksheetValue>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorksheetValue {
    pub id: String,
    pub value: String,
}
