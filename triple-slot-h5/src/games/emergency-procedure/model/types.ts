/**
 * 关卡 JSON 类型。与 `public/games/emergency-procedure/levels/*.json` 一致。
 */
export type CardDef = {
  id: string;
  label: string;
  accent?: "danger" | "warning" | "default";
};

export type SlotDef =
  | { kind: "prefill"; cardId: string }
  | { kind: "play" };

export type EmergencyLevelConfig = {
  id: string;
  title: string;
  bottomTip?: string;
  hintEnabled?: boolean;
  cards: CardDef[];
  slots: SlotDef[];
  /** 与 `slots` 等长，每格对应一步的正确 card id。 */
  correctOrder: string[];
};
