# 第一轮实施计划 · 叙事打底

- 日期：2026-09-12
- 对应 spec：[2026-09-12-round1-narrative-foundation-design.md](../specs/2026-09-12-round1-narrative-foundation-design.md)
- 约束：无构建、无依赖；数据 JSON 化；共享逻辑进 `tavern-core.js`，共享样式进 `tavern.css`

## 对 spec 的一处修正（已核实代码）

spec 第一节第 4 条说 timeline 的 loadJSON 包装需要「优先委托 core」——核实后 [timeline/index.html#L256-257](../../../timeline/index.html) 与 [drinker/index.html#L1010-1011](../../../drinker/index.html) **均已是委托 + 兜底模式，无需改动**。真正要收拢的直连 fetch 只有 drinker 页 `loadChangelog()` 的 `update_log.json` 一处（L1102-1110）。

## 步骤总览

| # | 步骤 | 产出 |
|---|------|------|
| 1 | core 基建 | tavern-core.js：版本解析 / loadJSON 加参 / track 新事件 / 指标 / openFragment special |
| 2 | 数据文件 | data/notes.json、data/fragments.json、data/achievements.json +3 |
| 3 | 共享样式 | tavern.css：手记卡 / 横幅 / 往期弹窗 / 徽标 / 碎片集弹窗 / 金色碎片 |
| 4 | 封面页 | index.html：今日手记区块、碎片迁移 + 收集徽标 + 碎片集弹窗 |
| 5 | 档案页 | drinker/index.html：手记横幅、changelog 请求收拢 |
| 6 | 校验器 | check-data.cjs：notes/fragments/版本号规则 + KNOWN_METRICS |
| 7 | 版本发布 | update_log v2.2.0、6 页 ?v=、README |
| 8 | 整体验证 | npm run check 0 ERROR + 浏览器手测清单 |

---

## 步骤 1 · core 基建（js/tavern-core.js）

### 1.1 版本解析（IIFE 顶部，STATE_KEY 附近）

```js
var CORE_VERSION = (function () {
  try {
    var src = (document.currentScript && document.currentScript.src) || '';
    var m = src.match(/[?&]v=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : '';
  } catch (e) { return ''; }
})();
```

- `document.currentScript` 仅在脚本同步执行期有效，IIFE 立即执行，安全
- 导出对象新增 `v: CORE_VERSION`

### 1.2 loadJSON 追加版本参数

`CORE_VERSION` 非空时：`url + (url.indexOf('?') === -1 ? '?' : '&') + 'v=' + CORE_VERSION`；为空则原样请求（兼容兜底场景）。`jsonCache` 仍按原始 path 键控，不改。

### 1.3 defaultState 补字段

- `counters` 增加 `notesRead: 0`
- state 根增加 `storyFragments: []`
- `loadState()` 的 `Object.assign(defaultState(), data)` 已自动兜底老存档缺字段，无需改动

### 1.4 track 新事件

```js
case 'notesRead': state.counters.notesRead++; break;
case 'storyFragment':
  if (data.id && state.storyFragments.indexOf(data.id) === -1) state.storyFragments.push(data.id);
  break;
```

### 1.5 calcMetrics 新指标

- `notesRead: state.counters.notesRead`
- `storyFragments: (state.storyFragments || []).length`

### 1.6 openFragment 支持 special

```js
var card = fragOverlay.querySelector('.tavern-frag-card');
card.classList.toggle('special', !!fragment.special);
```

`source` 文案仍由调用方传入（如 `'✦ 故事碎片 3/6'`），core 不拼接。无 `special` 字段时行为与现状完全一致。

### 1.7 新导出

`getStoryFragments: function () { if (!state) loadState(); return (state.storyFragments || []).slice(); }`

**验证**：`node -c`（语法检查）；打开任一页面控制台确认 `Tavern.v`、`Tavern.getStoryFragments()` 可用、无报错。

---

## 步骤 2 · 数据文件

### 2.1 data/notes.json（新，20-30 条）

```json
[
  { "person": ["泠钰"], "text": "……" },
  { "person": [], "text": "……" }
]
```

- 名字一律用 people.json 的规范名（泠钰，不用「冷钰」）
- 文案口吻：酒保第一人称观察手记，与 drinks.json 的 story 风格一致
- 素材来源：people.json 的 quote/relations、events.json 的既有事件
- **初稿由实现方起草，标注给用户润色**

### 2.2 data/fragments.json（新）

```json
{
  "fragments": [ { "text": "…", "source": "…" } ],   // 现 index.html 硬编码 10 条原文迁移
  "story": [ { "id": "s1", "text": "…" }, … 6 条 ]     // 顺序即拼合顺序
}
```

- story 六条围绕空白档案「？？？」：为何空白 → 谁/什么留下的 → 最后一条暗示「去档案册翻开那张空白的卡」
- 与既有 secret 成就「第 16 位酒客」呼应但不强制解锁

### 2.3 data/achievements.json +3

```json
{ "id": "first-note", "icon": "📝", "name": "听酒保说话", "desc": "读一次酒保手记", "group": "archive", "metric": "notesRead", "op": ">=", "value": 1 }
{ "id": "note-10", "icon": "📖", "name": "手记常客", "desc": "累计阅读酒保手记 10 次", "group": "archive", "metric": "notesRead", "op": ">=", "value": 10 }
{ "id": "story-complete", "icon": "🔮", "name": "拼合真相", "desc": "集齐 6 枚故事碎片，拼出酒馆的秘密", "group": "secret", "hidden": true, "metric": "storyFragments", "op": ">=", "value": 6 }
```

**验证**：`npm run check`（此时校验器还没有新文件规则，至少确认 JSON 合法、achievements 无重复 id）。

---

## 步骤 3 · 共享样式（css/tavern.css）

新增（全部带 `tavern-` 前缀，注释分节）：

- `.tavern-note-card`：封面今日手记卡（parchment 风格，与借阅记录区一致）
- `.tavern-note-banner`：档案页页眉细横幅
- `.tavern-note-modal`：往期手记列表弹窗（复用现有弹窗遮罩风格）
- `.tavern-frag-badge`：碎片按钮旁「✦ n/6」小徽标
- `.tavern-frag-collection`：碎片集弹窗（6 格网格；已收集金色卡 / 未收集「？？？」暗格；集齐后顶部完整段落）
- `.tavern-frag-card.special`：金色边框 + 微光动画（对应 core 的 special class）
- 人物金色链接样式若 tavern.css 已有则复用，没有则补 `.tavern-person-link`
- 移动端适配（≤600px：手记卡内边距收缩、碎片集 3 格/行）

**验证**：改动均为新增 class，不改既有规则；任一页面刷新无样式回归。

---

## 步骤 4 · 封面页（index.html）

### 4.1 今日手记区块

- 位置：借阅记录区附近新增独立区块，含标题「📖 今日手记」、正文、角落「往期 ✎」按钮
- 数据：`Tavern.loadJSON('data/notes.json')`；`Tavern.todaysDrinkIndex(notes.length)` 取当日一篇（复用既有算法）
- 渲染时 `Tavern.track('notesRead')`
- 人物链接：只把该篇 `person` 数组里的名字替换为金色链接 → `drinker/index.html?name=名字`（先 escapeHtml 全文，再对白名单名字做替换）
- 失败降级：显示「（手记被风吹走了……）」
- 往期弹窗：列表按数组顺序，当日篇置顶标记「今日」

### 4.2 碎片改造

- 删除硬编码 `fragmentMessages`（L972-983），改 `Tavern.loadJSON('data/fragments.json')`；失败兜底内置 3-5 条原文案
- 抽取流程：
  1. `Tavern.track('fragment')`（fragmentsDrawn++）
  2. `const m = Tavern.getMetrics()`；若 `m.fragmentsDrawn % 3 === 0` 且 `story` 中存在未收集 id → 取下一枚未收集故事碎片，`Tavern.track('storyFragment', { id })`，`Tavern.openFragment({ text, source: '故事碎片 ' + n + '/6', special: true })`
  3. 否则随机普通碎片，`Tavern.openFragment(fragment)`（不带 special）
  4. 更新徽标「✦ n/6」（n = `Tavern.getMetrics().storyFragments`）
- 碎片集弹窗：点徽标打开；6 格按 story 顺序，已收集（对照 `Tavern.getStoryFragments()`）显示序号 + 原文，未收集「？？？」；集齐后顶部渲染完整拼合段落

**验证**：浏览器手测——抽 3 次必出故事碎片（可临时改 % 1 加速验证后还原）；徽标计数正确；老存档首次进入不报错；断网/改错 JSON 路径时占位文案出现。

---

## 步骤 5 · 档案页（drinker/index.html）

- 页眉下方新增手记细横幅：同款数据加载 + `todaysDrinkIndex` + 人物链接（`?name=`，本页深链已有）+ `track('notesRead')`；失败降级整条横幅不渲染
- `loadChangelog()`（L1102-1110）：优先 `Tavern.loadJSON('../data/update_log.json')`，保留 fetch 兜底（与其他 loadJSON 调用点同款模式）

**验证**：横幅显示当日同一篇手记；`?name=` 链接跳转滚动高亮正常；版本日志仍正常渲染。

---

## 步骤 6 · 校验器（tools/check-data.cjs）

1. **notes.json**：非空数组；每条 `text` 非空；`person` 经 ALIAS_FIX 修正后须匹配 people.json（否则 ERROR）
2. **fragments.json**：`fragments` 非空且 text 非空；`story` id 唯一、text 非空；**story 条数 === achievements.json 中 `story-complete.value`**（否则 ERROR）
3. **版本号**：扫描全部 `*.html` 中对 `tavern-core.js` / `tavern.css` 的引用——必须带 `?v=`；所有页面的值一致；且 === update_log 最新 version（否则 ERROR）
4. `KNOWN_METRICS` += `notesRead`、`storyFragments`

**验证**：`npm run check` 全绿；故意改错一处 person 名 / story 条数 / 某页 ?v= → 对应 ERROR 出现，还原后恢复。

---

## 步骤 7 · 版本发布

1. `data/update_log.json` 顶部加 `v2.2.0` 条目（date 2026-09-12，entries 列手记 / 碎片收集 / 版本号治理三项）
2. 6 个页面：`tavern.css` 与 `tavern-core.js` 引用统一加 `?v=v2.2.0`（子页面为 `../css/...` / `../js/...`）
3. README.md：目录结构补 notes.json / fragments.json；封面页与档案页功能说明补手记、碎片集；维护说明补「发版 = 加 update_log + 改 ?v=，check 兜底」；数据文件表补新文件字段说明

**验证**：`npm run check` 0 ERROR。

---

## 步骤 8 · 整体验证

### 自动

- `npm run check` → 0 ERROR
- 故意制造三类错误（版本不一致 / notes 人名错字 / story 条数不符）→ 各自报 ERROR

### 浏览器手测清单

1. 封面与档案页同一天显示同一篇手记；改系统日期验证轮换；手记人名金色链接跳档案卡并定位
2. 往期弹窗完整列出，当日篇标记「今日」
3. 老存档进入：无 storyFragments 字段不报错，既有成就/进度不受影响
4. 抽碎片：普通 → 故事节奏正确；故事碎片金色弹窗 + 「✦ 故事碎片 n/6」；重复抽不出已收集 id
5. 碎片集弹窗：未收集「？？？」暗格；集齐 6 枚触发「拼合真相」隐藏成就弹窗 + 完整段落显示
6. notesRead / storyFragments 相关成就（听酒保说话、手记常客）正常解锁
7. 断网或 JSON 路径错误：手记占位、碎片兜底文案，页面无白屏
8. 碎片弹窗不带 special 时样式与改造前一致（回归）
9. 移动端宽度（≤600px）下手记卡、碎片集、徽标不溢出

### 收尾

- 用户润色 notes.json / story 六条文案（实现交付初稿）
- 更新 `data/update_log.json` 若润色后文案有变（同版本次内不需要 bump ?v=，仅在下次发版时）

---

## 明确不做（与 spec 一致）

- 小剧场、时段氛围、布告栏、留言簿、分享卡片、PWA
- 第二轮（自选调酒、骰子桌）与第三轮（存档导入导出、全站搜索、懒加载、OG）内容
