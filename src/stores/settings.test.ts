import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SETTINGS, type AppSettings } from "../lib/settings";

const backend = vi.hoisted(() => ({
  fetchSettings: vi.fn<() => Promise<AppSettings>>(),
  saveSettings: vi.fn<(settings: AppSettings) => Promise<AppSettings>>(),
  resetSettings: vi.fn<() => Promise<AppSettings>>(),
  setLanguage: vi.fn<(language: string) => Promise<void>>(),
}));

vi.mock("../lib/ipc", () => ({
  fetchSettings: backend.fetchSettings,
  saveSettings: backend.saveSettings,
  resetSettings: backend.resetSettings,
  toIpcError: (error: unknown) => error,
}));

vi.mock("../i18n", () => ({
  DEFAULT_LANGUAGE: "zh-CN",
  isAppLanguage: (value: unknown) => value === "zh-CN" || value === "en-US",
  detectLanguage: () => "zh-CN",
  readStoredLanguage: () => null,
  setLanguage: backend.setLanguage,
}));

const { useSettingsStore } = await import("./settings");

describe("settings store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    backend.setLanguage.mockResolvedValue(undefined);
    useSettingsStore.setState({
      settings: { ...DEFAULT_SETTINGS },
      hydrated: false,
      saving: false,
      error: null,
    });
  });

  it("hydrates from the backend and applies the stored language", async () => {
    const loaded: AppSettings = {
      ...DEFAULT_SETTINGS,
      theme: "dark",
      language: "en-US",
      grouping: false,
    };
    backend.fetchSettings.mockResolvedValue(loaded);

    await useSettingsStore.getState().hydrate();

    expect(useSettingsStore.getState().settings).toEqual(loaded);
    expect(useSettingsStore.getState().hydrated).toBe(true);
    expect(backend.setLanguage).toHaveBeenCalledWith("en-US");
  });

  it("only hydrates once", async () => {
    backend.fetchSettings.mockResolvedValue({ ...DEFAULT_SETTINGS });
    await useSettingsStore.getState().hydrate();
    await useSettingsStore.getState().hydrate();
    expect(backend.fetchSettings).toHaveBeenCalledTimes(1);
  });

  it("persists updates and adopts the saved payload", async () => {
    backend.saveSettings.mockImplementation(async (settings) => ({
      ...settings,
      historyLimit: 600,
    }));

    await useSettingsStore.getState().update({ grouping: false });

    expect(backend.saveSettings).toHaveBeenCalledTimes(1);
    const payload = backend.saveSettings.mock.calls[0][0];
    expect(payload.grouping).toBe(false);
    expect(useSettingsStore.getState().settings.grouping).toBe(false);
    expect(useSettingsStore.getState().settings.historyLimit).toBe(600);
    expect(useSettingsStore.getState().saving).toBe(false);
  });

  it("skips persistence when a patch changes nothing", async () => {
    await useSettingsStore.getState().update({ radix: DEFAULT_SETTINGS.radix });
    expect(backend.saveSettings).not.toHaveBeenCalled();
  });

  it("rolls back when saving fails", async () => {
    backend.saveSettings.mockRejectedValue(new Error("disk full"));

    await expect(
      useSettingsStore.getState().update({ theme: "dark" }),
    ).rejects.toBeTruthy();

    const state = useSettingsStore.getState();
    expect(state.settings.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(state.error).toBeTruthy();
    expect(state.saving).toBe(false);
  });

  it("resets to defaults through the backend", async () => {
    useSettingsStore.setState({
      settings: { ...DEFAULT_SETTINGS, grouping: false, theme: "dark" },
    });
    backend.resetSettings.mockResolvedValue({ ...DEFAULT_SETTINGS });

    await useSettingsStore.getState().reset();

    expect(useSettingsStore.getState().settings).toEqual(DEFAULT_SETTINGS);
    expect(backend.setLanguage).toHaveBeenCalledWith(DEFAULT_SETTINGS.language);
  });
});
