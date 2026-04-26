import type { ReactElement } from "react";

export type TripleSlotHeaderProps = {
  /** 已完成三消组数 0..groupTotal */
  groupsCleared: number;
  /** 总组数（本关为 7） */
  groupTotal: number;
  livesText: string;
};

/**
 * 顶栏：头部右侧 7 个圆点组进度、剩余可失败次数；无多关 label。
 */
export function TripleSlotHeader({
  groupsCleared,
  groupTotal,
  livesText,
}: TripleSlotHeaderProps): ReactElement {
  return (
    <header className="triple-slot__panel triple-slot__header">
      <div className="triple-slot__header-row">
        <div className="triple-slot__header-right">
          <div
            className="triple-slot__progress-dots"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={groupTotal}
            aria-valuenow={groupsCleared}
            aria-label={`已完成 ${String(groupsCleared)} / ${String(groupTotal)} 组三消`}
          >
            {Array.from({ length: groupTotal }).map((_, i) => (
              <span
                key={i}
                className={
                  i < groupsCleared
                    ? "triple-slot__progress-dot triple-slot__progress-dot--done"
                    : "triple-slot__progress-dot"
                }
                aria-hidden
              />
            ))}
          </div>
          <span className="triple-slot__pill triple-slot__pill--danger">
            剩余 {livesText}
          </span>
        </div>
      </div>
    </header>
  );
}
