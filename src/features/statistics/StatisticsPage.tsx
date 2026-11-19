import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { CopyIcon, TrashIcon } from "../../components/layout/icons";
import {
  SoftButton,
  SoftCard,
  SoftDialog,
  SoftInput,
} from "../../components/ui";
import { formatExpression, formatNumber } from "../../lib/format";
import type { CalcCommand, CalcMode, StatOp } from "../../lib/ipc";
import { useSettingsStore } from "../../stores/settings";
import { useCalculatorSession } from "../shared/useCalculatorSession";
import styles from "./StatisticsPage.module.css";

const MODE: CalcMode = "statistics";
/** HANDOFF §3.5: 6–12 significant digits for statistics results. */
const RESULT_DIGITS = 12;
const EMPTY_DATA: readonly string[] = [];

const STAT_OPS: readonly StatOp[] = [
  "sum",
  "sumSquares",
  "count",
  "mean",
  "median",
  "mode",
  "sampleStdDev",
  "populationStdDev",
  "variance",
  "range",
  "min",
  "max",
];

const SORT_MODES = ["input", "asc", "desc"] as const;
type SortMode = (typeof SORT_MODES)[number];

const SORT_GLYPH: Record<SortMode, string> = {
  input: "⇅",
  asc: "↑",
  desc: "↓",
};

interface DatasetRow {
  /** Original entry index; stable across display sorting. */
  index: number;
  value: string;
  numeric: number;
}

