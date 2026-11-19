import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { CopyIcon, SwapIcon } from "../../components/layout/icons";
import {
  SoftButton,
  SoftCard,
  SoftCombobox,
  SoftInput,
  useToast,
} from "../../components/ui";
import { formatNumber } from "../../lib/format";
import {
  convertUnit,
  copyText,
  fetchCurrencyStatus,
  fetchUnitCatalog,
  isTauriRuntime,
  refreshCurrency,
  toIpcError,
  type CurrencyStatus,
  type ErrorCode,
  type UnitCatalog,
  type UnitCategory,
  type UnitInfo,
} from "../../lib/ipc";
import { useSettingsStore } from "../../stores/settings";
import styles from "./ConverterPage.module.css";

/** HANDOFF §3.5: currency results show 6 significant digits, other units 12. */
const UNIT_DIGITS = 12;
const CURRENCY_DIGITS = 6;
const DEFAULT_CATEGORY: UnitCategory = "length";
const EMPTY_UNITS: readonly UnitInfo[] = [];

interface Conversion {
  key: string;
  value: string | null;
  error: ErrorCode | null;
}

export function ConverterPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const grouping = useSettingsStore((state) => state.settings.grouping);
  const preview = !isTauriRuntime();

  const [catalog, setCatalog] = useState<UnitCatalog | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [category, setCategory] = useState<UnitCategory>(DEFAULT_CATEGORY);
  const [from, setFrom] = useState("km");
  const [to, setTo] = useState("m");
  const [input, setInput] = useState("1");
  const [conversion, setConversion] = useState<Conversion | null>(null);
  const [currencyStatus, setCurrencyStatus] = useState<CurrencyStatus | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [ratesVersion, setRatesVersion] = useState(0);
  const requestId = useRef(0);

  useEffect(() => {
    if (preview) {
      return undefined;
    }
    let cancelled = false;
    fetchUnitCatalog()
      .then((next) => {
        if (cancelled) {
          return;
        }
        setCatalog(next);
        const initial =
          next.categories.find((entry) => entry.id === DEFAULT_CATEGORY) ??
          next.categories[0];
        if (initial) {
          setCategory(initial.id);
          const source = initial.units.find((unit) => unit.id === "km") ?? initial.units[0];
          const target =
            initial.units.find((unit) => unit.id === "m" && unit.id !== source?.id) ??
            initial.units[1] ??
            initial.units[0];
          setFrom(source?.id ?? "");
          setTo(target?.id ?? "");
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

  useEffect(() => {
    if (preview) {
      return undefined;
    }
    let cancelled = false;
    fetchCurrencyStatus()
      .then((next) => {
        if (!cancelled) {
          setCurrencyStatus(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCurrencyStatus(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [preview]);

  const categories = catalog?.categories;
  const activeCategory = categories?.find((entry) => entry.id === category);
  const units = activeCategory?.units ?? EMPTY_UNITS;

  const chooseCategory = (next: UnitCategory) => {
    setCategory(next);
    const info = categories?.find((entry) => entry.id === next);
    const list = info?.units ?? EMPTY_UNITS;
    setFrom(list[0]?.id ?? "");
    setTo((list[1] ?? list[0])?.id ?? "");
  };

  useEffect(() => {
    if (preview || !activeCategory || !from || !to) {
      return undefined;
    }
    const value = input.trim();
    if (!value) {
      return undefined;
    }

    const key = `${category}|${from}|${to}|${value}`;
    const id = requestId.current + 1;
    requestId.current = id;
    const timer = window.setTimeout(() => {
      convertUnit({ category, value, from, to })
        .then((next) => {
          if (requestId.current === id) {
            setConversion({ key, value: next, error: null });
          }
        })
        .catch((reason: unknown) => {
          if (requestId.current === id) {
            setConversion({ key, value: null, error: toIpcError(reason).code });
          }
        });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [preview, activeCategory, input, category, from, to, ratesVersion]);

  const requestKey =
    activeCategory && from && to ? `${category}|${from}|${to}|${input.trim()}` : "";
  const current = conversion && conversion.key === requestKey ? conversion : null;
  const result = current?.value ?? null;
  const error = current?.error ?? null;

  const unitName = useCallback(
    (unit: UnitInfo) => t(`units:names.${unit.id}`, { defaultValue: unit.symbol }),
    [t],
  );

  const categoryOptions = useMemo(
    () =>
      (categories ?? []).map((entry) => ({
        value: entry.id,
        label: t(`units:categories.${entry.id}`),
      })),
    [categories, t],
  );

  const unitOptions = useMemo(
    () =>
      units.map((unit) => ({
        value: unit.id,
        label: unitName(unit),
        hint: unit.symbol,
        searchText: unitName(unit),
      })),
    [units, unitName],
  );

  const fromUnit = units.find((unit) => unit.id === from);
  const toUnit = units.find((unit) => unit.id === to);
  const digits = category === "currency" ? CURRENCY_DIGITS : UNIT_DIGITS;

  const resultText = error
    ? t(`errors:${error}`)
    : result
      ? formatNumber(result, { grouping, significantDigits: digits })
      : "—";

  const formulaText =
    error
      ? ""
      : result && fromUnit && toUnit
        ? `${formatNumber(input.trim(), { grouping, significantDigits: digits })} ${fromUnit.symbol} = ${resultText} ${toUnit.symbol}`
        : t("units:resultHint");

  const copy = () => {
    if (!result) {
      return;
    }
    void copyText(result)
      .then(() => showToast(t("common:copied"), { variant: "success" }))
      .catch(() => showToast(t("errors:INTERNAL"), { variant: "danger" }));
  };

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  const refreshRates = () => {
    if (refreshing) {
      return;
    }
    setRefreshing(true);
    refreshCurrency()
      .then((next) => {
        setCurrencyStatus(next);
        setRatesVersion((version) => version + 1);
      })
      .catch(() => {
        setCurrencyStatus((previous) =>
          previous ? { ...previous, refreshFailed: true } : previous,
        );
      })
      .finally(() => setRefreshing(false));
  };

  const rateSourceText = !currencyStatus
    ? t("units:ratesLoading")
    : currencyStatus.available
      ? currencyStatus.date
        ? t("units:rateSource", {
            source: currencyStatus.source,
            date: currencyStatus.date,
          })
        : t("units:rateSourceNoDate", { source: currencyStatus.source })
      : t("units:ratesUnavailable");

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("units:title")}</h1>
      </header>

      <section className={styles.calculator} aria-label={t("units:title")}>
        {preview ? (
          <SoftCard padding="md" className={styles.stateCard}>
            <p className={styles.stateText}>{t("basic:previewNotice")}</p>
          </SoftCard>
        ) : loadFailed ? (
          <SoftCard padding="md" className={styles.stateCard}>
            <p className={styles.stateText}>{t("units:loadFailed")}</p>
            <SoftButton
              variant="secondary"
              onClick={() => {
                setLoadFailed(false);
                setCatalog(null);
                setReloadToken((n) => n + 1);
              }}
            >
              {t("common:retry")}
            </SoftButton>
          </SoftCard>
        ) : !catalog ? (
          <SoftCard padding="md" className={styles.stateCard}>
            <p className={styles.stateText}>{t("units:loading")}</p>
          </SoftCard>
        ) : (
          <>
            <SoftCombobox
              className={styles.category}
              label={t("units:category")}
              ariaLabel={t("units:category")}
              value={category}
              options={categoryOptions}
              onChange={chooseCategory}
              disabled={categoryOptions.length === 0}
            />

            {category === "currency" ? (
              <>
                <div className={styles.rateBar} data-testid="currency-rate-bar">
                  <p className={styles.rateSource} role="status" aria-live="polite">
                    {rateSourceText}
                  </p>
                  <SoftButton
                    size="sm"
                    variant="ghost"
                    onClick={refreshRates}
                    loading={refreshing}
                  >
                    {t("units:refreshRates")}
                  </SoftButton>
                </div>
                {currencyStatus?.refreshFailed ? (
                  <p className={styles.rateWarning} role="status">
                    {currencyStatus.available && currencyStatus.date
                      ? t("units:refreshFailed", { date: currencyStatus.date })
                      : t("units:refreshFailedNoCache")}
                  </p>
                ) : null}
              </>
            ) : null}

            <SoftCard padding="md" className={styles.panel}>
              <SoftInput
                label={t("units:inputValue")}
                value={input}
                inputMode="decimal"
                autoComplete="off"
                spellCheck={false}
                placeholder={t("units:placeholder")}
                onChange={(event) => setInput(event.target.value)}
              />

              <div className={styles.unitRow}>
                <SoftCombobox
                  label={t("units:from")}
                  ariaLabel={t("units:from")}
                  value={from}
                  options={unitOptions}
                  onChange={setFrom}
                  disabled={unitOptions.length === 0}
                />
                <SoftButton
                  variant="secondary"
                  size="icon"
                  className={styles.swapButton}
                  aria-label={t("units:swap")}
                  onClick={swap}
                  disabled={units.length < 2}
                >
                  <SwapIcon size={16} />
                </SoftButton>
                <SoftCombobox
                  label={t("units:to")}
                  ariaLabel={t("units:to")}
                  value={to}
                  options={unitOptions}
                  onChange={setTo}
                  disabled={unitOptions.length === 0}
                />
              </div>

              <div className={styles.resultBlock}>
                <div className={styles.resultHeader}>
                  <span className={styles.resultLabel}>{t("units:result")}</span>
                  <button
                    type="button"
                    className={styles.copy}
                    onClick={copy}
                    disabled={!result || error !== null}
                    aria-label={t("common:copy")}
                  >
                    <CopyIcon size={15} />
                  </button>
                </div>
                <output
                  className={styles.resultValue}
                  data-testid="unit-result"
                  data-error={error ? true : undefined}
                  aria-label={t("units:result")}
                  aria-live="polite"
                >
                  {resultText}
                </output>
                {formulaText ? (
                  <p className={styles.formula} data-testid="unit-formula">
                    {formulaText}
                  </p>
                ) : null}
                {error === "CURRENCY_OFFLINE" ? (
                  <p className={styles.hint}>{t("units:currencyHint")}</p>
                ) : null}
              </div>
            </SoftCard>
          </>
        )}
      </section>
    </div>
  );
}