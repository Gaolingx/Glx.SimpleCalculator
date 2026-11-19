import { useTranslation } from "react-i18next";

import { SoftButton, type SoftButtonVariant } from "../../components/ui";
import type { BinaryOp, CalcCommand, UnaryOp } from "../../lib/ipc";
import styles from "./ScientificKeypad.module.css";

interface KeyDefinition {
  id: string;
  label: string;
  /** Fully qualified i18n key. */
  aria: string;
  command: CalcCommand;
  variant: SoftButtonVariant;
}

function unary(
  id: string,
  label: string,
  op: UnaryOp,
  variant: SoftButtonVariant = "function",
): KeyDefinition {
  return {
    id,
    label,
    aria: `scientific:keys.${id}`,
    command: { type: "unary", op },
    variant,
  };
}

function binary(
  id: string,
  label: string,
  op: BinaryOp,
  aria = `basic:keys.${id}`,
  variant: SoftButtonVariant = "operator",
): KeyDefinition {
  return {
    id,
    label,
    aria,
    command: { type: "binary", op },
    variant,
  };
}

function digitKey(digit: number): KeyDefinition {
  return {
    id: `digit-${digit}`,
    label: String(digit),
    aria: "",
    command: { type: "digit", digit },
    variant: "number",
  };
}

const ROWS: readonly (readonly KeyDefinition[])[] = [
  [
    unary("sin", "sin", "sin"),
    unary("cos", "cos", "cos"),
    unary("tan", "tan", "tan"),
    unary("asin", "sin⁻¹", "asin"),
    unary("acos", "cos⁻¹", "acos"),
    unary("atan", "tan⁻¹", "atan"),
  ],
  [
    unary("sinh", "sinh", "sinh"),
    unary("cosh", "cosh", "cosh"),
    unary("tanh", "tanh", "tanh"),
    unary("ln", "ln", "ln"),
    unary("log", "log", "log10"),
    unary("exp", "exp", "exp"),
  ],
  [
    unary("square", "x²", "square"),
    unary("cube", "x³", "cube"),
    binary("power", "xʸ", "power", "scientific:keys.power", "function"),
    unary("sqrt", "√x", "sqrt"),
    unary("cubeRoot", "∛x", "cubeRoot"),
    unary("factorial", "n!", "factorial"),
  ],
  [
    unary("reciprocal", "1/x", "reciprocal"),
    unary("abs", "|x|", "abs"),
    unary("floor", "floor", "floor"),
    unary("ceil", "ceil", "ceil"),
    unary("round", "round", "round"),
    {
      id: "rand",
      label: "rand",
      aria: "scientific:keys.rand",
      command: { type: "random" },
      variant: "function",
    },
  ],
  [
    digitKey(7),
    digitKey(8),
    digitKey(9),
    binary("divide", "÷", "divide"),
    {
      id: "percent",
      label: "%",
      aria: "basic:keys.percent",
      command: { type: "percent" },
      variant: "function",
    },
    {
      id: "clear-all",
      label: "C",
      aria: "basic:keys.clearAll",
      command: { type: "clearAll" },
      variant: "danger",
    },
  ],
  [
    digitKey(4),
    digitKey(5),
    digitKey(6),
    binary("multiply", "×", "multiply"),
    {
      id: "toggle-sign",
      label: "±",
      aria: "basic:keys.toggleSign",
      command: { type: "toggleSign" },
      variant: "function",
    },
    {
      id: "backspace",
      label: "⌫",
      aria: "basic:keys.backspace",
      command: { type: "backspace" },
      variant: "warning",
    },
  ],
  [
    digitKey(1),
    digitKey(2),
    digitKey(3),
    binary("subtract", "−", "subtract"),
    {
      id: "open-group",
      label: "(",
      aria: "scientific:keys.openGroup",
      command: { type: "openGroup" },
      variant: "function",
    },
    {
      id: "close-group",
      label: ")",
      aria: "scientific:keys.closeGroup",
      command: { type: "closeGroup" },
      variant: "function",
    },
  ],
  [
    digitKey(0),
    {
      id: "decimal",
      label: ".",
      aria: "basic:keys.decimal",
      command: { type: "dot" },
      variant: "number",
    },
    {
      id: "pi",
      label: "π",
      aria: "scientific:keys.pi",
      command: { type: "constant", id: "pi" },
      variant: "function",
    },
    {
      id: "e",
      label: "e",
      aria: "scientific:keys.e",
      command: { type: "constant", id: "e" },
      variant: "function",
    },
    binary("add", "+", "add"),
    {
      id: "equals",
      label: "=",
      aria: "basic:keys.equals",
      command: { type: "equals" },
      variant: "primary",
    },
  ],
];

interface ScientificKeypadProps {
  onCommand: (command: CalcCommand) => void;
}

export function ScientificKeypad({ onCommand }: ScientificKeypadProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.keypad} role="group" aria-label={t("scientific:keypad")}>
      {ROWS.flat().map((key) => (
        <SoftButton
          key={key.id}
          variant={key.variant}
          size="md"
          className={styles.key}
          aria-label={key.aria ? t(key.aria) : key.label}
          onClick={() => onCommand(key.command)}
        >
          {key.label}
        </SoftButton>
      ))}
    </div>
  );
}