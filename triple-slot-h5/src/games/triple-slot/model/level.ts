import { TYPE_POOL } from "./constants";
import type { Tile, TileType } from "./types";

/**
 * 与 `public/games/triple-slot/levels/*.json` 对应的关卡结构。
 * `types` 描述每种 `TileType` 的张数，展开后 `grid` 单元格一一摆牌（含洗牌）。
 */
export type LevelConfig = {
  id: string;
  name: string;
  grid: { rows: number; cols: number };
  types: { type: TileType; count: number }[];
  shuffle: boolean;
  /** 非空时用于 `mulberry32` 固定随机序列，便于复现 */
  seed: string | null;
  failLimit: number;
};

/**
 * 可复现的 PRNG，返回 [0,1) 的伪随机数（mulberry32 算法）。
 * @param seed 32 位无符号种子
 * @returns 闭包，每次调用产生下一个随机数
 */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 将任意字符串散列为 32 位无符号整数，作 `mulberry32` 种子用。
 * @param seedStr 关卡配置的 `seed` 字符串
 * @returns 无符号 32 位种子
 */
function seedToUint32(seedStr: string): number {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * 均匀整数 [0, max)
 * @param max 上界（不包含）
 */
function randInt(rng: () => number, max: number): number {
  return Math.floor(rng() * max);
}

/**
 * Fisher–Yates 原地洗牌，使用调用方提供的 RNG（便于种子复现）。
 * @param rng 返回 [0,1) 的函数
 * @param arr 待洗牌数组（会被修改）
 * @returns 同一份数组引用
 */
export function shuffleInPlace<T>(rng: () => number, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function shortId(): string {
  return Math.random().toString(36).slice(2, 8);
}

/**
 * 由关卡配置生成棋盘上的 `Tile` 列表：按行优先填充 `grid`，牌序来自 `types` 展开与可选洗牌。
 * @param level 已解析的关卡对象
 * @returns 与 `rows * cols` 等长的牌数组
 * @throws 若 `bag` 与格子数不一致可能产生 `undefined` 访问，依赖合法 JSON
 */
export function buildTilesFromLevel(level: LevelConfig): Tile[] {
  const rng =
    typeof level.seed === "string" && level.seed.length > 0
      ? mulberry32(seedToUint32(level.seed))
      : Math.random;

  const bag: { type: TileType; icon: string }[] = [];
  for (const cfg of level.types) {
    const t = TYPE_POOL.find((x) => x.type === cfg.type);
    if (!t) continue;
    for (let i = 0; i < cfg.count; i++) bag.push({ type: t.type, icon: t.icon });
  }

  if (level.shuffle) shuffleInPlace(rng, bag);

  const tiles: Tile[] = [];
  let idx = 0;
  for (let r = 0; r < level.grid.rows; r++) {
    for (let c = 0; c < level.grid.cols; c++) {
      const item = bag[idx++];
      tiles.push({
        id: `${r}-${c}-${shortId()}`,
        type: item.type,
        icon: item.icon,
        row: r,
        col: c,
        state: "onBoard",
      });
    }
  }
  return tiles;
}
