import type { TileType } from "./types";

export const BOARD_COLS = 3;
export const BOARD_ROWS = 7;
export const TOTAL_TILES = BOARD_COLS * BOARD_ROWS; // 21
export const SLOT_CAPACITY = 3;
export const FAIL_LIMIT = 3;

export const TYPE_POOL: { type: TileType; icon: string }[] = [
  { type: "A", icon: "🍎" },
  { type: "B", icon: "🍋" },
  { type: "C", icon: "🍇" },
  { type: "D", icon: "🍓" },
  { type: "E", icon: "🍑" },
  { type: "F", icon: "🥝" },
  { type: "G", icon: "🍒" },
];
