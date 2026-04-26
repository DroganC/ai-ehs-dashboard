/**
 * 应急流程卡片根视图：头栏 / 中部卡区 / 底槽、飞入层、规则与通关层；逻辑在 `emergencyProcedureStore`（MobX）。
 *
 * 子组件职责：
 * - `EpSequencePool` / `EpSupplyGrid`：第 1 / 2 关中部棋盘，仅受控与转发点击
 * - `EpFlyLayer`：飞入时与牌面一致的扑克/物资格绝对定位层
 * - `EpRulesOverlay`：首屏规则
 * 底栏槽位为内联列表（与 store 的 `returnFromSlotIndex` 强相关，避免过度拆分）。
 * 音轨见 `public/games/emergency-procedure/assets/`，`useGameSfxController` 绑定。
 */
import { observer } from "mobx-react-lite";
import { useCallback, useEffect, useRef, useState } from "react";
import { useGameSfxController } from "../hooks/useGameSfxController";
import { EMERGENCY_SFX } from "./audio/paths";
import { EMERGENCY_TOAST_FAIL_ORDER } from "./config";
import { emergencyProcedureStore } from "./store/emergencyProcedureStore";
import { EpFlyLayer } from "./ui/EpFlyLayer";
import { EpRulesOverlay } from "./ui/EpRulesOverlay";
import { EpSequencePool } from "./ui/EpSequencePool";
import { EpSupplyGrid } from "./ui/EpSupplyGrid";
import { queryEpSlotByIndex } from "./utils/epSlotDom";
import { EpPokerCardStatic, EpSupplyCardStatic } from "./ui/epCardStatic";
import "./emergency-procedure-view.less";

