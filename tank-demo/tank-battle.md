# 坦克大战（Tank Battle）技术与规则文档

> 项目入口：`tank-demo/index.html` 加载 `tank-demo/game.js`，画面由 HTML5 Canvas 渲染；问答/关卡提示/胜负结算使用 DOM overlay。

## 1. 核心玩法（玩家怎么赢）

1. **移动与转向（移动端）**
   - 左下角摇杆控制坦克转向与“前进方向”。
   - 摇杆只有在**超过死区**后才会触发“开始游戏”（非仅仅按下）。
2. **开火（移动端）**
   - 右下角开火按钮可开火。
   - 点击/按下时会尝试发射一颗子弹；视觉“点击特效”仅在**确实发射**时触发。
3. **开始条件**
   - 游戏初始不运行更新逻辑，只做渲染等待。
   - 满足以下任一条件时：**摇杆移动（超过死区）**或**点击开火**，调用 `ensureStarted()` 开始完整游戏循环。
4. **关卡通关**
   - 当场上 `enemiesAlive <= 0` 时触发 `queueLevelIntro()`，展示关卡进入提示。
   - 动画到时后在 `beginLevel()` 进入下一关。
5. **游戏结束（胜负）**
   - 玩家生命归零（子弹命中且护盾耗尽后 hp <= 0）触发 `STATE.gameover = true`，随后显示游戏结束 overlay。

## 2. 画面与 UI

### 2.1 顶部 HUD（DOM）
- `index.html` 内的 `#hud` 由三个信息组成：
  - 关卡号（`#levelNum`）
  - 玩家生命（`#playerHp` + `#playerHpFill` 进度条）
  - 分数（`#score`）
  - 剩余敌人（`#enemyLeft`）
- 每帧更新 HUD：`game.js` 的 `updateHud()`。

### 2.2 Canvas HUD（未开始/暂停提示）
- `renderCanvasOverlays()` 在 Canvas 上绘制：
  - 暂停时的 `PAUSED` 文本
  - 未开始时的 `点击摇杆或开火开始` 文本

### 2.3 DOM Overlay（关卡提示/问答/胜负结算）
- `#overlay`：
  - 关卡提示：`showLevelIntroOverlay(level)`
  - 问答：`showQuizOverlay(questionObj)` + `answerQuiz(isCorrect)`
  - 胜负结算：`showOverlay(title, msg)`
- CSS 约束：使用 `position: fixed` + padding，且 `.overlay-card` 满足最大宽高限制，避免贴边；同时**无滚动条**（overflow hidden）。
- 弹框美观增强：`.overlay-card` 使用多重渐变与光边效果。

## 3. 关卡系统（难度如何增长）

### 3.1 关卡全局规则（可集中配置）
文件：`tank-demo/game.js`

- 全局常量：`LEVEL_GLOBAL`
  - `maxLevel: Infinity`：不做硬上限（若要有限关卡可把它改为数字）
  - 敌人数增长：
    - `enemyCountBase = 3`
    - `enemyCountPerLevel = 2`
    - 所以：`enemyCount = enemyCountBase + (level - 1) * enemyCountPerLevel`
  - 敌人血量/击杀规则：
    - `bulletsToKillOffset = 1`
    - 所以：**关卡 level N 的敌人需要 `bulletsToKill = N + 1` 颗子弹摧毁**
    - 由 `CONFIG.bullet.damage` 决定 hp 计算：`hp = (bulletsToKill - 1) * damage + 1`
  - 敌方配色（避免与我方坦克同色）：
    - level 1：绿色
    - level 2：紫色（避免与我方蓝色冲突）
    - level 3：橙色
    - level 4：红色

### 3.2 玩家通关后生命回满
- 在 `beginLevel(level)` 中：
  - 调用 `resetEntities({ keepScore: true, keepPlayerHp: true })` 后
  - 追加补血：`world.player.hp = world.player.maxHp`
  - 结果：**通关后生命直接回满**（不会影响分数、护盾等保留逻辑）。

