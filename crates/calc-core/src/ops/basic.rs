//! Basic arithmetic: four operations, percentage and one-argument operators.
//!
//! Scientific and programmer operations live in their own modules (T8/T9) and
//! report `Unsupported` here so the engine never panics on an unimplemented key.

use rust_decimal::prelude::ToPrimitive;
use rust_decimal::{Decimal, MathematicalOps, RoundingStrategy};

use crate::command::{BinaryOp, UnaryOp};
use crate::error::{CalcResult, ErrorCode, ErrorInfo};

fn overflow() -> ErrorInfo {
    ErrorInfo::new(ErrorCode::Overflow)
}

fn divide_by_zero() -> ErrorInfo {
    ErrorInfo::new(ErrorCode::DivideByZero)
}

pub fn add(lhs: Decimal, rhs: Decimal) -> CalcResult<Decimal> {
    lhs.checked_add(rhs).ok_or_else(overflow)
}

pub fn subtract(lhs: Decimal, rhs: Decimal) -> CalcResult<Decimal> {
    lhs.checked_sub(rhs).ok_or_else(overflow)
}

pub fn multiply(lhs: Decimal, rhs: Decimal) -> CalcResult<Decimal> {
    lhs.checked_mul(rhs).ok_or_else(overflow)
}

pub fn divide(lhs: Decimal, rhs: Decimal) -> CalcResult<Decimal> {
    if rhs.is_zero() {
        return Err(divide_by_zero());
    }
    lhs.checked_div(rhs).ok_or_else(overflow)
}

pub fn modulo(lhs: Decimal, rhs: Decimal) -> CalcResult<Decimal> {
    if rhs.is_zero() {
        return Err(divide_by_zero());
    }
    lhs.checked_rem(rhs).ok_or_else(overflow)
}

/// Windows-style percentage operand: `base * pct / 100`.
pub fn percent_of(base: Decimal, pct: Decimal) -> CalcResult<Decimal> {
    let scaled = pct.checked_div(Decimal::ONE_HUNDRED).ok_or_else(overflow)?;
    base.checked_mul(scaled).ok_or_else(overflow)
}

/// Integer power with checked multiplication (`2^3^2` is evaluated by the
/// parser as `2^(3^2)`). Fractional exponents belong to scientific mode (T8).
pub fn power(base: Decimal, exponent: Decimal) -> CalcResult<Decimal> {
    if !exponent.fract().is_zero() {
        return Err(ErrorInfo::new(ErrorCode::Unsupported));
    }
    let exp = exponent.to_i64().ok_or_else(overflow)?;
    if base.is_zero() && exp < 0 {
        return Err(divide_by_zero());
    }

    let mut n = exp.unsigned_abs();
    let mut factor = base;
    let mut result = Decimal::ONE;
    while n > 0 {
        if n & 1 == 1 {
            result = result.checked_mul(factor).ok_or_else(overflow)?;
        }
        n >>= 1;
        if n > 0 {
            factor = factor.checked_mul(factor).ok_or_else(overflow)?;
        }
    }

    if exp < 0 {
        divide(Decimal::ONE, result)
    } else {
        Ok(result)
    }
}

pub fn apply_binary(op: BinaryOp, lhs: Decimal, rhs: Decimal) -> CalcResult<Decimal> {
    match op {
        BinaryOp::Add => add(lhs, rhs),
        BinaryOp::Subtract => subtract(lhs, rhs),
        BinaryOp::Multiply => multiply(lhs, rhs),
        BinaryOp::Divide => divide(lhs, rhs),
        BinaryOp::Power => power(lhs, rhs),
        BinaryOp::Modulo => modulo(lhs, rhs),
        BinaryOp::And
        | BinaryOp::Or
        | BinaryOp::Xor
        | BinaryOp::LeftShift
        | BinaryOp::RightShift
        | BinaryOp::RotateLeft
        | BinaryOp::RotateRight => Err(ErrorInfo::new(ErrorCode::Unsupported)),
    }
}

pub fn apply_unary(op: UnaryOp, value: Decimal) -> CalcResult<Decimal> {
    use UnaryOp::*;
    match op {
        Sqrt => sqrt(value),
        Square => multiply(value, value),
        Cube => multiply(multiply(value, value)?, value),
        Reciprocal => divide(Decimal::ONE, value),
        Abs => Ok(value.abs()),
        Floor => Ok(value.floor()),
        Ceil => Ok(value.ceil()),
        Round => Ok(value.round_dp_with_strategy(0, RoundingStrategy::MidpointAwayFromZero)),
        CubeRoot | Factorial | Sin | Cos | Tan | Asin | Acos | Atan | Sinh | Cosh | Tanh
        | Asinh | Acosh | Atanh | Ln | Log10 | Log2 | Exp => {
            Err(ErrorInfo::new(ErrorCode::Unsupported))
        }
    }
}

pub fn sqrt(value: Decimal) -> CalcResult<Decimal> {
    if value.is_sign_negative() && !value.is_zero() {
        return Err(ErrorInfo::new(ErrorCode::DomainError));
    }
    value
        .sqrt()
        .ok_or_else(|| ErrorInfo::new(ErrorCode::DomainError))
}

