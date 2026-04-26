import { useCallback, useEffect, useMemo, useRef } from "react";

/**
 * 与具体玩法无关的 Web Audio 封装：背景循环与一次性短音。文件放在各游戏
 * `public/games/<id>/assets/` 下，由 Vite 原样提供。
 */
export type GameSfxUrlSet = {
  /** 循环 BGM 地址 */
  bgm: string;
  win: string;
  lose: string;
  /** 点牌 / 点槽等轻触反馈 */
  click: string;
};

type SfxOptions = {
  /** 默认 0.35 */
  bgmVolume?: number;
  /** 默认 0.85 */
  sfxVolume?: number;
};

type GameSfxController = {
  /** 在「对局进行中且需要背景乐」为 true，否则暂停 */
  setBgmRunning: (on: boolean) => void;
  playClick: () => void;
  playWin: () => void;
  playLose: () => void;
};

/**
 * 创建一次短音；每次新建 `HTMLAudioElement` 以支持快连点叠音。
 */
function playOneShot(url: string, volume: number): void {
  const a = new Audio(url);
  a.volume = volume;
  void a.play().catch(() => {
    /* 文件缺失、自动播放限制等 */
  });
}

/**
 * 供各游戏根视图使用：不依赖 MobX。卸载时停 BGM。
 */
export function useGameSfxController(
  urls: GameSfxUrlSet,
  options: SfxOptions = {},
): GameSfxController {
  const bgmVolume = options.bgmVolume ?? 0.35;
  const sfxVolume = options.sfxVolume ?? 0.85;
  const bgmRef = useRef<HTMLAudioElement | null>(null);

  const ensureBgm = useCallback(() => {
    if (bgmRef.current) return;
    const a = new Audio(urls.bgm);
    a.loop = true;
    a.preload = "auto";
    a.volume = bgmVolume;
    a.addEventListener("error", () => {
      /* 占位文件未替换时保持静默 */
    });
    bgmRef.current = a;
  }, [urls.bgm, bgmVolume]);

  const setBgmRunning = useCallback(
    (on: boolean) => {
      const el = bgmRef.current;
      if (!on) {
        if (el) {
          el.pause();
          el.currentTime = 0;
        }
        return;
      }
      ensureBgm();
      const b = bgmRef.current;
      if (b) void b.play().catch(() => {});
    },
    [ensureBgm],
  );

  const playClick = useCallback(
    () => playOneShot(urls.click, sfxVolume),
    [urls.click, sfxVolume],
  );
  const playWin = useCallback(
    () => playOneShot(urls.win, sfxVolume),
    [urls.win, sfxVolume],
  );
  const playLose = useCallback(
    () => playOneShot(urls.lose, sfxVolume),
    [urls.lose, sfxVolume],
  );

  useEffect(() => {
    return () => {
      if (bgmRef.current) {
        bgmRef.current.pause();
        bgmRef.current = null;
      }
    };
  }, []);

  return useMemo(
    () => ({ setBgmRunning, playClick, playWin, playLose }),
    [setBgmRunning, playClick, playWin, playLose],
  );
}
