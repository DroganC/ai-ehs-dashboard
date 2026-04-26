import { makeAutoObservable, runInAction } from "mobx";
import { EMERGENCY_LEVEL_COUNT, EMERGENCY_LEVEL_PATHS } from "../config";
import type { CardDef, EmergencyLevelConfig, SlotDef } from "../model/types";

/**
 * 本地 Fisher–Yates 洗牌，不修改入参中除返回副本外的原数组语义（返回新数组）。
 * @param items 需洗牌的 `cardId` 列表
 * @returns 新数组
 */
function shuffleArray<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 第 `i` 格是否由玩家从池中放置。 */
function isPlaySlot(slots: SlotDef[], i: number): boolean {
  return slots[i]?.kind === "play";
}

/**
 * 关卡 JSON 最小校验：`slots` 与 `correctOrder` 等长，且预填位与 `correctOrder` 一致。
 * @param raw `fetch` 后的解析结果
 * @returns 类型保护为 `EmergencyLevelConfig` 时合法
 */
function validateConfig(raw: unknown): raw is EmergencyLevelConfig {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.title !== "string") return false;
  if (!Array.isArray(o.cards) || !Array.isArray(o.slots) || !Array.isArray(o.correctOrder)) return false;
  const slots = o.slots as SlotDef[];
  const order = o.correctOrder as string[];
  if (slots.length !== order.length) return false;
  for (let i = 0; i < slots.length; i += 1) {
    const s = slots[i];
    if (s?.kind === "prefill" && s.cardId !== order[i]) return false;
  }
  return true;
}

/**
 * 流程：加载 / 可玩 / 单关通（待点下一关）/ 全通关。
 * 无持久化，刷新后 `startSession` 自第一关重开。
 */
export type EpPhase = "loading" | "playing" | "levelCleared" | "allCleared";

/**
 * 应急流程卡片：多关、预填、池内洗牌、轻提示、拖放/点放校验（MobX）。
 */
export class EmergencyProcedureStore {
  phase: EpPhase = "loading";
  loadError: string | null = null;
  currentLevelIndex = 0;
  level: EmergencyLevelConfig | null = null;
  /** 待选区：尚未放到槽位的牌 id（仅含 play 步）。 */
  pool: string[] = [];
  /** 每格当前牌 id；play 位未填为 null。 */
  slotPlacements: (string | null)[] = [];
  selectedPoolCardId: string | null = null;
  toastText: string | null = null;
  private toastTimer: number | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get totalLevels(): number {
    return EMERGENCY_LEVEL_COUNT;
  }

  /** 当前关 `id` → 展示定义。 */
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

  /** 需玩家自行放置的槽位数。 */
  get playSlotCount(): number {
    if (!this.level) return 0;
    return this.level.slots.filter((s) => s.kind === "play").length;
  }

  get playSlotsFilled(): number {
    if (!this.level) return 0;
    let n = 0;
    for (let i = 0; i < this.level.slots.length; i += 1) {
      if (isPlaySlot(this.level.slots, i) && this.slotPlacements[i] !== null) n += 1;
    }
    return n;
  }

  /**
   * 轻提示：顺序上第一个空 play 槽（下标由小到大）。
   */
  get hintSlotIndex(): number | null {
    if (!this.level || this.level.hintEnabled === false) return null;
    for (let i = 0; i < this.level.slots.length; i += 1) {
      if (isPlaySlot(this.level.slots, i) && this.slotPlacements[i] === null) return i;
    }
    return null;
  }

  get levelProgressLabel(): string {
    return `${this.currentLevelIndex + 1} / ${this.totalLevels}`;
  }

  get stepProgressLabel(): string {
    const total = this.playSlotCount;
    if (total === 0) return "0 / 0";
    return `${this.playSlotsFilled} / ${total}`;
  }

  /**
   * 新会话：关下标归 0 并拉取 `level-01`。
   */
  async startSession(): Promise<void> {
    runInAction(() => {
      this.currentLevelIndex = 0;
    });
    await this.loadLevelByIndex(0);
  }

  /**
   * Toast 在若干毫秒后自动消失。
   * @param ms 延迟（毫秒），默认 2200
   */
  clearToastSoon(ms: number = 2200): void {
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
    this.slotPlacements = config.slots.map((s, i) => {
      if (s.kind === "prefill") return config.correctOrder[i] ?? s.cardId;
      return null;
    });
    const playIds: string[] = [];
    for (let i = 0; i < config.slots.length; i += 1) {
      if (isPlaySlot(config.slots, i)) playIds.push(config.correctOrder[i]!);
    }
    this.pool = shuffleArray(playIds);
    this.selectedPoolCardId = null;
  }

  /**
   * 按 `EMERGENCY_LEVEL_PATHS` 下标加载一关。失败时 `loadError` + `phase` 为 `loading`。
   * @param index 0 基下标
   */
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
        this.phase = "loading";
      });
    }
  }

  /**
   * 在待选区切换当前选中牌（同牌再点取消）。
   * @param cardId 必须在 `pool` 中
   */
  selectPoolCard(cardId: string): void {
    if (this.phase !== "playing" || !this.level) return;
    if (!this.pool.includes(cardId)) return;
    this.selectedPoolCardId = this.selectedPoolCardId === cardId ? null : cardId;
  }

  /** 仅清除选中，不移除池中牌。 */
  clearSelection(): void {
    this.selectedPoolCardId = null;
  }

  /**
   * 将 `cardId` 放入第 `slotIndex` 格；可来自点选+点槽，或拖放带 id（拖放时传第二参）。
   * @param slotIndex 0 基槽下标
   * @param cardId 未传时取 `selectedPoolCardId`（点槽流程）
   */
  attemptPlaceInSlot(slotIndex: number, cardId?: string): void {
    if (this.phase !== "playing" || !this.level) return;
    const id = cardId ?? this.selectedPoolCardId;
    if (id == null) return;
    if (!this.pool.includes(id)) return;
    if (!isPlaySlot(this.level.slots, slotIndex)) return;
    if (this.slotPlacements[slotIndex] !== null) return;
    if (id !== this.level.correctOrder[slotIndex]!) {
      this.showToast("顺序错误，该牌将留在待选区，请重试。");
      this.clearSelection();
      return;
    }
    runInAction(() => {
      this.pool = this.pool.filter((c) => c !== id);
      this.slotPlacements[slotIndex] = id;
      this.selectedPoolCardId = null;
    });
    this.checkLevelWin();
  }

  private checkLevelWin(): void {
    if (!this.level) return;
    for (let i = 0; i < this.level.slots.length; i += 1) {
      if (isPlaySlot(this.level.slots, i) && this.slotPlacements[i] !== this.level.correctOrder[i]) {
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

  /**
   * 在 `phase === "levelCleared"` 时拉取下一关；最后一关则不应出现在「下一关」路径（全通走 `allCleared`）。
   */
  goToNextLevel(): void {
    if (this.phase !== "levelCleared") return;
    const next = this.currentLevelIndex + 1;
    void this.loadLevelByIndex(next);
  }

  /**
   * 自第一关重开，供「再玩一次」等入口。无本地存档。
   */
  playAgainFromFirst(): void {
    void this.startSession();
  }
}

/** 单例，供 `EmergencyProcedureView` 使用。 */
export const emergencyProcedureStore: EmergencyProcedureStore = new EmergencyProcedureStore();
