import type { ReactElement } from "react";

export type TripleSlotToastGroupProps = {
  almostFull: boolean;
  almostFullText: string;
  dangerText: string | null;
};

/**
 * 提示条：与棋盘、槽位无数据耦合，仅做文案展示。
 */
export function TripleSlotToastGroup({
  almostFull,
  almostFullText,
  dangerText,
}: TripleSlotToastGroupProps): ReactElement {
  return (
    <>
      {almostFull ? (
        <div className="triple-slot__toast" role="status" aria-live="polite">
          {almostFullText}
        </div>
      ) : null}
      {dangerText ? (
        <div
          className="triple-slot__toast triple-slot__toast--danger"
          role="status"
          aria-live="polite"
        >
          {dangerText}
        </div>
      ) : null}
    </>
  );
}
