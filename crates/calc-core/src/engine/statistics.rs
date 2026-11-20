//! Statistics-mode session state machine.
//!
//! The session owns the data set and the last computed result. Values are
//! stored as `f64` (HANDOFF §3.5); canonical strings are rendered per view so
//! the frontend owns grouping and significant-digit display. Edits address
//! values by their original index, independent of any display sorting.

use crate::command::CalcCommand;
use crate::error::{CalcResult, ErrorCode, ErrorInfo};
use crate::mode::Mode;
use crate::ops::statistics;
use crate::value;
use crate::view::{CalcView, StatisticsView};

/// Hard cap so a repeated edit loop cannot grow the session without bound.
pub(crate) const MAX_DATASET: usize = 1000;

#[derive(Debug, Clone, Default)]
pub(crate) struct StatisticsSession {
    data: Vec<f64>,
    expression: String,
    result: Option<String>,
    error: Option<ErrorInfo>,
}

impl StatisticsSession {
    pub fn apply(&mut self, command: CalcCommand) -> CalcView {
        if command.validate().is_err() {
            self.error = Some(ErrorInfo::new(ErrorCode::InvalidInput));
            return self.view();
        }

        self.error = None;
        let handled = match command {
            CalcCommand::StatsAdd { value } => self.add(&value),
            CalcCommand::StatsUpdate { index, value } => self.update(index, &value),
            CalcCommand::StatsRemove { index } => self.remove(index),
            CalcCommand::StatsClear => {
                self.clear();
                Ok(())
            }
            CalcCommand::StatsCompute { op } => self.compute(op),
            CalcCommand::Recall { expression, value } => {
                self.recall(&expression, &value);
                Ok(())
            }
            // `C`/`Esc` clear the result display but never the data set.
            CalcCommand::ClearAll | CalcCommand::ClearEntry | CalcCommand::Backspace => {
                self.clear_result();
                Ok(())
            }
            _ => Err(ErrorInfo::new(ErrorCode::Unsupported)),
        };

        if let Err(error) = handled {
            self.error = Some(error);
        }
        self.view()
    }

    pub fn view(&self) -> CalcView {
        CalcView {
            mode: Mode::Statistics,
            expression: self.expression.clone(),
            value: self.result.clone().unwrap_or_default(),
            memories: Vec::new(),
            programmer: None,
            statistics: Some(StatisticsView {
                data: self
                    .data
                    .iter()
                    .map(|value| value::canonical_float(*value))
                    .collect(),
            }),
            error: self.error.clone(),
        }
    }

    fn add(&mut self, text: &str) -> CalcResult<()> {
        if self.data.len() >= MAX_DATASET {
            return Err(ErrorInfo::new(ErrorCode::InvalidInput));
        }
        self.data.push(parse_value(text)?);
        self.clear_result();
        Ok(())
    }

    fn update(&mut self, index: usize, text: &str) -> CalcResult<()> {
        let parsed = parse_value(text)?;
        let slot = self
            .data
            .get_mut(index)
            .ok_or_else(|| ErrorInfo::new(ErrorCode::InvalidInput))?;
        *slot = parsed;
        self.clear_result();
        Ok(())
    }

    fn remove(&mut self, index: usize) -> CalcResult<()> {
        if index >= self.data.len() {
            return Err(ErrorInfo::new(ErrorCode::InvalidInput));
        }
        self.data.remove(index);
        self.clear_result();
        Ok(())
    }

    fn clear(&mut self) {
        self.data.clear();
        self.clear_result();
    }

    fn compute(&mut self, op: crate::command::StatOp) -> CalcResult<()> {
        // Keep the attempted function visible when computation fails.
        self.expression = statistics::expression(op, &self.data);
        self.result = None;
        let results = statistics::compute(op, &self.data)?;
        self.result = Some(
            results
                .iter()
                .map(|value| value::canonical_float(*value))
                .collect::<Vec<_>>()
                .join(", "),
        );
        Ok(())
    }

    /// History restore is display-only: the stored expression and result are
    /// shown, and the data set is left untouched.
    fn recall(&mut self, expression: &str, value: &str) {
        self.expression = expression.to_owned();
        self.result = Some(value.to_owned());
    }

    fn clear_result(&mut self) {
        self.expression.clear();
        self.result = None;
    }
}

fn parse_value(text: &str) -> CalcResult<f64> {
    let parsed = value::parse_number(text)?.to_f64();
    if !parsed.is_finite() {
        return Err(ErrorInfo::new(ErrorCode::Overflow));
    }
    // Normalize negative zero so mode equality and display stay consistent.
    Ok(if parsed == 0.0 { 0.0 } else { parsed })
}
