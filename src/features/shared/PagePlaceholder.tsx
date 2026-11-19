import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { SoftCard } from "../../components/ui";
import styles from "./PagePlaceholder.module.css";

export interface PagePlaceholderProps {
  title: string;
  icon: ReactNode;
}

export function PagePlaceholder({ title, icon }: PagePlaceholderProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{title}</h1>
      </header>
      <SoftCard padding="lg" className={styles.card}>
        <span className={styles.icon}>{icon}</span>
        <p className={styles.body}>{t("comingSoon")}</p>
      </SoftCard>
    </div>
  );
}
