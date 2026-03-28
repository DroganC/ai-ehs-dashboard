/**
 * Landing 页脚本（单页一次性初始化）。
 *
 * ## 生命周期
 * - 加载末尾执行一次 `init()`；无 SPA 二次挂载，故不做通用 teardown（除轮播）。
 *
 * ## 资源与泄漏
 * - **轮播**：`pagehide` 时 `teardownHeroCarousel` 清除定时器、rAF、`IntersectionObserver`，并用
 *   `AbortController` 卸掉 `resize`；同时 `removeEventListener(transitionend)`，避免打断动画后的误触发。
 * - **全局 reveal**：`IntersectionObserver` 模块级单例；各节点触发后 `unobserve`，回调次数有界。
 * - **scroll / Tab / 表单**：与文档同寿命；表单为单次 `submit` 监听。
 *
 * ## 闭包与性能
 * - 各 `init*` 内嵌函数只捕获本模块 DOM 与标量状态，无每帧新建大对象。
 * - 轮播中 `onCarouselResize`、`advanceOne`、`onTrackTransitionEnd` 等为**固定函数引用**，便于
 *   `add/removeEventListener` 与浏览器优化；景深用 rAF 链 + 不可见时降频。
 */

const prefersReduced =
  typeof matchMedia !== "undefined" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

/** 全站头部 Logo 文案（与 HTML title / 文案一致） */
const SITE_NAME_LOGO = "AI OPENCODE HUB";

/** Hero 主标题高亮区循环：AI HUB ↔ AI OPENCODE */
const HERO_ACCENT_CYCLE = ["AI HUB", "AI OPENCODE"];

/**
 * Hero 标题高亮打字机：在两个字串间插入/删除字符。
 * - 链式 `setTimeout`（非 `setInterval`），停顿可随机化。
 * - 与页面同寿命；负载低，未在 `pagehide` 清理 pending timer（离开页即销毁）。
 */
function initHeroAccentTypewriter() {
  const accent = document.querySelector(".hero__title-accent");
  if (!accent) return;

  if (prefersReduced) {
    accent.textContent = HERO_ACCENT_CYCLE[1];
    accent.classList.add("hero__title-accent--pause");
    return;
  }

  let targetIdx = 0;
  let current = "";

  function step() {
    const target = HERO_ACCENT_CYCLE[targetIdx];

    if (current === target) {
      accent.classList.add("hero__title-accent--pause");
      window.setTimeout(() => {
        accent.classList.remove("hero__title-accent--pause");
        targetIdx = (targetIdx + 1) % HERO_ACCENT_CYCLE.length;
        window.setTimeout(step, 80);
      }, 2000 + Math.floor(Math.random() * 400));
      return;
    }

    accent.classList.remove("hero__title-accent--pause");

    if (target.startsWith(current)) {
      current = target.slice(0, current.length + 1);
    } else {
      current = current.slice(0, -1);
    }

    accent.textContent = current;
    window.setTimeout(step, 52 + Math.floor(Math.random() * 48));
  }

  step();
}

/**
 * 头部 Logo 打字动画；完成后为 `link` 添加 `site-header__logo--typing-done`。
 */
function initHeaderTypewriter() {
  const link = document.querySelector(".site-header__logo");
  const el = document.querySelector(".site-header__logo-text");
  if (!link || !el) return;

  if (prefersReduced) {
    el.textContent = SITE_NAME_LOGO;
    link.classList.add("site-header__logo--typing-done");
    return;
  }

  el.textContent = "";
  let i = 0;

  function step() {
    if (i >= SITE_NAME_LOGO.length) {
      link.classList.add("site-header__logo--typing-done");
      return;
    }
    el.textContent += SITE_NAME_LOGO[i];
    i += 1;
    window.setTimeout(step, 68 + Math.floor(Math.random() * 56));
  }

  step();
}

/**
 * 区块首次进入视口时添加 `reveal--visible`；每个节点触发后立即 `unobserve`，保证回调最多一次/节点。
 */
const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("reveal--visible");
      observer.unobserve(entry.target);
    }
  },
  { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
);

