/** 与 triple-slot 相同：静态资源在 `public/games/emergency-procedure/`，由站点根访问。 */
export const EMERGENCY_LEVEL_BASE = "/games/emergency-procedure/levels";

export const EMERGENCY_LEVEL_PATHS: readonly string[] = [
  `${EMERGENCY_LEVEL_BASE}/level-01.json`,
  `${EMERGENCY_LEVEL_BASE}/level-02.json`,
] as const;

export const EMERGENCY_LEVEL_COUNT = EMERGENCY_LEVEL_PATHS.length;
