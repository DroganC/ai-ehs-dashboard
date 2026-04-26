import { useEffect, useState, type ReactElement } from "react";

const RULES_COUNTDOWN_SEC = 5;

export type TripleSlotRulesOverlayProps = {
  onStart: () => void;
};

/**
 * 进入本局时展示规则（非 antd Dialog，避免全屏发灰蒙层；与结算层同一交互模式）。
 * 倒计时尚未结束不可点「开始游戏」，避免未读规则。
 */
export function TripleSlotRulesOverlay({ onStart }: TripleSlotRulesOverlayProps): ReactElement {
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
      className="triple-slot__rules-scrim"
      role="dialog"
      aria-modal="true"
      aria-label="游戏规则"
    >
      <div className="triple-slot__rules-panel">
        <h2 className="triple-slot__rules-title">游戏规则</h2>
        <ul className="triple-slot__rules-list">
          <li className="triple-slot__rules-list-item">
            棋盘为 <strong>3 列 × 7 行</strong>，共 21
            张牌；点击某张，它会飞入下方<strong>卡槽</strong>。
          </li>
          <li className="triple-slot__rules-list-item">
            卡槽最多容纳 <strong>3</strong> 张。槽内凑齐<strong>三张相同</strong>即可消除这
            三张；可多次消除直至清空 21 张即通关。
          </li>
          <li className="triple-slot__rules-list-item">
            若卡槽在<strong>已放满 3 张时仍无法形成三连消</strong>，这三张会退回棋盘，本局
            <strong>失败次数 +1</strong>。
          </li>
          <li className="triple-slot__rules-list-item">
            失败次数达到上限时本局结束；请尽量规划点击顺序，避免卡槽被占满而失误。
          </li>
        </ul>
        <button
          type="button"
          className="triple-slot__rules-btn"
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
