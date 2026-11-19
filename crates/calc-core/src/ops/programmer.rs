//! Programmer-mode integer operations (HANDOFF §3.5).
//!
//! Values are stored as sign-extended `i64` bit patterns whose width is
//! truncated by [`WordSize`]. Decimal projections stay signed; binary, octal
//! and hexadecimal projections show the unsigned two's-complement pattern
//! within the active width. Arithmetic uses `wrapping_*`, shifts are logical
//! and rotate counts wrap inside the word, so nothing here can panic.

use crate::command::BinaryOp;
use crate::error::{CalcResult, ErrorCode, ErrorInfo};
use crate::mode::{Radix, WordSize};
use crate::view::ProgrammerView;

fn divide_by_zero() -> ErrorInfo {
    ErrorInfo::new(ErrorCode::DivideByZero)
}

fn invalid_input() -> ErrorInfo {
    ErrorInfo::new(ErrorCode::InvalidInput)
}

fn unsupported() -> ErrorInfo {
    ErrorInfo::new(ErrorCode::Unsupported)
}

/// Unsigned bit pattern inside `size`.
pub fn to_unsigned(value: i64, size: WordSize) -> u64 {
    (value as u64) & size.mask()
}

/// Truncate to `size` and sign-extend back to i64.
pub fn normalize(value: i64, size: WordSize) -> i64 {
    let masked = to_unsigned(value, size);
    let bits = size.bits();
    if bits == 64 {
        masked as i64
    } else {
        let sign = 1u64 << (bits - 1);
        if masked & sign != 0 {
            (masked | !size.mask()) as i64
        } else {
            masked as i64
        }
    }
}

/// Maximum number of digits accepted while typing in `radix`, so input cannot
/// grow past the unsigned width.
pub const fn max_digits(radix: Radix, size: WordSize) -> usize {
    let bits = size.bits() as usize;
    match radix {
        Radix::Binary => bits,
        Radix::Octal => bits.div_ceil(3),
        Radix::Decimal => match bits {
            8 => 3,
            16 => 5,
            32 => 10,
            _ => 20,
        },
        Radix::Hexadecimal => bits / 4,
    }
}

pub fn digit_char(value: u8) -> Option<char> {
    match value {
        0..=9 => Some(char::from(b'0' + value)),
        10..=15 => Some(char::from(b'A' + value - 10)),
        _ => None,
    }
}

pub fn digit_value(ch: char) -> Option<u8> {
    match ch {
        '0'..='9' => Some(ch as u8 - b'0'),
        'A'..='F' => Some(ch as u8 - b'A' + 10),
        'a'..='f' => Some(ch as u8 - b'a' + 10),
        _ => None,
    }
}

fn parse_digit(ch: char, radix: Radix) -> CalcResult<u64> {
    let digit = digit_value(ch).ok_or_else(invalid_input)?;
    if u64::from(digit) >= u64::from(radix.base()) {
        return Err(invalid_input());
    }
    Ok(u64::from(digit))
}

/// Parses a digit string (optional leading `-`) in `radix`. Values wider than
/// the word wrap modulo the width instead of failing.
pub fn parse(text: &str, radix: Radix, size: WordSize) -> CalcResult<i64> {
    let trimmed = text.trim();
    let (negative, digits) = match trimmed.strip_prefix('-') {
        Some(rest) => (true, rest),
        None => (false, trimmed),
    };
    if digits.is_empty() {
        return Err(invalid_input());
    }

    let base = u64::from(radix.base());
    let mut accumulator = 0u64;
    for ch in digits.chars() {
        let digit = parse_digit(ch, radix)?;
        accumulator = accumulator.wrapping_mul(base).wrapping_add(digit);
    }

    let signed = accumulator as i64;
    Ok(normalize(
        if negative {
            signed.wrapping_neg()
        } else {
            signed
        },
        size,
    ))
}

/// Canonical ungrouped string in `radix`: signed decimal, unsigned two's
/// complement elsewhere (uppercase hex).
pub fn format(value: i64, radix: Radix, size: WordSize) -> String {
    if radix == Radix::Decimal {
        return normalize(value, size).to_string();
    }
    let unsigned = to_unsigned(value, size);
    match radix {
        Radix::Binary => format!("{unsigned:b}"),
        Radix::Octal => format!("{unsigned:o}"),
        Radix::Hexadecimal => format!("{unsigned:X}"),
        Radix::Decimal => unreachable!("decimal handled above"),
    }
}

