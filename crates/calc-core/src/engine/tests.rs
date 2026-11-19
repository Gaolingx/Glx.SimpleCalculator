use super::*;

fn type_text(engine: &mut Engine, text: &str) {
    for ch in text.chars() {
        match ch {
            '0'..='9' => {
                engine.apply(CalcCommand::Digit {
                    digit: ch as u8 - b'0',
                });
            }
            '.' => {
                engine.apply(CalcCommand::Dot);
            }
            _ => panic!("unsupported test character: {ch}"),
        }
    }
}

fn type_digit(engine: &mut Engine, digit: u8) -> CalcView {
    engine.apply(CalcCommand::Digit { digit })
}

fn binary(engine: &mut Engine, op: BinaryOp) -> CalcView {
    engine.apply(CalcCommand::Binary { op })
}

fn unary(engine: &mut Engine, op: UnaryOp) -> CalcView {
    engine.apply(CalcCommand::Unary { op })
}

fn press_equals(engine: &mut Engine) -> CalcView {
    engine.apply(CalcCommand::Equals)
}

fn assert_sequence_is_14(commands: &str) {
    let mut engine = Engine::default();
    let mut value = String::new();
    for ch in commands.chars() {
        value = match ch {
            '0'..='9' | '.' => {
                type_text(&mut engine, &ch.to_string());
                engine.view().value
            }
            '+' => binary(&mut engine, BinaryOp::Add).value,
            '-' => binary(&mut engine, BinaryOp::Subtract).value,
            '*' => binary(&mut engine, BinaryOp::Multiply).value,
            '/' => binary(&mut engine, BinaryOp::Divide).value,
            '=' => press_equals(&mut engine).value,
            _ => panic!("unsupported sequence char: {ch}"),
        };
    }
    assert_eq!(value, "14");
}

#[test]
fn initial_view_is_empty() {
    let view = Engine::default().view();
    assert_eq!(view.mode, Mode::Basic);
    assert_eq!(view.value, "");
    assert_eq!(view.expression, "");
    assert_eq!(view.memory, None);
    assert_eq!(view.error, None);
}

#[test]
fn digits_start_an_entry() {
    let mut engine = Engine::default();
    type_text(&mut engine, "123");
    assert_eq!(engine.view().value, "123");
}

#[test]
fn leading_zeros_collapse() {
    let mut engine = Engine::default();
    type_text(&mut engine, "007");
    assert_eq!(engine.view().value, "7");
}

#[test]
fn extra_dots_are_ignored() {
    let mut engine = Engine::default();
    type_text(&mut engine, "1.2.3");
    assert_eq!(engine.view().value, "1.23");
}

#[test]
fn dot_alone_builds_zero_prefix() {
    let mut engine = Engine::default();
    engine.apply(CalcCommand::Dot);
    type_text(&mut engine, "5");
    assert_eq!(engine.view().value, "0.5");
}

#[test]
fn backspace_removes_digits() {
    let mut engine = Engine::default();
    type_text(&mut engine, "12");
    let view = engine.apply(CalcCommand::Backspace);
    assert_eq!(view.value, "1");
    let view = engine.apply(CalcCommand::Backspace);
    assert_eq!(view.value, "");
}

#[test]
fn backspace_removes_operator() {
    let mut engine = Engine::default();
    type_text(&mut engine, "2");
    binary(&mut engine, BinaryOp::Add);
    let view = engine.apply(CalcCommand::Backspace);
    assert_eq!(view.expression, "2");
    assert_eq!(view.value, "2");
}

#[test]
fn clear_entry_drops_current_entry() {
    let mut engine = Engine::default();
    type_text(&mut engine, "12");
    let view = engine.apply(CalcCommand::ClearEntry);
    assert_eq!(view.value, "");
    type_text(&mut engine, "5");
    assert_eq!(engine.view().value, "5");
}

#[test]
fn clear_entry_keeps_the_pending_expression() {
    let mut engine = Engine::default();
    type_text(&mut engine, "2");
    binary(&mut engine, BinaryOp::Add);
    type_text(&mut engine, "3");

    let view = engine.apply(CalcCommand::ClearEntry);
    assert_eq!(view.expression, "2 +");
    assert_eq!(view.value, "0");

    type_text(&mut engine, "4");
    let view = engine.apply(CalcCommand::Equals);
    assert_eq!(view.expression, "2 + 4 =");
    assert_eq!(view.value, "6");
}

