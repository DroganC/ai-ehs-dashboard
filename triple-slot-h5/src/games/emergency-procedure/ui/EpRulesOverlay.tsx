import { useEffect, useState, type ReactElement } from "react";

const RULES_COUNTDOWN_SEC = 5;

export type EpRulesOverlayProps = {
  onStart: () => void;
};

/**
 * 进入本局时展示说明（与三消同模式：非 antd、轻蒙层、倒计时后解锁开始）。
 */
export function EpRulesOverlay({ onStart }: EpRulesOverlayProps): ReactElement {
  const [secondsLeft, setSecondsLeft] = useState(RULES_COUNTDOWN_SEC);

  useEffect(() => {
    const id = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          window.clearInterval(id);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const canStart = secondsLeft <= 0;

  return (
    <div
      className="ep-rules-scrim"
      role="dialog"
      aria-modal="true"
      aria-label="游戏说明"
    >
      <div className="ep-rules-panel">
        <h2 className="ep-rules-title">游戏说明</h2>
        <ul className="ep-rules-list">
          <li className="ep-rules-list-item">
            将<strong>待选区</strong>的卡片按<strong>正确应急步骤顺序</strong>放入下方槽位；可
            <strong>点击</strong>先选牌再点空槽，或在桌面端<strong>拖放</strong>到对应槽内。
          </li>
          <li className="ep-rules-list-item">
            若放错位置，该牌会留在待选区，请按本场景流程重试。底部有简要提示，可按关卡配置。
          </li>
          <li className="ep-rules-list-item">
            开启轻提示时，会高亮当前顺序上<strong>第一个空的槽位</strong>，<strong>不</strong>直接提示应放哪张牌。
          </li>
          <li className="ep-rules-list-item">
            本游戏共 <strong>2</strong> 关，从第 1 关起顺序闯关；<strong>刷新或重新进入</strong>将从第
            1 关重开，无存档。
          </li>
        </ul>
        <button
          type="button"
          className="ep-rules-btn"
          disabled={!canStart}
          aria-disabled={!canStart}
          onClick={() => {
            if (!canStart) return;
            onStart();
          }}
        >
          {canStart ? "开始游戏" : `开始游戏（${secondsLeft}）`}
        </button>
      </div>
    </div>
  );
}
