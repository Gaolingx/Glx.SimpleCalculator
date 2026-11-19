// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "../../components/ui";
import i18n, { initI18n } from "../../i18n";
import {
  emptyCalcView,
  type CalcCommand,
  type CalcMode,
  type CalcView,
} from "../../lib/ipc";
import { DEFAULT_SETTINGS } from "../../lib/settings";
import { useCalcStore } from "../../stores/calc";
import { useHistoryStore } from "../../stores/history";
import { useSettingsStore } from "../../stores/settings";
import { useUiStore } from "../../stores/ui";
import { ScientificPage } from "./ScientificPage";

const backend = vi.hoisted(() => ({
  tauri: true,
  calcCommand: vi.fn<(command: CalcCommand) => Promise<CalcView>>(),
  selectSession: vi.fn<(mode: string) => Promise<CalcView>>(),
  addHistory: vi.fn<(input: unknown) => Promise<unknown[]>>(),
  copyText: vi.fn<(text: string) => Promise<void>>(),
  readClipboardText: vi.fn<() => Promise<string>>(),
  saveSettings: vi.fn<(settings: unknown) => Promise<unknown>>(),
}));

vi.mock("../../lib/ipc", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/ipc")>();
  return {
    ...actual,
    isTauriRuntime: () => backend.tauri,
    calcCommand: backend.calcCommand,
    selectSession: backend.selectSession,
    addHistory: backend.addHistory,
    copyText: backend.copyText,
    readClipboardText: backend.readClipboardText,
    saveSettings: backend.saveSettings,
  };
});

function view(patch: Partial<CalcView> = {}): CalcView {
  return { ...emptyCalcView("scientific"), ...patch };
}

function valueText(): string {
  return screen.getByTestId("calc-value").textContent ?? "";
}

function press(key: string, init: KeyboardEventInit = {}): void {
  fireEvent.keyDown(window, { key, ...init });
}

function renderPage() {
  return render(
    <ToastProvider>
      <ScientificPage />
    </ToastProvider>,
  );
}

beforeAll(async () => {
  await initI18n("zh-CN");
});

beforeEach(() => {
  backend.tauri = true;
  backend.calcCommand.mockReset();
  backend.calcCommand.mockResolvedValue(view());
  backend.selectSession.mockReset();
  backend.selectSession.mockImplementation(async (mode) =>
    useCalcStore.getState().views[mode as CalcMode] ?? view(),
  );
  backend.addHistory.mockReset();
  backend.addHistory.mockResolvedValue([]);
  backend.copyText.mockReset();
  backend.copyText.mockResolvedValue(undefined);
  backend.readClipboardText.mockReset();
  backend.readClipboardText.mockResolvedValue("");
  backend.saveSettings.mockReset();
  backend.saveSettings.mockImplementation(async (settings) => settings);
  useCalcStore.setState({ views: {} });
  useHistoryStore.setState({ entries: [], loaded: false, loading: false, error: null });
  useSettingsStore.setState({
    settings: { ...DEFAULT_SETTINGS, angleUnit: "deg", grouping: true },
    hydrated: true,
    saving: false,
    error: null,
  });
  useUiStore.setState({ overlay: null });
});

afterEach(() => {
  cleanup();
});

