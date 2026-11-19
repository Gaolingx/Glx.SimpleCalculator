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

impl CalcCommand {
    /// Commands are validated at the Tauri adapter boundary before reaching
    /// the engine; invalid values must never panic.
    pub fn validate(&self) -> Result<(), ErrorInfo> {
        match self {
            Self::Digit { digit } if *digit > 9 => {
                Err(ErrorInfo::new(crate::error::ErrorCode::InvalidInput))
            }
            Self::ToggleBit { bit } if *bit > 63 => {
                Err(ErrorInfo::new(crate::error::ErrorCode::InvalidInput))
            }
            Self::SetExpression { text } if text.chars().count() > 1000 => {
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
