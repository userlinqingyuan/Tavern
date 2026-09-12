# 第二轮实施计划 · 吧台互动玩法

- 日期：2026-09-12
- 对应 spec：[2026-09-12-round2-bar-interactive-design.md](../specs/2026-09-12-round2-bar-interactive-design.md)
- 约束：无构建、无依赖；数据 JSON 化；共享逻辑进 `tavern-core.js`，共享样式进 `tavern.css`；新页面 `bar/` 子目录

> **完成注记（2026-09-12）**：全部 9 步已落地并随 v2.3.0 发布。额外修复：`calcMetrics` 的 `drinksTasted` 原硬编码 `% 15`（酒单扩容到 56 后「尝遍酒单」成就无法达成），现由 `track('tasting', { total })` 记录 `state.drinkTotal` 动态计算，menu 页已同步传参。浏览器手测 10 项全过（含 A=B 拦截 / 隐藏配方金色卡 / 赌局 streak 归零 / 成就墙 3/32 / 导航互达），`npm run check` 0 错误 0 警告。

## 步骤总览

| # | 步骤 | 产出 |
|---|------|------|
| 1 | core 基建 | tavern-core.js：状态字段 / track 五事件 / 六指标 / getMixLog、getHiddenRecipes |
| 2 | 数据文件 | data/mixing.json、data/dice.json、data/achievements.json +6（组 bar） |
| 3 | 共享样式 | tavern.css：调酒槽 / 结果卡 / 骰子 / 模式切换 / 日志弹窗 / 隐藏配方金色卡 |
| 4 | 吧台页·调酒台 | bar/index.html：选料交互 + 生成规则 + 隐藏配方 + 调酒日志 |
| 5 | 吧台页·骰子桌 | bar/index.html：掷骰遇客 / 骰子赌局双模块 + 模式切换 |
| 6 | 全站导航 | 6 既有页加入口；achievements 页加 bar 分组 |
| 7 | 校验器 | check-data.cjs：mixing / dice 规则 + KNOWN_METRICS |
| 8 | 版本发布 | update_log v2.3.0、7 页 ?v=、README |
| 9 | 整体验证 | npm run check 0/0 + 浏览器手测清单 |

---

## 步骤 1 · core 基建（js/tavern-core.js）

### 1.1 defaultState 补字段

- `counters` 增加 `mixes: 0, diceRolls: 0, encounters: 0, gambleWins: 0`
- state 根增加 `mixLog: []`、`hiddenRecipes: []`、`gambleStreak: 0`
- 老存档由 `loadState()` 的 `Object.assign(defaultState(), data)` 兜底，无需迁移

### 1.2 track 新事件（switch 内追加）

```js
case 'mix':
  state.counters.mixes++;
  if (data && data.hidden && state.hiddenRecipes.indexOf(data.hidden) === -1) {
    state.hiddenRecipes.push(data.hidden);
  }
  break;
case 'diceRoll':  state.counters.diceRolls++;  break;
case 'encounter': state.counters.encounters++; break;
case 'gambleWin': state.counters.gambleWins++; state.gambleStreak++; break;
case 'gambleLose': state.gambleStreak = 0; break;
```

### 1.3 calcMetrics 新指标

```js
mixes: state.counters.mixes,
hiddenRecipes: (state.hiddenRecipes || []).length,
diceRolls: state.counters.diceRolls,
encounters: state.counters.encounters,
gambleWins: state.counters.gambleWins,
gambleStreak: state.gambleStreak || 0
```

### 1.4 新导出

```js
getMixLog: function () { if (!state) loadState(); return (state.mixLog || []).slice(); },
getHiddenRecipes: function () { if (!state) loadState(); return (state.hiddenRecipes || []).slice(); }
```

注：mixLog 的写入由 bar 页经 `track('mix')` 之外另行持久化——core 增加 `pushMixLog(entry)` 内部方法并导出（封顶 100，最新在前，写 localStorage），避免页面直接操作 state。

```js
pushMixLog: function (entry) {
  if (!state) loadState();
  state.mixLog.unshift({ d: entry.d, n: entry.n, h: entry.h });
  if (state.mixLog.length > 100) state.mixLog.length = 100;
  saveState();
}
```

**验证**：`node --check js/tavern-core.js`；浏览器控制台确认 `Tavern.pushMixLog` / `Tavern.getMixLog()` 可用、无报错。

