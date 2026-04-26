import type { DragEvent } from "react";
import type { CardDef } from "../model/types";

type EpCardFaceProps = {
  card: CardDef;
  selected: boolean;
  draggable: boolean;
  onSelect: () => void;
  onDragStart: (e: DragEvent) => void;
};

export function EpCardFace({ card, selected, draggable, onSelect, onDragStart }: EpCardFaceProps) {
  const accent = card.accent ?? "default";
  return (
    <button
      type="button"
      className={`ep-card ep-card--${accent}${selected ? " ep-card--selected" : ""}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onSelect}
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
