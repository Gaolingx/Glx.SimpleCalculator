//! Scientific functions evaluated in f64 (HANDOFF §3.5).
//!
//! Angle-taking functions convert at the boundary so the engine only stores the
//! active [`AngleUnit`]. Every function reports `DomainError` for invalid input
//! and `Overflow` for non-finite results; this module never panics.

use std::f64::consts::PI;

use crate::command::{BinaryOp, UnaryOp};
use crate::error::{CalcResult, ErrorCode, ErrorInfo};
use crate::mode::AngleUnit;

const MAX_FACTORIAL: f64 = 170.0;
/// `tan(90°)` is undefined; the nearest f64 cosine is ~6.1e-17.
const TANGENT_EPSILON: f64 = 1e-12;
/// Trig values below this magnitude are floating-point noise (`cos 90°`).
const TRIG_SNAP: f64 = 1e-15;

fn domain() -> ErrorInfo {
    ErrorInfo::new(ErrorCode::DomainError)
}

fn overflow() -> ErrorInfo {
    ErrorInfo::new(ErrorCode::Overflow)
}

fn divide_by_zero() -> ErrorInfo {
    ErrorInfo::new(ErrorCode::DivideByZero)
}

fn unsupported() -> ErrorInfo {
    ErrorInfo::new(ErrorCode::Unsupported)
}

/// Converts an angle expressed in `unit` to radians.
pub fn to_radians(value: f64, unit: AngleUnit) -> f64 {
    match unit {
        AngleUnit::Deg => value.to_radians(),
        AngleUnit::Rad => value,
        AngleUnit::Grad => value * PI / 200.0,
    }
}

/// Converts radians back into `unit` (inverse trigonometry results).
pub fn from_radians(value: f64, unit: AngleUnit) -> f64 {
    match unit {
        AngleUnit::Deg => value.to_degrees(),
        AngleUnit::Rad => value,
        AngleUnit::Grad => value * 200.0 / PI,
    }
}

fn finite(value: f64) -> CalcResult<f64> {
    if value.is_finite() {
        Ok(value)
    } else if value.is_nan() {
        Err(domain())
    } else {
        Err(overflow())
    }
}

fn factorial(value: f64) -> CalcResult<f64> {
    if value < 0.0 || value.fract() != 0.0 {
        return Err(domain());
    }
    if value > MAX_FACTORIAL {
        return Err(overflow());
    }
    let mut result = 1.0;
    for factor in 2..=(value as u32) {
        result *= f64::from(factor);
    }
    Ok(result)
}

fn snap_trig(value: f64) -> f64 {
    if value.abs() < TRIG_SNAP { 0.0 } else { value }
}

fn round_half_away_from_zero(value: f64) -> f64 {
    if value >= 0.0 {
        (value + 0.5).floor()
    } else {
        (value - 0.5).ceil()
    }
}

pub fn apply_unary(op: UnaryOp, value: f64, unit: AngleUnit) -> CalcResult<f64> {
    use UnaryOp::*;

    let result = match op {
        Sqrt => {
            if value < 0.0 {
                return Err(domain());
            }
            value.sqrt()
        }
        Square => value * value,
        Cube => value * value * value,
        CubeRoot => value.cbrt(),
        Reciprocal => {
            if value == 0.0 {
                return Err(divide_by_zero());
            }
            1.0 / value
        }
        Factorial => factorial(value)?,
        Sin => snap_trig(to_radians(value, unit).sin()),
        Cos => snap_trig(to_radians(value, unit).cos()),
        Tan => {
            let radians = to_radians(value, unit);
            if radians.cos().abs() < TANGENT_EPSILON {
                return Err(domain());
            }
            snap_trig(radians.tan())
        }
        Asin => {
            if !(-1.0..=1.0).contains(&value) {
                return Err(domain());
            }
            from_radians(value.asin(), unit)
        }
        Acos => {
            if !(-1.0..=1.0).contains(&value) {
                return Err(domain());
            }
            from_radians(value.acos(), unit)
        }
        Atan => from_radians(value.atan(), unit),
        Sinh => value.sinh(),
        Cosh => value.cosh(),
        Tanh => value.tanh(),
        Asinh => value.asinh(),
        Acosh => {
            if value < 1.0 {
                return Err(domain());
            }
            value.acosh()
        }
        Atanh => {
            if value.abs() >= 1.0 {
                return Err(domain());
            }
            value.atanh()
        }
        Ln => {
            if value <= 0.0 {
                return Err(domain());
            }
            value.ln()
        }
        Log10 => {
            if value <= 0.0 {
                return Err(domain());
            }
            value.log10()
        }
        Log2 => {
            if value <= 0.0 {
                return Err(domain());
            }
            value.log2()
        }
        Exp => value.exp(),
        Abs => value.abs(),
        Floor => value.floor(),
        Ceil => value.ceil(),
        Round => round_half_away_from_zero(value),
        Not => return Err(unsupported()),
    };

    finite(result)
}

