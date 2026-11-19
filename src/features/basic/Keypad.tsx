import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";

import { SoftButton, type SoftButtonVariant } from "../../components/ui";
import type { BinaryOp, CalcCommand } from "../../lib/ipc";
import styles from "./Keypad.module.css";

interface KeyDefinition {
  id: string;
  label: string;
  icon?: ReactNode;
  ariaKey: string | null;
  command: CalcCommand;
  variant: SoftButtonVariant;
}

function BackspaceIcon() {
  return (
    <svg
      width="22"
      height="18"
      viewBox="0 0 24 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8 2h13a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H8L1.5 10 8 2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="m11 7 5 6M16 7l-5 6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function digitKey(digit: number): KeyDefinition {
  return {
    id: `digit-${digit}`,
    label: String(digit),
    ariaKey: null,
    command: { type: "digit", digit },
    variant: "number",
  };
}

function operatorKey(id: string, label: string, ariaKey: string, op: BinaryOp): KeyDefinition {
  return { id, label, ariaKey, command: { type: "binary", op }, variant: "operator" };
}

const ROWS: readonly (readonly KeyDefinition[])[] = [
  [
    {
      id: "percent",
      label: "%",
      ariaKey: "keys.percent",
      command: { type: "percent" },
      variant: "function",
    },
    {
      id: "clear-entry",
      label: "CE",
      ariaKey: "keys.clearEntry",
      command: { type: "clearEntry" },
      variant: "warning",
    },
    {
      id: "clear-all",
      label: "C",
      ariaKey: "keys.clearAll",
      command: { type: "clearAll" },
      variant: "danger",
    },
    {
      id: "backspace",
      label: "⌫",
      icon: <BackspaceIcon />,
      ariaKey: "keys.backspace",
      command: { type: "backspace" },
      variant: "warning",
    },
  ],
  [
    {
      id: "reciprocal",
      label: "1/x",
      ariaKey: "keys.reciprocal",
      command: { type: "unary", op: "reciprocal" },
      variant: "function",
    },
    {
      id: "square",
      label: "x²",
      ariaKey: "keys.square",
      command: { type: "unary", op: "square" },
      variant: "function",
    },
    {
      id: "sqrt",
      label: "√x",
      ariaKey: "keys.sqrt",
      command: { type: "unary", op: "sqrt" },
      variant: "function",
    },
    operatorKey("divide", "÷", "keys.divide", "divide"),
  ],
  [digitKey(7), digitKey(8), digitKey(9), operatorKey("multiply", "×", "keys.multiply", "multiply")],
  [digitKey(4), digitKey(5), digitKey(6), operatorKey("subtract", "−", "keys.subtract", "subtract")],
  [digitKey(1), digitKey(2), digitKey(3), operatorKey("add", "+", "keys.add", "add")],
  [
    {
      id: "toggle-sign",
      label: "±",
      ariaKey: "keys.toggleSign",
      command: { type: "toggleSign" },
      variant: "function",
    },
    digitKey(0),
    {
      id: "decimal",
      label: ".",
      ariaKey: "keys.decimal",
      command: { type: "dot" },
      variant: "number",
    },
    {
      id: "equals",
      label: "=",
      ariaKey: "keys.equals",
      command: { type: "equals" },
      variant: "primary",
    },
  ],
];

interface KeypadProps {
  onCommand: (command: CalcCommand) => void;
}

export function Keypad({ onCommand }: KeypadProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.keypad} role="group" aria-label={t("basic:keypad")}>
      {ROWS.flat().map((key) => (
        <SoftButton
          key={key.id}
          variant={key.variant}
          size="md"
          className={styles.key}
          aria-label={key.ariaKey ? t(`basic:${key.ariaKey}`) : key.label}
          onClick={() => onCommand(key.command)}
        >
          {key.icon ?? key.label}
        </SoftButton>
      ))}
    </div>
  );
}
