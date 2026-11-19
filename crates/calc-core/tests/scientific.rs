//! T8 acceptance tests: every scientific function, all angle units and the
//! documented domain/overflow boundaries.

use calc_core::{AngleUnit, CalcCommand, CalcView, Engine, ErrorCode, Mode, UnaryOp};

fn scientific() -> Engine {
    Engine::new(Mode::Scientific)
}

fn evaluate(engine: &mut Engine, text: &str, unit: AngleUnit, op: UnaryOp) -> CalcView {
    engine.apply(CalcCommand::SetAngleUnit { unit });
    engine.apply(CalcCommand::SetExpression { text: text.into() });
    engine.apply(CalcCommand::Unary { op })
}

fn value(engine: &mut Engine, text: &str, unit: AngleUnit, op: UnaryOp) -> String {
    let view = evaluate(engine, text, unit, op);
    assert_eq!(view.error, None, "{op:?}({text}) in {unit:?}");
    view.value
}

#[test]
fn trigonometry_and_inverses_follow_each_angle_unit() {
    let mut engine = scientific();
    assert_eq!(
        value(&mut engine, "30", AngleUnit::Deg, UnaryOp::Sin),
        "0.5"
    );
    assert_eq!(
        value(&mut engine, "60", AngleUnit::Deg, UnaryOp::Cos),
        "0.5"
    );
    assert_eq!(value(&mut engine, "45", AngleUnit::Deg, UnaryOp::Tan), "1");
    assert_eq!(value(&mut engine, "90", AngleUnit::Deg, UnaryOp::Cos), "0");
    assert_eq!(
        value(
            &mut engine,
            "0.5235987755982988",
            AngleUnit::Rad,
            UnaryOp::Sin
        ),
        "0.5"
    );
    assert_eq!(
        value(&mut engine, "100", AngleUnit::Grad, UnaryOp::Sin),
        "1"
    );
    assert_eq!(
        value(&mut engine, "0.5", AngleUnit::Deg, UnaryOp::Asin),
        "30"
    );
    assert_eq!(
        value(&mut engine, "0.5", AngleUnit::Deg, UnaryOp::Acos),
        "60"
    );
    assert_eq!(value(&mut engine, "1", AngleUnit::Deg, UnaryOp::Atan), "45");
}

#[test]
fn hyperbolic_and_inverse_hyperbolic_functions() {
    let mut engine = scientific();
    assert_eq!(value(&mut engine, "0", AngleUnit::Deg, UnaryOp::Sinh), "0");
    assert_eq!(value(&mut engine, "0", AngleUnit::Deg, UnaryOp::Cosh), "1");
    assert_eq!(value(&mut engine, "0", AngleUnit::Deg, UnaryOp::Tanh), "0");
    assert_eq!(value(&mut engine, "0", AngleUnit::Deg, UnaryOp::Asinh), "0");
    assert_eq!(value(&mut engine, "1", AngleUnit::Deg, UnaryOp::Acosh), "0");
    assert_eq!(value(&mut engine, "0", AngleUnit::Deg, UnaryOp::Atanh), "0");
    let sinh_one = value(&mut engine, "1", AngleUnit::Deg, UnaryOp::Sinh);
    assert!(sinh_one.starts_with("1.1752011936438"));
}

#[test]
fn logarithms_powers_and_roots() {
    let mut engine = scientific();
    assert_eq!(
        value(
            &mut engine,
            "2.718281828459045",
            AngleUnit::Deg,
            UnaryOp::Ln
        ),
        "1"
    );
    assert_eq!(
        value(&mut engine, "1000", AngleUnit::Deg, UnaryOp::Log10),
        "3"
    );
    assert_eq!(value(&mut engine, "8", AngleUnit::Deg, UnaryOp::Log2), "3");
    assert_eq!(value(&mut engine, "0", AngleUnit::Deg, UnaryOp::Exp), "1");
    assert_eq!(value(&mut engine, "2", AngleUnit::Deg, UnaryOp::Cube), "8");
    assert_eq!(
        value(&mut engine, "8", AngleUnit::Deg, UnaryOp::CubeRoot),
        "2"
    );
    assert_eq!(
        value(&mut engine, "-8", AngleUnit::Deg, UnaryOp::CubeRoot),
        "-2"
    );
    assert_eq!(value(&mut engine, "9", AngleUnit::Deg, UnaryOp::Sqrt), "3");
    assert_eq!(
        value(&mut engine, "4", AngleUnit::Deg, UnaryOp::Square),
        "16"
    );
    assert_eq!(
        value(&mut engine, "4", AngleUnit::Deg, UnaryOp::Reciprocal),
        "0.25"
    );
}

