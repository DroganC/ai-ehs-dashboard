import type { ReactElement } from "react";

export type TripleSlotToastGroupProps = {
  dangerText: string | null;
};

/**
 * 失败回滚等警示条；不再展示「槽位将满」类提示。
 */
export function TripleSlotToastGroup({
  dangerText,
}: TripleSlotToastGroupProps): ReactElement {
  return (
    <>
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
