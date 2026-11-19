//! Pure date commands (T14). Arithmetic lives in `calc-core::date`; this
//! adapter only projects the canonical ISO string back to the UI.

use calc_core::{DateDifference, DateShift, ErrorInfo};

#[tauri::command]
pub fn date_diff(from: String, to: String) -> Result<DateDifference, ErrorInfo> {
    calc_core::date::difference(&from, &to)
}

#[tauri::command]
pub fn date_add(
    date: String,
    years: i32,
    months: i32,
    weeks: i32,
    days: i32,
) -> Result<DateShift, ErrorInfo> {
    let shifted = calc_core::date::shift(&date, years, months, weeks, days)?;
    Ok(DateShift {
        date: calc_core::date::iso(shifted),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use calc_core::ErrorCode;

    #[test]
    fn difference_returns_calendar_components() {
        let view = date_diff("2024-01-31".into(), "2024-03-01".into()).unwrap();
        assert_eq!((view.years, view.months, view.days), (0, 1, 1));
        assert_eq!(view.total_days, 30);
    }

    #[test]
    fn add_clamps_month_end_and_formats_iso() {
        let view = date_add("2024-01-31".into(), 0, 1, 0, 0).unwrap();
        assert_eq!(view.date, "2024-02-29");
        let view = date_add("2023-01-31".into(), 0, 1, 0, 0).unwrap();
        assert_eq!(view.date, "2023-02-28");
    }

    #[test]
    fn invalid_dates_and_bounds_map_to_error_codes() {
        assert_eq!(
            date_diff("2023-02-29".into(), "2024-01-01".into())
                .unwrap_err()
                .code,
            ErrorCode::InvalidInput
        );
        assert_eq!(
            date_add("9999-12-31".into(), 0, 0, 0, 1).unwrap_err().code,
            ErrorCode::Overflow
        );
    }
}
