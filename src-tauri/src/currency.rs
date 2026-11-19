//! ECB exchange rates: fetching, parsing, caching and status (HANDOFF §3.7,
//! §3.8, T13).
//!
//! Network access and persistence live here; `calc-core` only receives the
//! parsed EUR-based table and performs pure cross-rate conversion. The cache is
//! authoritative for the UI, survives refresh failures and is refreshed in the
//! background at startup once it is older than [`TTL_MS`].

use std::collections::BTreeMap;
use std::str::FromStr;
use std::sync::{Mutex, MutexGuard};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use calc_core::units::RateTable;
use calc_core::{ErrorCode, ErrorInfo};
use quick_xml::Reader;
use quick_xml::events::Event;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_log::log::{error, warn};
use tauri_plugin_store::StoreExt;

pub const ECB_URL: &str = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";
/// Automatic refresh threshold for an existing cache.
pub const TTL_MS: i64 = 24 * 60 * 60 * 1_000;
/// Manual refreshes are limited to one request per window.
pub const MIN_REFRESH_INTERVAL: Duration = Duration::from_secs(5);

const CURRENCY_FILE: &str = "currency-cache.json";
const CURRENCY_KEY: &str = "cache";
const STATUS_SOURCE: &str = "ECB";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(8);

/// Persisted ECB snapshot (`currency-cache.json`). Rates are stored as decimal
/// strings so a hand-edited file can be validated on load.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CurrencyCache {
    pub base: String,
    /// ECB reference date (`YYYY-MM-DD`), not the fetch time.
    pub date: Option<String>,
    /// Unix epoch milliseconds of the successful fetch.
    pub fetched_at: Option<i64>,
    /// `1 EUR = rate` per ISO code; EUR itself is implicit.
    pub rates: BTreeMap<String, String>,
}

impl Default for CurrencyCache {
    fn default() -> Self {
        Self {
            base: "EUR".into(),
            date: None,
            fetched_at: None,
            rates: BTreeMap::new(),
        }
    }
}

impl CurrencyCache {
    /// Drops anything the converter could not trust: a non-EUR base, malformed
    /// codes or rates, and invalid reference dates.
    pub fn sanitized(mut self) -> Self {
        self.base = "EUR".into();
        self.date = self.date.filter(|date| valid_date(date));
        self.fetched_at = self.fetched_at.filter(|ts| *ts > 0);
        self.rates = self
            .rates
            .into_iter()
            .filter_map(|(code, raw)| {
                let code = normalize_code(&code)?;
                let rate = parse_rate(&raw)?;
                Some((code, rate.to_string()))
            })
            .collect();
        self
    }

    pub fn is_stale(&self, now_ms: i64) -> bool {
        match self.fetched_at {
            Some(fetched_at) => now_ms.saturating_sub(fetched_at) > TTL_MS,
            None => true,
        }
    }

    pub fn has_rates(&self) -> bool {
        !self.rates.is_empty()
    }

    pub fn rate_table(&self) -> Option<RateTable> {
        let mut table = RateTable::new();
        let mut any = false;
        for (code, raw) in &self.rates {
            if let Ok(rate) = Decimal::from_str(raw) {
                table.insert(code, rate);
                any = true;
            }
        }
        any.then_some(table)
    }
}

/// Serializable health/age projection for the converter page.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CurrencyStatus {
    pub source: String,
    pub base: String,
    pub date: Option<String>,
    pub fetched_at: Option<i64>,
    pub stale: bool,
    pub available: bool,
    /// True after the latest refresh attempt failed; cleared by a success.
    pub refresh_failed: bool,
}

#[derive(Default)]
struct RefreshGate {
    last_attempt: Option<Instant>,
    in_flight: bool,
}

impl RefreshGate {
    fn try_begin(&mut self, now: Instant) -> bool {
        if self.in_flight {
            return false;
        }
        if let Some(last) = self.last_attempt {
            if now.saturating_duration_since(last) < MIN_REFRESH_INTERVAL {
                return false;
            }
        }
        self.last_attempt = Some(now);
        self.in_flight = true;
        true
    }

    fn finish(&mut self) {
        self.in_flight = false;
    }
}

struct Inner {
    cache: CurrencyCache,
    gate: RefreshGate,
    refresh_failed: bool,
}

pub struct CurrencyState(Mutex<Inner>);

impl CurrencyState {
    pub fn load(app: &AppHandle) -> Self {
        Self(Mutex::new(Inner {
            cache: read_cache(app),
            gate: RefreshGate::default(),
            refresh_failed: false,
        }))
    }

