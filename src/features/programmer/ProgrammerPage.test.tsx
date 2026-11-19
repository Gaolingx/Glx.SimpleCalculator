// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "../../components/ui";
import i18n, { initI18n } from "../../i18n";
import {
  emptyCalcView,
  type CalcCommand,
  type CalcMode,
  type CalcView,
  type ProgrammerView,
} from "../../lib/ipc";
import { DEFAULT_SETTINGS, type Radix, type WordSize } from "../../lib/settings";
import { useCalcStore } from "../../stores/calc";
import { useHistoryStore } from "../../stores/history";
import { useSettingsStore } from "../../stores/settings";
import { useUiStore } from "../../stores/ui";
import { ProgrammerPage } from "./ProgrammerPage";

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

const HEX_BYTE: ProgrammerView = {
  radix: "hexadecimal",
  wordSize: "byte",
  binary: "11111111",
  octal: "377",
  decimal: "-1",
  hexadecimal: "FF",
  bits: "11111111",
};

function view(patch: Partial<CalcView> = {}): CalcView {
  return {
    ...emptyCalcView("programmer"),
    value: HEX_BYTE.hexadecimal,
    programmer: { ...HEX_BYTE },
    ...patch,
  };
}

function valueText(): string {
  return screen.getByTestId("calc-value").textContent ?? "";
}

function radixRow(label: string): HTMLElement {
  return screen.getByRole("radio", {
    name: i18n.t("programmer:radixRow", { radix: label }),
  });
}

function setSettingsState(radix: Radix, wordSize: WordSize): void {
  useSettingsStore.setState({
    settings: { ...DEFAULT_SETTINGS, radix, wordSize, grouping: true },
    hydrated: true,
    saving: false,
    error: null,
  });
}

function press(key: string, init: KeyboardEventInit = {}): void {
  fireEvent.keyDown(window, { key, ...init });
}

function renderPage() {
  return render(
    <ToastProvider>
      <ProgrammerPage />
    </ToastProvider>,
  );
}

beforeAll(async () => {
  await initI18n("zh-CN");
});

beforeEach(() => {
  backend.tauri = true;
  backend.calcCommand.mockReset();
  backend.calcCommand.mockImplementation(
    async () => useCalcStore.getState().views.programmer ?? view(),
  );
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
  setSettingsState("hexadecimal", "byte");
  useUiStore.setState({ overlay: null });
});

afterEach(() => {
  cleanup();
});

