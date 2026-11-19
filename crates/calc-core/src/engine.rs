//! Basic-mode session state machine.
//!
//! The engine owns the input buffer, pending expression, memory slot and
//! repeat-equals state. It returns canonical values only; the frontend owns
//! grouping, significant digits and localized messages.

use rust_decimal::Decimal;

use crate::command::{BinaryOp, CalcCommand, ConstantId, MemoryOp, UnaryOp};
use crate::error::{CalcResult, ErrorCode, ErrorInfo};
use crate::mode::{AngleUnit, Mode, Radix, WordSize};
use crate::ops;
use crate::parser::{self, Token};
use crate::value::{self, Number};
use crate::view::CalcView;

const PI: &str = "3.1415926535897932384626433833";
const E: &str = "2.7182818284590452353602874714";
const MAX_ENTRY_CHARS: usize = 32;

#[derive(Debug, Clone)]
struct Entry {
    raw: String,
}

impl Entry {
    fn new(raw: impl Into<String>) -> Self {
        Self { raw: raw.into() }
    }

    fn number(&self) -> CalcResult<Number> {
        let trimmed = self.raw.trim_end_matches('.');
        if trimmed.is_empty() || trimmed == "-" {
            return Ok(Number::Decimal(Decimal::ZERO));
        }
        value::parse_number(trimmed)
    }

    fn push_digit(&mut self, digit: u8) {
        if self.raw.len() >= MAX_ENTRY_CHARS {
            return;
        }
        if self.raw == "0" {
            self.raw.clear();
        } else if self.raw == "-0" {
            self.raw = "-".into();
        }
        self.raw.push(char::from(b'0' + digit));
    }

    fn push_dot(&mut self) {
        if self.raw.contains('.') || self.raw.len() >= MAX_ENTRY_CHARS {
            return;
        }
        if self.raw.is_empty() || self.raw == "-" {
            self.raw.push('0');
        }
        self.raw.push('.');
    }
}

#[derive(Debug, Clone)]
pub struct Engine {
    mode: Mode,
    tokens: Vec<Token>,
    entry: Option<Entry>,
    result: Option<Number>,
    expression: String,
    memory: Option<Number>,
    error: Option<ErrorInfo>,
    last_op: Option<(BinaryOp, Number)>,
    angle_unit: AngleUnit,
    radix: Radix,
    word_size: WordSize,
    replace_entry: bool,
    /// True when the current display is a unary result whose `sin(30)` style
    /// expression should survive an immediate `=`.
    unary_expression: bool,
    rng_state: u64,
}

impl Default for Engine {
    fn default() -> Self {
        Self::new(Mode::Basic)
    }
}

impl Engine {
    pub fn new(mode: Mode) -> Self {
        Self {
            mode,
            tokens: Vec::new(),
            entry: None,
            result: None,
            expression: String::new(),
            memory: None,
            error: None,
            last_op: None,
            angle_unit: AngleUnit::Deg,
            radix: Radix::Decimal,
            word_size: WordSize::Qword,
            replace_entry: false,
            unary_expression: false,
            rng_state: random_seed(),
        }
    }

    pub fn mode(&self) -> Mode {
        self.mode
    }

