//! Statistics functions (HANDOFF §3.5).
//!
//! Inputs are `f64`; sums use Kahan compensation so large samples such as
//! `1..10` stay stable. An empty data set, or a sample statistic with fewer
//! than two values, returns `DomainError`. Non-finite intermediates return
//! `Overflow` instead of leaking `inf`/`NaN` into the display.

use crate::command::StatOp;
use crate::error::{CalcResult, ErrorCode, ErrorInfo};
use crate::value;

/// Maximum number of values rendered in the expression line.
const EXPRESSION_VALUES: usize = 10;

fn domain_error() -> ErrorInfo {
    ErrorInfo::new(ErrorCode::DomainError)
}

fn finite(value: f64) -> CalcResult<f64> {
    if value.is_finite() {
        Ok(value)
    } else {
        Err(ErrorInfo::new(ErrorCode::Overflow))
    }
}

/// Compensated summation; keeps `1..10` and mixed-magnitude samples accurate.
pub fn kahan_sum<I: IntoIterator<Item = f64>>(values: I) -> f64 {
    let mut sum = 0.0;
    let mut compensation = 0.0;
    for value in values {
        let adjusted = value - compensation;
        let next = sum + adjusted;
        compensation = (next - sum) - adjusted;
        sum = next;
    }
    sum
}

fn mean(data: &[f64]) -> f64 {
    kahan_sum(data.iter().copied()) / data.len() as f64
}

fn sorted(data: &[f64]) -> Vec<f64> {
    let mut values = data.to_vec();
    values.sort_by(f64::total_cmp);
    values
}

fn sample_variance(data: &[f64]) -> CalcResult<f64> {
    if data.len() < 2 {
        return Err(domain_error());
    }
    let average = mean(data);
    let squares = kahan_sum(data.iter().map(|value| {
        let deviation = value - average;
        deviation * deviation
    }));
    finite(squares / (data.len() - 1) as f64)
}

fn population_variance(data: &[f64]) -> CalcResult<f64> {
    if data.is_empty() {
        return Err(domain_error());
    }
    let average = mean(data);
    let squares = kahan_sum(data.iter().map(|value| {
        let deviation = value - average;
        deviation * deviation
    }));
    finite(squares / data.len() as f64)
}

/// Every value sharing the highest frequency, ascending. A sample where all
/// frequencies tie reports all values (the documented multi-mode convention).
fn modes(data: &[f64]) -> Vec<f64> {
    let values = sorted(data);
    let mut best = 0usize;
    let mut result = Vec::new();
    let mut index = 0;

    while index < values.len() {
        let mut next = index + 1;
        while next < values.len() && values[next] == values[index] {
            next += 1;
        }
        let frequency = next - index;
        if frequency > best {
            best = frequency;
            result.clear();
            result.push(values[index]);
        } else if frequency == best {
            result.push(values[index]);
        }
        index = next;
    }

    result
}

/// Computes `op` over `data`. The result is a list only for `Mode`; every other
/// operation yields exactly one scalar.
pub fn compute(op: StatOp, data: &[f64]) -> CalcResult<Vec<f64>> {
    if data.is_empty() {
        return Err(domain_error());
    }

    match op {
        StatOp::Mode => Ok(modes(data)),
        StatOp::Sum => Ok(vec![finite(kahan_sum(data.iter().copied()))?]),
        StatOp::SumSquares => Ok(vec![finite(kahan_sum(
            data.iter().map(|value| value * value),
        ))?]),
        StatOp::Mean => Ok(vec![finite(mean(data))?]),
        StatOp::Median => {
            let values = sorted(data);
            let middle = values.len() / 2;
            let median = if values.len() % 2 == 0 {
                (values[middle - 1] + values[middle]) / 2.0
            } else {
                values[middle]
            };
            Ok(vec![finite(median)?])
        }
        StatOp::Range => {
            let values = sorted(data);
            Ok(vec![finite(values[values.len() - 1] - values[0])?])
        }
        StatOp::SampleStdDev => Ok(vec![finite(sample_variance(data)?.sqrt())?]),
        StatOp::PopulationStdDev => Ok(vec![finite(population_variance(data)?.sqrt())?]),
        StatOp::Count => Ok(vec![data.len() as f64]),
        StatOp::Min => Ok(vec![data.iter().copied().fold(f64::INFINITY, f64::min)]),
        StatOp::Max => Ok(vec![data.iter().copied().fold(f64::NEG_INFINITY, f64::max)]),
        StatOp::Variance => Ok(vec![sample_variance(data)?]),
    }
}

