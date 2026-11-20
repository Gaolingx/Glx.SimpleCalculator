//! T11 acceptance tests: descriptive statistics aligned with Excel, data-set
//! edits, empty/single-value edges and the statistics view projection.

use calc_core::{CalcCommand, CalcView, Engine, ErrorCode, Mode, StatOp};

fn statistics() -> Engine {
    Engine::new(Mode::Statistics)
}

fn add(engine: &mut Engine, value: &str) -> CalcView {
    engine.apply(CalcCommand::StatsAdd {
        value: value.into(),
    })
}

fn compute(engine: &mut Engine, op: StatOp) -> CalcView {
    engine.apply(CalcCommand::StatsCompute { op })
}

fn data(view: &CalcView) -> Vec<String> {
    view.statistics.clone().expect("statistics projection").data
}

fn result(view: &CalcView) -> f64 {
    assert_eq!(view.error, None, "expression: {}", view.expression);
    view.value.parse::<f64>().expect("numeric result")
}

fn assert_close(actual: f64, expected: f64) {
    assert!(
        (actual - expected).abs() < 1e-12,
        "expected {expected}, got {actual}"
    );
}

#[test]
fn sample_1_to_10_matches_excel() {
    let mut engine = statistics();
    for value in 1..=10 {
        let view = add(&mut engine, &value.to_string());
        assert_eq!(view.error, None);
    }

    assert_eq!(
        data(&engine.view()),
        ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]
    );

    let sum = compute(&mut engine, StatOp::Sum);
    assert_eq!(sum.value, "55");
    assert_eq!(sum.expression, "sum(1, 2, 3, 4, 5, 6, 7, 8, 9, 10) =");

    assert_eq!(compute(&mut engine, StatOp::SumSquares).value, "385");
    assert_eq!(compute(&mut engine, StatOp::Mean).value, "5.5");
    assert_eq!(compute(&mut engine, StatOp::Median).value, "5.5");
    assert_eq!(compute(&mut engine, StatOp::Range).value, "9");
    assert_eq!(compute(&mut engine, StatOp::Min).value, "1");
    assert_eq!(compute(&mut engine, StatOp::Max).value, "10");
    assert_eq!(compute(&mut engine, StatOp::Count).value, "10");

    assert_close(
        result(&compute(&mut engine, StatOp::Variance)),
        9.166_666_666_666_666,
    );
    assert_close(
        result(&compute(&mut engine, StatOp::SampleStdDev)),
        3.027_650_354_097_492,
    );
    assert_close(
        result(&compute(&mut engine, StatOp::PopulationStdDev)),
        2.872_281_323_269_014,
    );
}

#[test]
fn tied_modes_are_all_listed_in_ascending_order() {
    let mut engine = statistics();
    for value in ["3", "1", "2", "1", "3"] {
        add(&mut engine, value);
    }
    let view = compute(&mut engine, StatOp::Mode);
    assert_eq!(view.value, "1, 3");
    assert_eq!(view.expression, "mode(3, 1, 2, 1, 3) =");
}

#[test]
fn dataset_edits_use_original_indices() {
    let mut engine = statistics();
    for value in ["1", "2", "3"] {
        add(&mut engine, value);
    }

    let updated = engine.apply(CalcCommand::StatsUpdate {
        index: 1,
        value: "10".into(),
    });
    assert_eq!(data(&updated), ["1", "10", "3"]);
    assert_eq!(updated.value, "", "mutations clear the result card");

    assert_eq!(compute(&mut engine, StatOp::Sum).value, "14");

    let removed = engine.apply(CalcCommand::StatsRemove { index: 0 });
    assert_eq!(data(&removed), ["10", "3"]);
    assert_eq!(removed.value, "");

    let cleared = engine.apply(CalcCommand::StatsClear);
    assert!(data(&cleared).is_empty());
    assert_eq!(cleared.value, "");
}

#[test]
fn inputs_are_normalized_before_storage() {
    let mut engine = statistics();
    add(&mut engine, "1,000");
    add(&mut engine, " 2.5 ");
    add(&mut engine, "1e3");
    assert_eq!(data(&engine.view()), ["1000", "2.5", "1000"]);
}