fn power(base: f64, exponent: f64) -> CalcResult<f64> {
    if base == 0.0 && exponent < 0.0 {
        return Err(divide_by_zero());
    }
    if base < 0.0 && exponent.fract() != 0.0 {
        return Err(domain());
    }
    finite(base.powf(exponent))
}

pub fn apply_binary(op: BinaryOp, lhs: f64, rhs: f64) -> CalcResult<f64> {
    let result = match op {
        BinaryOp::Add => lhs + rhs,
        BinaryOp::Subtract => lhs - rhs,
        BinaryOp::Multiply => lhs * rhs,
        BinaryOp::Divide => {
            if rhs == 0.0 {
                return Err(divide_by_zero());
            }
            lhs / rhs
        }
        BinaryOp::Power => return power(lhs, rhs),
        BinaryOp::Modulo => {
            if rhs == 0.0 {
                return Err(divide_by_zero());
            }
            lhs % rhs
        }
        BinaryOp::And
        | BinaryOp::Or
        | BinaryOp::Xor
        | BinaryOp::LeftShift
        | BinaryOp::RightShift
        | BinaryOp::RotateLeft
        | BinaryOp::RotateRight => return Err(unsupported()),
    };
    finite(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn close(actual: f64, expected: f64) {
        assert!(
            (actual - expected).abs() < 1e-12,
            "expected {expected}, got {actual}"
        );
    }

    #[test]
    fn angle_units_round_trip() {
        close(to_radians(180.0, AngleUnit::Deg), PI);
        close(to_radians(200.0, AngleUnit::Grad), PI);
        close(from_radians(PI, AngleUnit::Deg), 180.0);
        close(from_radians(PI, AngleUnit::Grad), 200.0);
        assert_eq!(to_radians(1.0, AngleUnit::Rad), 1.0);
    }

    #[test]
    fn trigonometry_respects_angle_unit() {
        close(
            apply_unary(UnaryOp::Sin, 30.0, AngleUnit::Deg).unwrap(),
            0.5,
        );
        close(
            apply_unary(UnaryOp::Cos, 60.0, AngleUnit::Deg).unwrap(),
            0.5,
        );
        close(
            apply_unary(UnaryOp::Sin, PI / 6.0, AngleUnit::Rad).unwrap(),
            0.5,
        );
        close(
            apply_unary(UnaryOp::Sin, 100.0, AngleUnit::Grad).unwrap(),
            1.0,
        );
        close(
            apply_unary(UnaryOp::Asin, 0.5, AngleUnit::Deg).unwrap(),
            30.0,
        );
        close(
            apply_unary(UnaryOp::Acos, 0.5, AngleUnit::Grad).unwrap(),
            200.0 / 3.0,
        );
    }

    #[test]
    fn inverse_trigonometry_validates_domain() {
        assert_eq!(
            apply_unary(UnaryOp::Asin, 1.5, AngleUnit::Deg)
                .unwrap_err()
                .code,
            ErrorCode::DomainError
        );
        assert_eq!(
            apply_unary(UnaryOp::Acos, -1.5, AngleUnit::Deg)
                .unwrap_err()
                .code,
            ErrorCode::DomainError
        );
        assert_eq!(
            apply_unary(UnaryOp::Atanh, 1.0, AngleUnit::Deg)
                .unwrap_err()
                .code,
            ErrorCode::DomainError
        );
        assert_eq!(
            apply_unary(UnaryOp::Acosh, 0.5, AngleUnit::Deg)
                .unwrap_err()
                .code,
            ErrorCode::DomainError
        );
    }

    #[test]
    fn tangent_rejects_odd_right_angles() {
        assert_eq!(
            apply_unary(UnaryOp::Tan, 90.0, AngleUnit::Deg)
                .unwrap_err()
                .code,
            ErrorCode::DomainError
        );
        assert_eq!(
            apply_unary(UnaryOp::Tan, 100.0, AngleUnit::Grad)
                .unwrap_err()
                .code,
            ErrorCode::DomainError
        );
    }

    #[test]
    fn logarithms_and_exponential_validate_domain() {
        assert_eq!(
            apply_unary(UnaryOp::Ln, 0.0, AngleUnit::Deg)
                .unwrap_err()
                .code,
            ErrorCode::DomainError
        );
        assert_eq!(
            apply_unary(UnaryOp::Log10, -1.0, AngleUnit::Deg)
                .unwrap_err()
                .code,
            ErrorCode::DomainError
        );
        close(
            apply_unary(UnaryOp::Log2, 8.0, AngleUnit::Deg).unwrap(),
            3.0,
        );
        close(
            apply_unary(UnaryOp::Ln, std::f64::consts::E, AngleUnit::Deg).unwrap(),
            1.0,
        );
        close(apply_unary(UnaryOp::Exp, 0.0, AngleUnit::Deg).unwrap(), 1.0);
        assert_eq!(
            apply_unary(UnaryOp::Exp, 1000.0, AngleUnit::Deg)
                .unwrap_err()
                .code,
            ErrorCode::Overflow
        );
    }

    #[test]
    fn factorial_covers_the_f64_range() {
        close(
            apply_unary(UnaryOp::Factorial, 5.0, AngleUnit::Deg).unwrap(),
            120.0,
        );
        close(
            apply_unary(UnaryOp::Factorial, 0.0, AngleUnit::Deg).unwrap(),
            1.0,
        );
        let big = apply_unary(UnaryOp::Factorial, 170.0, AngleUnit::Deg).unwrap();
        assert!(big.is_finite() && big > 1e306);
        assert_eq!(
            apply_unary(UnaryOp::Factorial, 171.0, AngleUnit::Deg)
                .unwrap_err()
                .code,
            ErrorCode::Overflow
        );
        assert_eq!(
            apply_unary(UnaryOp::Factorial, -1.0, AngleUnit::Deg)
                .unwrap_err()
                .code,
            ErrorCode::DomainError
        );
        assert_eq!(
            apply_unary(UnaryOp::Factorial, 2.5, AngleUnit::Deg)
                .unwrap_err()
                .code,
            ErrorCode::DomainError
        );
    }

    #[test]
    fn power_handles_fractional_exponents() {
        close(
            apply_binary(BinaryOp::Power, 2.0, 0.5).unwrap(),
            2.0_f64.sqrt(),
        );
        close(apply_binary(BinaryOp::Power, 9.0, -0.5).unwrap(), 1.0 / 3.0);
        assert_eq!(
            apply_binary(BinaryOp::Power, -2.0, 0.5).unwrap_err().code,
            ErrorCode::DomainError
        );
        assert_eq!(
            apply_binary(BinaryOp::Power, 0.0, -1.0).unwrap_err().code,
            ErrorCode::DivideByZero
        );
    }

    #[test]
    fn division_and_modulo_reject_zero() {
        assert_eq!(
            apply_binary(BinaryOp::Divide, 1.0, 0.0).unwrap_err().code,
            ErrorCode::DivideByZero
        );
        assert_eq!(
            apply_binary(BinaryOp::Modulo, 1.0, 0.0).unwrap_err().code,
            ErrorCode::DivideByZero
        );
        close(apply_binary(BinaryOp::Modulo, 7.5, 2.0).unwrap(), 1.5);
    }

    #[test]
    fn rounding_is_half_away_from_zero() {
        close(
            apply_unary(UnaryOp::Round, 2.5, AngleUnit::Deg).unwrap(),
            3.0,
        );
        close(
            apply_unary(UnaryOp::Round, -2.5, AngleUnit::Deg).unwrap(),
            -3.0,
        );
        close(
            apply_unary(UnaryOp::Floor, -1.2, AngleUnit::Deg).unwrap(),
            -2.0,
        );
        close(
            apply_unary(UnaryOp::Ceil, -1.2, AngleUnit::Deg).unwrap(),
            -1.0,
        );
    }
}
