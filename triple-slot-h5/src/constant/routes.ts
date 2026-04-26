import type { GameCode } from "./gameCode";

export const PATH_HOME = "/";

const GAME_PREFIX = "/game";

/**
 * 与 `react-router` 中 `path="/game/:gameCode"` 一致。
 */
export function pathToGame(code: GameCode) {
  return `${GAME_PREFIX}/${code}` as const;
}
