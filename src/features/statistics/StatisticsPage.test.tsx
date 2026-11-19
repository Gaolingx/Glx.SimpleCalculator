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
} from "../../lib/ipc";
import { DEFAULT_SETTINGS } from "../../lib/settings";
import { useCalcStore } from "../../stores/calc";
import { useHistoryStore } from "../../stores/history";
import { useSettingsStore } from "../../stores/settings";
import { useUiStore } from "../../stores/ui";
import { StatisticsPage } from "./StatisticsPage";

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
  return { ...emptyCalcView("statistics"), ...patch };
}

function statsView(data: string[], patch: Partial<CalcView> = {}): CalcView {
  return view({ statistics: { data }, ...patch });
}

function resultText(): string {
  return screen.getByTestId("stats-result").textContent ?? "";
}

function valueInput(): HTMLInputElement {
  return screen.getByRole("textbox", {
    name: i18n.t("statistics:value"),
  }) as HTMLInputElement;
}

function rowIndexes(): (string | null)[] {
  return screen
    .getAllByTestId("stats-row")
    .map((row) => row.getAttribute("data-index"));
}

function renderPage() {
  return render(
    <ToastProvider>
      <StatisticsPage />
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
    async () => useCalcStore.getState().views.statistics ?? view(),
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

describe("StatisticsPage", () => {
  it("activates the statistics session and renders the dataset", async () => {
    useCalcStore.setState({ views: { statistics: statsView(["1", "2", "3"]) } });
    renderPage();

    await waitFor(() => expect(backend.selectSession).toHaveBeenCalledWith("statistics"));
    expect(screen.getByText(i18n.t("statistics:count", { count: 3 }))).toBeTruthy();
    expect(screen.getAllByTestId("stats-row")).toHaveLength(3);
    expect(resultText()).toBe("—");
  });

  it("adds a typed value and clears the input on success", async () => {
    backend.calcCommand.mockImplementation(async (command) => {
      if (command.type === "statsAdd") {
        return statsView(["12.5"]);
      }
      return view();
    });
    renderPage();

    fireEvent.change(valueInput(), { target: { value: "12.5" } });
    fireEvent.click(screen.getByRole("button", { name: i18n.t("statistics:add") }));

    await waitFor(() =>
      expect(backend.calcCommand).toHaveBeenCalledWith({
        type: "statsAdd",
        value: "12.5",
      }),
    );
    await waitFor(() => expect(valueInput().value).toBe(""));
    expect(screen.getByText("12.5")).toBeTruthy();
  });

  it("loads a row into the input and updates it in place", async () => {
    useCalcStore.setState({ views: { statistics: statsView(["1", "2"]) } });
    renderPage();

    fireEvent.click(
      screen.getByRole("button", {
        name: i18n.t("statistics:edit", { index: 2 }),
      }),
    );
    expect(valueInput().value).toBe("2");
    expect(
      screen.getByRole("button", { name: i18n.t("statistics:update") }),
    ).toBeTruthy();

    backend.calcCommand.mockResolvedValueOnce(statsView(["1", "20"]));
    fireEvent.change(valueInput(), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: i18n.t("statistics:update") }));

    await waitFor(() =>
      expect(backend.calcCommand).toHaveBeenCalledWith({
        type: "statsUpdate",
        index: 1,
        value: "20",
      }),
    );
    await waitFor(() => expect(valueInput().value).toBe(""));
    expect(
      screen.queryByRole("button", { name: i18n.t("statistics:update") }),
    ).toBeNull();
  });

  it("removes a dataset row by its original index", async () => {
    useCalcStore.setState({ views: { statistics: statsView(["1", "2"]) } });
    renderPage();

    fireEvent.click(
      screen.getByRole("button", {
        name: i18n.t("statistics:delete", { index: 1 }),
      }),
    );

    await waitFor(() =>
      expect(backend.calcCommand).toHaveBeenCalledWith({
        type: "statsRemove",
        index: 0,
      }),
    );
  });

  it("computes a function, renders the result and records history", async () => {
    useCalcStore.setState({ views: { statistics: statsView(["1", "2", "3"]) } });
    backend.calcCommand.mockResolvedValue(
      statsView(["1", "2", "3"], {
        expression: "mean(1, 2, 3) =",
        value: "2",
      }),
    );
    renderPage();

    fireEvent.click(
      screen.getByRole("button", { name: i18n.t("statistics:functions.mean") }),
    );

    await waitFor(() =>
      expect(backend.calcCommand).toHaveBeenCalledWith({
        type: "statsCompute",
        op: "mean",
      }),
    );
    await waitFor(() => expect(resultText()).toBe("2"));
    await waitFor(() =>
      expect(backend.addHistory).toHaveBeenCalledWith({
        mode: "statistics",
        expression: "mean(1, 2, 3) =",
        value: "2",
      }),
    );
  });

  it("explains empty-set and single-value domain errors", async () => {
    renderPage();
    backend.calcCommand.mockResolvedValue(
      view({ expression: "sum() =", error: { code: "DOMAIN_ERROR", args: [] } }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: i18n.t("statistics:functions.sum") }),
    );
    await waitFor(() => expect(resultText()).toBe(i18n.t("statistics:emptyHint")));

    cleanup();
    useCalcStore.setState({ views: { statistics: statsView(["5"]) } });
    backend.calcCommand.mockResolvedValue(
      statsView(["5"], {
        expression: "variance(5) =",
        error: { code: "DOMAIN_ERROR", args: [] },
      }),
    );
    renderPage();
    fireEvent.click(
      screen.getByRole("button", { name: i18n.t("statistics:functions.variance") }),
    );
    await waitFor(() => expect(resultText()).toBe(i18n.t("statistics:needTwo")));
  });

  it("cycles input, ascending and descending display order", async () => {
    useCalcStore.setState({ views: { statistics: statsView(["3", "1", "2"]) } });
    renderPage();

    expect(rowIndexes()).toEqual(["0", "1", "2"]);

    fireEvent.click(
      screen.getByRole("button", { name: i18n.t("statistics:sort.input") }),
    );
    expect(rowIndexes()).toEqual(["1", "2", "0"]);

    fireEvent.click(
      screen.getByRole("button", { name: i18n.t("statistics:sort.asc") }),
    );
    expect(rowIndexes()).toEqual(["0", "2", "1"]);
  });

  it("asks for confirmation before clearing the dataset", async () => {
    useCalcStore.setState({ views: { statistics: statsView(["1", "2"]) } });
    renderPage();

    fireEvent.click(
      screen.getByRole("button", { name: i18n.t("statistics:clear") }),
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(
      screen.getByText(i18n.t("statistics:clearConfirm", { count: 2 })),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: i18n.t("ok") }));
    await waitFor(() =>
      expect(backend.calcCommand).toHaveBeenCalledWith({ type: "statsClear" }),
    );
  });

  it("copies the raw result", async () => {
    useCalcStore.setState({
      views: {
        statistics: statsView(["1"], {
          expression: "sum(1) =",
          value: "1",
        }),
      },
    });
    renderPage();

    fireEvent.click(
      screen.getByRole("button", { name: i18n.t("common:copy") }),
    );
    expect(backend.copyText).toHaveBeenCalledWith("1");
  });

  it("keeps the input when the engine rejects a value", async () => {
    backend.calcCommand.mockResolvedValue(
      view({ error: { code: "INVALID_INPUT", args: [] } }),
    );
    renderPage();

    fireEvent.change(valueInput(), { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: i18n.t("statistics:add") }));

    await waitFor(() => expect(resultText()).toBe(i18n.t("errors:INVALID_INPUT")));
    expect(valueInput().value).toBe("abc");
  });
});