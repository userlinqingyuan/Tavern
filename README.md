# 🍺 16号螺旋酒馆 · Tavern

异世界酒馆主题的角色档案站：一座「推门入场」封面 + 一本可翻看的旅客档案册，外加酒单、吧台、成就墙、时间线、地图五个附属页。全部由原生 HTML / CSS / JavaScript 实现，无框架、无构建步骤。

> ⚠️ **打开方式**：请通过本地服务器访问（如 VS Code 的 Live Server），不要直接双击 HTML。
> `drinker/`、`menu/`、`achievements/`、`map/` 等页面通过 `fetch` 加载 `data/*.json`，浏览器会拦截 `file://` 下的本地 JSON 请求。

---

## 📁 目录结构

```
Tavern/
├── index.html          # 档案袋封面入口页
├── drinker/            # 旅客档案主页面（卡片列表）
│   └── index.html
├── menu/               # 酒单页（今日特供 + 品鉴）
│   └── index.html
├── bar/                # 吧台页（调酒台 + 骰子桌）
│   └── index.html
├── achievements/       # 成就墙（徽章收集）
│   └── index.html
├── timeline/           # 时间线记录页
│   └── index.html
├── map/                # 酒馆地图展示页（含旅客足迹）
│   ├── index.html
│   ├── map-v1.png      # 一楼地图
│   └── map-v2.png      # 二楼地图
├── css/
│   └── tavern.css      # 全站共享样式：颜色变量 / 滚动条 / 页脚链接 / 通用弹窗 / 碎片弹窗 / 吧台组件
├── js/
│   └── tavern-core.js  # 共享核心：埋点 / 到访统计 / 成就判定 / 转义与弹窗工具 / 缓存 JSON 加载
├── tools/
│   └── check-data.cjs  # 数据校验器（npm run check，ERROR 退出码 1）
├── package.json        # 仅提供 npm run check 脚本（无依赖、无构建）
├── data/
│   ├── people.json       # 全部旅客档案数据
│   ├── drinks.json       # 56 款酒单数据（15 款原创 + 41 款现实与幻想名酒）
│   ├── achievements.json # 成就定义（声明式条件）
│   ├── events.json       # 时间线事件（分类标签 + 关联人物）
│   ├── notes.json        # 酒保手记（每日一篇，人物关联）
│   ├── fragments.json    # 随机碎片 + 故事碎片（收集玩法）
│   ├── raw.json          # 吧台调酒数据（基酒 / 配料 / 风味短句 / 隐藏配方）
│   ├── dice.json         # 骰子桌数据（遇客事件 / 赌局台词）
│   └── update_log.json   # 版本更新日志
└── images/
    ├── bar.jpg         # 封面背景
    ├── bar2.jpg        # 档案页背景
    ├── character/      # 原始人物卡图片
    ├── ID/             # 证件照
    └── sil/            # 立绘（按「姓名 立绘.jpg」命名，当前仅泠钰）
```

---

## 🚪 页面说明

### 封面入口页（`index.html`）

- **推门入场**：PC 端先播 Canvas 螺旋星系开场动画，底部「跳 过」可随时进店；移动端（≤620px）、二次访问（`tavern_door_opened`）与系统「减少动效」偏好都直接进内景
- **内景氛围**：酒馆背景图 + 噪点 + 6 枚浮尘粒子；品牌区配随机欢迎语（10 条，淡入）
- **九宫格入口**：🍺 酒单 / 🍸 吧台 / 🏆 成就 / 📖 酒客档案（主入口）/ 🕰️ 时间线 / 🗺️ 地图
- **今日手记**：每日一篇酒保手记（年内第 N 天 % 手记数，与今日特供同款算法），来自 `data/notes.json`，手记中登记的人物名渲染成金色链接直达档案卡；「往期 ✎」弹窗翻看全部，当日篇标记「今日」
- **随机碎片**：左下角按钮弹出酒馆氛围语录（弹窗由 `tavern-core.js` 注入）；**每累计抽 3 次必得一枚✦故事碎片，按钮旁「✦ n/6」徽标点开碎片集，集齐 6 枚拼出关于「？？？」的隐藏故事**（金色弹窗，收集进度存 `tavern_state_v1`）
- **档案借阅记录**：显示来自档案页的借阅流水（最多展示最近 20 条，可清空）

### 旅客档案页（`drinker/index.html`）

