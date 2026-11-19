import { useTranslation } from "react-i18next";

import { useUiStore } from "../../stores/ui";
import { SoftDialog } from "../ui";
import { HistoryIcon } from "./icons";
import styles from "./HistoryDrawer.module.css";

export function HistoryDrawer() {
  const { t } = useTranslation();
  const open = useUiStore((state) => state.overlay === "history");
  const closeOverlay = useUiStore((state) => state.closeOverlay);

  return (
    <SoftDialog
      open={open}
      onClose={closeOverlay}
      title={t("history:title")}
      variant="sheet"
    >
      <div className={styles.empty}>
        <span className={styles.icon}>
          <HistoryIcon size={26} />
        </span>
        <p className={styles.text}>{t("history:empty")}</p>
        <p className={styles.hint}>{t("history:emptyHint")}</p>
      </div>
    </SoftDialog>
  );
}