    pub fn apply(&mut self, command: CalcCommand) -> CalcView {
        if command.validate().is_err() {
            self.error = Some(ErrorInfo::new(ErrorCode::InvalidInput));
            return self.view();
        }

        self.error = None;
        let previous_unary_expression = self.unary_expression;
        self.unary_expression = false;
        let handled = match command {
            CalcCommand::Digit { digit } => self.digit(digit),
            CalcCommand::Dot => self.dot(),
            CalcCommand::Backspace => {
                self.backspace();
                Ok(())
            }
            CalcCommand::ClearAll => {
                self.clear_all();
                Ok(())
            }
            CalcCommand::ClearEntry => {
                if self.tokens.is_empty() {
                    self.entry = None;
                    self.result = None;
                    self.expression.clear();
                    self.last_op = None;
                } else {
                    // Keep the pending expression but show a fresh zero entry.
                    self.entry = Some(Entry::new("0"));
                    self.result = None;
                }
                self.replace_entry = false;
                Ok(())
            }
            CalcCommand::Unary { op } => self.unary(op),
            CalcCommand::Binary { op } => self.binary(op),
            CalcCommand::Equals => self.equals(previous_unary_expression),
            CalcCommand::Percent => self.percent(),
            CalcCommand::ToggleSign => {
                self.toggle_sign();
                Ok(())
            }
            CalcCommand::Memory { op } => self.memory(op),
            CalcCommand::SetAngleUnit { unit } => {
                self.angle_unit = unit;
                Ok(())
            }
            CalcCommand::SetRadix { radix } => {
                self.radix = radix;
                Ok(())
            }
            CalcCommand::SetWordSize { size } => {
                self.word_size = size;
                Ok(())
            }
            CalcCommand::OpenGroup => {
                self.open_group();
                Ok(())
            }
            CalcCommand::CloseGroup => {
                self.close_group();
                Ok(())
            }
            CalcCommand::Constant { id } => {
                self.constant(id);
                Ok(())
            }
            CalcCommand::ToggleBit { .. } => Err(ErrorInfo::new(ErrorCode::Unsupported)),
            CalcCommand::Random => {
                self.random();
                Ok(())
            }
            CalcCommand::SetExpression { text } => self.set_expression(&text),
            CalcCommand::Recall { expression, value } => self.recall(&expression, &value),
        };

        if let Err(err) = handled {
            self.error = Some(err);
            self.tokens.clear();
            self.entry = None;
            self.result = None;
            self.last_op = None;
            self.unary_expression = false;
        }
        self.view()
    }

    pub fn view(&self) -> CalcView {
        let value = match (&self.entry, self.result) {
            (Some(entry), _) => entry.raw.clone(),
            (None, Some(result)) => result.canonical(),
            (None, None) => String::new(),
        };
        let expression = if self.tokens.is_empty() {
            self.expression.clone()
        } else {
            parser::format_tokens(&self.tokens)
        };
        CalcView {
            mode: self.mode,
            expression,
            value,
            memory: self.memory.map(Number::canonical),
            programmer: None,
            error: self.error.clone(),
        }
    }

    fn digit(&mut self, digit: u8) -> CalcResult<()> {
        self.begin_entry_if_needed();
        if self.replace_entry {
            self.entry = Some(Entry::new(digit.to_string()));
            self.replace_entry = false;
        } else {
            self.entry
                .get_or_insert_with(|| Entry::new("0"))
                .push_digit(digit);
        }
        Ok(())
    }

    fn dot(&mut self) -> CalcResult<()> {
        self.begin_entry_if_needed();
        if self.replace_entry {
            self.entry = Some(Entry::new("0"));
            self.replace_entry = false;
        }
        self.entry.get_or_insert_with(|| Entry::new("0")).push_dot();
        Ok(())
    }

    fn begin_entry_if_needed(&mut self) {
        if self.entry.is_some() {
            return;
        }
        let completed = matches!(
            self.tokens.last(),
            Some(Token::Number(_) | Token::Percent | Token::CloseGroup)
        );
        if completed {
            self.tokens.clear();
            self.expression.clear();
            self.result = None;
            self.last_op = None;
        }
    }

    fn backspace(&mut self) {
        self.replace_entry = false;
        let mut emptied = false;
        if let Some(entry) = &mut self.entry {
            entry.raw.pop();
            emptied = entry.raw.is_empty() || entry.raw == "-";
        }
        if emptied {
            self.entry = None;
            return;
        }
        if self.entry.is_some() {
            return;
        }
        if let Some(Token::Number(n)) = self.tokens.pop() {
            self.result = Some(n);
        }
        if self.tokens.is_empty() {
            self.expression.clear();
        }
    }