describe("ProgrammerPage", () => {
  it("activates the programmer session and applies the saved radix and word size", async () => {
    renderPage();

    await waitFor(() => expect(backend.selectSession).toHaveBeenCalledWith("programmer"));
    await waitFor(() =>
      expect(backend.calcCommand).toHaveBeenCalledWith({
        type: "setRadix",
        radix: "hexadecimal",
      }),
    );
    await waitFor(() =>
      expect(backend.calcCommand).toHaveBeenCalledWith({
        type: "setWordSize",
        size: "byte",
      }),
    );
  });

  it("renders the four radix projections and marks the active one", async () => {
    useCalcStore.setState({ views: { programmer: view() } });
    renderPage();

    expect(valueText()).toBe("FF");
    expect(radixRow("HEX").textContent).toContain("FF");
    expect(radixRow("DEC").textContent).toContain("-1");
    expect(radixRow("OCT").textContent).toContain("377");
    expect(radixRow("BIN").textContent).toContain("1111 1111");
    expect(radixRow("HEX").getAttribute("aria-checked")).toBe("true");
    expect(radixRow("DEC").getAttribute("aria-checked")).toBe("false");
  });

  it("switches radix through the row and persists the choice", async () => {
    useCalcStore.setState({ views: { programmer: view() } });
    renderPage();
    await waitFor(() =>
      expect(backend.calcCommand).toHaveBeenCalledWith({
        type: "setWordSize",
        size: "byte",
      }),
    );
    backend.calcCommand.mockClear();

    fireEvent.click(radixRow("DEC"));

    await waitFor(() => expect(backend.saveSettings).toHaveBeenCalled());
    await waitFor(() =>
      expect(backend.calcCommand).toHaveBeenCalledWith({
        type: "setRadix",
        radix: "decimal",
      }),
    );
  });

  it("disables digits outside the active radix", async () => {
    setSettingsState("binary", "byte");
    useCalcStore.setState({
      views: {
        programmer: view({
          value: "1010",
          programmer: {
            ...HEX_BYTE,
            radix: "binary",
            binary: "1010",
            octal: "12",
            decimal: "10",
            hexadecimal: "A",
            bits: "00001010",
          },
        }),
      },
    });
    renderPage();

    const one = screen.getByRole("button", { name: "1" }) as HTMLButtonElement;
    const two = screen.getByRole("button", { name: "2" }) as HTMLButtonElement;
    const ten = screen.getByRole("button", { name: "A" }) as HTMLButtonElement;

    expect(one.disabled).toBe(false);
    expect(two.disabled).toBe(true);
    expect(ten.disabled).toBe(true);
  });

  it("toggles bits from the grid using bit indexes", async () => {
    useCalcStore.setState({
      views: {
        programmer: view({
          value: "1",
          programmer: { ...HEX_BYTE, hexadecimal: "1", decimal: "1", bits: "00000001" },
        }),
      },
    });
    renderPage();

    const bitZero = screen.getByRole("button", {
      name: i18n.t("programmer:bit", { index: 0 }),
    });
    expect(bitZero.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(
      screen.getByRole("button", { name: i18n.t("programmer:bit", { index: 7 }) }),
    );

    await waitFor(() =>
      expect(backend.calcCommand).toHaveBeenCalledWith({ type: "toggleBit", bit: 7 }),
    );
  });

  it("renders one cell per bit for the active word size", () => {
    const qwordBits = "1" + "0".repeat(63);
    setSettingsState("hexadecimal", "qword");
    useCalcStore.setState({
      views: {
        programmer: view({
          value: "8000000000000000",
          programmer: {
            ...HEX_BYTE,
            wordSize: "qword",
            hexadecimal: "8000000000000000",
            decimal: "-9223372036854775808",
            binary: qwordBits,
            octal: "1000000000000000000000",
            bits: qwordBits,
          },
        }),
      },
    });
    renderPage();

    expect(screen.getAllByRole("button", { name: /^第 \d+ 位$/ })).toHaveLength(64);
  });

  it("warns when narrowing the word size drops high bits", async () => {
    setSettingsState("hexadecimal", "qword");
    useCalcStore.setState({
      views: {
        programmer: view({
          value: "100",
          programmer: {
            ...HEX_BYTE,
            wordSize: "qword",
            hexadecimal: "100",
            decimal: "256",
            bits: "1" + "0".repeat(63),
          },
        }),
      },
    });
    renderPage();

    fireEvent.click(screen.getByRole("radio", { name: i18n.t("settings:wordSizeOption.byte") }));

    await waitFor(() =>
      expect(backend.calcCommand).toHaveBeenCalledWith({
        type: "setWordSize",
        size: "byte",
      }),
    );
    expect(
      screen.getByText(i18n.t("programmer:truncated", { bits: 8 })),
    ).toBeTruthy();
  });

  it("maps hex letters on the keyboard but not decimal-only shortcuts", async () => {
    useCalcStore.setState({ views: { programmer: view() } });
    renderPage();
    await waitFor(() =>
      expect(backend.calcCommand).toHaveBeenCalledWith({
        type: "setWordSize",
        size: "byte",
      }),
    );
    backend.calcCommand.mockClear();

    press("a");
    press("F");
    press("r");

    await waitFor(() => expect(backend.calcCommand).toHaveBeenCalledTimes(2));
    expect(backend.calcCommand.mock.calls.map(([command]) => command)).toEqual([
      { type: "digit", digit: 10 },
      { type: "digit", digit: 15 },
    ]);
  });

  it("formats the active projection and expression with radix grouping", async () => {
    setSettingsState("hexadecimal", "dword");
    useCalcStore.setState({
      views: {
        programmer: view({
          expression: "FFFEFDFC AND FF =",
          value: "FFFEFDFC",
          programmer: {
            ...HEX_BYTE,
            wordSize: "dword",
            hexadecimal: "FFFEFDFC",
            decimal: "-66052",
            binary: "11111111111111101111110111111100",
            octal: "377775773774",
            bits: "11111111111111101111110111111100",
          },
        }),
      },
    });
    renderPage();

    expect(valueText()).toBe("FFFE FDFC");
    expect(screen.getByTestId("calc-expression").textContent).toBe(
      "FFFE FDFC AND FF =",
    );
  });

  it("copies the grouped projection from the context menu", async () => {
    setSettingsState("hexadecimal", "dword");
    useCalcStore.setState({
      views: {
        programmer: view({
          value: "FFFEFDFC",
          programmer: {
            ...HEX_BYTE,
            wordSize: "dword",
            hexadecimal: "FFFEFDFC",
            decimal: "-66052",
            binary: "11111111111111101111110111111100",
            octal: "377775773774",
            bits: "11111111111111101111110111111100",
          },
        }),
      },
    });
    renderPage();

    fireEvent.contextMenu(screen.getByTestId("calc-value"));
    fireEvent.click(
      screen.getByRole("menuitem", {
        name: new RegExp(i18n.t("basic:contextMenu.copyDisplay")),
      }),
    );

    await waitFor(() => expect(backend.copyText).toHaveBeenCalledWith("FFFE FDFC"));
  });
});