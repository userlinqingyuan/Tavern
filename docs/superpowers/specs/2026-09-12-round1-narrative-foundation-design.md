# 第一轮 · 叙事打底：资源版本号 / 酒保手记 / 碎片收集

- 日期：2026-09-12
- 状态：已确认（三轮路线图的第一轮，见文末「路线图背景」）
- 架构约束：纯静态 HTML/CSS/JS，无构建、无依赖；数据全部 JSON 化；共享逻辑进 `tavern-core.js`，共享样式进 `tavern.css`

---

## 一、资源版本号（缓存治理）

### 现状痛点

浏览器会缓存 `tavern-core.js` 与 `data/*.json`，改完代码后页面仍跑旧逻辑，开发与发版都受影响。

### 方案

版本号的唯一来源 = `data/update_log.json` 最新条目的 `version` 字段（如 `v2.2.0`）。

1. **HTML 引用加参数**：6 个页面的 `<link rel="stylesheet">` 与 `<script src>` 引用统一追加 `?v=v2.2.0` 形式参数（值与 update_log 最新 version 一致）
2. **core 解析版本**：`tavern-core.js` 启动时从自身 `<script>` 标签的 src 解析 `?v=` 参数，暴露为 `Tavern.v`；参数缺失时 `Tavern.v` 为空字符串，所有追加逻辑静默跳过（兼容兜底场景）
3. **数据请求带版本**：`Tavern.loadJSON(path)` 给 URL 追加版本参数（无 query 时用 `?v=`，已有 query 用 `&v=`）
4. **收拢直接 fetch**：
   - `drinker/index.html` 直连的 `update_log.json` 请求改走 `Tavern.loadJSON`
   - `timeline/index.html` 私有的 loadJSON 包装优先委托 `Tavern.loadJSON`
   - 两处「core 未加载时的兜底 fetch」（drinker 页 loadJSON fallback、drinks.json fallback）保持原样——core 缺席时拿不到版本号，无参数可加
5. **校验器兜底**：`check-data.cjs` 新增规则——扫描全部 HTML 中带 `?v=` 的本地资源引用，要求：① 每页对 `tavern-core.js` 与 `tavern.css` 的引用均带 `?v=`；② 所有 `?v=` 值一致；③ 值 === update_log 最新 version。违反任何一条报 ERROR

### 发版流程（改后）

加一条 update_log 条目 → 把各 HTML 的 `?v=` 改成新版本号。漏改会被 `npm run check` 拦下。

---

## 二、酒保手记

### 数据：`data/notes.json`（新文件）

```json
[
  { "person": ["泠钰", "祈渊"], "text": "今晚那两个人又坐在角落……" },
  { "person": [], "text": "下雨天，门轴的吱呀声都变得温柔。" }
]
```

- `person`：字符串数组，可为空；名字经 `ALIAS_FIX` 别名修正后必须能匹配 `people.json` 中的人物（校验器强制）
- 首批量 20-30 条，由实现方基于 `people.json`（quote/relations）、`events.json` 现有素材起草初稿，**用户负责最终润色定稿**

### 展示

| 位置 | 形式 |
|------|------|
| 封面 `index.html` | 新增「今日手记」独立区块（parchment 风格小卡片，与借阅记录区视觉一致），角落有「往期 ✎」按钮 |
| 档案页 `drinker/index.html` | 页眉下方细横幅，展示同一天同一篇 |

### 轮换算法

年内第 N 天 % notes.length（本地时区确定性计算，与酒单页「今日特供」同款逻辑）。

### 人物链接

每条手记只把 `person` 数组中登记的名字渲染为金色链接（不做全文正则匹配，避免误伤）：

- 封面 → `drinker/index.html?name=名字`
- 档案页 → `?name=名字`（本页深链）

### 往期手记

点「往期 ✎」打开列表弹窗：全部手记按数组顺序展示，当日一篇置顶并标记「今日」。弹窗样式进 `tavern.css`，交互脚本在封面页内实现。

### 埋点与成就

- 新指标 `notesRead`：页面渲染今日手记时 `Tavern.track('notesRead')`（封面 + 档案页各计一次；阈值宽松，计数略高无影响）
- `achievements.json` 新增 2 枚（`archive` 组）：

```json
{ "id": "first-note", "icon": "📝", "name": "听酒保说话", "desc": "读一次酒保手记", "group": "archive", "metric": "notesRead", "op": ">=", "value": 1 }
{ "id": "note-10", "icon": "📖", "name": "手记常客", "desc": "累计阅读酒保手记 10 次", "group": "archive", "metric": "notesRead", "op": ">=", "value": 10 }
```

### 降级

notes.json 加载失败：手记区块显示「（手记被风吹走了……）」占位文案，页面其余功能不受影响。

---

## 三、碎片收集 → 隐藏故事

### 数据迁移：`data/fragments.json`（新文件）

```json
{
  "fragments": [
    { "text": "烛火摇曳时，墙上的影子在讲自己的故事。", "source": "酒馆的角落" }
  ],
  "story": [
    { "id": "s1", "text": "……" },
    { "id": "s6", "text": "……" }
  ]
}
```

- `fragments`：普通氛围碎片，即现 `index.html` 硬编码的 10 条原文迁移 + 可扩充
- `story`：6 条故事碎片，**数组顺序即拼合顺序**；内容围绕空白档案「？？？」展开，最后一条暗示去档案册翻空白卡（与既有 secret 成就「第 16 位酒客」叙事呼应，不强制解锁）
- 故事文案由实现方起草初稿，用户润色定稿
- `index.html` 删除硬编码 `fragmentMessages`，改走 `Tavern.loadJSON('data/fragments.json')`；加载失败时用内置 3-5 条普通文案兜底，按钮功能不中断