#[test]
fn clear_entry_after_equals_clears_the_result() {
    let mut engine = Engine::default();
    type_text(&mut engine, "4");
    binary(&mut engine, BinaryOp::Multiply);
    type_text(&mut engine, "5");
    engine.apply(CalcCommand::Equals);

    let view = engine.apply(CalcCommand::ClearEntry);
    assert_eq!(view.value, "");
    assert_eq!(view.expression, "");
}

#[test]
fn clear_all_resets_session_but_keeps_memory() {
    let mut engine = Engine::default();
    type_text(&mut engine, "5");
    engine.apply(CalcCommand::Memory {
        op: MemoryOp::Store,
    });
    type_text(&mut engine, "3");
    binary(&mut engine, BinaryOp::Add);
    let view = engine.apply(CalcCommand::ClearAll);
    assert_eq!(view.value, "");
    assert_eq!(view.expression, "");
    assert_eq!(view.memory.as_deref(), Some("5"));
}

#[test]
fn multiplication_binds_tighter_than_addition() {
    assert_sequence_is_14("2+3*4=");
}

#[test]
fn parentheses_group_operations() {
    let mut engine = Engine::default();
    engine.apply(CalcCommand::OpenGroup);
    type_text(&mut engine, "2");
    binary(&mut engine, BinaryOp::Add);
    type_text(&mut engine, "3");
    engine.apply(CalcCommand::CloseGroup);
    binary(&mut engine, BinaryOp::Multiply);
    type_text(&mut engine, "4");
    let view = press_equals(&mut engine);
    assert_eq!(view.value, "20");
    assert_eq!(view.error, None);
}

#[test]
fn equals_evaluates_a_plain_number() {
    let mut engine = Engine::default();
    type_text(&mut engine, "42");
    let view = press_equals(&mut engine);
    assert_eq!(view.value, "42");
    assert_eq!(view.expression, "42 =");
}

#[test]
fn equals_after_operator_reuses_left_operand() {
    let mut engine = Engine::default();
    type_text(&mut engine, "2");
    binary(&mut engine, BinaryOp::Add);
    let view = press_equals(&mut engine);
    assert_eq!(view.value, "4");
}

#[test]
fn repeated_equals_repeats_last_operation() {
    let mut engine = Engine::default();
    type_text(&mut engine, "2");
    binary(&mut engine, BinaryOp::Add);
    type_text(&mut engine, "3");
    assert_eq!(press_equals(&mut engine).value, "5");
    assert_eq!(press_equals(&mut engine).value, "8");
    assert_eq!(press_equals(&mut engine).value, "11");
}

#[test]
fn decimal_arithmetic_is_exact() {
    let mut engine = Engine::default();
    type_text(&mut engine, "0.1");
    binary(&mut engine, BinaryOp::Add);
    type_text(&mut engine, "0.2");
    assert_eq!(press_equals(&mut engine).value, "0.3");
}

#[test]
fn division_by_zero_sets_stable_error() {
    let mut engine = Engine::default();
    type_text(&mut engine, "1");
    binary(&mut engine, BinaryOp::Divide);
    type_text(&mut engine, "0");
    let view = press_equals(&mut engine);
    assert_eq!(view.value, "");
    assert_eq!(view.error.unwrap().code, ErrorCode::DivideByZero);
    assert_eq!(view.expression, "1 / 0");
}

#[test]
fn digit_after_error_starts_fresh() {
    let mut engine = Engine::default();
    type_text(&mut engine, "1");
    binary(&mut engine, BinaryOp::Divide);
    type_text(&mut engine, "0");
    press_equals(&mut engine);
    let view = type_digit(&mut engine, 7);
    assert_eq!(view.error, None);
    assert_eq!(view.value, "7");
}

#[test]
fn operator_after_error_clears_it() {
    let mut engine = Engine::default();
    type_text(&mut engine, "1");
    binary(&mut engine, BinaryOp::Divide);
    type_text(&mut engine, "0");
    press_equals(&mut engine);
    let view = binary(&mut engine, BinaryOp::Add);
    assert_eq!(view.error, None);
    assert_eq!(view.expression, "0 +");
}

#[test]
fn percent_alone_converts_to_fraction() {
    let mut engine = Engine::default();
    type_text(&mut engine, "50");
    let view = engine.apply(CalcCommand::Percent);
    assert_eq!(view.value, "0.5");
}