#[test]
fn factorial_abs_rounding_and_floor_ceil() {
    let mut engine = scientific();
    assert_eq!(
        value(&mut engine, "0", AngleUnit::Deg, UnaryOp::Factorial),
        "1"
    );
    assert_eq!(
        value(&mut engine, "5", AngleUnit::Deg, UnaryOp::Factorial),
        "120"
    );
    assert_eq!(
        value(&mut engine, "10", AngleUnit::Deg, UnaryOp::Factorial),
        "3628800"
    );
    assert_eq!(value(&mut engine, "-7", AngleUnit::Deg, UnaryOp::Abs), "7");
    assert_eq!(
        value(&mut engine, "2.5", AngleUnit::Deg, UnaryOp::Round),
        "3"
    );
    assert_eq!(
        value(&mut engine, "-2.5", AngleUnit::Deg, UnaryOp::Round),
        "-3"
    );
    assert_eq!(
        value(&mut engine, "-1.2", AngleUnit::Deg, UnaryOp::Floor),
        "-2"
    );
    assert_eq!(
        value(&mut engine, "-1.2", AngleUnit::Deg, UnaryOp::Ceil),
        "-1"
    );
}

#[test]
fn factorial_reaches_170_and_reports_overflow_past_the_limit() {
    let mut engine = scientific();
    let view = evaluate(&mut engine, "170", AngleUnit::Deg, UnaryOp::Factorial);
    assert_eq!(view.error, None);
    assert!(view.value.starts_with("7.25741561530799"));

    let view = evaluate(&mut engine, "171", AngleUnit::Deg, UnaryOp::Factorial);
    assert_eq!(view.error.unwrap().code, ErrorCode::Overflow);
}

#[test]
fn domain_errors_are_stable() {
    let mut engine = scientific();
    for (text, op) in [
        ("-1", UnaryOp::Sqrt),
        ("0", UnaryOp::Ln),
        ("0", UnaryOp::Log10),
        ("0", UnaryOp::Log2),
        ("2", UnaryOp::Asin),
        ("-2", UnaryOp::Acos),
        ("0.5", UnaryOp::Acosh),
        ("1", UnaryOp::Atanh),
        ("2.5", UnaryOp::Factorial),
        ("-1", UnaryOp::Factorial),
    ] {
        let view = evaluate(&mut engine, text, AngleUnit::Deg, op);
        assert_eq!(
            view.error.map(|error| error.code),
            Some(ErrorCode::DomainError),
            "{op:?}({text})"
        );
    }

    let view = evaluate(&mut engine, "90", AngleUnit::Deg, UnaryOp::Tan);
    assert_eq!(view.error.unwrap().code, ErrorCode::DomainError);
    let view = evaluate(&mut engine, "1000", AngleUnit::Deg, UnaryOp::Exp);
    assert_eq!(view.error.unwrap().code, ErrorCode::Overflow);
}

#[test]
fn fractional_power_and_right_associative_exponentiation() {
    let mut engine = scientific();
    let view = engine.apply(CalcCommand::SetExpression {
        text: "2^0.5".into(),
    });
    assert_eq!(view.error, None);
    assert!(view.value.starts_with("1.4142135623731"));

    let view = engine.apply(CalcCommand::SetExpression {
        text: "2^3^2".into(),
    });
    assert_eq!(view.value, "512");

    let view = engine.apply(CalcCommand::SetExpression {
        text: "(-2)^0.5".into(),
    });
    assert_eq!(view.error.unwrap().code, ErrorCode::DomainError);
}

#[test]
fn scientific_keys_stay_unsupported_in_basic_mode() {
    let mut engine = Engine::new(Mode::Basic);
    engine.apply(CalcCommand::SetExpression { text: "30".into() });
    let view = engine.apply(CalcCommand::Unary { op: UnaryOp::Sin });
    assert_eq!(view.error.unwrap().code, ErrorCode::Unsupported);
}

#[test]
fn random_values_are_in_range() {
    let mut engine = scientific();
    let first = engine.apply(CalcCommand::Random).value;
    let second = engine.apply(CalcCommand::Random).value;
    assert_ne!(first, second);
    for raw in [first, second] {
        let parsed: f64 = raw.parse().expect("numeric");
        assert!((0.0..1.0).contains(&parsed));
    }
}