export default observer(function EmergencyProcedureView() {
  const store = emergencyProcedureStore;
  const [showRules, setShowRules] = useState(true);
  const level = store.level;
  const phase = store.phase;

  const { setBgmRunning, playClick, playWin, playLose } = useGameSfxController(
    EMERGENCY_SFX,
  );
  const prevPhase = useRef(phase);
  const prevFailToast = useRef<string | null>(null);
  /** 卡槽退牌过渡：先播 CSS 再调 `returnFromSlotIndex` */
  const [returningSlotIndex, setReturningSlotIndex] = useState<number | null>(
    null,
  );
  const slotReturnTimerRef = useRef<number | null>(null);
  const slotReturnDurationsMs = useRef(280);

  const clearSlotReturnTimer = useCallback(() => {
    if (slotReturnTimerRef.current !== null) {
      window.clearTimeout(slotReturnTimerRef.current);
      slotReturnTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      slotReturnDurationsMs.current = 60;
    }
  }, []);

  useEffect(() => {
    void store.startSession();
    return () => {
      clearSlotReturnTimer();
      store.dispose();
    };
  }, [store, clearSlotReturnTimer]);

  useEffect(() => {
    setBgmRunning(phase === "playing" && !showRules);
  }, [setBgmRunning, phase, showRules]);

  useEffect(() => {
    if (
      prevPhase.current === "playing" &&
      (phase === "levelCleared" || phase === "allCleared")
    ) {
      playWin();
    }
    prevPhase.current = phase;
  }, [phase, playWin]);

  useEffect(() => {
    const t = store.toastText;
    if (t === EMERGENCY_TOAST_FAIL_ORDER && prevFailToast.current !== t) {
      playLose();
    }
    prevFailToast.current = t;
  }, [store.toastText, playLose]);

  const canInteract = phase === "playing" && !showRules;
  const slotInteractionLocked = returningSlotIndex !== null;

  function handleSlotReturnClick(slotIndex: number): void {
    if (!canInteract || slotInteractionLocked) return;
    playClick();
    setReturningSlotIndex(slotIndex);
    clearSlotReturnTimer();
    const ms = slotReturnDurationsMs.current;
    slotReturnTimerRef.current = window.setTimeout(() => {
      slotReturnTimerRef.current = null;
      store.returnFromSlotIndex(slotIndex);
      setReturningSlotIndex(null);
    }, ms);
  }

  if (phase === "loading") {
    if (store.loadError) {
      return (
        <div className="ep ep--center">
          <p className="ep__error">加载失败：{store.loadError}</p>
          <button type="button" className="ep-btn" onClick={() => void store.startSession()}>
            重试
          </button>
        </div>
      );
    }
    return (
      <div className="ep ep--center">
        <p className="ep__loading">加载中…</p>
      </div>
    );
  }

  if (!level) {
    return null;
  }

  const { mode: levelMode } = level;
  const gridW = level.grid?.cols ?? 3;
  const gridH = level.grid?.rows ?? 3;
  const gridLen = gridH * gridW;

  return (
    <div className="ep">
      <header className="ep__header" aria-label="信息栏">
        <h1 className="ep__title">
          <span className="ep__title-icon" aria-hidden>
            🔥
          </span>
          {level.title}
        </h1>
        <div className="ep__meta">
          <span className="ep__badge" aria-live="polite">
            {levelMode === "sequence" ? `待点 ${store.poolCount} 张` : `格内 ${store.gridCells.filter(Boolean).length} 件`}
          </span>
          <span className="ep__badge ep__badge--sub">{store.levelProgressLabel}</span>
        </div>
      </header>

      <main className="ep__main" aria-label="操作区">
        {levelMode === "sequence" ? (
          <EpSequencePool
            cardIds={store.pool}
            getCard={(id) => store.cardMap.get(id)}
            canInteract={canInteract}
            onPickFromPool={(id) => {
              playClick();
              const el = document.querySelector<HTMLElement>(`[data-ep-pool-id="${id}"]`);
              if (!el) return;
              void store.clickFromPool(
                id,
                el.getBoundingClientRect(),
                (i) => queryEpSlotByIndex(i),
              );
            }}
          />
        ) : (
          <EpSupplyGrid
            gridW={gridW}
            gridH={gridH}
            gridCellCount={gridLen}
            gridCells={store.gridCells}
            getCard={(id) => store.cardMap.get(id)}
            canInteract={canInteract}
            onPickFromCell={(cellIndex) => {
              playClick();
              const el = document.querySelector<HTMLElement>(
                `[data-ep-cell="${String(cellIndex)}"]`,
              );
              if (!el) return;
              void store.clickFromGrid(
                cellIndex,
                el.getBoundingClientRect(),
                (i) => queryEpSlotByIndex(i),
              );
            }}
          />
        )}
      </main>

      <footer className="ep__footer" aria-label="卡槽">
        <div className="ep__drop-head">
          <span className="ep__drop-step">{store.stepProgressLabel}</span>
        </div>
        <div className="ep__slots" role="list">
          {Array.from({ length: store.slotCount }).map((_, i) => {
            const placed = store.slotPlacements[i];
            const card = placed ? store.cardMap.get(placed) : undefined;
            const isFilled = placed !== null;

            return (
              <div
                key={`slot-${String(i)}`}
                className="ep-slot ep__slot"
                role="listitem"
              >
                <span className="ep-slot__idx">{i + 1}</span>
                <button
                  type="button"
                  className={`ep-slot__inner${
                    isFilled ? " ep-slot__inner--filled" : " ep-slot__inner--empty"
                  }${returningSlotIndex === i ? " ep-slot__inner--returning" : ""}`}
                  data-ep-slot-idx={String(i)}
                  disabled={!isFilled || !canInteract || slotInteractionLocked}
                  aria-label={
                    card
                      ? `槽位 ${String(i + 1)}，${card.label}，点击取回至棋盘上`
                      : `空卡槽 ${String(i + 1)}`
                  }
                  onClick={() => {
                    if (!isFilled) return;
                    handleSlotReturnClick(i);
                  }}
                >
                  {card && isFilled ? (
                    levelMode === "sequence" ? (
                      <EpPokerCardStatic card={card} />
                    ) : (
                      <EpSupplyCardStatic card={card} showImagePlaceholder />
                    )
                  ) : (
                    <span className="ep-slot__placeholder" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </footer>

      <EpFlyLayer items={store.flys} />

      {store.toastText ? (
        <div className="ep-toast" role="status">
          {store.toastText}
        </div>
      ) : null}

      {showRules ? (
        <EpRulesOverlay
          onStart={() => {
            setShowRules(false);
          }}
        />
      ) : null}

      {phase === "levelCleared" ? (
        <div
          className="ep-overlay"
          role="dialog"
          aria-modal
          aria-labelledby="ep-win-title"
        >
          <div className="ep-overlay__card">
            <h2 id="ep-win-title" className="ep-overlay__title">
              Great! 恭喜通关
            </h2>
            <p className="ep-overlay__desc">准备进入第二关，继续选择正确物资与顺序。</p>
            <button
              type="button"
              className="ep-btn ep-btn--primary"
              onClick={() => store.goToNextLevel()}
            >
              进入下一关
            </button>
          </div>
        </div>
      ) : null}

      {phase === "allCleared" ? (
        <div
          className="ep-overlay"
          role="dialog"
          aria-modal
          aria-labelledby="ep-all-title"
        >
          <div className="ep-overlay__card">
            <h2 id="ep-all-title" className="ep-overlay__title">
              恭喜通关
            </h2>
            <p className="ep-overlay__desc">你已完成本游戏全部关卡。</p>
            <button
              type="button"
              className="ep-btn ep-btn--primary"
              onClick={() => {
                setShowRules(true);
                store.playAgainFromFirst();
              }}
            >
              再玩一次
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
});
