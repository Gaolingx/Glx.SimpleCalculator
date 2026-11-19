// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import i18n, { initI18n } from "../../i18n";
import { todayIso } from "../../lib/date";
import { DatePicker } from "./DatePicker";

beforeAll(async () => {
  await initI18n("zh-CN");
});

afterEach(() => {
  cleanup();
});

function renderPicker(value: string) {
  const onChange = vi.fn();
  render(
    <DatePicker value={value} onChange={onChange} ariaLabel="日期" />,
  );
  return { onChange };
}

function trigger() {
  return screen.getByRole("button", { name: "日期" });
}

function dialog() {
  return screen.getByRole("dialog", { name: "日期" });
}

function cell(date: string) {
  const node = document.querySelector<HTMLButtonElement>(`[data-date="${date}"]`);
  expect(node).not.toBeNull();
  return node as HTMLButtonElement;
}

function open(value = "2024-02-01") {
  const { onChange } = renderPicker(value);
  fireEvent.click(trigger());
  return { onChange };
}

describe("DatePicker", () => {
  it("opens the grid with the selected date", () => {
    renderPicker("2024-02-29");
    fireEvent.click(trigger());

    expect(dialog()).toBeTruthy();
    expect(cell("2024-02-29").getAttribute("aria-selected")).toBe("true");
    expect(document.querySelector('[data-date="2024-02-30"]')).toBeNull();
    expect(document.activeElement).toBe(cell("2024-02-29"));
  });

  it("selects a leap day and closes", () => {
    const { onChange } = open();

    fireEvent.click(cell("2024-02-29"));

    expect(onChange).toHaveBeenCalledWith("2024-02-29");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("moves focus with the keyboard and selects with Enter", () => {
    const { onChange } = open();

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "ArrowRight" });
    expect(document.activeElement).toBe(cell("2024-02-02"));

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "ArrowDown" });
    expect(document.activeElement).toBe(cell("2024-02-09"));

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("2024-02-09");
  });

  it("pages months from the keyboard with month-end clamping", () => {
    open("2024-01-31");

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "PageDown" });

    expect(document.activeElement).toBe(cell("2024-02-29"));
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Enter" });
  });

  it("switches between day, month and year views", () => {
    const { onChange } = open("2024-02-29");

    fireEvent.click(screen.getByRole("button", { name: /2024/ }));
    expect(screen.getByRole("gridcell", { name: "三月" })).toBeTruthy();
    fireEvent.click(screen.getByRole("gridcell", { name: "三月" }));
    expect(screen.getByRole("button", { name: /2024年3月/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /2024年3月/ }));
    fireEvent.click(screen.getByRole("button", { name: "2024" }));
    fireEvent.click(screen.getByRole("gridcell", { name: "2025" }));
    expect(screen.getByRole("button", { name: "2025" })).toBeTruthy();

    fireEvent.click(screen.getByRole("gridcell", { name: "一月" }));
    fireEvent.click(cell("2025-01-29"));
    expect(onChange).toHaveBeenCalledWith("2025-01-29");
  });

  it("selects today or clears from the footer", () => {
    const { onChange } = open();

    fireEvent.click(screen.getByRole("button", { name: i18n.t("date:picker.today") }));
    expect(onChange).toHaveBeenCalledWith(todayIso());
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole("button", { name: i18n.t("date:picker.clear") }));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("steps back through views and closes with Escape", () => {
    open();

    fireEvent.click(screen.getByRole("button", { name: /2024/ }));
    expect(screen.getByRole("gridcell", { name: "三月" })).toBeTruthy();

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Escape" });
    expect(cell("2024-02-01")).toBeTruthy();

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it("closes on an outside pointer press", () => {
    open();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens from the trigger with ArrowDown", () => {
    renderPicker("2024-02-01");
    fireEvent.keyDown(trigger(), { key: "ArrowDown" });
    expect(dialog()).toBeTruthy();
  });
});