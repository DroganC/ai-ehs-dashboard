import { GameCode } from "../constant/gameCode";
import type { GameEntry } from "./types";
import TripleSlotView from "./triple-slot/TripleSlotView";

/**
 * 新增游戏：在 `GameCode` 增枚举、在此添加一项；勿在各游戏间互相 import。
 */
export const games: GameEntry[] = [
  {
    code: GameCode.TRIPLE_SLOT,
    title: "三消槽位",
    description: "3×7 棋盘，槽位三消",
    Component: TripleSlotView,
  },
];

export function getGameByCode(code: GameCode): GameEntry | undefined {
  return games.find((g) => g.code === code);
}