## 4. 敌方坦克生成与行为

### 4.1 敌人生成时机与动画（从顶部落下）
- `resetEntities()` 中为每个敌人设置：
  - 初始 `y = spawnFromY`（负值：从画面上方生成）
  - `spawned: false`，并在 `update(dt)` 中根据 `spawnStartTs/spawnDuration` 逐步插值到目标 `spawnToY`

### 4.2 敌人参数随关卡缩放
- 敌人 speed：`86 + (level - 1) * 9`
- 敌人 rotSpeed：`2.25 + (level - 1) * 0.35`
- 敌人射击概率 shootChance：
  - `clamp(0.40 + (level - 1) * 0.07 + rand.next() * 0.18, 0.35, 0.92)`
- 敌人开火逻辑与移动逻辑在 `updateAI(enemy, dt)`。

### 4.3 AI 关键点（看得到才会射击）
- `canShootLine(fromX, fromY, toX, toY)`：
  - 遍历墙体，使用 `segmentIntersectsRect` 采样检测视线是否被墙阻挡。
- `updateAI()` 中：
  - 满足可视 + 角度对齐 + 距离条件 + 随机概率 + 冷却到点才会发射。

## 5. 道具系统、问答与效果

### 5.1 道具类型（两种）
- shield：拾取后触发正确问答 => 给玩家护盾（吸收伤害）
- heal：拾取后触发正确问答 => 血包治疗恢复生命（恢复 maxHp 的 50%）

问答触发点：玩家与未拾取道具格发生碰撞（`checkPowerups()`）。

### 5.2 问答与护盾/治疗规则
- 护盾配置：`CONFIG.quiz.shieldHits = 3`，`CONFIG.quiz.shieldSeconds = 10`
- 治疗配置：`CONFIG.quiz.healRatio = 0.5`

正确答案时在 `answerQuiz(isCorrect)` 中执行：
- shield：设置 `player.shield` 与 `player.shieldTtl`，并生成护盾反馈粒子
- heal：`player.hp = min(maxHp, hp + floor(maxHp * healRatio))` 并生成治疗粒子
- 错误答案：不发放效果，只恢复继续游戏

### 5.3 道具补给机制（动态补充）
- 用于控制场上道具数量，避免过早用光：
  - 当未拾取道具数 `activePowerupCount() < 3` 时开始倒计时
  - 到点则生成新道具（`spawnPowerupOne()`）
  - 同时限制场上最多：`CONFIG.powerups.replenishMax = 5`

逻辑在 `managePowerups(dt)`。

## 6. 子弹、护盾与碰撞

### 6.1 子弹发射与飞行
- `tryPlayerShoot()`：
  - 只有当不是暂停/游戏结束、玩家 hp > 0、冷却结束时才发射
- `spawnBullet(owner, angle)`：
  - 使用 `CONFIG.bullet.speed`
  - 子弹寿命 `ttl/life = 2.3`

### 6.2 子弹更新与命中判定
- `updateBullets(dt)`：
  - 分步更新位置（减少高速穿墙）
  - 子弹碰墙：用 `circleRectOverlap` 判定并停止
  - 子弹碰坦克：
    - 若打到玩家且玩家 `shield > 0`：护盾减 1（不扣 hp），并爆炸粒子
    - 否则扣 hp，hp <= 0 则爆炸并更新计分/结束状态

### 6.3 坦克移动与防穿模
- `moveTank(tank, dt, moveForward, turnDir)`：
  - 先更新角度，再用分步位移推进（`tankCollidesWithWalls` 检测）

### 6.4 坦克重叠处理
- `resolveTankOverlap(a, b)`：
  - 将坦克推开避免挤在一起导致的视觉抖动
  - 推开后再次检查是否穿墙

## 7. 地图生成（Walls / 障碍物 / 道具格）

