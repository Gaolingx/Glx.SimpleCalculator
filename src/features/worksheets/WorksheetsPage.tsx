import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { CopyIcon } from "../../components/layout/icons";
import {
  SoftButton,
  SoftCard,
  SoftInput,
  SoftSegmentedControl,
  useToast,
} from "../../components/ui";
import { cx } from "../../components/ui/cx";
import { formatNumber } from "../../lib/format";
import {
  computeWorksheet,
  copyText,
  fetchWorksheetCatalog,
  isTauriRuntime,
  toIpcError,
  WORKSHEET_IDS,
  type ErrorCode,
  type WorksheetCatalog,
  type WorksheetFieldInfo,
  type WorksheetId,
  type WorksheetInfo,
  type WorksheetResultKind,
  type WorksheetValue,
} from "../../lib/ipc";
import { useSettingsStore } from "../../stores/settings";
import styles from "./WorksheetsPage.module.css";

const EMPTY_FIELDS: readonly WorksheetFieldInfo[] = [];
const DECIMAL_PATTERN = /^\d*(?:\.\d+)?$/;
const INTEGER_PATTERN = /^\d+$/;
/** Cross-field rules that the backend reports by rule id, shown on a field. */
const RULE_FIELDS: Record<string, string> = {
  residualBelowPrice: "residual",
};

interface Computed {
  key: string;
  values: WorksheetValue[] | null;
  error: ErrorCode | null;
  errorArg: string | null;
}

function defaultsOf(info: WorksheetInfo): Record<string, string> {
  return Object.fromEntries(info.fields.map((field) => [field.id, field.defaultValue]));
}

