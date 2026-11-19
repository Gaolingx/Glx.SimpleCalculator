import { describe, expect, it } from "vitest";

import { commandForKeyboard } from "./keyboard";

describe("commandForKeyboard", () => {
  it("maps digits and the decimal point", () => {
    expect(commandForKeyboard({ key: "7" })).toEqual({ type: "digit", digit: 7 });
    expect(commandForKeyboard({ key: "." })).toEqual({ type: "dot" });
    expect(commandForKeyboard({ key: ",", code: "Comma" })).toEqual({ type: "dot" });
    expect(commandForKeyboard({ key: "Decimal", code: "NumpadDecimal" })).toEqual({
      type: "dot",
    });
  });

  it("maps the four operators", () => {
    expect(commandForKeyboard({ key: "+" })).toEqual({ type: "binary", op: "add" });
    expect(commandForKeyboard({ key: "-" })).toEqual({ type: "binary", op: "subtract" });
    expect(commandForKeyboard({ key: "*" })).toEqual({ type: "binary", op: "multiply" });
    expect(commandForKeyboard({ key: "/" })).toEqual({ type: "binary", op: "divide" });
  });

  it("maps evaluation and clearing keys", () => {
    expect(commandForKeyboard({ key: "Enter" })).toEqual({ type: "equals" });
    expect(commandForKeyboard({ key: "=" })).toEqual({ type: "equals" });
    expect(commandForKeyboard({ key: "Escape" })).toEqual({ type: "clearAll" });
    expect(commandForKeyboard({ key: "Delete" })).toEqual({ type: "clearAll" });
    expect(commandForKeyboard({ key: "Backspace" })).toEqual({ type: "backspace" });
    expect(commandForKeyboard({ key: "%" })).toEqual({ type: "percent" });
  });

  it("maps the Windows-style shortcuts", () => {
    expect(commandForKeyboard({ key: "F9" })).toEqual({ type: "toggleSign" });
    expect(commandForKeyboard({ key: "r" })).toEqual({ type: "unary", op: "reciprocal" });
    expect(commandForKeyboard({ key: "Q" })).toEqual({ type: "unary", op: "square" });
    expect(commandForKeyboard({ key: "@" })).toEqual({ type: "unary", op: "sqrt" });
  });

  it("ignores modifier chords and unhandled keys", () => {
    expect(commandForKeyboard({ key: "c", ctrlKey: true })).toBeNull();
    expect(commandForKeyboard({ key: "5", altKey: true })).toBeNull();
    expect(commandForKeyboard({ key: "5", metaKey: true })).toBeNull();
    expect(commandForKeyboard({ key: "Tab" })).toBeNull();
    expect(commandForKeyboard({ key: "a" })).toBeNull();
    expect(commandForKeyboard({ key: "F5" })).toBeNull();
  });
});
