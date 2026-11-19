import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cx } from "./cx";
import styles from "./SoftButton.module.css";

export type SoftButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type SoftButtonSize = "sm" | "md" | "lg" | "icon";

export interface SoftButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: SoftButtonVariant;
  size?: SoftButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  children?: ReactNode;
}

export function SoftButton({
  variant = "secondary",
  size = "md",
  loading = false,
  fullWidth = false,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: SoftButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(styles.button, styles[variant], styles[size], fullWidth && styles.fullWidth, className)}
      {...rest}
    >
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