- **今日手记横幅**：页眉下方细横幅展示与封面同一篇手记，人物名金色链接支持 `?name=` 本页深链；加载失败整条不渲染
- **今日特供**：页眉胶囊显示当天特供酒名，酒名取自 `data/drinks.json`，加载失败时用内置名单兜底
- **搜索与筛选**：按姓名/能力/关系搜索，按座位区筛选（A 区 / B 区 / 未登记）
- **人物卡片**：入场翻页动画；点击卡片翻转看语录，再点翻回（PC 与移动端一致）
- **角色语录**：优先取 `people.json` 的 `quote` 字段，未填时依次从 `detail / con / syn / intro` 提取
- **证件照/立绘轮播**：点击头像打开大图灯箱，左右滑动切换、可无限循环（支持 `gallery` 扩展服饰图）
- **翻页阅读**：📖 按钮进入电子书模式，卡片之间用 3D 书页翻转切换，支持点击边缘/滑动/方向键
- **BACKGROUND NOTE**：超长备注自动折叠，可展开或弹出独立阅读框
- **收藏**：☆ 星标收藏，收藏卡置顶并按收藏顺序排序（localStorage）
- **随机酒客**：🎲 随机选一张卡并滚动高亮
- **人物关系网**：右下角 🔗 打开，基于 `links` 字段的 Canvas 力导向图，支持拖节点、拖空白平移、滚轮缩放；**双向写回的 links 画实线，只有一方写回的画箭头（方向为写回方 → 被引用方）**；边上金字为 `relations` 关系类型；单击节点聚焦关系子图（再点中心节点或按 Esc 退出），双击节点（或聚焦工具条「查看档案」）跳转档案卡
- **相关记录**：每张卡底部列出该人物在时间线上的事件（最多 3 条，点击跳到时间线对应筛选），数据来自 `data/events.json`，无事件则不显示
- **档案借阅记录**：点击头像或「查看原始卡片」自动记录借阅流水
- **查看原始卡片**：卡片正反两面都有入口，点击在新标签打开原图
- **地图入口**：卡片座位栏有 🗺️ 图标时，可直接跳到地图页对应足迹
- **深链定位**：通过 `?name=姓名`（如地图页跳入）自动滚动并高亮对应卡片
- **版本更新日志**：页脚展示 `update_log.json` 最近 5 条

### 酒单页（`menu/index.html`）

- **今日特供酒卡**：按「年内第几天 % 酒单总数」每日固定一款，展示表情/酒名/类型/酒精度/长文故事
- **点一杯**：点击「🍺 点一杯今日特供」记录当天品鉴，按钮变为「今日已品鉴 ✓」（每天一次）
- **酒单全录**：56 款酒网格展示，标记「今日特供 / 🍸 已品鉴」，每款显示短简介与主题色
- **酒款放大窗**：点开任意一款（整张卡片是按钮，键盘 Enter / 空格同效）查看大号 emoji、酒名、类型 · 酒精度、徽章、`desc` 短简介与**完整 `story` 长文**；长文在弹窗内独立滚动（主题化滚动条 + 滚动链隔离），Esc / 点遮罩 / ✕ 均可关闭，关闭后焦点回到原卡片
- **放大窗内品鉴**：当前酒正好是今日特供时，弹窗内也有「点一杯」按钮，与页面顶部按钮状态同步（已品鉴则禁用）

### 吧台页（`bar/index.html`）

- **调酒台**：从 `data/raw.json` 渲染基酒（85 种）与配料（58 种）chips，三槽选择（基酒 + 配料两味，A/B 两味不可相同，同名拦截轻提示）；「调一杯」生成酒名（`基酒名 · 诗眼A+诗眼B`）与评语（基酒开场白随机 1 条 + 风味标签去重前 2 各随机 1 句），同组合可重复调、文案有变化
- **基酒滚动区**：基酒一行条目多，容器固定高度（桌面 132px / ≤600px 108px）并带主题化滚动条，行头显示「n 种」；两行配料暂不加滚动条
- **诗眼先藏后显**：选料时配料 chip 只显示 emoji 与名字，不剧透 `word`；调出这杯后，结果卡在酒名下多一行金色小字「诗眼 · A / B」（隐藏配方有专属酒名，不显示该行）
- **隐藏配方**：命中 `raw.json` 的 `hidden` 组合时结果卡变金色（`.special`），显示专属酒名与文案，并计入「秘方收录」成就
- **调酒日志**：标题行「📖 册 · 调酒日志（n）」点开弹窗，列表 = 日期 + 酒名 + ✦ 隐藏标记，最新在前、封顶 100 条，存于 `tavern_state_v1` 的 `mixLog`
- **掷骰遇客**：🎭 模式下掷 2d6（翻滚动画 600ms），按总点数（2~12 全覆盖）从 `data/dice.json` 取遇客事件；带 `person` 的事件在卡底渲染语录（quote 优先，否则 intro 截断 60 字）与档案跳转链接
- **骰子赌局**：⚔️ 模式下你与酒保各掷 2d6 比大小，胜负平台词取自 `dice.json` 的 `gamble` 池；连赢 3 把起改显 `streak3` 特别台词（连赢期间每次都显示，输一把归零）
- **降级**：raw.json / dice.json 加载失败时对应板块显示占位文案，互不影响、不白屏

