import type { CalcCommand, CalcView, HistoryEntry } from "./ipc";

/**
 * A calculation is worth recording when the engine finished an `=` evaluation
 * and produced a value (`expression` is the canonical `2 + 3 =` line).
 */
export function isCompletedCalculation(view: CalcView): boolean {
  return (
    view.error === null &&
    view.value !== "" &&
    view.expression.trimEnd().endsWith("=")
  );
}

/** Restores a history entry without re-evaluating it. */
export function recallCommand(entry: HistoryEntry): CalcCommand {
  return { type: "recall", expression: entry.expression, value: entry.value };
}