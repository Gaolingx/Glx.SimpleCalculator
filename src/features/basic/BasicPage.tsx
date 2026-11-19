import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  emptyCalcView,
  isTauriRuntime,
  toIpcError,
  type CalcCommand,
  type ErrorCode,
} from "../../lib/ipc";
import { isCompletedCalculation } from "../../lib/history";
import { commandForKeyboard, isEditableTarget } from "../../lib/keyboard";
import { useCalcStore } from "../../stores/calc";
import { useHistoryStore } from "../../stores/history";
import { useSettingsStore } from "../../stores/settings";
import { useUiStore } from "../../stores/ui";
import { Display } from "./Display";
import { Keypad } from "./Keypad";
import { MemoryBar } from "./MemoryBar";
import styles from "./BasicPage.module.css";

const MODE = "basic" as const;
const EMPTY_VIEW = emptyCalcView(MODE);

export function BasicPage() {
  const { t } = useTranslation();
  const view = useCalcStore((state) => state.views[MODE]) ?? EMPTY_VIEW;
  const dispatch = useCalcStore((state) => state.dispatch);
  const recordHistory = useHistoryStore((state) => state.record);
  const grouping = useSettingsStore((state) => state.settings.grouping);
  const historyEnabled = useSettingsStore((state) => state.settings.historyEnabled);
  const overlay = useUiStore((state) => state.overlay);
  const [transportError, setTransportError] = useState<ErrorCode | null>(null);
  const [previewNotice, setPreviewNotice] = useState(false);
  const queue = useRef<Promise<void>>(Promise.resolve());

  const send = useCallback(
    (command: CalcCommand) => {
      setTransportError(null);
      if (!isTauriRuntime()) {
        setPreviewNotice(true);
        return;
      }
      queue.current = queue.current
        .then(() => dispatch(command))
        .then((next) => {
          if (
            historyEnabled &&
            command.type === "equals" &&
            isCompletedCalculation(next)
          ) {
            void recordHistory({
              mode: next.mode,
              expression: next.expression,
              value: next.value,
            });
          }
        })
        .catch((error: unknown) => setTransportError(toIpcError(error).code));
    },
    [dispatch, historyEnabled, recordHistory],
  );

  useEffect(() => {
    if (overlay) {
      return undefined;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditableTarget(event.target)) {
        return;
      }
      const command = commandForKeyboard(event);
      if (!command) {
        return;
      }
      event.preventDefault();
      send(command);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [overlay, send]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("basic:title")}</h1>
      </header>
      <section className={styles.calculator} aria-label={t("basic:title")}>
        <Display
          expression={view.expression}
          value={view.value}
          error={transportError ?? view.error?.code ?? null}
          grouping={grouping}
          memory={view.memory !== null}
        />
        <MemoryBar hasMemory={view.memory !== null} onCommand={send} />
        <Keypad onCommand={send} />
        {previewNotice ? (
          <p className={styles.notice} role="status">
            {t("basic:previewNotice")}
          </p>
        ) : null}
      </section>
    </div>
  );
}
