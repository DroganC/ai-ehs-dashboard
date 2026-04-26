import type { ReactNode } from "react";

export type TripleSlotResultKind = "win" | "lose";

type TripleSlotResultOverlayProps = {
  kind: TripleSlotResultKind;
  message: ReactNode;
  actionLabel: string;
  onAction: () => void;
};

/**
 * 结算提示：不依赖 antd `Dialog`（其会挂载全屏 Mask 蒙层）。
 * 用透明全屏层拦截操作，只展示中间结果卡，避免整屏发灰。
 */
export function TripleSlotResultOverlay({
  kind,
  message,
  actionLabel,
  onAction,
}: TripleSlotResultOverlayProps) {
  return (
    <div className="triple-slot__result-scrim" role="dialog" aria-modal="true" aria-label="游戏结算">
      <div
        className={
          kind === "lose"
            ? "triple-slot__result-panel triple-slot__result-panel--lose"
            : "triple-slot__result-panel"
        }
      >
        <p className="triple-slot__result-text">{message}</p>
        <button type="button" className="triple-slot__result-btn" onClick={onAction}>
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
