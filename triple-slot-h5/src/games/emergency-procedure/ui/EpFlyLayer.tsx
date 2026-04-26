import type { ReactNode } from "react";
import type { EpFly } from "../store/emergencyProcedureStore";

type EpFlyLayerProps = {
  items: readonly EpFly[];
};

/**
 * 全屏 `fixed` 飞入层，仅展示坐标与文案，与 `emergencyProcedureStore.animateFly` 配合。
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
