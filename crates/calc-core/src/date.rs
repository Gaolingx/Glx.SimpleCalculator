//! Calendar arithmetic (HANDOFF §3.10.3, §6.0 T14).
//!
//! Dates are exchanged as strict ISO `YYYY-MM-DD` strings in the range
//! 0001-01-01..=9999-12-31, which keeps the frontend formatter unambiguous.
//! Difference is a calendar difference (years, then months, then days with
//! borrow), not a fractional-month approximation. Shifting clamps to the last
//! day of the target month, so 2024-01-31 + 1 month = 2024-02-29.

use chrono::{Datelike, Days, NaiveDate, TimeDelta};

use crate::error::{CalcResult, ErrorCode, ErrorInfo};
use crate::view::DateDifference;

const MIN_YEAR: i32 = 1;
const MAX_YEAR: i32 = 9999;
/// Rejects absurd component magnitudes before any multiplication.
const MAX_COMPONENT: i64 = 3_700_000;

fn invalid() -> ErrorInfo {
    ErrorInfo::new(ErrorCode::InvalidInput)
}

fn overflow() -> ErrorInfo {
    ErrorInfo::new(ErrorCode::Overflow)
}

/// Parses a strict `YYYY-MM-DD` date; rejects unpadded or impossible dates.
pub fn parse(input: &str) -> CalcResult<NaiveDate> {
    let bytes = input.as_bytes();
    let shaped = bytes.len() == 10
        && bytes[4] == b'-'
        && bytes[7] == b'-'
        && bytes
            .iter()
            .enumerate()
            .all(|(index, byte)| index == 4 || index == 7 || byte.is_ascii_digit());
    if !shaped {
        return Err(invalid());
    }

    let year = input[0..4].parse::<i32>().map_err(|_| invalid())?;
    let month = input[5..7].parse::<u32>().map_err(|_| invalid())?;
    let day = input[8..10].parse::<u32>().map_err(|_| invalid())?;
    if !(MIN_YEAR..=MAX_YEAR).contains(&year) {
        return Err(invalid());
    }

    NaiveDate::from_ymd_opt(year, month, day).ok_or_else(invalid)
}

/// Canonical ISO rendering (zero-padded to four digits).
pub fn iso(date: NaiveDate) -> String {
    date.format("%Y-%m-%d").to_string()
}

/// Calendar difference between two dates.
///
/// Components are non-negative and computed on the earlier→later interval;
/// `total_days` keeps the direction (`to - from`). `total_weeks` is the
/// truncated whole-week count of `total_days`.
pub fn difference(from: &str, to: &str) -> CalcResult<DateDifference> {
    let from = parse(from)?;
    let to = parse(to)?;
    let total_days = (to - from).num_days();
    let (start, end) = if from <= to { (from, to) } else { (to, from) };

    let mut years = end.year() - start.year();
    let mut anchor = add_months(start, i64::from(years) * 12)?;
    if anchor > end {
        years -= 1;
        anchor = add_months(start, i64::from(years) * 12)?;
    }

    let mut months = 0;
    while months < 11 {
        let next = add_months(anchor, 1)?;
        if next > end {
            break;
        }
        anchor = next;
        months += 1;
    }

    Ok(DateDifference {
        years: years as u32,
        months,
        days: (end - anchor).num_days() as u32,
        total_days,
        total_weeks: total_days / 7,
    })
}

/// Adds `years`, `months`, `weeks` and `days` to `date` (months first, then
/// days, each month step clamped to the target month's last day).
pub fn shift(date: &str, years: i32, months: i32, weeks: i32, days: i32) -> CalcResult<NaiveDate> {
    let start = parse(date)?;
    let (years, months, weeks, days) = (
        i64::from(years),
        i64::from(months),
        i64::from(weeks),
        i64::from(days),
    );
    if [years, months, weeks, days]
        .iter()
        .any(|part| part.unsigned_abs() > MAX_COMPONENT as u64)
    {
        return Err(invalid());
    }

    let total_months = years
        .checked_mul(12)
        .and_then(|value| value.checked_add(months))
        .ok_or_else(invalid)?;
    let base = add_months(start, total_months)?;

    let shift_days = weeks
        .checked_mul(7)
        .and_then(|value| value.checked_add(days))
        .ok_or_else(invalid)?;
    let result = base
        .checked_add_signed(TimeDelta::days(shift_days))
        .ok_or_else(overflow)?;
    if !(MIN_YEAR..=MAX_YEAR).contains(&result.year()) {
        return Err(overflow());
    }
    Ok(result)
}

fn last_day(year: i32, month: u32) -> Option<u32> {
    let (next_year, next_month) = if month == 12 {
        (year.checked_add(1)?, 1)
    } else {
        (year, month + 1)
    };
    let first_of_next = NaiveDate::from_ymd_opt(next_year, next_month, 1)?;
    Some((first_of_next - Days::new(1)).day())
}

fn clamped(year: i32, month: u32, day: u32) -> Option<NaiveDate> {
    if !(MIN_YEAR..=MAX_YEAR).contains(&year) {
        return None;
    }
    let last = last_day(year, month)?;
    NaiveDate::from_ymd_opt(year, month, day.clamp(1, last))
}

fn add_months(date: NaiveDate, months: i64) -> CalcResult<NaiveDate> {
    let index = (i64::from(date.year()) * 12 + i64::from(date.month0()))
        .checked_add(months)
        .ok_or_else(overflow)?;
    let year = index.div_euclid(12);
    if !(i64::from(MIN_YEAR)..=i64::from(MAX_YEAR)).contains(&year) {
        return Err(overflow());
    }
    let month = index.rem_euclid(12) as u32 + 1;
    clamped(year as i32, month, date.day()).ok_or_else(overflow)
}
