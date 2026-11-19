import { describe, expect, it } from "vitest";

import { isCompletedCalculation, recallCommand } from "./history";
import { emptyCalcView, type CalcView } from "./ipc";

function view(patch: Partial<CalcView> = {}): CalcView {
  return { ...emptyCalcView("basic"), ...patch };
}

describe("isCompletedCalculation", () => {
  it("accepts an equals view with a result", () => {
    expect(
      isCompletedCalculation(view({ expression: "2 + 3 =", value: "5" })),
    ).toBe(true);
  });

  it("rejects errors, empty values and in-progress expressions", () => {
    expect(
      isCompletedCalculation(
        view({
          expression: "1 / 0 =",
          value: "",
          error: { code: "DIVIDE_BY_ZERO", args: [] },
        }),
      ),
    ).toBe(false);
    expect(isCompletedCalculation(view({ expression: "2 + 3 =", value: "" }))).toBe(
      false,
    );
    expect(isCompletedCalculation(view({ expression: "2 + 3", value: "5" }))).toBe(
      false,
    );
  });
});

describe("recallCommand", () => {
  it("maps a history entry to the recall command", () => {
    expect(
      recallCommand({
        id: "1",
        mode: "basic",
        expression: "2 + 3 =",
        value: "5",
        ts: 0,
      }),
    ).toEqual({ type: "recall", expression: "2 + 3 =", value: "5" });
  });
});