    pub fn status(&self) -> CurrencyStatus {
        let inner = self.lock();
        let cache = &inner.cache;
        CurrencyStatus {
            source: STATUS_SOURCE.into(),
            base: cache.base.clone(),
            date: cache.date.clone(),
            fetched_at: cache.fetched_at,
            stale: cache.is_stale(now_ms()),
            available: cache.has_rates(),
            refresh_failed: inner.refresh_failed,
        }
    }

    pub fn rate_table(&self) -> Option<RateTable> {
        self.lock().cache.rate_table()
    }

    fn should_auto_refresh(&self) -> bool {
        let inner = self.lock();
        !inner.cache.has_rates() || inner.cache.is_stale(now_ms())
    }

    fn begin_refresh(&self) -> bool {
        self.lock().gate.try_begin(Instant::now())
    }

    fn finish_refresh(&self) {
        self.lock().gate.finish();
    }

    fn apply(&self, app: &AppHandle, cache: CurrencyCache) {
        if let Err(failure) = write_cache(app, &cache) {
            warn!("currency cache could not be persisted: {failure:?}");
        }
        let mut inner = self.lock();
        inner.cache = cache;
        inner.refresh_failed = false;
    }

    fn mark_failed(&self) {
        self.lock().refresh_failed = true;
    }

    fn lock(&self) -> MutexGuard<'_, Inner> {
        self.0
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

#[tauri::command]
pub fn currency_status(state: State<'_, CurrencyState>) -> CurrencyStatus {
    state.status()
}

#[tauri::command]
pub async fn currency_refresh(app: AppHandle) -> Result<CurrencyStatus, ErrorInfo> {
    refresh(&app).await
}

/// Startup hook: refreshes only when there is no cache or it exceeds the TTL.
pub async fn refresh_if_stale(app: &AppHandle) -> Result<CurrencyStatus, ErrorInfo> {
    if !app.state::<CurrencyState>().should_auto_refresh() {
        return Ok(app.state::<CurrencyState>().status());
    }
    refresh(app).await
}

async fn refresh(app: &AppHandle) -> Result<CurrencyStatus, ErrorInfo> {
    let state = app.state::<CurrencyState>();
    if !state.begin_refresh() {
        // Within the 5s cooldown or another refresh is running.
        return Ok(state.status());
    }

    let outcome = fetch_rates().await;
    state.finish_refresh();

    match outcome {
        Ok(cache) => {
            state.apply(app, cache);
            Ok(state.status())
        }
        Err(failure) => {
            state.mark_failed();
            warn!("ECB refresh failed, keeping the cached rates: {failure:?}");
            Err(failure)
        }
    }
}

async fn fetch_rates() -> Result<CurrencyCache, ErrorInfo> {
    let client = reqwest::Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .user_agent(concat!("GlxCalculator/", env!("CARGO_PKG_VERSION")))
        .https_only(true)
        .build()
        .map_err(|failure| network_error("build client", failure))?;

    let response = client
        .get(ECB_URL)
        .send()
        .await
        .map_err(|failure| network_error("request", failure))?
        .error_for_status()
        .map_err(|failure| network_error("status", failure))?;

    let body = response
        .text()
        .await
        .map_err(|failure| network_error("body", failure))?;

    let mut cache = parse_ecb(&body)?;
    cache.fetched_at = Some(now_ms());
    Ok(cache)
}

/// Parses the ECB daily XML. Only `Cube` attributes are read, so namespace
/// prefixes and the surrounding `gesmes:Envelope` are irrelevant.
pub fn parse_ecb(xml: &str) -> Result<CurrencyCache, ErrorInfo> {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);
    let mut cache = CurrencyCache::default();

    loop {
        match reader.read_event() {
            Ok(Event::Start(element)) | Ok(Event::Empty(element)) => {
                if element.name().as_ref() != b"Cube" {
                    continue;
                }
                let mut currency = None;
                let mut rate = None;
                let mut time = None;
                for attribute in element.attributes().with_checks(false) {
                    let Ok(attribute) = attribute else {
                        continue;
                    };
                    let Ok(value) = attribute.unescape_value() else {
                        continue;
                    };
                    match attribute.key.as_ref() {
                        b"currency" => currency = Some(value.into_owned()),
                        b"rate" => rate = Some(value.into_owned()),
                        b"time" => time = Some(value.into_owned()),
                        _ => {}
                    }
                }
                if let Some(time) = time.filter(|time| valid_date(time)) {
                    cache.date = Some(time);
                }
                if let (Some(currency), Some(rate)) = (currency, rate) {
                    insert_rate(&mut cache, &currency, &rate);
                }
            }
            Ok(Event::Eof) => break,
            Ok(_) => {}
            Err(failure) => {
                error!("ECB XML could not be parsed: {failure}");
                return Err(ErrorInfo::new(ErrorCode::NetworkError));
            }
        }
    }

