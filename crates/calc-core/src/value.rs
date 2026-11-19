//! Decimal parsing, normalization and canonical output.
//!
//! The core only exchanges canonical strings. Grouping separators, locale
//! digits and significant-digit display belong to the frontend.

use std::str::FromStr;

use rust_decimal::Decimal;
use rust_decimal::prelude::ToPrimitive;

use crate::error::{CalcResult, ErrorCode, ErrorInfo};

/// Upper bound for a single pasted expression (HANDOFF §3.9).
pub const MAX_INPUT_CHARS: usize = 1000;

/// A session value.
///
/// Basic arithmetic stays on `Decimal` so `0.1 + 0.2` remains exact. Scientific
/// functions (trigonometry, logarithms, non-integer powers) follow the f64 path
/// documented in HANDOFF §3.5, which also lets factorial reach `170!` beyond the
/// 96-bit Decimal range. Mixing both promotes to f64.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Number {
    Decimal(Decimal),
    Float(f64),
}

impl From<Decimal> for Number {
    fn from(value: Decimal) -> Self {
        Self::Decimal(value)
    }
}

impl Number {
    pub fn to_f64(self) -> f64 {
        match self {
            Self::Decimal(value) => value.to_f64().unwrap_or(0.0),
            Self::Float(value) => value,
        }
    }

    pub fn is_zero(self) -> bool {
        match self {
            Self::Decimal(value) => value.is_zero(),
            Self::Float(value) => value == 0.0,
        }
    }

    /// Canonical raw string; display grouping stays in the frontend.
    pub fn canonical(self) -> String {
        match self {
            Self::Decimal(value) => canonical(value),
            Self::Float(value) => canonical_float(value),
        }
    }
}

impl std::ops::Neg for Number {
    type Output = Self;

    fn neg(self) -> Self {
        match self {
            Self::Decimal(value) => Self::Decimal(-value),
            Self::Float(value) => Self::Float(-value),
        }
    }
}

/// Magnitude beyond which the session reports `Overflow` instead of relying on
/// Decimal saturation. Display-level limits are a frontend concern.
fn max_abs() -> Decimal {
    Decimal::from_scientific("1e27").unwrap_or(Decimal::MAX)
}

/// Values with a smaller non-zero magnitude are treated as extreme for display
/// hints only; arithmetic keeps full Decimal precision.
fn min_abs() -> Decimal {
    Decimal::from_scientific("1e-26").unwrap_or(Decimal::ZERO)
}

/// Parse user text into a Decimal.
///
/// Accepts grouping separators (`1,234.5`, `1 234.5`), Unicode minus and
/// typographic operators normalized by [`normalize_input`].
pub fn parse(raw: &str) -> CalcResult<Decimal> {
    let cleaned = normalize_input(raw)?;
    if cleaned.is_empty() {
        return Err(ErrorInfo::new(ErrorCode::InvalidInput));
    }
    Decimal::from_str(&cleaned)
        .or_else(|_| Decimal::from_scientific(&cleaned))
        .map_err(|_| ErrorInfo::new(ErrorCode::InvalidInput))
}

/// Parse user text into a [`Number`], preferring exact Decimal values and
/// falling back to f64 for magnitudes Decimal cannot represent (`170!`).
pub fn parse_number(raw: &str) -> CalcResult<Number> {
    let cleaned = normalize_input(raw)?;
    if cleaned.is_empty() {
        return Err(ErrorInfo::new(ErrorCode::InvalidInput));
    }
    if let Ok(value) = Decimal::from_str(&cleaned).or_else(|_| Decimal::from_scientific(&cleaned)) {
        return Ok(Number::Decimal(value));
    }
    match cleaned.parse::<f64>() {
        Ok(value) if value.is_finite() => Ok(Number::Float(value)),
        Ok(_) => Err(ErrorInfo::new(ErrorCode::Overflow)),
        Err(_) => Err(ErrorInfo::new(ErrorCode::InvalidInput)),
    }
}

/// Strip grouping/whitespace and map typographic characters to ASCII.
pub fn normalize_input(raw: &str) -> CalcResult<String> {
    if raw.chars().count() > MAX_INPUT_CHARS {
        return Err(ErrorInfo::new(ErrorCode::InvalidInput));
    }

    let mut out = String::with_capacity(raw.len());
    for ch in raw.chars() {
        match ch {
            '−' | '–' | '—' => out.push('-'),
            '×' | '·' => out.push('*'),
            '÷' => out.push('/'),
            '，' | ',' | '_' | ' ' | '\u{00a0}' | '\u{202f}' | '\u{2009}' => {}
            '０'..='９' => {
                out.push(char::from_u32(ch as u32 - '０' as u32 + '0' as u32).unwrap())
            }
            '．' => out.push('.'),
            '＋' => out.push('+'),
            '－' => out.push('-'),
            '（' => out.push('('),
            '）' => out.push(')'),
            c if c.is_ascii() => out.push(c),
            _ => return Err(ErrorInfo::new(ErrorCode::InvalidInput)),
        }
    }
    Ok(out)
}

/// Canonical rendering: plain decimal digits, no grouping, no trailing zeros
/// in the fractional part (`2.50` -> `2.5`, `3.000` -> `3`).
pub fn canonical(value: Decimal) -> String {
    value.normalize().to_string()
}

