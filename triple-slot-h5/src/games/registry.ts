import { GameCode } from "../constant/gameCode";
import type { GameEntry } from "./types";
import EmergencyProcedureView from "./emergency-procedure/EmergencyProcedureView";
import TripleSlotView from "./triple-slot/TripleSlotView";

/**
 * 全站可玩小游戏目录。新增游戏步骤：
 * 1. 在 `constant/gameCode.ts` 增加枚举值；
 * 2. 在本数组追加一项（title / description 供首页使用）；
 * 3. 勿在各游戏子目录间互相 import。
 */
export const games: readonly GameEntry[] = [
  {
    code: GameCode.TRIPLE_SLOT,
    title: "三消槽位",
    description: "3×7 棋盘，槽位三消",
    Component: TripleSlotView,
  },
  {
    code: GameCode.EMERGENCY_PROCEDURE,
    title: "应急流程卡片",
    description: "按正确顺序放置应急步骤",
    Component: EmergencyProcedureView,
  },
];

/**
 * 按 `GameCode` 解析注册项；`GamePlayPage` 在有效 code 下若返回 `undefined` 则回首页。
 * @param code 路由段中的游戏编码
 * @returns 匹配到的入口元数据，无则 `undefined`
 */
export function getGameByCode(code: GameCode): GameEntry | undefined {
  return games.find((g) => g.code === code);
}