    fn clear_all(&mut self) {
        self.tokens.clear();
        self.entry = None;
        self.result = None;
        self.expression.clear();
        self.last_op = None;
        self.replace_entry = false;
    }

    fn unary(&mut self, op: UnaryOp) -> CalcResult<()> {
        let input = self.current_value()?;
        let display = unary_name(op);
        let prefix = parser::format_tokens(&self.tokens);
        // Set the expression before evaluating so a domain error still shows
        // the attempted input (HANDOFF §4.7).
        self.expression = if prefix.is_empty() {
            format!("{display}({})", input.canonical())
        } else {
            format!("{prefix} {display}({})", input.canonical())
        };
        let computed = ops::apply_unary(op, input, self.mode, self.angle_unit)?;
        self.entry = Some(Entry::new(computed.canonical()));
        self.replace_entry = true;
        self.unary_expression = true;
        self.last_op = None;
        Ok(())
    }

    fn binary(&mut self, op: BinaryOp) -> CalcResult<()> {
        if let Some(entry) = &self.entry {
            let value = entry.number()?;
            self.tokens.push(Token::Number(value));
            self.result = Some(value);
        } else if self.tokens.is_empty() {
            let value = self.result.unwrap_or(Number::Decimal(Decimal::ZERO));
            self.tokens.push(Token::Number(value));
        } else if matches!(self.tokens.last(), Some(Token::OpenGroup)) {
            self.tokens
                .push(Token::Number(Number::Decimal(Decimal::ZERO)));
        }

        match self.tokens.last_mut() {
            Some(Token::Op(existing)) => *existing = op,
            Some(Token::Number(_) | Token::Percent | Token::CloseGroup) => {
                self.tokens.push(Token::Op(op))
            }
            _ => return Err(ErrorInfo::new(ErrorCode::Syntax)),
        }

        self.entry = None;
        self.replace_entry = false;
        self.last_op = None;
        Ok(())
    }

    fn equals(&mut self, keep_unary_expression: bool) -> CalcResult<()> {
        if self.tokens.is_empty() {
            if self.entry.is_none() {
                return self.repeat_equals();
            }
            let value = self.current_value()?;
            self.expression = if keep_unary_expression && !self.expression.is_empty() {
                format!("{} =", self.expression)
            } else {
                format!("{} =", value.canonical())
            };
            self.result = Some(value);
            self.entry = None;
            self.replace_entry = false;
            self.last_op = None;
            return Ok(());
        }

        let needs_rhs = matches!(self.tokens.last(), Some(Token::Op(_) | Token::OpenGroup));
        if let Some(entry) = &self.entry {
            let value = entry.number()?;
            self.tokens.push(Token::Number(value));
            self.result = Some(value);
        } else if needs_rhs {
            let value = self.result.unwrap_or(Number::Decimal(Decimal::ZERO));
            self.tokens.push(Token::Number(value));
        }

        let tokens = self.tokens.clone();
        self.expression = parser::format_tokens(&tokens);
        let expr = parser::parse_tokens(&tokens)?;
        let computed = ops::evaluate(&expr, self.mode)?;
        self.expression.push_str(" =");

        self.last_op = repeat_operand(&tokens);
        self.tokens.clear();
        self.entry = None;
        self.result = Some(computed);
        self.replace_entry = false;
        Ok(())
    }

    fn repeat_equals(&mut self) -> CalcResult<()> {
        let Some((op, rhs)) = self.last_op else {
            return Ok(());
        };
        let Some(lhs) = self.result else {
            return Ok(());
        };
        let computed = ops::evaluate_binary(op, lhs, rhs, self.mode)?;
        self.expression = format!(
            "{} {} {} =",
            lhs.canonical(),
            parser::symbol(op),
            rhs.canonical()
        );
        self.result = Some(computed);
        Ok(())
    }

