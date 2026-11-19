//! T9 acceptance tests: radix projections, word-size masking, bitwise truth
//! tables, logical shifts, rotate symmetry and wrapping arithmetic.

use calc_core::{
    BinaryOp, CalcCommand, CalcView, Engine, ErrorCode, Mode, ProgrammerView, Radix, UnaryOp,
    WordSize,
};

fn programmer() -> Engine {
    Engine::new(Mode::Programmer)
}

fn radix(engine: &mut Engine, radix: Radix) -> CalcView {
    engine.apply(CalcCommand::SetRadix { radix })
}

fn size(engine: &mut Engine, size: WordSize) -> CalcView {
    engine.apply(CalcCommand::SetWordSize { size })
}

fn expression(engine: &mut Engine, text: &str) -> CalcView {
    engine.apply(CalcCommand::SetExpression { text: text.into() })
}

fn digit(engine: &mut Engine, value: u8) -> CalcView {
    engine.apply(CalcCommand::Digit { digit: value })
}

fn binary(engine: &mut Engine, op: BinaryOp) -> CalcView {
    engine.apply(CalcCommand::Binary { op })
}

fn equals(engine: &mut Engine) -> CalcView {
    engine.apply(CalcCommand::Equals)
}

fn view(view: &CalcView) -> ProgrammerView {
    view.programmer.clone().expect("programmer projection")
}

#[test]
fn hex_and_masks_follow_the_documented_example() {
    let mut engine = programmer();
    radix(&mut engine, Radix::Hexadecimal);
    digit(&mut engine, 0xF);
    digit(&mut engine, 0xF);
    binary(&mut engine, BinaryOp::And);
    digit(&mut engine, 0);
    digit(&mut engine, 0xF);
    let result = equals(&mut engine);

    assert_eq!(result.error, None);
    assert_eq!(result.value, "F");
    assert_eq!(result.expression, "FF AND F =");
    assert_eq!(view(&result).hexadecimal, "F");
    assert_eq!(view(&result).decimal, "15");
}

#[test]
fn not_zero_in_byte_mode_is_ff() {
    let mut engine = programmer();
    size(&mut engine, WordSize::Byte);
    let not = engine.apply(CalcCommand::Unary { op: UnaryOp::Not });

    assert_eq!(not.error, None);
    assert_eq!(not.value, "-1");
    assert_eq!(not.expression, "NOT(0)");
    assert_eq!(view(&not).hexadecimal, "FF");
    assert_eq!(view(&not).binary, "11111111");
    assert_eq!(view(&not).octal, "377");
    assert_eq!(view(&not).decimal, "-1");
    assert_eq!(view(&not).bits, "11111111");

    let equal = equals(&mut engine);
    assert_eq!(equal.expression, "NOT(0) =");
    assert_eq!(equal.value, "-1");
}

#[test]
fn rotate_left_wraps_the_top_bit() {
    let mut engine = programmer();
    radix(&mut engine, Radix::Hexadecimal);
    expression(&mut engine, "8000000000000001");
    binary(&mut engine, BinaryOp::RotateLeft);
    digit(&mut engine, 1);
    let result = equals(&mut engine);

    assert_eq!(result.error, None);
    assert_eq!(result.value, "3");
    assert_eq!(view(&result).hexadecimal, "3");
}

#[test]
fn binary_input_blocks_digits_above_the_base() {
    let mut engine = programmer();
    radix(&mut engine, Radix::Binary);
    size(&mut engine, WordSize::Byte);

    let blocked = digit(&mut engine, 2);
    assert_eq!(blocked.error, None);
    assert_eq!(blocked.value, "");

    digit(&mut engine, 1);
    let value = digit(&mut engine, 1);
    assert_eq!(value.value, "11");

    for _ in 0..6 {
        digit(&mut engine, 1);
    }
    // Eight digits fill BYTE; the limit clamps further input.
    let full = digit(&mut engine, 1);
    assert_eq!(full.value, "11111111");
}

#[test]
fn word_size_switch_truncates_high_bits() {
    let mut engine = programmer();
    radix(&mut engine, Radix::Hexadecimal);
    expression(&mut engine, "1FF");
    assert_eq!(engine.view().value, "1FF");

    let truncated = size(&mut engine, WordSize::Byte);
    assert_eq!(truncated.value, "FF");
    assert_eq!(view(&truncated).decimal, "-1");
    assert_eq!(view(&truncated).bits, "11111111");
}

#[test]
fn qword_decimal_input_uses_the_full_unsigned_range() {
    let mut engine = programmer();
    radix(&mut engine, Radix::Hexadecimal);
    expression(&mut engine, "FFFFFFFFFFFFFFFF");
    let result = equals(&mut engine);

    assert_eq!(result.value, "FFFFFFFFFFFFFFFF");
    assert_eq!(view(&result).decimal, "-1");

    radix(&mut engine, Radix::Decimal);
    expression(&mut engine, "18446744073709551615");
    let result = equals(&mut engine);
    assert_eq!(result.value, "-1");
    assert_eq!(view(&result).hexadecimal, "FFFFFFFFFFFFFFFF");
}

#[test]
fn radix_switch_preserves_the_number() {
    let mut engine = programmer();
    radix(&mut engine, Radix::Hexadecimal);
    expression(&mut engine, "FF");

    let decimal = radix(&mut engine, Radix::Decimal);
    assert_eq!(decimal.value, "255");
    let binary = radix(&mut engine, Radix::Binary);
    assert_eq!(binary.value, "11111111");
    let octal = radix(&mut engine, Radix::Octal);
    assert_eq!(octal.value, "377");
}

