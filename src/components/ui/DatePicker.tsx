import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import {
  addDaysIso,
  addMonthsIso,
  daysInMonth,
  formatIsoDate,
  formatIsoDateShort,
  isoFromParts,
  monthGrid,
  monthName,
  monthYearLabel,
  parseIsoDate,
  todayIso,
  weekdayLabels,
} from "../../lib/date";
import { cx } from "./cx";
import styles from "./DatePicker.module.css";

export interface DatePickerProps {
  /** ISO `YYYY-MM-DD`, or an empty string when nothing is selected. */
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  label?: ReactNode;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

type View = "days" | "months" | "years";

const VIEWPORT_GAP = 8;
const MIN_YEAR = 1;
const MAX_YEAR = 9999;

function Chevron({ direction }: { direction: "left" | "right" | "up" | "down" }) {
  const path =
    direction === "left"
      ? "M15 18l-6-6 6-6"
      : direction === "right"
        ? "M9 6l6 6-6 6"
        : direction === "up"
          ? "M6 15l6-6 6 6"
          : "M6 9l6 6 6-6";
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

function clampYear(year: number): number {
  return Math.min(MAX_YEAR, Math.max(MIN_YEAR, year));
}

function yearPageStart(year: number): number {
  return Math.floor((year - MIN_YEAR) / 12) * 12 + MIN_YEAR;
}

export function DatePicker({
  value,
  onChange,
  ariaLabel,
  label,
  placeholder,
  disabled = false,
  className,
  id,
}: DatePickerProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  const generatedId = useId();
  const triggerId = id ?? generatedId;
  const labelId = `${triggerId}-label`;
  const popupId = `${triggerId}-popup`;

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("days");
  const [visibleYear, setVisibleYear] = useState(
    () => parseIsoDate(value)?.year ?? parseIsoDate(todayIso())?.year ?? 2024,
  );
  const [visibleMonth, setVisibleMonth] = useState(
    () => parseIsoDate(value)?.month ?? parseIsoDate(todayIso())?.month ?? 1,
  );
  const [focusedIso, setFocusedIso] = useState("");
  const [focusedMonth, setFocusedMonth] = useState(visibleMonth);
  const [focusedYear, setFocusedYear] = useState(visibleYear);
  const [position, setPosition] = useState({ left: 0, top: 0 });

  const selected = parseIsoDate(value);
  const today = todayIso();

  const isOpenFor = (year: number, month: number) =>
    visibleYear === year && visibleMonth === month;

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    const trigger = triggerRef.current;
    const popup = popupRef.current;
    if (!trigger || !popup) {
      return;
    }
    const rect = trigger.getBoundingClientRect();
    const width = popup.getBoundingClientRect().width;
    const height = popup.getBoundingClientRect().height;
    const below = rect.bottom + VIEWPORT_GAP;
    const fitsBelow = below + height <= window.innerHeight - VIEWPORT_GAP;
    setPosition({
      left: Math.max(
        VIEWPORT_GAP,
        Math.min(rect.left, window.innerWidth - width - VIEWPORT_GAP),
      ),
      top: fitsBelow
        ? below
        : Math.max(VIEWPORT_GAP, rect.top - VIEWPORT_GAP - height),
    });
  }, [open, view]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const handlePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !popupRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    const handleScroll = (event: Event) => {
      if (!popupRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleResize = () => setOpen(false);
    document.addEventListener("pointerdown", handlePointer, true);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);
    return () => {
      document.removeEventListener("pointerdown", handlePointer, true);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const node = popupRef.current?.querySelector<HTMLElement>('[data-focus="true"]');
    node?.focus();
  }, [open, view, focusedIso, focusedMonth, focusedYear, visibleYear, visibleMonth]);

  const openPicker = () => {
    if (disabled) {
      return;
    }
    const base = parseIsoDate(value) ?? parseIsoDate(today) ?? { year: 2024, month: 1, day: 1 };
    const iso = isoFromParts(base.year, base.month, base.day) ?? today;
    setVisibleYear(base.year);
    setVisibleMonth(base.month);
    setFocusedIso(iso);
    setFocusedMonth(base.month);
    setFocusedYear(base.year);
    setView("days");
    setOpen(true);
  };

  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) {
      triggerRef.current?.focus();
    }
  };

  const selectDate = (iso: string) => {
    onChange(iso);
    close(true);
  };

  const moveDayFocus = (delta: number) => {
    const next = focusedIso ? addDaysIso(focusedIso, delta) : today;
    if (!next) {
      return;
    }
    const parts = parseIsoDate(next);
    if (!parts) {
      return;
    }
    setFocusedIso(next);
    setVisibleYear(parts.year);
    setVisibleMonth(parts.month);
  };

  const showMonth = (delta: number) => {
    const next = addMonthsIso(isoFromParts(visibleYear, visibleMonth, 1) ?? today, delta);
    const parts = next ? parseIsoDate(next) : null;
    if (!parts) {
      return;
    }
    setVisibleYear(parts.year);
    setVisibleMonth(parts.month);
  };

  const selectMonth = (month: number) => {
    setVisibleMonth(month);
    setFocusedMonth(month);
    setView("days");
    const day = Math.min(selected?.day ?? 1, daysInMonth(visibleYear, month));
    const iso = isoFromParts(visibleYear, month, Math.max(1, day));
    if (iso) {
      setFocusedIso(iso);
    }
  };

  const selectYear = (year: number) => {
    setVisibleYear(year);
    setFocusedYear(year);
    setView("months");
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (view === "years") {
        setView("months");
      } else if (view === "months") {
        setView("days");
      } else {
        close(true);
      }
      return;
    }
    if (event.key === "Tab") {
      close(false);
      return;
    }

    if (view === "days") {
      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          moveDayFocus(-1);
          break;
        case "ArrowRight":
          event.preventDefault();
          moveDayFocus(1);
          break;
        case "ArrowUp":
          event.preventDefault();
          moveDayFocus(-7);
          break;
        case "ArrowDown":
          event.preventDefault();
          moveDayFocus(7);
          break;
        case "Home":
          event.preventDefault();
          moveDayFocus(-weekdayOffset(focusedIso));
          break;
        case "End":
          event.preventDefault();
          moveDayFocus(6 - weekdayOffset(focusedIso));
          break;
        case "PageUp":
          event.preventDefault();
          moveDayFocusMonths(event.shiftKey ? -12 : -1);
          break;
        case "PageDown":
          event.preventDefault();
          moveDayFocusMonths(event.shiftKey ? 12 : 1);
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          if (focusedIso) {
            selectDate(focusedIso);
          }
          break;
        default:
          break;
      }
      return;
    }

    if (view === "months") {
      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          setFocusedMonth((month) => Math.max(1, month - 1));
          break;
        case "ArrowRight":
          event.preventDefault();
          setFocusedMonth((month) => Math.min(12, month + 1));
          break;
        case "ArrowUp":
          event.preventDefault();
          setFocusedMonth((month) => Math.max(1, month - 3));
          break;
        case "ArrowDown":
          event.preventDefault();
          setFocusedMonth((month) => Math.min(12, month + 3));
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          selectMonth(focusedMonth);
          break;
        default:
          break;
      }
      return;
    }

    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        setFocusedYear((year) => clampYear(year - 1));
        break;
      case "ArrowRight":
        event.preventDefault();
        setFocusedYear((year) => clampYear(year + 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setFocusedYear((year) => clampYear(year - 3));
        break;
      case "ArrowDown":
        event.preventDefault();
        setFocusedYear((year) => clampYear(year + 3));
        break;
      case "PageUp":
        event.preventDefault();
        setFocusedYear((year) => clampYear(year - 12));
        break;
      case "PageDown":
        event.preventDefault();
        setFocusedYear((year) => clampYear(year + 12));
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        selectYear(focusedYear);
        break;
      default:
        break;
    }
  };

  const moveVisibleYear = (delta: number) => {
    const year = clampYear(visibleYear + delta);
    setVisibleYear(year);
  };

  const moveDayFocusMonths = (delta: number) => {
    const next = addMonthsIso(focusedIso || today, delta);
    const parts = next ? parseIsoDate(next) : null;
    if (!next || !parts) {
      return;
    }
    setFocusedIso(next);
    setVisibleYear(parts.year);
    setVisibleMonth(parts.month);
  };

  const weekdayOffset = (iso: string) => {
    const parts = parseIsoDate(iso);
    if (!parts) {
      return 0;
    }
    const grid = monthGrid(parts.year, parts.month);
    const index = grid.indexOf(parts.day);
    return index === -1 ? 0 : index % 7;
  };

  const days = monthGrid(visibleYear, visibleMonth);
  const weekdays = weekdayLabels(locale);
  const pageStart = yearPageStart(view === "years" ? focusedYear : visibleYear);
  const popupRange = `${pageStart}–${pageStart + 11}`;

  return (
    <div className={cx(styles.field, className)}>
      {label ? (
        <span className={styles.label} id={labelId}>
          {label}
        </span>
      ) : null}
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popupId : undefined}
        aria-labelledby={label ? labelId : undefined}
        aria-label={label ? undefined : ariaLabel}
        disabled={disabled}
        className={styles.trigger}
        onClick={() => (open ? close() : openPicker())}
        onKeyDown={(event) => {
          if (!open && (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            openPicker();
          }
        }}
      >
        <span className={cx(styles.value, !selected && styles.placeholder)}>
          {selected
            ? formatIsoDateShort(value, locale)
            : (placeholder ?? t("date:picker.placeholder"))}
        </span>
        <svg
          className={styles.calendarIcon}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M8 3v4M16 3v4M3 10h18" />
        </svg>
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popupRef}
              id={popupId}
              role="dialog"
              aria-label={ariaLabel}
              className={styles.popup}
              style={{ left: position.left, top: position.top }}
              onKeyDown={handleKeyDown}
            >
              <div className={styles.header}>
                {view === "days" ? (
                  <>
                    <button
                      type="button"
                      className={styles.nav}
                      aria-label={t("date:picker.previousYear")}
                      onClick={() => moveVisibleYear(-1)}
                    >
                      <Chevron direction="left" />
                      <Chevron direction="left" />
                    </button>
                    <button
                      type="button"
                      className={styles.nav}
                      aria-label={t("date:picker.previousMonth")}
                      onClick={() => showMonth(-1)}
                    >
                      <Chevron direction="left" />
                    </button>
                    <button
                      type="button"
                      className={styles.headerLabel}
                      onClick={() => {
                        setFocusedMonth(visibleMonth);
                        setView("months");
                      }}
                    >
                      {monthYearLabel(locale, visibleYear, visibleMonth)}
                    </button>
                    <button
                      type="button"
                      className={styles.nav}
                      aria-label={t("date:picker.nextMonth")}
                      onClick={() => showMonth(1)}
                    >
                      <Chevron direction="right" />
                    </button>
                    <button
                      type="button"
                      className={styles.nav}
                      aria-label={t("date:picker.nextYear")}
                      onClick={() => moveVisibleYear(1)}
                    >
                      <Chevron direction="right" />
                      <Chevron direction="right" />
                    </button>
                  </>
                ) : view === "months" ? (
                  <>
                    <button
                      type="button"
                      className={styles.nav}
                      aria-label={t("date:picker.previousYear")}
                      onClick={() => moveVisibleYear(-1)}
                    >
                      <Chevron direction="left" />
                    </button>
                    <button
                      type="button"
                      className={styles.headerLabel}
                      onClick={() => {
                        setFocusedYear(visibleYear);
                        setView("years");
                      }}
                    >
                      {visibleYear}
                    </button>
                    <button
                      type="button"
                      className={styles.nav}
                      aria-label={t("date:picker.nextYear")}
                      onClick={() => moveVisibleYear(1)}
                    >
                      <Chevron direction="right" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className={styles.nav}
                      aria-label={t("date:picker.previousYear")}
                      onClick={() => setFocusedYear((year) => clampYear(year - 12))}
                    >
                      <Chevron direction="left" />
                    </button>
                    <button
                      type="button"
                      className={styles.headerLabel}
                      onClick={() => setView("months")}
                    >
                      {popupRange}
                    </button>
                    <button
                      type="button"
                      className={styles.nav}
                      aria-label={t("date:picker.nextYear")}
                      onClick={() => setFocusedYear((year) => clampYear(year + 12))}
                    >
                      <Chevron direction="right" />
                    </button>
                  </>
                )}
              </div>

              {view === "days" ? (
                <>
                  <div className={styles.weekdays} aria-hidden="true">
                    {weekdays.map((name, index) => (
                      <span key={`${name}-${index}`} className={styles.weekday}>
                        {name}
                      </span>
                    ))}
                  </div>
                  <div role="grid" aria-label={ariaLabel} className={styles.grid}>
                    {Array.from({ length: 6 }, (_, row) => (
                      <div key={row} role="row" className={styles.row}>
                        {days
                          .slice(row * 7, row * 7 + 7)
                          .map((day, column) => {
                            if (day === 0) {
                              return (
                                <span
                                  key={`blank-${row}-${column}`}
                                  className={styles.blank}
                                  aria-hidden="true"
                                />
                              );
                            }
                            const iso =
                              isoFromParts(visibleYear, visibleMonth, day) ?? "";
                            const isSelected =
                              selected !== null &&
                              selected.year === visibleYear &&
                              selected.month === visibleMonth &&
                              selected.day === day;
                            return (
                              <button
                                key={iso}
                                type="button"
                                role="gridcell"
                                data-date={iso}
                                data-focus={iso === focusedIso ? "true" : undefined}
                                aria-selected={isSelected}
                                aria-label={formatIsoDate(iso, locale)}
                                tabIndex={iso === focusedIso ? 0 : -1}
                                className={cx(
                                  styles.day,
                                  isSelected && styles.selected,
                                  iso === today && styles.today,
                                )}
                                onClick={() => selectDate(iso)}
                              >
                                {day}
                              </button>
                            );
                          })}
                      </div>
                    ))}
                  </div>
                </>
              ) : view === "months" ? (
                <div role="grid" aria-label={ariaLabel} className={styles.gridMonths}>
                  {Array.from({ length: 12 }, (_, index) => {
                    const month = index + 1;
                    return (
                      <button
                        key={month}
                        type="button"
                        role="gridcell"
                        data-month={month}
                        data-focus={month === focusedMonth ? "true" : undefined}
                        aria-selected={isOpenFor(visibleYear, month)}
                        className={cx(
                          styles.cell,
                          visibleMonth === month && styles.selectedCell,
                        )}
                        onClick={() => selectMonth(month)}
                      >
                        {monthName(locale, month)}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div role="grid" aria-label={ariaLabel} className={styles.gridMonths}>
                  {Array.from({ length: 12 }, (_, index) => {
                    const year = pageStart + index;
                    if (year > MAX_YEAR) {
                      return (
                        <span
                          key={`empty-${year}`}
                          className={styles.cell}
                          aria-hidden="true"
                        />
                      );
                    }
                    return (
                      <button
                        key={year}
                        type="button"
                        role="gridcell"
                        data-year={year}
                        data-focus={year === focusedYear ? "true" : undefined}
                        aria-selected={selected?.year === year}
                        className={cx(
                          styles.cell,
                          visibleYear === year && styles.selectedCell,
                        )}
                        onClick={() => selectYear(year)}
                      >
                        {year}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className={styles.footer}>
                <button
                  type="button"
                  className={styles.footerButton}
                  onClick={() => selectDate(today)}
                >
                  {t("date:picker.today")}
                </button>
                <button
                  type="button"
                  className={styles.footerButton}
                  onClick={() => {
                    onChange("");
                    close(true);
                  }}
                >
                  {t("date:picker.clear")}
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}