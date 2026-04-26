/**
 * 应急流程卡片：关卡 JSON 的 URL 目录前缀（Vite `public/` → 站点根路径）。
 * @see `public/games/emergency-procedure/levels/`
 */
export const EMERGENCY_LEVEL_BASE = "/games/emergency-procedure/levels";

/**
 * 全游戏关卡列表（本版固定 2 关），`fetch` 顺序即闯关顺序。
 * 新增强关时在此追加路径即可。
 */
export const EMERGENCY_LEVEL_PATHS: readonly string[] = [
  `${EMERGENCY_LEVEL_BASE}/level-01.json`,
  `${EMERGENCY_LEVEL_BASE}/level-02.json`,
] as const;

/** 关卡文件个数，与 `EMERGENCY_LEVEL_PATHS.length` 一致。 */
export const EMERGENCY_LEVEL_COUNT: number = EMERGENCY_LEVEL_PATHS.length;

/**
 * 与 `emergencyProcedureStore` 中错序时 Toast 一致，供视图在相同文案出现时播放失败音效。
 */
export const EMERGENCY_TOAST_FAIL_ORDER =
  "顺序不正确，已归位并重新打乱，请重试。" as const;
