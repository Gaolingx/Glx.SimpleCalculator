import { invoke } from "@tauri-apps/api/core";

import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  type AppSettings,
} from "./settings";

export const ERROR_CODES = [
  "DIVIDE_BY_ZERO",
  "OVERFLOW",
  "INVALID_INPUT",
  "DOMAIN_ERROR",
  "SYNTAX",
  "UNSUPPORTED",
  "CURRENCY_OFFLINE",
  "UNKNOWN_UNIT",
  "STORAGE_ERROR",
  "NETWORK_ERROR",
  "INTERNAL",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export class IpcError extends Error {
  readonly code: ErrorCode;
  readonly args: string[];

  constructor(code: ErrorCode, args: string[] = []) {
    super(code);
    this.name = "IpcError";
    this.code = code;
    this.args = args;
  }
}

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && (ERROR_CODES as readonly string[]).includes(value);
}

export function toIpcError(error: unknown): IpcError {
  if (error instanceof IpcError) {
    return error;
  }
  if (typeof error === "object" && error !== null && "code" in error) {
    const candidate = error as { code?: unknown; args?: unknown };
    if (isErrorCode(candidate.code)) {
      const args = Array.isArray(candidate.args)
        ? candidate.args.filter((arg): arg is string => typeof arg === "string")
        : [];
      return new IpcError(candidate.code, args);
    }
  }
  return new IpcError("INTERNAL");
}

async function invokeCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    throw toIpcError(error);
  }
}

// Browser-only fallback so `npm run dev` stays usable without the Tauri shell.
// The packaged app always writes through Rust (`settings_set`).
const PREVIEW_SETTINGS_KEY = "glx.settings.preview";

function readPreviewSettings(): AppSettings {
  try {
    const raw = window.localStorage.getItem(PREVIEW_SETTINGS_KEY);
    return normalizeSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function writePreviewSettings(settings: AppSettings): void {
  try {
    window.localStorage.setItem(PREVIEW_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Preview storage is best-effort; the live store state still updates.
  }
}

export async function fetchSettings(): Promise<AppSettings> {
  if (!isTauriRuntime()) {
    return readPreviewSettings();
  }
  return normalizeSettings(await invokeCommand<unknown>("settings_get"));
}

export async function saveSettings(settings: AppSettings): Promise<AppSettings> {
  const normalized = normalizeSettings(settings);
  if (!isTauriRuntime()) {
    writePreviewSettings(normalized);
    return normalized;
  }
  return normalizeSettings(
    await invokeCommand<unknown>("settings_set", { settings: normalized }),
  );
}

export async function resetSettings(): Promise<AppSettings> {
  if (!isTauriRuntime()) {
    const defaults = { ...DEFAULT_SETTINGS };
    writePreviewSettings(defaults);
    return defaults;
  }
  return normalizeSettings(await invokeCommand<unknown>("settings_reset"));
}
