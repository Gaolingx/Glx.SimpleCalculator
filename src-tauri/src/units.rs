//! Unit registry and pure conversion commands.
//!
//! The registry and arithmetic live in `calc-core`; this adapter only projects
//! canonical strings. Currency rates are not wired yet (T13 owns fetching and
//! caching), so currency requests report `CURRENCY_OFFLINE`.

use calc_core::{ErrorInfo, UnitCatalog, UnitCategory, UnitConversion};

#[tauri::command]
pub fn units_catalog() -> UnitCatalog {
    calc_core::units::catalog()
}

#[tauri::command]
pub fn convert_unit(
    category: UnitCategory,
    value: String,
    from: String,
    to: String,
) -> Result<UnitConversion, ErrorInfo> {
    let converted = calc_core::units::convert(category, &value, &from, &to, None)?;
    Ok(UnitConversion {
        value: calc_core::value::canonical(converted),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use calc_core::ErrorCode;

    fn convert(category: UnitCategory, value: &str, from: &str, to: &str) -> UnitConversion {
        convert_unit(category, value.into(), from.into(), to.into()).unwrap()
    }

    #[test]
    fn returns_canonical_values() {
        assert_eq!(convert(UnitCategory::Length, "1", "km", "m").value, "1000");
        assert_eq!(
            convert(UnitCategory::Temperature, "0", "c", "f").value,
            "32"
        );
    }

    #[test]
    fn currency_stays_offline_until_rates_are_wired() {
        let error = convert_unit(
            UnitCategory::Currency,
            "1".into(),
            "eur".into(),
            "usd".into(),
        )
        .unwrap_err();
        assert_eq!(error.code, ErrorCode::CurrencyOffline);
    }

    #[test]
    fn catalog_exposes_eleven_categories() {
        assert_eq!(units_catalog().categories.len(), 11);
    }
}
