import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { SoftMenu, useToast, type SoftMenuItem } from "../../components/ui";
import { cleanPaste, pasteCommands } from "../../lib/clipboard";
import { formatNumber } from "../../lib/format";
import {
  copyText,
  emptyCalcView,
  isTauriRuntime,
  readClipboardText,
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

interface MenuPosition {
  x: number;
  y: number;
}

export function BasicPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const view = useCalcStore((state) => state.views[MODE]) ?? EMPTY_VIEW;
  const dispatch = useCalcStore((state) => state.dispatch);
  const recordHistory = useHistoryStore((state) => state.record);
  const grouping = useSettingsStore((state) => state.settings.grouping);
  const historyEnabled = useSettingsStore((state) => state.settings.historyEnabled);
  const overlay = useUiStore((state) => state.overlay);
  const [transportError, setTransportError] = useState<ErrorCode | null>(null);
  const [previewNotice, setPreviewNotice] = useState(false);
  const [menu, setMenu] = useState<MenuPosition | null>(null);
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

  const copyValue = useCallback(
    (text: string) => {
      void copyText(text)
        .then(() => showToast(t("common:copied"), { variant: "success" }))
        .catch(() => showToast(t("errors:INTERNAL"), { variant: "danger" }));
    },
    [showToast, t],
  );

  const handlePaste = useCallback(() => {
    void (async () => {
      try {
        const cleaned = cleanPaste(await readClipboardText());
        if (!cleaned.ok) {
          showToast(t(`basic:paste.${cleaned.reason}`), { variant: "warning" });
          return;
        }
        for (const command of pasteCommands(cleaned, MODE)) {
          send(command);
        }
      } catch (error) {
        showToast(t(`errors:${toIpcError(error).code}`), { variant: "danger" });
      }
    })();
  }, [send, showToast, t]);

  useEffect(
    () =>
      useUiStore.subscribe((state, previous) => {
        if (state.overlay !== null && state.overlay !== previous.overlay) {
          setMenu(null);
        }
      }),
    [],
  );

  useEffect(() => {
    if (overlay) {
      return undefined;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditableTarget(event.target)) {
        return;
      }
      if (event.ctrlKey && !event.altKey && !event.metaKey) {
        const key = event.key.toLowerCase();
        if (key === "c") {
          if (!view.value) {
            return;
          }
          event.preventDefault();
          setMenu(null);
          copyValue(view.value);
        } else if (key === "v") {
          event.preventDefault();
          setMenu(null);
          handlePaste();
        }
        return;
      }
      const command = commandForKeyboard(event);
      if (!command) {
        return;
      }
      event.preventDefault();
      setMenu(null);
      send(command);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [overlay, send, copyValue, handlePaste, view.value]);

  const menuItems: SoftMenuItem[] = [
    {
      id: "copy-raw",
      label: t("basic:contextMenu.copyRaw"),
      shortcut: "Ctrl+C",
      disabled: !view.value,
      onSelect: () => copyValue(view.value),
    },
    {
      id: "copy-display",
      label: t("basic:contextMenu.copyDisplay"),
      disabled: !view.value,
      onSelect: () => copyValue(formatNumber(view.value, { grouping })),
    },
    {
      id: "paste",
      label: t("basic:contextMenu.paste"),
      shortcut: "Ctrl+V",
      onSelect: handlePaste,
    },
    {
      id: "clear",
      label: t("basic:contextMenu.clear"),
      shortcut: "Esc",
      danger: true,
      disabled: !view.value && !view.expression,
      onSelect: () => send({ type: "clearAll" }),
    },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("basic:title")}</h1>
      </header>
      <section
        className={styles.calculator}
        aria-label={t("basic:title")}
        onContextMenu={(event) => {
          event.preventDefault();
          setMenu({ x: event.clientX, y: event.clientY });
        }}
      >
        <Display
          expression={view.expression}
          value={view.value}
          error={transportError ?? view.error?.code ?? null}
          grouping={grouping}
          memory={view.memory !== null}
          onCopy={() => copyValue(view.value)}
        />
        <MemoryBar hasMemory={view.memory !== null} onCommand={send} />
        <Keypad onCommand={send} />
        {previewNotice ? (
          <p className={styles.notice} role="status">
            {t("basic:previewNotice")}
          </p>
        ) : null}
      </section>
      <SoftMenu
        open={menu !== null}
        x={menu?.x ?? 0}
        y={menu?.y ?? 0}
        items={menuItems}
        onClose={() => setMenu(null)}
        label={t("basic:contextMenu.label")}
      />
    </div>
  );
}
