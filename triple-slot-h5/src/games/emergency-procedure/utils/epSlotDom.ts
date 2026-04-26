/**
 * 与应急流程底栏解耦的槽位 DOM 查询（`data-ep-slot-idx`），供 `EmergencyProcedureStore` 的飞入落点回调使用。
 */
export function queryEpSlotByIndex(index: number): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `[data-ep-slot-idx="${String(index)}"]`,
  );
}