### 成就墙（`achievements/index.html`）

- **总进度**：顶部显示「已解锁 n / N」与百分比进度条
- **分组展示**：按 `visit` 到访 / `archive` 档案 / `drink` 酒单 / `bar` 吧台 / `secret` 彩蛋分组，每组显示获得数
- **徽章状态**：已解锁显示解锁日期；未解锁显示进度条或进度文案；`hidden` 成就未解锁时只显示「？？？」
- **解锁弹窗**：由 `tavern-core.js` 统一提示，右下角弹出徽章，点击可跳到成就墙

### 时间线（`timeline/index.html`）

- 事件来自 `data/events.json`，按日期从旧到新渲染，含日期/标题/描述/分类标签
- **关联人物**：事件里的人名渲染成金色链接，点击跳到对应档案卡；不在花名册的人名显示为灰色不可点文本
- **人物筛选**：页头 chips 按人物过滤（已登记人物按档案编号排序），URL 同步 `?name=姓名`，可从档案卡「相关记录」或外部链接直达预选
- 加载失败显示空状态，不报错挡页

### 地图（`map/index.html`）

- **地图画廊**：两张地图（PNG）网格展示，点击放大灯箱查看，支持单图居中、加载失败提示
- **旅客足迹**：从 `people.json` 的 `map` 字段自动生成，一楼/二楼分别落点；悬停或点击显示姓名与位置说明
- **足迹条**：每张地图下方有横向足迹条，点击任意足迹跳到对应档案
- **深链定位**：通过 `?name=姓名` 打开对应楼层灯箱并高亮该足迹（与档案页双向跳转）

---

## 📦 数据与存储

### `data/people.json`

共 16 条：15 位旅客 + 1 张空白档案（`？？？`）。每人一个对象：

| 字段 | 说明 |
|------|------|
| `name` | 姓名 |
| `quote` | **专属语录**（卡片背面优先显示；留空则自动提取） |
| `file` | 原始人物卡文件名（`images/character/`） |
| `portrait` | 证件照文件名（`images/ID/`，可留空） |
| `age / height / weight / seat` | 基础档案 |
| `intro / weak / skill / related / value / syn / con` | 卡片各栏目文本 |
| `detail` | 背景长文（BACKGROUND NOTE） |
| `links` | 关系网边：相关人物名字数组（需与 `name` 完全一致） |
| `relations`（可选） | 关系类型标签：`[{ "name": "桃逸佑", "label": "医患" }]`，只给 `links` 中已有的边加标签；标签有方向（双方都填时画布显示「甲 / 乙」） |
| `gallery`（可选） | 服饰/场景图数组，自动并入头像轮播；字符串或 `{ src, label }` |
| `map`（可选） | 地图足迹：`{ "floor": 0/1（一楼/二楼）, "x": 35, "y": 45, "label": "常驻吧台左端" }`，坐标为地图图片内百分比；有此字段档案卡座位旁出现 🗺️ 入口，地图页自动生成足迹点，点击与档案页双向跳转（支持 `?name=` 直达高亮） |

### `data/oneway_links.json`

有意单向 `links` 的登记表（数组）。当 A 的 `links` 写了 B 而 B 没写回时，校验器默认告警；若这正是设定本意（如「一面之缘」「好奇」「对方没有社交」），在此登记即可免除告警：

```json
[{ "from": "陈南恕", "to": "芝葵", "reason": "一面之缘的中学生，明确单向" }]
```