    if !cache.has_rates() {
        return Err(ErrorInfo::new(ErrorCode::NetworkError));
    }
    Ok(cache)
}

fn insert_rate(cache: &mut CurrencyCache, code: &str, raw: &str) {
    let Some(code) = normalize_code(code) else {
        return;
    };
    let Some(rate) = parse_rate(raw) else {
        return;
    };
    cache.rates.insert(code, rate.to_string());
}

fn normalize_code(code: &str) -> Option<String> {
    let code = code.trim().to_ascii_uppercase();
    let valid = code.len() == 3 && code.bytes().all(|byte| byte.is_ascii_alphabetic());
    (valid && code != "EUR").then_some(code)
}

fn parse_rate(raw: &str) -> Option<Decimal> {
    Decimal::from_str(raw.trim())
        .ok()
        .filter(|rate| rate.is_sign_positive() && !rate.is_zero())
}

fn valid_date(date: &str) -> bool {
    let bytes = date.as_bytes();
    if bytes.len() != 10
        || bytes[4] != b'-'
        || bytes[7] != b'-'
        || !bytes
            .iter()
            .enumerate()
            .all(|(index, byte)| index == 4 || index == 7 || byte.is_ascii_digit())
    {
        return false;
    }
    let Ok(year) = date[0..4].parse::<i32>() else {
        return false;
    };
    let Ok(month) = date[5..7].parse::<u32>() else {
        return false;
    };
    let Ok(day) = date[8..10].parse::<u32>() else {
        return false;
    };
    let leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
    let days = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if leap => 29,
        2 => 28,
        _ => return false,
    };
    (1..=days).contains(&day)
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis() as i64)
        .unwrap_or_default()
}

fn network_error(stage: &str, failure: impl std::fmt::Display) -> ErrorInfo {
    error!("ECB {stage} failed: {failure}");
    ErrorInfo::new(ErrorCode::NetworkError)
}

fn read_cache(app: &AppHandle) -> CurrencyCache {
    let store = match app.store(CURRENCY_FILE) {
        Ok(store) => store,
        Err(failure) => {
            warn!("currency store unavailable, starting empty: {failure}");
            return CurrencyCache::default();
        }
    };

    match store.get(CURRENCY_KEY) {
        Some(value) => serde_json::from_value::<CurrencyCache>(value)
            .map(CurrencyCache::sanitized)
            .unwrap_or_else(|failure| {
                warn!("currency cache invalid, starting empty: {failure}");
                CurrencyCache::default()
            }),
        None => CurrencyCache::default(),
    }
}

fn write_cache(app: &AppHandle, cache: &CurrencyCache) -> Result<(), ErrorInfo> {
    let store = app
        .store(CURRENCY_FILE)
        .map_err(|failure| storage_error("open", failure))?;
    let value =
        serde_json::to_value(cache).map_err(|failure| storage_error("serialize", failure))?;
    store.set(CURRENCY_KEY, value);
    store
        .save()
        .map_err(|failure| storage_error("save", failure))
}

fn storage_error(stage: &str, failure: impl std::fmt::Display) -> ErrorInfo {
    error!("currency {stage} failed: {failure}");
    ErrorInfo::new(ErrorCode::StorageError)
}

#[cfg(test)]
mod tests {
    use super::*;

    const FIXTURE: &str = include_str!("../tests/fixtures/eurofxref-daily.xml");

    fn dec(raw: &str) -> Decimal {
        Decimal::from_str(raw).unwrap()
    }

    #[test]
    fn parses_ecb_fixture() {
        let cache = parse_ecb(FIXTURE).expect("fixture parses");
        assert_eq!(cache.base, "EUR");
        assert_eq!(cache.date.as_deref(), Some("2026-11-18"));
        assert_eq!(cache.rates.len(), 5);
        assert_eq!(cache.rates["USD"], "1.1585");
        assert_eq!(cache.rates["CNY"], "7.9214");
        assert_eq!(cache.rates["JPY"], "179.63");
        assert!(!cache.rates.contains_key("EUR"));
    }

    #[test]
    fn rejects_malformed_or_empty_documents() {
        assert_eq!(
            parse_ecb("<not-xml").unwrap_err().code,
            ErrorCode::NetworkError
        );
        assert_eq!(
            parse_ecb("<Envelope/>").unwrap_err().code,
            ErrorCode::NetworkError
        );
    }

