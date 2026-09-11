# 🍺 16号螺旋酒馆 · Tavern

异世界酒馆主题的角色档案站：一座「档案袋」封面入口 + 一本可翻看的旅客档案册，外加酒单、成就墙、时间线、地图四个附属页。全部由原生 HTML / CSS / JavaScript 实现，无框架、无构建步骤。

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
├── achievements/       # 成就墙（徽章收集）
│   └── index.html
├── timeline/           # 时间线记录页
│   └── index.html
├── map/                # 酒馆地图展示页（含旅客足迹）
│   ├── index.html
│   ├── map-v1.png      # 一楼地图
│   └── map-v2.png      # 二楼地图
├── css/
│   └── tavern.css      # 全站共享样式：颜色变量 / 滚动条 / 页脚链接 / 碎片弹窗
├── js/
│   └── tavern-core.js  # 共享核心：埋点 / 到访统计 / 成就判定 / 弹窗组件 / 缓存 JSON 加载
├── data/
│   ├── people.json       # 全部旅客档案数据
│   ├── drinks.json       # 15 款酒单数据
│   ├── achievements.json # 成就定义（声明式条件）
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

- **档案袋**：可点击展开/收起，鼠标在袋面移动有暖色追光，悬停掀起
- **随机欢迎语**：10 条氛围文案随机显示，淡入动画
- **氛围装饰**：右下角壁炉火焰动画、飘浮光点粒子、照片背景 + 噪点
- **随机碎片**：左下角按钮弹出酒馆氛围语录（弹窗由 `tavern-core.js` 注入）
- **档案借阅记录**：显示来自档案页的借阅流水（最多展示最近 20 条，可清空）
- **底部固定栏**：资料来源 + 🍺 酒单 + 🏆 成就 + 🕰️ 时间线 + 🗺️ 酒馆地图入口

### 旅客档案页（`drinker/index.html`）

- **今日特供**：页眉胶囊显示当天特供酒名，酒名取自 `data/drinks.json`，加载失败时用内置名单兜底
- **搜索与筛选**：按姓名/能力/关系搜索，按座位区筛选（A 区 / B 区 / 未登记）
- **人物卡片**：入场翻页动画；点击卡片翻转看语录，再点翻回（PC 与移动端一致）
- **角色语录**：优先取 `people.json` 的 `quote` 字段，未填时依次从 `detail / con / syn / intro` 提取
- **证件照/立绘轮播**：点击头像打开大图灯箱，左右滑动切换、可无限循环（支持 `gallery` 扩展服饰图）
- **翻页阅读**：📖 按钮进入电子书模式，卡片之间用 3D 书页翻转切换，支持点击边缘/滑动/方向键
- **BACKGROUND NOTE**：超长备注自动折叠，可展开或弹出独立阅读框
- **收藏**：☆ 星标收藏，收藏卡置顶并按收藏顺序排序（localStorage）
- **随机酒客**：🎲 随机选一张卡并滚动高亮
- **人物关系网**：右下角 🔗 打开，基于 `links` 字段的 Canvas 力导向图，支持拖节点、拖空白平移、滚轮缩放、点击节点跳转档案
- **档案借阅记录**：点击头像或「查看原始卡片」自动记录借阅流水
- **查看原始卡片**：卡片正反两面都有入口，点击在新标签打开原图
- **地图入口**：卡片座位栏有 🗺️ 图标时，可直接跳到地图页对应足迹
- **深链定位**：通过 `?name=姓名`（如地图页跳入）自动滚动并高亮对应卡片
- **版本更新日志**：页脚展示 `update_log.json` 最近 5 条

### 酒单页（`menu/index.html`）

- **今日特供酒卡**：按「年内第几天 % 15」每日固定一款，展示表情/酒名/类型/酒精度/长文故事
- **点一杯**：点击「🍺 点一杯今日特供」记录当天品鉴，按钮变为「今日已品鉴 ✓」（每天一次）
- **酒单全录**：15 款酒网格展示，标记「今日特供 / 🍸 已品鉴」，每款显示短简介与主题色

### 成就墙（`achievements/index.html`）

- **总进度**：顶部显示「已解锁 n / N」与百分比进度条
- **分组展示**：按 `visit` 到访 / `archive` 档案 / `drink` 酒单 / `secret` 彩蛋分组，每组显示获得数
- **徽章状态**：已解锁显示解锁日期；未解锁显示进度条或进度文案；`hidden` 成就未解锁时只显示「？？？」
- **解锁弹窗**：由 `tavern-core.js` 统一提示，右下角弹出徽章，点击可跳到成就墙

### 时间线（`timeline/index.html`）

手动维护 `events` 数组，按日期从旧到新渲染，含日期/标题/描述/标签，支持空状态。

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
| `gallery`（可选） | 服饰/场景图数组，自动并入头像轮播；字符串或 `{ src, label }` |
| `map`（可选） | 地图足迹：`{ "floor": 0/1（一楼/二楼）, "x": 35, "y": 45, "label": "常驻吧台左端" }`，坐标为地图图片内百分比；有此字段档案卡座位旁出现 🗺️ 入口，地图页自动生成足迹点，点击与档案页双向跳转（支持 `?name=` 直达高亮） |