- `from / to` 必填且必须是花名册精确姓名，`reason` 建议填写（便于日后维护判断）
- 校验器会反向核查声明本身：`from` 的 links 里没有 `to`（失效）、对方已写回（多余）、重复声明、指向不存在的人，都会被拦下
- 未登记的单向 links 仍会告警，关系网中一律画为箭头（方向 = 写回方 → 被引用方）

### `data/drinks.json`

`{ "drinks": [ ... ] }`，共 56 款（前 15 款为酒馆原创世界观，后 41 款整合自「现实与幻想名酒图鉴」），数组顺序即轮换顺序（需与档案页内置兜底名单 `FALLBACK_SPECIALS` 一致，校验器强制）。字段：`name / type / abv / emoji / color / desc（卡片短简介）/ story（当日酒卡长文，留空显示占位文案）`。扩充酒单时请同时：追加 JSON 条目 → 同步 `drinker/index.html` 的 `FALLBACK_SPECIALS` → 校验器会自动核对全尝成就目标。

### `data/raw.json`

吧台调酒数据（2026-09-12 由 `mixing.json` 改名而来），`{ bases, ingredients, tags, hidden }` 四段。`bases` 现有 **85 条** = 「基酒全典」81 条 + 酒馆原有 4 条（幽冥苦艾 / 晨露清酒 / 烬木威士忌 / 蜜月粉红金），顺序为文档顺序在前、原有条目在末尾：

| 字段 | 说明 |
|------|------|
| `bases` | 基酒数组：`id / name / emoji / type / abv / color / desc / openers`（开场白数组，「调一杯」评语的第一句从这里随机） |
| `ingredients` | 配料数组：`id / name / emoji / word（一字诗眼，拼进酒名）/ tags（风味标签，必须 ⊆ tags 键集）/ desc` |
| `tags` | 风味短句池：`{ "甜": [...], "烈": [...], "凉": [...], "苦": [...], "辛": [...], "香": [...] }`，每维若干条评语 |
| `hidden` | 隐藏配方数组：`id / base（基酒 id）/ ingredients（恰好 2 个配料 id）/ name / text`；组合（基酒+两味配料）整体不可重复（校验器强制） |

加配料 / 加基酒 / 加隐藏配方都只改这个文件；`word` 建议挑一个能当「诗眼」的字。

> 📌 **基酒模块默认只做扩充**：新增基酒一律追加到 `bases` 数组末尾（沿用或新起英文 `id`），不要删除或改写既有条目——2026-09-12 用户确认的长期约定。需要替换/删除时请另行说明。

### `data/dice.json`

骰子桌数据，`{ encounters, gamble }` 两段：

| 字段 | 说明 |
|------|------|
| `encounters` | 遇客事件数组：`sum（2~12 的整数，2d6 总点数，**11 个点数必须全覆盖**）/ icon / title / text / person（可选，须在花名册内，渲染语录与档案链接）` |
| `gamble` | 赌局台词池：`win / lose / tie` 为非空字符串数组（随机抽取）；`streak3` 为连赢 3 把起的特别台词（单条字符串，可省略） |

`person` 存在时，档案卡语录优先取 `quote` 字段，否则取 `intro` 前 60 字。

### `data/events.json`

`{ "events": [ ... ] }`，时间线单一数据源，也是档案卡「🕰️ 相关记录」的来源。新增事件按这个模板追加即可：

```json
{
  "date": "2026-09-01",
  "title": "事件标题",
  "desc": "事件描述。",
  "tags": ["旅客"],
  "people": ["举", "初璃"]
}
```

- `tags` 是不可点的分类词（酒馆/旅客/委托/档案等）；`people` 是人物名，必须与 `people.json` 的 `name` 完全一致，会渲染成档案跳转链接
- 群像/设施事件 `people` 留空数组；日期固定 `YYYY-MM-DD`，页面自动按日期排序

### `data/achievements.json`

成就定义数组，声明式条件，加成就只改这个文件：

| 字段 | 说明 |
|------|------|
| `id` | 唯一标识（解锁状态按它存储，不要改） |
| `icon / name / desc` | 徽章图标、名称、描述 |
| `group` | `visit` 到访 / `archive` 档案 / `drink` 酒单 / `bar` 吧台 / `secret` 彩蛋 |
| `hidden` | 可选；`true` 时未解锁显示「？？？」 |
| `metric` | 判定指标：`visitDays / visitStreak / lateNightVisit / newYearVisit / peopleViewed / cardFlips / networkOpens / bookReads / diceUses / fragmentsDrawn / favoritesAdded / menuViews / tastingCount / tastingStreak / drinksTasted / borrows / sawBlankCard / notesRead / storyFragments / mixes / hiddenRecipes / diceRolls / encounters / gambleWins / gambleStreak` |
| `op / value` | `">=" 数字` 或 `"==" true/false` |