    fn percent(&mut self) -> CalcResult<()> {
        let pct = self.current_value()?;
        let hundred = Number::Decimal(Decimal::ONE_HUNDRED);
        let computed = match self.tokens.last() {
            Some(Token::Op(op)) => {
                let prefix = &self.tokens[..self.tokens.len() - 1];
                let base = if prefix.is_empty() {
                    Number::Decimal(Decimal::ZERO)
                } else {
                    ops::evaluate(&parser::parse_tokens(prefix)?, self.mode)?
                };
                match op {
                    BinaryOp::Add | BinaryOp::Subtract => {
                        // Windows semantics: replace the entry with `base * pct / 100`
                        // so `50 + 10% =` evaluates to `50 + 5`.
                        let scaled =
                            ops::evaluate_binary(BinaryOp::Multiply, base, pct, self.mode)?;
                        ops::evaluate_binary(BinaryOp::Divide, scaled, hundred, self.mode)?
                    }
                    BinaryOp::Multiply | BinaryOp::Divide => {
                        ops::evaluate_binary(BinaryOp::Divide, pct, hundred, self.mode)?
                    }
                    _ => return Err(ErrorInfo::new(ErrorCode::Unsupported)),
                }
            }
            _ => ops::evaluate_binary(BinaryOp::Divide, pct, hundred, self.mode)?,
        };
        self.entry = Some(Entry::new(computed.canonical()));
        self.replace_entry = true;
        Ok(())
    }

    fn toggle_sign(&mut self) {
        if let Some(entry) = &mut self.entry {
            if entry.raw.starts_with('-') {
                entry.raw.remove(0);
            } else if entry.raw != "0" && entry.raw != "0." {
                entry.raw.insert(0, '-');
            }
            return;
        }
        if let Some(result) = self.result {
            self.result = Some(-result);
            self.last_op = None;
        }
    }

    fn memory(&mut self, op: MemoryOp) -> CalcResult<()> {
        match op {
            MemoryOp::Clear => self.memory = None,
            MemoryOp::Store => {
                self.memory = Some(self.current_value()?);
                self.replace_entry = true;
            }
            MemoryOp::Add | MemoryOp::Subtract => {
                let value = self.current_value()?;
                let base = self.memory.unwrap_or(Number::Decimal(Decimal::ZERO));
                let binary = if matches!(op, MemoryOp::Add) {
                    BinaryOp::Add
                } else {
                    BinaryOp::Subtract
                };
                self.memory = Some(ops::evaluate_binary(binary, base, value, self.mode)?);
                self.replace_entry = true;
            }
            MemoryOp::Recall => {
                let Some(memory) = self.memory else {
                    return Ok(());
                };
                self.begin_entry_if_needed();
                self.entry = Some(Entry::new(memory.canonical()));
                self.replace_entry = true;
            }
        }
        Ok(())
    }

    fn open_group(&mut self) {
        if let Some(entry) = &self.entry {
            if let Ok(value) = entry.number() {
                self.tokens.push(Token::Number(value));
            }
        }
        self.entry = None;
        self.replace_entry = false;
        if matches!(
            self.tokens.last(),
            Some(Token::Number(_) | Token::Percent | Token::CloseGroup)
        ) {
            self.tokens.push(Token::Op(BinaryOp::Multiply));
        }
        self.tokens.push(Token::OpenGroup);
        self.last_op = None;
    }

    fn close_group(&mut self) {
        let open = self
            .tokens
            .iter()
            .filter(|t| matches!(t, Token::OpenGroup))
            .count();
        let close = self
            .tokens
            .iter()
            .filter(|t| matches!(t, Token::CloseGroup))
            .count();
        if open <= close {
            return;
        }
        if let Some(entry) = &self.entry {
            if let Ok(value) = entry.number() {
                self.tokens.push(Token::Number(value));
            }
            self.entry = None;
            self.replace_entry = false;
        }
        self.tokens.push(Token::CloseGroup);
    }

    fn constant(&mut self, id: ConstantId) {
        self.begin_entry_if_needed();
        let raw = match id {
            ConstantId::Pi => PI,
            ConstantId::E => E,
        };
        self.entry = Some(Entry::new(raw));
        self.replace_entry = true;
    }

