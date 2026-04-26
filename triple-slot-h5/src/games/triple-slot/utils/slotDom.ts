/**
 * 与三消槽位 UI 解耦的 DOM 查询：`TripleSlotSlotStrip` 输出 `data-slot-idx`，供 `TripleSlotStore.performPick` 的 `getSlotCell` 使用。
 * 不依赖 React，便于单测或换用 ref 时替换实现。
 */
export function queryTripleSlotCellByIndex(index: number): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `.triple-slot__slot-cell[data-slot-idx="${String(index)}"]`,
  );
}
