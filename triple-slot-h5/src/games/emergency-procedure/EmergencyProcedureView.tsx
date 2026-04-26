import { observer } from "mobx-react-lite";
import { useEffect } from "react";
import { emergencyProcedureStore } from "./store/emergencyProcedureStore";
import { EpCardFace } from "./ui/EpCardFace";
import "./emergency-procedure-view.less";

export default observer(function EmergencyProcedureView() {
  const store = emergencyProcedureStore;

  useEffect(() => {
    void store.startSession();
  }, [store]);

  const level = store.level;
  const phase = store.phase;

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

  return (
    <div className="ep">
      <header className="ep__header">
        <h1 className="ep__title">
          <span className="ep__title-icon" aria-hidden>
            🔥
          </span>
          {level.title}
        </h1>
        <div className="ep__badge">{store.poolCount} 张待放置</div>
      </header>

      <section className="ep__panel ep__pool-panel" aria-label="待选卡片">
        <div className="ep__pool-grid">
          {store.pool.map((id) => {
            const card = store.cardMap.get(id);
            if (!card) return null;
            const selected = store.selectedPoolCardId === id;
            return (
              <EpCardFace
                key={id}
                card={card}
                selected={selected}
                draggable
                onSelect={() => store.selectPoolCard(id)}
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", id);
                  e.dataTransfer.effectAllowed = "move";
                }}
              />
            );
          })}
        </div>
      </section>

      <section className="ep__panel ep__drop-panel" aria-label="按顺序放置">
        <div className="ep__drop-head">
          <span className="ep__drop-hint">按正确顺序放置</span>
          <span className="ep__drop-step">{store.stepProgressLabel}</span>
          <span className="ep__drop-level">{store.levelProgressLabel}</span>
        </div>
        <div className="ep__slots" role="list">
          {level.slots.map((def, i) => {
            const placed = store.slotPlacements[i];
            const isPlay = def.kind === "play";
            const displayId = placed;
            const card = displayId ? store.cardMap.get(displayId) : undefined;
            const isHint =
              level.hintEnabled !== false &&
              isPlay &&
              placed === null &&
              store.hintSlotIndex === i;

            const canClick =
              isPlay &&
              placed === null &&
              phase === "playing" &&
              store.selectedPoolCardId !== null;

            return (
              <div
                key={`slot-${i}`}
                className={`ep-slot${isHint ? " ep-slot--hint" : ""}`}
                role="listitem"
                onDragOver={(e) => {
                  if (!isPlay || placed !== null) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!isPlay || placed !== null) return;
                  const id = e.dataTransfer.getData("text/plain");
                  if (id) store.attemptPlaceInSlot(i, id);
                }}
              >
                <button
                  type="button"
                  className={`ep-slot__inner${placed ? " ep-slot__inner--filled" : " ep-slot__inner--empty"}`}
                  disabled={!canClick}
                  onClick={() => {
                    if (canClick) store.attemptPlaceInSlot(i);
                  }}
                >
                  <span className="ep-slot__num">{i + 1}</span>
                  {card ? (
                    <span
                      className={`ep-slot__text ep-slot__text--${
                        card.accent ?? "default"
                      }`}
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
      </section>

      {store.toastText ? (
        <div className="ep-toast" role="status">
          {store.toastText}
        </div>
      ) : null}

      {phase === "levelCleared" ? (
        <div className="ep-overlay" role="dialog" aria-modal aria-labelledby="ep-win-title">
          <div className="ep-overlay__card">
            <h2 id="ep-win-title" className="ep-overlay__title">
              本关完成
            </h2>
            <p className="ep-overlay__desc">继续挑战下一关。</p>
            <button type="button" className="ep-btn ep-btn--primary" onClick={() => store.goToNextLevel()}>
              下一关
            </button>
          </div>
        </div>
      ) : null}

      {phase === "allCleared" ? (
        <div className="ep-overlay" role="dialog" aria-modal aria-labelledby="ep-all-title">
          <div className="ep-overlay__card">
            <h2 id="ep-all-title" className="ep-overlay__title">
              全部通关
            </h2>
            <p className="ep-overlay__desc">两关已完成。刷新页面将从第一关重新开始。</p>
            <button type="button" className="ep-btn ep-btn--primary" onClick={() => store.playAgainFromFirst()}>
              再玩一次
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
});
