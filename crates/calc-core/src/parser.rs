//! Tokenizer and precedence parser for calculator expressions.
//!
//! The parser is structural: it never evaluates, so arithmetic stays in
//! [`crate::ops`]. Precedence: unary sign < `^` < `* /` < `+ -`; `^` is
//! right-associative and `%` is a postfix divide-by-100.

use crate::command::BinaryOp;
use crate::error::{CalcResult, ErrorCode, ErrorInfo};
use crate::value::{self, Number};

#[derive(Debug, Clone, PartialEq)]
pub enum Token {
    Number(Number),
    Op(BinaryOp),
    Percent,
    OpenGroup,
    CloseGroup,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Expr {
    Number(Number),
    Negate(Box<Expr>),
    Percent(Box<Expr>),
    Binary(BinaryOp, Box<Expr>, Box<Expr>),
}

fn syntax() -> ErrorInfo {
    ErrorInfo::new(ErrorCode::Syntax)
}

pub fn tokenize(text: &str) -> CalcResult<Vec<Token>> {
    let normalized = value::normalize_input(text)?;
    let chars: Vec<char> = normalized.chars().collect();
    if chars.is_empty() {
        return Err(syntax());
    }

    let mut tokens = Vec::new();
    let mut i = 0;
    while i < chars.len() {
        let ch = chars[i];
        if ch.is_ascii_whitespace() {
            i += 1;
            continue;
        }
        if ch.is_ascii_digit() || ch == '.' {
            let start = i;
            while i < chars.len() && (chars[i].is_ascii_digit() || chars[i] == '.') {
                i += 1;
            }
            // Exponent notation (`1.5e3`) keeps pasted E-notation values intact.
            if i < chars.len() && matches!(chars[i], 'e' | 'E') {
                let mut end = i + 1;
                if end < chars.len() && matches!(chars[end], '+' | '-') {
                    end += 1;
                }
                let digits = end;
                while end < chars.len() && chars[end].is_ascii_digit() {
                    end += 1;
                }
                if end > digits {
                    i = end;
                }
            }
            let raw: String = chars[start..i].iter().collect();
            tokens.push(Token::Number(
                value::parse_number(&raw).map_err(|_| syntax())?,
            ));
            continue;
        }
        match ch {
            '(' => tokens.push(Token::OpenGroup),
            ')' => tokens.push(Token::CloseGroup),
            '%' => tokens.push(Token::Percent),
            '+' => tokens.push(Token::Op(BinaryOp::Add)),
            '-' => tokens.push(Token::Op(BinaryOp::Subtract)),
            '*' => tokens.push(Token::Op(BinaryOp::Multiply)),
            '/' => tokens.push(Token::Op(BinaryOp::Divide)),
            '^' => tokens.push(Token::Op(BinaryOp::Power)),
            _ => return Err(syntax()),
        }
        i += 1;
    }

    if tokens.is_empty() {
        return Err(syntax());
    }
    Ok(tokens)
}

pub fn parse_tokens(tokens: &[Token]) -> CalcResult<Expr> {
    let mut parser = Parser { tokens, pos: 0 };
    let expr = parser.parse_add_sub()?;
    if parser.pos != tokens.len() {
        return Err(syntax());
    }
    Ok(expr)
}

pub fn parse_text(text: &str) -> CalcResult<Expr> {
    parse_tokens(&tokenize(text)?)
}

pub fn format_tokens(tokens: &[Token]) -> String {
    let mut out = String::new();
    for (index, token) in tokens.iter().enumerate() {
        match token {
            Token::Number(n) => {
                if index > 0 && needs_space(tokens, index) {
                    out.push(' ');
                }
                out.push_str(&n.canonical());
            }
            Token::Op(op) => {
                if !out.is_empty() {
                    out.push(' ');
                }
                out.push_str(symbol(*op));
                out.push(' ');
            }
            Token::Percent => out.push('%'),
            Token::OpenGroup => out.push('('),
            Token::CloseGroup => out.push(')'),
        }
    }
    out.trim_end().to_string()
}

fn needs_space(tokens: &[Token], index: usize) -> bool {
    matches!(
        tokens.get(index - 1),
        Some(Token::CloseGroup | Token::Percent)
    )
}

pub fn symbol(op: BinaryOp) -> &'static str {
    match op {
        BinaryOp::Add => "+",
        BinaryOp::Subtract => "-",
        BinaryOp::Multiply => "*",
        BinaryOp::Divide => "/",
        BinaryOp::Power => "^",
        BinaryOp::Modulo => "MOD",
        BinaryOp::And => "AND",
        BinaryOp::Or => "OR",
        BinaryOp::Xor => "XOR",
        BinaryOp::LeftShift => "<<",
        BinaryOp::RightShift => ">>",
        BinaryOp::RotateLeft => "ROL",
        BinaryOp::RotateRight => "ROR",
    }
}

