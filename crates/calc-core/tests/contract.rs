use calc_core::{
    AngleUnit, BinaryOp, CalcCommand, CalcView, ConstantId, ErrorCode, ErrorInfo, Mode,
    ProgrammerView, Radix, StatOp, StatisticsView, UnaryOp, UnitCatalog, UnitCategory,
    UnitCategoryInfo, UnitConversion, UnitInfo, WordSize,
};
use serde_json::json;

#[test]
fn commands_serialize_with_camel_case_tags() {
    assert_eq!(
        serde_json::to_value(CalcCommand::Dot).unwrap(),
        json!({ "type": "dot" })
    );
    assert_eq!(
        serde_json::to_value(CalcCommand::ClearAll).unwrap(),
        json!({ "type": "clearAll" })
    );
    assert_eq!(
        serde_json::to_value(CalcCommand::Digit { digit: 7 }).unwrap(),
        json!({ "type": "digit", "digit": 7 })
    );
    assert_eq!(
        serde_json::to_value(CalcCommand::Unary {
            op: UnaryOp::Square
        })
        .unwrap(),
        json!({ "type": "unary", "op": "square" })
    );
    assert_eq!(
        serde_json::to_value(CalcCommand::Binary { op: BinaryOp::Xor }).unwrap(),
        json!({ "type": "binary", "op": "xor" })
    );
    assert_eq!(
        serde_json::to_value(CalcCommand::Unary { op: UnaryOp::Not }).unwrap(),
        json!({ "type": "unary", "op": "not" })
    );
    assert_eq!(
        serde_json::to_value(CalcCommand::SetRadix {
            radix: Radix::Hexadecimal
        })
        .unwrap(),
        json!({ "type": "setRadix", "radix": "hexadecimal" })
    );
    assert_eq!(
        serde_json::to_value(CalcCommand::SetWordSize {
            size: WordSize::Byte
        })
        .unwrap(),
        json!({ "type": "setWordSize", "size": "byte" })
    );
    assert_eq!(
        serde_json::to_value(CalcCommand::SetAngleUnit {
            unit: AngleUnit::Deg
        })
        .unwrap(),
        json!({ "type": "setAngleUnit", "unit": "deg" })
    );
    assert_eq!(
        serde_json::to_value(CalcCommand::Constant { id: ConstantId::Pi }).unwrap(),
        json!({ "type": "constant", "id": "pi" })
    );
    assert_eq!(
        serde_json::to_value(CalcCommand::ToggleBit { bit: 63 }).unwrap(),
        json!({ "type": "toggleBit", "bit": 63 })
    );
    assert_eq!(
        serde_json::to_value(CalcCommand::Random).unwrap(),
        json!({ "type": "random" })
    );
    assert_eq!(
        serde_json::to_value(CalcCommand::SetExpression {
            text: "0xFF".into()
        })
        .unwrap(),
        json!({ "type": "setExpression", "text": "0xFF" })
    );
    assert_eq!(
        serde_json::to_value(CalcCommand::Recall {
            expression: "2 + 3 =".into(),
            value: "5".into()
        })
        .unwrap(),
        json!({ "type": "recall", "expression": "2 + 3 =", "value": "5" })
    );
    assert_eq!(
        serde_json::to_value(CalcCommand::StatsAdd {
            value: "1.5".into()
        })
        .unwrap(),
        json!({ "type": "statsAdd", "value": "1.5" })
    );
    assert_eq!(
        serde_json::to_value(CalcCommand::StatsUpdate {
            index: 2,
            value: "-4".into()
        })
        .unwrap(),
        json!({ "type": "statsUpdate", "index": 2, "value": "-4" })
    );
    assert_eq!(
        serde_json::to_value(CalcCommand::StatsRemove { index: 0 }).unwrap(),
        json!({ "type": "statsRemove", "index": 0 })
    );
    assert_eq!(
        serde_json::to_value(CalcCommand::StatsClear).unwrap(),
        json!({ "type": "statsClear" })
    );
    assert_eq!(
        serde_json::to_value(CalcCommand::StatsCompute {
            op: StatOp::SampleStdDev
        })
        .unwrap(),
        json!({ "type": "statsCompute", "op": "sampleStdDev" })
    );
    assert_eq!(
        serde_json::to_value(CalcCommand::StatsCompute {
            op: StatOp::SumSquares
        })
        .unwrap(),
        json!({ "type": "statsCompute", "op": "sumSquares" })
    );
}

#[test]
fn commands_round_trip() {
    let commands = [
        CalcCommand::Digit { digit: 0 },
        CalcCommand::Memory {
            op: calc_core::MemoryOp::Store,
        },
        CalcCommand::OpenGroup,
        CalcCommand::CloseGroup,
        CalcCommand::Percent,
        CalcCommand::ToggleSign,
        CalcCommand::Equals,
        CalcCommand::StatsAdd {
            value: "1.5".into(),
        },
        CalcCommand::StatsUpdate {
            index: 0,
            value: "2".into(),
        },
        CalcCommand::StatsRemove { index: 0 },
        CalcCommand::StatsClear,
        CalcCommand::StatsCompute { op: StatOp::Median },
    ];
    for command in commands {
        let encoded = serde_json::to_string(&command).unwrap();
        let decoded: CalcCommand = serde_json::from_str(&encoded).unwrap();
        assert_eq!(decoded, command);
    }
}