#[test]
fn empty_and_single_value_sets_report_domain_errors() {
    let mut engine = statistics();

    let empty = compute(&mut engine, StatOp::Sum);
    assert_eq!(
        empty.error.as_ref().expect("error").code,
        ErrorCode::DomainError
    );
    assert_eq!(empty.expression, "sum() =");
    assert_eq!(empty.value, "");

    let empty_count = compute(&mut engine, StatOp::Count);
    assert_eq!(
        empty_count.error.as_ref().expect("error").code,
        ErrorCode::DomainError
    );

    add(&mut engine, "7");
    assert_eq!(compute(&mut engine, StatOp::Count).value, "1");
    assert_eq!(compute(&mut engine, StatOp::Mean).value, "7");
    assert_eq!(compute(&mut engine, StatOp::PopulationStdDev).value, "0");
    assert_eq!(
        compute(&mut engine, StatOp::Variance)
            .error
            .expect("error")
            .code,
        ErrorCode::DomainError
    );
    assert_eq!(
        compute(&mut engine, StatOp::SampleStdDev)
            .error
            .expect("error")
            .code,
        ErrorCode::DomainError
    );
}

#[test]
fn invalid_edits_leave_the_dataset_untouched() {
    let mut engine = statistics();
    add(&mut engine, "1");

    let invalid_add = add(&mut engine, "abc");
    assert_eq!(
        invalid_add.error.as_ref().expect("error").code,
        ErrorCode::InvalidInput
    );
    assert_eq!(data(&invalid_add), ["1"]);

    let invalid_update = engine.apply(CalcCommand::StatsUpdate {
        index: 0,
        value: "1.2.3".into(),
    });
    assert_eq!(
        invalid_update.error.as_ref().expect("error").code,
        ErrorCode::InvalidInput
    );
    assert_eq!(data(&invalid_update), ["1"]);

    let missing = engine.apply(CalcCommand::StatsRemove { index: 4 });
    assert_eq!(
        missing.error.as_ref().expect("error").code,
        ErrorCode::InvalidInput
    );
}

#[test]
fn non_finite_datasets_overflow_instead_of_leaking_infinity() {
    let mut engine = statistics();
    add(&mut engine, "1e308");
    add(&mut engine, "1e308");

    let overflow = compute(&mut engine, StatOp::Sum);
    assert_eq!(
        overflow.error.as_ref().expect("error").code,
        ErrorCode::Overflow
    );
    let overflow = compute(&mut engine, StatOp::SumSquares);
    assert_eq!(
        overflow.error.as_ref().expect("error").code,
        ErrorCode::Overflow
    );
}

#[test]
fn history_recall_is_display_only() {
    let mut engine = statistics();
    add(&mut engine, "1");
    add(&mut engine, "2");

    let recalled = engine.apply(CalcCommand::Recall {
        expression: "mean(1, 2) =".into(),
        value: "1.5".into(),
    });
    assert_eq!(recalled.error, None);
    assert_eq!(recalled.value, "1.5");
    assert_eq!(recalled.expression, "mean(1, 2) =");
    assert_eq!(data(&recalled), ["1", "2"]);
}

#[test]
fn unsupported_commands_do_not_touch_the_dataset() {
    let mut engine = statistics();
    add(&mut engine, "1");
    let view = engine.apply(CalcCommand::Digit { digit: 5 });
    assert_eq!(
        view.error.as_ref().expect("error").code,
        ErrorCode::Unsupported
    );
    assert_eq!(data(&view), ["1"]);
    assert_eq!(view.value, "");
}

#[test]
fn dataset_size_is_bounded() {
    let mut engine = statistics();
    for value in 0..1000 {
        let view = add(&mut engine, &value.to_string());
        assert_eq!(view.error, None);
    }
    assert_eq!(data(&engine.view()).len(), 1000);
    let overflow = add(&mut engine, "1000");
    assert_eq!(
        overflow.error.as_ref().expect("error").code,
        ErrorCode::InvalidInput
    );
    assert_eq!(data(&overflow).len(), 1000);
}

#[test]
fn view_exposes_only_statistics_projection() {
    let mut engine = statistics();
    add(&mut engine, "1");
    let view = engine.view();

    assert_eq!(view.mode, Mode::Statistics);
    assert!(view.memories.is_empty());
    assert!(view.programmer.is_none());
    assert_eq!(data(&view), ["1"]);
}
