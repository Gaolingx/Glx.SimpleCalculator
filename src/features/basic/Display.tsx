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
}

const SIZE_STEPS: ReadonlyArray<readonly [number, string]> = [
  [9, "xl"],
  [12, "lg"],
  [16, "md"],
  [22, "sm"],
];

function sizeFor(text: string): string {
  for (const [maxLength, size] of SIZE_STEPS) {
    if (text.length <= maxLength) {
      return size;
    }
  }
  return "xs";
}

export function Display({ expression, value, error, grouping, memory }: DisplayProps) {
  const { t } = useTranslation();
  const displayValue = value ? formatNumber(value, { grouping }) : "0";
  const errorText = error ? t(`errors:${error}`) : "";
  const mainText = errorText || displayValue;
  const formattedExpression = formatExpression(expression, grouping);

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