### `data/notes.json`

酒保手记数组，封面「今日手记」与档案页横幅的单一数据源，**数组顺序即「往期」展示顺序**。每条：

| 字段 | 说明 |
|------|------|
| `text` | 手记正文（1-3 句，酒保第一人称口吻） |
| `person` | 人物名数组（可空数组）；仅登记的名字会渲染成档案跳转链接，名字须与 `people.json` 一致 |

每日展示哪篇由「年内第 N 天 % 手记数」决定（与今日特供同款算法）；手记不足时显示占位文案，页面不报错。

### `data/fragments.json`

`{ "fragments": [...], "story": [...] }`：

- `fragments`：普通氛围碎片 `[{ text, source }]`，封面与档案页的随机抽取池
- `story`：✦ 故事碎片 `[{ id, text }]`，**数组顺序即拼合顺序**；每累计抽 3 次普通碎片必出下一枚未收集的，集齐后在封面碎片集弹窗拼出完整段落；条数必须与 `achievements.json` 中 `story-complete` 的 `value` 一致（校验器强制）

### `data/update_log.json`

版本日志数组，`renderChangelog` 读取，展示最近 5 条。**顶部的 `version` 同时是全站静态资源 `?v=` 参数的唯一来源**。

### localStorage

| 键 | 用途 |
|----|------|
| `tavern_favorites` | 收藏的人物名列表 |
| `tavern_borrow_log` | 借阅流水（200 条上限，最新在前） |
| `tavern_state_v1` | 成就系统状态：到访/品酒日期、埋点计数、已查看人物、已解锁成就、`storyFragments`（已收集故事碎片 id）、`mixLog`（调酒日志，封顶 100 条）、`hiddenRecipes`（已调出的隐藏配方 id）、`gambleStreak`（赌局连赢数）、`drinkTotal`（最近一次品鉴时的酒单总数） |

---

## 🔧 共享模块

- **`css/tavern.css`**：颜色变量（`--ink / --muted / --gold / --line / --panel`）、基础重置、全局滚动条、页脚链接、通用弹窗（`.tavern-modal-overlay / .tavern-modal / .tavern-modal-body`，自带主题化滚动条皮肤与滚动链隔离）、随机碎片弹窗样式、吧台组件（选料 chips / 结果卡 / 骰子 / 模式胶囊 / 调酒日志列表）。页面自己的 `<style>` 在其后加载，可覆盖变量。
- **`js/tavern-core.js`**：所有页面共用的核心脚本。用法：

  ```html
  <script src="../js/tavern-core.js?v=v2.4.0"></script>
  <script>
    Tavern.init('..');            // 根目录页传 ''，子页面传 '..'
    Tavern.track('cardflip');     // 埋点，驱动成就判定
  </script>
  ```

  提供：`init(root)` / `track(event, data)` / `loadJSON(path)`（同页去重缓存，自动追加 `?v=`）/ `escapeHtml(text)`（不依赖 DOM，页面与 Node 单测共用）/ `openModal(overlay)` / `closeModal(overlay)`（统一 Esc、点遮罩、✕、背景滚动锁与焦点归还）/ `openFragment(fragment)`（支持 `special: true` 金色故事碎片样式）/ `closeFragment()` / `getMetrics()` / `getAchievements()` / `getStoryFragments()` / `getMixLog()` / `getHiddenRecipes()` / `pushMixLog(entry)`（调酒入册：最新在前、封顶 100）/ `todaysDrinkIndex(len)` / `hasTastedToday()` / `tastedDrinkIndices(len)`；`Tavern.v` 为从 `<script>` 标签解析出的站点版本号。

---

## ✏️ 日常维护