#[test]
fn arithmetic_wraps_and_divisions_truncate() {
    let mut engine = programmer();
    size(&mut engine, WordSize::Byte);
    expression(&mut engine, "255");
    binary(&mut engine, BinaryOp::Add);
    digit(&mut engine, 1);
    let wrapped = equals(&mut engine);
    assert_eq!(wrapped.value, "0");

    size(&mut engine, WordSize::Qword);
    expression(&mut engine, "-7");
    binary(&mut engine, BinaryOp::Divide);
    digit(&mut engine, 2);
    let truncated = equals(&mut engine);
    assert_eq!(truncated.value, "-3");

    expression(&mut engine, "7");
    binary(&mut engine, BinaryOp::Modulo);
    digit(&mut engine, 3);
    let remainder = equals(&mut engine);
    assert_eq!(remainder.value, "1");
}

#[test]
fn division_by_zero_keeps_the_attempted_expression() {
    let mut engine = programmer();
    expression(&mut engine, "5");
    binary(&mut engine, BinaryOp::Divide);
    digit(&mut engine, 0);
    let failed = equals(&mut engine);

    assert_eq!(failed.error.unwrap().code, ErrorCode::DivideByZero);
    assert_eq!(failed.expression, "5 / 0");
    assert_eq!(failed.value, "");

    let recovered = digit(&mut engine, 2);
    assert_eq!(recovered.error, None);
    assert_eq!(recovered.value, "2");
}

#[test]
fn logical_right_shift_fills_with_zero() {
    let mut engine = programmer();
    size(&mut engine, WordSize::Byte);
    radix(&mut engine, Radix::Hexadecimal);
    expression(&mut engine, "FF");
    binary(&mut engine, BinaryOp::RightShift);
    digit(&mut engine, 1);
    let result = equals(&mut engine);

    assert_eq!(result.value, "7F");
    assert_eq!(view(&result).decimal, "127");
}

#[test]
fn repeat_equals_reuses_the_operator_and_operand() {
    let mut engine = programmer();
    digit(&mut engine, 2);
    binary(&mut engine, BinaryOp::Add);
    digit(&mut engine, 3);
    let first = equals(&mut engine);
    assert_eq!(first.value, "5");

    let second = equals(&mut engine);
    assert_eq!(second.value, "8");
    assert_eq!(second.expression, "5 + 3 =");
}

#[test]
fn toggle_bit_flips_within_the_active_width() {
    let mut engine = programmer();
    size(&mut engine, WordSize::Byte);
    radix(&mut engine, Radix::Hexadecimal);

    let high = engine.apply(CalcCommand::ToggleBit { bit: 7 });
    assert_eq!(high.value, "80");
    let low = engine.apply(CalcCommand::ToggleBit { bit: 0 });
    assert_eq!(low.value, "81");
    assert_eq!(view(&low).bits, "10000001");

    let invalid = engine.apply(CalcCommand::ToggleBit { bit: 8 });
    assert_eq!(invalid.error.unwrap().code, ErrorCode::InvalidInput);
}

#[test]
fn memory_operations_use_word_sized_values() {
    let mut engine = programmer();
    size(&mut engine, WordSize::Byte);
    expression(&mut engine, "200");
    engine.apply(CalcCommand::Memory {
        op: calc_core::MemoryOp::Store,
    });
    engine.apply(CalcCommand::ClearAll);

    let recalled = engine.apply(CalcCommand::Memory {
        op: calc_core::MemoryOp::Recall,
    });
    assert_eq!(recalled.value, "-56");
    assert_eq!(view(&recalled).hexadecimal, "C8");
}

#[test]
fn history_values_restore_regardless_of_the_active_radix() {
    let mut engine = programmer();
    radix(&mut engine, Radix::Hexadecimal);
    expression(&mut engine, "FF");
    equals(&mut engine);
    radix(&mut engine, Radix::Decimal);

    let recalled = engine.apply(CalcCommand::Recall {
        expression: "FF =".into(),
        value: "FF".into(),
    });
    assert_eq!(recalled.value, "255");
    assert_eq!(recalled.expression, "FF =");
}

#[test]
fn unsupported_programmer_keys_report_stable_errors() {
    let mut engine = programmer();
    expression(&mut engine, "12");

    for command in [
        CalcCommand::Percent,
        CalcCommand::OpenGroup,
        CalcCommand::CloseGroup,
        CalcCommand::Random,
        CalcCommand::Unary { op: UnaryOp::Sin },
        CalcCommand::Binary {
            op: BinaryOp::Power,
        },
    ] {
        let view = engine.apply(command.clone());
        assert_eq!(
            view.error.map(|error| error.code),
            Some(ErrorCode::Unsupported),
            "{command:?}"
        );
    }
}

#[test]
fn non_programmer_sessions_stay_on_the_decimal_engine() {
    let mut basic = Engine::new(Mode::Basic);
    basic.apply(CalcCommand::Digit { digit: 1 });
    basic.apply(CalcCommand::Binary { op: BinaryOp::And });
    basic.apply(CalcCommand::Digit { digit: 2 });
    let view = basic.apply(CalcCommand::Equals);
    // The basic parser only understands arithmetic tokens; bitwise operators
    // are never reachable from its keypad.
    assert_eq!(view.error.unwrap().code, ErrorCode::Syntax);
    assert!(view.programmer.is_none());

    let view = basic.apply(CalcCommand::Digit { digit: 10 });
    assert_eq!(view.error.unwrap().code, ErrorCode::InvalidInput);
}
