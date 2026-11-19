//! Unit registry and pure conversion commands.
//!
//! The registry and arithmetic live in `calc-core`; this adapter projects
//! canonical strings and injects the cached ECB rate table for currencies
//! (T13 owns fetching and caching).

use calc_core::{ErrorInfo, UnitCatalog, UnitCategory, UnitConversion};
use tauri::State;

use crate::currency::CurrencyState;

#[tauri::command]
pub fn units_catalog() -> UnitCatalog {
    calc_core::units::catalog()
}

#[tauri::command]
pub fn convert_unit(
    currency: State<'_, CurrencyState>,
    category: UnitCategory,
    value: String,
    from: String,
    to: String,
) -> Result<UnitConversion, ErrorInfo> {
    let rates = if category == UnitCategory::Currency {
        currency.rate_table()
    } else {
        None
    };
    let converted = calc_core::units::convert(category, &value, &from, &to, rates.as_ref())?;
    Ok(UnitConversion {
        value: calc_core::value::canonical(converted),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use calc_core::ErrorCode;
    use calc_core::RateTable;

    fn convert(
        category: UnitCategory,
        value: &str,
        from: &str,
        to: &str,
        rates: Option<&RateTable>,
    ) -> Result<UnitConversion, ErrorInfo> {
        let converted = calc_core::units::convert(category, value, from, to, rates)?;
        Ok(UnitConversion {
            value: calc_core::value::canonical(converted),
        })
    }

    #[test]
    fn returns_canonical_values() {
        assert_eq!(
            convert(UnitCategory::Length, "1", "km", "m", None)
                .unwrap()
                .value,
            "1000"
        );
        assert_eq!(
            convert(UnitCategory::Temperature, "0", "c", "f", None)
                .unwrap()
                .value,
            "32"
        );
    }

    #[test]
    fn currency_reports_offline_without_rates() {
        let error = convert(UnitCategory::Currency, "1", "eur", "usd", None).unwrap_err();
        assert_eq!(error.code, ErrorCode::CurrencyOffline);
    }

    #[test]
    fn currency_converts_with_injected_rates() {
        let mut rates = RateTable::new();
        rates.insert("USD", "1.1585".parse().unwrap());
        assert_eq!(
            convert(UnitCategory::Currency, "100", "eur", "usd", Some(&rates))
                .unwrap()
                .value,
            "115.85"
        );
    }

    #[test]
    fn catalog_exposes_eleven_categories() {
        assert_eq!(units_catalog().categories.len(), 11);
    }
}
