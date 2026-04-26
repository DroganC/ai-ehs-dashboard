import type { DragEvent } from "react";
import type { CardDef } from "../model/types";

type EpCardFaceProps = {
  card: CardDef;
  selected: boolean;
  draggable: boolean;
  /** 规则弹窗未关时为 true，禁止点选与拖拽。 */
  interactionDisabled?: boolean;
  onSelect: () => void;
  onDragStart: (e: DragEvent) => void;
};

export function EpCardFace({
  card,
  selected,
  draggable,
  interactionDisabled = false,
  onSelect,
  onDragStart,
}: EpCardFaceProps) {
  const accent = card.accent ?? "default";
  return (
    <button
      type="button"
      className={`ep-card ep-card--${accent}${selected ? " ep-card--selected" : ""}${
        interactionDisabled ? " ep-card--disabled" : ""
      }`}
      disabled={interactionDisabled}
      draggable={!interactionDisabled && draggable}
      onDragStart={(e) => {
        if (interactionDisabled) {
          e.preventDefault();
          return;
        }
        onDragStart(e);
      }}
      onClick={() => {
        if (interactionDisabled) return;
        onSelect();
      }}
    >
      <span className="ep-card__corner ep-card__corner--tl" aria-hidden>
        K
      </span>
      <span className="ep-card__corner ep-card__corner--br" aria-hidden>
        K
      </span>
      <span className="ep-card__label">{card.label}</span>
    </button>
  );
}