---

## 步骤 2 · 数据文件

> **进度注记（2026-09-12）**：`data/mixing.json` 已提前落地 —— 用户提供了「基酒与配料扩充全集」素材，已解析入库（基酒 15 种含 type/abv/color/desc/openers，配料 58 种含 id/emoji/word/tags/desc，风味短句池 6 维 × 5 条，隐藏配方 4 个为初稿待用户润色）。配料实为 58 种（素材自称 60）；「烈」维度短句池已入库但当前无配料携带该标签（留给隐藏配方或后续扩充）。校验器 mixing 规则（步骤 7 的前半部分）已同步落地并通过反向测试。**本步骤剩余**：data/dice.json、data/achievements.json +6。

### 2.1 data/mixing.json（新）

结构见 spec 2.1。内容要点：

- **5 种基酒**（原创命名，贴合酒馆世界观）：如 蜂蜜蜜酒🍯 / 麦芽黑啤🍺 / 龙息烧🔥 / 月乳酒🌙 / 雾都金酒🌫️，每种 `openers` 2-3 条
- **10 种配料**：如 霜薄荷🌿(凉) / 焦糖蜜🍯(甜) / 苦精🫙(苦) / 火椒粉🌶️(辛) / 柑橘皮🍊(香) / 星尘糖✨(甜) / 血莓🍒(苦/甜) / 姜汁🫚(辛) / 迷迭香🌿(香) / 岩盐🧂(苦)，每种 `word` 一字诗眼
- **tags 短句池**：甜/烈/凉/苦/辛/香 六维，每维 3-4 条
- **4 个隐藏配方**，其一为「第十六杯」（呼应碎片故事「？？？」，文案与 fragments.json 的 s1 呼应）；命名候选：第十六杯 / 壁炉冬语 / 雾中来信 / 空杯
- 文案初稿交付后标注用户润色

### 2.2 data/dice.json（新）

- `encounters`：sum 2~12 恰好 11 条；低点数偏「独处/细节」事件、高点数偏「满座/热闹」，3-4 条带 `person`（如「蝶祈」「举」「桃逸佑」），text 风格与手记一致
- `gamble`：win 3 条 / lose 3 条 / tie 1-2 条 / streak3 1 条（酒保口吻）

### 2.3 data/achievements.json +6

```json
{ "id": "mix-1",        "icon": "🧪", "name": "开杯",       "desc": "在吧台调出第一杯自己的酒", "group": "bar", "metric": "mixes",        "op": ">=", "value": 1 },
{ "id": "mix-10",       "icon": "🍹", "name": "吧台常客",   "desc": "累计调配 10 杯",            "group": "bar", "metric": "mixes",        "op": ">=", "value": 10 },
{ "id": "recipe-1",     "icon": "📓", "name": "秘方收录",   "desc": "调出一杯藏在配方里的酒",    "group": "bar", "hidden": true, "metric": "hiddenRecipes", "op": ">=", "value": 1 },
{ "id": "dice-1",       "icon": "🎲", "name": "骰子入局",   "desc": "在骰子桌掷第一次骰子",      "group": "bar", "metric": "diceRolls",    "op": ">=", "value": 1 },
{ "id": "encounter-10", "icon": "🎭", "name": "满座奇遇",   "desc": "累计遇客 10 次",            "group": "bar", "metric": "encounters",   "op": ">=", "value": 10 },
{ "id": "gamble-3",     "icon": "🪙", "name": "手气不错",   "desc": "在骰子赌局连赢酒保 3 把",   "group": "bar", "metric": "gambleStreak", "op": ">=", "value": 3 }
```

**验证**：`npm run check`（此时校验器尚无新文件规则，至少确认 JSON 合法、成就 id 不重复）。

---

## 步骤 3 · 共享样式（css/tavern.css）

新增（全部 `tavern-` 前缀，注释分节，不改既有规则）：

