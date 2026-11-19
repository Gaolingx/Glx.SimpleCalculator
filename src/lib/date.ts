/**
 * ISO date helpers for the date page and DatePicker.
 *
 * Dates are strict `YYYY-MM-DD` strings (years 1–9999). All calendar math is
 * done on UTC-anchored values so locale rendering never shifts the day.
 */

export interface IsoDateParts {
  year: number;
  month: number;
  day: number;
}

const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MIN_YEAR = 1;
const MAX_YEAR = 9999;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12) {
    return 0;
  }
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return days[month - 1] ?? 0;
}

export function parseIsoDate(value: string): IsoDateParts | null {
  const match = ISO_PATTERN.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (
    !Number.isInteger(year) ||
    year < MIN_YEAR ||
    year > MAX_YEAR ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month)
  ) {
    return null;
  }
  return { year, month, day };
}

export function isValidIsoDate(value: string): boolean {
  return parseIsoDate(value) !== null;
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}

export function isoFromParts(year: number, month: number, day: number): string | null {
  const iso = `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
  return isValidIsoDate(iso) ? iso : null;
}

/** `0 = Monday … 6 = Sunday`, derived without `Date` so year < 100 is safe. */
export function weekdayIndex(year: number, month: number, day: number): number {
  const offsets = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const adjusted = month < 3 ? year - 1 : year;
  const sundayFirst =
    (adjusted +
      Math.floor(adjusted / 4) -
      Math.floor(adjusted / 100) +
      Math.floor(adjusted / 400) +
      offsets[month - 1] +
      day) %
    7;
  return (sundayFirst + 6) % 7;
}

export function todayIso(now: Date = new Date()): string {
  return `${pad(now.getFullYear(), 4)}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function addDaysIso(iso: string, delta: number): string | null {
  const parts = parseIsoDate(iso);
  if (!parts) {
    return null;
  }
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day + delta);
  const year = date.getUTCFullYear();
  if (year < MIN_YEAR || year > MAX_YEAR) {
    return null;
  }
  return isoFromParts(year, date.getUTCMonth() + 1, date.getUTCDate());
}

export function addMonthsIso(iso: string, delta: number): string | null {
  const parts = parseIsoDate(iso);
  if (!parts) {
    return null;
  }
  const total = parts.year * 12 + (parts.month - 1) + delta;
  const year = Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12 + 1;
  const day = Math.min(parts.day, daysInMonth(year, month));
  return isoFromParts(year, month, day);
}

/** 42 cells (Monday first); `0` is a leading/trailing blank. */
export function monthGrid(year: number, month: number): number[] {
  const offset = weekdayIndex(year, month, 1);
  const days = daysInMonth(year, month);
  return Array.from({ length: 42 }, (_, index) => {
    const day = index - offset + 1;
    return day >= 1 && day <= days ? day : 0;
  });
}

export function weekdayLabels(locale: string): string[] {
  const formatter = new Intl.DateTimeFormat(locale, {
    weekday: "narrow",
    timeZone: "UTC",
  });
  return Array.from({ length: 7 }, (_, index) =>
    formatter.format(Date.UTC(2024, 0, 1 + index)),
  );
}

export function monthName(locale: string, month: number): string {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    timeZone: "UTC",
  }).format(Date.UTC(2024, month - 1, 1));
}

export function monthYearLabel(locale: string, year: number, month: number): string {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, 1);
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(date);
}

/** Localized long date, e.g. `2026年11月19日` / `November 19, 2026`. */
export function formatIsoDate(iso: string, locale: string): string {
  const parts = parseIsoDate(iso);
  if (!parts) {
    return iso;
  }
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Compact localized date for narrow fields, e.g. `2026/11/19` / `11/19/2026`. */
export function formatIsoDateShort(iso: string, locale: string): string {
  const parts = parseIsoDate(iso);
  if (!parts) {
    return iso;
  }
  const date = new Date(0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  }).format(date);
}