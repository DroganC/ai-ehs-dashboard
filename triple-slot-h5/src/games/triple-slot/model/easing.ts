/**
 * Easing functions used by animation code.
 *
 * Keep this file dependency-free so it can be reused by different layers
 * (store, view, tests) without pulling in UI concerns.
 */
export function easeInOutCubic(t: number) {
  // Clamp defensively so callers can pass slightly out-of-range values.
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