/// MSB-first bit string padded to the word width.
pub fn bit_string(value: i64, size: WordSize) -> String {
    let width = size.bits() as usize;
    format!("{:0width$b}", to_unsigned(value, size))
}

pub fn view(value: Option<i64>, radix: Radix, size: WordSize) -> ProgrammerView {
    let value = value.unwrap_or(0);
    ProgrammerView {
        radix,
        word_size: size,
        binary: format(value, Radix::Binary, size),
        octal: format(value, Radix::Octal, size),
        decimal: normalize(value, size).to_string(),
        hexadecimal: format(value, Radix::Hexadecimal, size),
        bits: bit_string(value, size),
    }
}

pub fn not(value: i64, size: WordSize) -> i64 {
    normalize(!value, size)
}

pub fn toggle_bit(value: i64, bit: u8, size: WordSize) -> CalcResult<i64> {
    if u32::from(bit) >= u32::from(size.bits()) {
        return Err(invalid_input());
    }
    Ok(normalize(value ^ (1i64 << bit), size))
}

fn shift_count(rhs: i64) -> CalcResult<u32> {
    if rhs < 0 {
        return Err(invalid_input());
    }
    u32::try_from(rhs).map_err(|_| invalid_input())
}

fn shift_left(lhs: i64, rhs: i64, size: WordSize) -> CalcResult<i64> {
    let count = shift_count(rhs)?;
    if count >= u32::from(size.bits()) {
        return Ok(0);
    }
    Ok(normalize(
        ((to_unsigned(lhs, size) << count) & size.mask()) as i64,
        size,
    ))
}

fn shift_right(lhs: i64, rhs: i64, size: WordSize) -> CalcResult<i64> {
    let count = shift_count(rhs)?;
    if count >= u32::from(size.bits()) {
        return Ok(0);
    }
    Ok(normalize((to_unsigned(lhs, size) >> count) as i64, size))
}

pub fn rotate_left(lhs: i64, rhs: i64, size: WordSize) -> CalcResult<i64> {
    let bits = u32::from(size.bits());
    let count = shift_count(rhs)? % bits;
    if count == 0 {
        return Ok(normalize(lhs, size));
    }
    let unsigned = to_unsigned(lhs, size);
    let rotated = (unsigned << count) | (unsigned >> (bits - count));
    Ok(normalize((rotated & size.mask()) as i64, size))
}

pub fn rotate_right(lhs: i64, rhs: i64, size: WordSize) -> CalcResult<i64> {
    let bits = u32::from(size.bits());
    let count = shift_count(rhs)? % bits;
    if count == 0 {
        return Ok(normalize(lhs, size));
    }
    let unsigned = to_unsigned(lhs, size);
    let rotated = (unsigned >> count) | (unsigned << (bits - count));
    Ok(normalize((rotated & size.mask()) as i64, size))
}

pub fn apply_binary(op: BinaryOp, lhs: i64, rhs: i64, size: WordSize) -> CalcResult<i64> {
    let result = match op {
        BinaryOp::Add => lhs.wrapping_add(rhs),
        BinaryOp::Subtract => lhs.wrapping_sub(rhs),
        BinaryOp::Multiply => lhs.wrapping_mul(rhs),
        BinaryOp::Divide => {
            if rhs == 0 {
                return Err(divide_by_zero());
            }
            lhs.wrapping_div(rhs)
        }
        BinaryOp::Modulo => {
            if rhs == 0 {
                return Err(divide_by_zero());
            }
            lhs.wrapping_rem(rhs)
        }
        BinaryOp::And => lhs & rhs,
        BinaryOp::Or => lhs | rhs,
        BinaryOp::Xor => lhs ^ rhs,
        BinaryOp::LeftShift => return shift_left(lhs, rhs, size),
        BinaryOp::RightShift => return shift_right(lhs, rhs, size),
        BinaryOp::RotateLeft => return rotate_left(lhs, rhs, size),
        BinaryOp::RotateRight => return rotate_right(lhs, rhs, size),
        BinaryOp::Power => return Err(unsupported()),
    };
    Ok(normalize(result, size))
}

#[cfg(test)]
mod tests {
    use super::*;

    const BYTE: WordSize = WordSize::Byte;
    const QWORD: WordSize = WordSize::Qword;

