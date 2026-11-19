/**
 * Programmer-mode display helpers (HANDOFF §3.5, §4.4).
 *
 * The Rust engine returns ungrouped strings in the active radix. Grouping for
 * binary/hex (4 bits) and octal (3 bits) is display-only; copying always uses
 * the raw projection.
 */

import type { Radix, WordSize } from "./settings";

export const WORD_SIZE_BITS: Readonly<Record<WordSize, number>> = {
  qword: 64,
  dword: 32,
  word: 16,
  byte: 8,
};

export const RADIX_BASE: Readonly<Record<Radix, number>> = {
  binary: 2,
  octal: 8,
  decimal: 10,
  hexadecimal: 16,
};

const GROUP_SIZE: Readonly<Record<Radix, number>> = {
  binary: 4,
  octal: 3,
  decimal: 3,
  hexadecimal: 4,
};

const TOKEN_OPERATORS: Readonly<Record<string, string>> = {
  "*": "×",
  "/": "÷",
  "-": "−",
  "<<": "LSH",
  ">>": "RSH",
};

export function isDigitAllowed(digit: number, radix: Radix): boolean {
  return Number.isInteger(digit) && digit >= 0 && digit < RADIX_BASE[radix];
}

function groupFromRight(digits: string, size: number, separator: string): string {
  const chunks: string[] = [];
  for (let end = digits.length; end > 0; end -= size) {
    chunks.unshift(digits.slice(Math.max(0, end - size), end));
  }
  return chunks.join(separator);
}

/** Groups a canonical projection: decimal by 3 with commas, other radixes by
 * 4/3 digits with spaces. Signs are kept outside the grouping. */
export function groupDigits(raw: string, radix: Radix, grouping = true): string {
  if (!raw || !grouping) {
    return raw;
  }
  const negative = raw.startsWith("-");
  const digits = negative ? raw.slice(1) : raw;
  if (digits === "") {
    return raw;
  }
  const separator = radix === "decimal" ? "," : " ";
  return `${negative ? "-" : ""}${groupFromRight(digits, GROUP_SIZE[radix], separator)}`;
}

export function formatProgrammerValue(raw: string, radix: Radix, grouping = true): string {
  return groupDigits(raw, radix, grouping);
}

function isRadixToken(token: string, radix: Radix): boolean {
  const digits = token.startsWith("-") ? token.slice(1) : token;
  if (digits === "" || !/^[0-9A-F]+$/.test(digits)) {
    return false;
  }
  const base = RADIX_BASE[radix];
  return [...digits].every((char) => parseInt(char, 16) < base);
}

/**
 * Localizes the engine expression line for the active radix: typographic
 * operators, `LSH`/`RSH` labels and radix-aware digit grouping.
 */
export function formatProgrammerExpression(
  expression: string,
  radix: Radix,
  grouping = true,
): string {
  if (!expression) {
    return "";
  }

  return expression
    .split(/(\s+)/)
    .map((part) => {
      if (part === "" || /^\s+$/.test(part)) {
        return part;
      }
      const notApplied = /^NOT\(([^)]*)\)(=?)$/.exec(part);
      if (notApplied) {
        const inner = notApplied[1];
        const value = isRadixToken(inner, radix)
          ? formatProgrammerValue(inner, radix, grouping)
          : inner;
        return `NOT(${value})${notApplied[2]}`;
      }
      const operator = TOKEN_OPERATORS[part];
      if (operator) {
        return operator;
      }
      return isRadixToken(part, radix)
        ? formatProgrammerValue(part, radix, grouping)
        : part;
    })
    .join("");
}

/** True when narrowing to `size` drops set bits above the new width. */
export function narrowsValue(previousBits: string | undefined, size: WordSize): boolean {
  if (!previousBits) {
    return false;
  }
  const nextBits = WORD_SIZE_BITS[size];
  if (previousBits.length <= nextBits) {
    return false;
  }
  return previousBits.slice(0, previousBits.length - nextBits).includes("1");
}

export interface BitRow {
  /** Index of the highest bit in the row (MSB-first). */
  high: number;
  low: number;
  /** Bit characters for this row, MSB-first. */
  value: string;
}

/** Splits the MSB-first `bits` projection into rows of at most 16 cells. */
export function bitRows(bits: string): BitRow[] {
  const rowSize = Math.min(16, bits.length);
  const rows: BitRow[] = [];
  for (let start = 0; start < bits.length; start += rowSize) {
    const value = bits.slice(start, start + rowSize);
    const high = bits.length - 1 - start;
    rows.push({ high, low: high - value.length + 1, value });
  }
  return rows;
}