#[test]
fn percent_add_is_relative_to_base() {
    let mut engine = Engine::default();
    type_text(&mut engine, "50");
    binary(&mut engine, BinaryOp::Add);
    type_text(&mut engine, "10");
    engine.apply(CalcCommand::Percent);
    assert_eq!(press_equals(&mut engine).value, "55");
}

#[test]
fn percent_multiply_is_a_fraction() {
    let mut engine = Engine::default();
    type_text(&mut engine, "200");
    binary(&mut engine, BinaryOp::Multiply);
    type_text(&mut engine, "10");
    engine.apply(CalcCommand::Percent);
    assert_eq!(press_equals(&mut engine).value, "20");
}

#[test]
fn toggle_sign_flips_typed_entry() {
    let mut engine = Engine::default();
    type_text(&mut engine, "5");
    assert_eq!(engine.apply(CalcCommand::ToggleSign).value, "-5");
    assert_eq!(engine.apply(CalcCommand::ToggleSign).value, "5");
}

#[test]
fn toggle_sign_flips_result() {
    let mut engine = Engine::default();
    type_text(&mut engine, "2");
    binary(&mut engine, BinaryOp::Add);
    type_text(&mut engine, "3");
    press_equals(&mut engine);
    assert_eq!(engine.apply(CalcCommand::ToggleSign).value, "-5");
}

#[test]
fn memory_store_and_recall_round_trip() {
    let mut engine = Engine::default();
    type_text(&mut engine, "5");
    engine.apply(CalcCommand::Memory {
        op: MemoryOp::Store,
    });
    engine.apply(CalcCommand::ClearAll);
    let view = engine.apply(CalcCommand::Memory {
        op: MemoryOp::Recall,
    });
    assert_eq!(view.value, "5");
    assert_eq!(view.memory.as_deref(), Some("5"));
}

#[test]
fn memory_accumulates_with_add_and_subtract() {
    let mut engine = Engine::default();
    type_text(&mut engine, "5");
    engine.apply(CalcCommand::Memory { op: MemoryOp::Add });
    type_text(&mut engine, "2");
    engine.apply(CalcCommand::Memory {
        op: MemoryOp::Subtract,
    });
    assert_eq!(engine.view().memory.as_deref(), Some("3"));
}

#[test]
fn memory_clear_removes_value() {
    let mut engine = Engine::default();
    type_text(&mut engine, "5");
    engine.apply(CalcCommand::Memory {
        op: MemoryOp::Store,
    });
    let view = engine.apply(CalcCommand::Memory {
        op: MemoryOp::Clear,
    });
    assert_eq!(view.memory, None);
}

#[test]
fn sqrt_is_a_postfix_operation() {
    let mut engine = Engine::default();
    type_text(&mut engine, "9");
    let view = unary(&mut engine, UnaryOp::Sqrt);
    assert_eq!(view.value, "3");
    assert_eq!(view.expression, "sqrt(9)");
    assert_eq!(view.error, None);
}

#[test]
fn sqrt_of_negative_reports_domain_error() {
    let mut engine = Engine::default();
    type_text(&mut engine, "1");
    engine.apply(CalcCommand::ToggleSign);
    let view = unary(&mut engine, UnaryOp::Sqrt);
    assert_eq!(view.error.unwrap().code, ErrorCode::DomainError);
}

#[test]
fn unimplemented_scientific_key_reports_unsupported() {
    let mut engine = Engine::default();
    type_text(&mut engine, "0");
    let view = unary(&mut engine, UnaryOp::Sin);
    assert_eq!(view.error.unwrap().code, ErrorCode::Unsupported);
}

#[test]
fn expression_line_uses_ascii_operators() {
    let mut engine = Engine::default();
    type_text(&mut engine, "2");
    binary(&mut engine, BinaryOp::Add);
    type_text(&mut engine, "3");
    let view = press_equals(&mut engine);
    assert_eq!(view.expression, "2 + 3 =");
}

#[test]
fn pi_constant_has_expected_prefix() {
    let mut engine = Engine::default();
    let view = engine.apply(CalcCommand::Constant { id: ConstantId::Pi });
    assert!(view.value.starts_with("3.1415926535897932384626433833"));
}

