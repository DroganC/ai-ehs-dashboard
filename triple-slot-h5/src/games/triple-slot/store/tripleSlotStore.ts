import { makeAutoObservable, runInAction } from "mobx";
import type { LevelConfig } from "../model/level";
import { buildTilesFromLevel } from "../model/level";
import { TRIPLE_SLOT_DEFAULT_LEVEL } from "../config";
import {
  FLY_ARC_PX,
  FLY_DURATION_MS,
  FLY_HALF_H,
  FLY_HALF_W,
  SLOT_FEEDBACK_MS,
} from "../model/animation";
import { FAIL_LIMIT, SLOT_CAPACITY, TOTAL_TILES } from "../model/constants";
import { easeInOutCubic } from "../model/easing";
import type { Pick, Tile } from "../model/types";

type Fly = {
  id: string;
  icon: string;
  x: number;
  y: number;
  scale: number;
  opacity: number;
};
type SlotAnim = "none" | "success" | "fail";
type SlotHint = "none" | "almostFull";
type ToastKind = "none" | "failRollback";

export class TripleSlotStore {
  level: LevelConfig | null = null;
  tiles: Tile[] = [];
  slot: Pick[] = [];
  clearedCount = 0;
  failCount = 0;
  /**
   * 已点选、正在飞入但尚未入 slot 的笔数。与 pickTile 判满：slot 占用 + 本计数 >= SLOT 即不可再点。
   */
  pendingFlights = 0;
  slotAnim: SlotAnim = "none";
  slotHint: SlotHint = "none";
  toast: { kind: ToastKind; text: string } = { kind: "none", text: "" };
  flys: Fly[] = [];
  private flyId = 0;
  private slotAnimTimer: number | null = null;
  private hintTimer: number | null = null;
  private toastTimer: number | null = null;
  /** 为每次新选牌发单调序号，与入槽提交顺序一致（先点先进槽，动画先后无关）。 */
  private nextPickSeq = 0;
  /** 下一个必须提交的 seq；小于它的已在 buf 中等待。 */
  private nextCommitSeq = 0;
  private commitBuffer = new Map<number, Tile>();

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get levelName() {
    return this.level?.name ?? "01";
  }

  get failLimit() {
    return typeof this.level?.failLimit === "number"
      ? this.level.failLimit
      : FAIL_LIMIT;
  }

  get phase(): "playing" | "win" | "lose" {
    if (this.clearedCount >= TOTAL_TILES) return "win";
    if (this.failCount >= this.failLimit) return "lose";
    return "playing";
  }