/// Canonical f64 rendering: 15 significant digits (HANDOFF §3.5), plain
/// notation inside `[1e-15, 1e16)` and E notation outside it so the frontend
/// can format the mantissa without re-deriving the exponent.
pub fn canonical_float(value: f64) -> String {
    if !value.is_finite() || value == 0.0 {
        return "0".to_owned();
    }

    let rounded: f64 = format!("{value:.14e}").parse().unwrap_or(value);
    let magnitude = rounded.abs();
    if magnitude >= 1e16 || magnitude < 1e-15 {
        let text = format!("{rounded:.14e}");
        let (mantissa, exponent) = text.split_once('e').unwrap_or((&text, "0"));
        format!("{}e{exponent}", trim_zeros(mantissa))
    } else {
        let exponent = magnitude.log10().floor() as i32;
        let decimals = (14 - exponent).max(0) as usize;
        trim_zeros(&format!("{rounded:.decimals$}"))
    }
}

fn trim_zeros(text: &str) -> String {
    if !text.contains('.') {
        return text.to_owned();
    }
    text.trim_end_matches('0').trim_end_matches('.').to_owned()
}

pub fn is_zero(value: Decimal) -> bool {
    value.is_zero()
}

/// True when the value exceeds the display-safe magnitude window.
pub fn is_extreme(value: Decimal) -> bool {
    let magnitude = value.abs();
    magnitude >= max_abs() || (!value.is_zero() && magnitude < min_abs())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    fn dec(raw: &str) -> Decimal {
        Decimal::from_str(raw).unwrap()
    }

    #[test]
    fn parses_plain_numbers() {
        assert_eq!(parse("42").unwrap(), dec("42"));
        assert_eq!(parse("-0.5").unwrap(), dec("-0.5"));
        assert_eq!(parse("+.25").unwrap(), dec("0.25"));
    }

    #[test]
    fn parses_grouped_numbers() {
        assert_eq!(parse("1,234.5").unwrap(), dec("1234.5"));
        assert_eq!(parse("1 234 567").unwrap(), dec("1234567"));
        assert_eq!(parse("1_000").unwrap(), dec("1000"));
    }

    #[test]
    fn parses_scientific_notation() {
        assert_eq!(parse("1.5e3").unwrap(), dec("1500"));
        assert_eq!(parse("2.5E-2").unwrap(), dec("0.025"));
    }

    #[test]
    fn rejects_malformed_input() {
        assert_eq!(parse("1.2.3").unwrap_err().code, ErrorCode::InvalidInput);
        assert_eq!(parse("").unwrap_err().code, ErrorCode::InvalidInput);
        assert_eq!(parse("abc").unwrap_err().code, ErrorCode::InvalidInput);
    }

    #[test]
    fn rejects_over_long_input() {
        let raw = "1".repeat(MAX_INPUT_CHARS + 1);
        assert_eq!(parse(&raw).unwrap_err().code, ErrorCode::InvalidInput);
    }

    #[test]
    fn normalizes_typographic_characters() {
        assert_eq!(normalize_input("1×2÷3−4").unwrap(), "1*2/3-4");
        assert_eq!(normalize_input("１２３．５").unwrap(), "123.5");
        assert_eq!(normalize_input("1\u{00a0}000").unwrap(), "1000");
    }

    #[test]
    fn canonical_strips_trailing_zeros() {
        assert_eq!(canonical(dec("2.50")), "2.5");
        assert_eq!(canonical(dec("3.000")), "3");
        assert_eq!(canonical(dec("-0.0")), "0");
    }

    #[test]
    fn extreme_detection_uses_magnitude_window() {
        assert!(!is_extreme(dec("999999999999")));
        assert!(is_extreme(dec("1e28")));
        assert!(!is_extreme(Decimal::ZERO));
        assert!(!is_extreme(dec("0.0001")));
        assert!(is_extreme(dec("1e-27")));
    }

    #[test]
    fn parse_number_prefers_decimal_and_falls_back_to_float() {
        assert_eq!(parse_number("0.1").unwrap(), Number::Decimal(dec("0.1")));
        let big = parse_number("7.257415615307999e306").unwrap();
        assert!(matches!(big, Number::Float(_)));
        assert_eq!(parse_number("1e400").unwrap_err().code, ErrorCode::Overflow);
        assert_eq!(
            parse_number("not-a-number").unwrap_err().code,
            ErrorCode::InvalidInput
        );
    }

    #[test]
    fn canonical_float_rounds_to_fifteen_significant_digits() {
        assert_eq!(canonical_float(0.49999999999999994), "0.5");
        assert_eq!(canonical_float(0.30000000000000004), "0.3");
        assert_eq!(canonical_float(120.0), "120");
        assert_eq!(canonical_float(-2.5), "-2.5");
        assert_eq!(canonical_float(1500.0), "1500");
        assert_eq!(canonical_float(1e-16), "1e-16");
        assert_eq!(canonical_float(1e16), "1e16");
        assert_eq!(canonical_float(std::f64::consts::PI), "3.14159265358979");
        assert_eq!(canonical_float(0.0), "0");
        assert_eq!(canonical_float(-0.0), "0");
    }
}
