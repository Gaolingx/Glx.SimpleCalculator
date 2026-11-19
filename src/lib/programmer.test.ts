import { describe, expect, it } from "vitest";

import {
  bitRows,
  formatProgrammerExpression,
  formatProgrammerValue,
  groupDigits,
  isDigitAllowed,
  narrowsValue,
} from "./programmer";

describe("groupDigits", () => {
  it("groups binary and hexadecimal by four bits", () => {
    expect(groupDigits("1111000011110000", "binary")).toBe("1111 0000 1111 0000");
    expect(groupDigits("123456789ABCDEF0", "hexadecimal")).toBe(
      "1234 5678 9ABC DEF0",
    );
  });

  it("groups octal by three digits and decimal by three with commas", () => {
    expect(groupDigits("37777777777", "octal")).toBe("37 777 777 777");
    expect(groupDigits("-1234567", "decimal")).toBe("-1,234,567");
  });

  it("keeps raw strings when grouping is disabled", () => {
    expect(groupDigits("1111000011110000", "binary", false)).toBe(
      "1111000011110000",
    );
    expect(groupDigits("-1234567", "decimal", false)).toBe("-1234567");
  });

  it("preserves an in-progress sign", () => {
    expect(groupDigits("-", "decimal")).toBe("-");
    expect(formatProgrammerValue("0", "binary")).toBe("0");
  });
});

describe("formatProgrammerExpression", () => {
  it("groups radix tokens without touching operators", () => {
    expect(formatProgrammerExpression("FF AND F =", "hexadecimal")).toBe(
      "FF AND F =",
    );
    expect(formatProgrammerExpression("1234 MOD 10 =", "decimal")).toBe(
      "1,234 MOD 10 =",
    );
    expect(
      formatProgrammerExpression("1111000011110000 OR 1 =", "binary"),
    ).toBe("1111 0000 1111 0000 OR 1 =");
  });

  it("maps shifts and arithmetic to display glyphs", () => {
    expect(formatProgrammerExpression("1 << 2 =", "decimal")).toBe("1 LSH 2 =");
    expect(formatProgrammerExpression("5 * 2 - 1 =", "decimal")).toBe(
      "5 × 2 − 1 =",
    );
  });

  it("handles the NOT projection", () => {
    expect(formatProgrammerExpression("NOT(FF)", "hexadecimal")).toBe("NOT(FF)");
    expect(formatProgrammerExpression("NOT(FF) =", "hexadecimal")).toBe(
      "NOT(FF) =",
    );
  });
});

describe("narrowsValue", () => {
  it("detects bits that would be dropped", () => {
    expect(narrowsValue("1111111100000000", "byte")).toBe(true);
    expect(narrowsValue("0000000011111111", "byte")).toBe(false);
    expect(narrowsValue("1111111111111111", "word")).toBe(false);
    expect(narrowsValue(undefined, "byte")).toBe(false);
  });
});

describe("bitRows", () => {
  it("splits a word into MSB-first rows of up to sixteen cells", () => {
    const qword = bitRows("0".repeat(64));
    expect(qword).toHaveLength(4);
    expect(qword[0]).toMatchObject({ high: 63, low: 48 });
    expect(qword[3]).toMatchObject({ high: 15, low: 0 });

    const byte = bitRows("10101010");
    expect(byte).toHaveLength(1);
    expect(byte[0]).toMatchObject({ high: 7, low: 0, value: "10101010" });
  });
});

describe("isDigitAllowed", () => {
  it("follows the radix base", () => {
    expect(isDigitAllowed(1, "binary")).toBe(true);
    expect(isDigitAllowed(2, "binary")).toBe(false);
    expect(isDigitAllowed(7, "octal")).toBe(true);
    expect(isDigitAllowed(8, "octal")).toBe(false);
    expect(isDigitAllowed(9, "decimal")).toBe(true);
    expect(isDigitAllowed(10, "decimal")).toBe(false);
    expect(isDigitAllowed(15, "hexadecimal")).toBe(true);
  });
});