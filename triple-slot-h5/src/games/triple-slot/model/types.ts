/** 七种水果牌面类型，与关卡 `types[].type` 及棋盘显示一致。 */
export type TileType = "A" | "B" | "C" | "D" | "E" | "F" | "G";

/**
 * 棋盘或流程中的一张牌。
 * - `onBoard`：在棋盘上可点；
 * - `picking`：已点选、飞行动画中；
 * - `inSlot`：已进入下方槽位；
 * - `cleared`：已随三消消除。
 */
export type Tile = {
  id: string;
  type: TileType;
  icon: string;
  row: number;
  col: number;
  state: "onBoard" | "picking" | "inSlot" | "cleared";
};

/**
 * 槽位中暂存的一条记录（与 `Tile` 快照对应，用于消除判定与显示 emoji）。
 */
export type Pick = {
  tileId: string;
  type: TileType;
  icon: string;
  row: number;
  col: number;
};