struct Parser<'a> {
    tokens: &'a [Token],
    pos: usize,
}

impl Parser<'_> {
    fn peek(&self) -> Option<&Token> {
        self.tokens.get(self.pos)
    }

    fn parse_add_sub(&mut self) -> CalcResult<Expr> {
        let mut lhs = self.parse_mul_div()?;
        while let Some(Token::Op(op @ (BinaryOp::Add | BinaryOp::Subtract))) = self.peek() {
            let op = *op;
            self.pos += 1;
            let rhs = self.parse_mul_div()?;
            lhs = Expr::Binary(op, Box::new(lhs), Box::new(rhs));
        }
        Ok(lhs)
    }

    fn parse_mul_div(&mut self) -> CalcResult<Expr> {
        let mut lhs = self.parse_unary()?;
        while let Some(Token::Op(op @ (BinaryOp::Multiply | BinaryOp::Divide | BinaryOp::Modulo))) =
            self.peek()
        {
            let op = *op;
            self.pos += 1;
            let rhs = self.parse_unary()?;
            lhs = Expr::Binary(op, Box::new(lhs), Box::new(rhs));
        }
        Ok(lhs)
    }

    fn parse_unary(&mut self) -> CalcResult<Expr> {
        match self.peek() {
            Some(Token::Op(BinaryOp::Add)) => {
                self.pos += 1;
                self.parse_unary()
            }
            Some(Token::Op(BinaryOp::Subtract)) => {
                self.pos += 1;
                Ok(Expr::Negate(Box::new(self.parse_unary()?)))
            }
            _ => self.parse_power(),
        }
    }

    fn parse_power(&mut self) -> CalcResult<Expr> {
        let lhs = self.parse_postfix()?;
        if let Some(Token::Op(BinaryOp::Power)) = self.peek() {
            self.pos += 1;
            let rhs = self.parse_unary()?;
            return Ok(Expr::Binary(BinaryOp::Power, Box::new(lhs), Box::new(rhs)));
        }
        Ok(lhs)
    }

    fn parse_postfix(&mut self) -> CalcResult<Expr> {
        let mut expr = self.parse_primary()?;
        while matches!(self.peek(), Some(Token::Percent)) {
            self.pos += 1;
            expr = Expr::Percent(Box::new(expr));
        }
        Ok(expr)
    }

    fn parse_primary(&mut self) -> CalcResult<Expr> {
        match self.peek() {
            Some(Token::Number(n)) => {
                let n = *n;
                self.pos += 1;
                Ok(Expr::Number(n))
            }
            Some(Token::OpenGroup) => {
                self.pos += 1;
                let expr = self.parse_add_sub()?;
                if !matches!(self.peek(), Some(Token::CloseGroup)) {
                    return Err(syntax());
                }
                self.pos += 1;
                Ok(expr)
            }
            _ => Err(syntax()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal::Decimal;
    use std::str::FromStr;

    fn d(raw: &str) -> Decimal {
        Decimal::from_str(raw).unwrap()
    }

    fn n(raw: &str) -> Number {
        Number::Decimal(d(raw))
    }

    #[test]
    fn tokenizes_ascii_expression() {
        let tokens = tokenize("1+2*3").unwrap();
        assert_eq!(
            tokens,
            vec![
                Token::Number(n("1")),
                Token::Op(BinaryOp::Add),
                Token::Number(n("2")),
                Token::Op(BinaryOp::Multiply),
                Token::Number(n("3")),
            ]
        );
    }

    #[test]
    fn tokenizes_exponent_notation() {
        let tokens = tokenize("1.5e3+2").unwrap();
        assert_eq!(tokens[0], Token::Number(n("1500")));
        assert_eq!(tokens[2], Token::Number(n("2")));
    }

    #[test]
    fn tokenizes_typographic_operators() {
        let tokens = tokenize("6 × 7 ÷ 2").unwrap();
        assert_eq!(tokens[1], Token::Op(BinaryOp::Multiply));
        assert_eq!(tokens[3], Token::Op(BinaryOp::Divide));
    }

    #[test]
    fn tokenizes_grouping_and_percent() {
        let tokens = tokenize("(50%)").unwrap();
        assert_eq!(tokens[0], Token::OpenGroup);
        assert_eq!(tokens[2], Token::Percent);
        assert_eq!(tokens[3], Token::CloseGroup);
    }

    #[test]
    fn rejects_unknown_characters() {
        assert_eq!(tokenize("1+abc").unwrap_err().code, ErrorCode::Syntax);
        assert_eq!(tokenize("").unwrap_err().code, ErrorCode::Syntax);
    }

    #[test]
    fn parser_applies_multiplication_precedence() {
        let expr = parse_text("2+3*4").unwrap();
        match expr {
            Expr::Binary(BinaryOp::Add, _, rhs) => {
                assert!(matches!(*rhs, Expr::Binary(BinaryOp::Multiply, _, _)));
            }
            other => panic!("unexpected shape: {other:?}"),
        }
    }

    #[test]
    fn parser_handles_parentheses() {
        let expr = parse_text("(2+3)*4").unwrap();
        match expr {
            Expr::Binary(BinaryOp::Multiply, lhs, _) => {
                assert!(matches!(*lhs, Expr::Binary(BinaryOp::Add, _, _)));
            }
            other => panic!("unexpected shape: {other:?}"),
        }
    }

    #[test]
    fn parser_treats_power_as_right_associative() {
        let expr = parse_text("2^3^2").unwrap();
        match expr {
            Expr::Binary(BinaryOp::Power, _, rhs) => {
                assert!(matches!(*rhs, Expr::Binary(BinaryOp::Power, _, _)));
            }
            other => panic!("unexpected shape: {other:?}"),
        }
    }

    #[test]
    fn parser_binds_sign_below_power() {
        // -2^2 => -(2^2)
        let expr = parse_text("-2^2").unwrap();
        assert!(matches!(expr, Expr::Negate(_)));
    }

    #[test]
    fn parser_accepts_signed_exponent() {
        let expr = parse_text("2^-3").unwrap();
        assert!(matches!(
            expr,
            Expr::Binary(BinaryOp::Power, _, ref rhs) if matches!(**rhs, Expr::Negate(_))
        ));
    }

    #[test]
    fn parser_treats_percent_as_postfix() {
        let expr = parse_text("50%").unwrap();
        assert!(matches!(expr, Expr::Percent(_)));
        let expr = parse_text("50%%").unwrap();
        assert!(matches!(expr, Expr::Percent(inner) if matches!(*inner, Expr::Percent(_))));
    }

    #[test]
    fn parser_rejects_unbalanced_parentheses() {
        assert_eq!(parse_text("(1+2").unwrap_err().code, ErrorCode::Syntax);
        assert_eq!(parse_text("1+2)").unwrap_err().code, ErrorCode::Syntax);
        assert_eq!(parse_text("()").unwrap_err().code, ErrorCode::Syntax);
    }

    #[test]
    fn parser_rejects_dangling_operator() {
        assert_eq!(parse_text("1+").unwrap_err().code, ErrorCode::Syntax);
        assert_eq!(parse_text("*2").unwrap_err().code, ErrorCode::Syntax);
    }

    #[test]
    fn formats_tokens_with_ascii_operators() {
        assert_eq!(format_tokens(&tokenize("2+3*4").unwrap()), "2 + 3 * 4");
        assert_eq!(format_tokens(&tokenize("(2+3)*4").unwrap()), "(2 + 3) * 4");
        assert_eq!(format_tokens(&tokenize("50%").unwrap()), "50%");
        assert_eq!(format_tokens(&tokenize("2^3").unwrap()), "2 ^ 3");
    }

    #[test]
    fn number_formatting_is_canonical() {
        assert_eq!(format_tokens(&tokenize("02.50+1").unwrap()), "2.5 + 1");
    }
}
