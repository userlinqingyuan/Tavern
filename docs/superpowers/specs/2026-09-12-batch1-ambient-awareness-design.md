# 批次1：环境感知层设计文档

> 日期：2026-09-12  
> 状态：已确认  
> 范围：时间段联动、季节配色联动、月相联动、首次/回访欢迎语、季节限定内容框架

## 1. 目标

让酒馆页面根据真实时间、季节、月相动态变化，使每次打开都有不同的氛围感。本批次是后续微交互层和玩法层的基础。

## 2. 架构概览

```
data/ambient.json  (环境配置数据)
       │
       ▼
tavern-core.js :: Tavern.Ambient  (核心模块)
       │
       ├── applySeason()    → CSS 变量切换
       ├── applyTimeSlot()  → body 亮度 + bg-tint
       ├── getMoonPhase()   → 月相计算
       ├── isFullMoon()     → 满月事件触发
       └── getGreeting()    → 欢迎语
       │
       ▼
各页面 (无需修改，自动生效)
```

**设计原则**：
- 所有配置数据驱动，不硬编码
- 不破坏现有 `Tavern.init()` 流程，在末尾追加调用
- 季节通过 CSS 变量改变全站观感，时段只调亮度不换色
- 月相不影响 CSS，只触发事件/成就

## 3. 数据结构

### 3.1 `data/ambient.json`

```json
{
  "seasons": {
    "spring": {
      "months": [3, 4, 5],
      "vars": {
        "--gold": "#8cb846",
        "--ink": "#d8e8b8",
        "--panel": "#1e2a1a",
        "--bg-gradient": "radial-gradient(ellipse at 50% 40%, #1e2a1a, #101808)"
      },
      "label": "春",
      "subtitle": "万物复苏"
    },
    "summer": {
      "months": [6, 7, 8],
      "vars": {
        "--gold": "#e6b450",
        "--ink": "#f5e6c8",
        "--panel": "#1a1408",
        "--bg-gradient": "radial-gradient(ellipse at 50% 40%, #2a2010, #1a1408)"
      },
      "label": "夏",
      "subtitle": "烈日透窗"
    },
    "autumn": {
      "months": [9, 10, 11],
      "vars": {
        "--gold": "#d6a85d",
        "--ink": "#eadcc0",
        "--panel": "#1a1513",
        "--bg-gradient": "radial-gradient(ellipse at 50% 40%, #2a1810, #18100a)"
      },
      "label": "秋",
      "subtitle": "落叶纷飞"
    },
    "winter": {
      "months": [12, 1, 2],
      "vars": {
        "--gold": "#a0c0e8",
        "--ink": "#e0e8f5",
        "--panel": "#141820",
        "--bg-gradient": "radial-gradient(ellipse at 50% 40%, #141820, #080a10)"
      },
      "label": "冬",
      "subtitle": "寒风呼啸"
    }
  },
  "timeSlots": {
    "dawn":  { "hours": [5,6,7,8,9], "brightness": 1.15, "bgTint": "rgba(255,200,100,0.03)", "label": "晨" },
    "noon":  { "hours": [10,11,12,13,14,15,16], "brightness": 1.0, "bgTint": "transparent", "label": "午" },
    "dusk":  { "hours": [17,18,19,20,21], "brightness": 0.80, "bgTint": "rgba(180,60,20,0.04)", "label": "暮" },
    "night": { "hours": [22,23,0,1,2,3,4], "brightness": 0.55, "bgTint": "rgba(0,0,0,0.08)", "label": "夜" }
  },
  "moonPhases": [
    { "name": "新月",   "emoji": "🌑", "threshold": 0.000 },
    { "name": "蛾眉月", "emoji": "🌒", "threshold": 0.125 },
    { "name": "上弦月", "emoji": "🌓", "threshold": 0.250 },
    { "name": "盈凸月", "emoji": "🌔", "threshold": 0.375 },
    { "name": "满月",   "emoji": "🌕", "threshold": 0.500 },
    { "name": "亏凸月", "emoji": "🌖", "threshold": 0.625 },
    { "name": "下弦月", "emoji": "🌗", "threshold": 0.750 },
    { "name": "残月",   "emoji": "🌘", "threshold": 0.875 }
  ],
  "moonEvents": [
    "满月悬于中庭，银光泻地。酒保说今夜有客从远方来。",
    "圆月当空，酒馆的水晶杯格外透亮。",
    "满月夜，后院的老橡树在月光下像一座黑塔。",
    "月华如水，冲淡了杯中余酒。"
  ],
  "greetings": {
    "firstVisit": "欢迎，新旅人。16号螺旋酒馆今夜开张。",
    "returnSameSeason": "欢迎回来。{seasonSub}，门始终为你留着。",
    "returnNewSeason": "好久不见。{oldSeason}别来无恙？如今已是{newSeason}。"
  },
  "seasonSubs": {
    "spring": "万物复苏",
    "summer": "烈日透窗",
    "autumn": "落叶纷飞",
    "winter": "寒风呼啸"
  }
}
```

