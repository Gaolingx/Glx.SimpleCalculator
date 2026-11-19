//! Unit registry and pure conversions (HANDOFF §3.10.3, §6.0 T12).
//!
//! Every category has a base unit; linear units store their multiplier to that
//! base as a decimal string. Temperature is affine and handled explicitly so
//! `(x - 32) * 5 / 9` keeps all available Decimal precision. Currency rates are
//! supplied by the caller (T13 owns fetching and caching); without a rate table
//! currency conversion reports `CurrencyOffline` instead of guessing.

use std::collections::BTreeMap;
use std::str::FromStr;

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use crate::error::{CalcResult, ErrorCode, ErrorInfo};
use crate::value;
use crate::view::{UnitCatalog, UnitCategoryInfo, UnitInfo};

/// The eleven converter categories exposed by the UI, in navigation order.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum UnitCategory {
    Currency,
    Length,
    Area,
    Volume,
    Mass,
    Temperature,
    Speed,
    Angle,
    Pressure,
    Power,
    Time,
}

impl UnitCategory {
    pub const ALL: [Self; 11] = [
        Self::Currency,
        Self::Length,
        Self::Area,
        Self::Volume,
        Self::Mass,
        Self::Temperature,
        Self::Speed,
        Self::Angle,
        Self::Pressure,
        Self::Power,
        Self::Time,
    ];

    /// Negative magnitudes only make sense for signed quantities.
    const fn allows_negative(self) -> bool {
        matches!(
            self,
            Self::Currency | Self::Temperature | Self::Speed | Self::Angle
        )
    }
}

/// Static unit metadata. `factor` is the multiplier to the category base unit;
/// `None` marks affine (temperature) or rate-driven (currency) units.
pub struct UnitDef {
    pub id: &'static str,
    pub symbol: &'static str,
    factor: Option<&'static str>,
}

const fn linear(id: &'static str, symbol: &'static str, factor: &'static str) -> UnitDef {
    UnitDef {
        id,
        symbol,
        factor: Some(factor),
    }
}

const fn special(id: &'static str, symbol: &'static str) -> UnitDef {
    UnitDef {
        id,
        symbol,
        factor: None,
    }
}

const LENGTH: &[UnitDef] = &[
    linear("m", "m", "1"),
    linear("km", "km", "1000"),
    linear("cm", "cm", "0.01"),
    linear("mm", "mm", "0.001"),
    linear("mi", "mi", "1609.344"),
    linear("yd", "yd", "0.9144"),
    linear("ft", "ft", "0.3048"),
    linear("in", "in", "0.0254"),
    linear("nmi", "nmi", "1852"),
];

const AREA: &[UnitDef] = &[
    linear("m2", "m²", "1"),
    linear("km2", "km²", "1000000"),
    linear("cm2", "cm²", "0.0001"),
    linear("ha", "ha", "10000"),
    linear("acre", "acre", "4046.8564224"),
    linear("ft2", "ft²", "0.09290304"),
    linear("in2", "in²", "0.00064516"),
    linear("mi2", "mi²", "2589988.110336"),
    linear("yd2", "yd²", "0.83612736"),
];

const VOLUME: &[UnitDef] = &[
    linear("l", "L", "1"),
    linear("ml", "mL", "0.001"),
    linear("m3", "m³", "1000"),
    linear("cm3", "cm³", "0.001"),
    linear("gal_us", "gal (US)", "3.785411784"),
    linear("qt_us", "qt (US)", "0.946352946"),
    linear("pt_us", "pt (US)", "0.473176473"),
    linear("cup_us", "cup (US)", "0.2365882365"),
    linear("floz_us", "fl oz (US)", "0.0295735295625"),
    linear("gal_uk", "gal (UK)", "4.54609"),
    linear("ft3", "ft³", "28.316846592"),
    linear("in3", "in³", "0.016387064"),
];

const MASS: &[UnitDef] = &[
    linear("kg", "kg", "1"),
    linear("g", "g", "0.001"),
    linear("mg", "mg", "0.000001"),
    linear("t", "t", "1000"),
    linear("lb", "lb", "0.45359237"),
    linear("oz", "oz", "0.028349523125"),
    linear("st", "st", "6.35029318"),
];

