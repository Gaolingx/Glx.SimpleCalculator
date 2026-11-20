//! Programmer-mode session state machine.
//!
//! Kept separate from the Decimal/f64 engine: the input buffer holds digits in
//! the active radix, tokens carry sign-extended `i64` bit patterns, and every
//! projection re-renders from those values so switching radix never changes the
//! number.

use crate::command::{BinaryOp, CalcCommand, MemoryOp, UnaryOp};
use crate::error::{CalcResult, ErrorCode, ErrorInfo};
use crate::memory::MemoryStore;
use crate::mode::{Mode, Radix, WordSize};
use crate::ops::programmer as prog;
use crate::parser;
use crate::view::{CalcView, MemoryView};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Token {
    Number(i64),
    Op(BinaryOp),
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum Finished {
    /// Completed expression, rendered with a trailing `=`.
    Expression(Vec<Token>),
    /// Unary result; `evaluated` is set by the following `=`.
    Not { arg: i64, evaluated: bool },
    /// A single value left by `=`.
    Plain(i64),
    /// Display-only text (history restore or a failed expression).
    Raw(String),
}

#[derive(Debug, Clone)]
pub(crate) struct ProgrammerSession {
    radix: Radix,
    word_size: WordSize,
    /// Digits typed in the active radix, uppercase; `-` is a lone sign.
    entry: Option<String>,
    tokens: Vec<Token>,
    result: Option<i64>,
    finished: Option<Finished>,
    memory: MemoryStore<i64>,
    last_op: Option<(BinaryOp, i64)>,
    replace_entry: bool,
    error: Option<ErrorInfo>,
}

impl Default for ProgrammerSession {
    fn default() -> Self {
        Self {
            radix: Radix::Decimal,
            word_size: WordSize::Qword,
            entry: None,
            tokens: Vec::new(),
            result: None,
            finished: None,
            memory: MemoryStore::default(),
            last_op: None,
            replace_entry: false,
            error: None,
        }
    }
}

impl ProgrammerSession {
    pub fn apply(&mut self, command: CalcCommand) -> CalcView {
        if command.validate().is_err() {
            self.error = Some(ErrorInfo::new(ErrorCode::InvalidInput));
            return self.view();
        }

        self.error = None;
        let handled = match command {
            CalcCommand::Digit { digit } => self.digit(digit),
            // Programmer values are integers; the dot key is disabled in the
            // UI (T10) and ignored here.
            CalcCommand::Dot => Ok(()),
            CalcCommand::Backspace => {
                self.backspace();
                Ok(())
            }
            CalcCommand::ClearAll => {
                self.clear_all();
                Ok(())
            }
            CalcCommand::ClearEntry => {
                self.clear_entry();
                Ok(())
            }
            CalcCommand::Unary { op } => self.unary(op),
            CalcCommand::Binary { op } => self.binary(op),
            CalcCommand::Equals => self.equals(),
            CalcCommand::ToggleSign => {
                self.toggle_sign();
                Ok(())
            }
            CalcCommand::Memory { op, id } => self.memory(op, id.as_deref()),
            CalcCommand::SetRadix { radix } => {
                self.set_radix(radix);
                Ok(())
            }
            CalcCommand::SetWordSize { size } => {
                self.set_word_size(size);
                Ok(())
            }
            CalcCommand::ToggleBit { bit } => self.toggle_bit(bit),
            CalcCommand::SetExpression { text } => self.set_expression(&text),
            CalcCommand::Recall { expression, value } => self.recall(&expression, &value),
            CalcCommand::Percent
            | CalcCommand::SetAngleUnit { .. }
            | CalcCommand::OpenGroup
            | CalcCommand::CloseGroup
            | CalcCommand::Constant { .. }
            | CalcCommand::Random
            | CalcCommand::StatsAdd { .. }
            | CalcCommand::StatsUpdate { .. }
            | CalcCommand::StatsRemove { .. }
            | CalcCommand::StatsClear
            | CalcCommand::StatsCompute { .. } => Err(ErrorInfo::new(ErrorCode::Unsupported)),
        };

        if let Err(err) = handled {
            if !self.tokens.is_empty() {
                let tokens = std::mem::take(&mut self.tokens);
                self.finished = Some(Finished::Raw(format_tokens(
                    &tokens,
                    self.radix,
                    self.word_size,
                )));
            }
            self.error = Some(err);
            self.entry = None;
            self.result = None;
            self.last_op = None;
            self.replace_entry = false;
        }
        self.view()
    }

    pub fn view(&self) -> CalcView {
        let current = if self.entry.is_some() {
            self.parse_entry().ok()
        } else {
            self.result
        };
        let value = match &self.entry {
            Some(entry) if entry == "-" => entry.clone(),
            Some(entry) => prog::parse(entry, self.radix, self.word_size)
                .map(|value| prog::format(value, self.radix, self.word_size))
                .unwrap_or_else(|_| entry.clone()),
            None => self
                .result
                .map(|result| prog::format(result, self.radix, self.word_size))
                .unwrap_or_default(),
        };
        CalcView {
            mode: Mode::Programmer,
            expression: self.expression(),
            value,
            memories: self
                .memory
                .entries()
                .iter()
                .map(|entry| MemoryView {
                    id: entry.id.to_string(),
                    value: prog::format(entry.value, self.radix, self.word_size),
                })
                .collect(),
            programmer: Some(prog::view(current, self.radix, self.word_size)),
            statistics: None,
            error: self.error.clone(),
        }
    }

    fn digit(&mut self, digit: u8) -> CalcResult<()> {
        if u32::from(digit) >= u32::from(self.radix.base()) {
            // Invalid for the active radix: block the key without an error.
            return Ok(());
        }
        let Some(ch) = prog::digit_char(digit) else {
            return Ok(());
        };

        self.begin_entry_if_needed();
        if self.replace_entry {
            self.entry = Some(ch.to_string());
            self.replace_entry = false;
            if self.tokens.is_empty() {
                self.finished = None;
                self.result = None;
                self.last_op = None;
            }
            return Ok(());
        }

        let raw = self.entry.get_or_insert_with(|| "0".to_owned());
        if raw == "0" {
            raw.clear();
        } else if raw == "-0" {
            *raw = "-".to_owned();
        }
        if raw.trim_start_matches('-').chars().count()
            >= prog::max_digits(self.radix, self.word_size)
        {
            return Ok(());
        }
        raw.push(ch);
        Ok(())
    }

    fn begin_entry_if_needed(&mut self) {
        if self.entry.is_some() {
            return;
        }
        if matches!(self.tokens.last(), Some(Token::Number(_))) {
            self.tokens.clear();
            self.finished = None;
            self.result = None;
            self.last_op = None;
        }
    }

    fn backspace(&mut self) {
        self.replace_entry = false;
        let mut emptied = false;
        if let Some(entry) = &mut self.entry {
            entry.pop();
            emptied = entry.is_empty() || entry == "-";
        }
        if emptied {
            self.entry = None;
            return;
        }
        if self.entry.is_some() {
            return;
        }
        if let Some(Token::Number(value)) = self.tokens.pop() {
            self.result = Some(value);
        }
        if self.tokens.is_empty() {
            self.finished = None;
        }
    }

    fn clear_all(&mut self) {
        self.tokens.clear();
        self.entry = None;
        self.result = None;
        self.finished = None;
        self.last_op = None;
        self.replace_entry = false;
    }

    fn clear_entry(&mut self) {
        if self.tokens.is_empty() {
            self.entry = None;
            self.result = None;
            self.finished = None;
            self.last_op = None;
        } else {
            self.entry = Some("0".to_owned());
            self.result = None;
        }
        self.replace_entry = false;
    }

    fn unary(&mut self, op: UnaryOp) -> CalcResult<()> {
        if op != UnaryOp::Not {
            return Err(ErrorInfo::new(ErrorCode::Unsupported));
        }
        let input = self.current_value()?;
        let computed = prog::not(input, self.word_size);
        self.finished = if self.tokens.is_empty() {
            Some(Finished::Not {
                arg: input,
                evaluated: false,
            })
        } else {
            None
        };
        self.entry = Some(prog::format(computed, self.radix, self.word_size));
        self.replace_entry = true;
        self.last_op = None;
        Ok(())
    }

    fn binary(&mut self, op: BinaryOp) -> CalcResult<()> {
        if matches!(op, BinaryOp::Power) {
            return Err(ErrorInfo::new(ErrorCode::Unsupported));
        }

        if self.entry.is_some() {
            let value = self.parse_entry()?;
            self.tokens.push(Token::Number(value));
            self.result = Some(value);
        } else if self.tokens.is_empty() {
            let value = self.result.unwrap_or(0);
            self.tokens.push(Token::Number(value));
        }

        match self.tokens.last_mut() {
            Some(Token::Op(existing)) => *existing = op,
            Some(Token::Number(_)) => self.tokens.push(Token::Op(op)),
            None => return Err(ErrorInfo::new(ErrorCode::Syntax)),
        }

        self.entry = None;
        self.replace_entry = false;
        self.finished = None;
        self.last_op = None;
        Ok(())
    }

    fn equals(&mut self) -> CalcResult<()> {
        if self.tokens.is_empty() {
            if self.entry.is_none() {
                if self.result.is_none() {
                    return Ok(());
                }
                return self.repeat_equals();
            }

            let value = self.parse_entry()?;
            self.finished = match self.finished {
                Some(Finished::Not { arg, .. }) => Some(Finished::Not {
                    arg,
                    evaluated: true,
                }),
                _ => Some(Finished::Plain(value)),
            };
            self.result = Some(value);
            self.entry = None;
            self.replace_entry = false;
            self.last_op = None;
            return Ok(());
        }

        let needs_rhs = matches!(self.tokens.last(), Some(Token::Op(_)));
        if self.entry.is_some() {
            let value = self.parse_entry()?;
            self.tokens.push(Token::Number(value));
            self.result = Some(value);
        } else if needs_rhs {
            let value = self.result.unwrap_or(0);
            self.tokens.push(Token::Number(value));
        }

        let tokens = self.tokens.clone();
        let computed = evaluate_tokens(&tokens, self.word_size)?;
        self.last_op = repeat_operand(&tokens);
        self.finished = Some(Finished::Expression(tokens));
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
        self.finished = Some(Finished::Expression(vec![
            Token::Number(lhs),
            Token::Op(op),
            Token::Number(rhs),
        ]));
        self.result = Some(prog::apply_binary(op, lhs, rhs, self.word_size)?);
        Ok(())
    }

    fn toggle_sign(&mut self) {
        if let Some(entry) = &mut self.entry {
            if let Some(rest) = entry.strip_prefix('-') {
                *entry = rest.to_owned();
            } else if entry != "0" {
                entry.insert(0, '-');
            }
            return;
        }
        if let Some(result) = self.result {
            self.result = Some(prog::normalize(result.wrapping_neg(), self.word_size));
            self.last_op = None;
        }
    }

    fn memory(&mut self, op: MemoryOp, id: Option<&str>) -> CalcResult<()> {
        let target = match id {
            Some(raw) => Some(
                raw.parse::<u64>()
                    .map_err(|_| ErrorInfo::new(ErrorCode::InvalidInput))?,
            ),
            None => None,
        };
        match op {
            MemoryOp::Clear => self.memory.remove(target),
            MemoryOp::Store => {
                self.memory.store(self.current_value()?);
                self.replace_entry = true;
            }
            MemoryOp::Add | MemoryOp::Subtract => {
                let value = self.current_value()?;
                let operation = if matches!(op, MemoryOp::Add) {
                    BinaryOp::Add
                } else {
                    BinaryOp::Subtract
                };
                if let Some(index) = self.memory.index_of(target) {
                    let base = *self.memory.value(index);
                    let updated = prog::apply_binary(operation, base, value, self.word_size)?;
                    *self.memory.value_mut(index) = updated;
                } else if target.is_some() {
                    return Err(ErrorInfo::new(ErrorCode::InvalidInput));
                } else {
                    let updated = prog::apply_binary(operation, 0, value, self.word_size)?;
                    self.memory.store(updated);
                }
                self.replace_entry = true;
            }
            MemoryOp::Recall => {
                let Some(index) = self.memory.index_of(target) else {
                    if target.is_some() {
                        return Err(ErrorInfo::new(ErrorCode::InvalidInput));
                    }
                    return Ok(());
                };
                let memory = *self.memory.value(index);
                self.begin_entry_if_needed();
                self.entry = Some(prog::format(memory, self.radix, self.word_size));
                self.replace_entry = true;
            }
        }
        Ok(())
    }

    fn set_radix(&mut self, radix: Radix) {
        if radix == self.radix {
            return;
        }
        if let Some(entry) = self.entry.clone() {
            self.entry = prog::parse(&entry, self.radix, self.word_size)
                .ok()
                .map(|value| prog::format(value, radix, self.word_size));
        }
        self.radix = radix;
    }

    fn set_word_size(&mut self, size: WordSize) {
        if size == self.word_size {
            return;
        }
        if let Some(entry) = self.entry.clone() {
            if let Ok(value) = prog::parse(&entry, self.radix, self.word_size) {
                self.entry = Some(prog::format(value, self.radix, size));
            }
        }
        for token in &mut self.tokens {
            if let Token::Number(value) = token {
                *value = prog::normalize(*value, size);
            }
        }
        self.result = self.result.map(|value| prog::normalize(value, size));
        for value in self.memory.values_mut() {
            *value = prog::normalize(*value, size);
        }
        if let Some((_, rhs)) = &mut self.last_op {
            *rhs = prog::normalize(*rhs, size);
        }
        self.word_size = size;
    }

    fn toggle_bit(&mut self, bit: u8) -> CalcResult<()> {
        let value = self.current_value()?;
        let toggled = prog::toggle_bit(value, bit, self.word_size)?;
        self.entry = Some(prog::format(toggled, self.radix, self.word_size));
        self.replace_entry = true;
        self.last_op = None;
        if self.tokens.is_empty() {
            self.finished = None;
        }
        Ok(())
    }

    fn set_expression(&mut self, text: &str) -> CalcResult<()> {
        let value = prog::parse(text, self.radix, self.word_size)?;
        self.tokens.clear();
        self.finished = None;
        self.entry = Some(prog::format(value, self.radix, self.word_size));
        self.result = Some(value);
        self.replace_entry = true;
        self.last_op = None;
        Ok(())
    }

    fn recall(&mut self, expression: &str, value: &str) -> CalcResult<()> {
        let parsed = self.parse_history_value(value)?;
        self.tokens.clear();
        self.finished = Some(Finished::Raw(expression.to_owned()));
        self.entry = Some(prog::format(parsed, self.radix, self.word_size));
        self.result = Some(parsed);
        self.replace_entry = true;
        self.last_op = None;
        Ok(())
    }

    /// History values are stored in the radix active at the time, so try the
    /// common projections before giving up.
    fn parse_history_value(&self, value: &str) -> CalcResult<i64> {
        let mut failure = None;
        for radix in [
            self.radix,
            Radix::Decimal,
            Radix::Hexadecimal,
            Radix::Binary,
            Radix::Octal,
        ] {
            match prog::parse(value, radix, self.word_size) {
                Ok(parsed) => return Ok(parsed),
                Err(error) => {
                    failure.get_or_insert(error);
                }
            }
        }
        Err(failure.unwrap_or_else(|| ErrorInfo::new(ErrorCode::InvalidInput)))
    }

    fn current_value(&self) -> CalcResult<i64> {
        if self.entry.is_some() {
            self.parse_entry()
        } else {
            Ok(self.result.unwrap_or(0))
        }
    }

    fn parse_entry(&self) -> CalcResult<i64> {
        match &self.entry {
            Some(entry) if entry != "-" => prog::parse(entry, self.radix, self.word_size),
            _ => Ok(0),
        }
    }

    fn expression(&self) -> String {
        if let Some(Finished::Not { arg, evaluated }) = &self.finished {
            let text = format!("NOT({})", prog::format(*arg, self.radix, self.word_size));
            return if *evaluated {
                format!("{text} =")
            } else {
                text
            };
        }
        if !self.tokens.is_empty() {
            return format_tokens(&self.tokens, self.radix, self.word_size);
        }
        match &self.finished {
            Some(Finished::Expression(tokens)) => {
                format!("{} =", format_tokens(tokens, self.radix, self.word_size))
            }
            Some(Finished::Plain(value)) => {
                format!("{} =", prog::format(*value, self.radix, self.word_size))
            }
            Some(Finished::Raw(text)) => text.clone(),
            Some(Finished::Not { .. }) | None => String::new(),
        }
    }
}

fn format_tokens(tokens: &[Token], radix: Radix, size: WordSize) -> String {
    let parts: Vec<String> = tokens
        .iter()
        .map(|token| match token {
            Token::Number(value) => prog::format(*value, radix, size),
            Token::Op(op) => parser::symbol(*op).to_owned(),
        })
        .collect();
    parts.join(" ")
}

fn repeat_operand(tokens: &[Token]) -> Option<(BinaryOp, i64)> {
    let (index, op) = tokens
        .iter()
        .enumerate()
        .rev()
        .find_map(|(i, token)| match token {
            Token::Op(op) => Some((i, *op)),
            _ => None,
        })?;
    match tokens.get(index + 1) {
        Some(Token::Number(rhs)) => Some((op, *rhs)),
        _ => None,
    }
}

fn evaluate_tokens(tokens: &[Token], size: WordSize) -> CalcResult<i64> {
    if tokens.is_empty() {
        return Err(ErrorInfo::new(ErrorCode::Syntax));
    }
    let mut evaluator = Evaluator {
        tokens,
        pos: 0,
        size,
    };
    let value = evaluator.parse_or()?;
    if evaluator.pos != tokens.len() {
        return Err(ErrorInfo::new(ErrorCode::Syntax));
    }
    Ok(value)
}

/// Precedence, lowest first: OR, XOR, AND, shifts, `+ -`, `* / MOD`.
struct Evaluator<'a> {
    tokens: &'a [Token],
    pos: usize,
    size: WordSize,
}

