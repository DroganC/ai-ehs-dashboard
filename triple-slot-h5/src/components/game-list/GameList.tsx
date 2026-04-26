import { Link } from "react-router-dom";
import "./game-list.less";

export type GameListItem = {
  id: string;
  to: string;
  title: string;
  description?: string;
};

type GameListProps = {
  title: string;
  subtitle: string;
  items: GameListItem[];
};

/**
 * 纯展示：只依赖路由链接与展示文案，不依赖游戏 registry。
 */
export function GameList({ title, subtitle, items }: GameListProps) {
  return (
    <div className="game-list">
      <div className="game-list__inner">
        <h1 className="game-list__title">{title}</h1>
        <p className="game-list__subtitle">{subtitle}</p>
        <ul className="game-list__list" role="list">
          {items.map((item) => (
            <li key={item.id} className="game-list__item">
              <Link className="game-list__link" to={item.to}>
                <span className="game-list__link-text">{item.title}</span>
                {item.description ? (
                  <span className="game-list__link-desc">{item.description}</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
