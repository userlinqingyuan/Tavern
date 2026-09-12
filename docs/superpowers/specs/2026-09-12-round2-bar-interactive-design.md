# 第二轮 · 互动玩法：吧台页（自选调酒 / 骰子桌）

- 日期：2026-09-12
- 状态：设计已确认（三轮路线图的第二轮，见文末「设计澄清记录」）
- 架构约束：纯静态 HTML/CSS/JS，无构建、无依赖；数据全部 JSON 化；共享逻辑进 `tavern-core.js`，共享样式进 `tavern.css`

---

## 一、总览

新建 **吧台页 `bar/index.html`**，作为两个互动玩法的载体：

```
🍸 吧台（bar/）
├── 🧪 调酒台：1 基酒 + 2 配料 → 调出一杯（程序生成酒名 + 酒保评语）
│   ├── 隐藏配方：特定组合触发专属酒名与特殊评语（4 个）
│   └── 调酒日志：历史每一杯可翻看（localStorage，封顶 100 条）
└── 🎲 骰子桌：双模块，页内切换
    ├── 🎭 掷骰遇客：掷 2d6，点数之和映射今晚的酒桌奇遇
    └── ⚔️ 骰子赌局：你 vs 酒保各掷 2d6 比大小，连赢有特殊反应
```

底部导航全站加「🍸 吧台」入口（封面底栏 + 5 个子页面页脚 + 吧台页自身页脚）。

## 二、调酒台（自由调配）

### 2.1 数据：`data/mixing.json`（新）

```json
{
  "bases": [
    { "id": "mead", "name": "蜂蜜蜜酒", "emoji": "🍯", "openers": ["……", "……"] }
  ],
  "ingredients": [
    { "id": "mint", "name": "霜薄荷", "emoji": "🌿", "word": "霜", "tags": ["凉"] }
  ],
  "tags": {
    "甜": ["……风味短句……"],
    "烈": ["…"], "凉": ["…"], "苦": ["…"], "辛": ["…"], "香": ["…"]
  },
  "hidden": [
    { "id": "h16", "base": "mead", "ingredients": ["mint", "berry"], "name": "第十六杯", "text": "……" }
  ]
}
```

- `bases`：5 种基酒，`openers` 为酒保评语的开场白池（每基酒 2-3 条）
- `ingredients`：10 种配料，`word` 为融入酒名的一字/二字诗眼，`tags` 从 `tags` 键集取值（1-2 个）
- `hidden`：4 个隐藏配方，`base` + 恰好 2 个 `ingredients`（无序）；`name` 为专属酒名，`text` 为专属评语；其中至少 1 个与既有叙事联动（候选：「第十六杯」呼应碎片收集的「？？？」传说）
- 文案初稿由实现方起草，标注用户润色

### 2.2 交互

- 三个选择槽：基酒槽（单选）+ 配料槽 A/B（同选池，可重复选择但不允许 A=B 同名同 id）
- 「调一杯」按钮：三槽齐备才可点；点击后生成结果卡并写入日志
- 结果卡：酒名 + 评语；命中隐藏配方时用金色特殊样式（复用碎片 special 视觉语言）并展示专属 `text`
- 生成规则（实现于 bar 页 JS，内容全部来自 JSON）：
  - **酒名**：普通 = `基酒名 · wordAwordB`；隐藏 = `hidden.name`
  - **评语**：普通 = 基酒 `openers` 随机 1 条 + 配料 tags 去重后取前 2 个、各从 `tags[tag]` 随机 1 条短句；隐藏 = `hidden.text`

### 2.3 调酒日志

- 每杯记录 `{ d: 'YYYY-MM-DD', n: 酒名, h: 隐藏配方id（可选） }`
- 上限 100 条，最新在前；弹窗/折叠列表可翻；空态文案兜底
- 不限调配次数，无每日配额

## 三、骰子桌（双模块）

