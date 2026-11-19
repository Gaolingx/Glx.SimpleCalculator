use serde::{Deserialize, Serialize};

use crate::error::ErrorInfo;
use crate::mode::{Mode, Radix, WordSize};
use crate::units::UnitCategory;

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
    pub memory: Option<String>,
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
            memory: None,
            programmer: None,
            statistics: None,
            error: None,
        }
    }
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
