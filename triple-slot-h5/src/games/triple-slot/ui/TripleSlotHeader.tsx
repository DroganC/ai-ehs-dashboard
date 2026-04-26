import type { ReactElement } from "react";

export type TripleSlotHeaderProps = {
  progressText: string;
  livesText: string;
};

/**
 * 顶栏：组进度与剩余可失败次数，不包含应用级导航，保持游戏可独立嵌入。
 */
export function TripleSlotHeader({
  progressText,
  livesText,
}: TripleSlotHeaderProps): ReactElement {
  return (
    <header className="triple-slot__panel triple-slot__header">
      <div className="triple-slot__header-row">
        <div className="triple-slot__stats">
          <span className="triple-slot__pill">进度 {progressText}</span>
          <span className="triple-slot__pill triple-slot__pill--danger">
            剩余 {livesText}
          </span>
        </div>
      </div>
    </header>
  );
}
