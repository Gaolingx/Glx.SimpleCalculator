//! T15 worksheet formulas: golden amounts, field validation and the registry.

use std::collections::BTreeMap;

use calc_core::worksheet::{catalog, compute};
use calc_core::{ErrorCode, WorksheetId, WorksheetResult};

fn inputs(pairs: &[(&str, &str)]) -> BTreeMap<String, String> {
    pairs
        .iter()
        .map(|(key, value)| ((*key).to_owned(), (*value).to_owned()))
        .collect()
}

fn run(id: WorksheetId, pairs: &[(&str, &str)]) -> WorksheetResult {
    compute(id, &inputs(pairs)).unwrap()
}

fn value<'a>(result: &'a WorksheetResult, id: &str) -> &'a str {
    result
        .values
        .iter()
        .find(|value| value.id == id)
        .map(|value| value.value.as_str())
        .unwrap_or_else(|| panic!("missing result {id}"))
}

#[test]
fn mortgage_matches_the_annuity_baseline() {
    let result = run(
        WorksheetId::Mortgage,
        &[
            ("principal", "1000000"),
            ("annualRate", "4.2"),
            ("years", "30"),
        ],
    );
    assert_eq!(value(&result, "monthlyPayment"), "4890.17");
    assert_eq!(value(&result, "totalPayment"), "1760461.2");
    assert_eq!(value(&result, "totalInterest"), "760461.2");
}

#[test]
fn mortgage_handles_zero_rate_and_grouped_input() {
    let result = run(
        WorksheetId::Mortgage,
        &[
            ("principal", "360,000"),
            ("annualRate", "0"),
            ("years", "30"),
        ],
    );
    assert_eq!(value(&result, "monthlyPayment"), "1000");
    assert_eq!(value(&result, "totalPayment"), "360000");
    assert_eq!(value(&result, "totalInterest"), "0");
}

#[test]
fn fuel_reports_litres_cost_and_mpg_equivalents() {
    let result = run(
        WorksheetId::Fuel,
        &[
            ("distance", "500"),
            ("consumption", "7.5"),
            ("pricePerLiter", "7.5"),
        ],
    );
    assert_eq!(value(&result, "totalFuel"), "37.5");
    assert_eq!(value(&result, "totalCost"), "281.25");
    assert_eq!(value(&result, "mpgUs"), "31.36");
    assert_eq!(value(&result, "mpgUk"), "37.66");
}

#[test]
fn lease_uses_money_factor_and_tax() {
    let result = run(
        WorksheetId::Lease,
        &[
            ("price", "300000"),
            ("residual", "150000"),
            ("months", "36"),
            ("apr", "5"),
            ("taxRate", "0"),
        ],
    );
    assert_eq!(value(&result, "monthlyPayment"), "5104.17");
    assert_eq!(value(&result, "totalCost"), "183750.12");
    assert_eq!(value(&result, "rentCharge"), "33750");

    let taxed = compute(
        WorksheetId::Lease,
        &inputs(&[
            ("price", "300000"),
            ("residual", "150000"),
            ("months", "36"),
            ("apr", "5"),
            ("taxRate", "8"),
        ]),
    )
    .unwrap();
    assert_eq!(value(&taxed, "monthlyPayment"), "5512.5");
    assert_eq!(value(&taxed, "totalCost"), "198450");
}

#[test]
fn rejects_out_of_range_and_non_integer_fields() {
    let cases = [
        (
            WorksheetId::Mortgage,
            vec![("principal", "0"), ("annualRate", "4.2"), ("years", "30")],
            "principal",
        ),
        (
            WorksheetId::Mortgage,
            vec![
                ("principal", "1000"),
                ("annualRate", "4.2"),
                ("years", "30.5"),
            ],
            "years",
        ),
        (
            WorksheetId::Fuel,
            vec![
                ("distance", "500"),
                ("consumption", "0"),
                ("pricePerLiter", "7"),
            ],
            "consumption",
        ),
        (
            WorksheetId::Lease,
            vec![
                ("price", "300000"),
                ("residual", "150000"),
                ("months", "0"),
                ("apr", "5"),
                ("taxRate", "0"),
            ],
            "months",
        ),
    ];

    for (id, pairs, expected) in cases {
        let error = compute(id, &inputs(&pairs)).unwrap_err();
        assert_eq!(error.code, ErrorCode::InvalidInput, "{expected}");
        assert_eq!(error.args, vec![expected.to_owned()], "{expected}");
    }
}

#[test]
fn lease_requires_residual_below_price() {
    let error = compute(
        WorksheetId::Lease,
        &inputs(&[
            ("price", "300000"),
            ("residual", "300000"),
            ("months", "36"),
            ("apr", "5"),
            ("taxRate", "0"),
        ]),
    )
    .unwrap_err();
    assert_eq!(error.code, ErrorCode::InvalidInput);
    assert_eq!(error.args, vec!["residualBelowPrice".to_owned()]);
}

#[test]
fn missing_field_is_reported_by_id() {
    let error = compute(
        WorksheetId::Mortgage,
        &inputs(&[("principal", "1000000"), ("years", "30")]),
    )
    .unwrap_err();
    assert_eq!(error.code, ErrorCode::InvalidInput);
    assert_eq!(error.args, vec!["annualRate".to_owned()]);
}

#[test]
fn extreme_mortgage_terms_overflow_instead_of_panicking() {
    let error = compute(
        WorksheetId::Mortgage,
        &inputs(&[
            ("principal", "1000000000000"),
            ("annualRate", "100"),
            ("years", "50"),
        ]),
    )
    .unwrap_err();
    assert_eq!(error.code, ErrorCode::Overflow);
}

#[test]
fn catalog_lists_three_sheets_in_navigation_order() {
    let catalog = catalog();
    let ids: Vec<WorksheetId> = catalog.worksheets.iter().map(|sheet| sheet.id).collect();
    assert_eq!(
        ids,
        vec![WorksheetId::Mortgage, WorksheetId::Fuel, WorksheetId::Lease]
    );
    assert_eq!(catalog.worksheets[0].fields.len(), 3);
    assert_eq!(catalog.worksheets[1].results.len(), 4);
    assert_eq!(catalog.worksheets[2].fields[2].id, "months");
}