    #[test]
    fn parses_namespaced_documents_and_skips_bad_rates() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">
  <Cube>
    <Cube time="2026-02-30">
      <Cube currency="USD" rate="1.05"/>
      <Cube currency="usd" rate="1.16"/>
      <Cube currency="CNY" rate="oops"/>
      <Cube currency="EURO" rate="2"/>
      <Cube currency="GBP" rate="0"/>
      <Cube currency="JPY" rate="165.42"/>
    </Cube>
  </Cube>
</gesmes:Envelope>"#;
        let cache = parse_ecb(xml).unwrap();
        assert_eq!(
            cache.date, None,
            "invalid calendar-looking dates are dropped"
        );
        assert_eq!(cache.rates.len(), 2);
        assert_eq!(cache.rates["USD"], "1.16");
        assert_eq!(cache.rates["JPY"], "165.42");
    }

    #[test]
    fn staleness_uses_a_24h_ttl() {
        let now = now_ms();
        let mut cache = CurrencyCache::default();
        assert!(cache.is_stale(now));
        cache.fetched_at = Some(now);
        assert!(!cache.is_stale(now));
        cache.fetched_at = Some(now - TTL_MS);
        assert!(!cache.is_stale(now));
        cache.fetched_at = Some(now - TTL_MS - 1);
        assert!(cache.is_stale(now));
    }

    #[test]
    fn sanitize_drops_untrusted_entries() {
        let cache = CurrencyCache {
            base: "USD".into(),
            date: Some("2026-11-18".into()),
            fetched_at: Some(1),
            rates: BTreeMap::from([
                ("usd".into(), "1.1".into()),
                ("EUR".into(), "1".into()),
                ("gbp".into(), "-2".into()),
                ("jpy".into(), "0".into()),
                ("cny".into(), "7.9".into()),
                ("EURO".into(), "3".into()),
            ]),
        }
        .sanitized();
        assert_eq!(cache.base, "EUR");
        assert_eq!(
            cache.rates.keys().cloned().collect::<Vec<_>>(),
            ["CNY", "USD"]
        );
        assert_eq!(cache.rates["USD"], "1.1");
    }

    #[test]
    fn refresh_gate_limits_requests_to_one_per_window() {
        let start = Instant::now();
        let mut gate = RefreshGate::default();
        assert!(gate.try_begin(start));
        assert!(!gate.try_begin(start + Duration::from_secs(4)));
        gate.finish();
        assert!(!gate.try_begin(start + Duration::from_secs(4)));
        assert!(gate.try_begin(start + MIN_REFRESH_INTERVAL));
        assert!(
            !gate.try_begin(start + MIN_REFRESH_INTERVAL),
            "still in flight"
        );
        gate.finish();
        assert!(!gate.try_begin(start + MIN_REFRESH_INTERVAL + Duration::from_secs(1)));
    }

    #[test]
    fn rate_table_skips_invalid_entries() {
        let cache = CurrencyCache {
            rates: BTreeMap::from([
                ("USD".into(), "1.25".into()),
                ("CNY".into(), "not-a-rate".into()),
            ]),
            ..CurrencyCache::default()
        };
        let table = cache.rate_table().unwrap();
        assert_eq!(table.rate("USD"), Some(dec("1.25")));
        assert_eq!(table.rate("CNY"), None);
        assert_eq!(table.rate("EUR"), Some(Decimal::ONE));
    }

    #[test]
    fn status_serializes_camel_case() {
        let status = CurrencyStatus {
            source: "ECB".into(),
            base: "EUR".into(),
            date: Some("2026-11-18".into()),
            fetched_at: Some(42),
            stale: false,
            available: true,
            refresh_failed: false,
        };
        let value = serde_json::to_value(status).unwrap();
        assert_eq!(value["fetchedAt"], 42);
        assert_eq!(value["refreshFailed"], false);
        assert_eq!(value["date"], "2026-11-18");
    }

    #[test]
    fn cache_payload_round_trips_with_defaults() {
        let decoded: CurrencyCache = serde_json::from_value(serde_json::json!({
            "date": "2026-11-18",
            "rates": { "USD": "1.1585" }
        }))
        .unwrap();
        assert_eq!(decoded.base, "EUR");
        assert_eq!(decoded.fetched_at, None);
        assert_eq!(decoded.rates["USD"], "1.1585");

        let encoded = serde_json::to_value(&decoded).unwrap();
        assert_eq!(encoded["fetchedAt"], serde_json::Value::Null);
        assert_eq!(encoded["rates"]["USD"], "1.1585");
    }
}
