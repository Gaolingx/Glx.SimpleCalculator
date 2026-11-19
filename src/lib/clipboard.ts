/**
 * Clipboard paste normalization (HANDOFF §4.7).
 *
 * The shell owns the system clipboard; this module turns whatever the user
 * copied into a canonical expression or a radix-prefixed integer. Illegal
 * payloads are rejected here so the engine never receives obvious junk.
 */

import type { CalcCommand, CalcMode } from "./ipc";

/** Mirrors `calc_core::value::MAX_INPUT_CHARS`. */
export const MAX_PASTE_CHARS = 1_000;

export type PasteRadix = "binary" | "octal" | "hexadecimal";
export type PasteFailure = "empty" | "tooLong" | "invalid";

export type PasteResult =
  | { ok: true; kind: "expression"; text: string }
  | {
      ok: true;
      kind: "radix";
      radix: PasteRadix;
      /** Digit string without the `0x` / `0b` / `0o` prefix. */
      digits: string;
      /** Decimal equivalent, used by modes that do not switch radix. */
      decimal: string;
    }
  | { ok: false; reason: PasteFailure };

const GROUPING = new Set([",", "_", " ", "\u00a0", "\u202f", "\u2009", "\u2007"]);

const TYPOGRAPHY: Readonly<Record<string, string>> = {
  "−": "-",
  "–": "-",
  "—": "-",
  "×": "*",
  "·": "*",
  "÷": "/",
};

const RADIX_PATTERNS: ReadonlyArray<readonly [PasteRadix, RegExp, string]> = [
  ["hexadecimal", /^([+-]?)0[xX]([0-9a-fA-F]+)$/, "0x"],
  ["binary", /^([+-]?)0[bB]([01]+)$/, "0b"],
  ["octal", /^([+-]?)0[oO]([0-7]+)$/, "0o"],
];

function normalizeChars(raw: string): string | null {
  let out = "";
  for (const char of raw) {
    const code = char.codePointAt(0) ?? 0;
    // Line breaks and control characters would silently merge operands.
    if (code < 0x20 || code === 0x7f) {
      return null;
    }

    let mapped = char;
    if (code === 0x3000) {
      mapped = " ";
    } else if (code >= 0xff01 && code <= 0xff5e) {
      mapped = String.fromCodePoint(code - 0xfee0);
    }
    mapped = TYPOGRAPHY[mapped] ?? mapped;

    if (GROUPING.has(mapped)) {
      continue;
    }
    out += mapped;
  }
  return out;
}

function radixLiteral(text: string): PasteResult | null {
  for (const [radix, pattern, prefix] of RADIX_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) {
      continue;
    }
    const sign = match[1] === "-" ? "-" : "";
    const digits = match[2];
    try {
      const magnitude = BigInt(prefix + digits).toString();
      return {
        ok: true,
        kind: "radix",
        radix,
        digits,
        decimal: `${sign}${magnitude}`,
      };
    } catch {
      return { ok: false, reason: "invalid" };
    }
  }
  return null;
}

/**
 * Cleans pasted text: strips grouping/whitespace, maps full-width and
 * typographic characters, rejects over-long or non-expression payloads, and
 * recognizes whole-input `0x` / `0b` / `0o` literals.
 */
export function cleanPaste(raw: string): PasteResult {
  if ([...raw].length > MAX_PASTE_CHARS) {
    return { ok: false, reason: "tooLong" };
  }

  const text = normalizeChars(raw);
  if (text === null) {
    return { ok: false, reason: "invalid" };
  }
  if (text === "") {
    return { ok: false, reason: "empty" };
  }

  const radix = radixLiteral(text);
  if (radix) {
    return radix;
  }

  // Basic/scientific sessions understand decimal digits, the four operators,
  // `^`, parentheses, percent and exponent notation only.
  if (!/^[0-9.+\-*/^()%eE]+$/.test(text) || !/\d/.test(text)) {
    return { ok: false, reason: "invalid" };
  }

  return { ok: true, kind: "expression", text };
}

/**
 * Commands that apply a cleaned paste. The programmer session switches radix
 * and inserts the literal; every other mode receives its decimal equivalent so
 * paste keeps working before the programmer engine lands (T9/T10).
 */
export function pasteCommands(
  result: Extract<PasteResult, { ok: true }>,
  mode: CalcMode,
): CalcCommand[] {
  if (result.kind === "radix") {
    if (mode === "programmer") {
      return [
        { type: "setRadix", radix: result.radix },
        { type: "setExpression", text: result.digits },
      ];
    }
    return [{ type: "setExpression", text: result.decimal }];
  }
  return [{ type: "setExpression", text: result.text }];
}
