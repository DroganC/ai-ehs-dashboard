import type { ReactNode } from "react";
import type { FlyLayerItem } from "../model/types";

export type { FlyLayerItem as TripleSlotFly } from "../model/types";

type TripleSlotFlyLayerProps = {
  items: readonly FlyLayerItem[];
};

/**
 * 全屏 `fixed` 飞入层：根据 `TripleSlotStore.flys` 像素坐标叠在棋盘上，不含业务判断。
 */
export function TripleSlotFlyLayer({ items }: TripleSlotFlyLayerProps): ReactNode {
  return items.map((f) => (
    <div
      key={f.id}
      className="triple-slot__fly"
      style={{
        transform: `translate(${f.x}px, ${f.y}px) scale(${f.scale})`,
        opacity: f.opacity,
      }}
    >
      {f.icon}
    </div>
  ));
}
