import { useTranslation } from "react-i18next";

import { SoftButton, SoftDialog } from "../../components/ui";
import { useUiStore } from "../../stores/ui";
import styles from "./ShortcutsSheet.module.css";

interface ShortcutRow {
  keys: string;
  labelKey: string;
}

interface ShortcutGroup {
  titleKey: string;
  rows: readonly ShortcutRow[];
}

const GROUPS: readonly ShortcutGroup[] = [
  {
    titleKey: "help:calculator",
    rows: [
      { keys: "0–9", labelKey: "help:digits" },
      { keys: "+ − × ÷", labelKey: "help:operators" },
      { keys: "Enter / =", labelKey: "help:equals" },
      { keys: "Backspace", labelKey: "help:backspace" },
      { keys: "Esc / Delete", labelKey: "help:clear" },
      { keys: "%", labelKey: "help:percent" },
      { keys: "F9", labelKey: "help:toggleSign" },
      { keys: "R", labelKey: "help:reciprocal" },
      { keys: "Q", labelKey: "help:square" },
      { keys: "@", labelKey: "help:sqrt" },
      { keys: "A–F", labelKey: "help:hexDigits" },
    ],
  },
  {
    titleKey: "help:app",
    rows: [
      { keys: "Ctrl+C", labelKey: "help:copy" },
      { keys: "Ctrl+V", labelKey: "help:paste" },
      { keys: "Ctrl+H", labelKey: "help:history" },
      { keys: "F1", labelKey: "help:help" },
    ],
  },
];

export function ShortcutsSheet() {
  const { t } = useTranslation();
  const open = useUiStore((state) => state.overlay === "help");
  const closeOverlay = useUiStore((state) => state.closeOverlay);

  return (
    <SoftDialog
      open={open}
      onClose={closeOverlay}
      title={t("help:title")}
      description={t("help:description")}
      footer={
        <SoftButton variant="ghost" fullWidth onClick={closeOverlay}>
          {t("close")}
        </SoftButton>
      }
    >
      <div className={styles.groups}>
        {GROUPS.map((group) => (
          <section key={group.titleKey} className={styles.group}>
            <h3 className={styles.groupTitle}>{t(group.titleKey)}</h3>
            <dl className={styles.list}>
              {group.rows.map((row) => (
                <div key={row.keys} className={styles.row}>
                  <dt className={styles.keys}>
                    <kbd className={styles.key}>{row.keys}</kbd>
                  </dt>
                  <dd className={styles.label}>{t(row.labelKey)}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </SoftDialog>
  );
}