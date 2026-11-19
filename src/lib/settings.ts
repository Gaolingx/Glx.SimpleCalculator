import { DEFAULT_LANGUAGE, isAppLanguage, type AppLanguage } from "../i18n";
import { parseThemeSetting, type ThemeSetting } from "./theme";

export type AngleUnit = "deg" | "rad" | "grad";
export type WordSize = "qword" | "dword" | "word" | "byte";
export type Radix = "binary" | "octal" | "decimal" | "hexadecimal";

export interface AppSettings {
  theme: ThemeSetting;
  language: AppLanguage;
  grouping: boolean;
  angleUnit: AngleUnit;
  wordSize: WordSize;
  radix: Radix;
  historyEnabled: boolean;
  historyLimit: number;
}

export const HISTORY_LIMIT_MIN = 100;
export const HISTORY_LIMIT_MAX = 1_000;

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "system",
  language: DEFAULT_LANGUAGE,
  grouping: true,
  angleUnit: "deg",
  wordSize: "qword",
  radix: "decimal",
  historyEnabled: true,
  historyLimit: 500,
};

const ANGLE_UNITS: readonly AngleUnit[] = ["deg", "rad", "grad"];
const WORD_SIZES: readonly WordSize[] = ["qword", "dword", "word", "byte"];
const RADIXES: readonly Radix[] = ["binary", "octal", "decimal", "hexadecimal"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(value: unknown, options: readonly T[]): value is T {
  return typeof value === "string" && (options as readonly string[]).includes(value);
}

export function isValidHistoryLimit(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= HISTORY_LIMIT_MIN &&
    value <= HISTORY_LIMIT_MAX
  );
}

/**
 * Accepts untrusted payloads (IPC responses or preview storage) and always
 * returns a complete, in-range settings object.
 */
export function normalizeSettings(value: unknown): AppSettings {
  if (!isRecord(value)) {
    return { ...DEFAULT_SETTINGS };
  }

  const historyLimit =
    typeof value.historyLimit === "number" && Number.isFinite(value.historyLimit)
      ? Math.min(
          HISTORY_LIMIT_MAX,
          Math.max(HISTORY_LIMIT_MIN, Math.round(value.historyLimit)),
        )
      : DEFAULT_SETTINGS.historyLimit;

  return {
    theme: parseThemeSetting(value.theme),
    language: isAppLanguage(value.language) ? value.language : DEFAULT_SETTINGS.language,
    grouping:
      typeof value.grouping === "boolean" ? value.grouping : DEFAULT_SETTINGS.grouping,
    angleUnit: isOneOf(value.angleUnit, ANGLE_UNITS)
      ? value.angleUnit
      : DEFAULT_SETTINGS.angleUnit,
    wordSize: isOneOf(value.wordSize, WORD_SIZES)
      ? value.wordSize
      : DEFAULT_SETTINGS.wordSize,
    radix: isOneOf(value.radix, RADIXES) ? value.radix : DEFAULT_SETTINGS.radix,
    historyEnabled:
      typeof value.historyEnabled === "boolean"
        ? value.historyEnabled
        : DEFAULT_SETTINGS.historyEnabled,
    historyLimit,
  };
}

export function mergeSettings(
  current: AppSettings,
  patch: Partial<AppSettings>,
): AppSettings {
  return normalizeSettings({ ...current, ...patch });
}

export function settingsEqual(a: AppSettings, b: AppSettings): boolean {
  return (
    a.theme === b.theme &&
    a.language === b.language &&
    a.grouping === b.grouping &&
    a.angleUnit === b.angleUnit &&
    a.wordSize === b.wordSize &&
    a.radix === b.radix &&
    a.historyEnabled === b.historyEnabled &&
    a.historyLimit === b.historyLimit
  );
}
