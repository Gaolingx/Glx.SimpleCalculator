//! Decimal parsing, normalization and canonical output.
//!
//! The core only exchanges canonical strings. Grouping separators, locale
//! digits and significant-digit display belong to the frontend.

use std::str::FromStr;

use rust_decimal::Decimal;

use crate::error::{CalcResult, ErrorCode, ErrorInfo};

/// Upper bound for a single pasted expression (HANDOFF §3.9).
pub const MAX_INPUT_CHARS: usize = 1000;

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
}
