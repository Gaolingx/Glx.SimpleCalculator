import { create } from "zustand";

import {
  detectLanguage,
  readStoredLanguage,
  setLanguage,
  type AppLanguage,
} from "../i18n";
import {
  fetchSettings,
  resetSettings,
  saveSettings,
  toIpcError,
  type IpcError,
} from "../lib/ipc";
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  settingsEqual,
  type AppSettings,
} from "../lib/settings";
import { readStoredTheme, setTheme } from "../lib/theme";
import { applyUiZoom } from "../lib/uiScale";

interface SettingsState {
  settings: AppSettings;
  hydrated: boolean;
  saving: boolean;
  error: IpcError | null;
  hydrate: () => Promise<void>;
  update: (patch: Partial<AppSettings>) => Promise<void>;
  reset: () => Promise<void>;
}

function initialSettings(): AppSettings {
  const language: AppLanguage = readStoredLanguage() ?? detectLanguage();
  return { ...DEFAULT_SETTINGS, theme: readStoredTheme(), language };
}

async function applySideEffects(settings: AppSettings): Promise<void> {
  setTheme(settings.theme);
  applyUiZoom(settings.uiZoom);
  await setLanguage(settings.language);
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  settings: initialSettings(),
  hydrated: false,
  saving: false,
  error: null,

  hydrate: async () => {
    if (get().hydrated) {
      return;
    }
    set({ hydrated: true });
    try {
      const loaded = await fetchSettings();
      set({ settings: loaded, error: null });
      await applySideEffects(loaded);
    } catch (error) {
      set({ error: toIpcError(error) });
    }
  },

  update: async (patch) => {
    const previous = get().settings;
    const next = mergeSettings(previous, patch);
    if (settingsEqual(previous, next)) {
      return;
    }

    set({ settings: next, saving: true, error: null });
    await applySideEffects(next);

    try {
      const saved = await saveSettings(next);
      set({ settings: saved, saving: false });
      if (!settingsEqual(saved, next)) {
        await applySideEffects(saved);
      }
    } catch (error) {
      set({ settings: previous, saving: false, error: toIpcError(error) });
      await applySideEffects(previous);
      throw toIpcError(error);
    }
  },

  reset: async () => {
    set({ saving: true, error: null });
    try {
      const defaults = await resetSettings();
      set({ settings: defaults, saving: false });
      await applySideEffects(defaults);
    } catch (error) {
      set({ saving: false, error: toIpcError(error) });
      throw toIpcError(error);
    }
  },
}));
