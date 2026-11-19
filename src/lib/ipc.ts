import { invoke } from "@tauri-apps/api/core";

import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  type AngleUnit,
  type AppSettings,
  type Radix,
  type WordSize,
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

export const CALC_MODES = [
  "basic",
  "scientific",
  "programmer",
  "statistics",
  "dateCalc",
  "converter",
  "worksheets",
] as const;

export type CalcMode = (typeof CALC_MODES)[number];

export type UnaryOp =
  | "sqrt"
  | "square"
  | "cube"
  | "cubeRoot"
  | "reciprocal"
  | "factorial"
  | "sin"
  | "cos"
  | "tan"
  | "asin"
  | "acos"
  | "atan"
  | "sinh"
  | "cosh"
  | "tanh"
  | "asinh"
  | "acosh"
  | "atanh"
  | "ln"
  | "log10"
  | "log2"
  | "exp"
  | "abs"
  | "floor"
  | "ceil"
  | "round"
  | "not";

export type BinaryOp =
  | "add"
  | "subtract"
  | "multiply"
  | "divide"
  | "power"
  | "modulo"
  | "and"
  | "or"
  | "xor"
  | "leftShift"
  | "rightShift"
  | "rotateLeft"
  | "rotateRight";

export type MemoryOp = "clear" | "recall" | "add" | "subtract" | "store";
export type ConstantId = "pi" | "e";

/** Mirrors `calc_core::command::StatOp`. */
export type StatOp =
  | "sum"
  | "sumSquares"
  | "mean"
  | "median"
  | "mode"
  | "range"
  | "sampleStdDev"
  | "populationStdDev"
  | "count"
  | "min"
  | "max"
  | "variance";

/** Mirrors `calc_core::command::CalcCommand` (tagged by `type`). */
export type CalcCommand =
  | { type: "digit"; digit: number }
  | { type: "dot" }
  | { type: "backspace" }
  | { type: "clearAll" }
  | { type: "clearEntry" }
  | { type: "unary"; op: UnaryOp }
  | { type: "binary"; op: BinaryOp }
  | { type: "equals" }
  | { type: "percent" }
  | { type: "toggleSign" }
  | { type: "memory"; op: MemoryOp }
  | { type: "setAngleUnit"; unit: AngleUnit }
  | { type: "setRadix"; radix: Radix }
  | { type: "setWordSize"; size: WordSize }
  | { type: "openGroup" }
  | { type: "closeGroup" }
  | { type: "constant"; id: ConstantId }
  | { type: "toggleBit"; bit: number }
  | { type: "random" }
  | { type: "statsAdd"; value: string }
  | { type: "statsUpdate"; index: number; value: string }
  | { type: "statsRemove"; index: number }
  | { type: "statsClear" }
  | { type: "statsCompute"; op: StatOp }
  | { type: "setExpression"; text: string }
  | { type: "recall"; expression: string; value: string };

export interface ErrorInfo {
  code: ErrorCode;
  args: string[];
}

export interface ProgrammerView {
  radix: Radix;
  wordSize: WordSize;
  binary: string;
  octal: string;
  decimal: string;
  hexadecimal: string;
  bits: string;
}

/** Mirrors `calc_core::view::StatisticsView`; values stay canonical. */
export interface StatisticsView {
  data: string[];
}

/** Mirrors `calc_core::view::CalcView`. */
export interface CalcView {
  mode: CalcMode;
  expression: string;
  value: string;
  memory: string | null;
  programmer: ProgrammerView | null;
  statistics: StatisticsView | null;
  error: ErrorInfo | null;
}

export function emptyCalcView(mode: CalcMode = "basic"): CalcView {
  return {
    mode,
    expression: "",
    value: "",
    memory: null,
    programmer: null,
    statistics: null,
    error: null,
  };
}

/** Mirrors `src-tauri::history::HistoryEntry`. */
export interface HistoryEntry {
  id: string;
  mode: CalcMode;
  expression: string;
  value: string;
  /** Unix epoch milliseconds. */
  ts: number;
}

