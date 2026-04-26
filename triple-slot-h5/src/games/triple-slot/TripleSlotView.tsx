/**
 * 三消槽位根视图：编排子组件、绑定 MobX 与交互；**不**含游戏规则判断（在 `tripleSlotStore`）。
 *
 * 子组件职责简述：
 * - `TripleSlotHeader`：关名 / 清牌进度 / 剩余步数
 * - `TripleSlotBoardGrid`：3×7 可点格，仅通过 `tileAt` 读数
 * - `TripleSlotSlotStrip`：底部 3 槽用于展示与飞入落点 `data-slot-idx`
 * - `TripleSlotToastGroup`：槽将满、失败回滚等旁白
 * - `TripleSlotFlyLayer`：飞入 sprite 的绝对定位层
 * - `TripleSlotRulesOverlay` / `TripleSlotResultOverlay`：首屏与结算
 * - 背景乐与短音见 `public/games/triple-slot/assets/`，`useGameSfxController` 绑定
 */
import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState } from "react";
import { useGameSfxController } from "../hooks/useGameSfxController";
import {
  BOARD_COLS,
  BOARD_ROWS,
  SLOT_CAPACITY,
  TOTAL_TILES,
} from "./model/constants";
import { TRIPLE_SLOT_SFX } from "./audio/paths";
import { TRIPLE_SLOT_DEFAULT_LEVEL } from "./config";
import type { Tile } from "./model/types";
import { tripleSlotStore } from "./store/tripleSlotStore";
import { TripleSlotBoardGrid } from "./ui/TripleSlotBoardGrid";
import { TripleSlotFlyLayer } from "./ui/TripleSlotFlyLayer";
import { TripleSlotHeader } from "./ui/TripleSlotHeader";
import { TripleSlotSlotStrip } from "./ui/TripleSlotSlotStrip";
import { TripleSlotResultOverlay } from "./ui/TripleSlotResultOverlay";
import { TripleSlotRulesOverlay } from "./ui/TripleSlotRulesOverlay";
import { TripleSlotToastGroup } from "./ui/TripleSlotToastGroup";
import { queryTripleSlotCellByIndex } from "./utils/slotDom";
import "./triple-slot-view.less";

export default observer(function TripleSlotView() {
  const [showRules, setShowRules] = useState(true);

  const { setBgmRunning, playClick, playWin, playLose } = useGameSfxController(
    TRIPLE_SLOT_SFX,
  );

  useEffect(() => {
    void tripleSlotStore.loadLevel(TRIPLE_SLOT_DEFAULT_LEVEL);
    return () => {
      tripleSlotStore.dispose();
    };
  }, []);

  const phase = tripleSlotStore.phase;
  const prevPhase = useRef(phase);

  const slotIcons = tripleSlotStore.slotIcons;
  const livesLeft = Math.max(
    0,
    tripleSlotStore.failLimit - tripleSlotStore.failCount,
  );
  const isPlaying = phase === "playing" && !showRules;
  const progressText = `${tripleSlotStore.clearedCount}/${TOTAL_TILES}`;

  useEffect(() => {
    setBgmRunning(isPlaying);
  }, [isPlaying, setBgmRunning]);

  useEffect(() => {
    if (prevPhase.current === "playing" && phase === "win") playWin();
    if (prevPhase.current === "playing" && phase === "lose") playLose();
    prevPhase.current = phase;
  }, [phase, playWin, playLose]);

  async function handlePick(tileId: string, btn: HTMLButtonElement): Promise<void> {
    const tile = tripleSlotStore.tiles.find((t) => t.id === tileId);
    if (!btn || !tile) return;
    playClick();
    const from = btn.getBoundingClientRect();
    await tripleSlotStore.performPick(tileId, from, (idx) =>
      queryTripleSlotCellByIndex(idx),
    );
  }

  function tileAt(row: number, col: number): Tile | null {
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

      {showRules ? (
        <TripleSlotRulesOverlay
          onStart={() => {
            setShowRules(false);
          }}
        />
      ) : null}

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
