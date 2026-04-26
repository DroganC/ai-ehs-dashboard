import type { ReactElement } from "react";
import type { Tile } from "../model/types";

export type TripleSlotBoardGridProps = {
  rows: number;
  cols: number;
  label: string;
  tileAt: (row: number, col: number) => Tile | null;
  isPlaying: boolean;
  /** 点选后可能触发动画，故允许 `async` */
  onPick: (tileId: string, button: HTMLButtonElement) => void | Promise<void>;
};

/**
 * 棋盘网格：只负责按行列渲染，状态由父组件通过 tileAt / flags 提供。
 */
export function TripleSlotBoardGrid({
  rows,
  cols,
  label,
  tileAt,
  isPlaying,
  onPick,
}: TripleSlotBoardGridProps): ReactElement {
  return (
    <section className="triple-slot__board" aria-label={label}>
      <div className="triple-slot__grid" role="grid" aria-label={label}>
        {Array.from({ length: rows }).map((_, r) =>
          Array.from({ length: cols }).map((__, c) => {
            const tile = tileAt(r, c);
            if (!tile)
              return (
                <div
                  key={`${r}-${c}`}
                  role="gridcell"
                  className="triple-slot__grid-cell triple-slot__grid-cell--empty"
                />
              );
            const disabled = tile.state !== "onBoard" || !isPlaying;
            const picking = tile.state === "picking";
            return (
              <div
                key={`${r}-${c}`}
                role="gridcell"
                className="triple-slot__grid-cell"
              >
                <button
                  type="button"
                  className={`triple-slot__tile ${disabled ? "triple-slot__tile--disabled" : ""} ${picking ? "triple-slot__tile--picking" : ""}`}
                  disabled={disabled}
                  aria-label={`卡片 ${tile.type}`}
                  onClick={(e) => void onPick(tile.id, e.currentTarget)}
                >
                  <div className="triple-slot__tile-badge">{tile.type}</div>
                  <div className="triple-slot__tile-icon">{tile.icon}</div>
                </button>
              </div>
            );
          }),
        )}
      </div>
    </section>
  );
}
