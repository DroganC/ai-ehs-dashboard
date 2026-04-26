import { Navigate, useParams } from "react-router-dom";
import { isGameCode } from "../constant/gameCode";
import { PATH_HOME } from "../constant/routes";
import { getGameByCode } from "../games/registry";

/**
 * 仅负责按 `gameCode` 选择组件；具体玩法由各自游戏包导出。
 */
export function GamePlayPage() {
  const { gameCode } = useParams();

  if (!isGameCode(gameCode)) {
    return <Navigate to={PATH_HOME} replace />;
  }

  const entry = getGameByCode(gameCode);
  if (!entry) {
    return <Navigate to={PATH_HOME} replace />;
  }

  const { Component } = entry;
  return (
    <div className="h5-app__play">
      <Component />
    </div>
  );
}