export function StatisticsPage() {
  const { t } = useTranslation();
  const grouping = useSettingsStore((state) => state.settings.grouping);
  const { view, transportError, previewNotice, send, copyValue } =
    useCalculatorSession(MODE);

  const [input, setInput] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [sort, setSort] = useState<SortMode>("input");
  const [confirmingClear, setConfirmingClear] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const data = view.statistics?.data ?? EMPTY_DATA;

  const rows = useMemo<DatasetRow[]>(() => {
    const items = data.map((value, index) => ({
      index,
      value,
      numeric: Number(value),
    }));
    if (sort === "asc") {
      items.sort((a, b) => a.numeric - b.numeric);
    } else if (sort === "desc") {
      items.sort((a, b) => b.numeric - a.numeric);
    }
    return items;
  }, [data, sort]);

  const error = transportError ?? view.error?.code ?? null;
  const errorText = (() => {
    if (!error) {
      return "";
    }
    if (error === "DOMAIN_ERROR" && data.length === 0) {
      return t("statistics:emptyHint");
    }
    if (error === "DOMAIN_ERROR" && data.length === 1) {
      return t("statistics:needTwo");
    }
    return t(`errors:${error}`);
  })();

  const resultText = error
    ? errorText
    : view.value
      ? formatNumber(view.value, { grouping, significantDigits: RESULT_DIGITS })
      : "—";
  const expressionText = view.expression
    ? formatExpression(view.expression, grouping)
    : t("statistics:resultHint");

  const submit = () => {
    const value = input.trim();
    if (!value) {
      return;
    }
    const command: CalcCommand =
      editing === null
        ? { type: "statsAdd", value }
        : { type: "statsUpdate", index: editing, value };
    void send(command).then((next) => {
      if (next && next.error === null) {
        setInput("");
        setEditing(null);
      }
    });
  };

  const startEdit = (row: DatasetRow) => {
    setEditing(row.index);
    setInput(row.value);
    inputRef.current?.focus();
  };

  const cancelEdit = () => {
    setEditing(null);
    setInput("");
  };

  const removeAt = (index: number) => {
    void send({ type: "statsRemove", index }).then((next) => {
      if (next && next.error === null) {
        setEditing(null);
        setInput("");
      }
    });
  };

  const clearDataset = () => {
    setConfirmingClear(false);
    void send({ type: "statsClear" }).then((next) => {
      if (next && next.error === null) {
        setEditing(null);
        setInput("");
      }
    });
  };

  const cycleSort = () => {
    const next = (SORT_MODES.indexOf(sort) + 1) % SORT_MODES.length;
    setSort(SORT_MODES[next]);
  };

  const sortLabel = t(`statistics:sort.${sort}`);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("statistics:title")}</h1>
      </header>
      <section className={styles.calculator} aria-label={t("statistics:title")}>
        <form
          className={styles.entryBar}
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <SoftInput
            ref={inputRef}
            className={styles.entryField}
            label={t("statistics:value")}
            value={input}
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            placeholder={t("statistics:placeholder")}
            onChange={(event) => setInput(event.target.value)}
          />
          <SoftButton
            type="submit"
            variant="primary"
            size="sm"
            className={styles.entryAction}
            disabled={!input.trim()}
          >
            {editing === null ? t("statistics:add") : t("statistics:update")}
          </SoftButton>
          {editing !== null ? (
            <SoftButton
              variant="ghost"
              size="sm"
              className={styles.entryAction}
              onClick={cancelEdit}
            >
              {t("statistics:cancelEdit")}
            </SoftButton>
          ) : null}
        </form>

        <SoftCard padding="md" className={styles.resultCard}>
          <div className={styles.resultHeader}>
            <span className={styles.resultLabel}>{t("statistics:result")}</span>
            <button
              type="button"
              className={styles.copy}
              onClick={() => copyValue(view.value)}
              disabled={!view.value || error !== null}
              aria-label={t("common:copy")}
            >
              <CopyIcon size={15} />
            </button>
          </div>
          <p
            className={styles.resultValue}
            data-testid="stats-result"
            data-error={error ? true : undefined}
            aria-live="polite"
          >
            {resultText}
          </p>
          <p className={styles.resultExpression} title={expressionText}>
            {expressionText}
          </p>
        </SoftCard>

        <SoftCard padding="none" className={styles.datasetCard}>
          <div className={styles.datasetHeader}>
            <div className={styles.datasetTitle}>
              <span className={styles.datasetLabel}>{t("statistics:dataset")}</span>
              <span className={styles.datasetCount}>
                {t("statistics:count", { count: data.length })}
              </span>
            </div>
            <div className={styles.datasetActions}>
              <SoftButton
                variant="ghost"
                size="sm"
                className={styles.toolButton}
                onClick={cycleSort}
                aria-label={sortLabel}
                title={sortLabel}
              >
                <span aria-hidden="true">
                  {t("statistics:sort.label")} {SORT_GLYPH[sort]}
                </span>
              </SoftButton>
              <SoftButton
                variant="ghost"
                size="sm"
                className={styles.toolButton}
                onClick={() => setConfirmingClear(true)}
                disabled={data.length === 0}
              >
                {t("statistics:clear")}
              </SoftButton>
            </div>
          </div>
          {rows.length === 0 ? (
            <p className={styles.empty}>{t("statistics:empty")}</p>
          ) : (
            <ul className={styles.datasetList} aria-label={t("statistics:dataset")}>
              {rows.map((row) => (
                <li
                  key={row.index}
                  className={styles.datasetRow}
                  data-testid="stats-row"
                  data-index={row.index}
                >
                  <span className={styles.rowIndex}>{row.index + 1}</span>
                  <span className={styles.rowValue}>
                    {formatNumber(row.value, {
                      grouping,
                      significantDigits: RESULT_DIGITS,
                    })}
                  </span>
                  <SoftButton
                    variant="ghost"
                    size="icon"
                    className={styles.rowAction}
                    aria-label={t("statistics:edit", { index: row.index + 1 })}
                    onClick={() => startEdit(row)}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M4 20h4L19 9a2.5 2.5 0 00-3.5-3.5L4.5 16.5 4 20z" />
                      <path d="M13.5 6.5L17.5 10.5" />
                    </svg>
                  </SoftButton>
                  <SoftButton
                    variant="ghost"
                    size="icon"
                    className={styles.rowAction}
                    aria-label={t("statistics:delete", { index: row.index + 1 })}
                    onClick={() => removeAt(row.index)}
                  >
                    <TrashIcon size={14} />
                  </SoftButton>
                </li>
              ))}
            </ul>
          )}
        </SoftCard>

        <SoftCard padding="sm" className={styles.functionsCard}>
          <div
            className={styles.functions}
            role="group"
            aria-label={t("statistics:functionsLabel")}
          >
            {STAT_OPS.map((op) => (
              <SoftButton
                key={op}
                variant="function"
                size="md"
                className={styles.functionKey}
                aria-label={t(`statistics:functions.${op}`)}
                onClick={() => void send({ type: "statsCompute", op })}
              >
                {t(`statistics:labels.${op}`)}
              </SoftButton>
            ))}
          </div>
        </SoftCard>

        {previewNotice ? (
          <p className={styles.notice} role="status">
            {t("basic:previewNotice")}
          </p>
        ) : null}
      </section>

      <SoftDialog
        open={confirmingClear}
        onClose={() => setConfirmingClear(false)}
        title={t("statistics:clearTitle")}
        footer={
          <>
            <SoftButton variant="ghost" onClick={() => setConfirmingClear(false)}>
              {t("cancel")}
            </SoftButton>
            <SoftButton variant="danger" onClick={clearDataset}>
              {t("ok")}
            </SoftButton>
          </>
        }
      >
        <p className={styles.confirmText}>
          {t("statistics:clearConfirm", { count: data.length })}
        </p>
      </SoftDialog>
    </div>
  );
}