export interface HistoryInput {
  mode: CalcMode;
  expression: string;
  value: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(value: unknown, options: readonly T[]): value is T {
  return typeof value === "string" && (options as readonly string[]).includes(value);
}

export function isCalcMode(value: unknown): value is CalcMode {
  return isOneOf(value, CALC_MODES);
}

function normalizeErrorInfo(value: unknown): ErrorInfo | null {
  if (!isRecord(value) || !isErrorCode(value.code)) {
    return null;
  }
  const args = Array.isArray(value.args)
    ? value.args.filter((arg): arg is string => typeof arg === "string")
    : [];
  return { code: value.code, args };
}

function normalizeProgrammerView(value: unknown): ProgrammerView | null {
  if (!isRecord(value)) {
    return null;
  }
  const radix = value.radix;
  const wordSize = value.wordSize;
  if (
    !isOneOf(radix, ["binary", "octal", "decimal", "hexadecimal"] as const) ||
    !isOneOf(wordSize, ["qword", "dword", "word", "byte"] as const)
  ) {
    return null;
  }
  const fields = ["binary", "octal", "decimal", "hexadecimal", "bits"] as const;
  if (!fields.every((field) => typeof value[field] === "string")) {
    return null;
  }
  return {
    radix,
    wordSize,
    binary: value.binary as string,
    octal: value.octal as string,
    decimal: value.decimal as string,
    hexadecimal: value.hexadecimal as string,
    bits: value.bits as string,
  };
}

function normalizeStatisticsView(value: unknown): StatisticsView | null {
  if (!isRecord(value) || !Array.isArray(value.data)) {
    return null;
  }
  return {
    data: value.data.filter((item): item is string => typeof item === "string"),
  };
}

/** Defensive normalization so a malformed payload cannot crash the page. */
export function normalizeCalcView(value: unknown): CalcView {
  if (!isRecord(value)) {
    throw new IpcError("INTERNAL");
  }
  return {
    mode: isCalcMode(value.mode) ? value.mode : "basic",
    expression: typeof value.expression === "string" ? value.expression : "",
    value: typeof value.value === "string" ? value.value : "",
    memory: typeof value.memory === "string" ? value.memory : null,
    programmer: normalizeProgrammerView(value.programmer),
    statistics: normalizeStatisticsView(value.statistics),
    error: normalizeErrorInfo(value.error),
  };
}

export async function calcCommand(command: CalcCommand): Promise<CalcView> {
  return normalizeCalcView(await invokeCommand<unknown>("calc_command", { cmd: command }));
}

/** Activates the per-mode session, creating it on first use. */
export async function selectSession(mode: CalcMode = "basic"): Promise<CalcView> {
  return normalizeCalcView(await invokeCommand<unknown>("session_select", { mode }));
}

export async function resetSession(mode: CalcMode = "basic"): Promise<CalcView> {
  return normalizeCalcView(await invokeCommand<unknown>("session_reset", { mode }));
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

const PREVIEW_HISTORY_KEY = "glx.history.preview";

function normalizeHistoryEntry(value: unknown): HistoryEntry | null {
  if (!isRecord(value)) {
    return null;
  }
  const { id, expression, value: rawValue, ts } = value;
  if (
    typeof id !== "string" ||
    id === "" ||
    !isCalcMode(value.mode) ||
    typeof expression !== "string" ||
    typeof rawValue !== "string" ||
    rawValue === "" ||
    typeof ts !== "number" ||
    !Number.isFinite(ts)
  ) {
    return null;
  }
  return { id, mode: value.mode, expression, value: rawValue, ts };
}

export function normalizeHistory(value: unknown): HistoryEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    const entry = normalizeHistoryEntry(item);
    return entry ? [entry] : [];
  });
}

function readPreviewHistory(): HistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(PREVIEW_HISTORY_KEY);
    return normalizeHistory(raw ? JSON.parse(raw) : null);
  } catch {
    return [];
  }
}

function writePreviewHistory(entries: HistoryEntry[]): void {
  try {
    window.localStorage.setItem(PREVIEW_HISTORY_KEY, JSON.stringify(entries));
  } catch {
    // Preview storage is best-effort; in-memory state still updates.
  }
}

function previewHistoryEntry(input: HistoryInput): HistoryEntry {
  const ts = Date.now();
  return {
    id: `${ts}-${Math.random().toString(36).slice(2, 8)}`,
    ...input,
    ts,
  };
}

function addPreviewHistory(input: HistoryInput): HistoryEntry[] {
  const settings = readPreviewSettings();
  const existing = readPreviewHistory();
  if (!settings.historyEnabled) {
    return existing;
  }
  const entry = previewHistoryEntry(input);
  const newest = existing[0];
  const next =
    newest &&
    newest.mode === entry.mode &&
    newest.expression === entry.expression &&
    newest.value === entry.value
      ? [{ ...newest, id: entry.id, ts: entry.ts }, ...existing.slice(1)]
      : [entry, ...existing];
  const limited = next.slice(0, settings.historyLimit);
  writePreviewHistory(limited);
  return limited;
}

export async function fetchHistory(): Promise<HistoryEntry[]> {
  if (!isTauriRuntime()) {
    return readPreviewHistory();
  }
  return normalizeHistory(await invokeCommand<unknown>("history_list"));
}

export async function addHistory(input: HistoryInput): Promise<HistoryEntry[]> {
  if (!isTauriRuntime()) {
    return addPreviewHistory(input);
  }
  return normalizeHistory(
    await invokeCommand<unknown>("history_add", {
      mode: input.mode,
      expression: input.expression,
      value: input.value,
    }),
  );
}

export async function deleteHistory(id: string): Promise<HistoryEntry[]> {
  if (!isTauriRuntime()) {
    const next = readPreviewHistory().filter((entry) => entry.id !== id);
    writePreviewHistory(next);
    return next;
  }
  return normalizeHistory(await invokeCommand<unknown>("history_delete", { id }));
}

export async function clearHistory(mode: CalcMode): Promise<HistoryEntry[]> {
  if (!isTauriRuntime()) {
    const next = readPreviewHistory().filter((entry) => entry.mode !== mode);
    writePreviewHistory(next);
    return next;
  }
  return normalizeHistory(await invokeCommand<unknown>("history_clear", { mode }));
}

export async function copyText(text: string): Promise<void> {
  if (!isTauriRuntime()) {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      throw new IpcError("INTERNAL");
    }
    await navigator.clipboard.writeText(text);
    return;
  }
  await invokeCommand<void>("clipboard_copy", { text });
}

export async function readClipboardText(): Promise<string> {
  if (!isTauriRuntime()) {
    if (typeof navigator === "undefined" || !navigator.clipboard?.readText) {
      throw new IpcError("INTERNAL");
    }
    return navigator.clipboard.readText();
  }
  const text = await invokeCommand<unknown>("clipboard_read");
  return typeof text === "string" ? text : "";
}
