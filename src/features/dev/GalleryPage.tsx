import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  SoftButton,
  SoftCard,
  SoftInput,
  SoftTooltip,
  useToast,
} from "../../components/ui";
import { setLanguage, type AppLanguage } from "../../i18n";
import { readStoredTheme, setTheme, type ThemeSetting } from "../../lib";
import styles from "./GalleryPage.module.css";

const THEME_OPTIONS: ThemeSetting[] = ["light", "dark", "system"];
const LANGUAGE_OPTIONS: AppLanguage[] = ["zh-CN", "en-US"];

export function GalleryPage() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const [theme, setThemeState] = useState<ThemeSetting>(() => readStoredTheme());

  const currentLanguage: AppLanguage = i18n.resolvedLanguage === "en-US" ? "en-US" : "zh-CN";

  const handleTheme = (next: ThemeSetting) => {
    setThemeState(next);
    setTheme(next);
  };

  const handleLanguage = (next: AppLanguage) => {
    void setLanguage(next);
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={styles.appName}>{t("appName")}</h1>
          <span className={styles.badge}>{t("menu:devBadge")}</span>
        </div>
        <div className={styles.controls}>
          <div className={styles.controlGroup}>
            <span className={styles.controlLabel}>{t("theme.label")}</span>
            <div className={styles.row}>
              {THEME_OPTIONS.map((option) => (
                <SoftButton
                  key={option}
                  size="sm"
                  variant={theme === option ? "primary" : "ghost"}
                  aria-pressed={theme === option}
                  onClick={() => handleTheme(option)}
                >
                  {t(`theme.${option}`)}
                </SoftButton>
              ))}
            </div>
          </div>
          <div className={styles.controlGroup}>
            <span className={styles.controlLabel}>{t("language.label")}</span>
            <div className={styles.row}>
              {LANGUAGE_OPTIONS.map((option) => (
                <SoftButton
                  key={option}
                  size="sm"
                  variant={currentLanguage === option ? "primary" : "ghost"}
                  aria-pressed={currentLanguage === option}
                  onClick={() => handleLanguage(option)}
                >
                  {t(`language.${option}`)}
                </SoftButton>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className={styles.grid}>
        <SoftCard>
          <h2 className={styles.sectionTitle}>{t("gallery.typography")}</h2>
          <p className={styles.display}>1,234,567.89</p>
          <div className={styles.swatches}>
            <Swatch className={styles.swatchBg} label="bg" />
            <Swatch className={styles.swatchSurface} label="surface" />
            <Swatch className={styles.swatchSurface3} label="surface-3" />
            <Swatch className={styles.swatchPrimary} label="primary" />
            <Swatch className={styles.swatchDanger} label="danger" />
          </div>
        </SoftCard>

        <SoftCard>
          <h2 className={styles.sectionTitle}>{t("gallery.buttons")}</h2>
          <div className={styles.stack}>
            <div className={styles.row}>
              <SoftButton variant="primary">{t("ok")}</SoftButton>
              <SoftButton>{t("cancel")}</SoftButton>
              <SoftButton variant="ghost">{t("copy")}</SoftButton>
              <SoftButton variant="danger">{t("clear")}</SoftButton>
            </div>
            <div className={styles.row}>
              <SoftButton size="sm" variant="primary">
                {t("ok")}
              </SoftButton>
              <SoftButton size="lg" variant="primary">
                {t("ok")}
              </SoftButton>
              <SoftButton size="icon" aria-label={t("copy")}>
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                  <rect
                    x="5.5"
                    y="5.5"
                    width="8"
                    height="8"
                    rx="2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M10.5 3.5v-1a1 1 0 00-1-1h-6a1 1 0 00-1 1v6a1 1 0 001 1h1"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </SoftButton>
            </div>
            <div className={styles.row}>
              <SoftButton variant="primary" loading>
                {t("loading")}
              </SoftButton>
              <SoftButton disabled>{t("reset")}</SoftButton>
              <SoftButton variant="primary" fullWidth>
                {t("ok")}
              </SoftButton>
            </div>
          </div>
        </SoftCard>

        <SoftCard>
          <h2 className={styles.sectionTitle}>{t("gallery.inputs")}</h2>
          <div className={styles.stack}>
            <SoftInput
              label={t("settings:grouping")}
              hint={t("settings:groupingHint")}
              defaultValue="1,234,567.89"
              inputMode="decimal"
            />
            <SoftInput
              label={t("settings:grouping")}
              defaultValue="12x"
              error={t("errors:INVALID_INPUT")}
            />
            <SoftInput
              label={t("units:inputValue")}
              defaultValue="72.5"
              endAdornment="kg"
            />
          </div>
        </SoftCard>

        <SoftCard>
          <h2 className={styles.sectionTitle}>{t("gallery.overlays")}</h2>
          <div className={styles.stack}>
            <div className={styles.row}>
              <SoftTooltip content={t("gallery.tooltipHint")}>
                <SoftButton variant="ghost" aria-label={t("gallery.tooltipHint")}>
                  ?
                </SoftButton>
              </SoftTooltip>
            </div>
            <div className={styles.row}>
              <SoftButton
                size="sm"
                onClick={() => showToast(t("gallery.toastInfo"), { variant: "info" })}
              >
                {t("gallery.toastInfo")}
              </SoftButton>
              <SoftButton
                size="sm"
                onClick={() => showToast(t("gallery.toastSuccess"), { variant: "success" })}
              >
                {t("gallery.toastSuccess")}
              </SoftButton>
              <SoftButton
                size="sm"
                onClick={() => showToast(t("gallery.toastWarning"), { variant: "warning" })}
              >
                {t("gallery.toastWarning")}
              </SoftButton>
              <SoftButton
                size="sm"
                onClick={() => showToast(t("gallery.toastDanger"), { variant: "danger" })}
              >
                {t("gallery.toastDanger")}
              </SoftButton>
            </div>
          </div>
        </SoftCard>
      </div>
    </div>
  );
}

function Swatch({ className, label }: { className: string; label: string }) {
  return (
    <div className={styles.swatch}>
      <span className={`${styles.swatchChip} ${className}`} aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
