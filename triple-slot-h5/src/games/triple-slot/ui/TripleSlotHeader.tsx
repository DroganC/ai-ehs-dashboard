export type TripleSlotHeaderProps = {
  levelName: string;
  progressText: string;
  livesText: string;
};

/**
 * 顶栏：仅展示关卡与状态，不包含应用级导航，保持游戏可独立嵌入。
 */
export function TripleSlotHeader({
  levelName,
  progressText,
  livesText,
}: TripleSlotHeaderProps) {
  return (
    <header className="triple-slot__panel triple-slot__header">
      <div className="triple-slot__header-row">
        <div className="triple-slot__stats">
          <span className="triple-slot__pill">Level {levelName}</span>
          <span className="triple-slot__pill">进度 {progressText}</span>
          <span className="triple-slot__pill triple-slot__pill--danger">
            剩余 {livesText}
          </span>
        </div>
      </div>
    </header>
  );
}
