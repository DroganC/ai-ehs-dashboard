/* eslint-disable no-unused-vars */
// 关卡相关的全局规则：用于集中管理关卡上限、敌人数量/血量生成规则、以及敌方配色。
// maxLevel = Infinity 表示不做硬上限（保持当前“可无限升级”的行为）。
const LEVEL_GLOBAL = {
  maxLevel: Infinity,
  // 敌人数：level N = base + (N-1) * perLevel
  enemyCountBase: 3,
  enemyCountPerLevel: 2,
  // 关卡规则：level N 敌人需要 (N + bulletsToKillOffset) 发子弹摧毁
  bulletsToKillOffset: 1,
  enemyPalettes: {
    // level <= 1
    green: { body: "rgba(70, 246, 167, 0.95)", edge: "rgba(70, 246, 167, 0.25)", turret: "rgba(70, 246, 167, 0.35)" },
    // level === 2（避免和玩家蓝色冲突）
    purple: { body: "rgba(176, 124, 255, 0.95)", edge: "rgba(176, 124, 255, 0.25)", turret: "rgba(176, 124, 255, 0.35)" },
    // level === 3
    orange: { body: "rgba(255, 184, 77, 0.95)", edge: "rgba(255, 184, 77, 0.25)", turret: "rgba(255, 184, 77, 0.35)" },
    // level === 4
    red: { body: "rgba(255, 77, 109, 0.95)", edge: "rgba(255, 77, 109, 0.25)", turret: "rgba(255, 77, 109, 0.35)" },
  },
};

function getEnemyPaletteByLevel(level) {
  if (level <= 1) return LEVEL_GLOBAL.enemyPalettes.green;
  if (level === 2) return LEVEL_GLOBAL.enemyPalettes.purple;
  if (level === 3) return LEVEL_GLOBAL.enemyPalettes.orange;
  if (level === 4) return LEVEL_GLOBAL.enemyPalettes.red;
  return LEVEL_GLOBAL.enemyPalettes.purple;
}

class TankBattleGame {
  // 卸载游戏：取消 RAF、移除事件监听，避免多次 mount 后出现事件叠加/内存泄漏。
  unmount() {
    this._mounted = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    if (Array.isArray(this._cleanupFns)) {
      for (const fn of this._cleanupFns) {
        try {
          fn();
        } catch {
          // ignore cleanup failures
        }
      }
    }
    this._cleanupFns = [];
    this._rafId = 0;
  }

