/**
 * Landing: header scroll collapse, marquee carousel clone, CTA form stub.
 */
const prefersReduced =
  typeof matchMedia !== "undefined" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

/** 全站头部 Logo 文案（与 HTML title / 文案一致） */
const SITE_NAME_LOGO = "AI OPENCODE HUB";

/** Hero 主标题高亮区循环：AI HUB ↔ AI OPENCODE */
const HERO_ACCENT_CYCLE = ["AI HUB", "AI OPENCODE"];

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
  /* 减少动态效果：不注入 reveal 样式，内容默认可见（.reveal 仅在下文添加） */
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
 * 无缝循环：复制一组卡片接在末尾，配合 CSS translateX(-50%) 与 linear 动画。
 * 开启「减少动态效果」时不克隆、不运行动画（由 CSS 处理）。
 */
function initHeroCarousel() {
  const track = document.getElementById("hero-carousel-track");
  if (!track || prefersReduced) return;

  const originals = track.querySelectorAll("[data-carousel-slide]");
  if (originals.length === 0) return;

  originals.forEach((node) => {
    const copy = node.cloneNode(true);
    copy.setAttribute("data-carousel-clone", "true");
    copy.setAttribute("aria-hidden", "true");
    track.appendChild(copy);
  });
}

/**
 * 视差式环绕：以跑马灯可视区域水平中心为轴，动态 scale + rotateY。
 * mode "center-focus"：中间大、两侧小（默认 Cover Flow 感）
 * mode "edge-focus"：两侧大、中间小（凹弧 / 隧道感）
 */
function initHeroCarouselDepth() {
  if (prefersReduced) return;

  const marquee = document.getElementById("hero-carousel-marquee");
  const track = document.getElementById("hero-carousel-track");
  if (!marquee || !track) return;

  /** @type {"center-focus" | "edge-focus"} */
  const mode = "center-focus";

  /** 克隆完成后一次性缓存，避免每帧 querySelectorAll */
  const cardElements = track.querySelectorAll(".hero-carousel__card");
  if (cardElements.length === 0) return;

  let visible = true;
  /** 隔帧更新景深，减轻 layout + 合成压力（轨道 CSS 动画仍为 60fps） */
  let depthFrame = 0;

  const io = new IntersectionObserver(
    (entries) => {
      visible = entries.some((e) => e.isIntersecting);
    },
    { root: null, threshold: 0, rootMargin: "80px" }
  );
  io.observe(marquee);

  const halfPi = Math.PI * 0.5;

  function applyDepth() {
    const rect = marquee.getBoundingClientRect();
    const halfW = rect.width * 0.5;
    if (halfW < 8) return;

    const centerX = rect.left + halfW;

    for (let i = 0; i < cardElements.length; i++) {
      const card = cardElements[i];
      const cr = card.getBoundingClientRect();
      if (cr.width < 4) continue;

      const cardCenterX = cr.left + cr.width * 0.5;
      let t = (cardCenterX - centerX) / halfW;
      if (t < -1) t = -1;
      if (t > 1) t = 1;

      const u = Math.abs(t);

      let scale;
      if (mode === "center-focus") {
        scale = 0.82 + 0.18 * Math.cos(u * halfPi);
      } else {
        scale = 0.82 + 0.18 * Math.sin(u * halfPi);
      }

      const rotateY = -t * 9;
      card.style.transform = `translate3d(0, 0, 0) rotateY(${rotateY}deg) scale(${scale})`;
      card.style.zIndex = String(Math.round(10 + 90 * (1 - u)));
    }
  }

  /** 不可见时降频，避免 60fps 空转 rAF */
  const idlePollMs = 240;

  function tick() {
    if (!visible || document.hidden) {
      window.setTimeout(() => requestAnimationFrame(tick), idlePollMs);
      return;
    }
    depthFrame += 1;
    if (depthFrame % 2 !== 0) {
      requestAnimationFrame(tick);
      return;
    }
    applyDepth();
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

function init() {
  initHeaderTypewriter();
  initHeroAccentTypewriter();
  initReveal();
  initForm();
  initHeaderScroll();
  initHeroCarousel();
  initHeroCarouselDepth();
}

init();
