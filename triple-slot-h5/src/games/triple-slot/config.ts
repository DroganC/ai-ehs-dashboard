/**
 * 三消槽位游戏：关卡 JSON 的 URL 前缀（Vite `public/` 映射到站点根）。
 * @see `public/games/triple-slot/levels/`
 */
export const TRIPLE_SLOT_LEVEL_BASE = "/games/triple-slot/levels";

/** 首屏默认加载的关卡文件（相对站点根）。 */
export const TRIPLE_SLOT_DEFAULT_LEVEL = `${TRIPLE_SLOT_LEVEL_BASE}/level-01.json` as const;
