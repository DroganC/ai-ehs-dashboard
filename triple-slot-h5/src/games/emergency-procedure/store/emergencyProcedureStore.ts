import { makeAutoObservable, runInAction } from "mobx";
import { EMERGENCY_LEVEL_COUNT, EMERGENCY_LEVEL_PATHS } from "../config";
import type { CardDef, EmergencyLevelConfig, SlotDef } from "../model/types";

function shuffleArray<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isPlaySlot(slots: SlotDef[], i: number): boolean {
  return slots[i]?.kind === "play";
}

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

export type EpPhase = "loading" | "playing" | "levelCleared" | "allCleared";

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

  get totalLevels() {
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

  get poolCount() {
    return this.pool.length;
  }

  /** 需玩家自行放置的槽位数。 */
  get playSlotCount() {
    if (!this.level) return 0;
    return this.level.slots.filter((s) => s.kind === "play").length;
  }

  get playSlotsFilled() {
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
  get hintSlotIndex() {
    if (!this.level || this.level.hintEnabled === false) return null;
    for (let i = 0; i < this.level.slots.length; i += 1) {
      if (isPlaySlot(this.level.slots, i) && this.slotPlacements[i] === null) return i;
    }
    return null;
  }

  get levelProgressLabel() {
    return `${this.currentLevelIndex + 1} / ${this.totalLevels}`;
  }

  get stepProgressLabel() {
    const total = this.playSlotCount;
    if (total === 0) return "0 / 0";
    return `${this.playSlotsFilled} / ${total}`;
  }

  async startSession() {
    runInAction(() => {
      this.currentLevelIndex = 0;
    });
    await this.loadLevelByIndex(0);
  }

  clearToastSoon(ms = 2200) {
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

  private showToast(text: string) {
    this.toastText = text;
    this.clearToastSoon();
  }

  private applyLevel(config: EmergencyLevelConfig) {
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

  async loadLevelByIndex(index: number) {
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

  selectPoolCard(cardId: string) {
    if (this.phase !== "playing" || !this.level) return;
    if (!this.pool.includes(cardId)) return;
    this.selectedPoolCardId = this.selectedPoolCardId === cardId ? null : cardId;
  }

  clearSelection() {
    this.selectedPoolCardId = null;
  }

  /**
   * 将 `cardId` 放入第 `slotIndex` 格；可来自点选+点槽，或拖放带 id。
   */
  attemptPlaceInSlot(slotIndex: number, cardId?: string) {
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

  private checkLevelWin() {
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

  goToNextLevel() {
    if (this.phase !== "levelCleared") return;
    const next = this.currentLevelIndex + 1;
    void this.loadLevelByIndex(next);
  }

  playAgainFromFirst() {
    void this.startSession();
  }
}

export const emergencyProcedureStore = new EmergencyProcedureStore();