- `.tavern-bar-slots`：三槽选料区（chip 网格 + 选中态金色描边）
- `.tavern-mix-btn`：调一杯按钮（复用 taste-btn 视觉语言）
- `.tavern-mix-result`：结果卡；`.special` 变体 = 金边 + 微光（与 `.tavern-frag-card.special` 同语言）
- `.tavern-dice`：骰子视觉（CSS 圆点面或 emoji 面）+ `@keyframes tavern-dice-tumble` 掷骰动画；`prefers-reduced-motion` 下禁用
- `.tavern-dice-mode`：🎭/⚔️ 模式切换胶囊
- `.tavern-gamble-vs`：对局布局（你 vs 酒保）
- `.tavern-mixlog-modal`：调酒日志弹窗（复用现有弹窗遮罩风格；列表行 = 日期 + 酒名 + ✦ 隐藏标记）
- 移动端 ≤600px：槽位收缩、结果卡全宽

**验证**：全部为新增 class；任一既有页面刷新无样式回归。

---

## 步骤 4 · 吧台页·调酒台（bar/index.html 新建）

页面骨架：header（返回 + 🍸 吧台 + 副题）→ 调酒台 section → 骰子桌 section → footer；`Tavern.init('..')`；资源引用 `../css/tavern.css?v=v2.3.0`、`../js/tavern-core.js?v=v2.3.0`（先用当前 v2.2.0，步骤 8 统一 bump）。

调酒台实现要点：

- 三槽 chips 由 `Tavern.loadJSON('../data/mixing.json')` 渲染；加载失败整个板块显示「酒保去搬酒了……」占位
- 状态：`sel = { base: null, a: null, b: null }`；A/B 槽同池独立选择，禁止 A === B（同名同 id 时后者选择无效并轻提示）
- 「调一杯」：三槽齐备才 enabled；点击：
  1. 查隐藏配方：`hidden.find(h => h.base === sel.base && 集合相等(h.ingredients, [a, b]))`
  2. 命中 → `Tavern.track('mix', { hidden: h.id })`，结果卡 special 样式 + `h.name` + `h.text`
  3. 未命中 → `Tavern.track('mix')`；酒名 = `base.name · wordA+wordB`；评语 = `base.openers` 随机 1 条 + tags 去重前 2 各随机 1 条短句
  4. `Tavern.pushMixLog({ d: 今日, n: 酒名, h: 隐藏id? })`
- 结果卡入场淡入动画；同组合可重复调（随机池使文案有变化）
- 调酒日志：标题行「册 · 调酒日志」+ 计数；点开弹窗列表（日期 + 酒名 + ✦ 标记），空态文案；数据源 `Tavern.getMixLog()`
- 无障碍：三槽 chips 用 button + `aria-pressed`；结果卡 `role="status"`；弹窗 `role="dialog" aria-modal="true"`（与既有 ARIA 约定一致）

**验证**：手测生成规则（普通/隐藏两分支）、日志写入与封顶、`node` 无涉；控制台无报错。

---

## 步骤 5 · 吧台页·骰子桌（bar/index.html）

- 模式切换胶囊：🎭 遇客 / ⚔️ 赌局（两个按钮 + `aria-pressed`，切换仅显隐对应面板）
- **掷骰遇客**：
  - 「🎲 掷骰」→ `Tavern.track('diceRoll')`；2d6 随机（1-6 + 1-6），骰子 tumble 动画 ~600ms 后落定
  - 查 `encounters.find(e => e.sum === 总点数)` 渲染结果卡（icon/title/text）
  - `e.person` 存在 → 卡底部渲染语录（quote 优先、否则 intro 截断 60 字）+ 金色链接 `../drinker/index.html?name=encodeURIComponent(person)`；随后 `Tavern.track('encounter')`
- **骰子赌局**：
  - 「⚔️ 开赌」→ 你与酒保各 2d6，动画后同时落定；`Tavern.track('diceRoll')`
  - 我方 > 酒保：`Tavern.track('gambleWin')`；< ：`Tavern.track('gambleLose')`；=：平（不动 streak）
  - 结果卡展示双方点数 + 对应池随机台词；胜且 `Tavern.getMetrics().gambleStreak >= 3` 时改用 `streak3` 台词（连赢期间每次都显示）
- dice.json 加载失败：骰子桌板块整体占位，不影响调酒台
- 掷骰期间按钮禁用防连点

**验证**：两模式各掷多次；遇客 2~12 全点数可达（可临时遍历 11 次验证映射）；赌局 streak 归零逻辑正确。

---

## 步骤 6 · 全站导航（6 既有页）

加入口「🍸 吧台」→ `bar/`（子页面为 `../bar/`）：

