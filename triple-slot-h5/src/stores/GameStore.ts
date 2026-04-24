import { makeAutoObservable, runInAction } from 'mobx'
import type { LevelConfig } from '../game/level'
import { buildTilesFromLevel } from '../game/level'
import { FLY_ARC_PX, FLY_DURATION_MS, FLY_HALF_H, FLY_HALF_W, SLOT_FEEDBACK_MS } from '../game/animation'
import { FAIL_LIMIT, SLOT_CAPACITY, TOTAL_TILES } from '../game/constants'
import { easeInOutCubic } from '../game/easing'
import type { Pick, Tile } from '../game/types'

type Fly = { id: string; icon: string; x: number; y: number; scale: number; opacity: number }
type SlotAnim = 'none' | 'success' | 'fail'
type SlotHint = 'none' | 'almostFull'
type ToastKind = 'none' | 'failRollback'

export class GameStore {
  /**
   * Current level configuration.
   * `null` means the level has not been loaded (or has failed to load) yet.
   */
  level: LevelConfig | null = null

  /**
   * The canonical tile list.
   *
   * Important: the UI renders from this list (via `tileAt`), and the slot
   * stores references by `tileId`, so this is the single source of truth.
   */
  tiles: Tile[] = []

  /**
   * The current slot picks (in order).
   *
   * Note: we push into `slot` only after the fly animation completes, so
   * the board does not "jump" while the tile is in motion.
   */
  slot: Pick[] = []
  clearedCount = 0
  failCount = 0

  /**
   * Global interaction lock.
   *
   * We lock during `performPick()` so users can't spam multiple clicks while
   * an animation is in-flight, which would desync UI and state.
   */
  locked = false
  slotAnim: SlotAnim = 'none'
  slotHint: SlotHint = 'none'
  toast: { kind: ToastKind; text: string } = { kind: 'none', text: '' }
  flys: Fly[] = []
  private flyId = 0
  private slotAnimTimer: number | null = null
  private hintTimer: number | null = null
  private toastTimer: number | null = null

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  get levelName() {
    return this.level?.name ?? '01'
  }

  get failLimit() {
    return typeof this.level?.failLimit === 'number' ? this.level.failLimit : FAIL_LIMIT
  }

  get phase(): 'playing' | 'win' | 'lose' {
    if (this.clearedCount >= TOTAL_TILES) return 'win'
    if (this.failCount >= this.failLimit) return 'lose'
    return 'playing'
  }

  async loadLevel(path = '/levels/level-01.json') {
    // Load level configuration from a static asset in /public.
    const res = await fetch(path, { cache: 'no-store' })
    if (!res.ok) throw new Error(`Failed to load level: ${path}`)
    const level = (await res.json()) as LevelConfig
    this.reset(level)
  }

  reset(level?: LevelConfig) {
    // Reset to a clean game state while keeping the provided level config.
    if (level) this.level = level
    if (!this.level) throw new Error('Level not loaded')
    this.tiles = buildTilesFromLevel(this.level)
    this.slot = []
    this.clearedCount = 0
    this.failCount = 0
    this.locked = false
    this.slotAnim = 'none'
    this.slotHint = 'none'
    this.toast = { kind: 'none', text: '' }
    this.flys = []
    if (this.slotAnimTimer !== null) {
      window.clearTimeout(this.slotAnimTimer)
      this.slotAnimTimer = null
    }
    if (this.hintTimer !== null) {
      window.clearTimeout(this.hintTimer)
      this.hintTimer = null
    }
    if (this.toastTimer !== null) {
      window.clearTimeout(this.toastTimer)
      this.toastTimer = null
    }
  }

  tileAt(row: number, col: number) {
    return (
      this.tiles.find(
        (t) => t.row === row && t.col === col && (t.state === 'onBoard' || t.state === 'picking'),
      ) ?? null
    )
  }

  pickTile(tileId: string) {
    /**
     * Validate a pick request and return the concrete tile instance.
     *
     * This method must NOT mutate slot/board state directly. Mutations that
     * impact rendering order should happen in `performPick()` so we can:
     * - keep the board layout stable during the fly animation
     * - commit to slot only after the animation completes
     */
    if (this.phase !== 'playing') return { ok: false as const, reason: 'ended' as const }
    if (this.slot.length >= SLOT_CAPACITY) return { ok: false as const, reason: 'slot_full' as const }

    const tile = this.tiles.find((t) => t.id === tileId)
    if (!tile || tile.state !== 'onBoard') return { ok: false as const, reason: 'invalid' as const }

    return { ok: true as const, tile }
  }

