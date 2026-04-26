import type { ReactElement } from "react";
import type { CardDef } from "../model/types";
import { EpCardFace } from "./EpCardFace";

export type EpSequencePoolProps = {
  /** 棋盘上主标题，如第一关操作说明。 */
  boardTitle: string;
  /** 待选区牌 id 列表（与 `emergencyProcedureStore.pool` 一致）。 */
  cardIds: readonly string[];
  getCard: (id: string) => CardDef | undefined;
  /** 与三消一致：仅规则/阶段；多段飞入由 store 排队，不在此锁整板 */
  canInteract: boolean;
  /** 用户点中某张牌时触发；父组件内完成「取 `data-ep-pool-id` 节点 rect + 调 store」 */
  onPickFromPool: (cardId: string) => void;
};

/**
 * 第一关：乱序待选区 + 扑克风牌面。纯展示与点击转发，不持有 MobX。
 */
export function EpSequencePool({
  boardTitle,
  cardIds,
  getCard,
  canInteract,
  onPickFromPool,
}: EpSequencePoolProps): ReactElement {
  return (
    <section className="ep__panel ep__board ep__board--seq" aria-label="流程卡片">
      <h2 className="ep__board-title">{boardTitle}</h2>
      <div className="ep__pool--seq">
        {cardIds.map((id) => {
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
        })}
      </div>
    </section>
  );
}
