import type { CalcCommand, CalcMode } from "./ipc";

export interface KeyInput {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
}

/**
 * Maps a keyboard event to a calculator command (HANDOFF §4.6).
 *
 * Returns `null` for anything the page should not intercept, so browser and
 * assistive-technology shortcuts keep working.
 */
export function commandForKeyboard(
  input: KeyInput,
  mode: CalcMode = "basic",
): CalcCommand | null {
  if (input.ctrlKey || input.altKey || input.metaKey) {
    return null;
  }

  const { key } = input;

  if (mode === "programmer") {
    return programmerCommand(key);
  }

  // Statistics input lives in a form field; the session takes structured
  // stats* commands only, so global calculation shortcuts do not apply.
  if (mode === "statistics") {
    return null;
  }

  if (key.length === 1 && key >= "0" && key <= "9") {
    return { type: "digit", digit: key.charCodeAt(0) - 48 };
  }

  if (key === "." || key === "," || input.code === "NumpadDecimal") {
    return { type: "dot" };
  }

  switch (key) {
    case "+":
      return { type: "binary", op: "add" };
    case "-":
      return { type: "binary", op: "subtract" };
    case "*":
      return { type: "binary", op: "multiply" };
    case "/":
      return { type: "binary", op: "divide" };
    case "Enter":
    case "=":
      return { type: "equals" };
    case "Escape":
    case "Delete":
      return { type: "clearAll" };
    case "Backspace":
      return { type: "backspace" };
    case "%":
      return { type: "percent" };
    case "F9":
      return { type: "toggleSign" };
    case "r":
    case "R":
      return { type: "unary", op: "reciprocal" };
    case "q":
    case "Q":
      return { type: "unary", op: "square" };
    case "@":
      return { type: "unary", op: "sqrt" };
    default:
      return null;
  }
}

/** Programmer sessions take hex digits and skip decimal-only keys. */
function programmerCommand(key: string): CalcCommand | null {
  if (key.length === 1) {
    if (key >= "0" && key <= "9") {
      return { type: "digit", digit: key.charCodeAt(0) - 48 };
    }
    const lower = key.toLowerCase();
    if (lower >= "a" && lower <= "f") {
      return { type: "digit", digit: lower.charCodeAt(0) - 87 };
    }
  }

  switch (key) {
    case "+":
      return { type: "binary", op: "add" };
    case "-":
      return { type: "binary", op: "subtract" };
    case "*":
      return { type: "binary", op: "multiply" };
    case "/":
      return { type: "binary", op: "divide" };
    case "Enter":
    case "=":
      return { type: "equals" };
    case "Escape":
    case "Delete":
      return { type: "clearAll" };
    case "Backspace":
      return { type: "backspace" };
    case "F9":
      return { type: "toggleSign" };
    default:
      return null;
  }
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) {
    return false;
  }
  return Boolean(
    target.closest("input, textarea, select, [contenteditable='true']"),
  );
}
