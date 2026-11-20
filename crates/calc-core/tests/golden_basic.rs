use std::fs;
use std::path::PathBuf;

use calc_core::{CalcCommand, Engine, ErrorCode};
use serde::Deserialize;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GoldenCase {
    name: String,
    commands: Vec<CalcCommand>,
    expression: String,
    value: String,
    #[serde(default)]
    memories: Vec<String>,
    error: Option<ErrorCode>,
}

#[test]
fn golden_basic_cases_match_engine_output() {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/golden/basic.json");
    let raw = fs::read_to_string(&path).expect("golden fixture exists");
    let cases: Vec<GoldenCase> = serde_json::from_str(&raw).expect("golden fixture parses");

    for case in cases {
        let mut engine = Engine::default();
        let mut view = engine.view();
        for command in case.commands {
            view = engine.apply(command);
        }
        assert_eq!(
            view.expression, case.expression,
            "expression: {}",
            case.name
        );
        assert_eq!(view.value, case.value, "value: {}", case.name);
        let memories: Vec<&str> = view
            .memories
            .iter()
            .map(|entry| entry.value.as_str())
            .collect();
        assert_eq!(memories, case.memories, "memories: {}", case.name);
        assert_eq!(
            view.error.map(|error| error.code),
            case.error,
            "error: {}",
            case.name
        );
    }
}
