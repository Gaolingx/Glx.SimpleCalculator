import { describe, expect, it } from "vitest";

import { formatExpression, formatNumber, groupInteger } from "./format";

describe("groupInteger", () => {
  it("inserts thousands separators", () => {
    expect(groupInteger("1234567")).toBe("1,234,567");
    expect(groupInteger("999")).toBe("999");
    expect(groupInteger("1000")).toBe("1,000");
    expect(groupInteger("0")).toBe("0");
  });
});

describe("formatNumber", () => {
  it("groups integers according to the toggle", () => {
    expect(formatNumber("1234567")).toBe("1,234,567");
    expect(formatNumber("1234567", { grouping: false })).toBe("1234567");
    expect(formatNumber("-1234.5")).toBe("-1,234.5");
  });

  it("keeps in-progress entries literal", () => {
    expect(formatNumber("")).toBe("");
    expect(formatNumber("-")).toBe("-");
    expect(formatNumber("0.")).toBe("0.");
    expect(formatNumber("1234.")).toBe("1,234.");
    expect(formatNumber("12.000")).toBe("12.000");
    expect(formatNumber("1.50")).toBe("1.50");
  });

  it("keeps zeros and ordinary values untouched", () => {
    expect(formatNumber("0")).toBe("0");
    expect(formatNumber("2.5")).toBe("2.5");
    expect(formatNumber("0.000001")).toBe("0.000001");
  });

  it("rounds to 16 significant digits", () => {
    expect(formatNumber("0.3333333333333333333333333333")).toBe("0.3333333333333333");
    expect(formatNumber("0.6666666666666666666666666667")).toBe("0.6666666666666667");
    expect(formatNumber("1234567890123456")).toBe("1,234,567,890,123,456");
    expect(formatNumber("0.0001234567890123456789")).toBe("0.0001234567890123457");
  });

  it("switches to E notation outside the exponent window", () => {
    expect(formatNumber("10000000000000000")).toBe("1e+16");
    expect(formatNumber("9999999999999999")).toBe("9,999,999,999,999,999");
    expect(formatNumber("99999999999999995")).toBe("1e+17");
    expect(formatNumber("12345678901234567")).toBe("1.234567890123457e+16");
    expect(formatNumber("0.0000000000000001234")).toBe("1.234e-16");
    expect(formatNumber("-0.0000000000000000123")).toBe("-1.23e-17");
  });

  it("honours custom significant-digit and exponent settings", () => {
    expect(formatNumber("1234.5678", { significantDigits: 6 })).toBe("1,234.57");
    expect(formatNumber("123456", { upperExponent: 3 })).toBe("1.23456e+5");
  });

  it("passes through non-numeric payloads defensively", () => {
    expect(formatNumber("1.2.3")).toBe("1.2.3");
    expect(formatNumber("abc")).toBe("abc");
  });
});

describe("formatExpression", () => {
  it("uses typographic operators", () => {
    expect(formatExpression("2 + 3 * 4 =")).toBe("2 + 3 × 4 =");
    expect(formatExpression("5 - 2 =")).toBe("5 − 2 =");
    expect(formatExpression("8 / 2 =")).toBe("8 ÷ 2 =");
  });

  it("groups numbers in the expression when enabled", () => {
    expect(formatExpression("1000 + 2000 =")).toBe("1,000 + 2,000 =");
    expect(formatExpression("1000 + 2000 =", false)).toBe("1000 + 2000 =");
  });

  it("localizes unary function prefixes", () => {
    expect(formatExpression("sqrt(9)")).toBe("√(9)");
    expect(formatExpression("inv(4)")).toBe("1/(4)");
  });

  it("returns an empty string for an empty expression", () => {
    expect(formatExpression("")).toBe("");
  });
});
