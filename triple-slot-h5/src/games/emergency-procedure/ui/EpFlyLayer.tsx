import type { ReactNode } from "react";
import { EP_FLY_CARD_H, EP_FLY_CARD_W } from "../model/animation";
import type { CardDef, EpFly } from "../model/types";
import { EpPokerCardStatic, EpSupplyCardStatic } from "./epCardStatic";

type EpFlyLayerProps = {
  items: readonly EpFly[];
};

function toCardDef(f: EpFly): CardDef {
  return {
    id: f.card.id,
    label: f.card.label,
    accent: f.card.accent,
    image: f.card.image,
  };
}

/**
 * 全屏 `fixed` 飞入层：与待选区相同扑克/物资格牌面，轨迹由 `transform` 驱动。
 */
export function EpFlyLayer({ items }: EpFlyLayerProps): ReactNode {
  return items.map((f) => (
    <div
      key={f.id}
      className="ep__fly ep__fly--card"
      aria-hidden
      style={{
        transform: `translate(${String(f.x)}px, ${String(f.y)}px) scale(${String(f.scale)})`,
        opacity: f.opacity,
        width: EP_FLY_CARD_W,
        height: EP_FLY_CARD_H,
      }}
    >
      {f.variant === "poker" ? (
        <EpPokerCardStatic card={toCardDef(f)} layout="fly" />
      ) : (
        <EpSupplyCardStatic
          card={toCardDef(f)}
          layout="fly"
          showImagePlaceholder={!f.card.image}
        />
      )}
    </div>
  ));
}
