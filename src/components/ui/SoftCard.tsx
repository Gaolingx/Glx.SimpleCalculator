import type { HTMLAttributes } from "react";

import { cx } from "./cx";
import styles from "./SoftCard.module.css";

export type SoftCardPadding = "none" | "sm" | "md" | "lg";

export interface SoftCardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  padding?: SoftCardPadding;
}

export function SoftCard({
  interactive = false,
  padding = "md",
  className,
  ...rest
}: SoftCardProps) {
  return (
    <div
      className={cx(styles.card, styles[padding], interactive && styles.interactive, className)}
      {...rest}
    />
  );
}
