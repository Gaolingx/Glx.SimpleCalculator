import { useState } from "react";
import { useTranslation } from "react-i18next";

import { SoftButton, SoftMenu, type SoftMenuItem } from "../../components/ui";
import type { CalcCommand, MemoryOp, MemoryView } from "../../lib/ipc";
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
  memories: readonly MemoryView[];
  onCommand: (command: CalcCommand) => void;
}

export function MemoryBar({ memories, onCommand }: MemoryBarProps) {
  const { t } = useTranslation();
  const [panel, setPanel] = useState<{ x: number; y: number } | null>(null);
  const hasMemory = memories.length > 0;

  const items: SoftMenuItem[] = memories.map((memory) => ({
    id: memory.id,
    label: memory.value,
    onSelect: () => onCommand({ type: "memory", op: "recall", id: memory.id }),
  }));
  items.push({
    id: "clear-all",
    label: t("basic:memoryClearAll"),
    danger: true,
    onSelect: () => onCommand({ type: "memory", op: "clear" }),
  });

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
      <SoftButton
        variant="ghost"
        size="sm"
        className={styles.memoryKey}
        aria-label={t("basic:memoryOpen")}
        aria-haspopup="menu"
        aria-expanded={panel !== null}
        disabled={!hasMemory}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setPanel({ x: rect.left, y: rect.bottom + 4 });
        }}
      >
        M▾
      </SoftButton>
      <SoftMenu
        open={panel !== null}
        x={panel?.x ?? 0}
        y={panel?.y ?? 0}
        items={items}
        onClose={() => setPanel(null)}
        label={t("basic:memoryPanel")}
      />
    </div>
  );
}
