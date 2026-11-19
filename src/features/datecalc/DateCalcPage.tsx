import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { CopyIcon, SwapIcon } from "../../components/layout/icons";
import {
  DatePicker,
  SoftButton,
  SoftCard,
  SoftCombobox,
  SoftInput,
  SoftSegmentedControl,
  useToast,
} from "../../components/ui";
import { formatIsoDate, todayIso } from "../../lib/date";
import {
  copyText,
  dateAdd,
  dateDiff,
  isTauriRuntime,
  toIpcError,
  type DateDifferenceResult,
  type ErrorCode,
} from "../../lib/ipc";
import styles from "./DateCalcPage.module.css";

type Mode = "difference" | "addSubtract";
type Direction = "add" | "subtract";
type ShiftUnit = "days" | "weeks" | "months" | "years";

const SHIFT_UNITS: readonly ShiftUnit[] = ["days", "weeks", "months", "years"];
const AMOUNT_PATTERN = /^\d{1,7}$/;

interface DifferenceState {
  key: string;
  result: DateDifferenceResult | null;
  error: ErrorCode | null;
}

interface ShiftState {
  key: string;
  date: string | null;
  error: ErrorCode | null;
}

function parseAmount(raw: string): number | null {
  const text = raw.trim();
  if (!AMOUNT_PATTERN.test(text)) {
    return null;
  }
  const amount = Number(text);
  return amount > 0 ? amount : null;
}

