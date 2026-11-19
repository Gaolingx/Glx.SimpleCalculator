// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "../../components/ui";
import i18n, { initI18n } from "../../i18n";
import { formatIsoDate, todayIso } from "../../lib/date";
import {
  IpcError,
  type DateDifferenceResult,
  type DateShiftInput,
} from "../../lib/ipc";
import { DateCalcPage } from "./DateCalcPage";

const DIFFERENCE: DateDifferenceResult = {
  years: 1,
  months: 0,
  days: 1,
  totalDays: 366,
  totalWeeks: 52,
};

const backend = vi.hoisted(() => ({
  tauri: true,
  dateDiff: vi.fn<(from: string, to: string) => Promise<DateDifferenceResult>>(),
  dateAdd: vi.fn<(input: DateShiftInput) => Promise<string>>(),
  copyText: vi.fn<(text: string) => Promise<void>>(),
}));

vi.mock("../../lib/ipc", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/ipc")>();
  return {
    ...actual,
    isTauriRuntime: () => backend.tauri,
    dateDiff: backend.dateDiff,
    dateAdd: backend.dateAdd,
    copyText: backend.copyText,
  };
});

function renderPage() {
  return render(
    <ToastProvider>
      <DateCalcPage />
    </ToastProvider>,
  );
}

function dateTrigger(name: string) {
  return screen.getByRole("button", { name });
}

function pagePicker(date: string) {
  const node = document.querySelector<HTMLButtonElement>(`[data-date="${date}"]`);
  expect(node).not.toBeNull();
  return node as HTMLButtonElement;
}

beforeAll(async () => {
  await initI18n("zh-CN");
});

beforeEach(() => {
  backend.tauri = true;
  backend.dateDiff.mockReset();
  backend.dateDiff.mockResolvedValue({ ...DIFFERENCE });
  backend.dateAdd.mockReset();
  backend.dateAdd.mockResolvedValue("2024-02-29");
  backend.copyText.mockReset();
  backend.copyText.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

describe("DateCalcPage", () => {
  it("computes the default difference and shows totals", async () => {
    renderPage();
    const today = todayIso();

    await waitFor(() =>
      expect(backend.dateDiff).toHaveBeenCalledWith(today, today),
    );
    await waitFor(() =>
      expect(screen.getByTestId("date-difference").textContent).toBe(
        i18n.t("date:yearsMonthsDays", { years: 1, months: 0, days: 1 }),
      ),
    );
    expect(screen.getByTestId("date-total-days").textContent).toContain("366");
    expect(screen.getByTestId("date-total-weeks").textContent).toContain("52");
  });

  it("recomputes when the end date changes", async () => {
    renderPage();
    const today = todayIso();
    const target = `${today.slice(0, 7)}-15`;

    fireEvent.click(dateTrigger("结束日期"));
    fireEvent.click(pagePicker(target));

    await waitFor(() =>
      expect(backend.dateDiff).toHaveBeenLastCalledWith(today, target),
    );
  });

  it("swaps the two dates", async () => {
    renderPage();
    const today = todayIso();
    const target = `${today.slice(0, 7)}-15`;

    fireEvent.click(dateTrigger("结束日期"));
    fireEvent.click(pagePicker(target));
    fireEvent.click(screen.getByRole("button", { name: i18n.t("date:swap") }));

    await waitFor(() =>
      expect(backend.dateDiff).toHaveBeenLastCalledWith(target, today),
    );
  });

  it("adds days by default in add mode", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("radio", { name: i18n.t("date:addSubtract") }));

    await waitFor(() =>
      expect(backend.dateAdd).toHaveBeenLastCalledWith({
        date: todayIso(),
        years: 0,
        months: 0,
        weeks: 0,
        days: 1,
      }),
    );
    await waitFor(() =>
      expect(screen.getByTestId("date-shift-result").textContent).toBe(
        formatIsoDate("2024-02-29", "zh-CN"),
      ),
    );
  });

  it("subtracts months when the direction and unit change", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("radio", { name: i18n.t("date:addSubtract") }));
    await waitFor(() => expect(backend.dateAdd).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("radio", { name: i18n.t("date:subtract") }));
    fireEvent.click(screen.getByRole("combobox", { name: i18n.t("date:unit") }));
    fireEvent.click(
      screen.getByRole("option", { name: i18n.t("date:units.months") }),
    );

    await waitFor(() =>
      expect(backend.dateAdd).toHaveBeenLastCalledWith({
        date: todayIso(),
        years: 0,
        months: -1,
        weeks: 0,
        days: 0,
      }),
    );
  });

  it("rejects a non-positive amount without calling the backend", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("radio", { name: i18n.t("date:addSubtract") }));
    await waitFor(() => expect(backend.dateAdd).toHaveBeenCalled());

    backend.dateAdd.mockClear();
    fireEvent.change(
      screen.getByRole("textbox", { name: i18n.t("date:amount") }),
      { target: { value: "0" } },
    );

    expect(screen.getAllByText(i18n.t("date:invalidAmount")).length).toBeGreaterThan(0);
    expect(backend.dateAdd).not.toHaveBeenCalled();
  });

  it("shows the localized backend error", async () => {
    backend.dateDiff.mockRejectedValue(new IpcError("OVERFLOW"));
    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("date-difference").textContent).toBe(
        i18n.t("errors:OVERFLOW"),
      ),
    );
  });

  it("copies total days and the shifted ISO date", async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId("date-difference").textContent).not.toBe("—"),
    );
    fireEvent.click(screen.getByRole("button", { name: i18n.t("common:copy") }));
    await waitFor(() => expect(backend.copyText).toHaveBeenCalledWith("366"));

    fireEvent.click(screen.getByRole("radio", { name: i18n.t("date:addSubtract") }));
    await waitFor(() =>
      expect(screen.getByTestId("date-shift-result").textContent).not.toBe("—"),
    );
    fireEvent.click(screen.getByRole("button", { name: i18n.t("common:copy") }));
    await waitFor(() => expect(backend.copyText).toHaveBeenCalledWith("2024-02-29"));
  });

  it("keeps preview mode free of backend calls", () => {
    backend.tauri = false;
    renderPage();

    expect(screen.getByText(i18n.t("basic:previewNotice"))).toBeTruthy();
    expect(backend.dateDiff).not.toHaveBeenCalled();
    expect(backend.dateAdd).not.toHaveBeenCalled();
  });
});