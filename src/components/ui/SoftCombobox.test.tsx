// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SoftCombobox } from "./SoftCombobox";

const OPTIONS = [
  { value: "m", label: "Meter", hint: "m" },
  { value: "km", label: "Kilometer", hint: "km" },
  { value: "ft", label: "Foot", hint: "ft" },
] as const;

type Option = (typeof OPTIONS)[number]["value"];

function renderCombobox({
  value = "m" as Option,
  onChange = vi.fn<(next: Option) => void>(),
  disabled = false,
} = {}) {
  render(
    <SoftCombobox
      value={value}
      options={OPTIONS}
      onChange={onChange}
      ariaLabel="Unit"
      disabled={disabled}
    />,
  );
  return { trigger: screen.getByRole("combobox", { name: "Unit" }), onChange };
}

afterEach(() => {
  cleanup();
});

describe("SoftCombobox", () => {
  it("opens the listbox and selects an option", () => {
    const { trigger, onChange } = renderCombobox();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("listbox")).toBeTruthy();

    fireEvent.click(screen.getByRole("option", { name: /Kilometer/ }));
    expect(onChange).toHaveBeenCalledWith("km");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("moves with the keyboard and commits with Enter", () => {
    const { trigger, onChange } = renderCombobox();

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(screen.getByRole("listbox")).toBeTruthy();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("km");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("closes on Escape without changing the value", () => {
    const { trigger, onChange } = renderCombobox();
    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: "Escape" });

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("jumps to the first matching option on typeahead", () => {
    const { trigger, onChange } = renderCombobox();
    fireEvent.keyDown(trigger, { key: "f" });
    expect(screen.getByRole("listbox")).toBeTruthy();

    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("ft");
  });

  it("ignores interaction while disabled", () => {
    const { trigger, onChange } = renderCombobox({ disabled: true });
    fireEvent.click(trigger);

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("closes when the user clicks outside", () => {
    const { trigger } = renderCombobox();
    fireEvent.click(trigger);
    expect(screen.getByRole("listbox")).toBeTruthy();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});