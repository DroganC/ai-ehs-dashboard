import { makeAutoObservable, runInAction } from "mobx";
import type { LevelConfig } from "../model/level";
import { buildTilesFromLevel } from "../model/level";
import { TRIPLE_SLOT_GAME_CONFIG } from "../config";
import {
  FLY_ARC_PX,
  FLY_DURATION_MS,
  FLY_HALF_H,
  FLY_HALF_W,
  SLOT_FEEDBACK_MS,
} from "../model/animation";
import {
  FAIL_LIMIT,
  MILESTONE_GROUP_COUNT,
  SLOT_CAPACITY,
  TOTAL_TILES,
} from "../model/constants";
import { easeInOutCubic } from "../model/easing";
import type { FlyLayerItem, Pick, Tile } from "../model/types";

type SlotAnim = "none" | "success" | "fail";
type SlotHint = "none" | "almostFull";
type ToastKind = "none" | "failRollback";

/** 点选棋盘上的一张牌时 `pickTile` 的联合结果。 */
export type PickTileResult =
  | { ok: true; tile: Tile }
  | { ok: false; reason: "ended" | "slot_full" | "invalid" };

/** 槽内满 3 张时 `resolveSlot` 的判定结果。 */
export type ResolveSlotResult =
  | { kind: "noop" }
  | { kind: "success" }
  | { kind: "fail" };

/**
 * 三消槽位局内状态与动画调度（MobX）。棋盘 + 下槽 + 飞层坐标均在 store 内维护，视图只负责取 DOM 与展示。
 * 不 import 任何 React 组件；`performPick` 通过回调向视图要槽位 `HTMLElement` 以测量落点。
 */
export class TripleSlotStore {
  level: LevelConfig | null = null;
  tiles: Tile[] = [];
  slot: Pick[] = [];
  clearedCount = 0;
  failCount = 0;
  /**
   * 刚完成第几组三消时弹出秘籍层（1..MILESTONE_GROUP_COUNT）；`null` 表示无待处理弹窗。
   * 与 `TripleSlotMilestoneOverlay` 绑定，点「继续游戏」后 `dismissMilestone` 清空。
   */
  pendingMilestoneGroup: number | null = null;
  /**
   * 已点选、正在飞入但尚未入 slot 的笔数。与 pickTile 判满：slot 占用 + 本计数 >= SLOT 即不可再点。
   */
  pendingFlights = 0;
  slotAnim: SlotAnim = "none";
  slotHint: SlotHint = "none";
  toast: { kind: ToastKind; text: string } = { kind: "none", text: "" };
  flys: FlyLayerItem[] = [];
  private flyId = 0;
  private slotAnimTimer: number | null = null;
  private hintTimer: number | null = null;
  private toastTimer: number | null = null;
  /**
   * 自增「动画世代」：在 `reset` / `dispose` 时递增，使进行中的 `requestAnimationFrame` 飞入在下一帧前退出，
   * 避免路由卸载后仍向 MobX 写坐标。
   */
  private animEpoch = 0;
  /** 为每次新选牌发单调序号，与入槽提交顺序一致（先点先进槽，动画先后无关）。 */
  private nextPickSeq = 0;
  /** 下一个必须提交的 seq；小于它的已在 buf 中等待。 */
  private nextCommitSeq = 0;
  private commitBuffer = new Map<number, Tile>();

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  private bumpAnimEpoch(): void {
    this.animEpoch += 1;
  }

  /** 本关允许的最大失败回滚次数（来自局配置，缺省为常量） */
  get failLimit(): number {
    return typeof this.level?.failLimit === "number"
      ? this.level.failLimit
      : FAIL_LIMIT;
  }

  /** 进程：进行中 / 胜利 / 失败 */
  get phase(): "playing" | "win" | "lose" {
    if (this.clearedCount >= TOTAL_TILES) return "win";
    if (this.failCount >= this.failLimit) return "lose";
    return "playing";
  }

  /**
   * 游戏页卸载或切换路由时调用：注销槽位动效定时器、废掉未结束的飞入 `rAF`，避免卸载后改写字段。
   * 不重置整局；再次进入时由视图 `reset()` 开局。
   */
  dispose(): void {
    this.bumpAnimEpoch();
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
    runInAction(() => {
      this.flys = [];
    });
  }