  // 初始化 DOM 引用、计算画布尺寸、绑定输入事件，并启动渲染循环。
  mount() {
    if (this._mounted) this.unmount();
    this._mounted = true;
    this._cleanupFns = [];
    this._rafId = 0;
    const self = this;
    const canvas = document.getElementById("game");
    const ctx = canvas.getContext("2d", { alpha: false });

  const elPlayerHp = document.getElementById("playerHp");
  const elLevelNum = document.getElementById("levelNum");
  const elScore = document.getElementById("score");
  const elEnemyLeft = document.getElementById("enemyLeft");
  const elPlayerHpFill = document.getElementById("playerHpFill");

  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayMsg = document.getElementById("overlayMsg");
  const overlayOptionsEl = document.getElementById("overlayOptions");
  const btnOverlayRestartEl = document.getElementById("btnOverlayRestart");
  const overlayHintEl = document.getElementById("overlayHint");

  const STATE = {
    paused: false,
    quizActive: false,
    quizPowerup: null,
    levelIntroActive: false,
    levelIntroT: 0,
    pendingLevel: 1,
    gameover: false,
    running: false,
    shootRequest: false,
    restartRequest: false,
    seed: 1337,
  };

  // 运行时状态（挂到实例上，便于外部/后续重构访问）
  this.STATE = STATE;

  // =============================
  // 全局配置（集中管理数值/节奏）
  // 方便后续你调参：不需要到处找散落的 magic number
  // =============================
  const CONFIG = {
    bullet: {
      // 弹道速度（越小越“慢”，逃跑容错越高）
      speed: 360,
      // 每颗子弹对坦克造成的伤害
      damage: 18,
    },
    joystick: {
      // 摇杆死区：避免轻微抖动导致开始/转向
      dead: 0.12,
    },
    mobile: {
      // 移动端玩家转向速度（越大转得越快）
      playerRotSpeed: 4.3,
      // 摇杆转向响应缩放：diff / turnDivisor
      turnDivisor: Math.PI / 3,
    },
    quiz: {
      shieldHits: 3,
      shieldSeconds: 10,
      // 血包道具：答对后恢复 maxHp 的 50%
      healRatio: 0.5,
    },
    level: {
      // 关卡切换提示持续时长（秒）
      introSeconds: 0.85,
    },
    powerups: {
      // 场上未拾取道具数 < trigger 时开始补给
      replenishTriggerActiveCount: 3,
      // 场上最多同时存在的道具数量
      replenishMax: 5,
      // 补给间隔（秒）
      replenishPeriodSeconds: 20,
    },
  };

  // World units are in CSS pixels. Canvas is scaled for DPR; we draw in "world" coordinates.
  let W = 960;
  let H = 640;
  let CELL = 40;
  let GRID_W = 24;
  let GRID_H = 16;
  let TANK_R = 14;
  let BULLET_R = 3.5;

  // 视口/关卡尺寸参数（在 computeSizing() 内更新）
  this.viewport = {};

  let levelSpawnBaseTs = 0;

  const keys = new Set();
  // 键盘输入状态
  this.keys = keys;

  // Mobile (touch) controls
  const joystickEl = document.getElementById("joystick");
  const joystickKnobEl = document.getElementById("joystickKnob");
  const btnShootEl = document.getElementById("btnShoot");

  const mobile = {
    active: false,
    turn: 0,
    move: 0,
    shootHeld: false,
    pointerId: null,
  };
  // 移动端摇杆状态
  this.mobile = mobile;

  let joyCenterX = 0;
  let joyCenterY = 0;
  let joyRadius = 56; // default, updated on pointerdown
  // Joystick direction vector in world/canvas space (screen Y grows downward).
  let joyNX = 0;
  let joyNY = 0;

  // 把摇杆触控点（client 坐标）换算为摇杆的归一化方向，
  // 同时更新 `mobile.turn`（横向转向）与 `mobile.move`（前进/后退意图）。
  function updateJoystickFromClient(clientX, clientY) {
    const dx = clientX - joyCenterX;
    const dy = clientY - joyCenterY;
    const dist = Math.hypot(dx, dy);

    const clamped = dist > joyRadius ? joyRadius / Math.max(0.0001, dist) : 1;
    const nx = (dx * clamped) / joyRadius;
    const ny = (dy * clamped) / joyRadius;

    // up should be "forward" => negative dy means forward
    const dead = CONFIG.joystick.dead;
    mobile.turn = Math.abs(nx) < dead ? 0 : clamp(nx, -1, 1);
    mobile.move = Math.abs(ny) < dead ? 0 : clamp(-ny, -1, 1);
    joyNX = nx;
    joyNY = ny;

    if (joystickKnobEl) {
      joystickKnobEl.style.transform = `translate(${dx * clamped}px, ${dy * clamped}px)`;
    }
  }

  // 重置摇杆状态：清空方向、停止摇杆 active，并把摇杆小球归位。
  function resetMobileJoystick() {
    mobile.turn = 0;
    mobile.move = 0;
    mobile.active = false;
    mobile.pointerId = null;
    if (joystickKnobEl) joystickKnobEl.style.transform = `translate(0px, 0px)`;
  }

  // 尝试让玩家发射一颗子弹（满足冷却、未暂停/未结束、血量>0等条件）。
  // 返回值：true 表示本次确实发射成功。
  function tryPlayerShoot() {
    if (STATE.gameover || STATE.paused) return;
    if (!world.player || world.player.hp <= 0) return;
    if (world.player.cooldown > 0) return;
    world.player.cooldown = 0.28;
    spawnBullet(world.player, world.player.angle);
    return true;
  }

  // 触发开火按钮点击特效（CSS 动画），要求仅在“实际发射”时调用。
  function triggerShootFx() {
    if (!btnShootEl) return;
    btnShootEl.classList.remove("shootFx");
    // Force a reflow so the animation can retrigger.
    void btnShootEl.offsetWidth;
    btnShootEl.classList.add("shootFx");
    btnShootEl.addEventListener(
      "animationend",
      () => {
        btnShootEl.classList.remove("shootFx");
      },
      { once: true }
    );
  }

  // 确定性伪随机数：保证同一 seed 下地图/敌人/道具分布可复现。
  const rand = (() => {
    // Deterministic PRNG for map generation.
    let x = STATE.seed >>> 0;
    return {
      reseed(seed) {
        x = (seed >>> 0) || 1;
      },
      next() {
        // xorshift32
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        return ((x >>> 0) % 100000) / 100000;
      },
      int(min, max) {
        return Math.floor(this.next() * (max - min + 1)) + min;
      },
      pick(arr) {
        return arr[Math.floor(this.next() * arr.length)];
      },
    };
  })();

  // 数值工具：clamp/lerp/wrapAngle 用于保持移动与碰撞计算稳定。
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const wrapAngle = (a) => {
    while (a <= -Math.PI) a += Math.PI * 2;
    while (a > Math.PI) a -= Math.PI * 2;
    return a;
  };

  const FIRE_QUIZ = [
    {
      question: "火灾发生后，报警的正确方式是？",
      options: ["立即拨打 119", "先围观再说", "用水直接扑灭所有火源", "不需要报警"],
      correctIndex: 0,
    },
    {
      question: "发现有人被困，疏散逃生时最正确的做法是？",
      options: ["乘电梯逃生", "按疏散指示走最近安全出口", "等待救援但不离开现场", "随意穿越火场"],
      correctIndex: 1,
    },
    {
      question: "以下哪种火灾不适合直接用水扑救？",
      options: ["纸张等固体可燃物火灾", "电气设备/线路火灾", "一般生活垃圾火灾", "木材火灾"],
      correctIndex: 1,
    },
    {
      question: "灭火器使用基本要领是？",
      options: ["先检查后拔掉保险销，再对准火焰根部", "对准火焰中部连续喷射", "不需要摇晃，直接喷", "从背后向火场喷射"],
      correctIndex: 0,
    },
  ];

  // （占位）后续用 CONFIG.quiz / CONFIG.powerups 统一管理数值
  let powerupReplenishCountdown = CONFIG.powerups.replenishPeriodSeconds;

  // 圆形与矩形是否重叠（用于子弹/坦克对墙体碰撞、玩家拾取道具等）。
  function circleRectOverlap(cx, cy, r, rect) {
    const nearestX = clamp(cx, rect.x, rect.x + rect.w);
    const nearestY = clamp(cy, rect.y, rect.y + rect.h);
    const dx = cx - nearestX;
    const dy = cy - nearestY;
    return dx * dx + dy * dy <= r * r;
  }

  // Segment is checked by sampling points; walls are chunky so this is fine for a demo.
  // 线段与矩形是否相交：通过在墙体附近采样点近似判断（适合本 demo 的粗碰撞）。
  function segmentIntersectsRect(x1, y1, x2, y2, rect) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    const step = Math.max(3, Math.floor(CELL / 8));
    const steps = Math.max(2, Math.ceil(dist / step));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = x1 + dx * t;
      const y = y1 + dy * t;
      if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h)
        return true;
    }
    return false;
  }

  // 判断点是否落在矩形内部（包含边界）。
  function pointInRect(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }

  // 快速创建矩形对象 {x,y,w,h}。
  function makeRect(x, y, w, h) {
    return { x, y, w, h };
  }

  const world = {
    walls: [],
    powerups: [],
    bullets: [],
    particles: [],
    tanks: [],
    player: null,
    enemies: [],
    score: 0,
    level: 1,
    enemiesAlive: 0,
  };

  // 挂载世界数据（关卡/子弹/坦克/道具等）
  this.world = world;

  // 根据画布实际 DOM 尺寸计算游戏“世界坐标”的缩放参数，
  // 同步更新 W/H/CELL/GRID_W/GRID_H/TANK_R/BULLET_R，并设置 canvas DPI。
  function computeSizing() {
    const rect = canvas.getBoundingClientRect();
    // If hidden, keep existing sizing.
    if (!rect.width || !rect.height) return;
    W = Math.floor(rect.width);
    H = Math.floor(rect.height);
    // Keep gameplay readable on very small canvases.
    CELL = Math.max(26, Math.floor(Math.min(W, H) / 16));
    GRID_W = Math.max(12, Math.floor(W / CELL));
    GRID_H = Math.max(10, Math.floor(H / CELL));
    TANK_R = Math.max(12, Math.floor(CELL * 0.33));
    BULLET_R = Math.max(3, Math.floor(CELL * 0.10));

    // 更新视口参数到实例，供后续重构/外部读数使用。
    self.viewport.W = W;
    self.viewport.H = H;
    self.viewport.CELL = CELL;
    self.viewport.GRID_W = GRID_W;
    self.viewport.GRID_H = GRID_H;
    self.viewport.TANK_R = TANK_R;
    self.viewport.BULLET_R = BULLET_R;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    // Draw in CSS pixels
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // 基于种子与关卡难度生成本关地图：边界墙、障碍物、掉落道具格。
  function generateMap() {
    rand.reseed(STATE.seed + world.level * 999);
    world.walls = [];

    const pad = Math.max(5, Math.floor(CELL * 0.15));

    // Border walls (keep tanks inside).
    world.walls.push(makeRect(0, 0, W, pad));
    world.walls.push(makeRect(0, H - pad, W, pad));
    world.walls.push(makeRect(0, 0, pad, H));
    world.walls.push(makeRect(W - pad, 0, pad, H));

    const spawn = {
      player: { gx: Math.floor(GRID_W / 2), gy: Math.floor(GRID_H * 0.72) },
      e1: { gx: 2, gy: 2 },
      e2: { gx: GRID_W - 3, gy: 2 },
      e3: { gx: 2, gy: GRID_H - 3 },
    };

    // 判断某个网格坐标是否需要避开出生点（保证出生附近有可行动空间）
    // 并保留顶部区域给“从顶部落下”的关卡坦克。
    function nearSpawn(gx, gy) {
      const keep = 2.3;
      const d1 = Math.hypot(gx - spawn.player.gx, gy - spawn.player.gy);
      const d2 = Math.hypot(gx - spawn.e1.gx, gy - spawn.e1.gy);
      const d3 = Math.hypot(gx - spawn.e2.gx, gy - spawn.e2.gy);
      const d4 = Math.hypot(gx - spawn.e3.gx, gy - spawn.e3.gy);
      // Reserve a top band so level enemies can spawn and appear.
      const topBandGy = Math.floor(GRID_H * 0.25);
      const topBand = gy <= topBandGy;
      return topBand || d1 < keep || d2 < keep || d3 < keep || d4 < keep;
    }

    for (let gy = 1; gy < GRID_H - 1; gy++) {
      for (let gx = 1; gx < GRID_W - 1; gx++) {
        if (nearSpawn(gx, gy)) continue;
        // Sparse walls with a few larger clusters.
        const base = rand.next();
        const clusterBias = (gx % 2 === 0 && gy % 2 === 0) ? 0.1 : 0;
        // Increase density: more obstacles, but still keep runs playable.
        if (base < 0.078 + clusterBias) {
          const x = gx * CELL;
          const y = gy * CELL;
          const w = CELL - 2 * pad;
          const h = CELL - 2 * pad;
          if (w > 0 && h > 0) {
            world.walls.push(makeRect(x + pad, y + pad, w, h));

            // Occasionally extend to a short run to form "联排格" cover.
            // This creates more natural blocky cover without fully sealing the map.
            if (rand.next() < 0.48) {
              const horizontal = rand.next() < 0.5;
              const runLen = rand.int(2, 5); // total cells including current
              for (let k = 1; k < runLen; k++) {
                const ggx = horizontal ? gx + k : gx;
                const ggy = horizontal ? gy : gy + k;
                if (ggx <= 0 || ggy <= 0 || ggx >= GRID_W - 1 || ggy >= GRID_H - 1) break;
                if (nearSpawn(ggx, ggy)) break;

                const xx = ggx * CELL;
                const yy = ggy * CELL;
                world.walls.push(makeRect(xx + pad, yy + pad, w, h));
              }
            }
          }
        }
      }
    }

    // (Removed) Middle channel wall.

    // Power-up tiles: stepping onto them triggers a fire-safety quiz.
    // Correct answer => grant the corresponding power-up effect.
    world.powerups = [];

    // 矩形与矩形是否重叠（用于避免道具生成在墙体内部）。
    function rectOverlap(a, b) {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    // 判断某个矩形是否与任意墙体发生重叠。
    function rectOverlapsWalls(rect) {
      for (const w of world.walls) {
        if (rectOverlap(rect, w)) return true;
      }
      return false;
    }

    // 把网格出生点 {gx,gy} 转为世界坐标 {x,y}（坦克/道具摆放使用）。
    const spawnToWorld = (s) => ({
      x: s.gx * CELL + CELL / 2,
      y: s.gy * CELL + CELL / 2,
    });

    const pSpawn = spawnToWorld(spawn.player);
    const eSpawn1 = spawnToWorld(spawn.e1);
    const eSpawn2 = spawnToWorld(spawn.e2);
    const eSpawn3 = spawnToWorld(spawn.e3);

    const tilePad = Math.floor(CELL * 0.18);
    const tileSize = Math.max(16, CELL - tilePad * 2);
    const powerCount = 4;
    const minSpawnDist = CELL * 2.4;

    let attempts = 0;
    // 按权重选择道具类型：护盾更常见，加血相对少一些。
    const pickPowerupKind = () => {
      // Weighted selection: shield more common than heal.
      const r = rand.next();
      if (r < 0.62) return "shield";
      if (r < 0.92) return "heal";
      return "heal";
    };

    while (world.powerups.length < powerCount && attempts < 2400) {
      attempts++;
      const gx = rand.int(2, GRID_W - 3);
      const gy = rand.int(2, GRID_H - 3);
      if (nearSpawn(gx, gy)) continue;

      const x = gx * CELL + tilePad;
      const y = gy * CELL + tilePad;
      const rect = makeRect(x, y, tileSize, tileSize);

      // Avoid spawning inside walls.
      if (rectOverlapsWalls(rect)) continue;

      // Avoid too-close-to-spawns tiles.
      const cx = x + tileSize / 2;
      const cy = y + tileSize / 2;
      const dPlayer = Math.hypot(cx - pSpawn.x, cy - pSpawn.y);
      const dE1 = Math.hypot(cx - eSpawn1.x, cy - eSpawn1.y);
      const dE2 = Math.hypot(cx - eSpawn2.x, cy - eSpawn2.y);
      const dE3 = Math.hypot(cx - eSpawn3.x, cy - eSpawn3.y);
      if (dPlayer < minSpawnDist || dE1 < minSpawnDist || dE2 < minSpawnDist || dE3 < minSpawnDist) {
        continue;
      }

      // Avoid overlap with other powerups.
      if (world.powerups.some((p) => rectOverlap(p.rect, rect))) continue;

      const kind = pickPowerupKind();
      world.powerups.push({
        kind,
        rect,
        taken: false,
        phase: rand.next() * 1000,
        healAmount: 0,
      });
    }

    // Reset replenishment timer for the new battlefield.
    powerupReplenishCountdown = CONFIG.powerups.replenishPeriodSeconds;
  }

  // 根据当前关卡难度重置世界实体：
  // - 生成玩家坦克（可保留分数/血量）
  // - 生成敌方坦克（从顶部落下，带关卡缩放的 hp/speed/转向/开火概率）
  // - 重建 bullets/particles 并更新 world.tanks 与 enemiesAlive。
  function resetEntities({ keepScore = false, keepPlayerHp = false } = {}) {
    world.bullets = [];
    world.particles = [];
    const prevPlayer = world.player;
    world.tanks = [];
    world.enemies = [];
    if (!keepScore) world.score = 0;
    world.enemiesAlive = 0;
    if (!world.powerups) world.powerups = [];

    const spawn = {
      player: { gx: Math.floor(GRID_W / 2), gy: Math.floor(GRID_H * 0.72) },
      e1: { gx: 2, gy: 2 },
      e2: { gx: GRID_W - 3, gy: 2 },
      e3: { gx: 2, gy: GRID_H - 3 },
    };

    // 把网格出生点 {gx,gy} 转为世界坐标 {x,y}（同 generateMap 的映射逻辑）。
    const spawnToWorld = (s) => ({
      x: s.gx * CELL + CELL / 2,
      y: s.gy * CELL + CELL / 2,
    });

    world.player = {
      kind: "player",
      ...spawnToWorld(spawn.player),
      angle: -Math.PI / 2,
      hp: keepPlayerHp && prevPlayer ? prevPlayer.hp : 100,
      maxHp: 100,
      shield: keepPlayerHp && prevPlayer ? prevPlayer.shield || 0 : 0,
      shieldMax: 3,
      shieldTtl: keepPlayerHp && prevPlayer ? prevPlayer.shieldTtl || 0 : 0,
      speed: 105,
      rotSpeed: CONFIG.mobile.playerRotSpeed,
      cooldown: 0,
      radius: TANK_R,
      bodyW: Math.floor(TANK_R * 1.95),
      bodyH: Math.floor(TANK_R * 1.25),
      scoreValue: 25,
      spawned: true,
    };

    world.player.hp = clamp(world.player.hp, 0, world.player.maxHp);

    const level = Math.max(1, world.level | 0);
    const enemyCount =
      LEVEL_GLOBAL.enemyCountBase + (level - 1) * LEVEL_GLOBAL.enemyCountPerLevel;
    const palette = getEnemyPaletteByLevel(level);

    const pad = Math.max(5, Math.floor(CELL * 0.15));
    const spawnToY = Math.max(pad + CELL * 0.9, CELL * 1.6);
    const enemyRadius = TANK_R * 0.98;
    const tempTank = { radius: enemyRadius };

    // Spawn from above, staggered.
    levelSpawnBaseTs = performance.now();
    const spawnFromY = -CELL * (2 + rand.next() * 1.4);
    const spawnDuration = 1.0 + rand.next() * 0.8;
    const spawnGap = 0.18;

    const xLeft = pad + CELL * 0.6;
    const xRight = W - pad - CELL * 0.6;
    const xSpan = xRight - xLeft;

    for (let i = 0; i < enemyCount; i++) {
      const tt = (i + 1) / (enemyCount + 1);
      let x = xLeft + xSpan * tt + rand.int(-Math.floor(CELL * 0.25), Math.floor(CELL * 0.25));
      x = clamp(x, pad + 8, W - pad - 8);

      // Avoid spawning inside walls.
      let tries = 0;
      while (tries < 40 && tankCollidesWithWalls(tempTank, x, spawnToY)) {
        x = xLeft + xSpan * (tt + rand.int(-20, 20) / 100) + rand.int(-Math.floor(CELL * 0.2), Math.floor(CELL * 0.2));
        x = clamp(x, pad + 8, W - pad - 8);
        tries++;
      }

      const dx = world.player.x - x;
      const dy = world.player.y - spawnToY;
      const a = Math.atan2(dy, dx);

      // Level rule: level N enemies need (N + bulletsToKillOffset) bullets to be destroyed.
      // 子弹伤害由 CONFIG.bullet.damage 决定
      const bulletsToKill = level + LEVEL_GLOBAL.bulletsToKillOffset;
      const hp = (bulletsToKill - 1) * CONFIG.bullet.damage + 1;
      const speed = 86 + (level - 1) * 9;
      const rotSpeed = 2.25 + (level - 1) * 0.35;
      const shootChance = clamp(0.40 + (level - 1) * 0.07 + rand.next() * 0.18, 0.35, 0.92);

      const enemy = {
        kind: "enemy",
        x,
        y: spawnFromY,
        angle: a,
        hp,
        maxHp: hp,
        speed,
        rotSpeed,
        cooldown: rand.int(0, 550) / 1000,
        radius: enemyRadius,
        bodyW: Math.floor(TANK_R * 1.95),
        bodyH: Math.floor(TANK_R * 1.25),
        ai: {
          turnBias: rand.next() < 0.5 ? 1 : -1,
          lastDecision: 0,
          decisionCooldown: rand.int(250, 700) / (1 + level * 0.03),
          desiredDist: rand.int(120, 240) + level * 10,
          shootChance,
        },
        scoreValue: 20 + level * 2,
        bodyColor: palette.body,
        bodyEdge: palette.edge,
        turretColor: palette.turret,
        spawned: false,
        spawnFromY,
        spawnToY,
        spawnStartTs: levelSpawnBaseTs + i * spawnGap * 1000,
        spawnDuration,
      };

      world.enemies.push(enemy);
    }

    world.tanks = [world.player, ...world.enemies];
    world.enemiesAlive = world.enemies.length;
  }

  // 检测坦克在候选位置（nx,ny）是否会与任何墙体发生碰撞。
  function tankCollidesWithWalls(tank, nx, ny) {
    const r = tank.radius;
    for (const wall of world.walls) {
      if (circleRectOverlap(nx, ny, r, wall)) return true;
    }
    return false;
  }

  // 按输入移动坦克：同时处理旋转（turnDir）与沿自身朝向的前进移动（moveForward）。
  // 使用分步移动避免高速穿模（tunneling）。
  function moveTank(tank, dt, moveForward, turnDir) {
    // moveForward: -1..1
    const targetMove = moveForward * tank.speed * dt;
    const moveAngle = tank.angle;

    const dx = Math.cos(moveAngle) * targetMove;
    const dy = Math.sin(moveAngle) * targetMove;

    // Rotate
    tank.angle += turnDir * tank.rotSpeed * dt;
    tank.angle = wrapAngle(tank.angle);

    // Step movement to avoid tunneling.
    const dist = Math.hypot(dx, dy);
    const maxStep = Math.max(6, tank.radius * 0.35);
    const steps = Math.max(1, Math.ceil(dist / maxStep));

    for (let i = 0; i < steps; i++) {
      const sx = dx / steps;
      const sy = dy / steps;

      let nx = tank.x + sx;
      if (!tankCollidesWithWalls(tank, nx, tank.y)) tank.x = nx;

      let ny = tank.y + sy;
      if (!tankCollidesWithWalls(tank, tank.x, ny)) tank.y = ny;
    }
  }

  // 用“推开/分离”的方式解决坦克之间的重叠（防止出现卡住/穿模视觉）。
  function resolveTankOverlap(a, b) {
    const minDist = a.radius + b.radius;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.hypot(dx, dy);
    if (!d || d >= minDist) return;
    const overlap = minDist - d;
    const nx = dx / d;
    const ny = dy / d;
    // Push both tanks apart; player slightly heavier.
    const pushA = a.kind === "player" ? 0.35 : 0.5;
    const pushB = 1 - pushA;
    if (a.kind === "player") {
      a.x -= nx * overlap * pushA;
      a.y -= ny * overlap * pushA;
    } else {
      a.x -= nx * overlap * pushA;
      a.y -= ny * overlap * pushA;
    }
    if (b.kind === "player") {
      b.x += nx * overlap * pushB;
      b.y += ny * overlap * pushB;
    } else {
      b.x += nx * overlap * pushB;
      b.y += ny * overlap * pushB;
    }

    // Keep them valid with walls: if overlapped with walls after push, skip.
    if (tankCollidesWithWalls(a, a.x, a.y)) {
      a.x += nx * overlap * pushA;
      a.y += ny * overlap * pushA;
    }
    if (tankCollidesWithWalls(b, b.x, b.y)) {
      b.x -= nx * overlap * pushB;
      b.y -= ny * overlap * pushB;
    }
  }

  // 判断两点之间是否存在“墙体遮挡”，用于坦克视线/射击可达性。
  function canShootLine(fromX, fromY, toX, toY) {
    for (const wall of world.walls) {
      if (segmentIntersectsRect(fromX, fromY, toX, toY, wall)) return false;
    }
    return true;
  }

  // 生成一颗子弹实体，并把其初始位置、速度与寿命参数写入 `world.bullets`。
  function spawnBullet(owner, angle) {
    // Slower projectile speed for more reaction/escape time.
    const speed = CONFIG.bullet.speed;
    const r = BULLET_R;
    const startOffset = owner.radius * 1.05;
    const x = owner.x + Math.cos(angle) * startOffset;
    const y = owner.y + Math.sin(angle) * startOffset;
    world.bullets.push({
      owner,
      x,
      y,
      angle,
      r,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 2.3,
      ttl: 2.3,
    });
  }

  // 更新子弹生命周期：
  // 1) 根据 dt 移动子弹（分步）
  // 2) 与墙体碰撞 => 停止并判定命中
  // 3) 与坦克碰撞 => 处理护盾/伤害/爆炸/扣分/游戏结束
  // 4) 越界则移除
  function updateBullets(dt) {
    const aliveBullets = [];
    for (const b of world.bullets) {
      b.life -= dt;
      if (b.life <= 0) continue;

      const dx = b.vx * dt;
      const dy = b.vy * dt;
      const dist = Math.hypot(dx, dy);
      const maxStep = Math.max(6, b.r * 0.8);
      const steps = Math.max(1, Math.ceil(dist / maxStep));

      let hit = false;
      for (let i = 0; i < steps; i++) {
        const sx = dx / steps;
        const sy = dy / steps;
        b.x += sx;
        b.y += sy;

        // Wall hit
        for (const wall of world.walls) {
          if (circleRectOverlap(b.x, b.y, b.r, wall)) {
            hit = true;
            break;
          }
        }
        if (hit) break;

        // Tank hit (skip owner)
        for (const t of world.tanks) {
          if (t === b.owner) continue;
          if (t.hp <= 0) continue;
          if (t.kind === "enemy" && !t.spawned) continue;
          const rr = t.radius + b.r;
          if (Math.hypot(t.x - b.x, t.y - b.y) <= rr) {
            hit = true;
            if (t.kind === "player" && t.shield > 0) {
              t.shield -= 1;
              if (t.shield < 0) t.shield = 0;
              explodeHit(b.x, b.y, "player");
            } else {
              t.hp -= CONFIG.bullet.damage;
              if (t.hp <= 0) {
                t.hp = 0;
                explodeTank(t);
                if (t.kind === "player") {
                  STATE.gameover = true;
                } else {
                  world.score += t.scoreValue;
                  world.enemiesAlive -= 1;
                }
              } else {
                explodeHit(b.x, b.y, t.kind === "player" ? "player" : "enemy");
              }
            }
            break;
          }
        }

        if (hit) break;

        // Out of bounds
        if (b.x < -10 || b.x > W + 10 || b.y < -10 || b.y > H + 10) {
          hit = true;
          break;
        }
      }

      if (!hit) aliveBullets.push(b);
    }
    world.bullets = aliveBullets;
  }

  // 坦克被销毁时的“爆炸粒子”生成逻辑（玩家/敌人粒子颜色不同）。
  function explodeTank(tank) {
    // Particle burst
    const count = tank.kind === "player" ? 48 : 40;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rand.next() * 0.6;
      const sp = rand.int(80, 220);
      world.particles.push({
        x: tank.x,
        y: tank.y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: rand.int(250, 650) / 1000,
        age: 0,
        r: rand.int(1, 4) + (tank.kind === "player" ? 1 : 0),
        color:
          tank.kind === "player"
            ? `rgba(82, 178, 255, ${0.95})`
            : `rgba(70, 246, 167, ${0.95})`,
      });
    }
  }

  // 子弹“击中点”的爆炸粒子生成逻辑（根据 who: player/enemy 决定粒子颜色）。
  function explodeHit(x, y, who) {
    const base = who === "player" ? "rgba(82, 178, 255, " : "rgba(255, 77, 109, ";
    const count = 14;
    for (let i = 0; i < count; i++) {
      const a = rand.next() * Math.PI * 2;
      const sp = rand.int(70, 165);
      world.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: rand.int(220, 420) / 1000,
        age: 0,
        r: rand.int(1, 3),
        color: `${base}${0.85})`,
      });
    }
  }

  // 粒子系统更新：根据 dt 推进位置、衰减速度与生命周期，过滤死粒子。
  function updateParticles(dt) {
    const next = [];
    for (const p of world.particles) {
      p.age += dt;
      p.life -= dt;
      if (p.life <= 0) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(0.1, dt); // quick drag
      p.vy *= Math.pow(0.1, dt);
      next.push(p);
    }
    world.particles = next;
  }

  // 敌方 AI 更新：决定是否开火、转向方向与前进/后退策略。
  function updateAI(enemy, dt) {
    if (enemy.hp <= 0) return;
    if (!enemy.spawned) return;
    enemy.ai.lastDecision += dt * 1000;

    const px = world.player.x;
    const py = world.player.y;
    const dx = px - enemy.x;
    const dy = py - enemy.y;
    const dist = Math.hypot(dx, dy);

    const desired = Math.atan2(dy, dx);
    const diff = wrapAngle(desired - enemy.angle);

    if (enemy.ai.lastDecision >= enemy.ai.decisionCooldown) {
      enemy.ai.lastDecision = 0;
      enemy.ai.decisionCooldown = rand.int(220, 640);

      // Slight randomness so enemies don't behave identically.
      enemy.ai.turnBias = rand.next() < 0.55 ? 1 : -1;
      enemy.ai.desiredDist = clamp(enemy.ai.desiredDist + rand.int(-35, 35), 110, 260);
    }

    const angleToMove = diff;
    const turning = clamp(angleToMove / Math.PI, -1, 1);
    const turnDir = angleToMove === 0 ? enemy.ai.turnBias : Math.sign(turning) * enemy.ai.turnBias;

    const canSee = canShootLine(enemy.x, enemy.y, px, py);
    const angleOk = Math.abs(diff) < 0.18;
    const distOk = dist < enemy.ai.desiredDist + 60;

    if (enemy.cooldown > 0) enemy.cooldown -= dt;

    const shouldShoot = canSee && angleOk && dist < 360 && rand.next() < enemy.ai.shootChance;
    if (shouldShoot && enemy.cooldown <= 0) {
      enemy.cooldown = rand.int(330, 620) / 1000;
      spawnBullet(enemy, enemy.angle);
    }

    // Movement: keep pressure; back off a bit if too close.
    let move = 0;
    if (dist > enemy.ai.desiredDist) move = 1;
    else if (dist < enemy.ai.desiredDist * 0.72) move = -0.55;
    else move = 0.65;

    // If tank is not aligned, prioritize turning.
    const moveForward = angleOk ? move : move * 0.45;
    moveTank(enemy, dt, moveForward, turnDir);
  }

  // 玩家输入更新：优先处理移动端摇杆（含“始终前进，只根据转向改变方向”），
  // 再处理键盘方向键/WS 以及按空格/触控开火触发的射击请求。
  function updatePlayer(dt) {
    if (world.player.hp <= 0) return;

    if (world.player.cooldown > 0) world.player.cooldown -= dt;

    // Prefer touch controls when joystick is active.
    if (mobile.active) {
      const mag = Math.hypot(joyNX, joyNY);
      const dead = CONFIG.joystick.dead;

      if (mag < dead) {
        moveTank(world.player, dt, 0, 0);
      } else {
        // Drive towards the joystick direction (direction only),
        // avoiding forward/back "U-turn" behavior.
        const desiredAngle = Math.atan2(joyNY, joyNX);
        const diff = wrapAngle(desiredAngle - world.player.angle);
        // Speed up turning: larger turnDir for the same angle delta.
        const turnDir = clamp(diff / CONFIG.mobile.turnDivisor, -1, 1);
        const moveForward = 1; // always move forward; direction is set by rotation
        moveTank(world.player, dt, moveForward, turnDir);
      }
      if (mobile.shootHeld && tryPlayerShoot()) triggerShootFx();
      return;
    }

    const turnDir =
      (keys.has("ArrowLeft") || keys.has("KeyA") ? -1 : 0) + (keys.has("ArrowRight") || keys.has("KeyD") ? 1 : 0);

    const moveForward =
      (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) + (keys.has("KeyS") || keys.has("ArrowDown") ? -1 : 0);
    const move = clamp(moveForward, -1, 1);

    moveTank(world.player, dt, move, turnDir);

    if (STATE.shootRequest) {
      STATE.shootRequest = false;
      tryPlayerShoot();
    }
  }

  // 移除死亡敌人并重建 world.tanks 列表（player + 剩余 enemies）。
  function removeDeadTanks() {
    world.enemies = world.enemies.filter((e) => e.hp > 0);
    world.tanks = [world.player, ...world.enemies];
  }

  // 绘制单个坦克：
  // - 车体/炮塔/装甲颜色
  // - 盾牌与生命条（若启用）
  // - 敌我与生成/未生成状态下的视觉差异
  function drawTank(tank) {
    const isPlayer = tank.kind === "player";
    const bodyColor = tank.bodyColor ?? (isPlayer ? "rgba(82, 178, 255, 0.95)" : "rgba(70, 246, 167, 0.95)");
    const bodyEdge = tank.bodyEdge ?? (isPlayer ? "rgba(82, 178, 255, 0.25)" : "rgba(70, 246, 167, 0.25)");
    const turretColor = tank.turretColor ?? (isPlayer ? "rgba(82, 178, 255, 0.35)" : "rgba(70, 246, 167, 0.35)");

    ctx.save();
    ctx.translate(tank.x, tank.y);
    ctx.rotate(tank.angle);

    const bw = tank.bodyW;
    const bh = tank.bodyH;
    // Body
    ctx.fillStyle = bodyColor;
    ctx.strokeStyle = bodyEdge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-bw / 2, -bh / 2, bw, bh, Math.max(6, Math.floor(bh * 0.28)));
    ctx.fill();
    ctx.stroke();

    // Track accents
    ctx.strokeStyle = "rgba(234, 255, 247, 0.22)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-bw / 2 + 10, -bh / 2 + 6);
    ctx.lineTo(bw / 2 - 10, -bh / 2 + 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-bw / 2 + 10, bh / 2 - 6);
    ctx.lineTo(bw / 2 - 10, bh / 2 - 6);
    ctx.stroke();

    // Turret
    ctx.fillStyle = turretColor;
    ctx.beginPath();
    ctx.roundRect(-tank.radius * 0.1, -tank.radius * 0.35, tank.radius * 1.25, tank.radius * 0.7, tank.radius * 0.35);
    ctx.fill();

    // Barrel
    ctx.fillStyle = "rgba(234, 255, 247, 0.65)";
    ctx.beginPath();
    ctx.roundRect(tank.radius * 0.92, -tank.radius * 0.16, tank.radius * 0.85, tank.radius * 0.32, tank.radius * 0.16);
    ctx.fill();

    // Player shield ring (absorbs power-up quiz damage).
    if (tank.kind === "player" && tank.shield > 0) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 1000 * 10);
      ctx.strokeStyle = `rgba(82, 178, 255, ${0.22 + 0.35 * pulse})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, tank.radius + 7, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = `rgba(234, 255, 247, ${0.10 + 0.10 * pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, tank.radius + 11, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();

    // Health bar
    const hpRatio = tank.maxHp > 0 ? tank.hp / tank.maxHp : 0;
    const barW = tank.bodyW;
    const barH = 8;
    const barX = tank.x - barW / 2;
    const barY = tank.y - tank.bodyH / 2 - 14;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(barX, barY, barW, barH);
    // Keep enemy HP bar in green family to avoid confusion with "enemy is red".
    if (tank.kind === "player") {
      ctx.fillStyle =
        hpRatio > 0.5
          ? "rgba(70, 246, 167, 0.95)"
          : hpRatio > 0.2
            ? "rgba(82, 178, 255, 0.95)"
            : "rgba(255, 77, 109, 0.95)";
    } else {
      const a = hpRatio > 0.5 ? 0.95 : hpRatio > 0.2 ? 0.85 : 0.75;
      ctx.fillStyle = `rgba(70, 246, 167, ${a})`;
    }
    ctx.fillRect(barX, barY, barW * hpRatio, barH);
    ctx.strokeStyle = "rgba(234, 255, 247, 0.18)";
    ctx.strokeRect(barX, barY, barW, barH);
  }

  // 绘制墙体：包含边界墙的更厚实/更“真实”的立面效果，
  // 以及内部障碍物的统一材质视觉（厚度/倒角/阴影）。
  function drawWalls() {
    ctx.save();
    // 判断墙块是否更像“边界墙”（用于给边框墙更厚实/有厚度的材质视觉）。
    const isBorderWall = (wall) => {
      const thin = Math.min(wall.w, wall.h) < Math.max(CELL * 0.8, 10);
      const touchesLeft = wall.x <= 0.5;
      const touchesRight = wall.x + wall.w >= W - 0.5;
      const touchesTop = wall.y <= 0.5;
      const touchesBottom = wall.y + wall.h >= H - 0.5;
      return thin && (touchesLeft || touchesRight || touchesTop || touchesBottom);
    };

    // 为单块墙体绘制材质：外阴影（厚度）+ 正面渐变填充 + 边缘高光/内倒角线。
    const bevelRect = (wall, opts) => {
      const { baseFill, edgeStroke, innerStroke, outerShadow } = opts;
      // Outer shadow (gives thickness).
      ctx.fillStyle = outerShadow;
      ctx.fillRect(wall.x - 1, wall.y - 1, wall.w + 2, wall.h + 2);

      // Main face with slight gradient.
      ctx.fillStyle = baseFill;
      ctx.fillRect(wall.x, wall.y, wall.w, wall.h);

      // Edge highlight.
      ctx.strokeStyle = edgeStroke;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(wall.x + 0.75, wall.y + 0.75, wall.w - 1.5, wall.h - 1.5);

      // Inner bevel line.
      ctx.strokeStyle = innerStroke;
      ctx.lineWidth = 1;
      ctx.strokeRect(wall.x + 2, wall.y + 2, wall.w - 4, wall.h - 4);
    };

    for (const wall of world.walls) {
      const border = isBorderWall(wall);
      if (border) {
        const horizontal = wall.w > wall.h;
        let grad;
        if (horizontal) {
          const atTop = wall.y <= 0.5;
          grad = ctx.createLinearGradient(wall.x, wall.y, wall.x, wall.y + wall.h);
          grad.addColorStop(0, atTop ? "rgba(0,0,0,0.30)" : "rgba(234,255,247,0.10)");
          grad.addColorStop(1, atTop ? "rgba(234,255,247,0.12)" : "rgba(0,0,0,0.30)");
        } else {
          const atLeft = wall.x <= 0.5;
          grad = ctx.createLinearGradient(wall.x, wall.y, wall.x + wall.w, wall.y);
          grad.addColorStop(0, atLeft ? "rgba(0,0,0,0.30)" : "rgba(234,255,247,0.10)");
          grad.addColorStop(1, atLeft ? "rgba(234,255,247,0.12)" : "rgba(0,0,0,0.30)");
        }
        bevelRect(wall, {
          baseFill: grad,
          outerShadow: "rgba(0,0,0,0.25)",
          edgeStroke: "rgba(234,255,247,0.35)",
          innerStroke: "rgba(234,255,247,0.14)",
        });
      } else {
        // Interior blocks: keep sharp and simple.
        ctx.fillStyle = "rgba(234, 255, 247, 0.08)";
        ctx.strokeStyle = "rgba(234, 255, 247, 0.22)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(wall.x, wall.y, wall.w, wall.h);
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // 绘制场上道具格：未拾取才会显示，并通过护盾/加血不同图标与脉冲动画区分。
  function drawPowerups() {
    if (!world.powerups || world.powerups.length === 0) return;
    const t = performance.now() / 1000;

    for (const p of world.powerups) {
      if (p.taken) continue;
      const pulse = 0.5 + 0.5 * Math.sin(t * 6 + p.phase);
      const cx = p.rect.x + p.rect.w / 2;
      const cy = p.rect.y + p.rect.h / 2;
      const s = Math.min(p.rect.w, p.rect.h) * 0.28;

      let fillRGBA;
      let strokeRGBA;
      let icon = "shield";
      if (p.kind === "heal") {
        fillRGBA = `rgba(70, 246, 167, ${0.05 + 0.10 * pulse})`;
        strokeRGBA = `rgba(70, 246, 167, ${0.25 + 0.35 * pulse})`;
        icon = "heal";
      } else {
        fillRGBA = `rgba(82, 178, 255, ${0.05 + 0.10 * pulse})`;
        strokeRGBA = `rgba(82, 178, 255, ${0.25 + 0.35 * pulse})`;
        icon = "shield";
      }

      ctx.save();
      ctx.fillStyle = fillRGBA;
      ctx.fillRect(p.rect.x, p.rect.y, p.rect.w, p.rect.h);

      ctx.strokeStyle = strokeRGBA;
      ctx.lineWidth = 3;
      ctx.strokeRect(p.rect.x + 2, p.rect.y + 2, p.rect.w - 4, p.rect.h - 4);

      ctx.strokeStyle = "rgba(234, 255, 247, 0.85)";
      ctx.lineWidth = 2;
      if (icon === "shield") {
        // Simple shield icon inside.
        ctx.beginPath();
        ctx.moveTo(cx, cy - s);
        ctx.quadraticCurveTo(cx + s, cy - s * 0.25, cx + s * 0.9, cy + s * 0.55);
        ctx.lineTo(cx, cy + s * 0.95);
        ctx.lineTo(cx - s * 0.9, cy + s * 0.55);
        ctx.quadraticCurveTo(cx - s, cy - s * 0.25, cx, cy - s);
        ctx.closePath();
        ctx.stroke();
      } else {
        // Heal icon: plus sign.
        ctx.beginPath();
        ctx.moveTo(cx - s, cy);
        ctx.lineTo(cx + s, cy);
        ctx.moveTo(cx, cy - s);
        ctx.lineTo(cx, cy + s);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  // 绘制背景网格（格子网格，用于增强地图可读性）。
  function drawGrid() {
    ctx.save();
    ctx.globalAlpha = 0.20;
    ctx.strokeStyle = "rgba(234, 255, 247, 0.18)";
    ctx.lineWidth = 1;
    const step = CELL;
    for (let x = 0; x <= W; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y <= H; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 绘制子弹：根据剩余 life/ttl 调整透明度/亮度。
  function drawBullets() {
    ctx.save();
    for (const b of world.bullets) {
      const t = clamp(b.life / b.ttl, 0, 1);
      ctx.fillStyle = `rgba(234, 255, 247, ${0.75 + 0.2 * t})`;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 绘制粒子：把爆炸/命中等产生的粒子画出来（按生命周期衰减 alpha）。
  function drawParticles() {
    ctx.save();
    for (const p of world.particles) {
      const t = clamp(1 - p.age / (p.age + p.life + 0.0001), 0, 1);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = clamp(0.2 + (p.life * 1.2), 0, 1);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 总渲染入口：固定顺序绘制背景 -> 网格 -> 墙 -> 道具 -> 子弹/粒子 -> 坦克 -> canvas overlay。
  function render() {
    renderBackground();
    renderGrid();
    renderWalls();
    renderPowerups();
    renderBullets();
    renderParticles();
    renderTanks();
    renderCanvasOverlays();
  }

  // 渲染纯色背景底板。
  function renderBackground() {
    ctx.fillStyle = "rgba(6, 27, 20, 1)";
    ctx.fillRect(0, 0, W, H);
  }

  // 渲染网格层。
  function renderGrid() {
    drawGrid();
  }

  // 渲染墙体层。
  function renderWalls() {
    drawWalls();
  }

  // 渲染道具层。
  function renderPowerups() {
    drawPowerups();
  }

  // 渲染子弹层。
  function renderBullets() {
    drawBullets();
  }

  // 渲染粒子层。
  function renderParticles() {
    drawParticles();
  }

  // 渲染坦克层（玩家坦克 + 敌方坦克）。
  function renderTanks() {
    // 玩家/敌方坦克
    if (world.player) {
      if (world.player.hp > 0) drawTank(world.player);
    }
    for (const e of world.enemies) {
      if (e.hp > 0) drawTank(e);
    }
  }

  // 渲染 canvas 版覆盖文本：暂停/未开始提示等。
  function renderCanvasOverlays() {
    // Pause overlay
    if (STATE.paused && !STATE.gameover && !STATE.quizActive) {
      ctx.save();
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(234, 255, 247, 0.95)";
      ctx.font = "700 28px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
      ctx.textAlign = "center";
      ctx.fillText("PAUSED", W / 2, H / 2 - 12);
      ctx.font = "400 14px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
      ctx.fillText("点击暂停继续", W / 2, H / 2 + 16);
      ctx.restore();
    }

    // Not started yet: wait for first touch input.
    if (!STATE.running && !STATE.gameover) {
      ctx.save();
      ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(234, 255, 247, 0.95)";
      ctx.font = "700 24px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
      ctx.textAlign = "center";
      ctx.fillText("点击摇杆或开火开始", W / 2, H / 2);
      ctx.font = "400 13px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
      ctx.fillText("首次操作才会生成地图和坦克", W / 2, H / 2 + 22);
      ctx.restore();
    }
  }

  // 刷新 HUD DOM：关卡号、玩家血量、分数、剩余敌人数。
  function updateHud() {
    if (!world.player) return;
    if (elLevelNum) elLevelNum.textContent = String(world.level | 0);
    elPlayerHp.textContent = String(Math.max(0, world.player.hp | 0));
    elScore.textContent = String(world.score | 0);
    elEnemyLeft.textContent = String(world.enemiesAlive | 0);

    if (elPlayerHpFill && world.player.maxHp > 0) {
      const ratio = clamp(world.player.hp / world.player.maxHp, 0, 1);
      elPlayerHpFill.style.width = `${ratio * 100}%`;

      // Color shift near danger, like a typical game HUD.
      if (ratio <= 0.2) {
        elPlayerHpFill.style.background =
          "linear-gradient(90deg, rgba(255, 77, 109, 0.95), rgba(82, 178, 255, 0.85))";
        elPlayerHpFill.style.boxShadow = "0 0 18px rgba(255, 77, 109, 0.24)";
      } else {
        elPlayerHpFill.style.background =
          "linear-gradient(90deg, rgba(70, 246, 167, 0.95), rgba(82, 178, 255, 0.95))";
        elPlayerHpFill.style.boxShadow = "0 0 18px rgba(70, 246, 167, 0.14)";
      }
    }
  }

  // 玩家拾取道具后进入该函数：暂停游戏、标记道具为已拾取，
  // 并通过消防安全问答 overlay 决定给予护盾/加血等效果。
  function activatePowerup(powerup) {
    if (!powerup || powerup.taken) return;
    powerup.taken = true;

    STATE.quizActive = true;
    STATE.quizPowerup = powerup;
    STATE.paused = true;

    // Freeze player input while quiz is active.
    mobile.shootHeld = false;
    resetMobileJoystick();

    const questionObj = rand.pick(FIRE_QUIZ);
    showQuizOverlay(questionObj);
  }

  // 检测玩家与未拾取道具的碰撞：若命中则调用 activatePowerup() 进入问答流程。
  function checkPowerups() {
    if (STATE.quizActive || STATE.gameover) return false;
    if (!world.powerups || world.powerups.length === 0) return false;
    if (!world.player || world.player.hp <= 0) return false;

    for (const p of world.powerups) {
      if (p.taken) continue;
      if (circleRectOverlap(world.player.x, world.player.y, world.player.radius, p.rect)) {
        activatePowerup(p);
        return true;
      }
    }
    return false;
  }

  // 统计当前场上未拾取的道具数量，用于控制道具补给节奏与上限。
  function activePowerupCount() {
    if (!world.powerups) return 0;
    let n = 0;
    for (const p of world.powerups) {
      if (!p.taken) n++;
    }
    return n;
  }

  // 生成 1 个新道具格（并避开出生点/墙体/与已有道具重叠区域）。
  function spawnPowerupOne() {
    if (activePowerupCount() >= CONFIG.powerups.replenishMax) return false;
    if (!world.powerups) world.powerups = [];

    const spawn = {
      player: { gx: Math.floor(GRID_W / 2), gy: Math.floor(GRID_H * 0.72) },
      e1: { gx: 2, gy: 2 },
      e2: { gx: GRID_W - 3, gy: 2 },
      e3: { gx: 2, gy: GRID_H - 3 },
    };

    // 判定某个网格坐标是否离出生点太近（避免道具生成在玩家/敌人起始区）。
    function nearSpawn(gx, gy) {
      const keep = 2.3;
      const d1 = Math.hypot(gx - spawn.player.gx, gy - spawn.player.gy);
      const d2 = Math.hypot(gx - spawn.e1.gx, gy - spawn.e1.gy);
      const d3 = Math.hypot(gx - spawn.e2.gx, gy - spawn.e2.gy);
      const d4 = Math.hypot(gx - spawn.e3.gx, gy - spawn.e3.gy);
      return d1 < keep || d2 < keep || d3 < keep || d4 < keep;
    }

    // 矩形重叠判断：用于避免道具格与墙体或其他道具区域冲突。
    function rectOverlap(a, b) {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    // 判断某个道具矩形是否与当前世界墙体发生重叠。
    function rectOverlapsWalls(rect) {
      for (const w of world.walls) {
        if (rectOverlap(rect, w)) return true;
      }
      return false;
    }

    // 在“护盾/加血”两种道具中按权重随机选择类型。
    function pickPowerupKind() {
      const r = rand.next();
      if (r < 0.62) return "shield";
      return "heal";
    }

    // 把出生点网格坐标 {gx,gy} 映射为世界坐标 {x,y}。
    const spawnToWorld = (s) => ({
      x: s.gx * CELL + CELL / 2,
      y: s.gy * CELL + CELL / 2,
    });

    const pSpawn = spawnToWorld(spawn.player);
    const eSpawn1 = spawnToWorld(spawn.e1);
    const eSpawn2 = spawnToWorld(spawn.e2);
    const eSpawn3 = spawnToWorld(spawn.e3);

    const minSpawnDist = CELL * 2.4;

    const tilePad = Math.floor(CELL * 0.18);
    const tileSize = Math.max(16, CELL - tilePad * 2);

    let attempts = 0;
    while (attempts < 1200) {
      attempts++;
      const gx = rand.int(2, GRID_W - 3);
      const gy = rand.int(2, GRID_H - 3);
      if (nearSpawn(gx, gy)) continue;

      const x = gx * CELL + tilePad;
      const y = gy * CELL + tilePad;
      const rect = makeRect(x, y, tileSize, tileSize);

      if (rectOverlapsWalls(rect)) continue;

      const cx = x + tileSize / 2;
      const cy = y + tileSize / 2;

      const dPlayer = Math.hypot(cx - pSpawn.x, cy - pSpawn.y);
      const dE1 = Math.hypot(cx - eSpawn1.x, cy - eSpawn1.y);
      const dE2 = Math.hypot(cx - eSpawn2.x, cy - eSpawn2.y);
      const dE3 = Math.hypot(cx - eSpawn3.x, cy - eSpawn3.y);
      if (dPlayer < minSpawnDist || dE1 < minSpawnDist || dE2 < minSpawnDist || dE3 < minSpawnDist) continue;

      let overlapped = false;
      for (const p of world.powerups) {
        if (p.taken) continue;
        if (rectOverlap(p.rect, rect)) {
          overlapped = true;
          break;
        }
      }
      if (overlapped) continue;

      const kind = pickPowerupKind();
      world.powerups.push({
        kind,
        rect,
        taken: false,
        phase: rand.next() * 1000,
        healAmount: 0,
      });
      return true;
    }

    return false;
  }

  // 道具补给管理：当未拾取道具数量低于阈值时开始倒计时，到点则生成新道具。
  function managePowerups(dt) {
    if (!world.powerups || world.powerups.length === 0) return;
    if (STATE.quizActive || STATE.gameover) return;

    const active = activePowerupCount();
    if (active >= CONFIG.powerups.replenishTriggerActiveCount) {
      // Not urgent; keep countdown fresh.
      powerupReplenishCountdown = CONFIG.powerups.replenishPeriodSeconds;
      return;
    }

    powerupReplenishCountdown -= dt;
    if (powerupReplenishCountdown > 0) return;

    spawnPowerupOne();
    powerupReplenishCountdown = CONFIG.powerups.replenishPeriodSeconds;
  }

  // 主更新入口（每帧/每次 loop 调用）：驱动玩家、道具、敌方 AI、子弹、粒子与 HUD。
  function update(dt) {
    if (!world.player || !world.enemies) return;
    if (STATE.gameover) return;

    // Shield TTL countdown.
    if (world.player.shieldTtl > 0) {
      world.player.shieldTtl -= dt;
      if (world.player.shieldTtl <= 0) {
        world.player.shieldTtl = 0;
        world.player.shield = 0;
      }
    }

    updatePlayer(dt);

    if (checkPowerups()) return;

    managePowerups(dt);

    const nowTs = performance.now();
    for (const e of world.enemies) {
      if (e.hp <= 0) continue;
      if (!e.spawned) {
        const p = clamp((nowTs - e.spawnStartTs) / (e.spawnDuration * 1000), 0, 1);
        e.y = lerp(e.spawnFromY, e.spawnToY, p);
        if (p >= 1) e.spawned = true;
        continue;
      }
      updateAI(e, dt);
    }

    // Tank-tank overlap resolution (helps avoid visual jank).
    for (let i = 0; i < world.tanks.length; i++) {
      for (let j = i + 1; j < world.tanks.length; j++) {
        const a = world.tanks[i];
        const b = world.tanks[j];
        const aOk = a.kind === "player" || a.spawned;
        const bOk = b.kind === "player" || b.spawned;
        if (!aOk || !bOk) continue;
        resolveTankOverlap(a, b);
      }
    }

    updateBullets(dt);

    // Remove dead ones after bullet updates.
    removeDeadTanks();

    if (world.enemiesAlive <= 0) {
      queueLevelIntro();
      return;
    }

    updateParticles(dt);
    updateHud();
  }

  // 把关键循环入口暴露为“实例方法”（用于后续进一步重构/扩展）。
  this.update = update;

  // 显示通用 overlay（暂停提示、胜负结算等通用面板）。
  function showOverlay(title, msg) {
    overlayTitle.textContent = title;
    overlayMsg.textContent = msg;
    if (overlayOptionsEl) {
      overlayOptionsEl.innerHTML = "";
      overlayOptionsEl.style.display = "none";
    }
    if (btnOverlayRestartEl) btnOverlayRestartEl.style.display = "";
    if (overlayHintEl) overlayHintEl.innerHTML = "按 <b>R</b> 重开";
    overlay.hidden = false;
    overlay.style.display = "grid";
  }

  // 隐藏通用 overlay，并清空 options 区域内容。
  function hideOverlay() {
    overlay.hidden = true;
    overlay.style.display = "none";
    if (overlayOptionsEl) {
      overlayOptionsEl.innerHTML = "";
      overlayOptionsEl.style.display = "none";
    }
  }

  // 显示“关卡开始”提示 overlay（敌人从顶部落下）。
  function showLevelIntroOverlay(level) {
    overlayTitle.textContent = `关卡 ${level}`;
    overlayMsg.textContent = "敌人从顶部出现";
    if (overlayOptionsEl) {
      overlayOptionsEl.innerHTML = "";
      overlayOptionsEl.style.display = "none";
    }
    if (btnOverlayRestartEl) btnOverlayRestartEl.style.display = "none";
    if (overlayHintEl) overlayHintEl.textContent = `准备进入关卡 ${level}...`;
    overlay.hidden = false;
    overlay.style.display = "grid";
  }

  // 排队进入下一关：设置 pendingLevel/暂停，并在 overlay 上显示提示。
  function queueLevelIntro() {
    if (STATE.levelIntroActive || STATE.gameover || STATE.quizActive) return;
    STATE.levelIntroActive = true;
    STATE.levelIntroT = 0;
    STATE.pendingLevel = Math.max(1, (world.level | 0) + 1);
    if (Number.isFinite(LEVEL_GLOBAL.maxLevel)) {
      STATE.pendingLevel = Math.min(STATE.pendingLevel, LEVEL_GLOBAL.maxLevel);
    }
    STATE.paused = true;
    showLevelIntroOverlay(STATE.pendingLevel);
  }

  // 进入某一关：重建地图与实体，并恢复游戏运行状态。
  function beginLevel(level) {
    STATE.levelIntroActive = false;
    STATE.paused = false;
    STATE.quizActive = false;
    STATE.quizPowerup = null;
    STATE.gameover = false;

    world.level = Math.max(1, level | 0);
    if (Number.isFinite(LEVEL_GLOBAL.maxLevel)) {
      world.level = Math.min(world.level, LEVEL_GLOBAL.maxLevel);
    }
    computeSizing();
    generateMap();
    resetEntities({ keepScore: true, keepPlayerHp: true });
    // 通关进入下一关时，玩家生命回满（保留分数/护盾状态的同时补血）。
    if (world.player && world.player.maxHp > 0) world.player.hp = world.player.maxHp;
    hideOverlay();
    updateHud();
  }

  // 显示消防安全问答 overlay：渲染选项按钮并等待玩家作答。
  function showQuizOverlay(questionObj) {
    if (!questionObj) return;

    overlayTitle.textContent = "消防安全问答";
    overlayMsg.textContent = questionObj.question;

    if (overlayHintEl) overlayHintEl.textContent = "选择一个答案";

    if (btnOverlayRestartEl) btnOverlayRestartEl.style.display = "none";

    if (overlayOptionsEl) {
      overlayOptionsEl.innerHTML = "";
      overlayOptionsEl.style.display = "flex";

      questionObj.options.forEach((opt, idx) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "overlayOptionBtn";
        b.textContent = opt;
        b.addEventListener(
          "pointerdown",
          (e) => {
            e.preventDefault();
            e.stopPropagation();
            answerQuiz(idx === questionObj.correctIndex);
          },
          { passive: false, once: true }
        );
        overlayOptionsEl.appendChild(b);
      });
    }

    overlay.hidden = false;
    overlay.style.display = "grid";
  }

  // 处理问答结果：对正确答案发放道具效果；无论对错都恢复游戏继续。
  function answerQuiz(isCorrect) {
    const p = STATE.quizPowerup;
    STATE.quizActive = false;
    STATE.quizPowerup = null;
    STATE.paused = false;

    hideOverlay();

    if (!isCorrect || !world.player) return;
    if (!p) return;

    if (p.kind === "shield") {
      world.player.shield = CONFIG.quiz.shieldHits;
      world.player.shieldTtl = CONFIG.quiz.shieldSeconds;

      // Shield feedback burst.
      explodeHit(world.player.x, world.player.y, "player");
      world.particles.push({
        x: world.player.x,
        y: world.player.y,
        vx: 0,
        vy: 0,
        life: 0.6,
        age: 0,
        r: 3,
        color: "rgba(82, 178, 255, 0.85)",
      });
    } else if (p.kind === "heal") {
      const before = world.player.hp;
      const healAmount = Math.floor(world.player.maxHp * CONFIG.quiz.healRatio);
      world.player.hp = Math.min(world.player.maxHp, world.player.hp + healAmount);

      if (world.player.hp > before) {
        // Heal feedback burst (green-ish particles).
        for (let i = 0; i < 18; i++) {
          const a = rand.next() * Math.PI * 2;
          const sp = rand.int(40, 110);
          world.particles.push({
            x: world.player.x,
            y: world.player.y,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp,
            life: rand.int(250, 520) / 1000,
            age: 0,
            r: rand.int(1, 3),
            color: "rgba(70, 246, 167, 0.85)",
          });
        }
      }
    }
  }

  // 开始新的一局：清理状态、生成地图与实体（默认从关卡 1 开始）。
  function start() {
    STATE.paused = false;
    STATE.quizActive = false;
    STATE.gameover = false;
    STATE.running = true;
    hideOverlay();
    world.level = 1;

    computeSizing();
    generateMap();
    resetEntities();
    updateHud();
  }

  // 确保“首次输入触发才开始游戏”：首次移动摇杆/点击开火时调用。
  function ensureStarted() {
    if (STATE.running) return;
    start();
    lastTs = 0;
  }

  // 游戏结束处理：根据敌人数量判断胜负，并在 overlay 上显示结果。
  function gameOver() {
    STATE.running = false;
    const win = world.enemiesAlive <= 0;
    if (win)
      showOverlay("胜利!", `最终分数: ${world.score}\n按 R 重开，或点「重开」`);
    else showOverlay("游戏结束", `分数: ${world.score}\n按 R 重开，或点「重开」`);
  }

  // 主 RAF 循环：
  // - 计算 dt
  // - 根据状态决定更新/暂停/重开/关卡提示
  // - 每帧都调用 render() 刷新画面
  let lastTs = 0;
  function loop(ts) {
    if (!self._mounted) return;
    const dt = lastTs ? Math.min(0.033, (ts - lastTs) / 1000) : 0;
    lastTs = ts;

    if (!STATE.running) {
      // Support restart while not running (e.g. after gameover).
      if (STATE.restartRequest) {
        STATE.restartRequest = false;
        start();
        lastTs = 0;
      }
      // Keep rendering for pause overlay / last frame.
      render();
      self._rafId = requestAnimationFrame(loop);
      return;
    }

    if (STATE.restartRequest) {
      STATE.restartRequest = false;
      start();
    }

    if (STATE.levelIntroActive) {
      STATE.levelIntroT += dt;
      if (STATE.levelIntroT >= CONFIG.level.introSeconds) {
        const next = Math.max(1, STATE.pendingLevel | 0);
        STATE.levelIntroActive = false;
        STATE.paused = false;
        hideOverlay();
        beginLevel(next);
      }
    }

    if (!STATE.paused && !STATE.gameover) {
      update(dt);
      if (STATE.gameover) gameOver();
    }

    render();
    self._rafId = requestAnimationFrame(loop);
  }

  // 把关键循环入口暴露为“实例方法”（满足后续进一步拆分/封装的需要）
  this.loop = loop;

  // 键盘按下事件：处理开火/暂停/重开请求，并把方向键写入 keys。
  function handleKeyDown(e) {
    if (e.repeat) return;
    if (e.code === "Space") {
      STATE.shootRequest = true;
    } else if (e.code === "KeyP") {
      if (!STATE.gameover && !STATE.quizActive) STATE.paused = !STATE.paused;
    } else if (e.code === "KeyR") {
      STATE.restartRequest = true;
    }

    keys.add(e.code);
  }

  // 键盘抬起事件：把方向键从 keys 中移除。
  function handleKeyUp(e) {
    keys.delete(e.code);
  }

  // 绑定键盘/触控/窗口事件：集中到一个入口，便于后续做类封装与卸载。
  function bindEvents() {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    self._cleanupFns.push(() => window.removeEventListener("keydown", handleKeyDown));
    self._cleanupFns.push(() => window.removeEventListener("keyup", handleKeyUp));

    // Touch controls (mobile-friendly)
    if (joystickEl) {
      const onJoyPointerDown = (e) => {
        // Only primary touch for joystick
        if (mobile.pointerId !== null && e.pointerId !== mobile.pointerId) return;
        e.preventDefault();
        const r = joystickEl.getBoundingClientRect();
        joyCenterX = r.left + r.width / 2;
        joyCenterY = r.top + r.height / 2;
        joyRadius = r.width / 2;
        mobile.pointerId = e.pointerId;
        mobile.active = true;
        updateJoystickFromClient(e.clientX, e.clientY);
        joystickEl.setPointerCapture(e.pointerId);
      };
      joystickEl.addEventListener("pointerdown", onJoyPointerDown, { passive: false });
      self._cleanupFns.push(() => joystickEl.removeEventListener("pointerdown", onJoyPointerDown));

      const onJoyPointerMove = (e) => {
        if (mobile.pointerId === null || e.pointerId !== mobile.pointerId) return;
        e.preventDefault();
        updateJoystickFromClient(e.clientX, e.clientY);
        // Start only when the joystick is actually moved (not just pressed).
        if (!STATE.running && !STATE.gameover) {
          if (Math.abs(mobile.turn) > 0.01 || Math.abs(mobile.move) > 0.01) {
            ensureStarted();
          }
        }
      };
      joystickEl.addEventListener("pointermove", onJoyPointerMove, { passive: false });
      self._cleanupFns.push(() => joystickEl.removeEventListener("pointermove", onJoyPointerMove));

      const onJoyEnd = (e) => {
        if (mobile.pointerId === null || e.pointerId !== mobile.pointerId) return;
        e.preventDefault();
        resetMobileJoystick();
      };
      joystickEl.addEventListener("pointerup", onJoyEnd, { passive: false });
      joystickEl.addEventListener("pointercancel", onJoyEnd, { passive: false });
      self._cleanupFns.push(() => joystickEl.removeEventListener("pointerup", onJoyEnd));
      self._cleanupFns.push(() => joystickEl.removeEventListener("pointercancel", onJoyEnd));
    }

    if (btnShootEl) {
      const onShootPointerDown = (e) => {
        e.preventDefault();
        ensureStarted();
        mobile.shootHeld = true;
        if (tryPlayerShoot()) triggerShootFx(); // quick fire on tap
        btnShootEl.setPointerCapture(e.pointerId);
      };
      btnShootEl.addEventListener("pointerdown", onShootPointerDown, { passive: false });
      self._cleanupFns.push(() => btnShootEl.removeEventListener("pointerdown", onShootPointerDown));

      const onShootEnd = (e) => {
        e.preventDefault();
        mobile.shootHeld = false;
        // don't shoot on release; cooldown is handled by tryPlayerShoot
        if (tryPlayerShoot()) triggerShootFx();
      };
      btnShootEl.addEventListener("pointerup", onShootEnd, { passive: false });
      btnShootEl.addEventListener("pointercancel", onShootEnd, { passive: false });
      self._cleanupFns.push(() => btnShootEl.removeEventListener("pointerup", onShootEnd));
      self._cleanupFns.push(() => btnShootEl.removeEventListener("pointercancel", onShootEnd));
    }

    if (btnOverlayRestartEl) {
      const onOverlayRestartPointerDown = (e) => {
        e.preventDefault();
        mobile.shootHeld = false;
        resetMobileJoystick();
        STATE.paused = false;
        STATE.gameover = false;
        STATE.restartRequest = true;
        hideOverlay();
      };
      btnOverlayRestartEl.addEventListener("pointerdown", onOverlayRestartPointerDown, { passive: false });
      self._cleanupFns.push(() => btnOverlayRestartEl.removeEventListener("pointerdown", onOverlayRestartPointerDown));
    }

    const onResize = () => {
      // Avoid regenerating on tiny resizes; still adapt quickly.
      computeSizing();
      if (STATE.running) {
        generateMap();
        resetEntities();
        updateHud();
      }
      hideOverlay();
      STATE.paused = false;
      STATE.gameover = false;
    };
    window.addEventListener("resize", onResize);
    self._cleanupFns.push(() => window.removeEventListener("resize", onResize));
  }

  // 初始化流程：计算尺寸、隐藏初始 overlay、绑定事件，并启动渲染 loop（但游戏运行等待首次输入）。
  function init() {
    computeSizing();
    hideOverlay();
    // Ensure CSS canvas size aligns; if layout changes, recompute later.
    // Start only after the first joystick move or shoot tap.
    bindEvents();

    // Always render, but only start gameplay on first input.
    self._rafId = requestAnimationFrame(loop);
  }

  // Polyfill for roundRect in older browsers.
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      r = typeof r === "number" ? r : 12;
      this.beginPath();
      this.moveTo(x + r, y);
      this.arcTo(x + w, y, x + w, y + h, r);
      this.arcTo(x + w, y + h, x, y + h, r);
      this.arcTo(x, y + h, x, y, r);
      this.arcTo(x, y, x + w, y, r);
      this.closePath();
      return this;
    };
  }

    init();
  }
}

new TankBattleGame().mount();