const TEMPERATURE: &[UnitDef] = &[special("c", "°C"), special("f", "°F"), special("k", "K")];

const SPEED: &[UnitDef] = &[
    linear("kmh", "km/h", "1"),
    linear("mps", "m/s", "3.6"),
    linear("mph", "mph", "1.609344"),
    linear("fts", "ft/s", "1.09728"),
    linear("kn", "kn", "1.852"),
];

const ANGLE: &[UnitDef] = &[
    linear("deg", "°", "1"),
    linear("rad", "rad", "57.29577951308232087679815481"),
    linear("grad", "grad", "0.9"),
    linear("turn", "turn", "360"),
    linear("arcmin", "′", "0.0166666666666666666666666667"),
    linear("arcsec", "″", "0.0002777777777777777777777778"),
];

const PRESSURE: &[UnitDef] = &[
    linear("pa", "Pa", "1"),
    linear("kpa", "kPa", "1000"),
    linear("mpa", "MPa", "1000000"),
    linear("bar", "bar", "100000"),
    linear("mbar", "mbar", "100"),
    linear("psi", "psi", "6894.757293168361336722673"),
    linear("atm", "atm", "101325"),
    linear("mmhg", "mmHg", "133.322387415"),
];

const POWER: &[UnitDef] = &[
    linear("w", "W", "1"),
    linear("kw", "kW", "1000"),
    linear("mw", "MW", "1000000"),
    linear("hp", "hp", "745.69987158227022"),
    linear("ps", "PS", "735.49875"),
];

const TIME: &[UnitDef] = &[
    linear("s", "s", "1"),
    linear("ms", "ms", "0.001"),
    linear("us", "µs", "0.000001"),
    linear("min", "min", "60"),
    linear("h", "h", "3600"),
    linear("d", "d", "86400"),
    linear("wk", "wk", "604800"),
];

/// ECB daily reference currencies (EUR base, no RUB). Rates are injected by the
/// caller; the registry only fixes identity and display order.
const CURRENCY: &[UnitDef] = &[
    special("eur", "EUR"),
    special("usd", "USD"),
    special("jpy", "JPY"),
    special("czk", "CZK"),
    special("dkk", "DKK"),
    special("gbp", "GBP"),
    special("huf", "HUF"),
    special("pln", "PLN"),
    special("ron", "RON"),
    special("sek", "SEK"),
    special("chf", "CHF"),
    special("isk", "ISK"),
    special("nok", "NOK"),
    special("try", "TRY"),
    special("aud", "AUD"),
    special("brl", "BRL"),
    special("cad", "CAD"),
    special("cny", "CNY"),
    special("hkd", "HKD"),
    special("idr", "IDR"),
    special("ils", "ILS"),
    special("inr", "INR"),
    special("krw", "KRW"),
    special("mxn", "MXN"),
    special("myr", "MYR"),
    special("nzd", "NZD"),
    special("php", "PHP"),
    special("sgd", "SGD"),
    special("thb", "THB"),
    special("zar", "ZAR"),
];

fn units_for(category: UnitCategory) -> &'static [UnitDef] {
    match category {
        UnitCategory::Currency => CURRENCY,
        UnitCategory::Length => LENGTH,
        UnitCategory::Area => AREA,
        UnitCategory::Volume => VOLUME,
        UnitCategory::Mass => MASS,
        UnitCategory::Temperature => TEMPERATURE,
        UnitCategory::Speed => SPEED,
        UnitCategory::Angle => ANGLE,
        UnitCategory::Pressure => PRESSURE,
        UnitCategory::Power => POWER,
        UnitCategory::Time => TIME,
    }
}

fn find(category: UnitCategory, id: &str) -> CalcResult<&'static UnitDef> {
    units_for(category)
        .iter()
        .find(|unit| unit.id == id)
        .ok_or_else(|| ErrorInfo::with_args(ErrorCode::UnknownUnit, vec![id.to_owned()]))
}

fn factor(unit: &UnitDef) -> Decimal {
    unit.factor
        .and_then(|text| Decimal::from_str(text).ok())
        .expect("static unit factors are valid decimals")
}