function initReveal() {
  /* 减少动态效果：不注入 reveal 样式，内容默认可见 */
  if (prefersReduced) return;

  const style = document.createElement("style");
  style.textContent = `
    .reveal { opacity: 0; transform: translateY(18px); transition: opacity 0.65s ease, transform 0.65s ease; }
    .reveal.reveal--visible { opacity: 1; transform: translateY(0); }
  `;
  document.head.appendChild(style);

  const selectors = [
    ".hero__eyebrow",
    ".hero__title",
    ".hero__lede",
    ".hero__actions",
    ".hero__stats",
    ".showcase__tabs-wrap",
    ".hero-carousel__head",
    ".hero-carousel__frame",
    ".section__head",
    ".bento__card",
    ".steps__item",
    ".quote__inner",
    ".cta__inner",
  ];

  for (const sel of selectors) {
    let delay = 0;
    document.querySelectorAll(sel).forEach((el) => {
      el.classList.add("reveal");
      el.style.transitionDelay = `${delay}ms`;
      delay = Math.min(delay + 55, 280);
      observer.observe(el);
    });
  }
}

/**
 * CTA 表单占位：阻止默认提交，展示成功态后恢复。
 * 注：极快连点提交可能叠多个 `setTimeout`；落地演示可接受，若接真实接口应 `debounce` 或禁用按钮至请求结束。
 */
function initForm() {
  const form = document.querySelector(".cta__form");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = form.querySelector(".cta__input");
    const btn = form.querySelector(".cta__submit");
    if (!input || !btn) return;
    const prev = btn.textContent;
    btn.disabled = true;
    btn.textContent = "已订阅";
    input.readOnly = true;
    window.setTimeout(() => {
      btn.textContent = prev;
      btn.disabled = false;
      input.readOnly = false;
      input.value = "";
    }, 2400);
  });
}

/**
 * 向下滚动且超过阈值时收起头部；向上滚或回顶则展开。
 * `lastY` 与 `scroll` 回调闭包在同一次 `init` 内，无全局可变共享。
 */
function initHeaderScroll() {
  const header = document.querySelector(".site-header");
  if (!header) return;

  let lastY = window.scrollY;

  window.addEventListener(
    "scroll",
    () => {
      const y = window.scrollY;
      if (y < 12) {
        header.classList.remove("site-header--collapsed");
      } else if (y > lastY && y > 48) {
        header.classList.add("site-header--collapsed");
      } else if (y < lastY) {
        header.classList.remove("site-header--collapsed");
      }
      lastY = y;
    },
    { passive: true }
  );
}

/**
 * 优秀案例轮播（单入口）：克隆接尾 + 按格步进 + 视口中心景深。
 *
 * 状态机要点：
 * - `slideIndex`：当前对齐第几张原卡（0…n-1）。末卡下一步先 **动画到 loopW**（与克隆首帧对齐），
 *   在 `onLoopWrapTransitionEnd` 里 **无过渡 translate(0)**，再进入停顿与下一轮。
 * - `transitionend` 仅处理 `target === track` 且 `propertyName === "transform"`，避免子节点冒泡误触发。
 * - 监听使用 `{ once: true }`；**resize / pagehide** 前仍须 `removeEventListener`，否则打断的 transition 可能补发 end。
 *
 * 位移计算：`offsetForSlideIndex` / `loopWidthPx` 用 `offsetLeft` 与首克隆，与 flex+gap 实际布局一致。
 */
const HERO_CAROUSEL = {
  transitionMs: 300,
  idleMsAfterTransition: 1500,
  firstStepDelayMs: 0,
  depthScaleMin: 0.66,
  depthScaleRange: 0.34,
  depthRotateYMax: 12,
  depthIdlePollMs: 240,
};

