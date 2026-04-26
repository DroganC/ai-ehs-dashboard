import type { GameSfxUrlSet } from "../../hooks/useGameSfxController";

/**
 * 静态音轨目录：`public/games/emergency-procedure/assets/`
 * 与三消槽位使用相同四件套文件名，便于资源替换与批量处理。
 */
const BASE = "/games/emergency-procedure/assets";

export const EMERGENCY_SFX: GameSfxUrlSet = {
  bgm: `${BASE}/bgm.mp3`,
  win: `${BASE}/win.mp3`,
  lose: `${BASE}/lose.mp3`,
  click: `${BASE}/click.mp3`,
};
