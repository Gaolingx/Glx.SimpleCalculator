// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import i18n, { initI18n } from "../../i18n";
import {
  emptyCalcView,
  type CalcCommand,
  type CalcView,
  type HistoryEntry,
} from "../../lib/ipc";
import { DEFAULT_SETTINGS } from "../../lib/settings";
import { useCalcStore } from "../../stores/calc";
import { useHistoryStore } from "../../stores/history";
import { useSettingsStore } from "../../stores/settings";
import { useUiStore } from "../../stores/ui";
import { ToastProvider } from "../ui";
import { HistoryDrawer } from "./HistoryDrawer";

const backend = vi.hoisted(() => ({
  tauri: true,
  fetchHistory: vi.fn<() => Promise<HistoryEntry[]>>(),
  deleteHistory: vi.fn<(id: string) => Promise<HistoryEntry[]>>(),
  clearHistory: vi.fn<(mode: string) => Promise<HistoryEntry[]>>(),
  copyText: vi.fn<(text: string) => Promise<void>>(),
  resetSession: vi.fn<(mode: string) => Promise<CalcView>>(),
  calcCommand: vi.fn<(command: CalcCommand) => Promise<CalcView>>(),
}));

vi.mock("../../lib/ipc", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/ipc")>();
  return {
    ...actual,
    isTauriRuntime: () => backend.tauri,
    fetchHistory: backend.fetchHistory,
    deleteHistory: backend.deleteHistory,
    clearHistory: backend.clearHistory,
    copyText: backend.copyText,
    resetSession: backend.resetSession,
    calcCommand: backend.calcCommand,
  };
});

function entry(patch: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: "a",
    mode: "basic",
    expression: "2 + 3 =",
    value: "5",
    ts: Date.now(),
    ...patch,
  };
}

function renderDrawer() {
  const onNavigate = vi.fn();
  render(
    <ToastProvider>
      <HistoryDrawer mode="basic" onNavigate={onNavigate} />
    </ToastProvider>,
  );
  return onNavigate;
}

beforeAll(async () => {
  await initI18n("zh-CN");
});

beforeEach(() => {
  backend.tauri = true;
  backend.fetchHistory.mockReset().mockResolvedValue([]);
  backend.deleteHistory.mockReset().mockResolvedValue([]);
  backend.clearHistory.mockReset().mockResolvedValue([]);
  backend.copyText.mockReset().mockResolvedValue(undefined);
  backend.resetSession.mockReset().mockResolvedValue(emptyCalcView("basic"));
  backend.calcCommand.mockReset().mockResolvedValue(emptyCalcView("basic"));

  useHistoryStore.setState({ entries: [], loaded: true, loading: false, error: null });
  useCalcStore.setState({ views: {} });
  useSettingsStore.setState({
    settings: { ...DEFAULT_SETTINGS, grouping: true },
    hydrated: true,
    saving: false,
    error: null,
  });
  useUiStore.setState({ overlay: "history" });
});

afterEach(() => {
  cleanup();
});

describe("HistoryDrawer", () => {
  it("lists entries grouped by day with formatted values", async () => {
    const yesterday = Date.now() - 24 * 60 * 60 * 1000;
    backend.fetchHistory.mockResolvedValue([
      entry({ id: "a" }),
      entry({
        id: "b",
        expression: "10 * 2 =",
        value: "20",
        ts: yesterday,
      }),
    ]);

    renderDrawer();

    expect(await screen.findByText("2 + 3 =")).toBeTruthy();
    expect(screen.getByText(i18n.t("history:today"))).toBeTruthy();
    expect(screen.getByText(i18n.t("history:yesterday"))).toBeTruthy();
    expect(screen.getByText("20")).toBeTruthy();
  });

  it("shows the empty state when nothing is stored", async () => {
    renderDrawer();

    expect(await screen.findByText(i18n.t("history:empty"))).toBeTruthy();
    expect(screen.queryByRole("button", { name: i18n.t("history:clear") })).toBeNull();
  });

  it("only shows entries for the active mode", async () => {
    backend.fetchHistory.mockResolvedValue([
      entry({ id: "a" }),
      entry({ id: "b", mode: "scientific", expression: "sin(0) =", value: "0" }),
    ]);

    renderDrawer();

    expect(await screen.findByText("2 + 3 =")).toBeTruthy();
    expect(screen.queryByText("sin(0) =")).toBeNull();
  });

  it("deletes a single entry", async () => {
    backend.fetchHistory.mockResolvedValue([entry({ id: "a" })]);
    backend.deleteHistory.mockResolvedValue([]);

    renderDrawer();

    const buttons = await screen.findAllByRole("button", {
      name: i18n.t("history:delete"),
    });
    fireEvent.click(buttons[0]);

    await waitFor(() => expect(backend.deleteHistory).toHaveBeenCalledWith("a"));
    await waitFor(() => expect(screen.getByText(i18n.t("history:empty"))).toBeTruthy());
  });

  it("asks for confirmation before clearing everything", async () => {
    backend.fetchHistory.mockResolvedValue([entry({ id: "a" })]);

    renderDrawer();

    fireEvent.click(await screen.findByRole("button", { name: i18n.t("history:clear") }));
    expect(screen.getByText(i18n.t("history:clearConfirm"))).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: i18n.t("ok") }));

    await waitFor(() => expect(backend.clearHistory).toHaveBeenCalledWith("basic"));
    await waitFor(() => expect(screen.getByText(i18n.t("history:empty"))).toBeTruthy());
  });

  it("copies the raw value and confirms with a toast", async () => {
    backend.fetchHistory.mockResolvedValue([entry({ id: "a" })]);

    renderDrawer();

    const buttons = await screen.findAllByRole("button", {
      name: i18n.t("common:copy"),
    });
    fireEvent.click(buttons[0]);

    await waitFor(() => expect(backend.copyText).toHaveBeenCalledWith("5"));
    expect(await screen.findByText(i18n.t("common:copied"))).toBeTruthy();
  });

  it("restores an entry, navigates to its mode and closes the drawer", async () => {
    backend.fetchHistory.mockResolvedValue([entry({ id: "a" })]);
    const onNavigate = renderDrawer();

    fireEvent.click(
      await screen.findByRole("button", {
        name: i18n.t("history:restoreEntry", { expression: "2 + 3 =" }),
      }),
    );

    await waitFor(() => expect(backend.resetSession).toHaveBeenCalledWith("basic"));
    await waitFor(() =>
      expect(backend.calcCommand).toHaveBeenCalledWith({
        type: "recall",
        expression: "2 + 3 =",
        value: "5",
      }),
    );
    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith("basic"));
    await waitFor(() => expect(useUiStore.getState().overlay).toBeNull());
  });
});