### 3.1 数据：`data/dice.json`（新）

```json
{
  "encounters": [
    { "sum": 2, "icon": "🕯️", "title": "角落的私语", "text": "……", "person": null }
  ],
  "gamble": {
    "win": ["……", "……"],
    "lose": ["……", "……"],
    "tie": ["……"],
    "streak3": "……"
  }
}
```

- `encounters`：**sum 2~12 每个点数恰好一条**（共 11 条，校验器强制）；`person` 可选，填花名册正名时结果卡渲染该旅客的语录与「查看档案」链接（联动 `people.json`）
- `gamble`：胜/负/平台词池 + 连赢 3 把专属台词 `streak3`

### 3.2 掷骰遇客

- 掷 2d6，动画落定后取点数之和查 `encounters`
- 结果卡：icon + title + text；`person` 存在时附该人物一句话（`quote` 为空则用 `intro` 截断）+ 金色档案链接
- 计数：每次掷骰 `diceRolls++`，命中事件 `encounters++`

### 3.3 骰子赌局

- 你与酒保各掷 2d6，比点数大小：胜 / 负 / 平
- 结果卡展示双方点数与对应台词（win/lose/tie 池随机）；连赢达 3 把时改出 `streak3` 台词
- 计数：`diceRolls++`；胜 `gambleWins++` 且 `gambleStreak++`，负则 `gambleStreak` 归零，平不变
- 纯氛围玩法：无筹码、无经济、无惩罚

## 四、状态与指标（tavern-core.js）

### 4.1 状态字段（`tavern_state_v1`）

| 字段 | 类型 | 说明 |
|------|------|------|
| `counters.mixes` | number | 累计调酒次数 |
| `counters.diceRolls` | number | 累计掷骰次数（两模式合计） |
| `counters.encounters` | number | 累计遇客次数 |
| `counters.gambleWins` | number | 累计赌局胜场 |
| `mixLog` | array | 调酒日志，封顶 100 |
| `hiddenRecipes` | array | 已发现隐藏配方 id（去重） |
| `gambleStreak` | number | 当前连赢场数（负局归零） |

`defaultState()` 补齐默认值；老存档经 `Object.assign` 自动兜底。

### 4.2 track 事件

```
mix        → counters.mixes++；data.hidden 存在时去重写入 hiddenRecipes
diceRoll   → counters.diceRolls++
encounter  → counters.encounters++
gambleWin  → counters.gambleWins++；gambleStreak++
gambleLose → gambleStreak = 0
```

### 4.3 calcMetrics 与导出

- `mixes / hiddenRecipes / diceRolls / encounters / gambleWins / gambleStreak` 六个新指标
- 新导出：`getMixLog()`（副本）、`getHiddenRecipes()`（副本）、`pushMixLog(entry)`（日志写入唯一入口：unshift 置顶、封顶 100、落 localStorage；页面不直接操作 state）

## 五、成就（+6，新增分组 bar）

achievements.json 新增（组 `bar`，成就墙 `GROUPS` 配置在 `secret` 前插入 `{ key: 'bar', label: '🍸 吧台', count: '杯盏之间' }`）：

| id | icon | 名称 | 条件 | hidden |
|----|------|------|------|--------|
| `mix-1` | 🧪 | 开杯 | mixes ≥ 1 | |
| `mix-10` | 🍹 | 吧台常客 | mixes ≥ 10 | |
| `recipe-1` | 📓 | 秘方收录 | hiddenRecipes ≥ 1 | ✓ |
| `dice-1` | 🎲 | 骰子入局 | diceRolls ≥ 1 | |
| `encounter-10` | 🎭 | 满座奇遇 | encounters ≥ 10 | |
| `gamble-3` | 🪙 | 手气不错 | gambleStreak ≥ 3 | |

## 六、全站导航

