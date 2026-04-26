import type { TileType } from "./types";

/** 棋盘列数（与关卡 `grid.cols` 一致） */
export const BOARD_COLS = 3;
/** 棋盘行数 */
export const BOARD_ROWS = 7;
/** 总牌数 = 列 × 行，当前为 21 */
export const TOTAL_TILES = BOARD_COLS * BOARD_ROWS;
/** 下方卡槽可容牌数，满则尝试三消判定 */
export const SLOT_CAPACITY = 3;
/** 未配置关卡时的默认失败次数上限 */
export const FAIL_LIMIT = 3;

/** 各 `TileType` 对应的展示 emoji，与 `buildTilesFromLevel` 中装箱顺序无关，仅作图标映射。 */
export const TYPE_POOL: { type: TileType; icon: string }[] = [
  { type: "A", icon: "🍎" },
  { type: "B", icon: "🍋" },
  { type: "C", icon: "🍇" },
  { type: "D", icon: "🍓" },
  { type: "E", icon: "🍑" },
  { type: "F", icon: "🥝" },
  { type: "G", icon: "🍒" },
];
