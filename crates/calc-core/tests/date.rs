//! T14 date rules: leap years, month-end clamping, calendar borrow, bounds.

use calc_core::date::{difference, iso, parse, shift};
use calc_core::{DateDifference, DateShift, ErrorCode};

fn diff(from: &str, to: &str) -> DateDifference {
    difference(from, to).unwrap()
}

fn shifted(date: &str, years: i32, months: i32, weeks: i32, days: i32) -> String {
    iso(shift(date, years, months, weeks, days).unwrap())
}

#[test]
fn parses_only_strict_iso_dates() {
    assert_eq!(iso(parse("2024-02-29").unwrap()), "2024-02-29");
    assert_eq!(iso(parse("0001-01-01").unwrap()), "0001-01-01");
    assert_eq!(iso(parse("9999-12-31").unwrap()), "9999-12-31");

    for invalid in [
        "2023-02-29",
        "2024-02-30",
        "2023-13-01",
        "2024-00-10",
        "2024-1-01",
        "2024-01-1",
        "24-01-01",
        "2024/01/01",
        "2024-01-01 ",
        "",
    ] {
        assert_eq!(
            parse(invalid).unwrap_err().code,
            ErrorCode::InvalidInput,
            "{invalid} should be rejected"
        );
    }
}

#[test]
fn difference_uses_calendar_components() {
    let same = diff("2024-02-29", "2024-02-29");
    assert_eq!((same.years, same.months, same.days), (0, 0, 0));
    assert_eq!(same.total_days, 0);
    assert_eq!(same.total_weeks, 0);

    let leap_year = diff("2024-01-01", "2025-01-01");
    assert_eq!(
        (leap_year.years, leap_year.months, leap_year.days),
        (1, 0, 0)
    );
    assert_eq!(leap_year.total_days, 366);
    assert_eq!(leap_year.total_weeks, 52);

    let common_year = diff("2023-01-01", "2024-01-01");
    assert_eq!(
        (common_year.years, common_year.months, common_year.days),
        (1, 0, 0)
    );
    assert_eq!(common_year.total_days, 365);

    let month_end = diff("2024-01-31", "2024-03-01");
    assert_eq!(
        (month_end.years, month_end.months, month_end.days),
        (0, 1, 1)
    );
    assert_eq!(month_end.total_days, 30);

    let clamped_year = diff("2024-02-29", "2025-02-28");
    assert_eq!(
        (clamped_year.years, clamped_year.months, clamped_year.days),
        (1, 0, 0)
    );
    assert_eq!(clamped_year.total_days, 365);

    let cross_year = diff("2023-12-31", "2024-01-01");
    assert_eq!(
        (cross_year.years, cross_year.months, cross_year.days),
        (0, 0, 1)
    );

    let years_months_days = diff("2020-01-31", "2024-03-01");
    assert_eq!(
        (
            years_months_days.years,
            years_months_days.months,
            years_months_days.days
        ),
        (4, 1, 1)
    );
}

#[test]
fn reverse_difference_keeps_components_but_flips_totals() {
    let reverse = diff("2024-03-01", "2024-01-31");
    assert_eq!((reverse.years, reverse.months, reverse.days), (0, 1, 1));
    assert_eq!(reverse.total_days, -30);
    assert_eq!(reverse.total_weeks, -4);
}

#[test]
fn shift_clamps_to_month_end_and_respects_leap_years() {
    assert_eq!(shifted("2024-01-31", 0, 1, 0, 0), "2024-02-29");
    assert_eq!(shifted("2023-01-31", 0, 1, 0, 0), "2023-02-28");
    assert_eq!(shifted("2024-03-31", 0, -1, 0, 0), "2024-02-29");
    assert_eq!(shifted("2024-02-29", 1, 0, 0, 0), "2025-02-28");
    assert_eq!(shifted("2024-02-29", 4, 0, 0, 0), "2028-02-29");

    assert_eq!(shifted("2024-02-28", 0, 0, 0, 1), "2024-02-29");
    assert_eq!(shifted("2023-02-28", 0, 0, 0, 1), "2023-03-01");
    assert_eq!(shifted("2023-12-31", 0, 0, 0, 1), "2024-01-01");
    assert_eq!(shifted("2024-03-01", 0, 0, 0, -1), "2024-02-29");
    assert_eq!(shifted("2024-02-15", 0, 0, 2, 0), "2024-02-29");

    assert_eq!(shifted("2024-01-31", 0, 1, 0, 1), "2024-03-01");
    assert_eq!(shifted("2024-01-31", 1, 1, 0, 0), "2025-02-28");
    assert_eq!(shifted("2025-02-28", -1, 0, 0, 0), "2024-02-28");
}

#[test]
fn shift_rejects_invalid_dates_and_out_of_range_results() {
    assert_eq!(
        shift("2023-02-29", 0, 0, 0, 1).unwrap_err().code,
        ErrorCode::InvalidInput
    );
    assert_eq!(
        shift("9999-12-31", 0, 0, 0, 1).unwrap_err().code,
        ErrorCode::Overflow
    );
    assert_eq!(
        shift("0001-01-01", 0, 0, 0, -1).unwrap_err().code,
        ErrorCode::Overflow
    );
    assert_eq!(
        shift("2024-01-01", i32::MAX, 0, 0, 0).unwrap_err().code,
        ErrorCode::InvalidInput
    );
    assert_eq!(
        difference("2024-01-01", "2024-02-30").unwrap_err().code,
        ErrorCode::InvalidInput
    );
}

#[test]
fn views_serialize_as_camel_case() {
    let difference = DateDifference {
        years: 1,
        months: 2,
        days: 3,
        total_days: 428,
        total_weeks: 61,
    };
    let json = serde_json::to_value(&difference).unwrap();
    assert_eq!(json["totalDays"], 428);
    assert_eq!(json["totalWeeks"], 61);
    assert!(json.get("total_days").is_none());

    let shifted = DateShift {
        date: "2024-02-29".to_owned(),
    };
    let json = serde_json::to_value(&shifted).unwrap();
    assert_eq!(json["date"], "2024-02-29");
}