- **加新人物**：`people.json` 加一条 → `images/character/` 放原卡 → （可选）在 `drinker/index.html` 的 `ARCHIVE_NUMBERS` 补编号
- **写语录**：填对应人物的 `"quote"` 字段即可
- **加立绘**：图片放 `images/sil/`，命名为「姓名 立绘.jpg」（png/jpeg/webp 均可），点击该人物头像即可轮播查看
- **加服饰/场景图**：在人物 `gallery` 数组里加图片路径（相对 `drinker/`），自动进入头像轮播
- **加关系**：在人物 `links` 数组里写精确名字；想让关系网边显示类型小字，再加 `relations: [{ "name": "精确名字", "label": "关系" }]`（标签有方向）；`related` 仅作卡面原文展示，其中的人名请写正名（冷钰/拉提菩/桃子 等别称会被校验拦截）。单向认识（对方档案没登记你）会有告警，属设定本意就去 `data/oneway_links.json` 登记
- **加地图足迹**：给人物加 `map` 字段（`floor / x / y / label`），档案卡出现 🗺️ 入口，地图页自动生成足迹点
- **加时间线事件**：改 `data/events.json`（模板见上文），`people` 写精确人名后时间线和档案卡「相关记录」会自动联动
- **换/加地图**：`map/` 放图片，改 `map/index.html` 的 `maps` 数组
- **补酒文案**：改 `data/drinks.json`，填 `desc`（卡片短简介）和 `story`（当日酒卡长文）即可，留空会显示占位文案
- **加配料/基酒/隐藏配方**：改 `data/raw.json`（字段表见上）；配料 `tags` 必须取自 `tags` 键集，隐藏配方组合不可重复。**基酒只扩充不删改**——新基酒追加到 `bases` 末尾（`id` 起英文 slug），既有条目原样保留
- **加遇客事件/赌局台词**：改 `data/dice.json`；`encounters` 必须覆盖 2~12 全部点数，`person` 写花名册精确姓名
- **加/改成就**：往 `data/achievements.json` 加一条，指定 `metric / op / value`（指标清单见上）；不用动任何代码
- **重置成就**：浏览器清掉 localStorage 的 `tavern_state_v1` 即可
- **记版本**：往 `data/update_log.json` 顶部插一条 `{ date, version, entries }`，**并把 7 个页面里 `tavern.css` / `tavern-core.js` 引用的 `?v=` 改成同一个新版本号**（漏改会被校验器拦下；根治浏览器缓存旧代码）
- **新增弹窗**：复用 `.tavern-modal-overlay` + `.tavern-modal`（标题行 `.tavern-modal-title`、滚动区 `.tavern-modal-body`），开关一律走 `Tavern.openModal/closeModal`——Esc、点遮罩、✕、背景滚动锁、关闭后焦点归还都自动生效，不要再手写事件绑定
- **借阅记录**：由档案页点击自动写入，无需手动维护
- **改完数据跑校验**：`npm run check`（或 `node tools/check-data.cjs`），有 ERROR 会以退出码 1 失败，可直接接 CI

### 数据校验器（`tools/check-data.cjs`）

- **ERROR（必须修）**：JSON 解析失败、必填字段缺失、重名、`links/relations/events.people` 引用不存在的人或别称错字（冷钰/拉提菩/桃子）、relations 指向 links 之外、座位号不符 `A-3`/`B-10`/`未登记`、引用图片不存在、`map.floor/x/y` 非法、事件日期/必填字段问题、drinks 数量或顺序与档案页 `FALLBACK_SPECIALS` 不一致、成就 metric 不在 core 的指标表内或 op/value 非法、`notes.json` 的 `person` 引用不存在的人、`fragments.json` 的 story id 重复或条数与 `story-complete.value` 不一致、`raw.json` 的字段缺失/标签越界/隐藏配方组合重复、`dice.json` 的遇客点数缺漏重复或 `person` 不在花名册、各页面 `?v=` 缺失/不一致/与 update_log 最新版本不符
- **WARNING（提醒，可能是有意的）**：未登记的单向 `links`（对方没写回；关系网中会画成箭头，若为有意在 `data/oneway_links.json` 登记）、同日多条事件
- 新增 core 指标时，同步把名字加进校验器的 `KNOWN_METRICS` 列表

---

## 🛠️ 技术要点

- 纯原生 HTML/CSS/JS，无依赖、无构建
- 页面间共享 `css/tavern.css` 与 `js/tavern-core.js`，数据统一放 `data/*.json`
- 人物关系网用 Canvas + 简易力导向布局；卡片翻转、火焰、粒子、书页翻转为 CSS 动画/3D 变换
- 成就由「声明式条件 + 状态推导指标」驱动，加成就只改 JSON
- 页面间数据共享靠 localStorage（同源）；`Tavern.loadJSON` 对同一次访问内的相同请求做缓存
- 已适配移动端：卡片翻转、关系网触摸拖动、地图足迹条、响应式布局
