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

/** Mirrors `calc_core::units::UnitCategory` (navigation order). */
export const UNIT_CATEGORIES = [
  "currency",
  "length",
  "area",
  "volume",
  "mass",
  "temperature",
  "speed",
  "angle",
  "pressure",
  "power",
  "time",
] as const;

export type UnitCategory = (typeof UNIT_CATEGORIES)[number];

/** Mirrors `calc_core::view::UnitInfo`. */
export interface UnitInfo {
  id: string;
  symbol: string;
}

/** Mirrors `calc_core::view::UnitCategoryInfo`. */
export interface UnitCategoryInfo {
  id: UnitCategory;
  units: UnitInfo[];
}

/** Mirrors `calc_core::view::UnitCatalog`; names are translated by the UI. */
export interface UnitCatalog {
  categories: UnitCategoryInfo[];
}

export interface UnitConversionInput {
  category: UnitCategory;
  value: string;
  from: string;
  to: string;
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

/** Mirrors `src-tauri/src/ui_scale.rs::UiScale`. */
export interface UiScale {
  /** Windows Accessibility → Text size; 1.0 = 100%. */
  textScale: number;
}

function normalizeUiScale(value: unknown): UiScale {
  const textScale =
    isRecord(value) && typeof value.textScale === "number" && Number.isFinite(value.textScale)
      ? value.textScale
      : 1;
  return { textScale };
}

export async function fetchUiScale(): Promise<UiScale> {
  if (!isTauriRuntime()) {
    return { textScale: 1 };
  }
  return normalizeUiScale(await invokeCommand<unknown>("ui_scale_get"));
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

function normalizeUnitCatalog(value: unknown): UnitCatalog {
  if (!isRecord(value) || !Array.isArray(value.categories)) {
    return { categories: [] };
  }
  const categories = value.categories.flatMap((entry) => {
    if (!isRecord(entry) || !isOneOf(entry.id, UNIT_CATEGORIES)) {
      return [];
    }
    if (!Array.isArray(entry.units)) {
      return [];
    }
    const units = entry.units.flatMap((unit) => {
      if (
        !isRecord(unit) ||
        typeof unit.id !== "string" ||
        unit.id === "" ||
        typeof unit.symbol !== "string"
      ) {
        return [];
      }
      return [{ id: unit.id, symbol: unit.symbol }];
    });
    return units.length > 0 ? [{ id: entry.id, units }] : [];
  });
  return { categories };
}

export async function fetchUnitCatalog(): Promise<UnitCatalog> {
  if (!isTauriRuntime()) {
    return { categories: [] };
  }
  return normalizeUnitCatalog(await invokeCommand<unknown>("units_catalog"));
}

/** Returns the canonical, ungrouped conversion result. */
export async function convertUnit(input: UnitConversionInput): Promise<string> {
  const result = await invokeCommand<unknown>("convert_unit", { ...input });
  if (!isRecord(result) || typeof result.value !== "string" || result.value === "") {
    throw new IpcError("INTERNAL");
  }
  return result.value;
}

/** Mirrors `src-tauri::currency::CurrencyStatus`. */
export interface CurrencyStatus {
  source: string;
  base: string;
  date: string | null;
  /** Unix epoch milliseconds of the last successful fetch. */
  fetchedAt: number | null;
  stale: boolean;
  available: boolean;
  refreshFailed: boolean;
}

const UNAVAILABLE_CURRENCY: CurrencyStatus = {
  source: "ECB",
  base: "EUR",
  date: null,
  fetchedAt: null,
  stale: true,
  available: false,
  refreshFailed: false,
};

export function normalizeCurrencyStatus(value: unknown): CurrencyStatus {
  if (!isRecord(value)) {
    return { ...UNAVAILABLE_CURRENCY };
  }
  return {
    source: typeof value.source === "string" && value.source ? value.source : "ECB",
    base: typeof value.base === "string" && value.base ? value.base : "EUR",
    date: typeof value.date === "string" && value.date ? value.date : null,
    fetchedAt:
      typeof value.fetchedAt === "number" && Number.isFinite(value.fetchedAt)
        ? value.fetchedAt
        : null,
    stale: value.stale === true,
    available: value.available === true,
    refreshFailed: value.refreshFailed === true,
  };
}

export async function fetchCurrencyStatus(): Promise<CurrencyStatus> {
  if (!isTauriRuntime()) {
    return { ...UNAVAILABLE_CURRENCY };
  }
  return normalizeCurrencyStatus(await invokeCommand<unknown>("currency_status"));
}

/** Asks Rust to refresh; within the 5s window it returns the current status. */
export async function refreshCurrency(): Promise<CurrencyStatus> {
  if (!isTauriRuntime()) {
    return { ...UNAVAILABLE_CURRENCY };
  }
  return normalizeCurrencyStatus(await invokeCommand<unknown>("currency_refresh"));
}

/** Mirrors `calc_core::view::DateDifference`. Components are non-negative. */
export interface DateDifferenceResult {
  years: number;
  months: number;
  days: number;
  /** Signed `to - from` in days. */
  totalDays: number;
  /** Truncated whole weeks of `totalDays`. */
  totalWeeks: number;
}

export interface DateShiftInput {
  date: string;
  years: number;
  months: number;
  weeks: number;
  days: number;
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return isInteger(value) && value >= 0;
}

export function normalizeDateDifference(value: unknown): DateDifferenceResult {
  if (
    !isRecord(value) ||
    !isNonNegativeInteger(value.years) ||
    !isNonNegativeInteger(value.months) ||
    !isNonNegativeInteger(value.days) ||
    !isInteger(value.totalDays) ||
    !isInteger(value.totalWeeks)
  ) {
    throw new IpcError("INTERNAL");
  }
  return {
    years: value.years,
    months: value.months,
    days: value.days,
    totalDays: value.totalDays,
    totalWeeks: value.totalWeeks,
  };
}

/** Returns the canonical calendar difference between two ISO dates. */
export async function dateDiff(from: string, to: string): Promise<DateDifferenceResult> {
  return normalizeDateDifference(
    await invokeCommand<unknown>("date_diff", { from, to }),
  );
}

/** Returns the resulting ISO date after applying the shift. */
export async function dateAdd(input: DateShiftInput): Promise<string> {
  const result = await invokeCommand<unknown>("date_add", { ...input });
  if (!isRecord(result) || typeof result.date !== "string" || result.date === "") {
    throw new IpcError("INTERNAL");
  }
  return result.date;
}

/** Mirrors `calc_core::worksheet::WorksheetId` (navigation order). */
export const WORKSHEET_IDS = ["mortgage", "fuel", "lease"] as const;

export type WorksheetId = (typeof WORKSHEET_IDS)[number];
export type WorksheetFieldKind = "decimal" | "integer";
export type WorksheetResultKind = "money" | "decimal";

/** Mirrors `calc_core::view::WorksheetFieldInfo`; bounds are canonical. */
export interface WorksheetFieldInfo {
  id: string;
  kind: WorksheetFieldKind;
  min: string;
  max: string;
  defaultValue: string;
}

export interface WorksheetResultInfo {
  id: string;
  kind: WorksheetResultKind;
}

export interface WorksheetInfo {
  id: WorksheetId;
  fields: WorksheetFieldInfo[];
  results: WorksheetResultInfo[];
}

/** Mirrors `calc_core::view::WorksheetCatalog`. */
export interface WorksheetCatalog {
  worksheets: WorksheetInfo[];
}

export interface WorksheetValue {
  id: string;
  value: string;
}

/** Mirrors `calc_core::view::WorksheetResult`. */
export interface WorksheetResult {
  values: WorksheetValue[];
}

function isWorksheetId(value: unknown): value is WorksheetId {
  return isOneOf(value, WORKSHEET_IDS);
}

function isWorksheetFieldKind(value: unknown): value is WorksheetFieldKind {
  return value === "decimal" || value === "integer";
}

function isWorksheetResultKind(value: unknown): value is WorksheetResultKind {
  return value === "money" || value === "decimal";
}

export function normalizeWorksheetCatalog(value: unknown): WorksheetCatalog {
  if (!isRecord(value) || !Array.isArray(value.worksheets)) {
    return { worksheets: [] };
  }
  const worksheets = value.worksheets.flatMap((entry) => {
    if (!isRecord(entry) || !isWorksheetId(entry.id)) {
      return [];
    }
    if (!Array.isArray(entry.fields) || !Array.isArray(entry.results)) {
      return [];
    }
    const fields = entry.fields.flatMap((field) => {
      if (
        !isRecord(field) ||
        typeof field.id !== "string" ||
        field.id === "" ||
        !isWorksheetFieldKind(field.kind) ||
        typeof field.min !== "string" ||
        typeof field.max !== "string" ||
        typeof field.defaultValue !== "string"
      ) {
        return [];
      }
      return [
        {
          id: field.id,
          kind: field.kind,
          min: field.min,
          max: field.max,
          defaultValue: field.defaultValue,
        },
      ];
    });
    const results = entry.results.flatMap((result) => {
      if (
        !isRecord(result) ||
        typeof result.id !== "string" ||
        result.id === "" ||
        !isWorksheetResultKind(result.kind)
      ) {
        return [];
      }
      return [{ id: result.id, kind: result.kind }];
    });
    if (fields.length === 0 || results.length === 0) {
      return [];
    }
    return [{ id: entry.id, fields, results }];
  });
  return { worksheets };
}

export async function fetchWorksheetCatalog(): Promise<WorksheetCatalog> {
  if (!isTauriRuntime()) {
    return { worksheets: [] };
  }
  return normalizeWorksheetCatalog(await invokeCommand<unknown>("worksheet_catalog"));
}

/** Inputs are keyed by field id; values are the raw form strings. */
export async function computeWorksheet(
  sheet: WorksheetId,
  inputs: Record<string, string>,
): Promise<WorksheetResult> {
  const result = await invokeCommand<unknown>("worksheet_compute", { sheet, inputs });
  if (!isRecord(result) || !Array.isArray(result.values)) {
    throw new IpcError("INTERNAL");
  }
  const values = result.values.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.id !== "string" || typeof entry.value !== "string") {
      return [];
    }
    return [{ id: entry.id, value: entry.value }];
  });
  if (values.length !== result.values.length || values.length === 0) {
    throw new IpcError("INTERNAL");
  }
  return { values };
}