impl Evaluator<'_> {
    fn peek(&self) -> Option<Token> {
        self.tokens.get(self.pos).copied()
    }

    fn parse_or(&mut self) -> CalcResult<i64> {
        let mut lhs = self.parse_xor()?;
        while matches!(self.peek(), Some(Token::Op(BinaryOp::Or))) {
            self.pos += 1;
            let rhs = self.parse_xor()?;
            lhs = prog::apply_binary(BinaryOp::Or, lhs, rhs, self.size)?;
        }
        Ok(lhs)
    }

    fn parse_xor(&mut self) -> CalcResult<i64> {
        let mut lhs = self.parse_and()?;
        while matches!(self.peek(), Some(Token::Op(BinaryOp::Xor))) {
            self.pos += 1;
            let rhs = self.parse_and()?;
            lhs = prog::apply_binary(BinaryOp::Xor, lhs, rhs, self.size)?;
        }
        Ok(lhs)
    }

    fn parse_and(&mut self) -> CalcResult<i64> {
        let mut lhs = self.parse_shift()?;
        while matches!(self.peek(), Some(Token::Op(BinaryOp::And))) {
            self.pos += 1;
            let rhs = self.parse_shift()?;
            lhs = prog::apply_binary(BinaryOp::And, lhs, rhs, self.size)?;
        }
        Ok(lhs)
    }

    fn parse_shift(&mut self) -> CalcResult<i64> {
        let mut lhs = self.parse_add_sub()?;
        while let Some(Token::Op(
            op @ (BinaryOp::LeftShift
            | BinaryOp::RightShift
            | BinaryOp::RotateLeft
            | BinaryOp::RotateRight),
        )) = self.peek()
        {
            self.pos += 1;
            let rhs = self.parse_add_sub()?;
            lhs = prog::apply_binary(op, lhs, rhs, self.size)?;
        }
        Ok(lhs)
    }

    fn parse_add_sub(&mut self) -> CalcResult<i64> {
        let mut lhs = self.parse_mul_div()?;
        while let Some(Token::Op(op @ (BinaryOp::Add | BinaryOp::Subtract))) = self.peek() {
            self.pos += 1;
            let rhs = self.parse_mul_div()?;
            lhs = prog::apply_binary(op, lhs, rhs, self.size)?;
        }
        Ok(lhs)
    }

    fn parse_mul_div(&mut self) -> CalcResult<i64> {
        let mut lhs = self.parse_primary()?;
        while let Some(Token::Op(op @ (BinaryOp::Multiply | BinaryOp::Divide | BinaryOp::Modulo))) =
            self.peek()
        {
            self.pos += 1;
            let rhs = self.parse_primary()?;
            lhs = prog::apply_binary(op, lhs, rhs, self.size)?;
        }
        Ok(lhs)
    }

    fn parse_primary(&mut self) -> CalcResult<i64> {
        match self.peek() {
            Some(Token::Number(value)) => {
                self.pos += 1;
                Ok(value)
            }
            _ => Err(ErrorInfo::new(ErrorCode::Syntax)),
        }
    }
}
