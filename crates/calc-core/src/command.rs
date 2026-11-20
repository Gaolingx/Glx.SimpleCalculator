use serde::{Deserialize, Serialize};

use crate::error::ErrorInfo;
use crate::mode::{AngleUnit, Radix, WordSize};

/// Commands accepted by a calculator session.
///
/// The frontend only emits semantic commands; it never evaluates arithmetic.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum CalcCommand {
    Digit {
        digit: u8,
    },
    Dot,
    Backspace,
    ClearAll,
    ClearEntry,
    Unary {
        op: UnaryOp,
    },
    Binary {
        op: BinaryOp,
    },
    Equals,
    Percent,
    ToggleSign,
    Memory {
        op: MemoryOp,
        /// Opaque slot id from `CalcView.memories`; omitted means the newest
        /// slot for recall/add/subtract, or every slot for clear.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        id: Option<String>,
    },
    SetAngleUnit {
        unit: AngleUnit,
    },
    SetRadix {
        radix: Radix,
    },
    SetWordSize {
        size: WordSize,
    },
    OpenGroup,
    CloseGroup,
    Constant {
        id: ConstantId,
    },
    ToggleBit {
        bit: u8,
    },
    /// Scientific `rand`: a pseudo-random value in `[0, 1)`.
    Random,
    /// Append a value to the statistics data set.
    StatsAdd {
        value: String,
    },
    /// Replace one statistics value; `index` is zero-based.
    StatsUpdate {
        index: usize,
        value: String,
    },
    /// Remove one statistics value; `index` is zero-based.
    StatsRemove {
        index: usize,
    },
    /// Clear the whole statistics data set.
    StatsClear,
    /// Compute one statistics function over the current data set.
    StatsCompute {
        op: StatOp,
    },
    /// Replace the current entry, used by paste.
    SetExpression {
        text: String,
    },
    /// Restore a completed expression and its result from history.
    ///
    /// Unlike `SetExpression` this does not re-evaluate: the value is parsed
    /// and displayed as-is, and typing replaces it.
    Recall {
        expression: String,
        value: String,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum UnaryOp {
    Sqrt,
    Square,
    Cube,
    CubeRoot,
    Reciprocal,
    Factorial,
    Sin,
    Cos,
    Tan,
    Asin,
    Acos,
    Atan,
    Sinh,
    Cosh,
    Tanh,
    Asinh,
    Acosh,
    Atanh,
    Ln,
    Log10,
    Log2,
    Exp,
    Abs,
    Floor,
    Ceil,
    Round,
    /// Bitwise complement; programmer mode only.
    Not,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum BinaryOp {
    Add,
    Subtract,
    Multiply,
    Divide,
    Power,
    Modulo,
    And,
    Or,
    Xor,
    LeftShift,
    RightShift,
    RotateLeft,
    RotateRight,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MemoryOp {
    Clear,
    Recall,
    Add,
    Subtract,
    Store,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ConstantId {
    Pi,
    E,
}

/// Statistics functions in the order exposed by the UI (HANDOFF §2.1).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum StatOp {
    Sum,
    SumSquares,
    Mean,
    Median,
    Mode,
    Range,
    SampleStdDev,
    PopulationStdDev,
    Count,
    Min,
    Max,
    Variance,
}

impl StatOp {
    /// ASCII name used in display-only expression lines.
    pub const fn name(self) -> &'static str {
        match self {
            Self::Sum => "sum",
            Self::SumSquares => "sumsq",
            Self::Mean => "mean",
            Self::Median => "median",
            Self::Mode => "mode",
            Self::Range => "range",
            Self::SampleStdDev => "stdev_s",
            Self::PopulationStdDev => "stdev_p",
            Self::Count => "count",
            Self::Min => "min",
            Self::Max => "max",
            Self::Variance => "variance",
        }
    }
}

impl CalcCommand {
    /// Commands are validated at the Tauri adapter boundary before reaching
    /// the engine; invalid values must never panic.
    pub fn validate(&self) -> Result<(), ErrorInfo> {
        match self {
            // 10–15 are the hexadecimal keys A–F; the engine rejects digits
            // that are out of range for the active radix.
            Self::Digit { digit } if *digit > 15 => {
                Err(ErrorInfo::new(crate::error::ErrorCode::InvalidInput))
            }
            Self::ToggleBit { bit } if *bit > 63 => {
                Err(ErrorInfo::new(crate::error::ErrorCode::InvalidInput))
            }
            Self::SetExpression { text } if text.chars().count() > 1000 => {
                Err(ErrorInfo::new(crate::error::ErrorCode::InvalidInput))
            }
            Self::StatsAdd { value } | Self::StatsUpdate { value, .. }
                if value.chars().count() > 1000 =>
            {
                Err(ErrorInfo::new(crate::error::ErrorCode::InvalidInput))
            }
            Self::Memory { id: Some(id), .. } if id.parse::<u64>().is_err() => {
                Err(ErrorInfo::new(crate::error::ErrorCode::InvalidInput))
            }
            Self::Recall { expression, value }
                if expression.is_empty()
                    || value.is_empty()
                    || expression.chars().count() > 1000
                    || value.chars().count() > 1000 =>
            {
                Err(ErrorInfo::new(crate::error::ErrorCode::InvalidInput))
            }
            _ => Ok(()),
        }
    }
}
