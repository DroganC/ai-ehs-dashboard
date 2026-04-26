import { useEffect, useState, type ReactElement } from "react";

const RULES_COUNTDOWN_SEC = 5;

export type EpRulesOverlayProps = {
  onStart: () => void;
};

/**
 * 首屏：规则说明，倒计时后解锁「开始游戏」。
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
            <strong>第一关：</strong>上方有 5 张流程牌（乱序），请按<strong>正确灭火流程顺序</strong>依次
            <strong>点击</strong>，牌会飞入下方 5 个卡槽。全部放满后按整体顺序判定；错误则全部归位并重新打乱。卡槽内可再点击将牌取回上面。
          </li>
          <li className="ep-rules-list-item">
            <strong>第二关：</strong>3×3 物资格，请按<strong>与第一关相同的步骤顺序</strong>，选择对应
            消防手报、配电箱、灭火器、移动排烟机、指示图 等。同样满 5 槽判定。错误时全部归位并打乱。卡槽可点回格内。
          </li>
          <li className="ep-rules-list-item">
            第一关通后将提示进入下一关；两关都通为恭喜通关。无进度保存，离开即自第一关重开。
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
