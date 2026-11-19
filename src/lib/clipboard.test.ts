import { describe, expect, it } from "vitest";

import { MAX_PASTE_CHARS, cleanPaste, pasteCommands } from "./clipboard";

describe("cleanPaste", () => {
  it("strips grouping separators and surrounding whitespace", () => {
    expect(cleanPaste("  1,234.56 ")).toEqual({
      ok: true,
      kind: "expression",
      text: "1234.56",
    });
    expect(cleanPaste("1 234\u00a0567")).toEqual({
      ok: true,
      kind: "expression",
      text: "1234567",
    });
    expect(cleanPaste("1_000")).toEqual({
      ok: true,
      kind: "expression",
      text: "1000",
    });
  });

  it("normalizes full-width characters and typographic operators", () => {
    expect(cleanPaste("１２３＋４５")).toEqual({
      ok: true,
      kind: "expression",
      text: "123+45",
    });
    expect(cleanPaste("（２＋３）×４÷２−１")).toEqual({
      ok: true,
      kind: "expression",
      text: "(2+3)*4/2-1",
    });
    expect(cleanPaste("５０％")).toEqual({
      ok: true,
      kind: "expression",
      text: "50%",
    });
  });

  it("keeps exponent notation", () => {
    expect(cleanPaste("1.5e3")).toEqual({
      ok: true,
      kind: "expression",
      text: "1.5e3",
    });
  });

  it("recognizes hexadecimal, binary and octal literals", () => {
    expect(cleanPaste("0xFF")).toEqual({
      ok: true,
      kind: "radix",
      radix: "hexadecimal",
      digits: "FF",
      decimal: "255",
    });
    expect(cleanPaste("0b1010")).toEqual({
      ok: true,
      kind: "radix",
      radix: "binary",
      digits: "1010",
      decimal: "10",
    });
    expect(cleanPaste("0O17")).toEqual({
      ok: true,
      kind: "radix",
      radix: "octal",
      digits: "17",
      decimal: "15",
    });
    expect(cleanPaste("-0xFF")).toEqual({
      ok: true,
      kind: "radix",
      radix: "hexadecimal",
      digits: "FF",
      decimal: "-255",
    });
    expect(cleanPaste("０ｘＦＦ")).toEqual({
      ok: true,
      kind: "radix",
      radix: "hexadecimal",
      digits: "FF",
      decimal: "255",
    });
  });

  it("handles large radix literals without losing precision", () => {
    const result = cleanPaste("0xFFFFFFFFFFFFFFFF");
    expect(result).toEqual({
      ok: true,
      kind: "radix",
      radix: "hexadecimal",
      digits: "FFFFFFFFFFFFFFFF",
      decimal: "18446744073709551615",
    });
  });

  it("rejects empty, over-long and non-expression payloads", () => {
    expect(cleanPaste("")).toEqual({ ok: false, reason: "empty" });
    expect(cleanPaste(" \u00a0\u3000 ")).toEqual({ ok: false, reason: "empty" });
    expect(cleanPaste("1".repeat(MAX_PASTE_CHARS + 1))).toEqual({
      ok: false,
      reason: "tooLong",
    });
    expect(cleanPaste("1\n2")).toEqual({ ok: false, reason: "invalid" });
    expect(cleanPaste("abc")).toEqual({ ok: false, reason: "invalid" });
    expect(cleanPaste("0x")).toEqual({ ok: false, reason: "invalid" });
    expect(cleanPaste("--")).toEqual({ ok: false, reason: "invalid" });
  });

  it("accepts a 1,000-character payload at the boundary", () => {
    const result = cleanPaste("1".repeat(MAX_PASTE_CHARS));
    expect(result.ok).toBe(true);
  });
});

describe("pasteCommands", () => {
  it("inserts a cleaned expression as-is", () => {
    expect(
      pasteCommands({ ok: true, kind: "expression", text: "2+3*4" }, "basic"),
    ).toEqual([{ type: "setExpression", text: "2+3*4" }]);
  });

  it("switches radix in the programmer session", () => {
    expect(
      pasteCommands(
        {
          ok: true,
          kind: "radix",
          radix: "hexadecimal",
          digits: "FF",
          decimal: "255",
        },
        "programmer",
      ),
    ).toEqual([
      { type: "setRadix", radix: "hexadecimal" },
      { type: "setExpression", text: "FF" },
    ]);
  });

  it("converts radix literals to decimal in other modes", () => {
    expect(
      pasteCommands(
        {
          ok: true,
          kind: "radix",
          radix: "binary",
          digits: "1010",
          decimal: "10",
        },
        "basic",
      ),
    ).toEqual([{ type: "setExpression", text: "10" }]);
  });
});
