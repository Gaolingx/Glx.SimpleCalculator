import type { CalcCommand } from "./ipc";

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
export function commandForKeyboard(input: KeyInput): CalcCommand | null {
  if (input.ctrlKey || input.altKey || input.metaKey) {
    return null;
  }

  const { key } = input;

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

export function isEditableTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) {
    return false;
  }
  return Boolean(
    target.closest("input, textarea, select, [contenteditable='true']"),
  );
}
