/**
 * 应急流程卡片根视图：头栏 / 中部卡区 / 底槽、飞入层、规则与通关层；逻辑在 `emergencyProcedureStore`（MobX）。
 */
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { emergencyProcedureStore } from "./store/emergencyProcedureStore";
import { EpCardFace } from "./ui/EpCardFace";
import { EpFlyLayer } from "./ui/EpFlyLayer";
import { EpRulesOverlay } from "./ui/EpRulesOverlay";
import "./emergency-procedure-view.less";

function querySlotElement(index: number): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-ep-slot-idx="${String(index)}"]`);
}

export default observer(function EmergencyProcedureView() {
  const store = emergencyProcedureStore;
  const [showRules, setShowRules] = useState(true);

  useEffect(() => {
    void store.startSession();
  }, [store]);

  const level = store.level;
  const phase = store.phase;
  const canInteract = phase === "playing" && !showRules;

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
          <section className="ep__panel ep__board ep__board--seq" aria-label="流程卡片">
            <h2 className="ep__board-title">按正确顺序点击，飞入下方卡槽</h2>
            <div className="ep__pool--seq">
              {store.pool.map((id) => {
                const card = store.cardMap.get(id);
                if (!card) return null;
                return (
                  <div key={id} className="ep__pool-item" data-ep-pool-id={id}>
                    <EpCardFace
                      card={card}
                      styleVariant="poker"
                      selected={false}
                      interactionDisabled={!canInteract || store.flightCount > 0}
                      onSelect={() => {
                        const el = document.querySelector<HTMLElement>(`[data-ep-pool-id="${id}"]`);
                        if (!el) return;
                        void store.clickFromPool(id, el.getBoundingClientRect(), (i) => querySlotElement(i));
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="ep__panel ep__board ep__board--grid" aria-label="消防物资格">
            <h2 className="ep__board-title">3×3 选择物资，与第一关步骤顺序一一对应</h2>
            <div
              className="ep__grid-9"
              style={{
                gridTemplateColumns: `repeat(${String(gridW)}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${String(gridH)}, minmax(0, 1fr))`,
              }}
            >
              {Array.from({ length: gridLen }).map((_, cellIndex) => {
                const id = store.gridCells[cellIndex];
                const card = id ? store.cardMap.get(id) : undefined;
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
                  <div key={id} className="ep__grid-cell" data-ep-cell={String(cellIndex)}>
                    <div className="ep__grid-cell-inner" data-ep-pool-id={id}>
                      <EpCardFace
                        card={card}
                        styleVariant="supply"
                        showImagePlaceholder
                        interactionDisabled={!canInteract || store.flightCount > 0}
                        onSelect={() => {
                          const el = document.querySelector<HTMLElement>(
                            `[data-ep-cell="${String(cellIndex)}"]`,
                          );
                          if (!el) return;
                          void store.clickFromGrid(
                            cellIndex,
                            el.getBoundingClientRect(),
                            (i) => querySlotElement(i),
                          );
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>

      <footer className="ep__footer" aria-label="卡槽与提示">
        <div className="ep__drop-head">
          <span className="ep__drop-hint">槽位 1~5 对应上一步场景顺序</span>
          <span className="ep__drop-step">{store.stepProgressLabel}</span>
        </div>
        <div className="ep__slots" role="list">
          {Array.from({ length: store.slotCount }).map((_, i) => {
            const placed = store.slotPlacements[i];
            const card = placed ? store.cardMap.get(placed) : undefined;
            const isHint =
              (level.hintEnabled !== false) &&
              placed === null &&
              store.hintSlotIndex === i;
            const isFilled = placed !== null;

            return (
              <div
                key={`slot-${String(i)}`}
                className={`ep-slot${isHint ? " ep-slot--hint" : ""} ep__slot`}
                role="listitem"
              >
                <button
                  type="button"
                  className={`ep-slot__inner${
                    isFilled ? " ep-slot__inner--filled" : " ep-slot__inner--empty"
                  }`}
                  data-ep-slot-idx={String(i)}
                  disabled={!isFilled}
                  onClick={() => {
                    if (!canInteract) return;
                    if (isFilled) store.returnFromSlotIndex(i);
                  }}
                >
                  <span className="ep-slot__num">{i + 1}</span>
                  {card ? (
                    <span
                      className={`ep-slot__text ep-slot__text--${card.accent ?? "default"}`}
                    >
                      {card.label}
                    </span>
                  ) : (
                    <span className="ep-slot__placeholder" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
        {level.bottomTip ? <p className="ep__tip">⚠ {level.bottomTip}</p> : null}
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