    #[test]
    fn width_masking_and_sign_extension() {
        assert_eq!(normalize(255, BYTE), -1);
        assert_eq!(normalize(256, BYTE), 0);
        assert_eq!(normalize(0x1FF, BYTE), -1);
        assert_eq!(normalize(i64::MAX, BYTE), -1);
        assert_eq!(to_unsigned(-1, BYTE), 0xFF);
        assert_eq!(to_unsigned(-1, QWORD), u64::MAX);
        assert_eq!(normalize(0x8000, WordSize::Word), i16::MIN as i64);
    }

    #[test]
    fn radix_projections_use_two_s_complement() {
        assert_eq!(format(-1, Radix::Hexadecimal, BYTE), "FF");
        assert_eq!(format(-1, Radix::Decimal, BYTE), "-1");
        assert_eq!(format(-1, Radix::Binary, BYTE), "11111111");
        assert_eq!(format(-1, Radix::Octal, BYTE), "377");
        assert_eq!(bit_string(-1, BYTE), "11111111");
        assert_eq!(format(0, Radix::Hexadecimal, QWORD), "0");
        assert_eq!(bit_string(0, WordSize::Word), "0".repeat(16));
    }

    #[test]
    fn parses_every_radix_and_wraps_wide_input() {
        assert_eq!(parse("FF", Radix::Hexadecimal, QWORD).unwrap(), 255);
        assert_eq!(parse("-ff", Radix::Hexadecimal, QWORD).unwrap(), -255);
        assert_eq!(parse("11111111", Radix::Binary, BYTE).unwrap(), -1);
        assert_eq!(parse("377", Radix::Octal, BYTE).unwrap(), -1);
        assert_eq!(parse("255", Radix::Decimal, BYTE).unwrap(), -1);
        assert_eq!(
            parse("18446744073709551615", Radix::Decimal, QWORD).unwrap(),
            -1
        );
        assert_eq!(
            parse("2", Radix::Binary, BYTE).unwrap_err().code,
            ErrorCode::InvalidInput
        );
        assert_eq!(
            parse("8", Radix::Octal, BYTE).unwrap_err().code,
            ErrorCode::InvalidInput
        );
        assert_eq!(
            parse("", Radix::Decimal, BYTE).unwrap_err().code,
            ErrorCode::InvalidInput
        );
        assert_eq!(
            parse("-", Radix::Decimal, BYTE).unwrap_err().code,
            ErrorCode::InvalidInput
        );
    }

    #[test]
    fn typing_limits_follow_the_word_width() {
        assert_eq!(max_digits(Radix::Binary, BYTE), 8);
        assert_eq!(max_digits(Radix::Hexadecimal, WordSize::Word), 4);
        assert_eq!(max_digits(Radix::Octal, WordSize::Dword), 11);
        assert_eq!(max_digits(Radix::Decimal, BYTE), 3);
        assert_eq!(max_digits(Radix::Decimal, QWORD), 20);
    }

    #[test]
    fn truth_tables_match_boolean_algebra() {
        for lhs in 0u8..=255 {
            for rhs in 0u8..=255 {
                let lhs = i64::from(lhs);
                let rhs = i64::from(rhs);
                let and = apply_binary(BinaryOp::And, lhs, rhs, BYTE).unwrap();
                let or = apply_binary(BinaryOp::Or, lhs, rhs, BYTE).unwrap();
                let xor = apply_binary(BinaryOp::Xor, lhs, rhs, BYTE).unwrap();
                assert_eq!(to_unsigned(and, BYTE), u64::from(lhs as u8 & rhs as u8));
                assert_eq!(to_unsigned(or, BYTE), u64::from(lhs as u8 | rhs as u8));
                assert_eq!(to_unsigned(xor, BYTE), u64::from(lhs as u8 ^ rhs as u8));
                assert_eq!(not(not(lhs, BYTE), BYTE), normalize(lhs, BYTE));
            }
        }
    }

    #[test]
    fn arithmetic_wraps_inside_the_word() {
        assert_eq!(apply_binary(BinaryOp::Add, 255, 1, BYTE).unwrap(), 0);
        assert_eq!(apply_binary(BinaryOp::Subtract, 0, 1, BYTE).unwrap(), -1);
        assert_eq!(
            apply_binary(BinaryOp::Multiply, 200, 2, BYTE).unwrap(),
            -112
        );
        assert_eq!(
            apply_binary(BinaryOp::Add, i64::MAX, 1, QWORD).unwrap(),
            i64::MIN
        );
    }