| 页面 | 插入点 |
|------|--------|
| index.html | 底部固定栏，插在 🍺 酒单链接之后 |
| drinker/index.html | footer `foot-link` 列表（menu 链接后） |
| menu/index.html | footer（L161 🗺️ 地图前区域） |
| achievements/index.html | footer（L129 前）+ **`GROUPS` 数组 L144-149 在 `secret` 前插入 `{ key: 'bar', label: '🍸 吧台', count: '杯盏之间' }`** |
| timeline/index.html | footer（L241 前） |
| map/index.html | footer（L458-462 列表内） |

**验证**：7 页导航互达；achievements 页吧台分组标题与计数正确渲染。

---

## 步骤 7 · 校验器（tools/check-data.cjs）

1. 顶部加载：`const mixingDoc = readJSON('data/mixing.json'); const diceDoc = readJSON('data/dice.json');`
2. **mixing.json 规则**：
   - bases / ingredients 非空数组；id 唯一、name / emoji 非空；base.openers 非空字符串数组
   - 配料 `word` 非空、`tags` 非空数组且每项 ⊆ `tags` 键集（ERROR）
   - hidden：id 唯一；base 必须存在；ingredients 恰好 2 个、互不相同且均存在；`base+ingredients` 组合整体无重复；name / text 非空
3. **dice.json 规则**：
   - encounters 的 sum 集合 === {2..12}（缺/多/重复均 ERROR）；title / text 非空；person 若存在必须在花名册
   - gamble.win / lose / tie 为非空字符串数组；streak3 若存在为非空字符串
4. `KNOWN_METRICS` += `mixes, hiddenRecipes, diceRolls, encounters, gambleWins, gambleStreak`

**验证**：`npm run check` 全绿；故意注入坏数据（tags 越界 / encounters 缺 sum=7 / person 写错名 / 隐藏配方组合重复）→ 各自报 ERROR，还原后恢复（与单向 links 登记的反向测试同套路）。

---

## 步骤 8 · 版本发布（v2.3.0）

1. `data/update_log.json` 顶部插入 `{ "date": "2026-09-12", "version": "v2.3.0", "entries": [吧台页 / 自由调配与隐藏配方 / 骰子桌双模块 / 成就 +6 / 导航入口 / 校验器新规则] }`
2. 7 个页面（6 既有 + bar/）：`tavern.css` 与 `tavern-core.js` 引用统一 `?v=v2.3.0`
3. README：目录结构加 bar/ 与两个新数据文件；页面说明加「吧台页」；数据文件章节补 mixing.json / dice.json 字段表；维护指引补「加配料 / 加遇客事件 / 发版 ?v=」；成就章节如提及分组需同步 bar

**验证**：`npm run check` 0 错误 0 警告（版本一致性规则会自动核对 7 页 ?v=）。

---

## 步骤 9 · 整体验证

### 自动

- `npm run check` → 0 错误 0 警告
- 注入坏数据反向测试（步骤 7 列表）→ 全部拦截

### 浏览器手测清单

1. 调酒：选料 → 调一杯 → 酒名/评语生成正确；重复同组合文案有变化；空槽时按钮禁用；A=B 拦截
2. 隐藏配方：按 4 个配方逐组调配 → 金色结果卡 + 专属文案；首个触发「秘方收录」成就弹窗；重复调不重复计数
3. 调酒日志：新杯置顶、隐藏杯带 ✦、老存档进入不报错、空态文案
4. 遇客：骰子动画 + 点数映射正确；带 person 的事件语录与档案链接跳转正常
5. 赌局：胜/负/平台词正确；连赢 3 把显示 streak3；输一把后 streak 归零（再连赢 3 把可再次验证）
6. 成就：6 枚新成就进度/解锁正常；成就墙出现「🍸 吧台」分组且计数正确
7. 导航：7 页 🍸 吧台互达，当前页不可点
8. 降级：改错 mixing.json / dice.json 路径 → 对应板块占位文案，页面不白屏
9. 回归：碎片 / 手记 / 品鉴 / 版本号等既有功能无异常；≤600px 布局不溢出

### 收尾

- 用户润色 mixing.json / dice.json 文案（实现交初稿）；润色不改结构，无需 bump ?v=

---

## 明确不做（与 spec 一致）

- 第三轮内容（存档导入导出、全站搜索、懒加载、OG 标签）
- 赌局筹码/经济系统、配方分享导出、配方图鉴页
- mixing.json / dice.json 文案定稿