/// Display-only expression line, e.g. `mean(1, 2, 3) =`. Long data sets are
/// truncated to the first ten values so history entries stay readable.
pub fn expression(op: StatOp, data: &[f64]) -> String {
    let shown: Vec<String> = data
        .iter()
        .take(EXPRESSION_VALUES)
        .map(|value| value::canonical_float(*value))
        .collect();
    let suffix = if data.len() > EXPRESSION_VALUES {
        ", ..."
    } else {
        ""
    };
    format!("{}({}{}) =", op.name(), shown.join(", "), suffix)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> Vec<f64> {
        (1..=10).map(f64::from).collect()
    }

    fn approx(actual: f64, expected: f64) {
        assert!(
            (actual - expected).abs() < 1e-12,
            "expected {expected}, got {actual}"
        );
    }

    #[test]
    fn kahan_sum_keeps_small_terms_stable() {
        approx(kahan_sum([0.1; 10]), 1.0);
        approx(kahan_sum((1..=1000).map(f64::from)), 500_500.0);
    }

    #[test]
    fn descriptive_statistics_match_excel() {
        let data = sample();
        let scalar = |op| compute(op, &data).unwrap()[0];
        approx(scalar(StatOp::Sum), 55.0);
        approx(scalar(StatOp::SumSquares), 385.0);
        approx(scalar(StatOp::Mean), 5.5);
        approx(scalar(StatOp::Median), 5.5);
        approx(scalar(StatOp::Range), 9.0);
        approx(scalar(StatOp::Min), 1.0);
        approx(scalar(StatOp::Max), 10.0);
        approx(scalar(StatOp::Count), 10.0);
        approx(scalar(StatOp::Variance), 9.166_666_666_666_666);
        approx(scalar(StatOp::SampleStdDev), 3.027_650_354_097_492);
        approx(scalar(StatOp::PopulationStdDev), 2.872_281_323_269_014);
    }

    #[test]
    fn median_handles_even_and_odd_lengths() {
        assert_eq!(
            compute(StatOp::Median, &[3.0, 1.0, 2.0]).unwrap(),
            vec![2.0]
        );
        assert_eq!(
            compute(StatOp::Median, &[4.0, 1.0, 3.0, 2.0]).unwrap(),
            vec![2.5]
        );
    }

    #[test]
    fn mode_lists_every_tied_value() {
        assert_eq!(
            compute(StatOp::Mode, &[3.0, 1.0, 2.0, 1.0, 3.0]).unwrap(),
            vec![1.0, 3.0]
        );
        assert_eq!(compute(StatOp::Mode, &[2.0, 2.0, 2.0]).unwrap(), vec![2.0]);
        assert_eq!(
            compute(StatOp::Mode, &[1.0, 2.0, 3.0]).unwrap(),
            vec![1.0, 2.0, 3.0]
        );
    }

    #[test]
    fn empty_and_single_value_edges() {
        assert_eq!(
            compute(StatOp::Sum, &[]).unwrap_err().code,
            ErrorCode::DomainError
        );
        assert_eq!(
            compute(StatOp::Variance, &[1.0]).unwrap_err().code,
            ErrorCode::DomainError
        );
        assert_eq!(
            compute(StatOp::SampleStdDev, &[1.0]).unwrap_err().code,
            ErrorCode::DomainError
        );
        assert_eq!(
            compute(StatOp::PopulationStdDev, &[1.0]).unwrap(),
            vec![0.0]
        );
        assert_eq!(compute(StatOp::Count, &[1.0]).unwrap(), vec![1.0]);
    }

    #[test]
    fn non_finite_results_are_overflow() {
        assert_eq!(
            compute(StatOp::SumSquares, &[f64::MAX, f64::MAX])
                .unwrap_err()
                .code,
            ErrorCode::Overflow
        );
    }

    #[test]
    fn expression_lists_values_and_truncates() {
        assert_eq!(expression(StatOp::Mean, &[1.0, 2.5]), "mean(1, 2.5) =");
        let long = (1..=12).map(f64::from).collect::<Vec<_>>();
        assert_eq!(
            expression(StatOp::Sum, &long),
            "sum(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, ...) ="
        );
    }
}
