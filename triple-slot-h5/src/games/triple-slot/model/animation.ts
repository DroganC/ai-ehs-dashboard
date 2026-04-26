/**
 * Animation tuning knobs (durations, distances, geometry).
 *
 * Centralizing these values keeps the store logic decoupled from CSS details
 * and makes motion tweaks predictable.
 */

/** Duration of the "tile flies into slot" animation. */
export const FLY_DURATION_MS = 420;

/**
 * Arc height for the fly animation.
 * Positive means it peaks upward mid-flight.
 */
export const FLY_ARC_PX = 26;

/**
 * `.triple-slot__fly`（BEM: triple-slot 块 + __fly 元素）为定尺寸，动画先算中心再 translate
 * to top-left for `transform: translate(x, y)`.
 */
export const FLY_HALF_W = 23;
export const FLY_HALF_H = 17;

/** How long slot feedback (success/fail) should be kept. */
export const SLOT_FEEDBACK_MS = 220;