    fn set_expression(&mut self, text: &str) -> CalcResult<()> {
        let tokens = parser::tokenize(text)?;
        if let Some(Token::Number(n)) = tokens.first() {
            if tokens.len() == 1 {
                self.tokens.clear();
                self.expression.clear();
                self.result = None;
                self.entry = Some(Entry::new(n.canonical()));
                self.replace_entry = true;
                self.last_op = None;
                return Ok(());
            }
        }
        let expr = parser::parse_tokens(&tokens)?;
        let computed = ops::evaluate(&expr, self.mode)?;
        self.tokens = tokens;
        self.expression = parser::format_tokens(&self.tokens);
        self.entry = None;
        self.result = Some(computed);
        self.replace_entry = false;
        self.last_op = None;
        Ok(())
    }

    /// Restores a history entry without re-evaluating: the stored expression is
    /// display-only, the stored value becomes the current (replaceable) entry.
    fn recall(&mut self, expression: &str, value: &str) -> CalcResult<()> {
        let parsed = value::parse_number(value)?;
        self.tokens.clear();
        self.expression = expression.to_owned();
        self.entry = Some(Entry::new(parsed.canonical()));
        self.result = Some(parsed);
        self.replace_entry = true;
        self.last_op = None;
        Ok(())
    }

    fn current_value(&self) -> CalcResult<Number> {
        match &self.entry {
            Some(entry) => entry.number(),
            None => Ok(self.result.unwrap_or(Number::Decimal(Decimal::ZERO))),
        }
    }

    fn random(&mut self) {
        self.begin_entry_if_needed();
        let value = self.next_random();
        self.expression = "rand()".to_owned();
        self.entry = Some(Entry::new(value::canonical_float(value)));
        self.replace_entry = true;
        self.last_op = None;
    }

    /// xorshift64; seeded per session so repeated `rand` presses differ.
    fn next_random(&mut self) -> f64 {
        let mut state = self.rng_state;
        state ^= state << 13;
        state ^= state >> 7;
        state ^= state << 17;
        self.rng_state = state;
        (state >> 11) as f64 / (1u64 << 53) as f64
    }
}

fn random_seed() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_nanos() as u64)
        .unwrap_or(0x9E37_79B9_7F4A_7C15)
        | 1
}

fn repeat_operand(tokens: &[Token]) -> Option<(BinaryOp, Number)> {
    let (index, op) = tokens.iter().enumerate().rev().find_map(|(i, t)| match t {
        Token::Op(op) => Some((i, *op)),
        _ => None,
    })?;
    match tokens.get(index + 1) {
        Some(Token::Number(rhs)) => Some((op, *rhs)),
        _ => None,
    }
}

fn unary_name(op: UnaryOp) -> &'static str {
    match op {
        UnaryOp::Sqrt => "sqrt",
        UnaryOp::Square => "sqr",
        UnaryOp::Cube => "cube",
        UnaryOp::CubeRoot => "cbrt",
        UnaryOp::Reciprocal => "inv",
        UnaryOp::Factorial => "fact",
        UnaryOp::Sin => "sin",
        UnaryOp::Cos => "cos",
        UnaryOp::Tan => "tan",
        UnaryOp::Asin => "asin",
        UnaryOp::Acos => "acos",
        UnaryOp::Atan => "atan",
        UnaryOp::Sinh => "sinh",
        UnaryOp::Cosh => "cosh",
        UnaryOp::Tanh => "tanh",
        UnaryOp::Asinh => "asinh",
        UnaryOp::Acosh => "acosh",
        UnaryOp::Atanh => "atanh",
        UnaryOp::Ln => "ln",
        UnaryOp::Log10 => "log",
        UnaryOp::Log2 => "log2",
        UnaryOp::Exp => "exp",
        UnaryOp::Abs => "abs",
        UnaryOp::Floor => "floor",
        UnaryOp::Ceil => "ceil",
        UnaryOp::Round => "round",
    }
}
#[cfg(test)]
mod tests;
