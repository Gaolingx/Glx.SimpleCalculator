import { useTranslation } from "react-i18next";

import { useSettingsStore } from "../../stores/settings";
import { CalculatorMenu } from "../shared/CalculatorMenu";
import { useCalculatorSession } from "../shared/useCalculatorSession";
import { Display } from "./Display";
import { Keypad } from "./Keypad";
import { MemoryBar } from "./MemoryBar";
import styles from "./BasicPage.module.css";

const MODE = "basic" as const;

export function BasicPage() {
  const { t } = useTranslation();
  const grouping = useSettingsStore((state) => state.settings.grouping);
  const {
    view,
    transportError,
    previewNotice,
    menu,
    setMenu,
    send,
    copyValue,
    handlePaste,
  } = useCalculatorSession(MODE);

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
      <CalculatorMenu
        menu={menu}
        onClose={() => setMenu(null)}
        value={view.value}
        expression={view.expression}
        grouping={grouping}
        onCopyValue={copyValue}
        onPaste={handlePaste}
        onClear={() => send({ type: "clearAll" })}
      />
    </div>
  );
}