  resolveSlot() {
    if (this.slot.length !== SLOT_CAPACITY) return { kind: 'noop' as const }

    const [a, b, c] = this.slot
    const success = a.type === b.type && b.type === c.type

    if (success) {
      for (const p of this.slot) {
        const tile = this.tiles.find((t) => t.id === p.tileId)
        if (tile) tile.state = 'cleared'
      }
      this.slot = []
      this.clearedCount += SLOT_CAPACITY
      return { kind: 'success' as const }
    }

    // failure: restore
    for (const p of this.slot) {
      const tile = this.tiles.find((t) => t.id === p.tileId)
      if (tile) tile.state = 'onBoard'
    }
    this.slot = []
    this.failCount += 1
    return { kind: 'fail' as const }
  }

  get slotIcons() {
    return this.slot.map((p) => p.icon)
  }

  private setSlotAnim(anim: SlotAnim, durationMs = 220) {
    this.slotAnim = anim
    if (this.slotAnimTimer !== null) {
      window.clearTimeout(this.slotAnimTimer)
      this.slotAnimTimer = null
    }
    if (anim === 'none') return
    this.slotAnimTimer = window.setTimeout(() => {
      runInAction(() => {
        this.slotAnim = 'none'
        this.slotAnimTimer = null
      })
    }, durationMs)
  }

  private setHint(hint: SlotHint, durationMs = 650) {
    this.slotHint = hint
    if (this.hintTimer !== null) {
      window.clearTimeout(this.hintTimer)
      this.hintTimer = null
    }
    if (hint === 'none') return
    this.hintTimer = window.setTimeout(() => {
      runInAction(() => {
        this.slotHint = 'none'
        this.hintTimer = null
      })
    }, durationMs)
  }

  private showToast(kind: ToastKind, text: string, durationMs = 950) {
    this.toast = { kind, text }
    if (this.toastTimer !== null) {
      window.clearTimeout(this.toastTimer)
      this.toastTimer = null
    }
    if (kind === 'none') return
    this.toastTimer = window.setTimeout(() => {
      runInAction(() => {
        this.toast = { kind: 'none', text: '' }
        this.toastTimer = null
      })
    }, durationMs)
  }

  private animateFly(icon: string, from: DOMRect, to: DOMRect) {
    /**
     * Create and update a "fly" sprite that visually moves from `from` to `to`.
     *
     * The sprite is rendered by the React view using `.game__fly`.
     * We update `this.flys` on each frame so the view can re-render.
     */
    const id = String(++this.flyId)
    const startX = from.left + from.width / 2
    const startY = from.top + from.height / 2
    const endX = to.left + to.width / 2
    const endY = to.top + to.height / 2
    const duration = FLY_DURATION_MS
    const start = performance.now()

    return new Promise<void>((resolve) => {
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration)
        const k = easeInOutCubic(t)
        const x = startX + (endX - startX) * k
        // subtle arc: peak at mid-flight
        const arc = Math.sin(Math.PI * k) * FLY_ARC_PX
        const y = startY + (endY - startY) * k - arc
        runInAction(() => {
          this.flys = [
            ...this.flys.filter((f) => f.id !== id),
            { id, icon, x: x - FLY_HALF_W, y: y - FLY_HALF_H, scale: 1 - 0.08 * t, opacity: 1 },
          ]
        })
        if (t < 1) requestAnimationFrame(step)
        else {
          runInAction(() => {
            this.flys = this.flys.filter((f) => f.id !== id)
          })
          resolve()
        }
      }
      requestAnimationFrame(step)
    })
  }

  async performPick(tileId: string, from: DOMRect, to: DOMRect) {
    /**
     * Orchestrate the full pick interaction.
     *
     * High-level timeline:
     * 1) Validate the tile can be picked (phase, slot capacity, tile state).
     * 2) Mark the tile as `picking` so the board keeps its layout but fades the tile.
     * 3) Run the fly animation from board -> slot cell.
     * 4) Commit: move the tile to `inSlot` and push a Pick into `slot`.
     * 5) If slot is full, resolve (success: clear; fail: rollback + failCount).
     */
    if (this.locked) return
    this.locked = true
    try {
      const pickRes = this.pickTile(tileId)
      if (!pickRes.ok) return

      // keep the board layout stable during the flight
      pickRes.tile.state = 'picking'

      await this.animateFly(pickRes.tile.icon, from, to)

      runInAction(() => {
        pickRes.tile.state = 'inSlot'
        this.slot.push({
          tileId: pickRes.tile.id,
          type: pickRes.tile.type,
          icon: pickRes.tile.icon,
          row: pickRes.tile.row,
          col: pickRes.tile.col,
        })
      })

      if (this.slot.length === SLOT_CAPACITY) {
        const result = this.resolveSlot()
        if (result.kind === 'success') this.setSlotAnim('success', SLOT_FEEDBACK_MS)
        if (result.kind === 'fail') {
          this.setSlotAnim('fail', SLOT_FEEDBACK_MS)
          this.showToast('failRollback', '匹配失败：已回滚，失败次数+1')
        }
      } else if (this.slot.length === SLOT_CAPACITY - 1) {
        this.setHint('almostFull')
      }
    } finally {
      runInAction(() => {
        this.locked = false
      })
    }
  }
}

export const gameStore = new GameStore()