#[test]
fn unmatched_close_group_is_ignored() {
    let mut engine = Engine::default();
    type_text(&mut engine, "12");
    let view = engine.apply(CalcCommand::CloseGroup);
    assert_eq!(view.value, "12");
}

#[test]
fn set_expression_evaluates_and_keeps_tokens() {
    let mut engine = Engine::default();
    let view = engine.apply(CalcCommand::SetExpression {
        text: "2+3*4".into(),
    });
    assert_eq!(view.value, "14");
    assert_eq!(view.expression, "2 + 3 * 4");
    let view = press_equals(&mut engine);
    assert_eq!(view.value, "14");
    assert_eq!(view.expression, "2 + 3 * 4 =");
}

#[test]
fn set_expression_single_number_enters_edit_mode() {
    let mut engine = Engine::default();
    let view = engine.apply(CalcCommand::SetExpression {
        text: "1,234.5".into(),
    });
    assert_eq!(view.value, "1234.5");
    type_digit(&mut engine, 9);
    assert_eq!(engine.view().value, "9");
}

#[test]
fn set_expression_rejects_invalid_syntax() {
    let mut engine = Engine::default();
    let view = engine.apply(CalcCommand::SetExpression { text: "1+".into() });
    assert_eq!(view.error.unwrap().code, ErrorCode::Syntax);
}

#[test]
fn digit_after_equals_replaces_result() {
    let mut engine = Engine::default();
    type_text(&mut engine, "2");
    binary(&mut engine, BinaryOp::Add);
    type_text(&mut engine, "3");
    press_equals(&mut engine);
    assert_eq!(type_digit(&mut engine, 7).value, "7");
}

#[test]
fn binary_operator_after_equals_continues_from_result() {
    let mut engine = Engine::default();
    type_text(&mut engine, "2");
    binary(&mut engine, BinaryOp::Add);
    type_text(&mut engine, "3");
    press_equals(&mut engine);
    let view = binary(&mut engine, BinaryOp::Multiply);
    assert_eq!(view.expression, "5 *");
    type_text(&mut engine, "2");
    assert_eq!(press_equals(&mut engine).value, "10");
}

#[test]
fn power_is_available_through_expressions() {
    let mut engine = Engine::default();
    let view = engine.apply(CalcCommand::SetExpression {
        text: "2^3^2".into(),
    });
    assert_eq!(view.value, "512");
}

#[test]
fn integer_division_produces_decimal_fraction() {
    let mut engine = Engine::default();
    type_text(&mut engine, "1");
    binary(&mut engine, BinaryOp::Divide);
    type_text(&mut engine, "4");
    assert_eq!(press_equals(&mut engine).value, "0.25");
}

#[test]
fn mode_is_preserved_in_view() {
    let engine = Engine::new(Mode::Scientific);
    assert_eq!(engine.view().mode, Mode::Scientific);
}

#[test]
fn invalid_command_is_rejected() {
    let mut engine = Engine::default();
    let view = engine.apply(CalcCommand::Digit { digit: 10 });
    assert_eq!(view.error.unwrap().code, ErrorCode::InvalidInput);
}

#[test]
fn recall_restores_expression_and_value_without_reevaluating() {
    let mut engine = Engine::default();
    let view = engine.apply(CalcCommand::Recall {
        expression: "2 + 3 =".into(),
        value: "5".into(),
    });
    assert_eq!(view.expression, "2 + 3 =");
    assert_eq!(view.value, "5");
    assert_eq!(view.error, None);

    let view = type_digit(&mut engine, 7);
    assert_eq!(view.value, "7");
}

#[test]
fn recalled_value_can_start_a_new_calculation() {
    let mut engine = Engine::default();
    engine.apply(CalcCommand::Recall {
        expression: "sqrt(16) =".into(),
        value: "4".into(),
    });
    let view = binary(&mut engine, BinaryOp::Add);
    assert_eq!(view.expression, "4 +");
    type_text(&mut engine, "6");
    let view = press_equals(&mut engine);
    assert_eq!(view.value, "10");
    assert_eq!(view.expression, "4 + 6 =");
}

#[test]
fn recall_rejects_non_numeric_values() {
    let mut engine = Engine::default();
    let view = engine.apply(CalcCommand::Recall {
        expression: "x =".into(),
        value: "not-a-number".into(),
    });
    assert_eq!(view.error.unwrap().code, ErrorCode::InvalidInput);
    assert_eq!(view.value, "");
}
