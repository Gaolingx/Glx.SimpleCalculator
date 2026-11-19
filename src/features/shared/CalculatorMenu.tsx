import { useTranslation } from "react-i18next";

import { SoftMenu, type SoftMenuItem } from "../../components/ui";
import { formatNumber } from "../../lib/format";
import type { MenuPosition } from "./useCalculatorSession";

interface CalculatorMenuProps {
  menu: MenuPosition | null;
  onClose: () => void;
  value: string;
  expression: string;
  grouping: boolean;
  onCopyValue: (text: string) => void;
  onPaste: () => void;
  onClear: () => void;
  /** Mode-specific "copy displayed value" formatting. */
  formatDisplay?: (value: string) => string;
}

/** Shared context menu for the calculator pages (T7). */
export function CalculatorMenu({
  menu,
  onClose,
  value,
  expression,
  grouping,
  onCopyValue,
  onPaste,
  onClear,
  formatDisplay,
}: CalculatorMenuProps) {
  const { t } = useTranslation();
  const displayText = formatDisplay
    ? formatDisplay(value)
    : formatNumber(value, { grouping });

  const items: SoftMenuItem[] = [
    {
      id: "copy-raw",
      label: t("basic:contextMenu.copyRaw"),
      shortcut: "Ctrl+C",
      disabled: !value,
      onSelect: () => onCopyValue(value),
    },
    {
      id: "copy-display",
      label: t("basic:contextMenu.copyDisplay"),
      disabled: !value,
      onSelect: () => onCopyValue(displayText),
    },
    {
      id: "paste",
      label: t("basic:contextMenu.paste"),
      shortcut: "Ctrl+V",
      onSelect: onPaste,
    },
    {
      id: "clear",
      label: t("basic:contextMenu.clear"),
      shortcut: "Esc",
      danger: true,
      disabled: !value && !expression,
      onSelect: onClear,
    },
  ];

  return (
    <SoftMenu
      open={menu !== null}
      x={menu?.x ?? 0}
      y={menu?.y ?? 0}
      items={items}
      onClose={onClose}
      label={t("basic:contextMenu.label")}
    />
  );
}