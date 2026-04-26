import { games } from "../games/registry";
import { pathToGame } from "../constant/routes";
import { GameList } from "../components/game-list/GameList";

/**
 * 首页：把 registry 中的条目映射为可点击的路由，不包含具体游戏实现。
 */
export function HomePage() {
  return (
    <GameList
      title="小游戏"
      subtitle="选择要玩的游戏"
      items={games.map((g) => ({
        id: g.code,
        to: pathToGame(g.code),
        title: g.title,
        description: g.description,
      }))}
    />
  );
}
