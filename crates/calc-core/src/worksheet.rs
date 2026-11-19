//! Worksheet registry and pure calculations (HANDOFF §3.10.3, §6.0 T15 / M8).
//!
//! All money stays on `Decimal`; final amounts round to two decimal places with
//! `MidpointAwayFromZero` (§3.5). The static registry drives the generic form in
//! the UI: field ids, bounds and defaults are canonical strings and are never
//! localized here.
//!
//! Mortgage uses the annuity formula with `r = annualRate / 1200` and
//! `n = years * 12`: `payment = P·r·(1+r)^n / ((1+r)^n − 1)`, falling back to
//! `P / n` when the rate is zero. `totalPayment` is the rounded monthly payment
//! times `n`, so the displayed numbers stay consistent.
//!
//! Fuel derives liters from `distance / 100 × L/100km`, then cost from liters ×
//! price. `mpg(US)` and `mpg(UK)` use the exact definitions
//! `100 · gallon_liters / 1.609344` (235.214583… and 282.480936…).
//!
//! Lease uses `moneyFactor = APR / 2400`; the monthly amount is
//! `((price − residual) / months + (price + residual) · moneyFactor) × (1 + tax/100)`,
//! and the total is the rounded monthly amount times the term.

use std::collections::BTreeMap;
use std::str::FromStr;

use rust_decimal::prelude::ToPrimitive;
use rust_decimal::{Decimal, MathematicalOps, RoundingStrategy};
use serde::{Deserialize, Serialize};

use crate::error::{CalcResult, ErrorCode, ErrorInfo};
use crate::value;
use crate::view::{
    WorksheetCatalog, WorksheetFieldInfo, WorksheetInfo, WorksheetResult, WorksheetResultInfo,
    WorksheetValue,
};

/// First three worksheets; ids double as i18n keys under `worksheets:sheets`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum WorksheetId {
    Mortgage,
    Fuel,
    Lease,
}

