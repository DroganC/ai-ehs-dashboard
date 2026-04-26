import type { ComponentType } from "react";
import type { GameCode } from "../constant/gameCode";

/**
 * 单款小游戏的注册信息：由 `registry.ts` 汇总，供首页与 `GamePlayPage` 仅按 `GameCode` 懒加载根组件。
 * 各游戏实现包之间禁止互相 import，统一通过本类型解耦。
 */
export type GameEntry = {
  /** 与 `pathToGame()`、`/game/:gameCode` 及 `GameCode` 字符串常量一致 */
  code: GameCode;
  /** 首页列表主标题 / 可访问名称 */
  title: string;
  /** 列表副文案，可选 */
  description?: string;
  /** 无业务 props 的页面根组件（路由直接渲染） */
  Component: ComponentType;
};