### 7.1 确定性随机数
- `rand` 使用 xorshift32，保证同一 `STATE.seed` + 关卡能复现地图。
- `generateMap()` 用 `rand.reseed(STATE.seed + world.level * 999)`。

### 7.2 墙体与联排遮挡（联排格）
- `generateMap()`：
  - 先生成边界墙（四周薄条）
  - 遍历网格生成内部障碍物（矩形）
  - 使用“延伸 run”的方式把部分障碍扩展为横/竖联排块，形成更自然的 cover
  - 移除了你之前要求去掉的“中间窄墙”，避免完全阻塞

### 7.3 道具格初始化
- `generateMap()` 中生成初始道具 `powerCount = 4`：
  - 避开墙体内部（`rectOverlapsWalls`）
  - 避开出生点附近（`nearSpawn`）
  - 避免和其他道具重叠
- 道具类型按权重随机：护盾更常见，加血更少一些。

## 8. 技术实现概览（结构/渲染/循环/生命周期）

### 8.1 类封装
- 主类：`TankBattleGame`
- 公共方法：
  - `mount()`：获取 DOM、初始化 canvas、绑定输入事件、启动 RAF 循环
  - `unmount()`：取消 RAF 与移除事件监听，避免重复 mount 导致泄漏

### 8.2 状态与世界数据
- `STATE`：暂停/问答/关卡提示/重开请求/运行状态
- `world`：
  - `walls / powerups / bullets / particles / tanks / player / enemies`
  - `score / level / enemiesAlive`

### 8.3 主循环与时序状态机
- `loop(ts)`：
  - 计算 dt
  - `!STATE.running`：只渲染并处理重开请求
  - `STATE.running`：
    - 处理关卡提示计时（`STATE.levelIntroActive`）
    - `!STATE.paused && !STATE.gameover` 时执行 `update(dt)`
    - 每帧 `render()` 刷新画面

### 8.4 渲染分层
- `render()` 按顺序调用（绘制顺序保持一致）：
  1. `renderBackground()`
  2. `renderGrid()`
  3. `renderWalls()`
  4. `renderPowerups()`
  5. `renderBullets()`
  6. `renderParticles()`
  7. `renderTanks()`
  8. `renderCanvasOverlays()`

### 8.5 输入系统（Keyboard + Touch）
- `bindEvents()`：
  - 键盘：
    - `Space`：设置 `STATE.shootRequest`
    - `KeyP`：暂停/恢复（不在 quiz/gameover 状态下）
    - `KeyR`：重开
  - 触控：
    - 摇杆：指针按下/移动/抬起更新 `mobile` 状态；移动超过死区触发开始
    - 开火：指针按下尝试射击并触发开火特效

## 9. 已修复的关键质量问题（重要）

1. 修复 `viewport` 报错（`Cannot read properties of undefined`）
   - 原因：`mount()` 内部的 `computeSizing()` 使用普通 `function` 调用时 `this` 未绑定。
   - 修复：`mount()` 中使用 `const self = this`，并将所有 `this.viewport` 改为 `self.viewport`。
2. 修复潜在内存泄露
   - 新增 `unmount()`，并在 `mount()` 启动 RAF 时记录 `this._rafId`。
   - 输入事件监听都通过 `this._cleanupFns` 集中回收，避免重复绑定造成的累积。
3. 问答按钮避免重复触发
   - `showQuizOverlay()` 中为选项绑定 `{ once: true }`，确保一次作答只触发一次。

## 10. 你可以继续扩展的方向（不改当前逻辑）

1. 将 `TankBattleGame.mount()` 内部更多 `function` 拆成真正的 `this.xxx` 成员方法，让代码结构更标准、可测试。
2. 给 `LEVEL_GLOBAL.maxLevel` 提供 UI 配置或读取配置文件，便于你快速调关卡上限。
3. 给 `unmount()` 增加 overlay 隐藏与状态复位（如果你后续支持“切换页面/重新加载游戏”）。

