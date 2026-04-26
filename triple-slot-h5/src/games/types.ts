import type { ComponentType } from "react";
import type { GameCode } from "../constant/gameCode";

/**
 * 在 registry 注册；应用路由仅依赖 code + 元信息，不直接引用各游戏内部模块。
 */
export type GameEntry = {
  code: GameCode;
  title: string;
  description?: string;
  Component: ComponentType;
};
