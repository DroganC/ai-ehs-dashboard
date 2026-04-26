import { makeAutoObservable, runInAction } from "mobx";
import { EMERGENCY_LEVEL_COUNT, EMERGENCY_LEVEL_PATHS } from "../config";
import {
  EP_FLY_ARC_PX,
  EP_FLY_DURATION_MS,
  EP_FLY_HALF_H,
  EP_FLY_HALF_W,
} from "../model/animation";
import { epEaseInOutCubic } from "../model/easing";
import type { CardDef, EmergencyLevelConfig, EmergencyLevelMode } from "../model/types";

function shuffleArray<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 关卡 JSON 校验。
 */
function validateConfig(raw: unknown): raw is EmergencyLevelConfig {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.title !== "string") return false;
  if (o.mode !== "sequence" && o.mode !== "grid") return false;
  if (!Array.isArray(o.cards) || !Array.isArray(o.correctOrder)) return false;
  const co = o.correctOrder as string[];
  if (co.length === 0) return false;
  const ids = new Set((o.cards as { id: string }[]).map((c) => c.id));
  for (const id of co) {
    if (!ids.has(id)) return false;
  }
  if (o.mode === "grid") {
    if (!o.grid || typeof o.grid !== "object") return false;
    const g = o.grid as { rows: number; cols: number };
    if (g.rows * g.cols === 0) return false;
    if (!Array.isArray(o.gridOrder)) return false;
    const go = o.gridOrder as string[];
    if (go.length !== g.rows * g.cols) return false;
    for (const id of go) {
      if (!ids.has(id)) return false;
    }
    if (co.length !== 5) return false;
  }
  if (o.mode === "sequence" && co.length !== 5) return false;
  return true;
}

export type EpPhase = "loading" | "playing" | "levelCleared" | "allCleared";

/** 与 `ui/EpFlyLayer` 单条项一致。 */
export type EpFly = {
  id: string;
  text: string;
  x: number;
  y: number;
  scale: number;
  opacity: number;
};

export class EmergencyProcedureStore {
  phase: EpPhase = "loading";
  loadError: string | null = null;
  currentLevelIndex = 0;
  level: EmergencyLevelConfig | null = null;
  levelMode: EmergencyLevelMode | "none" = "none";

  /** 第一关：待选区牌 id（打乱的 `correctOrder` 全集）。 */
  pool: string[] = [];
  /**
   * 第二关：3×3 行优先，与 `gridOrder` 一一对应；`null` 表示该格已取走至槽内过程或仍为空位。
   */
  /** 第二关 3×3；已取入槽的格为 `null`。 */
  gridCells: Array<string | null> = [];
  /** 第二关首局面快照，用于「失败重排」时洗乱 9 格。 */
  private initialGridOrder: string[] = [];

  /** 5 个槽，与 `correctOrder` 等长。 */
  slotPlacements: (string | null)[] = [];
  /**
   * 从物资格取走前记录「牌 id → 格下标」，回退时物归原格。
   */
  private sourceCellByCardId = new Map<string, number>();

  flys: EpFly[] = [];
  private flyId = 0;
  /** 飞入中禁止连点。 */
  flightCount = 0;

  toastText: string | null = null;
  private toastTimer: number | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get totalLevels(): number {
    return EMERGENCY_LEVEL_COUNT;
  }

  get cardMap(): Map<string, CardDef> {
    const m = new Map<string, CardDef>();
    if (!this.level) return m;
    for (const c of this.level.cards) {
      m.set(c.id, c);
    }
    return m;
  }

  get poolCount(): number {
    return this.pool.length;
  }

  get slotCount(): number {
    return this.level?.correctOrder.length ?? 0;
  }

  get playSlotsFilled(): number {
    return this.slotPlacements.filter((s) => s !== null).length;
  }

  get hintSlotIndex(): number | null {
    if (!this.level || this.level.hintEnabled === false) return null;
    const i = this.slotPlacements.findIndex((s) => s === null);
    return i === -1 ? null : i;
  }

  get levelProgressLabel(): string {
    return `${this.currentLevelIndex + 1} / ${this.totalLevels}`;
  }

