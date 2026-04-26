import type { ReactElement } from "react";

export type TripleSlotSlotStripProps = {
  capacity: number;
  slotIcons: readonly string[];
  successAnim: boolean;
};

/**
 * 底部三槽位展示。`data-slot-idx` 与 `performPick` 飞入落点一一对应。
 */
export function TripleSlotSlotStrip({
  capacity,
  slotIcons,
  successAnim,
}: TripleSlotSlotStripProps): ReactElement {
  return (
    <footer className="triple-slot__panel triple-slot__footer">
      {Array.from({ length: capacity }).map((_, i) => (
        <div key={i} className="triple-slot__slot-cell" data-slot-idx={i}>
          {slotIcons[i] ? (
            <span
              className={
                successAnim
                  ? "triple-slot__slot-emoji triple-slot__slot-emoji--fade-out"
                  : "triple-slot__slot-emoji"
              }
            >
              {slotIcons[i]}
            </span>
          ) : null}
        </div>
      ))}
    </footer>
  );
}
