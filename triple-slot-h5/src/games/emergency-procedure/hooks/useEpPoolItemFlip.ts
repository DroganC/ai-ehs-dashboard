import { useLayoutEffect, useMemo, useRef, type RefObject } from "react";

const DURATION_MS = 320;
const EASING = "cubic-bezier(0.33, 0, 0.2, 1)";

/**
 * 池子少牌（点走一张）时，对仍在 DOM 上的 `.ep__pool-item` 做 FLIP，使补位带过渡。
 * 同数重排（洗牌等）不播位移动画，仅更新几何缓存。
 *
 * 卸载或依赖变更时会移除 `transitionend` / `setTimeout`，并清理行内 transform，避免泄漏与重入。
 */
export function useEpPoolItemFlip(
  cardIds: readonly string[],
  containerRef: RefObject<HTMLElement | null>,
): void {
  const prevRectsRef = useRef(new Map<string, DOMRectReadOnly>());
  const prevCountRef = useRef(0);
  const isFirstRef = useRef(true);

  const poolSig = useMemo(
    () => `${String(cardIds.length)}:${cardIds.join("\0")}`,
    [cardIds],
  );

  useLayoutEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const disposers: Array<() => void> = [];

    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const prevCount = prevCountRef.current;
    const isRemoval = !isFirstRef.current && cardIds.length < prevCount;

    const nodes = root.querySelectorAll<HTMLElement>(".ep__pool-item[data-ep-pool-id]");
    const nextRects = new Map<string, DOMRectReadOnly>();

    for (const node of nodes) {
      const id = node.getAttribute("data-ep-pool-id");
      if (!id) continue;
      const newRect = node.getBoundingClientRect();
      nextRects.set(id, newRect);

      if (isRemoval && !reduceMotion) {
        const old = prevRectsRef.current.get(id);
        if (old) {
          const dx = old.left - newRect.left;
          const dy = old.top - newRect.top;
          if (Math.abs(dx) > 0.4 || Math.abs(dy) > 0.4) {
            node.style.setProperty("transform", `translate(${String(dx)}px, ${String(dy)}px)`);
            node.style.setProperty("transition", "transform 0s");
            void node.offsetWidth;
            node.style.setProperty("transition", `transform ${String(DURATION_MS)}ms ${EASING}`);
            node.style.setProperty("transform", "translate(0,0)");

            let settled = false;
            let timeoutId: ReturnType<typeof setTimeout> | undefined;

            const settle = (): void => {
              if (settled) return;
              settled = true;
              if (timeoutId !== undefined) {
                window.clearTimeout(timeoutId);
                timeoutId = undefined;
              }
              node.removeEventListener("transitionend", onEnd);
              node.style.removeProperty("transform");
              node.style.removeProperty("transition");
            };

            const onEnd = (e: TransitionEvent): void => {
              if (e.propertyName !== "transform") return;
              settle();
            };

            node.addEventListener("transitionend", onEnd);
            timeoutId = window.setTimeout(settle, DURATION_MS + 80);
            disposers.push(settle);
          }
        }
      }
    }

    prevRectsRef.current = nextRects;
    prevCountRef.current = cardIds.length;
    if (isFirstRef.current) {
      isFirstRef.current = false;
    }

    return () => {
      for (const d of disposers) {
        d();
      }
    };
    /* `cardIds` 与 `length` 已编码于 `poolSig`；`containerRef` 在 effect 内读 `current`。
     * 仅随池签名变重跑，避免同内容新数组引用无意义重算。 */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolSig]);
}
