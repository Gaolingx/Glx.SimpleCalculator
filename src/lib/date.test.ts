import { describe, expect, it } from "vitest";

import {
  addDaysIso,
  addMonthsIso,
  daysInMonth,
  formatIsoDate,
  formatIsoDateShort,
  isoFromParts,
  isLeapYear,
  isValidIsoDate,
  monthGrid,
  monthName,
  monthYearLabel,
  parseIsoDate,
  todayIso,
  weekdayIndex,
  weekdayLabels,
} from "./date";

describe("date helpers", () => {
  it("parses strict ISO dates and rejects impossible ones", () => {
    expect(parseIsoDate("2024-02-29")).toEqual({ year: 2024, month: 2, day: 29 });
    expect(parseIsoDate("0001-01-01")).toEqual({ year: 1, month: 1, day: 1 });

    for (const invalid of [
      "2023-02-29",
      "2024-02-30",
      "2023-13-01",
      "2024-00-10",
      "2024-1-01",
      "2024-01-1",
      "24-01-01",
      "",
    ]) {
      expect(isValidIsoDate(invalid)).toBe(false);
    }
  });

  it("knows leap years and month lengths", () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2023)).toBe(false);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2023, 2)).toBe(28);
    expect(daysInMonth(2024, 4)).toBe(30);
  });

  it("builds ISO strings only for valid parts", () => {
    expect(isoFromParts(2024, 2, 29)).toBe("2024-02-29");
    expect(isoFromParts(2023, 2, 29)).toBeNull();
    expect(isoFromParts(2024, 13, 1)).toBeNull();
  });

  it("anchors weekdays to Monday", () => {
    expect(weekdayIndex(2024, 1, 1)).toBe(0);
    expect(weekdayIndex(2024, 1, 7)).toBe(6);
    expect(weekdayIndex(2026, 11, 19)).toBe(3);
  });

  it("formats today from local components", () => {
    expect(todayIso(new Date(2026, 10, 19, 23, 30))).toBe("2026-11-19");
  });

  it("adds days across month and year boundaries", () => {
    expect(addDaysIso("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDaysIso("2023-02-28", 1)).toBe("2023-03-01");
    expect(addDaysIso("2024-03-01", -1)).toBe("2024-02-29");
    expect(addDaysIso("2023-12-31", 1)).toBe("2024-01-01");
    expect(addDaysIso("0001-01-01", -1)).toBeNull();
    expect(addDaysIso("9999-12-31", 1)).toBeNull();
  });

  it("adds months with month-end clamping", () => {
    expect(addMonthsIso("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonthsIso("2023-01-31", 1)).toBe("2023-02-28");
    expect(addMonthsIso("2024-03-31", -1)).toBe("2024-02-29");
    expect(addMonthsIso("2024-12-15", 1)).toBe("2025-01-15");
    expect(addMonthsIso("2024-01-15", -1)).toBe("2023-12-15");
  });

  it("lays out a Monday-first month grid", () => {
    const february = monthGrid(2024, 2);
    expect(february).toHaveLength(42);
    expect(weekdayIndex(2024, 2, 1)).toBe(3);
    expect(february.slice(0, 3)).toEqual([0, 0, 0]);
    expect(february[3]).toBe(1);
    expect(february[31]).toBe(29);
    expect(february[32]).toBe(0);
  });

  it("renders localized names", () => {
    expect(weekdayLabels("en-US")[0]).toBe("M");
    expect(weekdayLabels("en-US")[6]).toBe("S");
    expect(weekdayLabels("zh-CN")).toHaveLength(7);
    expect(monthName("en-US", 2)).toBe("February");
    expect(monthYearLabel("en-US", 2026, 11)).toBe("November 2026");
    expect(formatIsoDate("2024-02-29", "en-US")).toBe("February 29, 2024");
    expect(formatIsoDate("2024-02-29", "zh-CN")).toContain("2024");
    expect(formatIsoDate("bad", "en-US")).toBe("bad");
    expect(formatIsoDateShort("2024-02-29", "zh-CN")).toBe("2024/02/29");
    expect(formatIsoDateShort("2024-02-29", "en-US")).toBe("02/29/2024");
  });
});