/// Unary operator that keeps the current entry in place (no new operand).
pub fn is_postfix(op: UnaryOp) -> bool {
    !is_scientific(op)
}

/// Scientific/bitwise operations are not implemented in M1.
pub(crate) fn is_scientific(op: UnaryOp) -> bool {
    use UnaryOp::*;
    matches!(
        op,
        CubeRoot
            | Factorial
            | Sin
            | Cos
            | Tan
            | Asin
            | Acos
            | Atan
            | Sinh
            | Cosh
            | Tanh
            | Asinh
            | Acosh
            | Atanh
            | Ln
            | Log10
            | Log2
            | Exp
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    fn d(raw: &str) -> Decimal {
        Decimal::from_str(raw).unwrap()
    }

    #[test]
    fn adds_and_subtracts() {
        assert_eq!(add(d("2"), d("3")).unwrap(), d("5"));
        assert_eq!(subtract(d("2"), d("3")).unwrap(), d("-1"));
        assert_eq!(add(d("0.1"), d("0.2")).unwrap(), d("0.3"));
    }

    #[test]
    fn multiplies_exactly() {
        assert_eq!(multiply(d("0.1"), d("0.2")).unwrap(), d("0.02"));
        assert_eq!(multiply(d("-4"), d("2.5")).unwrap(), d("-10"));
    }

    #[test]
    fn divides_exactly() {
        assert_eq!(divide(d("1"), d("4")).unwrap(), d("0.25"));
        assert_eq!(divide(d("-9"), d("3")).unwrap(), d("-3"));
    }

    #[test]
    fn division_by_zero_is_reported() {
        let err = divide(d("1"), Decimal::ZERO).unwrap_err();
        assert_eq!(err.code, ErrorCode::DivideByZero);
        let err = apply_binary(BinaryOp::Divide, d("5"), d("0")).unwrap_err();
        assert_eq!(err.code, ErrorCode::DivideByZero);
    }

    #[test]
    fn overflow_is_reported_instead_of_panicking() {
        let huge = Decimal::from_parts(u32::MAX, u32::MAX, u32::MAX, false, 0);
        let err = multiply(huge, d("10")).unwrap_err();
        assert_eq!(err.code, ErrorCode::Overflow);
    }

    #[test]
    fn percent_of_uses_base_ratio() {
        assert_eq!(percent_of(d("200"), d("10")).unwrap(), d("20"));
        assert_eq!(percent_of(d("50"), d("10")).unwrap(), d("5"));
        assert_eq!(percent_of(d("0"), d("10")).unwrap(), Decimal::ZERO);
    }

    #[test]
    fn square_and_reciprocal() {
        assert_eq!(apply_unary(UnaryOp::Square, d("1.5")).unwrap(), d("2.25"));
        assert_eq!(apply_unary(UnaryOp::Cube, d("2")).unwrap(), d("8"));
        assert_eq!(apply_unary(UnaryOp::Reciprocal, d("4")).unwrap(), d("0.25"));
        assert_eq!(
            apply_unary(UnaryOp::Reciprocal, d("0")).unwrap_err().code,
            ErrorCode::DivideByZero
        );
    }

    #[test]
    fn sqrt_handles_domain() {
        assert_eq!(sqrt(d("9")).unwrap(), d("3"));
        assert_eq!(sqrt(d("2")).unwrap().round_dp(10), d("1.4142135624"));
        assert_eq!(sqrt(d("-1")).unwrap_err().code, ErrorCode::DomainError);
        assert_eq!(sqrt(Decimal::ZERO).unwrap(), Decimal::ZERO);
    }

    #[test]
    fn rounding_is_half_away_from_zero() {
        assert_eq!(apply_unary(UnaryOp::Round, d("2.5")).unwrap(), d("3"));
        assert_eq!(apply_unary(UnaryOp::Round, d("-2.5")).unwrap(), d("-3"));
        assert_eq!(apply_unary(UnaryOp::Floor, d("-1.2")).unwrap(), d("-2"));
        assert_eq!(apply_unary(UnaryOp::Ceil, d("-1.2")).unwrap(), d("-1"));
        assert_eq!(apply_unary(UnaryOp::Abs, d("-7")).unwrap(), d("7"));
    }

    #[test]
    fn unimplemented_operations_are_unsupported() {
        assert_eq!(
            apply_unary(UnaryOp::Sin, d("0")).unwrap_err().code,
            ErrorCode::Unsupported
        );
        assert_eq!(
            apply_binary(BinaryOp::And, d("1"), d("1"))
                .unwrap_err()
                .code,
            ErrorCode::Unsupported
        );
    }

    #[test]
    fn postfix_classification_matches_implementation() {
        assert!(is_postfix(UnaryOp::Sqrt));
        assert!(is_postfix(UnaryOp::Abs));
        assert!(!is_postfix(UnaryOp::Ln));
        assert!(!is_postfix(UnaryOp::Factorial));
    }
}
