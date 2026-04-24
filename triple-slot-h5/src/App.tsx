import { Dialog } from "antd-mobile";
import { observer } from "mobx-react-lite";
import { useEffect } from "react";
import { BOARD_COLS, BOARD_ROWS, SLOT_CAPACITY } from "./game/constants";
import { gameStore } from "./stores/GameStore";
import "./App.css";

function AppImpl() {
  useEffect(() => {
    void gameStore.loadLevel("/levels/level-01.json");
  }, []);

  const phase = gameStore.phase;
  useEffect(() => {
    if (phase === "win") {
      Dialog.alert({
        content: "通关成功：你已清空 21 张卡片。",
        confirmText: "再来一局",
        onConfirm: () => gameStore.reset(),
      });
    } else if (phase === "lose") {
      Dialog.alert({
        content: `挑战失败：失败次数达到 ${gameStore.failLimit} 次。`,
        confirmText: "再来一局",
        onConfirm: () => gameStore.reset(),
      });
    }
  }, [phase]);

  const slotIcons = gameStore.slotIcons;
  const livesLeft = Math.max(0, gameStore.failLimit - gameStore.failCount);

  async function handlePick(tileId: string, btn: HTMLButtonElement) {
    const tile = gameStore.tiles.find((t) => t.id === tileId);
    if (!btn || !tile) return;

    const from = btn.getBoundingClientRect();
    const targetIdx = gameStore.slot.length;
    const slotCell = document.querySelector<HTMLDivElement>(
      `.game__slotCell[data-slot-idx="${targetIdx}"]`,
    );
    if (!slotCell) return;
    const to = slotCell.getBoundingClientRect();
    await gameStore.performPick(tileId, from, to);
  }

  return (
    <div className="game">
      <header className="game__panel game__header">
        <div className="game__headerRow">
          <div className="game__stats">
            <span className="game__pill">Level {gameStore.levelName}</span>
            <span className="game__pill">进度 {gameStore.clearedCount}/21</span>
            <span className="game__pill game__pill--danger">
              剩余 {livesLeft}
            </span>
          </div>
        </div>
      </header>

      <main className="game__panel game__main">
        <section className="game__board" aria-label="棋盘">
          <div className="game__grid" role="grid" aria-label="3列7行棋盘">
            {Array.from({ length: BOARD_ROWS }).map((_, r) =>
              Array.from({ length: BOARD_COLS }).map((__, c) => {
                const tile = gameStore.tileAt(r, c);
                if (!tile)
                  return (
                    <div
                      key={`${r}-${c}`}
                      role="gridcell"
                      className="game__gridCell game__gridCell--empty"
                    />
                  );
                const disabled =
                  gameStore.locked ||
                  tile.state !== "onBoard" ||
                  gameStore.phase !== "playing";
                const picking = tile.state === "picking";
                return (
                  <div
                    key={`${r}-${c}`}
                    role="gridcell"
                    className="game__gridCell"
                  >
                    <button
                      type="button"
                      className={`game__tile ${disabled ? "game__tile--disabled" : ""} ${picking ? "game__tile--picking" : ""}`}
                      disabled={disabled}
                      aria-label={`卡片 ${tile.type}`}
                      onClick={(e) =>
                        void handlePick(tile.id, e.currentTarget)
                      }
                    >
                      <div className="game__tileBadge">{tile.type}</div>
                      <div className="game__tileIcon">{tile.icon}</div>
                    </button>
                  </div>
                );
              }),
            )}
          </div>
        </section>
      </main>

      <footer className="game__panel game__footer">
        {Array.from({ length: SLOT_CAPACITY }).map((_, i) => (
          <div
            key={i}
            className="game__slotCell"
            data-slot-idx={i}
          >
            {slotIcons[i] ? (
              <div
                className={`game__tileMini ${gameStore.slotAnim === "success" ? "game__tileMini--fadeOut" : ""}`}
              >
                {slotIcons[i]}
              </div>
            ) : null}
          </div>
        ))}
      </footer>

      {gameStore.slotHint === "almostFull" ? (
        <div className="game__toast" role="status" aria-live="polite">
          槽位即将满：下一张决定成败
        </div>
      ) : null}

      {gameStore.toast.kind !== "none" ? (
        <div
          className="game__toast game__toast--danger"
          role="status"
          aria-live="polite"
        >
          {gameStore.toast.text}
        </div>
      ) : null}

      {gameStore.flys.map((f) => (
        <div
          key={f.id}
          className="game__fly"
          style={{
            transform: `translate(${f.x}px, ${f.y}px) scale(${f.scale})`,
            opacity: f.opacity,
          }}
        >
          {f.icon}
        </div>
      ))}
    </div>
  );
}

const App = observer(AppImpl);
export default App;
