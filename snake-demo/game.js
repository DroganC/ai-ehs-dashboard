// 贪吃蛇（消防主题）游戏逻辑。
// - 对外暴露 mount/unmount，方便在页面/容器中挂载与卸载
// - 移动端优先：支持按钮、滑动、以及“按棋盘四象限点击转向”
const PASS_SCORE = 60;
const TOTAL_STAGES = 3;
// 棋盘上同时存在的道具数量，以及其中“加分道具”的最小数量约束。
// 这样玩家任意时刻都至少有两个“正确选择”可吃，避免全屏都是扣分道具带来的挫败感。
const TOTAL_FOODS = 3;
const MIN_POSITIVE_FOODS = 2;
// 目标格子尺寸（CSS 像素）。值越小 → 同屏格子越多（但也更难点按/操控）。
const TARGET_CELL_PX = 32;
const MIN_GRID = 8;
// 上限调大，否则列/行数会被卡住，格子不会继续变多。
const MAX_GRID = 32;
// 障碍物数量：按棋盘面积占比生成，但上限固定（避免后期过难/无路可走）。
const OBSTACLE_DENSITY = 0.08;
const OBSTACLE_MAX = 3;
// 自动模式移动速度下限：避免过快导致无法操控。
const LOOP_MIN_MS = 95;
// 手势/轻点阈值：用于区分 swipe 与 tap。
const SWIPE_THRESHOLD_PX = 20;
const TAP_MOVE_THRESHOLD_PX = 10;
const TAP_TIME_MS = 350;
// 自动模式移动间隔（ms）。如需“难度”，建议做成显式配置/按钮，而不是残留隐藏状态。
const AUTO_MOVE_MS = 220;
const RIPPLE_PERIOD_MS = 1300;
// 图标按“英文 id”映射，避免在代码逻辑中使用中文 key
const ITEM_ICON_BY_ID = {
  ext_water: "💦",
  ext_foam: "🫧",
  ext_co2: "🧯",
  ext_powder: "🧯",
  power_off: "🔌",
  power_on: "⚡",
  bucket_water: "🪣",
  obstacle: "🧱",
  correct_1: "✅",
  correct_2: "🟢",
};

// 关卡数据（原先在 data.js 中单独维护；为了便于分发与加载顺序，这里合并到 game.js）。
// 说明：使用 window.gameData 以兼容既有读取逻辑（LEVELS = window.gameData）。
window.gameData = [
  {
    id: 0,
    title: "锂电池着火",
    notice: "锂电池仓储区突发初期火灾，注意选择适配的灭火器",
    items: [
      { id: "ext_water", label: "水基灭火器", points: 3 },
      { id: "ext_foam", label: "泡沫灭火器", points: 2 },
      { id: "ext_co2", label: "二氧化碳灭火器", points: -2 },
      { id: "ext_powder", label: "干粉灭火器", points: -1 },
      { id: "obstacle", label: "障碍物", points: -3 },
    ],
  },
  {
    id: 1,
    title: "精密仪器着火",
    notice: "配电间及精密仪器实验室突发初期火灾，注意选择适配的灭火器",
    items: [
      { id: "power_off", label: "断电操作", points: 2 },
      { id: "ext_co2", label: "二氧化碳灭火器", points: 3 },
      { id: "power_on", label: "不断电操作", points: -2 },
      { id: "ext_powder", label: "干粉灭火器", points: 1 },
      { id: "ext_water", label: "水基灭火器", points: -5 },
      { id: "ext_foam", label: "泡沫灭火器", points: -5 },
      { id: "obstacle", label: "障碍物", points: -3 },
    ],
  },
  {
    id: 2,
    title: "电解液/油类着火",
    notice: "电解液仓库及导热油锅炉房突发初期火灾，注意选择适配的灭火工具",
    items: [
      { id: "ext_foam", label: "泡沫灭火器", points: 3 },
      { id: "ext_powder", label: "干粉灭火器", points: 1 },
      { id: "ext_co2", label: "二氧化碳灭火器", points: 1 },
      { id: "bucket_water", label: "一桶水", points: -5 },
      { id: "ext_water", label: "水基灭火器", points: -5 },
      { id: "obstacle", label: "障碍物", points: -3 },
    ],
  },
];