function initHeroCarousel() {
  if (prefersReduced) return;

  const track = document.getElementById("hero-carousel-track");
  const marquee = document.getElementById("hero-carousel-marquee");
  if (!track || !marquee) return;

  const originals = Array.from(track.querySelectorAll("[data-carousel-slide]")).filter(
    (el) => !el.hasAttribute("data-carousel-clone")
  );
  if (originals.length === 0) return;

  originals.forEach((node) => {
    const copy = node.cloneNode(true);
    copy.setAttribute("data-carousel-clone", "true");
    copy.setAttribute("aria-hidden", "true");
    track.appendChild(copy);
  });

  /** 原卡 + 克隆，景深每帧遍历（NodeList 在克隆后固定） */
  const cards = track.querySelectorAll(".hero-carousel__card");
  if (cards.length === 0) return;

  const cfg = HERO_CAROUSEL;
  const transitionEase = `transform ${cfg.transitionMs}ms cubic-bezier(0.4, 0, 0.2, 1)`;
  const pauseAfterTransitionMs = cfg.idleMsAfterTransition;
  const halfPi = Math.PI * 0.5;

  let offsetPx = 0;
  let slideIndex = 0;
  let firstKickTimer = 0;
  let pauseTimer = 0;
  let depthRafId = 0;
  let depthIdleTimer = 0;

  let marqueeVisible = true;
  let depthFrame = 0;

  const marqueeIo = new IntersectionObserver(
    (entries) => {
      marqueeVisible = entries.some((e) => e.isIntersecting);
    },
    { threshold: 0, rootMargin: "80px" }
  );
  marqueeIo.observe(marquee);

  function readGapPx() {
    const s = window.getComputedStyle(track);
    return parseFloat(s.columnGap || s.gap) || 0;
  }

  function loopWidthPx() {
    const first = originals[0];
    const cloneFirst = track.querySelector("[data-carousel-clone]");
    if (cloneFirst) return cloneFirst.offsetLeft - first.offsetLeft;
    const gap = readGapPx();
    let px = 0;
    for (let i = 0; i < originals.length; i++) {
      px += originals[i].offsetWidth;
      if (i < originals.length - 1) px += gap;
    }
    return px;
  }

  function offsetForSlideIndex(s) {
    const first = originals[0];
    if (s <= 0) return 0;
    const n = originals.length;
    if (s >= n) return loopWidthPx();
    return originals[s].offsetLeft - first.offsetLeft;
  }

  function applyTrackTransform(px, animate) {
    track.style.transition = animate ? transitionEase : "none";
    track.style.transform = `translate3d(${-px}px, 0, 0)`;
  }

  function applyCardDepth() {
    const rect = marquee.getBoundingClientRect();
    const halfW = rect.width * 0.5;
    if (halfW < 8) return;

    const centerX = rect.left + halfW;

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const cr = card.getBoundingClientRect();
      if (cr.width < 4) continue;

      let t = (cr.left + cr.width * 0.5 - centerX) / halfW;
      t = Math.max(-1, Math.min(1, t));
      const u = Math.abs(t);

      const scale = cfg.depthScaleMin + cfg.depthScaleRange * Math.cos(u * halfPi);
      const rotateY = -t * cfg.depthRotateYMax;
      card.style.transform = `translate3d(0, 0, 0) rotateY(${rotateY}deg) scale(${scale})`;
      card.style.zIndex = String(Math.round(10 + 90 * (1 - u)));
    }
  }

  function stopDepthLoop() {
    cancelAnimationFrame(depthRafId);
    clearTimeout(depthIdleTimer);
    depthRafId = 0;
    depthIdleTimer = 0;
  }

  function depthTick() {
    if (!marqueeVisible || document.hidden) {
      depthIdleTimer = window.setTimeout(() => {
        depthIdleTimer = 0;
        depthRafId = requestAnimationFrame(depthTick);
      }, cfg.depthIdlePollMs);
      return;
    }
    depthFrame += 1;
    if (depthFrame % 2 !== 0) {
      depthRafId = requestAnimationFrame(depthTick);
      return;
    }
    applyCardDepth();
    depthRafId = requestAnimationFrame(depthTick);
  }

  function onTrackTransitionEnd(ev) {
    if (ev.target !== track || ev.propertyName !== "transform") return;
    applyCardDepth();
    pauseTimer = window.setTimeout(() => {
      pauseTimer = 0;
      advanceOne();
    }, pauseAfterTransitionMs);
  }

  function onLoopWrapTransitionEnd(ev) {
    if (ev.target !== track || ev.propertyName !== "transform") return;
    applyTrackTransform(0, false);
    offsetPx = 0;
    slideIndex = 0;
    void track.offsetHeight;
    track.style.transition = transitionEase;
    applyCardDepth();
    pauseTimer = window.setTimeout(() => {
      pauseTimer = 0;
      advanceOne();
    }, pauseAfterTransitionMs);
  }

  function advanceOne() {
    const n = originals.length;
    const loopW = loopWidthPx();

    if (n === 0 || loopW <= 0) {
      firstKickTimer = window.setTimeout(advanceOne, cfg.idleMsAfterTransition);
      return;
    }

    if (slideIndex === n - 1) {
      offsetPx = loopW;
      applyTrackTransform(offsetPx, true);
      track.addEventListener("transitionend", onLoopWrapTransitionEnd, { once: true });
      return;
    }

    slideIndex += 1;
    offsetPx = offsetForSlideIndex(slideIndex);
    applyTrackTransform(offsetPx, true);
    track.addEventListener("transitionend", onTrackTransitionEnd, { once: true });
  }

  applyTrackTransform(0, false);
  offsetPx = 0;
  slideIndex = 0;
  void track.offsetHeight;
  track.style.transition = transitionEase;

  firstKickTimer = window.setTimeout(() => {
    firstKickTimer = 0;
    advanceOne();
  }, cfg.firstStepDelayMs);

  depthRafId = requestAnimationFrame(depthTick);

  /** 重建 loopW / 步长；先卸 transitionend，避免 resize 打断动画后重复触发 advanceOne。 */
  function onCarouselResize() {
    track.removeEventListener("transitionend", onTrackTransitionEnd);
    track.removeEventListener("transitionend", onLoopWrapTransitionEnd);
    window.clearTimeout(firstKickTimer);
    window.clearTimeout(pauseTimer);
    pauseTimer = 0;
    stopDepthLoop();

    offsetPx = 0;
    slideIndex = 0;
    track.style.transition = "none";
    applyTrackTransform(0, false);
    void track.offsetHeight;
    track.style.transition = transitionEase;
    applyCardDepth();

    firstKickTimer = window.setTimeout(() => {
      firstKickTimer = 0;
      advanceOne();
    }, cfg.firstStepDelayMs);

    depthRafId = requestAnimationFrame(depthTick);
  }

  const resizeAbort = new AbortController();

  /** 离开页：清定时器、景深、IO、resize signal；卸 transitionend。 */
  function teardownHeroCarousel() {
    track.removeEventListener("transitionend", onTrackTransitionEnd);
    track.removeEventListener("transitionend", onLoopWrapTransitionEnd);
    window.clearTimeout(firstKickTimer);
    firstKickTimer = 0;
    window.clearTimeout(pauseTimer);
    pauseTimer = 0;
    stopDepthLoop();
    marqueeIo.disconnect();
    resizeAbort.abort();
  }

  window.addEventListener("resize", onCarouselResize, { passive: true, signal: resizeAbort.signal });
  window.addEventListener("pagehide", teardownHeroCarousel, { once: true });
}

