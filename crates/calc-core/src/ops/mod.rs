//! Operation families and expression evaluation.
//!
//! Decimal inputs keep the exact basic-mode paths; scientific functions and any
//! mixed f64 operand promote to the scientific module (HANDOFF §3.5).

use rust_decimal::Decimal;

use crate::command::{BinaryOp, UnaryOp};
use crate::error::{CalcResult, ErrorCode, ErrorInfo};
use crate::mode::{AngleUnit, Mode};
use crate::parser::Expr;
use crate::value::Number;

pub mod basic;
pub mod programmer;
pub mod scientific;
pub mod statistics;

pub fn evaluate(expr: &Expr, mode: Mode) -> CalcResult<Number> {
    match expr {
        Expr::Number(n) => Ok(*n),
        Expr::Negate(inner) => Ok(-evaluate(inner, mode)?),
        Expr::Percent(inner) => {
            let value = evaluate(inner, mode)?;
            evaluate_binary(BinaryOp::Divide, value, hundred(), mode)
        }
        Expr::Binary(op, lhs, rhs) => {
            let lhs = evaluate(lhs, mode)?;
            let rhs = evaluate(rhs, mode)?;
            evaluate_binary(*op, lhs, rhs, mode)
        }
    }
}

fn hundred() -> Number {
    Number::Decimal(Decimal::ONE_HUNDRED)
}

pub fn evaluate_binary(op: BinaryOp, lhs: Number, rhs: Number, mode: Mode) -> CalcResult<Number> {
    match (lhs, rhs) {
        (Number::Decimal(a), Number::Decimal(b)) => {
            if matches!(op, BinaryOp::Power) && !b.fract().is_zero() {
                if mode == Mode::Scientific {
                    scientific::apply_binary(
                        op,
                        Number::Decimal(a).to_f64(),
                        Number::Decimal(b).to_f64(),
                    )
                    .map(Number::Float)
                } else {
                    basic::power(a, b).map(Number::Decimal)
                }
            } else {
                basic::apply_binary(op, a, b).map(Number::Decimal)
            }
        }
        _ if mode == Mode::Scientific => {
            scientific::apply_binary(op, lhs.to_f64(), rhs.to_f64()).map(Number::Float)
        }
        _ => Err(unsupported()),
    }
}

pub fn apply_unary(
    op: UnaryOp,
    input: Number,
    mode: Mode,
    angle_unit: AngleUnit,
) -> CalcResult<Number> {
    match input {
        Number::Decimal(value) if !basic::is_scientific(op) => {
            basic::apply_unary(op, value).map(Number::Decimal)
        }
        _ if mode == Mode::Scientific => {
            scientific::apply_unary(op, input.to_f64(), angle_unit).map(Number::Float)
        }
        _ => Err(unsupported()),
    }
}

pub fn unsupported() -> ErrorInfo {
    ErrorInfo::new(ErrorCode::Unsupported)
}