class SnakeDemoGame {
  constructor() {
  /**
   * 这里采用“构造函数内闭包”的写法：
   * - 好处：绝大多数函数/状态保持私有，不污染全局。
   * - 代价：不是传统的 class method 组织方式（后续如需复用/单测可再改成显式方法）。
   */
  function pickItemColor(points) {
    if (points > 0) return "#71e6b1";
    if (points < 0) return "#ff6b6b";
    return "#5fb3ff";
  }

  let mounted = false;
  // 棋盘是“正方形格子”，但棋盘整体允许是长方形（列数/行数可不同）。
  let gridCols = 12;
  let gridRows = 12;
  // 单个格子的边长（正方形，单位：CSS 像素）
  let cell = TARGET_CELL_PX;
  // 棋盘在 canvas 内的实际像素尺寸（CSS 像素）
  let boardW = gridCols * cell;
  let boardH = gridRows * cell;
  // 让棋盘居中：棋盘左上角相对于 canvas 的偏移（CSS 像素）
  let offsetX = 0;
  let offsetY = 0;
  // DPR：让高清屏更清晰（canvas 实际像素 = CSS 像素 * DPR）
  let dpr = 1;
  let resizeRaf = 0;

  /** @type {HTMLCanvasElement | null} */
  let canvas = null;
  /** @type {CanvasRenderingContext2D | null} */
  let ctx = null;
  /** @type {HTMLElement | null} */
  let scoreEl = null;
  /** @type {HTMLElement | null} */
  let levelEl = null;
  /** @type {HTMLElement | null} */
  let overlay = null;
  /** @type {HTMLElement | null} */
  let overlayTitle = null;
  /** @type {HTMLElement | null} */
  let overlayText = null;
  /** @type {HTMLElement | null} */
  let overlayContent = null;
  /** @type {HTMLButtonElement | null} */
  let overlayStartBtn = null;
  /** @type {HTMLElement | null} */
  let mobileControlsEl = null;

  const state = {
    // 蛇身：数组头部是蛇头
    snake: [],
    direction: "right",
    nextDirection: "right",
    // 棋盘道具列表（同时存在多个）。item.points > 0 为加分道具（会画波纹提示）。
    foods: [],
    obstacles: [],
    // 当前关卡（1-3）
    stage: 1,
    // 当前关卡积分（达到 60 通关；<0 失败）
    score: 0,
    // 全程累计积分（用于最高分）
    totalScore: 0,
    // auto：自动持续移动；manual：每次输入方向才移动一格
    mode: "auto", // auto | manual
    status: "ready", // ready | running | paused | gameover
    timer: null,
  };

  const handlers = {
    keydown: null,
    mobileClick: null,
    mobilePointerDown: null,
    mobilePointerUp: null,
    canvasPointerDown: null,
    canvasPointerUp: null,
    touchstart: null,
    touchend: null,
    resize: null,
    overlayStart: null,
  };

  const LEVELS = Array.isArray(window.gameData) ? window.gameData : [];
  let renderRaf = 0;

  function getLevelDataByIndex(levelIndex) {
    if (!LEVELS.length) return null;
    const idx = ((levelIndex % LEVELS.length) + LEVELS.length) % LEVELS.length;
    return LEVELS[idx] || null;
  }

  function getStageData() {
    return getLevelDataByIndex(state.stage - 1);
  }

  function getStageItems() {
    const levelData = getStageData();
    const items = Array.isArray(levelData?.items) ? levelData.items : [];
    const normalized = items
      .filter((it) => it && it.id !== "obstacle")
      .map((it) => {
        const pts = Number(it.points || 0);
        return {
          id: String(it.id || "unknown"),
          label: String(it.label || it.id || "Item"),
          points: pts,
          icon: getItemIcon(String(it.id || "")),
          color: pickItemColor(pts),
        };
      });

    const positives = normalized.filter((it) => it.points > 0);
    if (positives.length >= 2) return normalized.length ? normalized : positives;

    // 兜底：确保至少 2 个“正确（加分）道具”可刷
    const ensure = [...normalized];
    const addCorrect = (id, label, points) => {
      if (ensure.some((it) => it.id === id)) return;
      ensure.push({ id, label, points, icon: getItemIcon(id), color: pickItemColor(points) });
    };
    addCorrect("correct_1", "正确处置 1", 2);
    addCorrect("correct_2", "正确处置 2", 3);
    return ensure.length
      ? ensure
      : [{ id: "correct_1", label: "正确处置", icon: getItemIcon("correct_1"), points: 2, color: pickItemColor(2) }];
  }

  function getObstaclePenalty() {
    const levelData = getStageData();
    const items = Array.isArray(levelData?.items) ? levelData.items : [];
    const obstacle = items.find((it) => it && it.id === "obstacle");
    if (obstacle && Number.isFinite(Number(obstacle.points))) return Number(obstacle.points);
    return -1;
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function getItemIcon(itemId) {
    return ITEM_ICON_BY_ID[itemId] || "🎯";
  }

  function describeItemEffect(itemId, points) {
    if (itemId === "obstacle") {
      return `障碍惩罚：碰到会扣分，尽量绕开。`;
    }
    if (itemId === "power_off") {
      return `处置关键步骤：执行后加分，降低触电/二次风险。`;
    }
    if (itemId === "power_on") {
      return `高风险行为：可能引发触电与扩大事故，吃到会扣分。`;
    }
    if (points > 0) return `正确选择：吃到加 ${points} 分。`;
    if (points < 0) return `不适配：吃到扣 ${Math.abs(points)} 分。`;
    return `影响：得分变化较小。`;
  }

  function redirectToSuccessPage() {
    window.location.href = `./success.html?stage=${encodeURIComponent(String(state.stage))}&score=${encodeURIComponent(String(state.totalScore))}`;
  }

  function applyScoreDelta(delta) {
    const d = Number(delta || 0);
    // 积分下限：最低为 0（不会出现负分）
    state.score = Math.max(0, state.score + d);
    state.totalScore = Math.max(0, state.totalScore + d);
  }

  function checkPassOrFail() {
    if (state.score >= PASS_SCORE) {
      if (state.stage >= TOTAL_STAGES) {
        state.status = "gameover";
        stopLoop();
        redirectToSuccessPage();
        return;
      }

      // 进入下一关
      stopLoop();
      state.stage += 1;
      state.score = 0;
      state.status = "ready";
      initBoard();
      showStartOverlay();
      updateUI();
    }
  }

  function getEl(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error(`SnakeDemo: missing element #${id}`);
    return el;
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  // 兼容 iOS Safari：部分版本不支持 ctx.roundRect()
  // 这里统一用 roundRectPath 生成圆角矩形路径。
  function roundRectPath(context, x, y, w, h, r) {
    const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    if (typeof context.roundRect === "function") {
      context.roundRect(x, y, w, h, radius);
      return;
    }

    const right = x + w;
    const bottom = y + h;
    context.moveTo(x + radius, y);
    context.lineTo(right - radius, y);
    context.arcTo(right, y, right, y + radius, radius);
    context.lineTo(right, bottom - radius);
    context.arcTo(right, bottom, right - radius, bottom, radius);
    context.lineTo(x + radius, bottom);
    context.arcTo(x, bottom, x, bottom - radius, radius);
    context.lineTo(x, y + radius);
    context.arcTo(x, y, x + radius, y, radius);
  }

  function computeLayoutFromCanvas() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(1, Math.floor(rect.width));
    const cssH = Math.max(1, Math.floor(rect.height));
    dpr = window.devicePixelRatio || 1;

    // 使用“正方形格子”。
    // 先按目标格子大小估算列/行数，再反推实际 cell，保证：
    // - cell 是正方形（同一边长）
    // - 棋盘完整放进 canvas
    const proposedCols = Math.floor(cssW / TARGET_CELL_PX);
    const proposedRows = Math.floor(cssH / TARGET_CELL_PX);
    gridCols = clamp(proposedCols, MIN_GRID, MAX_GRID);
    gridRows = clamp(proposedRows, MIN_GRID, MAX_GRID);
    cell = Math.max(1, Math.floor(Math.min(cssW / gridCols, cssH / gridRows)));
    boardW = gridCols * cell;
    boardH = gridRows * cell;
    offsetX = Math.floor((cssW - boardW) / 2);
    offsetY = Math.floor((cssH - boardH) / 2);

    // 关键点：
    // - canvas.width/height 决定“像素分辨率”
    // - CSS width/height 决定“显示大小”
    // 这里用 DPR 放大像素分辨率，避免高清屏发糊。
    canvas.width = Math.max(1, Math.floor(cssW * dpr));
    canvas.height = Math.max(1, Math.floor(cssH * dpr));

    if (ctx) {
      // 使用缩放矩阵：后续所有绘制都用 CSS 像素坐标即可
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  function initBoard() {
    // 初始化棋盘：蛇出生在棋盘中心附近，向右前进
    const midX = Math.floor(gridCols / 2);
    const midY = Math.floor(gridRows / 2);
    state.snake = [{ x: midX, y: midY }];
    state.direction = "right";
    state.nextDirection = "right";
    // 障碍物数量按棋盘面积比例生成（有上下限）
    const area = gridCols * gridRows;
    const obstacleCount = clamp(Math.floor(area * OBSTACLE_DENSITY), 0, OBSTACLE_MAX);
    state.obstacles = randomObstacles(state.snake, obstacleCount);
    state.foods = randomFoods(state.snake, state.obstacles);
    updateUI();
    render();
  }

  function initRun() {
    // 全新一局：关卡回到 1，分数清零
    state.stage = 1;
    state.score = 0;
    state.totalScore = 0;
    state.status = "ready";
    initBoard();
  }

  function startGame() {
    // 开局/继续：进入 running 状态；自动模式会启动定时 tick
    if (state.status === "running") return;
    if (state.status === "gameover" || state.status === "ready") {
      initBoard();
    }
    state.status = "running";
    if (state.mode === "auto") {
      loop();
    }
    hideOverlay();
    updateUI();
  }

  function pauseGame() {
    // 暂停：停止定时器，显示遮罩
    if (state.status !== "running") return;
    state.status = "paused";
    stopLoop();
    showOverlay({ title: "游戏暂停", subtitle: "空格暂停/继续，R 重开，M 切换模式" });
    updateUI();
  }

  function resumeGame() {
    // 继续：自动模式恢复定时器
    if (state.status !== "paused") return;
    state.status = "running";
    if (state.mode === "auto") {
      loop();
    }
    hideOverlay();
    updateUI();
  }

  function restartGame() {
    // 重开：清理定时器并重新初始化
    stopLoop();
    initRun();
    showStartOverlay();
    updateUI();
  }

  function loop() {
    stopLoop();
    const speedMs = Math.max(LOOP_MIN_MS, Math.floor(AUTO_MOVE_MS));
    state.timer = window.setInterval(tick, speedMs);
  }

  function stopLoop() {
    if (state.timer !== null) {
      window.clearInterval(state.timer);
      state.timer = null;
    }
  }

  function tick() {
    if (!ctx || !canvas) return;
    // 每一步：先确定方向，再前进一步
    state.direction = state.nextDirection;
    const head = state.snake[0];
    const nextHead = wrapPoint(nextPoint(head, state.direction));
    const selfHitIndex = findSnakePartIndex(nextHead, state.snake);

    // 将新头插入
    state.snake.unshift(nextHead);

    if (selfHitIndex !== -1) {
      // 撞到自己：
      // - 不直接 Game Over（更偏“训练/闯关”）
      // - 通过“截断尾巴 + 扣分”作为惩罚；扣分仍受最低 0 的约束
      const removedSegments = state.snake.length - 1 - selfHitIndex;
      state.snake = state.snake.slice(0, selfHitIndex + 1);
      applyScoreDelta(-removedSegments);
    }

    if (isObstacleCollision(nextHead, state.obstacles)) {
      // 撞障碍：按关卡规则扣分，不截断（避免和“自撞截断”叠加过重）
      const penalty = getObstaclePenalty();
      applyScoreDelta(penalty);
    }

    const foodIndex = state.foods.findIndex((f) => f.x === nextHead.x && f.y === nextHead.y);
    if (foodIndex !== -1) {
      // 吃到道具：按关卡规则加/减分并刷新该位置的道具
      const eaten = state.foods[foodIndex];
      applyScoreDelta(eaten.item.points);
      state.foods.splice(foodIndex, 1);
      respawnFood(state.snake, state.obstacles);
    } else {
      // 没吃到：正常移动（尾巴出队）
      state.snake.pop();
    }

    checkPassOrFail();
    updateUI();
    if (state.mode === "auto" && state.status === "running") {
      loop();
    }
    render();
  }

  function nextPoint(point, direction) {
    if (direction === "up") return { x: point.x, y: point.y - 1 };
    if (direction === "down") return { x: point.x, y: point.y + 1 };
    if (direction === "left") return { x: point.x - 1, y: point.y };
    return { x: point.x + 1, y: point.y };
  }

  function wrapPoint(point) {
    // 穿墙：超出边界则从另一侧出现
    return {
      x: (point.x + gridCols) % gridCols,
      y: (point.y + gridRows) % gridRows,
    };
  }

  function findSnakePartIndex(point, snake) {
    return snake.findIndex((part) => part.x === point.x && part.y === point.y);
  }

  function isObstacleCollision(point, obstacles) {
    return obstacles.some((item) => item.x === point.x && item.y === point.y);
  }

  function randomFoodPositionAvoiding(snake, obstacles, foods, preferPositive) {
    const items = getStageItems();
    const pool = preferPositive ? items.filter((it) => it.points > 0) : items;
    const pickFrom = pool.length ? pool : items;
    let food = { x: 0, y: 0, item: pickFrom[0] };
    let safeGuard = 0;
    do {
      food = {
        x: Math.floor(Math.random() * gridCols),
        y: Math.floor(Math.random() * gridRows),
        item: pickFrom[Math.floor(Math.random() * pickFrom.length)],
      };
      safeGuard += 1;
    } while (
      (snake.some((part) => part.x === food.x && part.y === food.y) ||
        obstacles.some((item) => item.x === food.x && item.y === food.y) ||
        foods.some((f) => f.x === food.x && f.y === food.y)) &&
      // 防死循环：棋盘空间不足时允许“尽力而为”返回最后一次生成的点
      safeGuard < 1200
    );
    return food;
  }

  function randomFoods(snake, obstacles) {
    // 初始刷道具：前 MIN_POSITIVE_FOODS 个强制从“加分池”里选，确保同时至少两个加分道具在场。
    const foods = [];
    const total = Math.max(MIN_POSITIVE_FOODS, TOTAL_FOODS);
    for (let i = 0; i < total; i += 1) {
      const preferPositive = i < MIN_POSITIVE_FOODS;
      foods.push(randomFoodPositionAvoiding(snake, obstacles, foods, preferPositive));
    }
    return foods;
  }

  function respawnFood(snake, obstacles) {
    const positiveCount = state.foods.filter((f) => f.item.points > 0).length;
    const needPositive = positiveCount < MIN_POSITIVE_FOODS;
    // 吃到道具后立刻补回一个；当场上加分道具不足时，强制优先生成加分道具以维持约束。
    const next = randomFoodPositionAvoiding(snake, obstacles, state.foods, needPositive);
    state.foods.push(next);
  }

  function randomObstacles(snake, count) {
    const obstacles = [];
    let safeGuard = 0;
    while (obstacles.length < count && safeGuard < 2000) {
      safeGuard += 1;
      const item = {
        x: Math.floor(Math.random() * gridCols),
        y: Math.floor(Math.random() * gridRows),
      };
      const conflictWithSnake = snake.some((part) => part.x === item.x && part.y === item.y);
      const conflictWithObstacle = obstacles.some((part) => part.x === item.x && part.y === item.y);
      if (conflictWithSnake || conflictWithObstacle) continue;
      obstacles.push(item);
    }
    return obstacles;
  }

  function updateUI() {
    if (!scoreEl || !levelEl) return;
    const levelData = getStageData();
    levelEl.textContent = levelData?.title ? String(levelData.title) : `关卡 ${state.stage}`;
    scoreEl.textContent = String(state.score);
  }

  function showOverlay({ title, subtitle, contentHtml, showStart }) {
    if (!overlay || !overlayTitle || !overlayText || !overlayContent || !overlayStartBtn) return;
    overlayTitle.textContent = String(title || "");
    overlayText.textContent = String(subtitle || "");
    overlayContent.innerHTML = contentHtml ? String(contentHtml) : "";
    overlayStartBtn.style.display = showStart ? "inline-flex" : "none";
    overlay.classList.add("show");
  }

  function hideOverlay() {
    if (!overlay) return;
    overlay.classList.remove("show");
  }

  function showStartOverlay() {
    const levelData = getStageData();
    const title = levelData?.title ? String(levelData.title) : "未命名关卡";
    const notice = levelData?.notice ? String(levelData.notice) : "请根据道具效果进行处置。";
    const items = Array.isArray(levelData?.items) ? levelData.items : [];

    const content = `
      <div class="item-grid">
        ${items
          .map((it) => {
            const itemId = String(it?.id || "unknown");
            const label = String(it?.label || itemId);
            const pts = Number(it.points || 0);
            const tone = pts > 0 ? "good" : pts < 0 ? "bad" : "neutral";
            const sign = pts > 0 ? "+" : "";
            return `
              <div class="item-row ${tone}">
                <div class="item-icon" aria-hidden="true">${escapeHtml(getItemIcon(itemId))}</div>
                <div class="item-main">
                  <div class="item-title">
                    <span class="item-name">${escapeHtml(label)}</span>
                    <span class="item-points ${tone}">${escapeHtml(`${sign}${pts} 分`)}</span>
                  </div>
                  <div class="item-desc">${escapeHtml(describeItemEffect(itemId, pts))}</div>
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    `;

    showOverlay({
      title: `关卡 ${state.stage}：${title}`,
      subtitle: notice,
      contentHtml: content,
      showStart: true,
    });
  }

  function drawGrid() {
    if (!ctx || !canvas) return;
    // 网格线仅画在“棋盘区域”内（不覆盖两侧留白）
    ctx.strokeStyle = "rgba(126, 170, 206, 0.18)";
    ctx.lineWidth = 1;
    for (let c = 0; c <= gridCols; c += 1) {
      const x = offsetX + c * cell;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, offsetY + boardH);
      ctx.stroke();
    }
    for (let r = 0; r <= gridRows; r += 1) {
      const y = offsetY + r * cell;
      ctx.beginPath();
      ctx.moveTo(offsetX, y);
      ctx.lineTo(offsetX + boardW, y);
      ctx.stroke();
    }
  }

  function drawFood() {
    if (!ctx) return;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    state.foods.forEach((food) => {
      const x = offsetX + food.x * cell;
      const y = offsetY + food.y * cell;
      const cx = x + cell / 2;
      const cy = y + cell / 2;
      const r = cell / 2 - 5;
      const size = Math.max(8, Math.floor(r * 2));
      const sx = Math.floor(cx - size / 2);
      const sy = Math.floor(cy - size / 2);
      const radius = Math.max(6, Math.floor(cell * 0.18));

      if (food.item.points > 0) {
        // “正确/加分道具”用波纹提示（在 canvas 内实现，而不是弹框里做 DOM 动效）
        const t = (now % RIPPLE_PERIOD_MS) / RIPPLE_PERIOD_MS;
        const maxR = r + cell * 0.55;
        const minR = Math.max(2, r * 0.75);
        const ringR = minR + (maxR - minR) * t;
        const alpha = 0.55 * (1 - t);

        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = `rgba(113, 230, 177, ${alpha.toFixed(4)})`;
        ctx.lineWidth = Math.max(1.5, Math.floor(cell * 0.06));
        ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.strokeStyle = `rgba(255, 255, 255, ${(alpha * 0.55).toFixed(4)})`;
        ctx.lineWidth = Math.max(1, Math.floor(cell * 0.035));
        ctx.arc(cx, cy, ringR * 0.72, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      ctx.beginPath();
      ctx.fillStyle = food.item.color;
      // 道具底形：方形（更贴合格子），用圆角避免生硬。
      roundRectPath(ctx, sx, sy, size, size, radius);
      ctx.fill();

      // 高光：左上角一条小亮边，增强立体感
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
      ctx.lineWidth = Math.max(1, Math.floor(cell * 0.04));
      ctx.moveTo(sx + radius * 0.65, sy + radius * 0.65);
      ctx.lineTo(sx + size * 0.62, sy + radius * 0.65);
      ctx.stroke();

      ctx.font = `${Math.max(16, Math.floor(cell * 0.42))}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(food.item.icon, cx, cy + 1);
    });
  }

  function drawObstacles() {
    if (!ctx) return;
    state.obstacles.forEach((item) => {
      const x = offsetX + item.x * cell + 4;
      const y = offsetY + item.y * cell + 4;
      const sizeW = cell - 8;
      const sizeH = cell - 8;

      ctx.fillStyle = "#7163c9";
      ctx.beginPath();
      roundRectPath(ctx, x, y, sizeW, sizeH, 6);
      ctx.fill();

      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.beginPath();
      ctx.arc(x + 6, y + 6, 2, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawSnake() {
    if (!ctx) return;
    state.snake.forEach((part, index) => {
      const x = offsetX + part.x * cell + 3;
      const y = offsetY + part.y * cell + 3;
      const sizeW = cell - 6;
      const sizeH = cell - 6;
      const radius = Math.max(8, Math.floor(cell * 0.22));
      ctx.fillStyle = index === 0 ? "#7df7c8" : "#57dcab";
      ctx.shadowColor = "rgba(0, 0, 0, 0.18)";
      ctx.shadowBlur = 4;
      ctx.beginPath();
      roundRectPath(ctx, x, y, sizeW, sizeH, radius);
      ctx.fill();
      ctx.shadowBlur = 0;
      if (index === 0) drawHeadFace(part);
    });
  }

  function drawHeadFace(head) {
    if (!ctx) return;
    const baseX = offsetX + head.x * cell;
    const baseY = offsetY + head.y * cell;
    let leftEye = { x: baseX + 8, y: baseY + 8 };
    let rightEye = { x: baseX + 16, y: baseY + 8 };

    if (state.direction === "left") {
      leftEye = { x: baseX + 7, y: baseY + 8 };
      rightEye = { x: baseX + 7, y: baseY + 16 };
    } else if (state.direction === "right") {
      leftEye = { x: baseX + 17, y: baseY + 8 };
      rightEye = { x: baseX + 17, y: baseY + 16 };
    } else if (state.direction === "down") {
      leftEye = { x: baseX + 8, y: baseY + 17 };
      rightEye = { x: baseX + 16, y: baseY + 17 };
    }

    ctx.fillStyle = "#173838";
    ctx.beginPath();
    ctx.arc(leftEye.x, leftEye.y, 2, 0, Math.PI * 2);
    ctx.arc(rightEye.x, rightEye.y, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawGrass() {
    if (!ctx || !canvas) return;
    // 草地铺满整个画布底部（不留两侧空白），让视觉更饱满
    const grassH = Math.max(34, Math.min(84, Math.floor(cell * 1.15)));
    const canvasW = canvas.width / dpr;
    const canvasH = canvas.height / dpr;
    const topY = canvasH - grassH;

    // Base gradient
    const grad = ctx.createLinearGradient(0, topY, 0, canvasH);
    grad.addColorStop(0, "#b7f2b7");
    grad.addColorStop(0.55, "#86dc8b");
    grad.addColorStop(1, "#6acb79");
    ctx.fillStyle = grad;
    ctx.fillRect(0, topY, canvasW, grassH);

    // Wavy edge
    ctx.beginPath();
    ctx.moveTo(0, topY);
    const amp = Math.max(6, Math.min(16, Math.floor(cell * 0.22)));
    const step = Math.max(18, Math.floor(cell * 0.55));
    for (let x = 0; x <= canvasW + step; x += step) {
      const y = topY + Math.sin((x / step) * 1.2) * amp;
      ctx.quadraticCurveTo(x - step / 2, y + amp * 0.5, x, y);
    }
    ctx.lineTo(canvasW, canvasH);
    ctx.lineTo(0, canvasH);
    ctx.closePath();
    ctx.fillStyle = "rgba(64, 167, 93, 0.22)";
    ctx.fill();

    // Sprinkle tiny flowers/dots (deterministic-ish)
    const seed = state.score + state.snake.length * 13 + gridCols * 97 + gridRows * 131;
    const rand = (n) => {
      const t = Math.sin(n) * 10000;
      return t - Math.floor(t);
    };

    const dots = Math.max(10, Math.floor(canvasW / 42));
    for (let i = 0; i < dots; i += 1) {
      const r = 1.5 + rand(seed + i * 7) * 2.2;
      const x = rand(seed + i * 11) * canvasW;
      const y = topY + rand(seed + i * 17) * (grassH - 6) + 3;
      const pick = rand(seed + i * 23);
      ctx.fillStyle =
        pick < 0.33
          ? "rgba(255, 255, 255, 0.55)"
          : pick < 0.66
            ? "rgba(255, 233, 120, 0.6)"
            : "rgba(255, 163, 206, 0.55)";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function render() {
    if (!ctx || !canvas) return;
    const canvasW = canvas.width / dpr;
    const canvasH = canvas.height / dpr;
    ctx.clearRect(0, 0, canvasW, canvasH);
    ctx.fillStyle = "#b9e6ff";
    ctx.fillRect(0, 0, canvasW, canvasH);
    drawGrass();
    drawGrid();
    drawObstacles();
    drawFood();
    drawSnake();
  }

  function scheduleRenderLoop() {
    if (!mounted) return;
    if (renderRaf) return;
    const loop = () => {
      renderRaf = 0;
      render();
      scheduleRenderLoop();
    };
    // 使用 RAF 的目的：让波纹等“纯视觉动画”在蛇不移动时也能持续刷新。
    renderRaf = window.requestAnimationFrame(loop);
  }

  function stopRenderLoop() {
    if (!renderRaf) return;
    window.cancelAnimationFrame(renderRaf);
    renderRaf = 0;
  }

  function updateDirectionByKey(key) {
    if (state.status === "ready") startGame();
    if (state.status !== "running") return;

    const current = state.direction;
    let changed = false;
    if (key === "ArrowUp" && current !== "down") {
      state.nextDirection = "up";
      changed = true;
    }
    if (key === "ArrowDown" && current !== "up") {
      state.nextDirection = "down";
      changed = true;
    }
    if (key === "ArrowLeft" && current !== "right") {
      state.nextDirection = "left";
      changed = true;
    }
    if (key === "ArrowRight" && current !== "left") {
      state.nextDirection = "right";
      changed = true;
    }

    if (changed && state.mode === "manual") tick();
  }

  function updateDirectionByName(direction) {
    const map = {
      up: "ArrowUp",
      down: "ArrowDown",
      left: "ArrowLeft",
      right: "ArrowRight",
    };
    const key = map[direction];
    if (!key) return;
    updateDirectionByKey(key);
  }

  function mount() {
    // 挂载：绑定 DOM / 事件监听，并启动游戏
    if (mounted) return;
    mounted = true;

    canvas = /** @type {HTMLCanvasElement} */ (getEl("game"));
    ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("SnakeDemo: canvas 2d context unavailable");

    computeLayoutFromCanvas();

    scoreEl = getEl("score");
    levelEl = getEl("level");

    overlay = getEl("overlay");
    overlayTitle = getEl("overlay-title");
    overlayText = getEl("overlay-text");
    overlayContent = getEl("overlay-content");
    overlayStartBtn = /** @type {HTMLButtonElement} */ (getEl("overlay-start"));
    mobileControlsEl = getEl("mobile-controls");

    let touchStartX = 0;
    let touchStartY = 0;
    let tapStartX = 0;
    let tapStartY = 0;
    let tapStartAt = 0;

    handlers.keydown = (event) => {
      const { key } = event;
      if (key.startsWith("Arrow")) {
        event.preventDefault();
        updateDirectionByKey(key);
        return;
      }

      if (key === " ") {
        event.preventDefault();
        if (state.status === "ready") startGame();
        else if (state.status === "running") pauseGame();
        else if (state.status === "paused") resumeGame();
        return;
      }

      if (key === "r" || key === "R") {
        event.preventDefault();
        restartGame();
        return;
      }

      if (key === "m" || key === "M") {
        event.preventDefault();
        state.mode = state.mode === "auto" ? "manual" : "auto";
        if (state.status === "running") {
          if (state.mode === "auto") loop();
          else stopLoop();
        }
        if (overlayText) {
          overlayText.textContent =
            state.mode === "auto" ? "自动模式：会持续移动" : "手动模式：每次输入方向才移动一格";
        }
        updateUI();
      }
    };

    handlers.mobileClick = (event) => {
      const button = event.target.closest("[data-dir]");
      if (!button) return;
      const direction = button.dataset.dir;
      updateDirectionByName(direction);
    };

    handlers.mobilePointerDown = (event) => {
      const button = event.target.closest("[data-dir]");
      if (!button) return;
      button.classList.add("pressed");
    };

    handlers.mobilePointerUp = (event) => {
      const button = event.target.closest("[data-dir]");
      if (!button) return;
      button.classList.remove("pressed");
    };

    handlers.touchstart = (event) => {
      const touch = event.changedTouches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
    };

    handlers.touchend = (event) => {
      const touch = event.changedTouches[0];
      const dx = touch.clientX - touchStartX;
      const dy = touch.clientY - touchStartY;
      if (Math.abs(dx) < SWIPE_THRESHOLD_PX && Math.abs(dy) < SWIPE_THRESHOLD_PX) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        updateDirectionByName(dx > 0 ? "right" : "left");
      } else {
        updateDirectionByName(dy > 0 ? "down" : "up");
      }
    };

    handlers.canvasPointerDown = (event) => {
      // 记录按下点：用于区分“轻点”(tap) 与 “滑动”(swipe)
      tapStartX = event.clientX;
      tapStartY = event.clientY;
      tapStartAt = Date.now();
    };

    handlers.canvasPointerUp = (event) => {
      // 轻点棋盘：用中心对角线划分 4 个三角区域 → 映射为上下左右
      const dt = Date.now() - tapStartAt;
      const dx = event.clientX - tapStartX;
      const dy = event.clientY - tapStartY;
      if (dt > TAP_TIME_MS) return;
      if (Math.hypot(dx, dy) > TAP_MOVE_THRESHOLD_PX) return;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // 转换到棋盘坐标（CSS 像素）：剔除 offset，确保只在棋盘区域内生效
      const bx = x - offsetX;
      const by = y - offsetY;
      if (bx < 0 || by < 0 || bx > boardW || by > boardH) return;

      const cx = boardW / 2;
      const cy = boardH / 2;
      const rx = bx - cx;
      const ry = by - cy;

      // 对角线分区：
      // - 比较 |rx| 与 |ry|，决定落在“左右三角”还是“上下三角”
      if (Math.abs(rx) > Math.abs(ry)) {
        updateDirectionByName(rx > 0 ? "right" : "left");
      } else {
        updateDirectionByName(ry > 0 ? "down" : "up");
      }
    };

    document.addEventListener("keydown", handlers.keydown);
    mobileControlsEl.addEventListener("click", handlers.mobileClick);
    mobileControlsEl.addEventListener("pointerdown", handlers.mobilePointerDown);
    mobileControlsEl.addEventListener("pointerup", handlers.mobilePointerUp);
    mobileControlsEl.addEventListener("pointercancel", handlers.mobilePointerUp);
    mobileControlsEl.addEventListener("pointerleave", handlers.mobilePointerUp);
    canvas.addEventListener("pointerdown", handlers.canvasPointerDown);
    canvas.addEventListener("pointerup", handlers.canvasPointerUp);
    canvas.addEventListener("touchstart", handlers.touchstart, { passive: true });
    canvas.addEventListener("touchend", handlers.touchend, { passive: true });

    handlers.resize = () => {
      if (resizeRaf) window.cancelAnimationFrame(resizeRaf);
      resizeRaf = window.requestAnimationFrame(() => {
        resizeRaf = 0;
        computeLayoutFromCanvas();
        restartGame();
      });
    };
    window.addEventListener("resize", handlers.resize);

    initRun();
    handlers.overlayStart = () => {
      if (state.status === "ready") startGame();
    };
    overlayStartBtn.addEventListener("click", handlers.overlayStart);
    showStartOverlay();
    scheduleRenderLoop();
  }

  function unmount() {
    // 卸载：停止定时器，移除所有事件监听，释放 DOM 引用
    if (!mounted) return;
    mounted = false;

    stopLoop();
    if (resizeRaf) {
      window.cancelAnimationFrame(resizeRaf);
      resizeRaf = 0;
    }
    stopRenderLoop();

    if (handlers.keydown) document.removeEventListener("keydown", handlers.keydown);
    if (mobileControlsEl && handlers.mobileClick) {
      mobileControlsEl.removeEventListener("click", handlers.mobileClick);
    }
    if (mobileControlsEl && handlers.mobilePointerDown) {
      mobileControlsEl.removeEventListener("pointerdown", handlers.mobilePointerDown);
    }
    if (mobileControlsEl && handlers.mobilePointerUp) {
      mobileControlsEl.removeEventListener("pointerup", handlers.mobilePointerUp);
      mobileControlsEl.removeEventListener("pointercancel", handlers.mobilePointerUp);
      mobileControlsEl.removeEventListener("pointerleave", handlers.mobilePointerUp);
    }
    if (canvas && handlers.touchstart) canvas.removeEventListener("touchstart", handlers.touchstart);
    if (canvas && handlers.touchend) canvas.removeEventListener("touchend", handlers.touchend);
    if (canvas && handlers.canvasPointerDown) canvas.removeEventListener("pointerdown", handlers.canvasPointerDown);
    if (canvas && handlers.canvasPointerUp) canvas.removeEventListener("pointerup", handlers.canvasPointerUp);
    if (handlers.resize) window.removeEventListener("resize", handlers.resize);

    if (overlayStartBtn && handlers.overlayStart) {
      overlayStartBtn.removeEventListener("click", handlers.overlayStart);
    }

    handlers.keydown = null;
    handlers.mobileClick = null;
    handlers.mobilePointerDown = null;
    handlers.mobilePointerUp = null;
    handlers.canvasPointerDown = null;
    handlers.canvasPointerUp = null;
    handlers.touchstart = null;
    handlers.touchend = null;
    handlers.resize = null;
    handlers.overlayStart = null;

    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);

    canvas = null;
    ctx = null;
    scoreEl = null;
    levelEl = null;
    overlay = null;
    overlayTitle = null;
    overlayText = null;
    overlayContent = null;
    overlayStartBtn = null;
    mobileControlsEl = null;
  }

    // 对外只暴露 mount/unmount：页面上仍可用 window.SnakeDemo.mount()
    this.mount = mount;
    this.unmount = unmount;
  }
}

window.SnakeDemo = new SnakeDemoGame();