impl WorksheetId {
    pub const ALL: [Self; 3] = [Self::Mortgage, Self::Fuel, Self::Lease];
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FieldKind {
    Decimal,
    Integer,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ResultKind {
    Money,
    Decimal,
}

pub struct FieldDef {
    pub id: &'static str,
    pub kind: FieldKind,
    pub min: &'static str,
    pub max: &'static str,
    pub default: &'static str,
}

pub struct ResultDef {
    pub id: &'static str,
    pub kind: ResultKind,
}

type Compute = fn(&SheetDef, &BTreeMap<String, String>) -> CalcResult<Vec<(&'static str, Decimal)>>;

pub struct SheetDef {
    pub id: WorksheetId,
    pub fields: &'static [FieldDef],
    pub results: &'static [ResultDef],
    compute: Compute,
}

const MORTGAGE_FIELDS: &[FieldDef] = &[
    FieldDef {
        id: "principal",
        kind: FieldKind::Decimal,
        min: "0.01",
        max: "1000000000000",
        default: "1000000",
    },
    FieldDef {
        id: "annualRate",
        kind: FieldKind::Decimal,
        min: "0",
        max: "100",
        default: "4.2",
    },
    FieldDef {
        id: "years",
        kind: FieldKind::Integer,
        min: "1",
        max: "50",
        default: "30",
    },
];

const MORTGAGE_RESULTS: &[ResultDef] = &[
    ResultDef {
        id: "monthlyPayment",
        kind: ResultKind::Money,
    },
    ResultDef {
        id: "totalPayment",
        kind: ResultKind::Money,
    },
    ResultDef {
        id: "totalInterest",
        kind: ResultKind::Money,
    },
];

const FUEL_FIELDS: &[FieldDef] = &[
    FieldDef {
        id: "distance",
        kind: FieldKind::Decimal,
        min: "0.01",
        max: "10000000",
        default: "500",
    },
    FieldDef {
        id: "consumption",
        kind: FieldKind::Decimal,
        min: "0.01",
        max: "100",
        default: "7.5",
    },
    FieldDef {
        id: "pricePerLiter",
        kind: FieldKind::Decimal,
        min: "0",
        max: "1000000",
        default: "7.5",
    },
];

const FUEL_RESULTS: &[ResultDef] = &[
    ResultDef {
        id: "totalFuel",
        kind: ResultKind::Decimal,
    },
    ResultDef {
        id: "totalCost",
        kind: ResultKind::Money,
    },
    ResultDef {
        id: "mpgUs",
        kind: ResultKind::Decimal,
    },
    ResultDef {
        id: "mpgUk",
        kind: ResultKind::Decimal,
    },
];

const LEASE_FIELDS: &[FieldDef] = &[
    FieldDef {
        id: "price",
        kind: FieldKind::Decimal,
        min: "0.01",
        max: "1000000000000",
        default: "300000",
    },
    FieldDef {
        id: "residual",
        kind: FieldKind::Decimal,
        min: "0",
        max: "1000000000000",
        default: "150000",
    },
    FieldDef {
        id: "months",
        kind: FieldKind::Integer,
        min: "1",
        max: "120",
        default: "36",
    },
    FieldDef {
        id: "apr",
        kind: FieldKind::Decimal,
        min: "0",
        max: "100",
        default: "5",
    },
    FieldDef {
        id: "taxRate",
        kind: FieldKind::Decimal,
        min: "0",
        max: "100",
        default: "0",
    },
];

const LEASE_RESULTS: &[ResultDef] = &[
    ResultDef {
        id: "monthlyPayment",
        kind: ResultKind::Money,
    },
    ResultDef {
        id: "totalCost",
        kind: ResultKind::Money,
    },
    ResultDef {
        id: "rentCharge",
        kind: ResultKind::Money,
    },
];

const SHEETS: &[SheetDef] = &[
    SheetDef {
        id: WorksheetId::Mortgage,
        fields: MORTGAGE_FIELDS,
        results: MORTGAGE_RESULTS,
        compute: mortgage,
    },
    SheetDef {
        id: WorksheetId::Fuel,
        fields: FUEL_FIELDS,
        results: FUEL_RESULTS,
        compute: fuel,
    },
    SheetDef {
        id: WorksheetId::Lease,
        fields: LEASE_FIELDS,
        results: LEASE_RESULTS,
        compute: lease,
    },
];

fn sheet(id: WorksheetId) -> &'static SheetDef {
    SHEETS
        .iter()
        .find(|sheet| sheet.id == id)
        .expect("every worksheet id has a definition")
}

/// Registry projection for the generic worksheet form.
pub fn catalog() -> WorksheetCatalog {
    WorksheetCatalog {
        worksheets: SHEETS
            .iter()
            .map(|sheet| WorksheetInfo {
                id: sheet.id,
                fields: sheet
                    .fields
                    .iter()
                    .map(|field| WorksheetFieldInfo {
                        id: field.id.to_owned(),
                        kind: field.kind,
                        min: field.min.to_owned(),
                        max: field.max.to_owned(),
                        default_value: field.default.to_owned(),
                    })
                    .collect(),
                results: sheet
                    .results
                    .iter()
                    .map(|result| WorksheetResultInfo {
                        id: result.id.to_owned(),
                        kind: result.kind,
                    })
                    .collect(),
            })
            .collect(),
    }
}

/// Validates every declared field, then runs the sheet's formula.
pub fn compute(id: WorksheetId, inputs: &BTreeMap<String, String>) -> CalcResult<WorksheetResult> {
    let definition = sheet(id);
    let values = (definition.compute)(definition, inputs)?;
    Ok(WorksheetResult {
        values: values
            .into_iter()
            .map(|(id, value)| WorksheetValue {
                id: id.to_owned(),
                value: value::canonical(value),
            })
            .collect(),
    })
}

fn invalid_field(id: &'static str) -> ErrorInfo {
    ErrorInfo::with_args(ErrorCode::InvalidInput, vec![id.to_owned()])
}

fn invalid_rule(id: &'static str) -> ErrorInfo {
    ErrorInfo::with_args(ErrorCode::InvalidInput, vec![id.to_owned()])
}

fn overflow() -> ErrorInfo {
    ErrorInfo::new(ErrorCode::Overflow)
}

fn dec(raw: &str) -> Decimal {
    Decimal::from_str(raw).expect("static worksheet bounds are valid decimals")
}

fn field(
    definition: &SheetDef,
    id: &'static str,
    inputs: &BTreeMap<String, String>,
) -> CalcResult<Decimal> {
    let spec = definition
        .fields
        .iter()
        .find(|field| field.id == id)
        .expect("formula fields are declared in the registry");
    let raw = inputs.get(id).ok_or_else(|| invalid_field(id))?;
    let cleaned = value::normalize_input(raw).map_err(|_| invalid_field(id))?;
    let number = Decimal::from_str(&cleaned)
        .or_else(|_| Decimal::from_scientific(&cleaned))
        .map_err(|_| invalid_field(id))?;
    if spec.kind == FieldKind::Integer && !number.fract().is_zero() {
        return Err(invalid_field(id));
    }
    if number < dec(spec.min) || number > dec(spec.max) {
        return Err(invalid_field(id));
    }
    Ok(number)
}

fn rounded_money(value: Decimal) -> Decimal {
    value.round_dp_with_strategy(2, RoundingStrategy::MidpointAwayFromZero)
}

fn checked_div(numerator: Decimal, denominator: Decimal) -> CalcResult<Decimal> {
    numerator.checked_div(denominator).ok_or_else(overflow)
}

fn mortgage(
    definition: &SheetDef,
    inputs: &BTreeMap<String, String>,
) -> CalcResult<Vec<(&'static str, Decimal)>> {
    let principal = field(definition, "principal", inputs)?;
    let annual_rate = field(definition, "annualRate", inputs)?;
    let years = field(definition, "years", inputs)?;
    let months = years
        .to_i64()
        .and_then(|years| years.checked_mul(12))
        .ok_or_else(overflow)?;
    if months <= 0 {
        return Err(invalid_field("years"));
    }
    let monthly_rate = checked_div(annual_rate, Decimal::from(1200))?;

    let payment = if monthly_rate.is_zero() {
        checked_div(principal, Decimal::from(months))?
    } else {
        let growth = (Decimal::ONE + monthly_rate)
            .checked_powi(months)
            .ok_or_else(overflow)?;
        let denominator = growth.checked_sub(Decimal::ONE).ok_or_else(overflow)?;
        if denominator.is_zero() {
            return Err(overflow());
        }
        checked_div(
            principal
                .checked_mul(monthly_rate)
                .and_then(|value| value.checked_mul(growth))
                .ok_or_else(overflow)?,
            denominator,
        )?
    };

    let monthly_payment = rounded_money(payment);
    let total_payment = rounded_money(
        monthly_payment
            .checked_mul(Decimal::from(months))
            .ok_or_else(overflow)?,
    );
    let total_interest = if total_payment > principal {
        total_payment.checked_sub(principal).ok_or_else(overflow)?
    } else {
        Decimal::ZERO
    };

    Ok(vec![
        ("monthlyPayment", monthly_payment),
        ("totalPayment", total_payment),
        ("totalInterest", total_interest),
    ])
}

/// Handoff/README conversions: US gallon = 3.785411784 L, UK gallon = 4.54609 L.
const MPG_US_FACTOR: &str = "235.214583333333";
const MPG_UK_FACTOR: &str = "282.480936331822";

fn fuel(
    definition: &SheetDef,
    inputs: &BTreeMap<String, String>,
) -> CalcResult<Vec<(&'static str, Decimal)>> {
    let distance = field(definition, "distance", inputs)?;
    let consumption = field(definition, "consumption", inputs)?;
    let price = field(definition, "pricePerLiter", inputs)?;

    let litres = checked_div(distance, Decimal::from(100))?
        .checked_mul(consumption)
        .ok_or_else(overflow)?;
    let cost = litres.checked_mul(price).ok_or_else(overflow)?;
    let mpg_us = checked_div(dec(MPG_US_FACTOR), consumption)?;
    let mpg_uk = checked_div(dec(MPG_UK_FACTOR), consumption)?;

    Ok(vec![
        ("totalFuel", rounded_money(litres)),
        ("totalCost", rounded_money(cost)),
        ("mpgUs", rounded_money(mpg_us)),
        ("mpgUk", rounded_money(mpg_uk)),
    ])
}

fn lease(
    definition: &SheetDef,
    inputs: &BTreeMap<String, String>,
) -> CalcResult<Vec<(&'static str, Decimal)>> {
    let price = field(definition, "price", inputs)?;
    let residual = field(definition, "residual", inputs)?;
    let months = field(definition, "months", inputs)?;
    let apr = field(definition, "apr", inputs)?;
    let tax_rate = field(definition, "taxRate", inputs)?;

    if residual >= price {
        return Err(invalid_rule("residualBelowPrice"));
    }
    let months_i64 = months.to_i64().ok_or_else(|| invalid_field("months"))?;
    if months_i64 <= 0 {
        return Err(invalid_field("months"));
    }
    let months_decimal = Decimal::from(months_i64);

    let depreciation = checked_div(
        price.checked_sub(residual).ok_or_else(overflow)?,
        months_decimal,
    )?;
    let money_factor = checked_div(apr, Decimal::from(2400))?;
    let rent_charge = price
        .checked_add(residual)
        .and_then(|value| value.checked_mul(money_factor))
        .ok_or_else(overflow)?;
    let subtotal = depreciation.checked_add(rent_charge).ok_or_else(overflow)?;
    let tax_multiplier = Decimal::ONE
        .checked_add(checked_div(tax_rate, Decimal::from(100))?)
        .ok_or_else(overflow)?;
    let monthly = subtotal.checked_mul(tax_multiplier).ok_or_else(overflow)?;

    let monthly_payment = rounded_money(monthly);
    let total_cost = rounded_money(
        monthly_payment
            .checked_mul(months_decimal)
            .ok_or_else(overflow)?,
    );
    let total_rent_charge = rounded_money(
        rent_charge
            .checked_mul(months_decimal)
            .ok_or_else(overflow)?,
    );

    Ok(vec![
        ("monthlyPayment", monthly_payment),
        ("totalCost", total_cost),
        ("rentCharge", total_rent_charge),
    ])
}

#[cfg(test)]
mod tests {
    use super::*;

    fn inputs(pairs: &[(&str, &str)]) -> BTreeMap<String, String> {
        pairs
            .iter()
            .map(|(key, value)| ((*key).to_owned(), (*value).to_owned()))
            .collect()
    }

    #[test]
    fn money_rounds_half_away_from_zero() {
        assert_eq!(
            rounded_money(Decimal::from_str("1.005").unwrap()),
            Decimal::from_str("1.01").unwrap()
        );
        assert_eq!(
            rounded_money(Decimal::from_str("2.344").unwrap()),
            Decimal::from_str("2.34").unwrap()
        );
    }

    #[test]
    fn catalog_exposes_three_sheets_with_defaults() {
        let catalog = catalog();
        assert_eq!(catalog.worksheets.len(), 3);
        let mortgage = &catalog.worksheets[0];
        assert_eq!(mortgage.id, WorksheetId::Mortgage);
        assert_eq!(mortgage.fields[0].default_value, "1000000");
        assert_eq!(mortgage.fields[1].kind, FieldKind::Decimal);
        assert_eq!(catalog.worksheets[1].results.len(), 4);
        assert_eq!(catalog.worksheets[2].fields.len(), 5);
    }

    #[test]
    fn missing_or_out_of_range_fields_report_the_field_id() {
        let definition = sheet(WorksheetId::Mortgage);
        let error = field(definition, "principal", &inputs(&[])).unwrap_err();
        assert_eq!(error.code, ErrorCode::InvalidInput);
        assert_eq!(error.args, vec!["principal".to_owned()]);

        let error = field(definition, "years", &inputs(&[("years", "1.5")])).unwrap_err();
        assert_eq!(error.args, vec!["years".to_owned()]);
    }
}
