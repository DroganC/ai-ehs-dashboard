import type { ReactElement } from "react";
import { useRef } from "react";
import { useEpPoolItemFlip } from "../hooks/useEpPoolItemFlip";
import type { CardDef } from "../model/types";
import { EpCardFace } from "./EpCardFace";

export type EpSequencePoolProps = {
  /** 待选区牌 id 列表（与 `emergencyProcedureStore.pool` 一致）。 */
  cardIds: readonly string[];
  getCard: (id: string) => CardDef | undefined;
  /** 与三消一致：仅规则/阶段；多段飞入由 store 排队，不在此锁整板 */
  canInteract: boolean;
  /** 用户点中某张牌时触发；父级内完成「取 `data-ep-pool-id` 节点 rect + 调 store」 */
  onPickFromPool: (cardId: string) => void;
};

/**
 * 第一关：满池 5 张乱序牌，固定牌宽；布局为上 2、下 3，在棋盘内水平垂直居中。
 * 牌被点走后仍按「前两张 / 其余」分行，行内居中。
 */
export function EpSequencePool({
  cardIds,
  getCard,
  canInteract,
  onPickFromPool,
}: EpSequencePoolProps): ReactElement {
  const poolLayoutRef = useRef<HTMLDivElement>(null);
  useEpPoolItemFlip(cardIds, poolLayoutRef);

  const topIds = cardIds.slice(0, 2);
  const bottomIds = cardIds.slice(2);

  function renderItem(id: string): ReactElement | null {
    const card = getCard(id);
    if (!card) return null;
    return (
      <div key={id} className="ep__pool-item" data-ep-pool-id={id}>
        <EpCardFace
          card={card}
          styleVariant="poker"
          selected={false}
          interactionDisabled={!canInteract}
          onSelect={() => {
            onPickFromPool(id);
          }}
        />
      </div>
    );
  }

  return (
    <section className="ep__panel ep__board ep__board--seq" aria-label="流程卡片">
      <div className="ep__board-body">
        <div ref={poolLayoutRef} className="ep__pool--seq-2-3">
          {topIds.length > 0 ? (
            <div className="ep__pool-row">
              {topIds.map((id) => renderItem(id)).filter((n): n is ReactElement => n !== null)}
            </div>
          ) : null}
          {bottomIds.length > 0 ? (
            <div className="ep__pool-row">
              {bottomIds.map((id) => renderItem(id)).filter((n): n is ReactElement => n !== null)}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