### `data/drinks.json`

`{ "drinks": [ ... ] }`，共 15 款，数组顺序即轮换顺序（需与档案页内置兜底名单一致）。字段：`name / type / abv / emoji / color / desc（卡片短简介）/ story（当日酒卡长文，留空显示占位文案）`。15 款文案已全部补齐，可随时改写。

### `data/achievements.json`

成就定义数组，声明式条件，加成就只改这个文件：

| 字段 | 说明 |
|------|------|
| `id` | 唯一标识（解锁状态按它存储，不要改） |
| `icon / name / desc` | 徽章图标、名称、描述 |
| `group` | `visit` 到访 / `archive` 档案 / `drink` 酒单 / `secret` 彩蛋 |
| `hidden` | 可选；`true` 时未解锁显示「？？？」 |
| `metric` | 判定指标：`visitDays / visitStreak / lateNightVisit / newYearVisit / peopleViewed / cardFlips / networkOpens / bookReads / diceUses / fragmentsDrawn / favoritesAdded / menuViews / tastingCount / tastingStreak / drinksTasted / borrows / sawBlankCard` |
| `op / value` | `">=" 数字` 或 `"==" true/false` |

### `data/update_log.json`

版本日志数组，`renderChangelog` 读取，展示最近 5 条。

### localStorage

| 键 | 用途 |
|----|------|
| `tavern_favorites` | 收藏的人物名列表 |
| `tavern_borrow_log` | 借阅流水（200 条上限，最新在前） |
| `tavern_state_v1` | 成就系统状态：到访/品酒日期、埋点计数、已查看人物、已解锁成就 |

---

## 🔧 共享模块

- **`css/tavern.css`**：颜色变量（`--ink / --muted / --gold / --line / --panel`）、基础重置、全局滚动条、页脚链接、随机碎片弹窗样式。页面自己的 `<style>` 在其后加载，可覆盖变量。
- **`js/tavern-core.js`**：所有页面共用的核心脚本。用法：

  ```html
  <script src="../js/tavern-core.js"></script>
  <script>
    Tavern.init('..');            // 根目录页传 ''，子页面传 '..'
    Tavern.track('cardflip');     // 埋点，驱动成就判定
  </script>
  ```

  提供：`init(root)` / `track(event, data)` / `loadJSON(path)`（同页去重缓存）/ `openFragment(fragment)` / `closeFragment()` / `getMetrics()` / `getAchievements()` / `todaysDrinkIndex(len)` / `hasTastedToday()` / `tastedDrinkIndices(len)`。

---

## ✏️ 日常维护

- **加新人物**：`people.json` 加一条 → `images/character/` 放原卡 → （可选）在 `drinker/index.html` 的 `ARCHIVE_NUMBERS` 补编号
- **写语录**：填对应人物的 `"quote"` 字段即可
- **加立绘**：图片放 `images/sil/`，命名为「姓名 立绘.jpg」（png/jpeg/webp 均可），点击该人物头像即可轮播查看
- **加服饰/场景图**：在人物 `gallery` 数组里加图片路径（相对 `drinker/`），自动进入头像轮播
- **加关系**：在人物 `links` 数组里写精确名字；因为 related 的识别正确率有点难看，所以现在用 links，related 留着或者删了都行
- **加地图足迹**：给人物加 `map` 字段（`floor / x / y / label`），档案卡出现 🗺️ 入口，地图页自动生成足迹点
- **加时间线事件**：`timeline/index.html` 的 `events` 数组按格式追加
- **换/加地图**：`map/` 放图片，改 `map/index.html` 的 `maps` 数组
- **补酒文案**：改 `data/drinks.json`，填 `desc`（卡片短简介）和 `story`（当日酒卡长文）即可，留空会显示占位文案
- **加/改成就**：往 `data/achievements.json` 加一条，指定 `metric / op / value`（指标清单见上）；不用动任何代码
- **重置成就**：浏览器清掉 localStorage 的 `tavern_state_v1` 即可
- **记版本**：往 `data/update_log.json` 顶部插一条 `{ date, version, entries }`
- **借阅记录**：由档案页点击自动写入，无需手动维护

---

## 🛠️ 技术要点

- 纯原生 HTML/CSS/JS，无依赖、无构建
- 页面间共享 `css/tavern.css` 与 `js/tavern-core.js`，数据统一放 `data/*.json`
- 人物关系网用 Canvas + 简易力导向布局；卡片翻转、火焰、粒子、书页翻转为 CSS 动画/3D 变换
- 成就由「声明式条件 + 状态推导指标」驱动，加成就只改 JSON
- 页面间数据共享靠 localStorage（同源）；`Tavern.loadJSON` 对同一次访问内的相同请求做缓存
- 已适配移动端：卡片翻转、关系网触摸拖动、地图足迹条、响应式布局
