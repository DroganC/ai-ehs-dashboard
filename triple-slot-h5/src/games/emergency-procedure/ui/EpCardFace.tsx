import type { ReactElement } from "react";
import type { CardDef } from "../model/types";
import { EpPokerCardInner, EpSupplyCardInner } from "./epCardStatic";

export type EpCardFaceProps = {
  card: CardDef;
  /**
   * `poker`：第一关，扑克牌式角标 + 中央正文；`supply`：第二关，图区 + 牌底名条。
   */
  styleVariant: "poker" | "supply";
  /**
   * `supply` 且未配置 `card.image` 时显示缺省色块，便于之后替换为真实 `img`。
   */
  showImagePlaceholder?: boolean;
  /** 与旧版兼容：不展示选中态时传 false 即可 */
  selected?: boolean;
  interactionDisabled?: boolean;
  onSelect: () => void;
};

/**
 * 可点击的牌面：主区域为扑克牌式白底、对角色角、花色；第二关为同外框的物资格。
 */
export function EpCardFace({
  card,
  styleVariant,
  showImagePlaceholder = true,
  selected = false,
  interactionDisabled = false,
  onSelect,
}: EpCardFaceProps): ReactElement {
  const isSupply = styleVariant === "supply";
  const accent = card.accent ?? "default";

  return (
    <button
      type="button"
      className={`ep-card ep-card--${accent}${!isSupply ? " ep-card--poker" : " ep-card--supply"}${
        selected ? " ep-card--selected" : ""
      }${interactionDisabled ? " ep-card--disabled" : ""}`}
      disabled={interactionDisabled}
      onClick={() => {
        if (interactionDisabled) return;
        onSelect();
      }}
    >
      {isSupply ? (
        <EpSupplyCardInner card={card} showImagePlaceholder={showImagePlaceholder} />
      ) : (
        <EpPokerCardInner card={card} />
      )}
    </button>
  );
}
