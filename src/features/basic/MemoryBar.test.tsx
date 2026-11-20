// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import i18n, { initI18n } from "../../i18n";
import type { CalcCommand, MemoryView } from "../../lib/ipc";
import { MemoryBar } from "./MemoryBar";

beforeAll(async () => {
  await initI18n();
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

const memories: MemoryView[] = [
  { id: "2", value: "42" },
  { id: "1", value: "7" },
];

describe("MemoryBar", () => {
  it("disables memory actions while the list is empty", () => {
    render(<MemoryBar memories={[]} onCommand={() => {}} />);

    for (const key of ["clear", "recall"]) {
      expect(
        screen.getByRole("button", { name: i18n.t(`basic:memoryKeys.${key}`) }).hasAttribute("disabled"),
      ).toBe(true);
    }
    expect(
      screen.getByRole("button", { name: i18n.t("basic:memoryKeys.store") }).hasAttribute("disabled"),
    ).toBe(false);
    expect(
      screen.getByRole("button", { name: i18n.t("basic:memoryOpen") }).hasAttribute("disabled"),
    ).toBe(true);
  });

  it("opens the panel and recalls the selected slot", async () => {
    const onCommand = vi.fn<(command: CalcCommand) => void>();
    render(<MemoryBar memories={memories} onCommand={onCommand} />);

    fireEvent.click(screen.getByRole("button", { name: i18n.t("basic:memoryOpen") }));
    const menu = screen.getByRole("menu", { name: i18n.t("basic:memoryPanel") });
    const items = screen.getAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "42",
      "7",
      i18n.t("basic:memoryClearAll"),
    ]);

    fireEvent.click(screen.getByRole("menuitem", { name: "7" }));
    expect(onCommand).toHaveBeenCalledWith({ type: "memory", op: "recall", id: "1" });
    await waitFor(() => expect(menu.isConnected).toBe(false));
  });

  it("clears every slot from the panel footer", () => {
    const onCommand = vi.fn<(command: CalcCommand) => void>();
    render(<MemoryBar memories={memories} onCommand={onCommand} />);

    fireEvent.click(screen.getByRole("button", { name: i18n.t("basic:memoryOpen") }));
    fireEvent.click(screen.getByRole("menuitem", { name: i18n.t("basic:memoryClearAll") }));

    expect(onCommand).toHaveBeenCalledWith({ type: "memory", op: "clear" });
  });

  it("sends stateless memory operations for the bar keys", () => {
    const onCommand = vi.fn<(command: CalcCommand) => void>();
    render(<MemoryBar memories={memories} onCommand={onCommand} />);

    fireEvent.click(screen.getByRole("button", { name: i18n.t("basic:memoryKeys.store") }));
    fireEvent.click(screen.getByRole("button", { name: i18n.t("basic:memoryKeys.clear") }));

    expect(onCommand).toHaveBeenNthCalledWith(1, { type: "memory", op: "store" });
    expect(onCommand).toHaveBeenNthCalledWith(2, { type: "memory", op: "clear" });
  });
});
