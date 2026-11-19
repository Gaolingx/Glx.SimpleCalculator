// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import i18n, { initI18n } from "../../i18n";
import {
  emptyCalcView,
  type CalcCommand,
  type CalcView,
} from "../../lib/ipc";
import { DEFAULT_SETTINGS } from "../../lib/settings";
import { useCalcStore } from "../../stores/calc";
import { useHistoryStore } from "../../stores/history";
import { useSettingsStore } from "../../stores/settings";
import { useUiStore } from "../../stores/ui";
import { BasicPage } from "./BasicPage";

const backend = vi.hoisted(() => ({
  tauri: true,
  calcCommand: vi.fn<(command: CalcCommand) => Promise<CalcView>>(),
  addHistory: vi.fn<(input: unknown) => Promise<unknown[]>>(),
}));

vi.mock("../../lib/ipc", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/ipc")>();
  return {
    ...actual,
    isTauriRuntime: () => backend.tauri,
    calcCommand: backend.calcCommand,
    addHistory: backend.addHistory,
  };
});

function view(patch: Partial<CalcView> = {}): CalcView {
  return { ...emptyCalcView("basic"), ...patch };
}

function valueText(): string {
  return screen.getByTestId("calc-value").textContent ?? "";
}

function press(key: string): void {
  fireEvent.keyDown(window, { key });
}

beforeAll(async () => {
  await initI18n("zh-CN");
});

beforeEach(() => {
  backend.tauri = true;
  backend.calcCommand.mockReset();
  backend.calcCommand.mockResolvedValue(view());
  backend.addHistory.mockReset();
  backend.addHistory.mockResolvedValue([]);
  useCalcStore.setState({ views: {} });
  useHistoryStore.setState({ entries: [], loaded: false, loading: false, error: null });
  useSettingsStore.setState({
    settings: { ...DEFAULT_SETTINGS, grouping: true },
    hydrated: true,
    saving: false,
    error: null,
  });
  useUiStore.setState({ overlay: null });
});

afterEach(() => {
  cleanup();
});

describe("BasicPage", () => {
  it("sends keypad commands through the IPC contract", async () => {
    render(<BasicPage />);

    fireEvent.click(screen.getByRole("button", { name: "7" }));
    fireEvent.click(screen.getByRole("button", { name: i18n.t("basic:keys.add") }));
    fireEvent.click(screen.getByRole("button", { name: "3" }));
    fireEvent.click(screen.getByRole("button", { name: i18n.t("basic:keys.equals") }));

    await waitFor(() => expect(backend.calcCommand).toHaveBeenCalledTimes(4));
    expect(backend.calcCommand.mock.calls.map(([command]) => command)).toEqual([
      { type: "digit", digit: 7 },
      { type: "binary", op: "add" },
      { type: "digit", digit: 3 },
      { type: "equals" },
    ]);
  });

  it("drives the same commands from the keyboard", async () => {
    backend.calcCommand.mockImplementation(async (command) =>
      command.type === "equals"
        ? view({ expression: "2 + 3 =", value: "5" })
        : view(),
    );
    render(<BasicPage />);

    press("2");
    press("+");
    press("3");
    press("Enter");

    await waitFor(() => expect(valueText()).toBe("5"));
    expect(backend.calcCommand.mock.calls.map(([command]) => command)).toEqual([
      { type: "digit", digit: 2 },
      { type: "binary", op: "add" },
      { type: "digit", digit: 3 },
      { type: "equals" },
    ]);
    expect(screen.getByText("2 + 3 =")).toBeTruthy();
  });

  it("records completed calculations in history", async () => {
    backend.calcCommand.mockResolvedValue(
      view({ expression: "2 + 3 =", value: "5" }),
    );
    render(<BasicPage />);

    press("Enter");

    await waitFor(() =>
      expect(backend.addHistory).toHaveBeenCalledWith({
        mode: "basic",
        expression: "2 + 3 =",
        value: "5",
      }),
    );
  });

  it("skips recording when history is disabled", async () => {
    useSettingsStore.setState({
      settings: { ...DEFAULT_SETTINGS, historyEnabled: false },
    });
    backend.calcCommand.mockResolvedValue(
      view({ expression: "2 + 3 =", value: "5" }),
    );
    render(<BasicPage />);

    press("Enter");

    await waitFor(() => expect(valueText()).toBe("5"));
    expect(backend.addHistory).not.toHaveBeenCalled();
  });

  it("formats the value with grouping driven by settings", async () => {
    backend.calcCommand.mockResolvedValue(view({ value: "1234567" }));
    render(<BasicPage />);

    press("7");
    await waitFor(() => expect(valueText()).toBe("1,234,567"));

    act(() => {
      useSettingsStore.setState({
        settings: { ...DEFAULT_SETTINGS, grouping: false },
      });
    });
    expect(valueText()).toBe("1234567");
  });

  it("renders localized engine errors while keeping the expression", async () => {
    backend.calcCommand.mockResolvedValue(
      view({
        expression: "1 / 0",
        value: "",
        error: { code: "DIVIDE_BY_ZERO", args: [] },
      }),
    );
    render(<BasicPage />);

    press("Enter");

    await waitFor(() =>
      expect(valueText()).toBe(i18n.t("errors:DIVIDE_BY_ZERO")),
    );
    expect(screen.getByText("1 ÷ 0")).toBeTruthy();
  });

  it("shows the memory indicator and enables recall once memory exists", async () => {
    const initial = i18n.t("basic:memoryKeys.clear");
    render(<BasicPage />);
    expect(screen.getByRole("button", { name: initial }).hasAttribute("disabled")).toBe(true);

    backend.calcCommand.mockResolvedValue(view({ value: "7", memory: "7" }));
    press("7");

    await waitFor(() =>
      expect(screen.getByLabelText(i18n.t("basic:memoryIndicator"))).toBeTruthy(),
    );
    expect(screen.getByRole("button", { name: initial }).hasAttribute("disabled")).toBe(false);
  });

  it("does not intercept keys while an overlay is open", async () => {
    useUiStore.setState({ overlay: "settings" });
    render(<BasicPage />);

    press("5");

    expect(backend.calcCommand).not.toHaveBeenCalled();
  });

  it("reports preview mode instead of pretending to calculate", async () => {
    backend.tauri = false;
    render(<BasicPage />);

    fireEvent.click(screen.getByRole("button", { name: "7" }));

    expect(backend.calcCommand).not.toHaveBeenCalled();
    expect(screen.getByText(i18n.t("basic:previewNotice"))).toBeTruthy();
  });
});
