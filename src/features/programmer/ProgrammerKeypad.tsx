import { useTranslation } from "react-i18next";

import { SoftButton, type SoftButtonVariant } from "../../components/ui";
import { cx } from "../../components/ui/cx";
import type { BinaryOp, CalcCommand } from "../../lib/ipc";
import { isDigitAllowed } from "../../lib/programmer";
import type { Radix } from "../../lib/settings";
import styles from "./ProgrammerKeypad.module.css";

interface KeyDefinition {
  id: string;
  label: string;
  /** Fully qualified i18n key; digits use their label. */
  aria: string | null;
  command: CalcCommand;
  variant: SoftButtonVariant;
  digit?: number;
  className?: string;
}

function binary(
  id: string,
  label: string,
  op: BinaryOp,
  aria = `basic:keys.${id}`,
): KeyDefinition {
  return { id, label, aria, command: { type: "binary", op }, variant: "operator" };
}

function digitKey(value: number): KeyDefinition {
  return {
    id: `digit-${value}`,
    label: value.toString(16).toUpperCase(),
    aria: null,
    command: { type: "digit", digit: value },
    variant: "number",
    digit: value,
  };
}

function functionKey(
  id: string,
  label: string,
  command: CalcCommand,
  aria: string,
): KeyDefinition {
  return { id, label, aria, command, variant: "function" };
}

const ROWS: readonly (readonly KeyDefinition[])[] = [
  [
    binary("and", "AND", "and", "programmer:keys.and"),
    binary("or", "OR", "or", "programmer:keys.or"),
    binary("xor", "XOR", "xor", "programmer:keys.xor"),
    functionKey("not", "NOT", { type: "unary", op: "not" }, "programmer:keys.not"),
    binary("left-shift", "LSH", "leftShift", "programmer:keys.leftShift"),
    binary("right-shift", "RSH", "rightShift", "programmer:keys.rightShift"),
  ],
  [
    binary("rotate-left", "ROL", "rotateLeft", "programmer:keys.rotateLeft"),
    binary("rotate-right", "ROR", "rotateRight", "programmer:keys.rotateRight"),
    binary("modulo", "MOD", "modulo", "programmer:keys.modulo"),
    binary("divide", "÷", "divide"),
    {
      id: "clear-entry",
      label: "CE",
      aria: "basic:keys.clearEntry",
      command: { type: "clearEntry" },
      variant: "warning",
    },
    {
      id: "clear-all",
      label: "C",
      aria: "basic:keys.clearAll",
      command: { type: "clearAll" },
      variant: "danger",
    },
  ],
  [10, 11, 12, 13, 14, 15].map(digitKey),
  [
    ...[7, 8, 9].map(digitKey),
    binary("multiply", "×", "multiply"),
    functionKey("toggle-sign", "±", { type: "toggleSign" }, "basic:keys.toggleSign"),
    {
      id: "backspace",
      label: "⌫",
      aria: "basic:keys.backspace",
      command: { type: "backspace" },
      variant: "warning",
    },
  ],
  [
    ...[4, 5, 6].map(digitKey),
    binary("subtract", "−", "subtract"),
    binary("add", "+", "add"),
    {
      id: "equals",
      label: "=",
      aria: "basic:keys.equals",
      command: { type: "equals" },
      variant: "primary",
      className: styles.equals,
    },
  ],
  [
    ...[1, 2, 3].map(digitKey),
    { ...digitKey(0), className: styles.zero },
  ],
];

interface ProgrammerKeypadProps {
  radix: Radix;
  onCommand: (command: CalcCommand) => void;
}

export function ProgrammerKeypad({ radix, onCommand }: ProgrammerKeypadProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.keypad} role="group" aria-label={t("programmer:keypad")}>
      {ROWS.flat().map((key) => (
        <SoftButton
          key={key.id}
          variant={key.variant}
          size="md"
          className={cx(styles.key, key.className)}
          aria-label={key.aria ? t(key.aria) : key.label}
          disabled={key.digit !== undefined && !isDigitAllowed(key.digit, radix)}
          onClick={() => onCommand(key.command)}
        >
          {key.label}
        </SoftButton>
      ))}
    </div>
  );
}