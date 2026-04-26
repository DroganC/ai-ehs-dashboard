/**
 * Easing functions used by animation code.
 *
 * Keep this file dependency-free so it can be reused by different layers
 * (store, view, tests) without pulling in UI concerns.
 */
/**
 * 标准 smoothstep 型三次缓入缓出，自变量通常取动画归一化时间 [0,1]。
 * @param t 进度；略超出 0~1 时会被夹取
 * @returns 缓动后的 0~1 插值
 */
export function easeInOutCubic(t: number): number {
  // Clamp defensively so callers can pass slightly out-of-range values.
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
