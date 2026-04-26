/**
 * 关卡 JSON 类型。与 `public/games/emergency-procedure/levels/*.json` 一致。
 */

/** 卡片标题颜色语义（与 Less BEM 修饰符 `ep-card--*` 对应）。 */
export type CardAccent = "danger" | "warning" | "default";

/** 单张流程牌（待选区与已落槽的展示用）。 */
export type CardDef = {
  /** 在 `correctOrder` 与 `prefill` 中引用的稳定 id。 */
  id: string;
  /** 面额主文案。 */
  label: string;
  /** 高亮为警示/强调色，可缺省为默认黑字。 */
  accent?: CardAccent;
};

/**
 * 槽位格定义。`prefill` 为开局已摆放且不在待选池；`play` 需玩家从池中放置。
 */
export type SlotDef =
  | { kind: "prefill"; cardId: string }
  | { kind: "play" };

/**
 * 一关的完整数据：槽列与 `correctOrder` 一一对齐，长度必须相等。
 */
export type EmergencyLevelConfig = {
  id: string;
  title: string;
  /** 深棕色区域底部黄字提示。 */
  bottomTip?: string;
  /**
   * 是否显示「第一空位」高亮。显式为 `false` 可关闭轻提示；缺省为开。
   */
  hintEnabled?: boolean;
  cards: CardDef[];
  slots: SlotDef[];
  /** 与 `slots` 等长，第 i 位槽应放置的 `CardDef.id`（与预填格一致） */
  correctOrder: string[];
};
