import { observer } from "mobx-react-lite";
import { useEffect } from "react";
import {
  BOARD_COLS,
  BOARD_ROWS,
  SLOT_CAPACITY,
  TOTAL_TILES,
} from "./model/constants";
import { TRIPLE_SLOT_DEFAULT_LEVEL } from "./config";
import { tripleSlotStore } from "./store/tripleSlotStore";
import { TripleSlotBoardGrid } from "./ui/TripleSlotBoardGrid";
import { TripleSlotFlyLayer } from "./ui/TripleSlotFlyLayer";
import { TripleSlotHeader } from "./ui/TripleSlotHeader";
import { TripleSlotSlotStrip } from "./ui/TripleSlotSlotStrip";
import { TripleSlotResultOverlay } from "./ui/TripleSlotResultOverlay";
import { TripleSlotToastGroup } from "./ui/TripleSlotToastGroup";
import "./triple-slot-view.less";

export default observer(function TripleSlotView() {
  useEffect(() => {
    void tripleSlotStore.loadLevel(TRIPLE_SLOT_DEFAULT_LEVEL);
  }, []);

  const phase = tripleSlotStore.phase;

  const slotIcons = tripleSlotStore.slotIcons;
  const livesLeft = Math.max(
    0,
    tripleSlotStore.failLimit - tripleSlotStore.failCount,
  );
  const isPlaying = phase === "playing";
  const progressText = `${tripleSlotStore.clearedCount}/${TOTAL_TILES}`;

  async function handlePick(tileId: string, btn: HTMLButtonElement) {
    const tile = tripleSlotStore.tiles.find((t) => t.id === tileId);
    if (!btn || !tile) return;
    const from = btn.getBoundingClientRect();
    await tripleSlotStore.performPick(tileId, from, (idx) =>
      document.querySelector<HTMLElement>(
        `.triple-slot__slot-cell[data-slot-idx="${idx}"]`,
      ),
    );
  }

  function tileAt(row: number, col: number) {
    return tripleSlotStore.tileAt(row, col);
  }

  const dangerText =
    tripleSlotStore.toast.kind !== "none" ? tripleSlotStore.toast.text : null;

  return (
    <div className="triple-slot">
      <TripleSlotHeader
        levelName={tripleSlotStore.levelName}
        progressText={progressText}
        livesText={String(livesLeft)}
      />
      <main className="triple-slot__panel triple-slot__main">
        <TripleSlotBoardGrid
          rows={BOARD_ROWS}
          cols={BOARD_COLS}
          label="3列7行棋盘"
          tileAt={tileAt}
          isPlaying={isPlaying}
          onPick={handlePick}
        />
      </main>
      <TripleSlotSlotStrip
        capacity={SLOT_CAPACITY}
        slotIcons={slotIcons}
        successAnim={tripleSlotStore.slotAnim === "success"}
      />
      <TripleSlotToastGroup
        almostFull={tripleSlotStore.slotHint === "almostFull"}
        almostFullText="槽位即将满：下一张决定成败"
        dangerText={dangerText}
      />
      <TripleSlotFlyLayer items={tripleSlotStore.flys} />

      {phase === "win" ? (
        <TripleSlotResultOverlay
          kind="win"
          message={`通关成功：你已清空 ${TOTAL_TILES} 张卡片。`}
          actionLabel="再来一局"
          onAction={() => tripleSlotStore.reset()}
        />
      ) : null}
      {phase === "lose" ? (
        <TripleSlotResultOverlay
          kind="lose"
          message={`挑战失败：失败次数达到 ${tripleSlotStore.failLimit} 次。`}
          actionLabel="再来一局"
          onAction={() => tripleSlotStore.reset()}
        />
      ) : null}
    </div>
  );
});