  get stepProgressLabel(): string {
    const t = this.slotCount;
    if (t === 0) return "0 / 0";
    return `${this.playSlotsFilled} / ${t}`;
  }

  async startSession(): Promise<void> {
    runInAction(() => {
      this.currentLevelIndex = 0;
    });
    await this.loadLevelByIndex(0);
  }

  clearToastSoon(ms: number = 2400): void {
    if (this.toastTimer !== null) {
      window.clearTimeout(this.toastTimer);
    }
    this.toastTimer = window.setTimeout(() => {
      runInAction(() => {
        this.toastText = null;
        this.toastTimer = null;
      });
    }, ms);
  }

  private showToast(text: string): void {
    this.toastText = text;
    this.clearToastSoon();
  }

  private applyLevel(config: EmergencyLevelConfig): void {
    this.level = config;
    this.levelMode = config.mode;
    this.sourceCellByCardId.clear();
    const n = config.correctOrder.length;
    this.slotPlacements = Array.from({ length: n }, () => null);
    this.flys = [];
    this.flightCount = 0;

    if (config.mode === "sequence") {
      this.gridCells = [];
      this.initialGridOrder = [];
      this.pool = shuffleArray([...config.correctOrder]);
    } else {
      const order = config.gridOrder!;
      this.initialGridOrder = [...order];
      this.gridCells = shuffleArray([...order]) as Array<string | null>;
    }
  }

  async loadLevelByIndex(index: number): Promise<void> {
    if (index < 0 || index >= EMERGENCY_LEVEL_PATHS.length) {
      runInAction(() => {
        this.loadError = "无效关卡";
        this.phase = "loading";
      });
      return;
    }
    const path = EMERGENCY_LEVEL_PATHS[index]!;
    runInAction(() => {
      this.phase = "loading";
      this.loadError = null;
    });
    try {
      const res = await fetch(path, { cache: "no-store" });
      if (!res.ok) throw new Error(`无法加载：${res.status}`);
      const data: unknown = await res.json();
      if (!validateConfig(data)) {
        throw new Error("关卡数据格式错误");
      }
      runInAction(() => {
        this.currentLevelIndex = index;
        this.applyLevel(data);
        this.phase = "playing";
        this.toastText = null;
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "加载失败";
      runInAction(() => {
        this.loadError = msg;
        this.level = null;
        this.levelMode = "none";
        this.phase = "loading";
      });
    }
  }

  private getNextEmptySlotIndex(): number {
    const i = this.slotPlacements.findIndex((s) => s === null);
    return i;
  }

  private async animateFly(
    text: string,
    from: DOMRect,
    to: DOMRect,
  ): Promise<void> {
    const id = `fly-${++this.flyId}`;
    const startX = from.left + from.width / 2;
    const startY = from.top + from.height / 2;
    const endX = to.left + to.width / 2;
    const endY = to.top + to.height / 2;
    const duration = EP_FLY_DURATION_MS;
    const start = performance.now();

    await new Promise<void>((resolve) => {
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const k = epEaseInOutCubic(t);
        const x = startX + (endX - startX) * k;
        const arc = Math.sin(Math.PI * k) * EP_FLY_ARC_PX;
        const y = startY + (endY - startY) * k - arc;
        runInAction(() => {
          this.flys = [
            {
              id,
              text,
              x: x - EP_FLY_HALF_W,
              y: y - EP_FLY_HALF_H,
              scale: 1 - 0.08 * t,
              opacity: 1,
            },
          ];
        });
        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          runInAction(() => {
            this.flys = [];
          });
          resolve();
        }
      };
      requestAnimationFrame(step);
    });
  }

  /**
   * 第一关：点击池中的一张，飞入**下一个**空槽；满 5 张时整体验证。
   */
  async clickFromPool(
    cardId: string,
    fromRect: DOMRect,
    getTargetSlot: (index: number) => HTMLElement | null,
  ): Promise<void> {
    if (this.phase !== "playing" || !this.level || this.levelMode !== "sequence")
      return;
    if (this.flightCount > 0) return;
    if (!this.pool.includes(cardId)) return;
    const k = this.getNextEmptySlotIndex();
    if (k < 0) return;

    const el = getTargetSlot(k);
    if (!el) return;
    const label = this.cardMap.get(cardId)?.label ?? "";

    this.flightCount += 1;
    runInAction(() => {
      this.pool = this.pool.filter((c) => c !== cardId);
    });

    try {
      await this.animateFly(label, fromRect, el.getBoundingClientRect());
    } finally {
      this.flightCount -= 1;
    }

    runInAction(() => {
      this.slotPlacements[k] = cardId;
    });
    this.tryFinalizeOrFail();
  }

