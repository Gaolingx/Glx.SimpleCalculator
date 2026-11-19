/**
 * Display-only formatting for canonical values.
 *
 * The Rust engine returns unformatted decimal strings; grouping, the
 * 16-significant-digit window and E notation are decided here (HANDOFF §3.5,
 * §3.10). Raw values are never re-parsed for arithmetic.
 */

export interface FormatNumberOptions {
  /** Insert thousands separators (default `true`). */
  grouping?: boolean;
  /** Digits shown before falling back to E notation (default 16). */
  significantDigits?: number;
  /** Use E notation when the base-10 exponent is >= this value (default 16). */
  upperExponent?: number;
  /** Use E notation when the base-10 exponent is <= this value (default -16). */
  lowerExponent?: number;
}

const DEFAULTS = {
  grouping: true,
  significantDigits: 16,
  upperExponent: 16,
  lowerExponent: -16,
} as const;

const NUMERIC = /^(-?)(\d*)(?:\.(\d*))?$/;

export function groupInteger(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function join(sign: string, int: string, frac: string): string {
  return `${sign}${int}${frac ? `.${frac}` : ""}`;
}

/**
 * Formats a canonical decimal string for display.
 *
 * In-progress entries such as `-`, `0.` and `12.000` keep their literal shape;
 * rounding and E notation only kick in once the value carries more digits than
 * the display window.
 */
export function formatNumber(raw: string, options: FormatNumberOptions = {}): string {
  const grouping = options.grouping ?? DEFAULTS.grouping;
  const maxSig = Math.max(1, Math.floor(options.significantDigits ?? DEFAULTS.significantDigits));
  const upper = options.upperExponent ?? DEFAULTS.upperExponent;
  const lower = options.lowerExponent ?? DEFAULTS.lowerExponent;

  if (raw === "" || raw === "-" || raw === "." || raw === "-.") {
    return raw;
  }

  const match = NUMERIC.exec(raw);
  if (!match) {
    return raw;
  }

  const sign = match[1];
  const trailingDot = raw.endsWith(".");
  const intPart = (match[2] || "0").replace(/^0+(?=\d)/, "");
  const fracPart = match[3] ?? "";
  const digits = intPart + fracPart;
  const firstSig = digits.search(/[1-9]/);

  if (firstSig === -1) {
    return sign + intPart + (fracPart ? `.${fracPart}` : trailingDot ? "." : "");
  }

  // Digits before the decimal point, measured from the first significant digit.
  let point = intPart.length - firstSig;
  let sig = digits.slice(firstSig);

  if (sig.length > maxSig) {
    const nextDigit = sig.charCodeAt(maxSig) - 48;
    sig = sig.slice(0, maxSig);
    if (nextDigit >= 5) {
      const rounded = (BigInt(sig) + 1n).toString();
      if (rounded.length > maxSig) {
        sig = rounded.slice(0, maxSig);
        point += 1;
      } else {
        sig = rounded;
      }
    }
    sig = sig.replace(/0+$/, "") || "0";
  }

  const exponent = point - 1;

  if (exponent >= upper || exponent <= lower) {
    const mantissa = sig.length > 1 ? `${sig[0]}.${sig.slice(1)}` : sig;
    const exponentSign = exponent >= 0 ? "+" : "-";
    return `${sign}${mantissa}e${exponentSign}${Math.abs(exponent)}`;
  }

  let int = "0";
  let frac = "";
  if (point <= 0) {
    frac = "0".repeat(-point) + sig;
  } else if (point >= sig.length) {
    int = sig + "0".repeat(point - sig.length);
  } else {
    int = sig.slice(0, point);
    frac = sig.slice(point);
  }

  const displayedInt = grouping ? groupInteger(int) : int;
  if (!frac && trailingDot && point > 0) {
    return `${sign}${displayedInt}.`;
  }
  return join(sign, displayedInt, frac);
}

/**
 * Localizes the engine expression line (`2 + 3 * 4 =`) for display:
 * typographic operators plus optional digit grouping.
 */
export function formatExpression(expression: string, grouping = true): string {
  if (!expression) {
    return "";
  }

  let text = expression
    .replace(/\bsqrt\(/g, "√(")
    .replace(/\binv\(/g, "1/(");

  if (grouping) {
    text = text.replace(/\d+(?:\.\d+)?/g, (token) => {
      const [int, frac] = token.split(".");
      const grouped = groupInteger(int);
      return frac === undefined ? grouped : `${grouped}.${frac}`;
    });
  }

  return text
    .replaceAll(" * ", " × ")
    .replaceAll(" / ", " ÷ ")
    .replaceAll(" - ", " − ");
}
