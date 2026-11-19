//! ECB fixture parsing and the currency conversion branches used by the shell.
//!
//! Network access is never exercised here; the fixture mirrors the ECB daily
//! document so parsing, caching metadata and offline behaviour stay testable.

use calc_core::{ErrorCode, UnitCategory, value};
use glx_calculator_lib::currency::{CurrencyCache, TTL_MS, parse_ecb};

const FIXTURE: &str = include_str!("fixtures/eurofxref-daily.xml");

fn parsed() -> CurrencyCache {
    parse_ecb(FIXTURE).expect("fixture parses")
}

fn convert(cache: &CurrencyCache, amount: &str, from: &str, to: &str) -> String {
    let rates = cache.rate_table();
    let converted =
        calc_core::units::convert(UnitCategory::Currency, amount, from, to, rates.as_ref())
            .expect("conversion succeeds");
    value::canonical(converted)
}

#[test]
fn fixture_yields_ecb_date_and_rates() {
    let cache = parsed();
    assert_eq!(cache.base, "EUR");
    assert_eq!(cache.date.as_deref(), Some("2026-11-18"));
    assert_eq!(cache.rates.len(), 5);
    assert_eq!(cache.rates["CNY"], "7.9214");
    assert!(!cache.rates.contains_key("EUR"), "EUR is the implicit base");
}

#[test]
fn fetches_set_freshness_but_parsing_does_not() {
    let mut cache = parsed();
    assert_eq!(cache.fetched_at, None);
    assert!(cache.is_stale(0));

    cache.fetched_at = Some(1_000);
    assert!(!cache.is_stale(1_000));
    assert!(!cache.is_stale(1_000 + TTL_MS));
    assert!(cache.is_stale(1_000 + TTL_MS + 1));
}

#[test]
fn currency_conversion_uses_cross_rates() {
    let cache = parsed();
    assert_eq!(convert(&cache, "100", "eur", "usd"), "115.85");
    assert_eq!(convert(&cache, "115.85", "usd", "eur"), "100");

    let cny = parsed();
    let rates = cny.rate_table();
    let per_usd =
        calc_core::units::convert(UnitCategory::Currency, "1", "usd", "cny", rates.as_ref())
            .unwrap();
    assert_eq!(value::canonical(per_usd.round_dp(4)), "6.8376");
}

#[test]
fn without_a_cache_currency_stays_offline() {
    let empty = CurrencyCache::default();
    assert!(empty.rate_table().is_none());

    let error =
        calc_core::units::convert(UnitCategory::Currency, "1", "eur", "usd", None).unwrap_err();
    assert_eq!(error.code, ErrorCode::CurrencyOffline);

    let table = empty.rate_table();
    let error =
        calc_core::units::convert(UnitCategory::Currency, "1", "eur", "usd", table.as_ref())
            .unwrap_err();
    assert_eq!(error.code, ErrorCode::CurrencyOffline);
}

#[test]
fn malformed_documents_fail_without_touching_the_cache() {
    assert_eq!(
        parse_ecb("<Cube time=\"2026-11-18\"><Cube currency=\"USD\" rate=\"x\"/></Cube>")
            .unwrap_err()
            .code,
        ErrorCode::NetworkError
    );
}
