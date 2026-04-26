# EMERGENCY_PROCEDURE (应急流程卡片) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the MobX-driven 应急流程卡片 mini-game (2 JSON levels, session-only progression from level 1, light hint) to `triple-slot-h5` and register it as `EMERGENCY_PROCEDURE`.

**Architecture:** Fetch level JSON from `public/games/emergency-procedure/levels/`. A single MobX store holds level config, shuffled pool, slot assignments, selected pool card, phase (playing/level-won/all-won), and UI toasts. View uses `observer` + small presentational subcomponents. Placement validates `correctOrder[i]`; wrong placement refills with toast. Light hint: highlight first empty **play** slot in index order when `hintEnabled`.

**Tech Stack:** React 19, Vite, antd-mobile (styles only if needed), MobX, Less; HTML5 DnD + click-to-select fallback for touch.

---

## File map

| Path | Role |
|------|------|
| `triple-slot-h5/src/constant/gameCode.ts` | Add `EMERGENCY_PROCEDURE` |
| `triple-slot-h5/src/games/registry.ts` | Register game entry |
| `triple-slot-h5/src/games/emergency-procedure/config.ts` | `LEVEL_BASE` + list of 2 level URLs |
| `triple-slot-h5/src/games/emergency-procedure/model/types.ts` | `EmergencyLevelConfig`, `SlotDef` |
| `triple-slot-h5/src/games/emergency-procedure/store/emergencyProcedureStore.ts` | MobX store (singleton) |
| `triple-slot-h5/src/games/emergency-procedure/EmergencyProcedureView.tsx` | `observer` root view |
| `triple-slot-h5/src/games/emergency-procedure/ui/*.tsx` | Header, pool grid, slot row, bottom tip, overlay |
| `triple-slot-h5/src/games/emergency-procedure/emergency-procedure-view.less` | Layout/theme |
| `public/games/emergency-procedure/levels/level-01.json` | 5 槽, 预填 报警 |
| `public/games/emergency-procedure/levels/level-02.json` | 4 槽, 全 play |

---

## Tasks (executed in this session)

### Task 1: Constants + registry + public JSON

- [ ] **Step 1:** Add `EMERGENCY_PROCEDURE` to `gameCode.ts`.
- [ ] **Step 2:** Add `EmergencyProcedureView` to `registry.ts` (title: 应急流程卡片).
- [ ] **Step 3:** Add `config.ts`, `model/types.ts`, `level-01.json`, `level-02.json` with schema described in spec `2026-04-26-emergency-procedure-design.md`.

**Verify:** `npm run build` in `triple-slot-h5` (types may pass after store+view exist).

### Task 2: MobX store

- [ ] Load level by path; `hydrate` sets `pool` (Fisher–Yates shuffle of play-step ids), `slotPlacements` (prefill from JSON).
- [ ] `selectPoolCard` / `clearSelection`; `attemptPlaceInSlot(i)`; wrong → toast, no state change; correct → move id from pool to slot.
- [ ] `hintSlotIndex` computed: first `i` with `play` slot and `slotPlacements[i] == null`.
- [ ] `levelComplete` when all play slots filled correctly (equiv. all play slots have matching `correctOrder[i]`).
- [ ] `goNextLevel` (index +1, fetch next JSON) or `allComplete` on last; `init` on view mount always from level-01.

### Task 3: View + styles

- [ ] `EmergencyProcedureView`: `useEffect` → `store.startSession()` or `loadLevel(0)`.
- [ ] Pool area: cards; drag (mouse) + click-to-select + tap slot (mobile).
- [ ] Slot row: numbers, dashed empty, prefill/ filled.
- [ ] Overlays: level clear → 下一关; all clear → 全通/返回.
- [ ] Less: warm earth palette, rounded panels (match spec screenshot intent).

### Task 4: Verify

- [ ] Run `cd triple-slot-h5 && npm run build` — expect 0 TypeScript errors.
- [ ] Manual: `/game/EMERGENCY_PROCEDURE` — complete level 1, level 2, refresh → back to level 1.

**Self-review vs spec:** Session-only; 2 levels; no persistence; no distractors; light hint; MobX; `EMERGENCY_PROCEDURE` name — all covered.

---

**Plan file:** `docs/superpowers/plans/2026-04-26-emergency-procedure.md`

**Execution handoff (default):** Inline execution in the same session after plan write — no subagent per user request to start coding immediately.
