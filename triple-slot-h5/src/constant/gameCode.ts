/**
 * 全站游戏编码。新增游戏时在此增加常量，并在 `src/games/registry` 注册。
 */
export const GameCode = {
  /** 三消槽位 */
  TRIPLE_SLOT: "TRIPLE_SLOT",
  /** 应急流程卡片 */
  EMERGENCY_PROCEDURE: "EMERGENCY_PROCEDURE",
} as const;

export type GameCode = (typeof GameCode)[keyof typeof GameCode];

const VALID = new Set<string>(Object.values(GameCode));

export function isGameCode(value: string | undefined): value is GameCode {
  return value !== undefined && VALID.has(value);
}