export function DateCalcPage() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  const preview = !isTauriRuntime();

  const [mode, setMode] = useState<Mode>("difference");
  const [from, setFrom] = useState(todayIso);
  const [to, setTo] = useState(todayIso);
  const [difference, setDifference] = useState<DifferenceState | null>(null);
  const [start, setStart] = useState(todayIso);
  const [direction, setDirection] = useState<Direction>("add");
  const [amount, setAmount] = useState("1");
  const [unit, setUnit] = useState<ShiftUnit>("days");
  const [shift, setShift] = useState<ShiftState | null>(null);
  const differenceRequest = useRef(0);
  const shiftRequest = useRef(0);

  const differenceKey = from && to ? `${from}|${to}` : "";
  const parsedAmount = parseAmount(amount);
  const shiftKey =
    start && parsedAmount !== null ? `${start}|${direction}|${unit}|${parsedAmount}` : "";

  useEffect(() => {
    if (preview || !from || !to) {
      return;
    }
    const id = differenceRequest.current + 1;
    differenceRequest.current = id;
    dateDiff(from, to)
      .then((result) => {
        if (differenceRequest.current === id) {
          setDifference({ key: `${from}|${to}`, result, error: null });
        }
      })
      .catch((reason: unknown) => {
        if (differenceRequest.current === id) {
          setDifference({
            key: `${from}|${to}`,
            result: null,
            error: toIpcError(reason).code,
          });
        }
      });
  }, [preview, from, to]);

  useEffect(() => {
    if (preview || !start || parsedAmount === null) {
      return;
    }
    const sign = direction === "subtract" ? -1 : 1;
    const input = {
      date: start,
      years: unit === "years" ? sign * parsedAmount : 0,
      months: unit === "months" ? sign * parsedAmount : 0,
      weeks: unit === "weeks" ? sign * parsedAmount : 0,
      days: unit === "days" ? sign * parsedAmount : 0,
    };
    const key = `${start}|${direction}|${unit}|${parsedAmount}`;
    const id = shiftRequest.current + 1;
    shiftRequest.current = id;
    dateAdd(input)
      .then((date) => {
        if (shiftRequest.current === id) {
          setShift({ key, date, error: null });
        }
      })
      .catch((reason: unknown) => {
        if (shiftRequest.current === id) {
          setShift({ key, date: null, error: toIpcError(reason).code });
        }
      });
  }, [preview, start, direction, unit, parsedAmount]);

  const currentDifference =
    difference && difference.key === differenceKey ? difference : null;
  const currentShift = shift && shift.key === shiftKey ? shift : null;
  const amountInvalid = amount.trim() !== "" && parsedAmount === null;

  const unitOptions = useMemo(
    () =>
      SHIFT_UNITS.map((value) => ({
        value,
        label: t(`date:units.${value}`),
      })),
    [t],
  );

  const absDays = currentDifference?.result
    ? Math.abs(currentDifference.result.totalDays)
    : 0;
  const wholeWeeks = Math.floor(absDays / 7);
  const remainderDays = absDays % 7;

  const differenceText = currentDifference?.error
    ? t(`errors:${currentDifference.error}`)
    : currentDifference?.result
      ? t("date:yearsMonthsDays", {
          years: currentDifference.result.years,
          months: currentDifference.result.months,
          days: currentDifference.result.days,
        })
      : "—";

  const shiftText = currentShift?.error
    ? t(`errors:${currentShift.error}`)
    : currentShift?.date
      ? formatIsoDate(currentShift.date, locale)
      : "—";

  const copyDifference = () => {
    if (!currentDifference?.result) {
      return;
    }
    void copyText(String(absDays))
      .then(() => showToast(t("common:copied"), { variant: "success" }))
      .catch(() => showToast(t("errors:INTERNAL"), { variant: "danger" }));
  };

  const copyShift = () => {
    if (!currentShift?.date) {
      return;
    }
    void copyText(currentShift.date)
      .then(() => showToast(t("common:copied"), { variant: "success" }))
      .catch(() => showToast(t("errors:INTERNAL"), { variant: "danger" }));
  };

  const signLabel = direction === "subtract" ? "−" : "+";

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("date:title")}</h1>
      </header>

      <section className={styles.calculator} aria-label={t("date:title")}>
        {preview ? (
          <SoftCard padding="md" className={styles.stateCard}>
            <p className={styles.stateText}>{t("basic:previewNotice")}</p>
          </SoftCard>
        ) : (
          <>
            <SoftSegmentedControl
              value={mode}
              ariaLabel={t("date:mode")}
              onChange={setMode}
              options={[
                { value: "difference", label: t("date:difference") },
                { value: "addSubtract", label: t("date:addSubtract") },
              ]}
            />

            {mode === "difference" ? (
              <SoftCard padding="md" className={styles.panel}>
                <div className={styles.dateStack}>
                  <DatePicker
                    label={t("date:from")}
                    ariaLabel={t("date:from")}
                    value={from}
                    onChange={setFrom}
                  />
                  <div className={styles.swapRow}>
                    <SoftButton
                      variant="secondary"
                      size="icon"
                      className={styles.swapButton}
                      aria-label={t("date:swap")}
                      onClick={() => {
                        setFrom(to);
                        setTo(from);
                      }}
                      disabled={!from || !to}
                    >
                      <SwapIcon size={16} />
                    </SoftButton>
                  </div>
                  <DatePicker
                    label={t("date:to")}
                    ariaLabel={t("date:to")}
                    value={to}
                    onChange={setTo}
                  />
                </div>

                <div className={styles.resultBlock}>
                  <div className={styles.resultHeader}>
                    <span className={styles.resultLabel}>{t("date:result")}</span>
                    <button
                      type="button"
                      className={styles.copy}
                      onClick={copyDifference}
                      disabled={!currentDifference?.result}
                      aria-label={t("common:copy")}
                    >
                      <CopyIcon size={15} />
                    </button>
                  </div>
                  <output
                    className={styles.resultValue}
                    data-testid="date-difference"
                    data-error={currentDifference?.error ? true : undefined}
                    aria-live="polite"
                  >
                    {differenceText}
                  </output>
                  {currentDifference?.result && from && to ? (
                    <>
                      <p className={styles.formula}>
                        {formatIsoDate(from, locale)} → {formatIsoDate(to, locale)}
                      </p>
                      <div className={styles.totals}>
                        <span data-testid="date-total-days">
                          {t("date:totalDays", { days: absDays })}
                        </span>
                        <span data-testid="date-total-weeks">
                          {t("date:totalWeeks", {
                            weeks: wholeWeeks,
                            days: remainderDays,
                          })}
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className={styles.formula}>{t("date:resultHint")}</p>
                  )}
                </div>
              </SoftCard>
            ) : (
              <>
                <SoftCard padding="md" className={styles.panel}>
                  <DatePicker
                    label={t("date:startDate")}
                    ariaLabel={t("date:startDate")}
                    value={start}
                    onChange={setStart}
                  />
                  <div className={styles.directionRow}>
                    <SoftSegmentedControl
                      value={direction}
                      ariaLabel={t("date:direction")}
                      onChange={setDirection}
                      options={[
                        { value: "add", label: t("date:add") },
                        { value: "subtract", label: t("date:subtract") },
                      ]}
                    />
                  </div>
                  <div className={styles.amountRow}>
                    <SoftInput
                      label={t("date:amount")}
                      value={amount}
                      inputMode="numeric"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={t("date:amountPlaceholder")}
                      error={amountInvalid ? t("date:invalidAmount") : undefined}
                      onChange={(event) => setAmount(event.target.value)}
                    />
                    <SoftCombobox
                      label={t("date:unit")}
                      ariaLabel={t("date:unit")}
                      value={unit}
                      options={unitOptions}
                      onChange={setUnit}
                    />
                  </div>

                  <div className={styles.resultBlock}>
                    <div className={styles.resultHeader}>
                      <span className={styles.resultLabel}>{t("date:result")}</span>
                      <button
                        type="button"
                        className={styles.copy}
                        onClick={copyShift}
                        disabled={!currentShift?.date}
                        aria-label={t("common:copy")}
                      >
                        <CopyIcon size={15} />
                      </button>
                    </div>
                    <output
                      className={styles.resultValue}
                      data-testid="date-shift-result"
                      data-error={currentShift?.error ? true : undefined}
                      aria-live="polite"
                    >
                      {shiftText}
                    </output>
                    {currentShift?.date && start && parsedAmount !== null ? (
                      <>
                        <p className={styles.formula}>
                          {t("date:shiftFormula", {
                            date: formatIsoDate(start, locale),
                            sign: signLabel,
                            amount: parsedAmount,
                            unit: t(`date:units.${unit}`),
                          })}
                        </p>
                        <p className={styles.iso}>{currentShift.date}</p>
                      </>
                    ) : (
                      <p className={styles.formula}>
                        {amountInvalid ? t("date:invalidAmount") : t("date:resultHint")}
                      </p>
                    )}
                  </div>
                </SoftCard>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}