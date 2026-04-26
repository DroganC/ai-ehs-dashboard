/**
 * 应急流程牌面展示：纯展示组件（内角标、物资占位等），供待选区、主槽、飞入层等复用。
 * 不承载交互逻辑，交互在各自父级 `button` / 可点击格子上处理。
 */
import type { ReactElement } from "react";
import type { CardAccent, CardDef } from "../model/types";

export function getSuitForAccent(accent: CardAccent | undefined): {
  suit: string;
  isRed: boolean;
} {
  switch (accent) {
    case "danger":
      return { suit: "♥", isRed: true };
    case "warning":
      return { suit: "♦", isRed: true };
    default:
      return { suit: "♠", isRed: false };
  }
}

export function firstGrapheme(text: string): string {
  const t = text.trim();
  if (!t) return "?";
  const arr = Array.from(t);
  return arr[0] ?? "?";
}

/** 供 `button.ep-card` 复用，勿再包一层 `.ep-card` */
export function EpPokerCardInner({ card }: { card: CardDef }): ReactElement {
  const { suit, isRed } = getSuitForAccent(card.accent);
  const rank = firstGrapheme(card.label);
  const cornerClass = isRed
    ? "ep-card__corner ep-card__corner--red"
    : "ep-card__corner";

  return (
    <span className="ep-card__face ep-card__face--poker">
      <span className={`${cornerClass} ep-card__corner--tl`} aria-hidden>
        <span className="ep-card__pip">
          <span className="ep-card__rank">{rank}</span>
          <span className="ep-card__suit">{suit}</span>
        </span>
      </span>
      <span className="ep-card__body">
        <span className="ep-card__label ep-card__label--poker">{card.label}</span>
      </span>
      <span className={`${cornerClass} ep-card__corner--br`} aria-hidden>
        <span className="ep-card__pip">
          <span className="ep-card__rank">{rank}</span>
          <span className="ep-card__suit">{suit}</span>
        </span>
      </span>
    </span>
  );
}

export type EpSupplyCardInnerProps = {
  card: CardDef;
  showImagePlaceholder?: boolean;
};

export function EpSupplyCardInner({
  card,
  showImagePlaceholder = true,
}: EpSupplyCardInnerProps): ReactElement {
  const { suit, isRed } = getSuitForAccent(card.accent);
  const rank = firstGrapheme(card.label);

  return (
    <span className="ep-card__face ep-card__face--supply">
      <span
        className={`ep-card__mini-corner ${isRed ? "ep-card__mini-corner--red" : ""}`}
        aria-hidden
      >
        <span className="ep-card__rank ep-card__rank--mini">{rank}</span>
        <span className="ep-card__suit ep-card__suit--mini">{suit}</span>
      </span>
      <div className="ep-card__art">
        {showImagePlaceholder && !card.image ? (
          <div className="ep-card__img-ph" aria-hidden>
            图
          </div>
        ) : card.image ? (
          <img className="ep-card__img" src={card.image} alt="" />
        ) : null}
      </div>
      <div className="ep-card__caption">
        <span className="ep-card__label ep-card__label--supply">{card.label}</span>
      </div>
    </span>
  );
}

export type EpPokerCardStaticProps = {
  card: CardDef;
  className?: string;
  /** `slot`：底栏槽位；`fly`：飞入层，略小。 */
  layout?: "slot" | "fly";
};

/** 独立完整扑克 `div`（底栏等），与池内主牌面一致。 */
export function EpPokerCardStatic({
  card,
  className = "",
  layout = "slot",
}: EpPokerCardStaticProps): ReactElement {
  const accent = card.accent ?? "default";
  const surface = layout === "fly" ? "ep-card--fly" : "ep-card--slot";
  return (
    <div
      className={`ep-card ep-card--${accent} ep-card--poker ${surface}${className ? ` ${className}` : ""}`}
    >
      <EpPokerCardInner card={card} />
    </div>
  );
}

export type EpSupplyCardStaticProps = {
  card: CardDef;
  className?: string;
  showImagePlaceholder?: boolean;
  layout?: "slot" | "fly";
};

/** 独立完整物资格 `div`（底栏等）。 */
export function EpSupplyCardStatic({
  card,
  className = "",
  showImagePlaceholder = true,
  layout = "slot",
}: EpSupplyCardStaticProps): ReactElement {
  const accent = card.accent ?? "default";
  const surface = layout === "fly" ? "ep-card--fly" : "ep-card--slot";
  return (
    <div
      className={`ep-card ep-card--${accent} ep-card--supply ${surface}${className ? ` ${className}` : ""}`}
    >
      <EpSupplyCardInner card={card} showImagePlaceholder={showImagePlaceholder} />
    </div>
  );
}