### 抽取机制（确定性保底）

复用既有计数器 `fragmentsDrawn`：

1. 每次点击按钮：`fragmentsDrawn++`
2. 若 `fragmentsDrawn % 3 === 0` 且存在未收集的故事碎片 → 本次出**下一枚**未收集的故事碎片（按 story 数组顺序）
3. 否则出普通碎片
4. 已集齐全部故事碎片后永远只出普通碎片

完成周期 ≈ 18 次点击；老用户因 `fragmentsDrawn` 已有累计，首次点击可能提前触发故事碎片（视为惊喜）。

### 收集状态（单一数据源）

- `tavern_state_v1` 新增字段 `storyFragments: []`（故事碎片 id 数组，按收集时间顺序）
- `defaultState()` 补默认值，老存档加载后自动补齐
- 抽到故事碎片时 `track('storyFragment', { id })`，去重后写入 `storyFragments`
- core 指标计算处新增 `storyFragments = state.storyFragments.length`

### UI

| 元素 | 说明 |
|------|------|
| 徽标 | 封面碎片按钮旁显示「✦ n/6」收集进度，点击打开碎片集弹窗 |
| 碎片集弹窗 | 6 格列表：已收集显示金色卡片（序号 + 原文），未收集显示「？？？」暗格；集齐后弹窗顶部显示完整拼合段落 |
| 故事碎片弹出 | `Tavern.openFragment` 扩展 `special: true` 字段：弹窗加金色边框样式 + 副标题「✦ 故事碎片 n/6」；无 `special` 字段时行为完全不变（向后兼容） |

### 成就

`achievements.json` 新增 1 枚（`secret` 组 + hidden）：

```json
{ "id": "story-complete", "icon": "🔮", "name": "拼合真相", "desc": "集齐 6 枚故事碎片，拼出酒馆的秘密", "group": "secret", "hidden": true, "metric": "storyFragments", "op": ">=", "value": 6 }
```

集齐时由既有解锁弹窗自然触发提示。

---

## 四、工程守则同步

### `tools/check-data.cjs` 新增规则

1. **notes.json**：非空数组；每条 `text` 非空；`person` 内每个名字（经 ALIAS_FIX 修正后）能匹配 people.json，否则 ERROR
2. **fragments.json**：`fragments` 非空且每条 `text` 非空；`story` 的 id 唯一且 `text` 非空；**story 条数必须等于 achievements.json 中 `story-complete` 的 `value`**（6），否则 ERROR
3. **版本号一致性**（见第一节第 5 条）
4. `KNOWN_METRICS` 增加 `notesRead`、`storyFragments`

### 文档

- `README.md`：目录结构补 `notes.json`、`fragments.json`；封面页/档案页说明补手记与碎片集；维护说明补「发版时改 ?v=」流程
- `data/update_log.json`：新增 `v2.2.0` 条目

---

## 五、文件改动清单

| 文件 | 改动 |
|------|------|
| `data/notes.json` | 新建，20-30 条手记 |
| `data/fragments.json` | 新建，普通碎片 + 6 条故事碎片 |
| `js/tavern-core.js` | `Tavern.v` 解析、`loadJSON` 加版本参数、`openFragment` 支持 `special`、指标 `storyFragments`、`defaultState` 补字段 |
| `index.html` | `?v=` 参数、今日手记区块 + 往期弹窗、碎片迁移 + 收集徽标 + 碎片集弹窗 |
| `drinker/index.html` | `?v=` 参数、手记横幅、update_log 请求改走 loadJSON |
| `timeline/index.html` | `?v=` 参数、loadJSON 包装委托 core |
| `menu/index.html`、`achievements/index.html`、`map/index.html` | `?v=` 参数 |
| `css/tavern.css` | 手记卡 / 手记横幅 / 往期弹窗 / 收集徽标 / 碎片集弹窗 / 金色碎片样式 |
| `data/achievements.json` | +3 枚成就 |
| `tools/check-data.cjs` | 新校验规则 + KNOWN_METRICS |
| `README.md`、`data/update_log.json` | 文档与日志 |

---

## 六、验收标准

1. `npm run check` 0 ERROR
2. 任一 HTML 的 `?v=` 与 update_log 最新版本不一致 / 各页不一致 / core 或 css 引用缺参数 → check 报 ERROR
3. 封面与档案页同一天展示同一篇手记；修改系统日期可验证轮换与人物金色链接跳转
4. notes.json 或 fragments.json 加载失败时占位/兜底文案出现，页面无白屏无报错中断
5. 老存档（无 `storyFragments` 字段）进入页面后自动补默认值，既有成就判定不受影响
6. 每抽 3 次普通碎片必出 1 枚未收集故事碎片；第 6 枚集齐时「拼合真相」成就弹窗触发，碎片集弹窗显示完整拼合段落
7. 无 `special` 字段的碎片弹窗样式与行为与改造前完全一致

---

## 七、范围外（明确不做）

- 路线图第二、三轮内容（自选调酒、骰子桌、存档导入导出、全站搜索、懒加载、OG 标签）
- 已砍项目：旅客小剧场、时段氛围、布告栏、留言簿、分享卡片、PWA
- 手记/故事文案的最终定稿（实现方只交初稿，用户润色）

---

## 附：路线图背景

经 brainstorming 确认的三轮规划：

1. **第一轮 · 叙事打底**（本 spec）：资源版本号、酒保手记、碎片收集
2. **第二轮 · 互动玩法**：自选调酒、骰子桌
3. **第三轮 · 实用功能收尾**：存档导出/导入、全站搜索 / Ctrl+K、图片懒加载、OG 标签
