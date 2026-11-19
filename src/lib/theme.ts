export type ThemeSetting = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "glx.theme";

export function parseThemeSetting(value: unknown): ThemeSetting {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

export function resolveTheme(setting: ThemeSetting, prefersDark: boolean): ResolvedTheme {
  if (setting === "system") {
    return prefersDark ? "dark" : "light";
  }
  return setting;
}

type ThemeStorage = Pick<Storage, "getItem" | "setItem">;

function safeStorage(storage?: ThemeStorage): ThemeStorage | null {
  if (storage) {
    return storage;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readStoredTheme(storage?: ThemeStorage): ThemeSetting {
  try {
    return parseThemeSetting(safeStorage(storage)?.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

export function writeStoredTheme(setting: ThemeSetting, storage?: ThemeStorage): void {
  try {
    safeStorage(storage)?.setItem(THEME_STORAGE_KEY, setting);
  } catch {
    // Storage can be unavailable in hardened webviews; theme still applies for this session.
  }
}

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : false;
}

export function applyTheme(setting: ThemeSetting): ResolvedTheme {
  const resolved = resolveTheme(setting, systemPrefersDark());
  if (typeof document !== "undefined") {
    const root = document.documentElement;
    root.dataset.theme = resolved;
    root.style.colorScheme = resolved;
  }
  return resolved;
}

export function setTheme(setting: ThemeSetting): ResolvedTheme {
  writeStoredTheme(setting);
  return applyTheme(setting);
}
