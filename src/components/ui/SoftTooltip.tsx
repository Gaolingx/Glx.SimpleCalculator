import { cloneElement, useId, type ReactElement, type ReactNode } from "react";

import { cx } from "./cx";
import styles from "./SoftTooltip.module.css";

export type SoftTooltipPlacement = "top" | "bottom" | "left" | "right";

export interface SoftTooltipProps {
  content: ReactNode;
  placement?: SoftTooltipPlacement;
  className?: string;
  children: ReactElement<{ "aria-describedby"?: string }>;
}

export function SoftTooltip({
  content,
  placement = "top",
  className,
  children,
}: SoftTooltipProps) {
  const id = useId();
  const describedBy = [children.props["aria-describedby"], id].filter(Boolean).join(" ");

  return (
    <span className={cx(styles.root, className)}>
      {cloneElement(children, { "aria-describedby": describedBy })}
      <span id={id} role="tooltip" className={cx(styles.bubble, styles[placement])}>
        {content}
      </span>
    </span>
  );
}