- 6 个既有页面加入口：封面底栏（index.html 底部固定栏，插在 🍺 酒单后）、drinker / menu / achievements / timeline / map 页脚（`foot-link` 列表插 🍸 吧台）
- bar/index.html 页脚与既有子页同构（当前页为不可点文本）

## 七、校验器（check-data.cjs）

1. **mixing.json**：bases / ingredients 非空且 id 唯一、name 非空、openers 为非空字符串数组；配料 `tags` 非空且 ⊆ `tags` 键集；hidden 的 base / ingredients 引用必须存在、ingredients 恰好 2 个且不重复、隐藏配方组合整体无重复、name / text 非空
2. **dice.json**：encounters 对 sum 2~12 **每点数恰好一条**；title / text 非空；person（若有）必须在花名册；gamble.win / lose / tie 为非空字符串数组
3. **KNOWN_METRICS** += `mixes / hiddenRecipes / diceRolls / encounters / gambleWins / gambleStreak`
4. 成就分组白名单（若存在）加 `bar`（实现时核实）

## 八、文件改动清单

| 文件 | 动作 |
|------|------|
| `bar/index.html` | 新增（调酒台 + 骰子桌 + 日志 + 页脚） |
| `data/mixing.json` | 新增 |
| `data/dice.json` | 新增 |
| `data/achievements.json` | +6（组 bar） |
| `js/tavern-core.js` | 状态字段 / track / calcMetrics / 导出 |
| `css/tavern.css` | 吧台组件共享样式（`tavern-` 前缀，含骰子动画、移动端适配） |
| `index.html` + 5 个子页面 | 底部导航加 🍸 吧台；achievements 页另加 bar 分组 |
| `tools/check-data.cjs` | 新校验规则 + KNOWN_METRICS |
| `data/update_log.json` | 顶部加 v2.3.0 |
| 全部 7 页 | `?v=` 同步 v2.3.0 |
| `README.md` | 目录结构 / 页面说明 / 数据文件 / 维护指引 |

## 九、验收标准

- `npm run check`：0 错误 0 警告
- 浏览器手测：
  1. 调酒：三槽交互、酒名/评语生成正确、同组合重复调出文案有变化（随机池）、空槽禁用按钮
  2. 隐藏配方：命中金色结果卡 + 专属文案 +「秘方收录」成就弹窗；重复调出不重复计数
  3. 日志：记录按时间倒序、隐藏杯有标记、老存档进入不报错
  4. 遇客：掷骰动画、2~12 事件均可达（可临时加权验证）、person 联动卡链接跳档案
  5. 赌局：胜/负/平台词正确、连赢 3 把触发 streak3、负局后连赢计数归零
  6. 成就：6 枚新成就解锁与进度显示正常，吧台分组出现在成就墙
  7. 导航：7 个页面 🍸 吧台入口可达且当前页高亮（不可点）正确
  8. 降级：mixing.json / dice.json 加载失败时对应板块显示占位文案，不白屏
  9. 回归：碎片、手记、品鉴等既有玩法不受影响；移动端 ≤600px 布局不溢出

## 十、范围外（明确不做）

- 第三轮内容：存档导出/导入、全站搜索 / Ctrl+K、图片懒加载、OG 标签
- 赌局筹码 / 经济系统、配方分享导出、调酒配方图鉴页
- mixing.json / dice.json 文案定稿（实现方交初稿，用户润色）

---

## 附：设计澄清记录（2026-09-12 用户逐项确认）

1. 调酒形态：**自由调配**（基酒+配料组合，非叙事点单/轻量点单）
2. 配料来源：**全新独立配料表**（不从现有 15 款酒提取）
3. 隐藏配方：**要**
4. 频率：**不限次 + 记日志**
5. 骰子桌：**掷骰遇客与骰子赌局都要**，开发为骰子桌页内两个模块、交互切换
6. 页面落点：**新建吧台页**（调酒台 + 骰子桌集中一处，不并入酒单页）
7. 成就：**每玩法 2-3 枚**
