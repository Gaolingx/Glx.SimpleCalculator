import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useToast } from "../../components/ui";
import { cleanPaste, pasteCommands } from "../../lib/clipboard";
import { isCompletedCalculation } from "../../lib/history";
import {
  copyText,
  emptyCalcView,
  isTauriRuntime,
  readClipboardText,
  selectSession,
  toIpcError,
  type CalcCommand,
  type CalcMode,
  type CalcView,
  type ErrorCode,
} from "../../lib/ipc";
import { commandForKeyboard, isEditableTarget } from "../../lib/keyboard";
import { useCalcStore } from "../../stores/calc";
import { useHistoryStore } from "../../stores/history";
import { useSettingsStore } from "../../stores/settings";
import { useUiStore, type OverlayId } from "../../stores/ui";

export interface MenuPosition {
  x: number;
  y: number;
}

export interface CalculatorSession {
  view: CalcView;
  transportError: ErrorCode | null;
  previewNotice: boolean;
  menu: MenuPosition | null;
  setMenu: (menu: MenuPosition | null) => void;
  overlay: OverlayId | null;
  /** Increments when a clear-all command is dispatched; replays the display flash. */
  clearPulse: number;
  /** Resolves with the resulting view, or `null` in preview/transport errors. */
  send: (command: CalcCommand) => Promise<CalcView | null>;
  copyValue: (text: string) => void;
  handlePaste: () => void;
}

/**
 * Shared session plumbing for the calculator pages: serialized IPC dispatch,
 * history recording, clipboard shortcuts and the context menu state. The engine
 * remains the single source of truth; pages only render keys.
 */
export function useCalculatorSession(mode: CalcMode): CalculatorSession {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const view = useCalcStore((state) => state.views[mode]) ?? emptyCalcView(mode);
  const dispatch = useCalcStore((state) => state.dispatch);
  const recordHistory = useHistoryStore((state) => state.record);
  const historyEnabled = useSettingsStore((state) => state.settings.historyEnabled);
  const overlay = useUiStore((state) => state.overlay);
  const [transportError, setTransportError] = useState<ErrorCode | null>(null);
  const [previewNotice, setPreviewNotice] = useState(false);
  const [menu, setMenu] = useState<MenuPosition | null>(null);
  const [clearPulse, setClearPulse] = useState(0);
  const queue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (!isTauriRuntime()) {
      return undefined;
    }
    let cancelled = false;
    queue.current = queue.current
      .then(() => selectSession(mode))
      .then((next) => {
        if (!cancelled) {
          useCalcStore.getState().setView(next);
        }
      })
      .catch(() => {
        // Mount-time activation is best-effort; command errors surface later.
      });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const send = useCallback(
    (command: CalcCommand): Promise<CalcView | null> => {
      if (command.type === "clearAll") {
        setClearPulse((pulse) => pulse + 1);
      }
      setTransportError(null);
      if (!isTauriRuntime()) {
        setPreviewNotice(true);
        return Promise.resolve(null);
      }
      const result = queue.current
        .then(() => dispatch(command))
        .then((next) => {
          if (
            historyEnabled &&
            (command.type === "equals" || command.type === "statsCompute") &&
            isCompletedCalculation(next)
          ) {
            void recordHistory({
              mode: next.mode,
              expression: next.expression,
              value: next.value,
            });
          }
          return next;
        })
        .catch((error: unknown) => {
          setTransportError(toIpcError(error).code);
          return null;
        });
      queue.current = result.then(() => undefined);
      return result;
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
        for (const command of pasteCommands(cleaned, mode)) {
          send(command);
        }
      } catch (error) {
        showToast(t(`errors:${toIpcError(error).code}`), { variant: "danger" });
      }
    })();
  }, [mode, send, showToast, t]);

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
          if (mode === "statistics") {
            return;
          }
          event.preventDefault();
          setMenu(null);
          handlePaste();
        }
        return;
      }
      const command = commandForKeyboard(event, mode);
      if (!command) {
        return;
      }
      event.preventDefault();
      setMenu(null);
      send(command);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, overlay, send, copyValue, handlePaste, view.value]);

  return {
    view,
    transportError,
    previewNotice,
    menu,
    setMenu,
    overlay,
    clearPulse,
    send,
    copyValue,
    handlePaste,
  };
}