fn overflow() -> ErrorInfo {
    ErrorInfo::new(ErrorCode::Overflow)
}

/// EUR-based rate table. `rate(code)` is "1 EUR = rate(code)".
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct RateTable {
    rates: BTreeMap<String, Decimal>,
}

impl RateTable {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn insert(&mut self, code: &str, rate: Decimal) {
        self.rates.insert(code.to_ascii_uppercase(), rate);
    }

    pub fn rate(&self, code: &str) -> Option<Decimal> {
        if code.eq_ignore_ascii_case("EUR") {
            return Some(Decimal::ONE);
        }
        self.rates.get(&code.to_ascii_uppercase()).copied()
    }
}

/// Converts `value` from one unit of `category` to another.
///
/// `rates` is required for currencies and ignored otherwise. Errors are
/// language-neutral: `UNKNOWN_UNIT` (with the offending id in `args`),
/// `INVALID_INPUT` (malformed or negative where disallowed), `OVERFLOW`, and
/// `CURRENCY_OFFLINE` when no rate is available.
pub fn convert(
    category: UnitCategory,
    value: &str,
    from: &str,
    to: &str,
    rates: Option<&RateTable>,
) -> CalcResult<Decimal> {
    let from_unit = find(category, from)?;
    let to_unit = find(category, to)?;
    let amount = value::parse(value)?;

    if amount.is_sign_negative() && !category.allows_negative() {
        return Err(ErrorInfo::new(ErrorCode::InvalidInput));
    }

    if from_unit.id == to_unit.id {
        return Ok(amount);
    }

    match category {
        UnitCategory::Currency => {
            let Some(rates) = rates else {
                return Err(ErrorInfo::new(ErrorCode::CurrencyOffline));
            };
            let from_rate = rates
                .rate(from_unit.id)
                .ok_or_else(|| ErrorInfo::new(ErrorCode::CurrencyOffline))?;
            let to_rate = rates
                .rate(to_unit.id)
                .ok_or_else(|| ErrorInfo::new(ErrorCode::CurrencyOffline))?;
            amount
                .checked_div(from_rate)
                .and_then(|base| base.checked_mul(to_rate))
                .ok_or_else(overflow)
        }
        UnitCategory::Temperature => temperature::convert(amount, from_unit.id, to_unit.id),
        _ => amount
            .checked_mul(factor(from_unit))
            .and_then(|base| base.checked_div(factor(to_unit)))
            .ok_or_else(overflow),
    }
}

pub fn catalog() -> UnitCatalog {
    UnitCatalog {
        categories: UnitCategory::ALL
            .iter()
            .map(|category| UnitCategoryInfo {
                id: *category,
                units: units_for(*category)
                    .iter()
                    .map(|unit| UnitInfo {
                        id: unit.id.to_owned(),
                        symbol: unit.symbol.to_owned(),
                    })
                    .collect(),
            })
            .collect(),
    }
}

mod temperature {
    use super::*;

    fn to_celsius(value: Decimal, id: &str) -> CalcResult<Decimal> {
        match id {
            "c" => Ok(value),
            "f" => value
                .checked_sub(Decimal::from(32))
                .and_then(|v| v.checked_mul(Decimal::from(5)))
                .and_then(|v| v.checked_div(Decimal::from(9)))
                .ok_or_else(overflow),
            "k" => value
                .checked_sub(Decimal::new(27315, 2))
                .ok_or_else(overflow),
            _ => unreachable!("temperature units are fixed"),
        }
    }

    fn from_celsius(value: Decimal, id: &str) -> CalcResult<Decimal> {
        match id {
            "c" => Ok(value),
            "f" => value
                .checked_mul(Decimal::from(9))
                .and_then(|v| v.checked_div(Decimal::from(5)))
                .and_then(|v| v.checked_add(Decimal::from(32)))
                .ok_or_else(overflow),
            "k" => value
                .checked_add(Decimal::new(27315, 2))
                .ok_or_else(overflow),
            _ => unreachable!("temperature units are fixed"),
        }
    }

