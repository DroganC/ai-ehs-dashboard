import type { ReactElement } from "react";
import type { CardDef } from "../model/types";

export type EpCardFaceProps = {
  card: CardDef;
  /**
   * `poker`：第一关角标 + 主文案；`supply`：上为图片位（可缺省），下为物资名。
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
 * 可点击的牌面：第一关为扑克风，第二关为物资格+文案。
 */
export function EpCardFace({
  card,
  styleVariant,
  showImagePlaceholder = true,
  selected = false,
  interactionDisabled = false,
  onSelect,
}: EpCardFaceProps): ReactElement {
  const accent = card.accent ?? "default";
  const isSupply = styleVariant === "supply";

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
      {!isSupply ? (
        <>
          <span className="ep-card__corner ep-card__corner--tl" aria-hidden>
            K
          </span>
          <span className="ep-card__corner ep-card__corner--br" aria-hidden>
            K
          </span>
        </>
      ) : null}
      {isSupply && showImagePlaceholder && !card.image ? (
        <div className="ep-card__img-ph" aria-hidden>
          图
        </div>
      ) : isSupply && card.image ? (
        <img className="ep-card__img" src={card.image} alt="" />
      ) : null}
      <span className="ep-card__label">{card.label}</span>
    </button>
  );
}
