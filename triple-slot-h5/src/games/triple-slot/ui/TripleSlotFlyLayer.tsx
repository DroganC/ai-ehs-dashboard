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
export function TripleSlotFlyLayer({ items }: TripleSlotFlyLayerProps) {
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
