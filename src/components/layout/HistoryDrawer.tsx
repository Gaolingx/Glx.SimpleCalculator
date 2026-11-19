import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { PageId } from "../../app/router";
import { formatExpression, formatNumber } from "../../lib/format";
import { recallCommand } from "../../lib/history";
import {
  copyText,
  isTauriRuntime,
  resetSession,
  toIpcError,
  type CalcMode,
  type HistoryEntry,
} from "../../lib/ipc";
import { useCalcStore } from "../../stores/calc";
import { useHistoryStore } from "../../stores/history";
import { useSettingsStore } from "../../stores/settings";
import { useUiStore } from "../../stores/ui";
import { SoftButton, SoftDialog, useToast } from "../ui";
import { CopyIcon, HistoryIcon, TrashIcon } from "./icons";
import styles from "./HistoryDrawer.module.css";

const PAGE_BY_MODE: Record<CalcMode, PageId> = {
  basic: "basic",
  scientific: "scientific",
  programmer: "programmer",
  statistics: "statistics",
  dateCalc: "datecalc",
  converter: "converter",
  worksheets: "worksheets",
};

interface DayGroup {
  key: string;
  label: string;
  entries: HistoryEntry[];
}

function startOfDay(ts: number): number {
  const date = new Date(ts);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function dayBounds(): { today: number; yesterday: number } {
  const today = startOfDay(Date.now());
  const previous = new Date(today);
  previous.setDate(previous.getDate() - 1);
  return { today, yesterday: startOfDay(previous.getTime()) };
}

export interface HistoryDrawerProps {
  /** Only entries for the active mode are shown, matching the calculator
   * session the drawer belongs to. */
  mode: CalcMode;
  onNavigate: (page: PageId) => void;
}

export function HistoryDrawer({ mode, onNavigate }: HistoryDrawerProps) {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const open = useUiStore((state) => state.overlay === "history");
  const closeOverlay = useUiStore((state) => state.closeOverlay);
  const storedEntries = useHistoryStore((state) => state.entries);
  const loading = useHistoryStore((state) => state.loading);
  const error = useHistoryStore((state) => state.error);
  const refresh = useHistoryStore((state) => state.refresh);
  const remove = useHistoryStore((state) => state.remove);
  const clear = useHistoryStore((state) => state.clear);
  const dispatch = useCalcStore((state) => state.dispatch);
  const grouping = useSettingsStore((state) => state.settings.grouping);
  const [confirming, setConfirming] = useState(false);

  const entries = useMemo(
    () => storedEntries.filter((entry) => entry.mode === mode),
    [storedEntries, mode],
  );

  useEffect(() => {
    if (open) {
      void refresh();
    }
  }, [open, refresh]);

  const groups = useMemo<DayGroup[]>(() => {
    const dayFormatter = new Intl.DateTimeFormat(i18n.language, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    const { today, yesterday } = dayBounds();

    const labelFor = (ts: number): string => {
      const day = startOfDay(ts);
      if (day === today) {
        return t("history:today");
      }
      if (day === yesterday) {
        return t("history:yesterday");
      }
      return dayFormatter.format(ts);
    };

    const grouped = new Map<string, DayGroup>();
    for (const entry of entries) {
      const day = startOfDay(entry.ts);
      const key = String(day);
      const group = grouped.get(key);
      if (group) {
        group.entries.push(entry);
      } else {
        grouped.set(key, { key, label: labelFor(entry.ts), entries: [entry] });
      }
    }
    return [...grouped.values()];
  }, [entries, i18n.language, t]);

  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [i18n.language],
  );

  const handleRestore = (entry: HistoryEntry) => {
    if (!isTauriRuntime()) {
      showToast(t("basic:previewNotice"));
      return;
    }
    void (async () => {
      try {
        const reset = await resetSession(entry.mode);
        useCalcStore.getState().setView(reset);
        await dispatch(recallCommand(entry));
        onNavigate(PAGE_BY_MODE[entry.mode]);
        closeOverlay();
      } catch (cause) {
        const code = toIpcError(cause).code;
        showToast(t(`errors:${code}`), { variant: "danger" });
      }
    })();
  };

  const handleCopy = (entry: HistoryEntry) => {
    void copyText(entry.value)
      .then(() => showToast(t("common:copied"), { variant: "success" }))
      .catch(() => showToast(t("errors:INTERNAL"), { variant: "danger" }));
  };

  const handleClear = () => {
    setConfirming(false);
    void clear(mode);
  };

  const footer =
    entries.length === 0 ? undefined : confirming ? (
      <div className={styles.confirm}>
        <p className={styles.confirmText}>{t("history:clearConfirm")}</p>
        <div className={styles.confirmActions}>
          <SoftButton variant="ghost" onClick={() => setConfirming(false)}>
            {t("cancel")}
          </SoftButton>
          <SoftButton variant="danger" onClick={handleClear}>
            {t("ok")}
          </SoftButton>
        </div>
      </div>
    ) : (
      <SoftButton variant="ghost" fullWidth onClick={() => setConfirming(true)}>
        {t("history:clear")}
      </SoftButton>
    );

  return (
    <SoftDialog
      open={open}
      onClose={closeOverlay}
      title={t("history:title")}
      variant="sheet"
      footer={footer}
    >
      {error ? (
        <p className={styles.error} role="alert">
          {t(`errors:${error.code}`)}
        </p>
      ) : null}
      {entries.length === 0 ? (
        loading ? (
          <p className={styles.status}>{t("common:loading")}</p>
        ) : (
          <div className={styles.empty}>
            <span className={styles.icon}>
              <HistoryIcon size={26} />
            </span>
            <p className={styles.text}>{t("history:empty")}</p>
            <p className={styles.hint}>{t("history:emptyHint")}</p>
          </div>
        )
      ) : (
        <div className={styles.groups}>
          {groups.map((group) => (
            <section key={group.key} className={styles.group}>
              <h3 className={styles.day}>{group.label}</h3>
              <ul className={styles.list}>
                {group.entries.map((entry) => (
                  <li key={entry.id} className={styles.item}>
                    <button
                      type="button"
                      className={styles.restore}
                      onClick={() => handleRestore(entry)}
                      aria-label={t("history:restoreEntry", {
                        expression: formatExpression(entry.expression, grouping),
                      })}
                    >
                      <span className={styles.expression}>
                        {formatExpression(entry.expression, grouping)}
                      </span>
                      <span className={styles.value}>
                        {formatNumber(entry.value, { grouping })}
                      </span>
                    </button>
                    <div className={styles.meta}>
                      <span className={styles.time}>
                        {timeFormatter.format(entry.ts)}
                      </span>
                      <div className={styles.actions}>
                        <button
                          type="button"
                          className={styles.iconButton}
                          aria-label={t("common:copy")}
                          onClick={() => handleCopy(entry)}
                        >
                          <CopyIcon size={16} />
                        </button>
                        <button
                          type="button"
                          className={styles.iconButton}
                          aria-label={t("history:delete")}
                          onClick={() => void remove(entry.id)}
                        >
                          <TrashIcon size={16} />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </SoftDialog>
  );
}