  /**
   * 第二关：点击 3×3 某格，飞入**下一个**空槽。
   */
  async clickFromGrid(
    cellIndex: number,
    fromRect: DOMRect,
    getTargetSlot: (index: number) => HTMLElement | null,
  ): Promise<void> {
    if (this.phase !== "playing" || !this.level || this.levelMode !== "grid") return;
    if (this.flightCount > 0) return;
    const cardId = this.gridCells[cellIndex];
    if (cardId == null) return;
    const k = this.getNextEmptySlotIndex();
    if (k < 0) return;
    const el = getTargetSlot(k);
    if (!el) return;
    const label = this.cardMap.get(cardId)?.label ?? "";

    this.flightCount += 1;
    runInAction(() => {
      this.gridCells[cellIndex] = null;
      this.sourceCellByCardId.set(cardId, cellIndex);
    });
    try {
      await this.animateFly(label, fromRect, el.getBoundingClientRect());
    } finally {
      this.flightCount -= 1;
    }
    runInAction(() => {
      this.slotPlacements[k] = cardId;
    });
    this.tryFinalizeOrFail();
  }

  /**
   * 从槽位 `fromIndex` 起将已填牌全部退回池/格；用于「点卡槽内回到页面」或撤销后缀。
   */
  returnFromSlotIndex(fromIndex: number): void {
    if (this.phase !== "playing" || !this.level) return;
    if (fromIndex < 0 || fromIndex >= this.slotPlacements.length) return;
    if (this.flightCount > 0) return;
    if (this.slotPlacements[fromIndex] === null) return;

    const ids: string[] = [];
    for (let i = fromIndex; i < this.slotPlacements.length; i += 1) {
      const id = this.slotPlacements[i];
      if (id !== null) ids.push(id);
    }
    if (ids.length === 0) return;

    runInAction(() => {
      for (let i = fromIndex; i < this.slotPlacements.length; i += 1) {
        this.slotPlacements[i] = null;
      }
      for (const id of ids) {
        if (this.levelMode === "sequence") {
          this.pool.push(id);
        } else {
          const cell = this.sourceCellByCardId.get(id);
          if (cell != null) {
            this.gridCells[cell] = id;
            this.sourceCellByCardId.delete(id);
          }
        }
      }
    });
  }

  private tryFinalizeOrFail(): void {
    if (!this.level) return;
    if (this.slotPlacements.some((s) => s === null)) return;
    for (let i = 0; i < this.slotPlacements.length; i += 1) {
      if (this.slotPlacements[i] !== this.level.correctOrder[i]) {
        this.resetRoundAfterWrong();
        return;
      }
    }
    runInAction(() => {
      if (this.currentLevelIndex >= this.totalLevels - 1) {
        this.phase = "allCleared";
      } else {
        this.phase = "levelCleared";
      }
    });
  }

  private resetRoundAfterWrong(): void {
    if (!this.level) return;
    this.showToast("顺序不正确，已归位并重新打乱，请重试。");
    runInAction(() => {
      const n = this.level!.correctOrder.length;
      for (let i = 0; i < n; i += 1) {
        this.slotPlacements[i] = null;
      }
      this.sourceCellByCardId.clear();
      if (this.levelMode === "sequence") {
        this.pool = shuffleArray([...this.level!.correctOrder]);
      } else {
        this.gridCells = shuffleArray([...this.initialGridOrder]) as Array<string | null>;
      }
    });
  }

  goToNextLevel(): void {
    if (this.phase !== "levelCleared") return;
    const next = this.currentLevelIndex + 1;
    void this.loadLevelByIndex(next);
  }

  playAgainFromFirst(): void {
    void this.startSession();
  }
}

export const emergencyProcedureStore: EmergencyProcedureStore = new EmergencyProcedureStore();