### 3.2 季节限定内容标记

**`data/drinks.json`** — 新增可选字段 `season`：
```json
{ "name": "惊蛰", "season": "spring", "desc": "雷动百虫，初雷乍响。" }
```
- 非对应季节时不进入轮换池

**`data/achievements.json`** — 新增可选字段 `season`：
```json
{ "id": "spring_first_bloom", "season": "spring", "metric": "visits", "op": ">=", "value": 1, "name": "春日初见", "desc": "在春季首次造访酒馆" }
```
- 不在当前季节时跳过解锁检查

**`data/events.json`** — 新增可选字段 `season`（校验器检查）：
```json
{ "date": "0204", "season": "spring", "title": "立春夜话", "desc": "今日立春，酒保备了迎春酒。" }
```

### 3.3 localStorage 新增字段

在现有 `tavern_state_v1` 中追加（不破坏旧数据）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `lastSeason` | string | 上次访问时的季节（spring/summer/autumn/winter） |
| `fullMoonVisited` | string | 上次满月访问日期（YYYY-MM-DD），防止重复触发 |
| `greetingShown` | boolean | 欢迎语是否已展示，防止刷新重复 |

## 4. 模块设计

### 4.1 `Tavern.Ambient` 模块

```
Tavern.Ambient = {
  // 状态
  season: null        // 'spring' | 'summer' | 'autumn' | 'winter'
  timeSlot: null      // 'dawn' | 'noon' | 'dusk' | 'night'
  moonPhase: null     // { name, emoji, illumination }
  isFirstVisit: false
  config: null        // data/ambient.json

  // 方法
  init()              // 加载配置 → 计算 → 应用
  calcSeason(now)     // 根据月份返回季节 key
  calcTimeSlot(hour)  // 根据小时返回时段 key
  applySeason(s)      // 遍历 vars，setProperty 到 :root
  applyTimeSlot(t)    // body filter brightness + --bg-tint
  getMoonPhase(date)  // 农历月相计算（离线算法）
  isFullMoon()        // illumination >= 0.5 且农历十五±1天
  triggerFullMoonEvent() // 首页满月事件 + track('fullMoonVisit')
  getGreeting()       // 返回欢迎语字符串
  startInterval()     // 每 60s 检查时段切换
}
```

**调用时机**：`Tavern.init()` 末尾追加 `Ambient.init()`。

### 4.2 月相算法

使用 2000-2100 年已知朔日表（约 1300 个月的朔日数据），压缩为 JSON 数组硬编码在 JS 中：

```
朔日表 = [月数序列，每项为相对 2000-01-01 的天数]
→ 找到最近朔日 → (今天 - 朔日) / 29.53 = illumination
→ 匹配 moonPhases 数组的 threshold
```

纯离线计算，不依赖外部 API。

### 4.3 时段动态氛围

| 时段 | 亮度 | bg-tint | 额外效果 |
|------|------|---------|----------|
| 晨 5-10 | 1.15 | rgba(255,200,100,0.03) | 暖黄叠加 |
| 午 10-17 | 1.0 | transparent | 基准状态 |
| 暮 17-22 | 0.80 | rgba(180,60,20,0.04) | 橙红叠加 |
| 夜 22-5 | 0.55 | rgba(0,0,0,0.08) | body 添加 .time-night class，壁炉区域 CSS box-shadow 脉动 |

