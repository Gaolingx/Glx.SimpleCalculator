import { useTranslation } from "react-i18next";

import { bitRows } from "../../lib/programmer";
import styles from "./BitGrid.module.css";

interface BitGridProps {
  /** MSB-first, one character per bit. */
  bits: string;
  onToggle: (bit: number) => void;
}

export function BitGrid({ bits, onToggle }: BitGridProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.grid} role="group" aria-label={t("programmer:bits")}>
      {bitRows(bits).map((row) => {
        const cells = [...row.value];
        return (
          <div
            key={row.high}
            className={styles.row}
            style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}
          >
            {cells.map((bit, index) => {
              const position = row.high - index;
              return (
                <button
                  key={position}
                  type="button"
                  className={styles.cell}
                  data-active={bit === "1"}
                  aria-pressed={bit === "1"}
                  aria-label={t("programmer:bit", { index: position })}
                  onClick={() => onToggle(position)}
                >
                  {bit}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}