#[test]
fn error_info_serializes_code_and_args() {
    let error = ErrorInfo::new(ErrorCode::DivideByZero);
    assert_eq!(
        serde_json::to_value(&error).unwrap(),
        json!({ "code": "DIVIDE_BY_ZERO", "args": [] })
    );

    let error = ErrorInfo::with_args(ErrorCode::UnknownUnit, vec!["furlong".into()]);
    assert_eq!(
        serde_json::to_value(&error).unwrap(),
        json!({ "code": "UNKNOWN_UNIT", "args": ["furlong"] })
    );
}

#[test]
fn calc_view_uses_camel_case_and_null_optionals() {
    let view = CalcView {
        mode: Mode::Programmer,
        expression: "255".into(),
        value: "255".into(),
        memory: None,
        programmer: Some(ProgrammerView {
            radix: Radix::Hexadecimal,
            word_size: WordSize::Byte,
            binary: "11111111".into(),
            octal: "377".into(),
            decimal: "255".into(),
            hexadecimal: "FF".into(),
            bits: "11111111".into(),
        }),
        statistics: None,
        error: None,
    };

    let encoded = serde_json::to_value(&view).unwrap();
    assert_eq!(encoded["mode"], "programmer");
    assert_eq!(encoded["value"], "255");
    assert_eq!(encoded["memory"], serde_json::Value::Null);
    assert_eq!(encoded["error"], serde_json::Value::Null);
    assert_eq!(encoded["programmer"]["radix"], "hexadecimal");
    assert_eq!(encoded["programmer"]["wordSize"], "byte");
    assert_eq!(encoded["programmer"]["bits"], "11111111");

    let decoded: CalcView = serde_json::from_value(encoded).unwrap();
    assert_eq!(decoded, view);
}

#[test]
fn statistics_view_serializes_canonical_data() {
    let view = CalcView {
        mode: Mode::Statistics,
        expression: "mean(1, 2) =".into(),
        value: "1.5".into(),
        memory: None,
        programmer: None,
        statistics: Some(StatisticsView {
            data: vec!["1".into(), "2".into()],
        }),
        error: None,
    };

    let encoded = serde_json::to_value(&view).unwrap();
    assert_eq!(encoded["mode"], "statistics");
    assert_eq!(encoded["programmer"], serde_json::Value::Null);
    assert_eq!(encoded["statistics"]["data"], json!(["1", "2"]));

    let decoded: CalcView = serde_json::from_value(encoded).unwrap();
    assert_eq!(decoded, view);
}

#[test]
fn unit_catalog_serializes_camel_case_categories_and_units() {
    let catalog = UnitCatalog {
        categories: vec![UnitCategoryInfo {
            id: UnitCategory::Length,
            units: vec![UnitInfo {
                id: "km".into(),
                symbol: "km".into(),
            }],
        }],
    };

    let encoded = serde_json::to_value(&catalog).unwrap();
    assert_eq!(
        encoded,
        json!({
            "categories": [{
                "id": "length",
                "units": [{ "id": "km", "symbol": "km" }]
            }]
        })
    );
    let decoded: UnitCatalog = serde_json::from_value(encoded).unwrap();
    assert_eq!(decoded, catalog);
}

#[test]
fn unit_conversion_serializes_canonical_value() {
    let conversion = UnitConversion {
        value: "1000".into(),
    };
    assert_eq!(
        serde_json::to_value(&conversion).unwrap(),
        json!({ "value": "1000" })
    );
    let decoded: UnitConversion = serde_json::from_value(json!({ "value": "1000" })).unwrap();
    assert_eq!(decoded, conversion);
}

#[test]
fn command_validation_rejects_out_of_range_values() {
    assert!(CalcCommand::Digit { digit: 9 }.validate().is_ok());
    assert!(CalcCommand::Digit { digit: 15 }.validate().is_ok());
    assert_eq!(
        CalcCommand::Digit { digit: 16 }
            .validate()
            .unwrap_err()
            .code,
        ErrorCode::InvalidInput
    );
    assert!(CalcCommand::ToggleBit { bit: 63 }.validate().is_ok());
    assert_eq!(
        CalcCommand::ToggleBit { bit: 64 }
            .validate()
            .unwrap_err()
            .code,
        ErrorCode::InvalidInput
    );
    assert_eq!(
        CalcCommand::SetExpression {
            text: "1".repeat(1001)
        }
        .validate()
        .unwrap_err()
        .code,
        ErrorCode::InvalidInput
    );
    assert!(
        CalcCommand::Recall {
            expression: "1 =".into(),
            value: "1".into()
        }
        .validate()
        .is_ok()
    );
    assert_eq!(
        CalcCommand::Recall {
            expression: String::new(),
            value: "1".into()
        }
        .validate()
        .unwrap_err()
        .code,
        ErrorCode::InvalidInput
    );
    assert!(
        CalcCommand::StatsAdd {
            value: "1e3".into()
        }
        .validate()
        .is_ok()
    );
    assert_eq!(
        CalcCommand::StatsAdd {
            value: "1".repeat(1001)
        }
        .validate()
        .unwrap_err()
        .code,
        ErrorCode::InvalidInput
    );
}