function parseValue(raw: string, kind: WorksheetFieldInfo["kind"]): number | null {
  const text = raw.trim().replace(/,/g, "");
  const pattern = kind === "integer" ? INTEGER_PATTERN : DECIMAL_PATTERN;
  if (!pattern.test(text) || text === "" || text === ".") {
    return null;
  }
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/** Pads a canonical amount to two fractional digits, then applies grouping. */
function formatMoney(raw: string, grouping: boolean): string {
  const negative = raw.startsWith("-");
  const [integer, fraction = ""] = (negative ? raw.slice(1) : raw).split(".");
  const padded = `${integer || "0"}.${(fraction + "00").slice(0, 2)}`;
  return formatNumber(`${negative ? "-" : ""}${padded}`, {
    grouping,
    significantDigits: 20,
  });
}

function formatResult(
  value: string,
  kind: WorksheetResultKind,
  grouping: boolean,
): string {
  return kind === "money" ? formatMoney(value, grouping) : formatNumber(value, { grouping });
}

export function WorksheetsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const grouping = useSettingsStore((state) => state.settings.grouping);
  const preview = !isTauriRuntime();

  const [catalog, setCatalog] = useState<WorksheetCatalog | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [sheet, setSheet] = useState<WorksheetId>("mortgage");
  const [values, setValues] = useState<Record<string, string>>({});
  const [computed, setComputed] = useState<Computed | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    if (preview) {
      return undefined;
    }
    let cancelled = false;
    fetchWorksheetCatalog()
      .then((next) => {
        if (cancelled) {
          return;
        }
        setCatalog(next);
        const initial = next.worksheets.find((entry) => entry.id === "mortgage");
        if (initial) {
          setValues(defaultsOf(initial));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [preview, reloadToken]);

  const info = catalog?.worksheets.find((entry) => entry.id === sheet) ?? null;
  const fields = info?.fields ?? EMPTY_FIELDS;

  const fieldErrors: Record<string, string> = {};
  if (info) {
    for (const field of fields) {
      const raw = values[field.id] ?? "";
      const parsed = parseValue(raw, field.kind);
      if (raw.trim() === "") {
        fieldErrors[field.id] = t("worksheets:fieldRequired");
      } else if (parsed === null) {
        fieldErrors[field.id] = t(
          field.kind === "integer" ? "worksheets:fieldInteger" : "worksheets:fieldNumber",
        );
      } else if (parsed < Number(field.min)) {
        fieldErrors[field.id] = t("worksheets:fieldMin", { min: field.min });
      } else if (parsed > Number(field.max)) {
        fieldErrors[field.id] = t("worksheets:fieldMax", { max: field.max });
      }
    }
  }
  const invalidCount = Object.keys(fieldErrors).length;
  const inputsKey = fields.map((field) => `${field.id}=${values[field.id] ?? ""}`).join("|");
  const requestKey = info && invalidCount === 0 ? `${sheet}|${inputsKey}` : "";

  useEffect(() => {
    if (preview || !info || !requestKey) {
      return undefined;
    }
    const inputs = Object.fromEntries(
      info.fields.map((field) => [field.id, values[field.id] ?? ""]),
    );
    const id = requestId.current + 1;
    requestId.current = id;
    const timer = window.setTimeout(() => {
      computeWorksheet(info.id, inputs)
        .then((result) => {
          if (requestId.current === id) {
            setComputed({ key: requestKey, values: result.values, error: null, errorArg: null });
          }
        })
        .catch((reason: unknown) => {
          if (requestId.current === id) {
            const error = toIpcError(reason);
            setComputed({
              key: requestKey,
              values: null,
              error: error.code,
              errorArg: error.args[0] ?? null,
            });
          }
        });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [preview, info, requestKey, values]);

  const current = computed && computed.key === requestKey ? computed : null;
  const errorArg = current?.errorArg ?? null;
  const ruleField = errorArg ? RULE_FIELDS[errorArg] : undefined;
  const backendField =
    errorArg && fields.some((field) => field.id === errorArg)
      ? errorArg
      : ruleField && fields.some((field) => field.id === ruleField)
        ? ruleField
        : null;
  const backendMessage =
    errorArg && ruleField
      ? t(`worksheets:rules.${errorArg}`)
      : t("worksheets:fieldInvalid");
  const formError = current?.error
    ? backendField
      ? null
      : errorArg
        ? t(`worksheets:rules.${errorArg}`, {
            defaultValue: t(`errors:${current.error}`),
          })
        : t(`errors:${current.error}`)
    : null;

  const sheetOptions = useMemo(
    () =>
      WORKSHEET_IDS.map((id) => ({
        value: id,
        label: t(`worksheets:sheets.${id}.title`),
      })),
    [t],
  );

  const rows =
    info && current?.values
      ? info.results.map((definition) => ({
          definition,
          value: current.values?.find((entry) => entry.id === definition.id)?.value ?? "",
        }))
      : [];

  const chooseSheet = (next: WorksheetId) => {
    setSheet(next);
    const target = catalog?.worksheets.find((entry) => entry.id === next);
    setValues(target ? defaultsOf(target) : {});
    setComputed(null);
  };

  const updateValue = (id: string, value: string) => {
    setValues((previous) => ({ ...previous, [id]: value }));
  };

  const copyResult = (value: string) => {
    if (!value) {
      return;
    }
    void copyText(value)
      .then(() => showToast(t("common:copied"), { variant: "success" }))
      .catch(() => showToast(t("errors:INTERNAL"), { variant: "danger" }));
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("worksheets:title")}</h1>
      </header>

      <section className={styles.calculator} aria-label={t("worksheets:title")}>
        {preview ? (
          <SoftCard padding="md" className={styles.stateCard}>
            <p className={styles.stateText}>{t("basic:previewNotice")}</p>
          </SoftCard>
        ) : loadFailed ? (
          <SoftCard padding="md" className={styles.stateCard}>
            <p className={styles.stateText}>{t("worksheets:loadFailed")}</p>
            <SoftButton
              variant="secondary"
              onClick={() => {
                setLoadFailed(false);
                setCatalog(null);
                setReloadToken((token) => token + 1);
              }}
            >
              {t("common:retry")}
            </SoftButton>
          </SoftCard>
        ) : !catalog || !info ? (
          <SoftCard padding="md" className={styles.stateCard}>
            <p className={styles.stateText}>{t("worksheets:loading")}</p>
          </SoftCard>
        ) : (
          <>
            <SoftSegmentedControl
              value={sheet}
              ariaLabel={t("worksheets:sheet")}
              onChange={chooseSheet}
              options={sheetOptions}
            />

            <SoftCard padding="md" className={styles.panel}>
              <div className={cx(styles.fields, fields.length > 3 && styles.fieldsDense)}>
                {info.fields.map((field) => {
                  const localError = fieldErrors[field.id];
                  const error =
                    localError ??
                    (backendField === field.id ? backendMessage : undefined);
                  const label = t(`worksheets:sheets.${sheet}.fields.${field.id}`);
                  return (
                    <SoftInput
                      key={field.id}
                      label={label}
                      aria-label={label}
                      value={values[field.id] ?? ""}
                      inputMode={field.kind === "integer" ? "numeric" : "decimal"}
                      autoComplete="off"
                      spellCheck={false}
                      error={error}
                      data-testid={`worksheet-field-${field.id}`}
                      onChange={(event) => updateValue(field.id, event.target.value)}
                    />
                  );
                })}
              </div>
              {formError ? (
                <p className={styles.formError} role="alert" data-testid="worksheet-error">
                  {formError}
                </p>
              ) : null}
            </SoftCard>

            <SoftCard padding="md" className={styles.panel}>
              <div className={styles.resultBlock}>
                <div className={styles.resultHeader}>
                  <span className={styles.resultLabel}>{t("worksheets:result")}</span>
                </div>
                {rows.length > 0 ? (
                  <dl className={styles.resultList} data-testid="worksheet-results">
                    {rows.map(({ definition, value }) => {
                      const label = t(
                        `worksheets:sheets.${sheet}.results.${definition.id}`,
                      );
                      return (
                        <div key={definition.id} className={styles.resultRow}>
                          <dt className={styles.resultName}>{label}</dt>
                          <dd className={styles.resultValue} data-testid={`worksheet-${definition.id}`}>
                            {value ? formatResult(value, definition.kind, grouping) : "—"}
                          </dd>
                          <button
                            type="button"
                            className={styles.copy}
                            onClick={() => copyResult(value)}
                            disabled={!value}
                            aria-label={t("worksheets:copyResult", { name: label })}
                          >
                            <CopyIcon size={15} />
                          </button>
                        </div>
                      );
                    })}
                  </dl>
                ) : (
                  <p className={styles.resultHint} data-testid="worksheet-hint">
                    {invalidCount > 0 || current?.error
                      ? t("worksheets:fieldHint")
                      : t("worksheets:resultHint")}
                  </p>
                )}
              </div>
            </SoftCard>
          </>
        )}
      </section>
    </div>
  );
}