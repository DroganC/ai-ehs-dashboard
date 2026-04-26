import { TYPE_POOL } from "./constants";
import type { Tile, TileType } from "./types";

export type LevelConfig = {
  id: string;
  name: string;
  grid: { rows: number; cols: number };
  types: { type: TileType; count: number }[];
  shuffle: boolean;
  seed: string | null;
  failLimit: number;
};

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function seedToUint32(seedStr: string) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function randInt(rng: () => number, max: number) {
  return Math.floor(rng() * max);
}

export function shuffleInPlace<T>(rng: () => number, arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function shortId() {
  return Math.random().toString(36).slice(2, 8);
}

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
