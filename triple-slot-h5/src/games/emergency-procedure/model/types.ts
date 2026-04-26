/**
 * 关卡 JSON 类型。与 `public/games/emergency-procedure/levels/*.json` 一致。
 */

/** 卡片标题颜色语义（与 Less BEM 修饰符 `ep-card--*` 对应）。 */
export type CardAccent = "danger" | "warning" | "default";

/**
 * 单张牌：第一关为流程文字，第二关为消防物资名（`image` 可后续接 URL）。
 */
export type CardDef = {
  id: string;
  label: string;
  accent?: CardAccent;
  /** 第二关物资图 URL；未配置时由 UI 使用缺省色块。 */
  image?: string;
};

/**
 * 关卡模式：
 * - `sequence`：5 步流程牌在上方池中乱序，依序**点击**飞入 5 槽，满槽后整体验证。
 * - `grid`：3×3 物资格 + 5 槽，与第一关场景一一对应，满槽后整体验证。
 */
export type EmergencyLevelMode = "sequence" | "grid";

/**
 * 一关的完整数据。
 * - `sequence`：`correctOrder` 为 5 个 id；不使用 `gridOrder`。
 * - `grid`：必须 `grid: {rows, cols}` 与 `gridOrder` 长度 9，且 `correctOrder` 为 5 个与第一关序位对应的物资 id。
 */
export type EmergencyLevelConfig = {
  id: string;
  mode: EmergencyLevelMode;
  title: string;
  bottomTip?: string;
  hintEnabled?: boolean;
  cards: CardDef[];
  /** 槽内顺序 = 与第一关步骤顺序一一对应（第 1 关为 5 步，第 2 关为 5 件物资 id）。 */
  correctOrder: string[];
  /**
   * 仅 `grid` 模式：3×3 行优先排列的 9 个 `card id`；含 4 张干扰项时仍须填满 9 格。
   */
  gridOrder?: string[];
  /** 仅 `grid` 模式，默认 3×3。 */
  grid?: { rows: number; cols: number };
};

/**
 * 飞入动画一帧中携带的牌数据（与 `CardDef` 对齐的浅快照，不附加引用）。
 * Store 在 `animateFly` 内从 `cardMap` 复制写入，供 `EpFlyLayer` 无 MobX 渲染。
 */
export type EpFlyCardSnapshot = Pick<CardDef, "id" | "label"> & {
  accent?: CardAccent;
  image?: string;
};

/**
 * 全屏 `fixed` 飞入层中的一项。由 `EmergencyProcedureStore` 的 `animateFly` 与 `ui/EpFlyLayer` 共用，避免 UI import Store。
 */
export type EpFly = {
  /** 与 `emergencyProcedureStore.flyId` 拼接成的唯一 id，作 React `key` */
  id: string;
  /** 牌面左上角相对视口的 `left`（px），中心轨迹减 `EP_FLY_HALF_W` 得此值 */
  x: number;
  /** 牌面左上角相对视口的 `top`（px） */
  y: number;
  /** 飞入中略缩小，1 为起止近似大小 */
  scale: number;
  opacity: number;
  /** 与待选区一致：第一关扑克面、第二关物资格 */
  variant: "poker" | "supply";
  card: EpFlyCardSnapshot;
};