    #[test]
    fn division_truncates_and_reports_zero() {
        assert_eq!(apply_binary(BinaryOp::Divide, 7, 2, QWORD).unwrap(), 3);
        assert_eq!(apply_binary(BinaryOp::Divide, -7, 2, QWORD).unwrap(), -3);
        assert_eq!(
            apply_binary(BinaryOp::Divide, i64::MIN, -1, QWORD).unwrap(),
            i64::MIN
        );
        assert_eq!(
            apply_binary(BinaryOp::Divide, 1, 0, QWORD)
                .unwrap_err()
                .code,
            ErrorCode::DivideByZero
        );
        assert_eq!(apply_binary(BinaryOp::Modulo, 7, 3, QWORD).unwrap(), 1);
        assert_eq!(apply_binary(BinaryOp::Modulo, -7, 3, QWORD).unwrap(), -1);
        assert_eq!(
            apply_binary(BinaryOp::Modulo, 1, 0, QWORD)
                .unwrap_err()
                .code,
            ErrorCode::DivideByZero
        );
    }

    #[test]
    fn shifts_are_logical_and_clamp_by_width() {
        assert_eq!(apply_binary(BinaryOp::LeftShift, 0x80, 1, BYTE).unwrap(), 0);
        assert_eq!(
            apply_binary(BinaryOp::RightShift, -1, 1, BYTE).unwrap(),
            0x7F
        );
        assert_eq!(apply_binary(BinaryOp::RightShift, -1, 8, BYTE).unwrap(), 0);
        assert_eq!(apply_binary(BinaryOp::LeftShift, 1, 64, QWORD).unwrap(), 0);
        assert_eq!(
            apply_binary(BinaryOp::LeftShift, 1, -1, QWORD)
                .unwrap_err()
                .code,
            ErrorCode::InvalidInput
        );
    }

    #[test]
    fn rotations_wrap_inside_the_word_and_are_inverse() {
        assert_eq!(
            apply_binary(
                BinaryOp::RotateLeft,
                0x8000_0000_0000_0001u64 as i64,
                1,
                QWORD
            )
            .unwrap(),
            3
        );
        assert_eq!(
            apply_binary(BinaryOp::RotateLeft, 0x81, 1, BYTE).unwrap(),
            0x03
        );
        assert_eq!(
            to_unsigned(
                apply_binary(BinaryOp::RotateRight, 0x03, 1, BYTE).unwrap(),
                BYTE
            ),
            0x81
        );
        for value in 0u8..=255 {
            for count in 0..=9 {
                let lhs = i64::from(value);
                let rotated = rotate_left(lhs, count, BYTE).unwrap();
                assert_eq!(
                    rotate_right(rotated, count, BYTE).unwrap(),
                    normalize(lhs, BYTE)
                );
            }
        }
        let mut seed = 0x9E37_79B9_7F4A_7C15u64;
        for _ in 0..256 {
            seed ^= seed << 13;
            seed ^= seed >> 7;
            seed ^= seed << 17;
            let value = seed as i64;
            let count = (seed % 64) as i64;
            let rotated = rotate_left(value, count, QWORD).unwrap();
            assert_eq!(rotate_right(rotated, count, QWORD).unwrap(), value);
        }
    }

    #[test]
    fn toggle_bit_stays_inside_the_word() {
        assert_eq!(toggle_bit(0, 0, BYTE).unwrap(), 1);
        assert_eq!(toggle_bit(0, 7, BYTE).unwrap(), -128);
        assert_eq!(to_unsigned(toggle_bit(0, 7, BYTE).unwrap(), BYTE), 0x80);
        assert_eq!(toggle_bit(0xFF, 0, BYTE).unwrap(), -2);
        assert_eq!(
            toggle_bit(0, 8, BYTE).unwrap_err().code,
            ErrorCode::InvalidInput
        );
    }

    #[test]
    fn power_is_not_part_of_programmer_mode() {
        assert_eq!(
            apply_binary(BinaryOp::Power, 2, 3, QWORD).unwrap_err().code,
            ErrorCode::Unsupported
        );
    }

    #[test]
    fn view_matches_the_four_radix_projections() {
        let view = view(Some(-1), Radix::Hexadecimal, BYTE);
        assert_eq!(view.binary, "11111111");
        assert_eq!(view.octal, "377");
        assert_eq!(view.decimal, "-1");
        assert_eq!(view.hexadecimal, "FF");
        assert_eq!(view.bits, "11111111");
    }
}