/**
 * 首屏 Tab：`data-showcase-tab` → `dataset.showcaseTab`（cases | rankings）。
 * - `applySelection`：同步 `aria-selected`、`tabIndex`（仅当前选中有 0）、`hidden` 两个 panel。
 * - 鼠标点击：`selectIndex(..., false)`，焦点由浏览器落在被点按钮上，无需再 `focus()`。
 * - 键盘：`selectIndex(..., true)` 显式 `focus` 下一项，满足 roving tabindex。
 */
function initShowcaseTabs() {
  const tablist = document.querySelector("[data-showcase-tabs]");
  if (!tablist) return;

  const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
  const panelCases = document.getElementById("showcase-panel-cases");
  const panelRankings = document.getElementById("showcase-panel-rankings");
  if (!panelCases || !panelRankings || tabs.length === 0) return;

  function applySelection(index) {
    const i = ((index % tabs.length) + tabs.length) % tabs.length;
    const tab = tabs[i];
    const name = tab.dataset.showcaseTab;

    tabs.forEach((t, idx) => {
      const selected = idx === i;
      t.setAttribute("aria-selected", String(selected));
      t.tabIndex = selected ? 0 : -1;
    });

    const showCases = name === "cases";
    panelCases.hidden = !showCases;
    panelRankings.hidden = showCases;
  }

  function selectIndex(index, focusTab) {
    applySelection(index);
    if (focusTab) {
      const i = ((index % tabs.length) + tabs.length) % tabs.length;
      tabs[i].focus();
    }
  }

  tablist.addEventListener("click", (e) => {
    const tab = e.target.closest('[role="tab"]');
    if (!tab || !tablist.contains(tab)) return;
    const idx = tabs.indexOf(tab);
    if (idx >= 0) selectIndex(idx, false);
  });

  tablist.addEventListener("keydown", (e) => {
    const focused = document.activeElement;
    const idx = tabs.indexOf(focused);
    if (idx < 0) return;

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      selectIndex(idx + 1, true);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      selectIndex(idx - 1, true);
    } else if (e.key === "Home") {
      e.preventDefault();
      selectIndex(0, true);
    } else if (e.key === "End") {
      e.preventDefault();
      selectIndex(tabs.length - 1, true);
    }
  });
}

/**
 * 初始化顺序：`initShowcaseTabs` 在 `initHeroCarousel` 之前，保证 DOM 中 Tab 与面板已就绪；
 * 轮播依赖 `#hero-carousel-track` 等 id，与 Tab 无竞态。
 */
function init() {
  initHeaderTypewriter();
  initHeroAccentTypewriter();
  initReveal();
  initForm();
  initHeaderScroll();
  initShowcaseTabs();
  initHeroCarousel();
}

init();
