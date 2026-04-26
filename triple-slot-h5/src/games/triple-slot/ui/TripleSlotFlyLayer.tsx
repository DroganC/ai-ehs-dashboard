import type { ReactNode } from "react";

/**
 * 单条飞入动画的视图像素状态（`fixed` 定位的临时层）。
 * 与 `TripleSlotStore` 内 `flys` 项形状一致，便于对拍。
 */
export type TripleSlotFly = {
  id: string;
  icon: string;
  x: number;
  y: number;
  scale: number;
  opacity: number;
};

type TripleSlotFlyLayerProps = {
  items: readonly TripleSlotFly[];
};

/**
 * 飞行动画层：只负责根据坐标渲染，不参与游戏逻辑。
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
