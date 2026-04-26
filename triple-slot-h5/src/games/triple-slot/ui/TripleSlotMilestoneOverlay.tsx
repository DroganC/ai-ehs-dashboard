import type { ReactElement } from "react";
import { getMilestoneBodyCopy } from "../milestoneCopy";

export type TripleSlotMilestoneOverlayProps = {
  /** 1..7，对应第几次完成三消组 */
  groupIndex: number;
  onContinue: () => void;
};

/**
 * 每完成一组三消（3 张同型）后弹出，文案由 `milestoneCopy` 提供（可后续接配置）。
 * 与结算层二选一：最后一组先本层，点继续后再见通关卡。
 */
export function TripleSlotMilestoneOverlay({
  groupIndex,
  onContinue,
}: TripleSlotMilestoneOverlayProps): ReactElement {
  const body = getMilestoneBodyCopy();

  return (
    <div
      className="triple-slot__milestone-scrim"
      role="dialog"
      aria-modal="true"
      aria-labelledby="triple-slot-milestone-title"
    >
      <div className="triple-slot__milestone-panel">
        <h2 id="triple-slot-milestone-title" className="triple-slot__milestone-title">
          解锁第{groupIndex}组密集
        </h2>
        <p className="triple-slot__milestone-body">{body}</p>
        <button type="button" className="triple-slot__milestone-btn" onClick={onContinue}>
          继续游戏
        </button>
      </div>
    </div>
  );
}
