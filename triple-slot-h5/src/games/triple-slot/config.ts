import type { LevelConfig } from "./model/level";

/**
 * 三消槽位**唯一局**配置（无多关卡）；铺砖与 `buildTilesFromLevel` 入参即此对象，不再从 `public` 拉 JSON。
 */
export const TRIPLE_SLOT_GAME_CONFIG: LevelConfig = {
  id: "default",
  name: "default",
  grid: { rows: 7, cols: 3 },
  types: [
    { type: "A", count: 3 },
    { type: "B", count: 3 },
    { type: "C", count: 3 },
    { type: "D", count: 3 },
    { type: "E", count: 3 },
    { type: "F", count: 3 },
    { type: "G", count: 3 },
  ],
  shuffle: true,
  seed: null,
  failLimit: 3,
};
