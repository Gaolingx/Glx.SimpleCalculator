use serde::{Deserialize, Serialize};

/// Stable, language-neutral error codes crossing the IPC boundary.
///
/// The frontend maps these to localized messages; Rust never sends user
/// facing text.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, thiserror::Error)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorCode {
    #[error("cannot divide by zero")]
    DivideByZero,
    #[error("numeric overflow")]
    Overflow,
    #[error("invalid input")]
    InvalidInput,
    #[error("value outside the function domain")]
    DomainError,
    #[error("malformed expression")]
    Syntax,
    #[error("operation not supported")]
    Unsupported,
    #[error("currency rates unavailable")]
    CurrencyOffline,
    #[error("unknown unit")]
    UnknownUnit,
    #[error("storage failure")]
    StorageError,
    #[error("network failure")]
    NetworkError,
    #[error("internal error")]
    Internal,
}

/// Serializable error payload. `args` carries optional context such as the
/// offending unit id, never pre-localized text.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorInfo {
    pub code: ErrorCode,
    pub args: Vec<String>,
}

impl ErrorInfo {
    pub fn new(code: ErrorCode) -> Self {
        Self {
            code,
            args: Vec::new(),
        }
    }

    pub fn with_args(code: ErrorCode, args: Vec<String>) -> Self {
        Self { code, args }
    }
}

impl From<ErrorCode> for ErrorInfo {
    fn from(code: ErrorCode) -> Self {
        Self::new(code)
    }
}

pub type CalcResult<T> = Result<T, ErrorInfo>;