**时段切换**：每 60 秒检查一次，切换时有 0.8s CSS transition 过渡。

### 4.4 满月特别事件

- `isFullMoon()` 返回 true 时：
  - `Tavern.track('fullMoonVisit', 1)` 触发隐藏成就"月圆人团圆"（全站生效）
  - localStorage 记录 `fullMoonVisited` 防止同一天重复触发
  - 首页"今日手记"追加一条满月事件（从 `moonEvents` 随机取）—仅限 `index.html`，其他页面只触发成就不展示事件

### 4.5 首次/回访欢迎语

- 首页 `index.html` 新增 `<div id="greeting">` 容器
- `Ambient.init()` 后填充内容
- 首次访问：淡入动画（opacity 0→1, 0.8s）
- 回访：无动画直接显示
- 三种文案：
  - 首次：`"欢迎，新旅人。16号螺旋酒馆今夜开张。"`
  - 回访同季：`"欢迎回来。{季节副标题}，门始终为你留着。"`
  - 回访换季：`"好久不见。{旧季节}别来无恙？如今已是{新季节}。"`

## 5. 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `data/ambient.json` | 新建 | 环境配置数据 |
| `js/tavern-core.js` | 修改 | 新增 Ambient 模块，init() 末尾追加调用 |
| `css/tavern.css` | 修改 | 新增 `.time-night` 样式、body transition、--bg-tint 变量 |
| `index.html` | 修改 | 新增 `<div id="greeting">`，引用 ambient 配置 |
| `data/drinks.json` | 修改 | 部分酒新增 `season` 字段 |
| `data/achievements.json` | 修改 | 新增季节限定 + 满月成就 |
| `data/events.json` | 修改 | 节气事件新增 `season` 字段 |
| `tools/check-data.cjs` | 修改 | 新增 ambient.json 校验规则、drinks/achievements/events 的 season 字段校验 |
| `data/update_log.json` | 修改 | 版本记录 |
| 全站 HTML | 修改 | ?v= 版本号升级 |

## 6. 校验器新增规则

1. `data/ambient.json` 必须存在且为合法 JSON
2. `seasons` 必须包含 spring/summer/autumn/winter 四个 key
3. 每个 season 的 `months` 数组必须包含 3 个月且不重叠
4. 每个 season 的 `vars` 必须包含 `--gold`, `--ink`, `--panel`, `--bg-gradient`
5. `timeSlots` 必须包含 dawn/noon/dusk/night 四个 key
6. 所有时段的 `hours` 数组必须覆盖 0-23 且不重叠
7. `moonPhases` 必须有 8 项，threshold 递增
8. `drinks.json` 中的 `season` 字段（如存在）必须是 spring/summer/autumn/winter
9. `achievements.json` 中的 `season` 字段同上
10. `events.json` 中的 `season` 字段同上

## 7. 边界与降级

- 如果 `ambient.json` 加载失败：回退到 autumn 配色（当前默认），不报错
- 如果月相计算出错：默认 `illumination = 0`，不触发满月事件
- 如果 localStorage 中无 `lastSeason`：视为首次访问
- `prefers-reduced-motion: reduce`：跳过 brightness 调整和过渡动画，只保留季节配色
- 移动端：跳过 brightness 调整（移动设备屏幕亮度已自适应），保留季节配色

## 8. 不在本批次范围

以下功能属于批次2和批次3：

- 鼠标速度→烛火摇曳
- 鼠标空闲→酒馆打盹
- 滚动深度→光线变化
- 滚动速度→灰尘飞扬
- devicePixelRatio 分级
- 手机倾斜→档案袋晃动
- 视觉质感提升（背景效果/页面过渡/光影层次）
- 隐藏彩蛋系统
- 天气API联动
- 季节限定酒单/事件/成就的具体内容填充（本批次只搭框架和少量示例）
