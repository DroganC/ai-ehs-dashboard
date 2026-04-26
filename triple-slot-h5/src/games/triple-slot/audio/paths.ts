import type { GameSfxUrlSet } from "../../hooks/useGameSfxController";

/**
 * 静态音轨目录：`public/games/triple-slot/assets/`
 * 将文件命名为 `bgm` / `win` / `lose` / `click`（.mp3 等）后放入该目录即可。
 * @see `useGameSfxController` 中 URL 为站点根相对路径（Vite `public/` 映射）
 */
const BASE = "/games/triple-slot/assets";

export const TRIPLE_SLOT_SFX: GameSfxUrlSet = {
  bgm: `${BASE}/bgm.mp3`,
  win: `${BASE}/win.mp3`,
  lose: `${BASE}/lose.mp3`,
  click: `${BASE}/click.mp3`,
};
