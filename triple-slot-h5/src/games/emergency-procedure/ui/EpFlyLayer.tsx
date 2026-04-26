import type { ReactNode } from "react";
import type { EpFly } from "../model/types";

type EpFlyLayerProps = {
  items: readonly EpFly[];
};

/**
 * 全屏 `fixed` 飞入层：只渲染 `store.flys` 中的文案与坐标，不访问 MobX。
 */
export function EpFlyLayer({ items }: EpFlyLayerProps): ReactNode {
  return items.map((f) => (
    <div
      key={f.id}
      className="ep__fly"
      style={{
        transform: `translate(${f.x}px, ${f.y}px) scale(${f.scale})`,
        opacity: f.opacity,
      }}
    >
      {f.text}
    </div>
  ));
}
