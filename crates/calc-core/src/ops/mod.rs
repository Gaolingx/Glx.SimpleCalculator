//! Operation families and expression evaluation.

use rust_decimal::Decimal;

use crate::command::BinaryOp;
use crate::error::{CalcResult, ErrorCode, ErrorInfo};
use crate::parser::Expr;

pub mod basic;

pub fn evaluate(expr: &Expr) -> CalcResult<Decimal> {
    match expr {
        Expr::Number(n) => Ok(*n),
        Expr::Negate(inner) => Ok(-evaluate(inner)?),
        Expr::Percent(inner) => Ok(evaluate(inner)? / Decimal::ONE_HUNDRED),
        Expr::Binary(op, lhs, rhs) => {
            let lhs = evaluate(lhs)?;
            let rhs = evaluate(rhs)?;
            evaluate_binary(*op, lhs, rhs)
        }
    }
}

pub fn evaluate_binary(op: BinaryOp, lhs: Decimal, rhs: Decimal) -> CalcResult<Decimal> {
    if matches!(op, BinaryOp::Power) {
        return basic::power(lhs, rhs);
    }
    basic::apply_binary(op, lhs, rhs)
}

pub fn unsupported() -> ErrorInfo {
    ErrorInfo::new(ErrorCode::Unsupported)
}