  /**
   * 开局或重开。未传入配置时使用 `TRIPLE_SLOT_GAME_CONFIG`（单局、无多关）。
   */
  reset(level?: LevelConfig): void {
    this.bumpAnimEpoch();
    this.level = level ?? TRIPLE_SLOT_GAME_CONFIG;
    this.tiles = buildTilesFromLevel(this.level);
    this.slot = [];
    this.clearedCount = 0;
    this.failCount = 0;
    this.pendingMilestoneGroup = null;
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

  /**
   * 用于棋盘渲染：返回指定格上仍处于「在盘面或飞入中」的牌，否则 `null`。
   */
  tileAt(row: number, col: number): Tile | null {
    return (
      this.tiles.find(
        (t) =>
          t.row === row &&
          t.col === col &&
          (t.state === "onBoard" || t.state === "picking"),
      ) ?? null
    );
  }

  /**
   * 尝试从棋盘取走一张将飞入槽位的牌（不启动动画）。
   * @param tileId 棋子 id
   */
  pickTile(tileId: string): PickTileResult {
    if (this.phase !== "playing")
      return { ok: false as const, reason: "ended" as const };
    if (this.slot.length + this.pendingFlights >= SLOT_CAPACITY)
      return { ok: false as const, reason: "slot_full" as const };

    const tile = this.tiles.find((t) => t.id === tileId);
    if (!tile || tile.state !== "onBoard")
      return { ok: false as const, reason: "invalid" as const };

    return { ok: true as const, tile };
  }

  /**
   * 当槽内已有 3 张时做三消判定；不足 3 张则空操作。
   * 成功则标记为 `cleared` 并清空槽；失败则三张飞回盘面并计失败一次。
   */
  resolveSlot(): ResolveSlotResult {
    if (this.slot.length !== SLOT_CAPACITY) return { kind: "noop" as const };

    const [a, b, c] = this.slot;
    const success = a.type === b.type && b.type === c.type;

    if (success) {
      runInAction(() => {
        for (const p of this.slot) {
          const tile = this.tiles.find((t) => t.id === p.tileId);
          if (tile) tile.state = "cleared";
        }
        this.slot = [];
        this.clearedCount += SLOT_CAPACITY;
        const g = this.clearedCount / SLOT_CAPACITY;
        if (g >= 1 && g <= MILESTONE_GROUP_COUNT) {
          this.pendingMilestoneGroup = g;
        }
      });
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

  get slotIcons(): string[] {
    return this.slot.map((p) => p.icon);
  }

  /** 关闭「第 X 组密集」秘籍弹层；通关时关闭最后一组后再展示结算。 */
  dismissMilestone(): void {
    runInAction(() => {
      this.pendingMilestoneGroup = null;
    });
  }

  private setSlotAnim(anim: SlotAnim, durationMs: number = 220): void {
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

  private setHint(hint: SlotHint, durationMs: number = 650): void {
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

  private showToast(kind: ToastKind, text: string, durationMs: number = 950): void {
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
  private flushSlotCommits(): void {
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

  private animateFly(
    icon: string,
    from: DOMRect,
    to: DOMRect,
    animEpoch: number,
  ): Promise<void> {
    const id = String(++this.flyId);
    const startX = from.left + from.width / 2;
    const startY = from.top + from.height / 2;
    const endX = to.left + to.width / 2;
    const endY = to.top + to.height / 2;
    const duration = FLY_DURATION_MS;
    const start = performance.now();

    return new Promise<void>((resolve) => {
      const step = (now: number) => {
        if (this.animEpoch !== animEpoch) {
          runInAction(() => {
            this.flys = this.flys.filter((f) => f.id !== id);
          });
          resolve();
          return;
        }
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
          if (this.animEpoch !== animEpoch) {
            runInAction(() => {
              this.flys = this.flys.filter((f) => f.id !== id);
            });
            resolve();
            return;
          }
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
   * 从棋盘点击到入槽的完整流程：飞行动画、按序提交到槽、并可能触发三消。
   * @param tileId 被点选的棋子 id
   * @param from 起点包围盒（按钮 `getBoundingClientRect()`）
   * @param getSlotCell 由视图按「当前飞入将占据的槽下标」返回对应 DOM 元素
   */
  async performPick(
    tileId: string,
    from: DOMRect,
    getSlotCell: (index: number) => HTMLElement | null,
  ): Promise<void> {
    const pickRes = this.pickTile(tileId);
    if (!pickRes.ok) return;

    const targetIdx = this.slot.length + this.pendingFlights;
    const el = getSlotCell(targetIdx);
    if (!el) return;

    const pickEpoch = this.animEpoch;
    const seq = this.nextPickSeq;
    this.nextPickSeq += 1;
    this.pendingFlights += 1;

    runInAction(() => {
      pickRes.tile.state = "picking";
    });

    const to = el.getBoundingClientRect();
    await this.animateFly(pickRes.tile.icon, from, to, pickEpoch);

    if (this.animEpoch !== pickEpoch) {
      runInAction(() => {
        if (pickRes.tile.state === "picking") pickRes.tile.state = "onBoard";
        this.pendingFlights -= 1;
        this.nextPickSeq -= 1;
      });
      return;
    }

    runInAction(() => {
      this.commitBuffer.set(seq, pickRes.tile);
    });
    this.flushSlotCommits();
  }
}

/** 单例：供 `TripleSlotView` 与测试共享同一局内状态。 */
export const tripleSlotStore: TripleSlotStore = new TripleSlotStore();
