import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enBasic from "./locales/en-US/basic.json";
import enCommon from "./locales/en-US/common.json";
import enDate from "./locales/en-US/date.json";
import enErrors from "./locales/en-US/errors.json";
import enHistory from "./locales/en-US/history.json";
import enMenu from "./locales/en-US/menu.json";
import enProgrammer from "./locales/en-US/programmer.json";
import enScientific from "./locales/en-US/scientific.json";
import enSettings from "./locales/en-US/settings.json";
import enStatistics from "./locales/en-US/statistics.json";
import enUnits from "./locales/en-US/units.json";
import enWorksheets from "./locales/en-US/worksheets.json";
import zhBasic from "./locales/zh-CN/basic.json";
import zhCommon from "./locales/zh-CN/common.json";
import zhDate from "./locales/zh-CN/date.json";
import zhErrors from "./locales/zh-CN/errors.json";
import zhHistory from "./locales/zh-CN/history.json";
import zhMenu from "./locales/zh-CN/menu.json";
import zhProgrammer from "./locales/zh-CN/programmer.json";
import zhScientific from "./locales/zh-CN/scientific.json";
import zhSettings from "./locales/zh-CN/settings.json";
import zhStatistics from "./locales/zh-CN/statistics.json";
import zhUnits from "./locales/zh-CN/units.json";
import zhWorksheets from "./locales/zh-CN/worksheets.json";

export const SUPPORTED_LANGUAGES = ["zh-CN", "en-US"] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: AppLanguage = "zh-CN";
export const LANGUAGE_STORAGE_KEY = "glx.language";

export const I18N_NAMESPACES = [
  "common",
  "menu",
  "basic",
  "scientific",
  "programmer",
  "statistics",
  "units",
  "date",
  "worksheets",
  "settings",
  "history",
  "errors",
] as const;

const resources = {
  "zh-CN": {
    common: zhCommon,
    menu: zhMenu,
    basic: zhBasic,
    scientific: zhScientific,
    programmer: zhProgrammer,
    statistics: zhStatistics,
    units: zhUnits,
    date: zhDate,
    worksheets: zhWorksheets,
    settings: zhSettings,
    history: zhHistory,
    errors: zhErrors,
  },
  "en-US": {
    common: enCommon,
    menu: enMenu,
    basic: enBasic,
    scientific: enScientific,
    programmer: enProgrammer,
    statistics: enStatistics,
    units: enUnits,
    date: enDate,
    worksheets: enWorksheets,
    settings: enSettings,
    history: enHistory,
    errors: enErrors,
  },
} as const;

type LanguageStorage = Pick<Storage, "getItem" | "setItem">;

function safeStorage(storage?: LanguageStorage): LanguageStorage | null {
  if (storage) {
    return storage;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function isAppLanguage(value: unknown): value is AppLanguage {
  return (SUPPORTED_LANGUAGES as readonly unknown[]).includes(value);
}

export function readStoredLanguage(storage?: LanguageStorage): AppLanguage | null {
  try {
    const value = safeStorage(storage)?.getItem(LANGUAGE_STORAGE_KEY);
    return isAppLanguage(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeStoredLanguage(language: AppLanguage, storage?: LanguageStorage): void {
  try {
    safeStorage(storage)?.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Storage can be unavailable in hardened webviews; language still applies for this session.
  }
}

export function detectLanguage(navigatorLanguage?: string): AppLanguage {
  return navigatorLanguage?.toLowerCase().startsWith("en") ? "en-US" : DEFAULT_LANGUAGE;
}

export function resolveInitialLanguage(
  navigatorLanguage?: string,
  storage?: LanguageStorage,
): AppLanguage {
  return (
    readStoredLanguage(storage) ??
    detectLanguage(
      navigatorLanguage ?? (typeof navigator === "undefined" ? undefined : navigator.language),
    )
  );
}

function syncDocumentLanguage(language: AppLanguage): void {
  if (typeof document !== "undefined") {
    document.documentElement.lang = language;
  }
}

export async function initI18n(language?: AppLanguage): Promise<typeof i18n> {
  const lng = language ?? resolveInitialLanguage();

  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      resources,
      lng,
      fallbackLng: DEFAULT_LANGUAGE,
      supportedLngs: [...SUPPORTED_LANGUAGES],
      defaultNS: "common",
      ns: [...I18N_NAMESPACES],
      interpolation: { escapeValue: false },
      returnNull: false,
    });
  } else if (i18n.resolvedLanguage !== lng) {
    await i18n.changeLanguage(lng);
  }

  syncDocumentLanguage(lng);
  return i18n;
}

export async function setLanguage(language: AppLanguage): Promise<void> {
  writeStoredLanguage(language);
  await i18n.changeLanguage(language);
  syncDocumentLanguage(language);
}

export default i18n;