describe("ScientificPage", () => {
  it("activates the scientific session and synchronizes the angle unit", async () => {
    renderPage();

    await waitFor(() => expect(backend.selectSession).toHaveBeenCalledWith("scientific"));
    await waitFor(() =>
      expect(backend.calcCommand).toHaveBeenCalledWith({
        type: "setAngleUnit",
        unit: "deg",
      }),
    );
  });

  it("sends scientific keypad commands through the IPC contract", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: i18n.t("basic:keys.clearAll") }));
    fireEvent.click(screen.getByRole("button", { name: i18n.t("scientific:keys.sin") }));
    fireEvent.click(screen.getByRole("button", { name: i18n.t("scientific:keys.power") }));
    fireEvent.click(screen.getByRole("button", { name: i18n.t("scientific:keys.factorial") }));
    fireEvent.click(screen.getByRole("button", { name: i18n.t("basic:keys.equals") }));

    await waitFor(() => expect(backend.calcCommand).toHaveBeenCalledTimes(6));
    expect(backend.calcCommand.mock.calls.map(([command]) => command)).toEqual([
      { type: "setAngleUnit", unit: "deg" },
      { type: "clearAll" },
      { type: "unary", op: "sin" },
      { type: "binary", op: "power" },
      { type: "unary", op: "factorial" },
      { type: "equals" },
    ]);
  });

  it("persists the angle unit and forwards it to the engine", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("radio", { name: "RAD" }));

    await waitFor(() => expect(backend.saveSettings).toHaveBeenCalled());
    await waitFor(() =>
      expect(backend.calcCommand).toHaveBeenCalledWith({
        type: "setAngleUnit",
        unit: "rad",
      }),
    );
  });

  it("toggles F-E scientific notation for the display", async () => {
    useCalcStore.setState({ views: { scientific: view({ value: "1234.5" }) } });
    renderPage();
    expect(valueText()).toBe("1,234.5");

    fireEvent.click(screen.getByRole("button", { name: i18n.t("scientific:notation.toggle") }));

    expect(valueText()).toBe("1.2345e+3");
  });

  it("records completed scientific calculations in history", async () => {
    backend.calcCommand.mockResolvedValue(
      view({ expression: "sin(30) =", value: "0.5" }),
    );
    renderPage();

    press("Enter");

    await waitFor(() =>
      expect(backend.addHistory).toHaveBeenCalledWith({
        mode: "scientific",
        expression: "sin(30) =",
        value: "0.5",
      }),
    );
  });

  it("renders localized domain errors from the engine", async () => {
    backend.calcCommand.mockResolvedValue(
      view({
        expression: "sin(2)",
        value: "",
        error: { code: "DOMAIN_ERROR", args: [] },
      }),
    );
    renderPage();

    press("Enter");

    await waitFor(() =>
      expect(valueText()).toBe(i18n.t("errors:DOMAIN_ERROR")),
    );
  });

  it("supports clipboard paste and the shared context menu", async () => {
    backend.readClipboardText.mockResolvedValue("2^0.5");
    useCalcStore.setState({ views: { scientific: view({ value: "1.414" }) } });
    renderPage();

    press("v", { ctrlKey: true });
    await waitFor(() =>
      expect(backend.calcCommand).toHaveBeenCalledWith({
        type: "setExpression",
        text: "2^0.5",
      }),
    );

    backend.calcCommand.mockClear();
    act(() => {
      useCalcStore.setState({ views: { scientific: view({ value: "1.414" }) } });
    });
    fireEvent.contextMenu(screen.getByTestId("calc-value"));
    fireEvent.click(
      screen.getByRole("menuitem", {
        name: new RegExp(i18n.t("basic:contextMenu.clear")),
      }),
    );

    await waitFor(() =>
      expect(backend.calcCommand).toHaveBeenCalledWith({ type: "clearAll" }),
    );
  });

  it("reports preview mode instead of pretending to calculate", async () => {
    backend.tauri = false;
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: i18n.t("scientific:keys.sin") }));

    expect(backend.calcCommand).not.toHaveBeenCalled();
    expect(screen.getByText(i18n.t("basic:previewNotice"))).toBeTruthy();
  });

  it("does not intercept keys while an overlay is open", async () => {
    renderPage();
    await waitFor(() => expect(backend.calcCommand).toHaveBeenCalled());
    backend.calcCommand.mockClear();

    act(() => {
      useUiStore.setState({ overlay: "settings" });
    });
    press("5");

    expect(backend.calcCommand).not.toHaveBeenCalled();
  });
});