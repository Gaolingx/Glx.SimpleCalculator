import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { isTauriRuntime } from "../../lib/ipc";
import { useUiStore } from "../../stores/ui";
import { SoftTooltip } from "../ui";
import { cx } from "../ui/cx";
import styles from "./TitleBar.module.css";
import {
  CloseIcon,
  HistoryIcon,
  MaximizeIcon,
  MinimizeIcon,
  RestoreIcon,
} from "./icons";

type WindowHandle = ReturnType<typeof getCurrentWindow>;

function runWindowAction(action: (window: WindowHandle) => Promise<void>): void {
  if (!isTauriRuntime()) {
    return;
  }
  void action(getCurrentWindow()).catch(() => undefined);
}

export function TitleBar() {
  const { t } = useTranslation();
  const toggleOverlay = useUiStore((state) => state.toggleOverlay);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return undefined;
    }
    const windowHandle = getCurrentWindow();
    let disposed = false;
    let unlisten: (() => void) | undefined;

    const sync = () => {
      void windowHandle
        .isMaximized()
        .then((value) => {
          if (!disposed) {
            setMaximized(value);
          }
        })
        .catch(() => undefined);
    };

    sync();
    void windowHandle
      .onResized(sync)
      .then((stop) => {
        if (disposed) {
          stop();
        } else {
          unlisten = stop;
        }
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  const maximizeLabel = maximized ? t("window.restore") : t("window.maximize");

  return (
    <header className={styles.titleBar}>
      <div className={styles.brand} data-tauri-drag-region>
        <span className={styles.appName} data-tauri-drag-region>
          {t("appName")}
        </span>
        <span className={styles.badge} data-tauri-drag-region>
          {t("menu:devBadge")}
        </span>
      </div>
      <div className={styles.dragArea} data-tauri-drag-region />
      <div className={styles.actions}>
        <SoftTooltip content={t("menu:history")} placement="bottom">
          <button
            type="button"
            className={styles.utility}
            aria-label={t("menu:history")}
            onClick={() => toggleOverlay("history")}
          >
            <HistoryIcon size={18} />
          </button>
        </SoftTooltip>
        <span className={styles.separator} aria-hidden="true" />
        <button
          type="button"
          className={styles.caption}
          aria-label={t("window.minimize")}
          onClick={() => runWindowAction((window) => window.minimize())}
        >
          <MinimizeIcon size={16} />
        </button>
        <button
          type="button"
          className={styles.caption}
          aria-label={maximizeLabel}
          onClick={() => runWindowAction((window) => window.toggleMaximize())}
        >
          {maximized ? <RestoreIcon size={16} /> : <MaximizeIcon size={16} />}
        </button>
        <button
          type="button"
          className={cx(styles.caption, styles.closeButton)}
          aria-label={t("close")}
          onClick={() => runWindowAction((window) => window.close())}
        >
          <CloseIcon size={16} />
        </button>
      </div>
    </header>
  );
}
