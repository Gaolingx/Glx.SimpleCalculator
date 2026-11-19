//! Worksheet commands (T15). Registry and formulas live in `calc-core`; this
//! adapter only forwards canonical inputs/outputs across the IPC boundary.

use std::collections::BTreeMap;

use calc_core::{ErrorInfo, WorksheetCatalog, WorksheetId, WorksheetResult};

#[tauri::command]
pub fn worksheet_catalog() -> WorksheetCatalog {
    calc_core::worksheet::catalog()
}

#[tauri::command]
pub fn worksheet_compute(
    sheet: WorksheetId,
    inputs: BTreeMap<String, String>,
) -> Result<WorksheetResult, ErrorInfo> {
    calc_core::worksheet::compute(sheet, &inputs)
}

#[cfg(test)]
mod tests {
    use super::*;
    use calc_core::ErrorCode;

    fn inputs(pairs: &[(&str, &str)]) -> BTreeMap<String, String> {
        pairs
            .iter()
            .map(|(key, value)| ((*key).to_owned(), (*value).to_owned()))
            .collect()
    }

    #[test]
    fn computes_mortgage_from_the_registry_defaults() {
        let catalog = worksheet_catalog();
        let mortgage = &catalog.worksheets[0];
        let defaults: BTreeMap<String, String> = mortgage
            .fields
            .iter()
            .map(|field| (field.id.clone(), field.default_value.clone()))
            .collect();
        let result = worksheet_compute(WorksheetId::Mortgage, defaults).unwrap();
        assert_eq!(result.values[0].id, "monthlyPayment");
        assert_eq!(result.values[0].value, "4890.17");
    }

    #[test]
    fn field_errors_keep_the_field_id() {
        let error = worksheet_compute(
            WorksheetId::Lease,
            inputs(&[
                ("price", "300000"),
                ("residual", "150000"),
                ("months", "36"),
                ("apr", "5"),
            ]),
        )
        .unwrap_err();
        assert_eq!(error.code, ErrorCode::InvalidInput);
        assert_eq!(error.args, vec!["taxRate".to_owned()]);
    }

    #[test]
    fn catalog_exposes_three_sheets() {
        assert_eq!(worksheet_catalog().worksheets.len(), 3);
    }
}
