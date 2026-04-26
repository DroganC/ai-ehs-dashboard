/**
 * 与三消解耦的缓动函数，避免 `emergency-procedure` 依赖 `triple-slot` 包内模块。
 * @param t 进度 0~1
 */
export function epEaseInOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