  async loadLevel(path = TRIPLE_SLOT_DEFAULT_LEVEL) {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load level: ${path}`);
    const level = (await res.json()) as LevelConfig;
    this.reset(level);
  }

  reset(level?: LevelConfig) {
    if (level) this.level = level;
    if (!this.level) throw new Error("Level not loaded");
    this.tiles = buildTilesFromLevel(this.level);
    this.slot = [];
    this.clearedCount = 0;
    this.failCount = 0;
    this.pendingFlights = 0;
    this.nextPickSeq = 0;
    this.nextCommitSeq = 0;
    this.commitBuffer.clear();
    this.slotAnim = "none";
    this.slotHint = "none";
    this.toast = { kind: "none", text: "" };
    this.flys = [];
    if (this.slotAnimTimer !== null) {
      window.clearTimeout(this.slotAnimTimer);
      this.slotAnimTimer = null;
    }
    if (this.hintTimer !== null) {
      window.clearTimeout(this.hintTimer);
      this.hintTimer = null;
    }
    if (this.toastTimer !== null) {
      window.clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
  }

  tileAt(row: number, col: number) {
    return (
      this.tiles.find(
        (t) =>
          t.row === row &&
          t.col === col &&
          (t.state === "onBoard" || t.state === "picking"),
      ) ?? null
    );
  }

  pickTile(tileId: string) {
    if (this.phase !== "playing")
      return { ok: false as const, reason: "ended" as const };
    if (this.slot.length + this.pendingFlights >= SLOT_CAPACITY)
      return { ok: false as const, reason: "slot_full" as const };

    const tile = this.tiles.find((t) => t.id === tileId);
    if (!tile || tile.state !== "onBoard")
      return { ok: false as const, reason: "invalid" as const };

    return { ok: true as const, tile };
  }

  resolveSlot() {
    if (this.slot.length !== SLOT_CAPACITY) return { kind: "noop" as const };

    const [a, b, c] = this.slot;
    const success = a.type === b.type && b.type === c.type;

    if (success) {
      for (const p of this.slot) {
        const tile = this.tiles.find((t) => t.id === p.tileId);
        if (tile) tile.state = "cleared";
      }
      this.slot = [];
      this.clearedCount += SLOT_CAPACITY;
      return { kind: "success" as const };
    }

    for (const p of this.slot) {
      const tile = this.tiles.find((t) => t.id === p.tileId);
      if (tile) tile.state = "onBoard";
    }
    this.slot = [];
    this.failCount += 1;
    return { kind: "fail" as const };
  }

  get slotIcons() {
    return this.slot.map((p) => p.icon);
  }

  private setSlotAnim(anim: SlotAnim, durationMs = 220) {
    this.slotAnim = anim;
    if (this.slotAnimTimer !== null) {
      window.clearTimeout(this.slotAnimTimer);
      this.slotAnimTimer = null;
    }
    if (anim === "none") return;
    this.slotAnimTimer = window.setTimeout(() => {
      runInAction(() => {
        this.slotAnim = "none";
        this.slotAnimTimer = null;
      });
    }, durationMs);
  }

  private setHint(hint: SlotHint, durationMs = 650) {
    this.slotHint = hint;
    if (this.hintTimer !== null) {
      window.clearTimeout(this.hintTimer);
      this.hintTimer = null;
    }
    if (hint === "none") return;
    this.hintTimer = window.setTimeout(() => {
      runInAction(() => {
        this.slotHint = "none";
        this.hintTimer = null;
      });
    }, durationMs);
  }

  private showToast(kind: ToastKind, text: string, durationMs = 950) {
    this.toast = { kind, text };
    if (this.toastTimer !== null) {
      window.clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
    if (kind === "none") return;
    this.toastTimer = window.setTimeout(() => {
      runInAction(() => {
        this.toast = { kind: "none", text: "" };
        this.toastTimer = null;
      });
    }, durationMs);
  }

  /**
   * 按发牌序号依次提交到 slot；允许多段飞入并行完成，但入槽顺序与点击发牌顺序一致。
   */
  private flushSlotCommits() {
    while (this.commitBuffer.has(this.nextCommitSeq)) {
      const tile = this.commitBuffer.get(this.nextCommitSeq)!;
      this.commitBuffer.delete(this.nextCommitSeq);
      this.nextCommitSeq += 1;
      runInAction(() => {
        tile.state = "inSlot";
        this.slot.push({
          tileId: tile.id,
          type: tile.type,
          icon: tile.icon,
          row: tile.row,
          col: tile.col,
        });
        this.pendingFlights -= 1;
      });

      if (this.slot.length === SLOT_CAPACITY) {
        const result = this.resolveSlot();
        if (result.kind === "success") this.setSlotAnim("success", SLOT_FEEDBACK_MS);
        if (result.kind === "fail") {
          this.setSlotAnim("fail", SLOT_FEEDBACK_MS);
          this.showToast("failRollback", "匹配失败：已回滚，失败次数+1");
        }
      } else if (this.slot.length === SLOT_CAPACITY - 1) {
        this.setHint("almostFull");
      }
    }
  }

  private animateFly(icon: string, from: DOMRect, to: DOMRect) {
    const id = String(++this.flyId);
    const startX = from.left + from.width / 2;
    const startY = from.top + from.height / 2;
    const endX = to.left + to.width / 2;
    const endY = to.top + to.height / 2;
    const duration = FLY_DURATION_MS;
    const start = performance.now();

    return new Promise<void>((resolve) => {
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const k = easeInOutCubic(t);
        const x = startX + (endX - startX) * k;
        const arc = Math.sin(Math.PI * k) * FLY_ARC_PX;
        const y = startY + (endY - startY) * k - arc;
        runInAction(() => {
          this.flys = [
            ...this.flys.filter((f) => f.id !== id),
            {
              id,
              icon,
              x: x - FLY_HALF_W,
              y: y - FLY_HALF_H,
              scale: 1 - 0.08 * t,
              opacity: 1,
            },
          ];
        });
        if (t < 1) requestAnimationFrame(step);
        else {
          runInAction(() => {
            this.flys = this.flys.filter((f) => f.id !== id);
          });
          resolve();
        }
      };
      requestAnimationFrame(step);
    });
  }

  /**
   * @param getSlotCell 由视图根据预定槽下标取 DOM，保证飞入目标与入槽顺序一致
   */
  async performPick(
    tileId: string,
    from: DOMRect,
    getSlotCell: (index: number) => HTMLElement | null,
  ) {
    const pickRes = this.pickTile(tileId);
    if (!pickRes.ok) return;

    const targetIdx = this.slot.length + this.pendingFlights;
    const el = getSlotCell(targetIdx);
    if (!el) return;

    const seq = this.nextPickSeq;
    this.nextPickSeq += 1;
    this.pendingFlights += 1;

    runInAction(() => {
      pickRes.tile.state = "picking";
    });

    const to = el.getBoundingClientRect();
    await this.animateFly(pickRes.tile.icon, from, to);

    runInAction(() => {
      this.commitBuffer.set(seq, pickRes.tile);
    });
    this.flushSlotCommits();
  }
}

export const tripleSlotStore = new TripleSlotStore();