    pub(super) fn convert(value: Decimal, from: &str, to: &str) -> CalcResult<Decimal> {
        from_celsius(to_celsius(value, from)?, to)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dec(raw: &str) -> Decimal {
        Decimal::from_str(raw).unwrap()
    }

    fn convert_linear(category: UnitCategory, value: &str, from: &str, to: &str) -> String {
        value::canonical(convert(category, value, from, to, None).unwrap())
    }

    #[test]
    fn length_conversions_are_exact() {
        assert_eq!(convert_linear(UnitCategory::Length, "1", "km", "m"), "1000");
        assert_eq!(
            convert_linear(UnitCategory::Length, "1", "mi", "m"),
            "1609.344"
        );
        assert_eq!(
            convert_linear(UnitCategory::Length, "1", "ft", "m"),
            "0.3048"
        );
        assert_eq!(
            convert_linear(UnitCategory::Length, "1", "in", "mm"),
            "25.4"
        );
    }

    #[test]
    fn area_conversions_are_exact() {
        assert_eq!(convert_linear(UnitCategory::Area, "1", "ha", "m2"), "10000");
        assert_eq!(
            convert_linear(UnitCategory::Area, "1", "acre", "m2"),
            "4046.8564224"
        );
        assert_eq!(
            convert_linear(UnitCategory::Area, "1", "ft2", "m2"),
            "0.09290304"
        );
    }

    #[test]
    fn volume_conversions_are_exact() {
        assert_eq!(convert_linear(UnitCategory::Volume, "1", "m3", "l"), "1000");
        assert_eq!(
            convert_linear(UnitCategory::Volume, "1", "gal_us", "l"),
            "3.785411784"
        );
        assert_eq!(
            convert_linear(UnitCategory::Volume, "1", "gal_uk", "l"),
            "4.54609"
        );
    }

    #[test]
    fn mass_conversions_are_exact() {
        assert_eq!(convert_linear(UnitCategory::Mass, "1", "kg", "g"), "1000");
        assert_eq!(
            convert_linear(UnitCategory::Mass, "1", "lb", "kg"),
            "0.45359237"
        );
        assert_eq!(
            convert_linear(UnitCategory::Mass, "1", "oz", "g"),
            "28.349523125"
        );
    }

    #[test]
    fn temperature_is_affine_and_round_trips() {
        assert_eq!(
            convert_linear(UnitCategory::Temperature, "0", "c", "f"),
            "32"
        );
        assert_eq!(
            convert_linear(UnitCategory::Temperature, "100", "c", "f"),
            "212"
        );
        assert_eq!(
            convert_linear(UnitCategory::Temperature, "32", "f", "c"),
            "0"
        );
        assert_eq!(
            convert_linear(UnitCategory::Temperature, "0", "c", "k"),
            "273.15"
        );
        assert_eq!(
            convert_linear(UnitCategory::Temperature, "273.15", "k", "c"),
            "0"
        );
        assert_eq!(
            convert_linear(UnitCategory::Temperature, "-40", "f", "c"),
            "-40"
        );

        let f = convert(UnitCategory::Temperature, "98.6", "f", "c", None).unwrap();
        let back = convert(
            UnitCategory::Temperature,
            &value::canonical(f),
            "c",
            "f",
            None,
        )
        .unwrap();
        assert_eq!(value::canonical(back), "98.6");
    }

    #[test]
    fn speed_conversions_are_exact() {
        assert_eq!(
            convert_linear(UnitCategory::Speed, "1", "mps", "kmh"),
            "3.6"
        );
        assert_eq!(
            convert_linear(UnitCategory::Speed, "1", "mph", "kmh"),
            "1.609344"
        );
        assert_eq!(
            convert_linear(UnitCategory::Speed, "1", "kn", "kmh"),
            "1.852"
        );
    }

    #[test]
    fn angle_conversions_match_known_values() {
        assert_eq!(
            convert_linear(UnitCategory::Angle, "100", "grad", "deg"),
            "90"
        );
        assert_eq!(
            convert_linear(UnitCategory::Angle, "1", "turn", "deg"),
            "360"
        );
        let radians = convert(UnitCategory::Angle, "180", "deg", "rad", None).unwrap();
        assert_eq!(value::canonical(radians.round_dp(12)), "3.14159265359");
    }

    #[test]
    fn pressure_conversions_are_exact() {
        assert_eq!(
            convert_linear(UnitCategory::Pressure, "1", "kpa", "pa"),
            "1000"
        );
        assert_eq!(
            convert_linear(UnitCategory::Pressure, "1", "bar", "kpa"),
            "100"
        );
        assert_eq!(
            convert_linear(UnitCategory::Pressure, "1", "atm", "pa"),
            "101325"
        );
    }

    #[test]
    fn power_conversions_are_exact() {
        assert_eq!(convert_linear(UnitCategory::Power, "1", "kw", "w"), "1000");
        assert_eq!(
            convert_linear(UnitCategory::Power, "1", "hp", "w"),
            "745.69987158227022"
        );
        assert_eq!(
            convert_linear(UnitCategory::Power, "1", "ps", "w"),
            "735.49875"
        );
    }

    #[test]
    fn time_conversions_are_exact() {
        assert_eq!(convert_linear(UnitCategory::Time, "1", "h", "min"), "60");
        assert_eq!(convert_linear(UnitCategory::Time, "1", "d", "h"), "24");
        assert_eq!(convert_linear(UnitCategory::Time, "1", "wk", "d"), "7");
    }

    #[test]
    fn currency_requires_rates_and_uses_cross_rates() {
        assert_eq!(
            convert(UnitCategory::Currency, "1", "usd", "usd", None),
            Ok(Decimal::ONE)
        );
        assert_eq!(
            convert(UnitCategory::Currency, "100", "eur", "usd", None)
                .unwrap_err()
                .code,
            ErrorCode::CurrencyOffline
        );

        let mut rates = RateTable::new();
        rates.insert("USD", dec("1.1"));
        rates.insert("CNY", dec("7.92"));
        let rates = Some(&rates);

        let usd_to_cny = convert(UnitCategory::Currency, "10", "usd", "cny", rates).unwrap();
        assert_eq!(value::canonical(usd_to_cny.round_dp(6)), "72");

        let eur_to_usd = convert(UnitCategory::Currency, "100", "eur", "usd", rates).unwrap();
        assert_eq!(value::canonical(eur_to_usd), "110");

        let cny_to_eur = convert(UnitCategory::Currency, "100", "cny", "eur", rates).unwrap();
        assert_eq!(value::canonical(cny_to_eur.round_dp(6)), "12.626263");
    }

    #[test]
    fn rejects_unknown_units_and_bad_values() {
        let missing = convert(UnitCategory::Length, "1", "furlong", "m", None).unwrap_err();
        assert_eq!(missing.code, ErrorCode::UnknownUnit);
        assert_eq!(missing.args, ["furlong"]);

        assert_eq!(
            convert(UnitCategory::Length, "abc", "m", "km", None)
                .unwrap_err()
                .code,
            ErrorCode::InvalidInput
        );
        assert_eq!(
            convert(UnitCategory::Length, "-1", "m", "km", None)
                .unwrap_err()
                .code,
            ErrorCode::InvalidInput
        );
        assert!(convert(UnitCategory::Temperature, "-40", "c", "f", None).is_ok());
        assert!(convert(UnitCategory::Angle, "-90", "deg", "rad", None).is_ok());
    }

    #[test]
    fn catalog_lists_every_category_with_unique_ids() {
        let catalog = catalog();
        assert_eq!(catalog.categories.len(), 11);

        let mut ids = std::collections::BTreeSet::new();
        for category in &catalog.categories {
            assert!(!category.units.is_empty(), "{:?} has no units", category.id);
            for unit in &category.units {
                assert!(!unit.symbol.is_empty());
                assert!(ids.insert(unit.id.clone()), "duplicate unit id {}", unit.id);
            }
        }
        assert!(ids.contains("km"));
        assert!(ids.contains("cny"));
    }

    #[test]
    fn unit_ids_resolve_within_their_own_category() {
        assert_eq!(
            convert(UnitCategory::Length, "1", "c", "m", None)
                .unwrap_err()
                .code,
            ErrorCode::UnknownUnit
        );
    }
}
