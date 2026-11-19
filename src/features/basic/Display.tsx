import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { SoftCard } from "../../components/ui";
import { cx } from "../../components/ui/cx";
import { formatExpression, formatNumber } from "../../lib/format";
import type { ErrorCode } from "../../lib/ipc";
import styles from "./Display.module.css";

export interface DisplayProps {
  expression: string;
  value: string;
  error: ErrorCode | null;
  grouping: boolean;
  memory: boolean;
  onCopy: () => void;
  /** Scientific-mode F-E toggle. */
  notation?: "auto" | "scientific";
  /** Pre-formatted value (programmer radix projection); bypasses `formatNumber`. */
  valueText?: string;
  /** Pre-formatted expression line (radix-aware grouping). */
  expressionText?: string;
  /** Increments on clear-all; replays the fade-out/in flash on the value. */
  flashToken?: number;
}

const SIZE_STEPS: ReadonlyArray<readonly [number, string]> = [
  [9, "xl"],
  [12, "lg"],
  [16, "md"],
  [22, "sm"],
  [32, "xs"],
  [48, "xxs"],
];

function sizeFor(text: string): string {
  for (const [maxLength, size] of SIZE_STEPS) {
    if (text.length <= maxLength) {
      return size;
    }
  }
  return "xxs";
}

export function Display({
  expression,
  value,
  error,
  grouping,
  memory,
  onCopy,
  notation = "auto",
  valueText,
  expressionText,
  flashToken = 0,
}: DisplayProps) {
  const { t } = useTranslation();
  const displayValue =
    valueText ?? (value ? formatNumber(value, { grouping, notation }) : "0");
  const errorText = error ? t(`errors:${error}`) : "";
  const mainText = errorText || displayValue;
  const formattedExpression = expressionText ?? formatExpression(expression, grouping);

  const expressionRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLDivElement>(null);
  const [announced, setAnnounced] = useState("");

  useEffect(() => {
    const node = expressionRef.current;
    if (node) {
      node.scrollLeft = node.scrollWidth;
    }
  }, [formattedExpression]);

  useEffect(() => {
    const node = valueRef.current;
    if (node) {
      node.scrollLeft = node.scrollWidth;
    }
  }, [mainText]);

  // Web Animations API instead of a CSS animation: the global
  // prefers-reduced-motion rule shortens CSS animations to 1ms, which would
  // also paint one blank frame on clear.
  useEffect(() => {
    if (flashToken === 0) {
      return undefined;
    }
    const node = valueRef.current;
    if (!node || typeof node.animate !== "function") {
      return undefined;
    }
    const animation = node.animate(
      [{ opacity: 1 }, { opacity: 0, offset: 0.4 }, { opacity: 1 }],
      { duration: 380, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
    return () => animation.cancel();
  }, [flashToken]);

  useEffect(() => {
    const timer = window.setTimeout(() => setAnnounced(mainText), 300);
    return () => window.clearTimeout(timer);
  }, [mainText]);

  return (
    <SoftCard padding="none" className={styles.display}>
      <div className={styles.body}>
        <div className={styles.topRow}>
          {memory ? (
            <span className={styles.memory} aria-label={t("basic:memoryIndicator")}>
              M
            </span>
          ) : null}
          <div
            ref={expressionRef}
            className={styles.expression}
            aria-label={t("basic:expression")}
            data-testid="calc-expression"
            title={formattedExpression || undefined}
          >
            {formattedExpression || "\u00a0"}
          </div>
          <button
            type="button"
            className={styles.copy}
            onClick={onCopy}
            disabled={!value}
            aria-label={t("common:copy")}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="9" y="9" width="11" height="11" rx="2.5" />
              <path d="M15 6.5V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7a2 2 0 002 2h.5" />
            </svg>
          </button>
        </div>
        <div
          ref={valueRef}
          className={cx(styles.value, errorText ? styles.error : undefined)}
          data-size={errorText ? "error" : sizeFor(mainText)}
          data-testid="calc-value"
        >
          {mainText}
        </div>
        <span className={styles.srOnly} aria-live="polite" aria-atomic="true">
          {announced}
        </span>
      </div>
    </SoftCard>
  );
}
