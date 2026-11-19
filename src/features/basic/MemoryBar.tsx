import { useTranslation } from "react-i18next";

import { SoftButton } from "../../components/ui";
import type { CalcCommand, MemoryOp } from "../../lib/ipc";
import styles from "./MemoryBar.module.css";

interface MemoryKey {
  op: MemoryOp;
  label: string;
  ariaKey: string;
  requiresValue: boolean;
}

const KEYS: readonly MemoryKey[] = [
  { op: "clear", label: "MC", ariaKey: "memoryKeys.clear", requiresValue: true },
  { op: "recall", label: "MR", ariaKey: "memoryKeys.recall", requiresValue: true },
  { op: "add", label: "M+", ariaKey: "memoryKeys.add", requiresValue: false },
  { op: "subtract", label: "M−", ariaKey: "memoryKeys.subtract", requiresValue: false },
  { op: "store", label: "MS", ariaKey: "memoryKeys.store", requiresValue: false },
];

interface MemoryBarProps {
  hasMemory: boolean;
  onCommand: (command: CalcCommand) => void;
}

export function MemoryBar({ hasMemory, onCommand }: MemoryBarProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.memoryBar} role="group" aria-label={t("basic:memory")}>
      {KEYS.map((key) => (
        <SoftButton
          key={key.op}
          variant="ghost"
          size="sm"
          className={styles.memoryKey}
          aria-label={t(`basic:${key.ariaKey}`)}
          disabled={key.requiresValue && !hasMemory}
          onClick={() => onCommand({ type: "memory", op: key.op })}
        >
          {key.label}
        </SoftButton>
      ))}
    </div>
  );
}
