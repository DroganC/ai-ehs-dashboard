import type { ReactElement, CSSProperties } from "react";
import type { CardDef } from "../model/types";
import { EpCardFace } from "./EpCardFace";

export type EpSupplyGridProps = {
  boardTitle: string;
  gridW: number;
  gridH: number;
  /** `rows * cols`，用于 `Array.from` 下标。 */
  gridCellCount: number;
  /** 行优先 3×3 格内牌 id 或空。 */
  gridCells: readonly (string | null)[];
  getCard: (id: string) => CardDef | undefined;
  canInteract: boolean;
  /** 点击有牌格时由父级完成 rect 与 `store.clickFromGrid`。 */
  onPickFromCell: (cellIndex: number) => void;
};

/**
 * 第二关：3×3 可配置网格 + 物资格风牌面。不持有 MobX，仅受控渲染。
 */
export function EpSupplyGrid({
  boardTitle,
  gridW,
  gridH,
  gridCellCount,
  gridCells,
  getCard,
  canInteract,
  onPickFromCell,
}: EpSupplyGridProps): ReactElement {
  const style: CSSProperties = {
    gridTemplateColumns: `repeat(${String(gridW)}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${String(gridH)}, minmax(0, 1fr))`,
  };

  return (
    <section className="ep__panel ep__board ep__board--grid" aria-label="消防物资格">
      <h2 className="ep__board-title">{boardTitle}</h2>
      <div className="ep__grid-9" style={style}>
        {Array.from({ length: gridCellCount }).map((_, cellIndex) => {
          const id = gridCells[cellIndex];
          const card = id ? getCard(id) : undefined;
          if (!id || !card) {
            return (
              <div
                key={`c-${String(cellIndex)}`}
                className="ep__grid-cell ep__grid-cell--empty"
                aria-label={`空位 ${String(cellIndex + 1)}`}
              />
            );
          }
          return (
            <div
              key={id}
              className="ep__grid-cell"
              data-ep-cell={String(cellIndex)}
            >
              <div className="ep__grid-cell-inner" data-ep-pool-id={id}>
                <EpCardFace
                  card={card}
                  styleVariant="supply"
                  showImagePlaceholder
                  interactionDisabled={!canInteract}
                  onSelect={() => {
                    onPickFromCell(cellIndex);
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
