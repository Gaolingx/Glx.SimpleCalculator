//! T12 acceptance tests: eleven unit categories, goldens per category,
//! temperature round trips, currency cross rates and error paths.

use std::str::FromStr;

use calc_core::units;
use calc_core::{ErrorCode, RateTable, UnitCategory};
use rust_decimal::Decimal;

fn convert(category: UnitCategory, value: &str, from: &str, to: &str) -> String {
    calc_core::value::canonical(units::convert(category, value, from, to, None).unwrap())
}

fn assert_decimal(actual: &str, expected: &str) {
    let actual = Decimal::from_str(actual).unwrap();
    let expected = Decimal::from_str(expected).unwrap();
    assert_eq!(
        actual.round_dp(10),
        expected.round_dp(10),
        "{actual} != {expected}"
    );
}

#[test]
fn every_category_has_three_golden_conversions() {
    let goldens = [
        (UnitCategory::Length, "1", "km", "m", "1000"),
        (UnitCategory::Length, "1", "mi", "m", "1609.344"),
        (UnitCategory::Length, "1", "in", "mm", "25.4"),
        (UnitCategory::Area, "1", "ha", "m2", "10000"),
        (UnitCategory::Area, "1", "acre", "m2", "4046.8564224"),
        (UnitCategory::Area, "1", "ft2", "m2", "0.09290304"),
        (UnitCategory::Volume, "1", "m3", "l", "1000"),
        (UnitCategory::Volume, "1", "gal_us", "l", "3.785411784"),
        (UnitCategory::Volume, "1", "gal_uk", "l", "4.54609"),
        (UnitCategory::Mass, "1", "kg", "g", "1000"),
        (UnitCategory::Mass, "1", "lb", "kg", "0.45359237"),
        (UnitCategory::Mass, "1", "st", "lb", "14"),
        (UnitCategory::Temperature, "0", "c", "f", "32"),
        (UnitCategory::Temperature, "100", "c", "f", "212"),
        (UnitCategory::Temperature, "0", "c", "k", "273.15"),
        (UnitCategory::Speed, "1", "mps", "kmh", "3.6"),
        (UnitCategory::Speed, "1", "mph", "kmh", "1.609344"),
        (UnitCategory::Speed, "1", "kn", "kmh", "1.852"),
        (UnitCategory::Angle, "100", "grad", "deg", "90"),
        (UnitCategory::Angle, "1", "turn", "deg", "360"),
        (UnitCategory::Angle, "60", "arcmin", "deg", "1"),
        (UnitCategory::Pressure, "1", "kpa", "pa", "1000"),
        (UnitCategory::Pressure, "1", "bar", "kpa", "100"),
        (UnitCategory::Pressure, "1", "atm", "pa", "101325"),
        (UnitCategory::Power, "1", "kw", "w", "1000"),
        (UnitCategory::Power, "1", "hp", "w", "745.69987158227022"),
        (UnitCategory::Power, "1", "ps", "w", "735.49875"),
        (UnitCategory::Time, "1", "h", "min", "60"),
        (UnitCategory::Time, "1", "d", "h", "24"),
        (UnitCategory::Time, "1", "wk", "d", "7"),
    ];

    for (category, value, from, to, expected) in goldens {
        assert_decimal(&convert(category, value, from, to), expected);
    }
}

#[test]
fn temperature_round_trips_across_all_three_scales() {
    for value in ["-40", "0", "37", "98.6", "100"] {
        let fahrenheit = convert(UnitCategory::Temperature, value, "c", "f");
        let back = convert(UnitCategory::Temperature, &fahrenheit, "f", "c");
        assert_decimal(&back, value);

        let kelvin = convert(UnitCategory::Temperature, value, "c", "k");
        let back = convert(UnitCategory::Temperature, &kelvin, "k", "c");
        assert_decimal(&back, value);
    }
}

#[test]
fn currency_uses_injected_cross_rates() {
    let mut rates = RateTable::new();
    rates.insert("USD", Decimal::from_str("1.1").unwrap());
    rates.insert("CNY", Decimal::from_str("7.92").unwrap());

    let usd_to_cny = units::convert(UnitCategory::Currency, "10", "usd", "cny", Some(&rates));
    assert_decimal(
        &calc_core::value::canonical(usd_to_cny.unwrap().round_dp(6)),
        "72",
    );

    let eur_to_usd = units::convert(UnitCategory::Currency, "100", "eur", "usd", Some(&rates));
    assert_decimal(&calc_core::value::canonical(eur_to_usd.unwrap()), "110");

    let cny_to_eur = units::convert(UnitCategory::Currency, "100", "cny", "eur", Some(&rates));
    assert_decimal(
        &calc_core::value::canonical(cny_to_eur.unwrap().round_dp(6)),
        "12.626263",
    );

    assert_eq!(
        units::convert(UnitCategory::Currency, "10", "usd", "cny", None)
            .unwrap_err()
            .code,
        ErrorCode::CurrencyOffline
    );
}

#[test]
fn validation_reports_stable_error_codes() {
    let unknown = units::convert(UnitCategory::Length, "1", "parsec", "m", None).unwrap_err();
    assert_eq!(unknown.code, ErrorCode::UnknownUnit);
    assert_eq!(unknown.args, ["parsec"]);

    assert_eq!(
        units::convert(UnitCategory::Mass, "-2", "kg", "g", None)
            .unwrap_err()
            .code,
        ErrorCode::InvalidInput
    );
    assert_eq!(
        units::convert(UnitCategory::Length, "1..2", "m", "ft", None)
            .unwrap_err()
            .code,
        ErrorCode::InvalidInput
    );
    assert!(units::convert(UnitCategory::Temperature, "-2", "c", "f", None).is_ok());
}

#[test]
fn catalog_exposes_all_categories_in_navigation_order() {
    let catalog = units::catalog();
    let ids: Vec<_> = catalog
        .categories
        .iter()
        .map(|category| category.id)
        .collect();
    assert_eq!(
        ids,
        [
            UnitCategory::Currency,
            UnitCategory::Length,
            UnitCategory::Area,
            UnitCategory::Volume,
            UnitCategory::Mass,
            UnitCategory::Temperature,
            UnitCategory::Speed,
            UnitCategory::Angle,
            UnitCategory::Pressure,
            UnitCategory::Power,
            UnitCategory::Time,
        ]
    );
    assert!(
        catalog
            .categories
            .iter()
            .all(|category| !category.units.is_empty())
    );
}
