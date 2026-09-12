#!/usr/bin/env node
/* ============================================================
 * 16号螺旋酒馆 · 数据校验器
 * 用法: node tools/check-data.cjs   (或 npm run check)
 * ERROR 退出码 1；WARNING 不影响退出码
 * ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const errors = [];
const warnings = [];
const error = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

function readJSON(rel) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
  } catch (e) {
    error(`[${rel}] JSON 解析失败: ${e.message}`);
    return null;
  }
}
function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

/* ---------- people.json ---------- */
const people = readJSON('data/people.json');
const drinksDoc = readJSON('data/drinks.json');
const eventsDoc = readJSON('data/events.json');
const achievements = readJSON('data/achievements.json');
const mixingDoc = readJSON('data/mixing.json');
const diceDoc = readJSON('data/dice.json');
const onewayDoc = readJSON('data/oneway_links.json');

// 别称错字（与 drinker 页 NAME_ALIASES 保持同步；正名后这些写法一律视为错误）
const ALIASES = [['冷钰', '泠钰'], ['拉提菩', '菈提菩'], ['桃子', '桃逸佑']];
const KNOWN_METRICS = new Set([
  'visitDays', 'visitStreak', 'lateNightVisit', 'newYearVisit',
  'peopleViewed', 'cardFlips', 'networkOpens', 'bookReads', 'diceUses',
  'fragmentsDrawn', 'favoritesAdded', 'menuViews', 'tastingCount',
  'tastingStreak', 'drinksTasted', 'borrows', 'sawBlankCard',
  'notesRead', 'storyFragments',
  'mixes', 'hiddenRecipes', 'diceRolls', 'encounters', 'gambleWins', 'gambleStreak'
]);

let roster = new Set();
if (Array.isArray(people)) {
  roster = new Set(people.map(p => p.name));

  // 重名
  const seen = new Set();
  people.forEach(p => {
    if (seen.has(p.name)) error(`[people] 重名: 「${p.name}」出现多次`);
    seen.add(p.name);
  });

  people.forEach(p => {
    const tag = `[people:${p.name}]`;

    // 必填字段
    ['name', 'file', 'seat'].forEach(k => {
      if (p[k] === undefined || p[k] === null || String(p[k]).trim() === '') {
        error(`${tag} 缺少必填字段 ${k}`);
      }
    });

    // 别称错字：结构化字段 ERROR，related 展示文本同样 ERROR（正名后不应再现）
    const scanText = (text, field) => ALIASES.forEach(([bad, good]) => {
      if (typeof text === 'string' && text.includes(bad)) {
        error(`${tag} ${field} 含别称错字「${bad}」，应为「${good}」`);
      }
    });
    scanText(p.related, 'related');
    (p.links || []).forEach(n => scanText(n, 'links'));
    (p.relations || []).forEach(r => scanText(r && r.name, 'relations.name'));

    // 座位: A-1 / B-10 / 未登记
    if (p.seat !== undefined && !/^[AB]-\d+$/.test(p.seat) && p.seat !== '未登记') {
      error(`${tag} 座位格式非法: 「${p.seat}」（应为 A-3 式或「未登记」）`);
    }

    // 图片存在性
    if (p.file && !exists(path.join('images/character', p.file))) {
      error(`${tag} 原始卡图片不存在: images/character/${p.file}`);
    }
    if (p.portrait && !exists(path.join('images/ID', p.portrait))) {
      error(`${tag} 证件照不存在: images/ID/${p.portrait}`);
    }
    (Array.isArray(p.gallery) ? p.gallery : []).forEach(item => {
      const src = typeof item === 'string' ? item : (item && item.src);
      // 只校验站内相对路径，外链/数据 URI 跳过
      if (src && !/^(https?:|data:|\/)/.test(src) && !exists(src)) {
        error(`${tag} gallery 图片不存在: ${src}`);
      }
    });

    // map 足迹
    if (p.map !== undefined) {
      const m = p.map;
      if (![0, 1].includes(m.floor)) error(`${tag} map.floor 必须是 0 或 1，实际 ${m.floor}`);
      ['x', 'y'].forEach(axis => {
        if (typeof m[axis] !== 'number' || m[axis] < 0 || m[axis] > 100) {
          error(`${tag} map.${axis} 必须是 0~100 的数字，实际 ${m[axis]}`);
        }
      });
      if (m.label !== undefined && typeof m.label !== 'string') {
        error(`${tag} map.label 必须是字符串`);
      }
    }

    // links
    const links = Array.isArray(p.links) ? p.links : [];
    const linkSet = new Set();
    links.forEach(target => {
      if (target === p.name) error(`${tag} links 不能指向自己`);
      if (!roster.has(target)) error(`${tag} links 引用了不存在的人物「${target}」`);
      if (linkSet.has(target)) error(`${tag} links 重复: 「${target}」`);
      linkSet.add(target);
    });

    // relations
    const relNames = new Set();
    (Array.isArray(p.relations) ? p.relations : []).forEach(rel => {
      if (!rel || typeof rel.name !== 'string' || typeof rel.label !== 'string' || !rel.label.trim()) {
        error(`${tag} relations 项必须是 {name, label} 且 label 非空: ${JSON.stringify(rel)}`);
        return;
      }
      if (!linkSet.has(rel.name)) {
        error(`${tag} relations「${rel.name}」不在 links 中（标签无法上画布）`);
      }
      if (relNames.has(rel.name)) error(`${tag} relations 重复: 「${rel.name}」`);
      relNames.add(rel.name);
    });
  });

  // 有意单向登记（data/oneway_links.json）
  const onewayDeclared = new Set();
  if (Array.isArray(onewayDoc)) {
    const rosterNames = new Set(people.map(p => p.name));
    const seenPairs = new Set();
    onewayDoc.forEach((e, i) => {
      const f = e && e.from, t = e && e.to;
      if (!f || !t || typeof f !== 'string' || typeof t !== 'string') {
        error(`[oneway_links.json] 第 ${i + 1} 条必须包含 from/to 字符串`);
        return;
      }
      if (e.reason !== undefined && (typeof e.reason !== 'string' || !e.reason.trim())) {
        error(`[oneway_links.json] ${f}→${t} 的 reason 若填写必须是非空字符串`);
      }
      if (!rosterNames.has(f)) error(`[oneway_links.json] from「${f}」不在花名册中`);
      if (!rosterNames.has(t)) error(`[oneway_links.json] to「${t}」不在花名册中`);
      const key = f + '→' + t;
      if (seenPairs.has(key)) warn(`[oneway_links.json] 重复声明: ${key}`);
      seenPairs.add(key);
      const fp = people.find(p => p.name === f);
      if (fp && !(Array.isArray(fp.links) && fp.links.includes(t))) {
        warn(`[oneway_links.json] ${key}：from 的 links 里没有「${t}」（声明已失效？）`);
      }
      const tp = people.find(p => p.name === t);
      if (tp && Array.isArray(tp.links) && tp.links.includes(f)) {
        warn(`[oneway_links.json] ${key}：对方已写回，此声明多余`);
      }
      onewayDeclared.add(key);
    });
  }

  // 单向关系（警告；已登记为有意单向的跳过）
  people.forEach(p => {
    (Array.isArray(p.links) ? p.links : []).forEach(target => {
      const other = people.find(q => q.name === target);
      if (other && Array.isArray(other.links) && !other.links.includes(p.name)) {
        if (onewayDeclared.has(p.name + '→' + target)) return;
        warn(`[people:${p.name}] 单向 links: →「${target}」（对方未写回，关系网中画为箭头；若为有意请在 data/oneway_links.json 登记）`);
      }
    });
  });
} else {
  error('[people.json] 顶层不是数组');
}

/* ---------- events.json ---------- */
if (eventsDoc) {
  const events = Array.isArray(eventsDoc.events) ? eventsDoc.events : null;
  if (!Array.isArray(events)) {
    error('[events.json] 顶层应为 { "events": [...] }');
  } else {
    const dateSeen = new Map();
    events.forEach((ev, i) => {
      const tag = `[events#${i} ${ev.date || '?'}]`;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ev.date || '') || Number.isNaN(new Date(ev.date + 'T00:00:00').getTime())) {
        error(`${tag} date 必须是 YYYY-MM-DD 合法日期`);
      }
      if (!ev.title || !String(ev.title).trim()) error(`${tag} title 为空`);
      if (!ev.desc || !String(ev.desc).trim()) error(`${tag} desc 为空`);
      if (!Array.isArray(ev.tags)) error(`${tag} tags 必须是数组`);
      if (!Array.isArray(ev.people)) error(`${tag} people 必须是数组（群像事件用空数组）`);
      (Array.isArray(ev.people) ? ev.people : []).forEach(n => {
        if (!roster.has(n)) error(`${tag} people 引用了不存在的人物「${n}」`);
        ALIASES.forEach(([bad]) => { if (n.includes(bad)) error(`${tag} people 含别称错字「${bad}」`); });
      });
      if (dateSeen.has(ev.date)) warn(`${tag} 与「${dateSeen.get(ev.date)}」同日（多条同日事件确认是否有意）`);
      dateSeen.set(ev.date, ev.title);
    });
  }
}

/* ---------- drinks.json + 与档案页兜底名单一致性 ---------- */
if (drinksDoc) {
  const drinks = Array.isArray(drinksDoc.drinks) ? drinksDoc.drinks : null;
  if (!Array.isArray(drinks)) {
    error('[drinks.json] 顶层应为 { "drinks": [...] }');
  } else {
    if (drinks.length < 15) error(`[drinks.json] 酒单不应少于 15 款（疑似数据截断），实际 ${drinks.length}`);
    const names = new Set();
    drinks.forEach((d, i) => {
      const tag = `[drinks#${i} ${d.name || '?'}]`;
      ['name', 'type', 'abv', 'emoji', 'color', 'desc'].forEach(k => {
        if (d[k] === undefined || !String(d[k]).trim()) error(`${tag} 缺少字段 ${k}`);
      });
      if (names.has(d.name)) error(`${tag} 酒名重复`);
      names.add(d.name);
    });
    // 与 drinker/index.html 内置 FALLBACK_SPECIALS 顺序比对
    const drinkerHTML = fs.readFileSync(path.join(ROOT, 'drinker/index.html'), 'utf8');
    const m = drinkerHTML.match(/const FALLBACK_SPECIALS = \[([\s\S]*?)\]/);
    if (!m) {
      error('[drinker/index.html] 找不到 FALLBACK_SPECIALS，无法比对轮换顺序');
    } else {
      const fallback = [...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1]);
      const actual = drinks.map(d => d.name);
      if (fallback.length !== actual.length || fallback.some((n, i) => n !== actual[i])) {
        error(`[drinks] 顺序/名单与 FALLBACK_SPECIALS 不一致\n    JSON : ${actual.join('、')}\n    兜底 : ${fallback.join('、')}`);
      }
    }
    // 全尝成就（drinksTasted >= N）与酒单总数联动
    if (Array.isArray(achievements)) {
      achievements.forEach(a => {
        if (a.metric === 'drinksTasted' && a.op === '>=' && a.value > 1 && a.value !== drinks.length) {
          error(`[achievements:${a.id}] 全尝成就目标 value=${a.value} 与酒单总数 ${drinks.length} 不一致`);
        }
      });
    }
  }
}

/* ---------- achievements.json ---------- */
if (Array.isArray(achievements)) {
  const ids = new Set();
  achievements.forEach((a, i) => {
    const tag = `[achievements#${i} ${a.id || '?'}]`;
    if (!a.id) error(`${tag} 缺少 id`);
    if (ids.has(a.id)) error(`${tag} id 重复`);
    ids.add(a.id);
    if (!a.metric) error(`${tag} 缺少 metric`);
    if (a.metric && !KNOWN_METRICS.has(a.metric)) {
      error(`${tag} 未知 metric「${a.metric}」（core 不产出 → 永远无法解锁；新增指标需同步本文件与 tavern-core.js）`);
    }
    if (a.op !== undefined && !['>=', '==', '<=', '>', '<'].includes(a.op)) {
      error(`${tag} 非法 op「${a.op}」`);
    }
    // value：数值阈值用 number，布尔型成就（== true/false）用 boolean
    if (a.value !== undefined && !['number', 'boolean'].includes(typeof a.value)) {
      error(`${tag} value 必须是数字或布尔值`);
    }
    if (typeof a.value === 'boolean' && a.op !== '==') {
      error(`${tag} 布尔型 value 只能配合 op "=="`);
    }
  });
} else {
  error('[achievements.json] 顶层应为数组');
}

/* ---------- mixing.json（吧台调酒：基酒/配料/风味短句/隐藏配方） ---------- */
if (mixingDoc) {
  const m = mixingDoc;
  if (!m.bases || !m.ingredients || typeof m.tags !== 'object' || m.tags === null) {
    error('[mixing.json] 顶层应包含 bases / ingredients / tags');
  } else {
    const tagKeys = Object.keys(m.tags);
    if (!tagKeys.length) error('[mixing.json] tags 短句池为空');
    else tagKeys.forEach(t => {
      if (!Array.isArray(m.tags[t]) || !m.tags[t].length || m.tags[t].some(x => !x || !String(x).trim())) {
        error(`[mixing.json] tags.${t} 应为非空字符串数组`);
      }
    });
    const baseIds = new Set();
    (Array.isArray(m.bases) ? m.bases : []).forEach((b, i) => {
      const tag = `[mixing.bases#${i} ${b.name || b.id || '?'}]`;
      ['id', 'name', 'emoji', 'type', 'abv', 'color', 'desc'].forEach(k => {
        if (!b[k] || !String(b[k]).trim()) error(`${tag} 缺少字段 ${k}`);
      });
      if (b.id) {
        if (baseIds.has(b.id)) error(`${tag} id 重复`);
        baseIds.add(b.id);
      }
      if (!Array.isArray(b.openers) || !b.openers.length || b.openers.some(x => !x || !String(x).trim())) {
        error(`${tag} openers 应为非空字符串数组`);
      }
    });
    if (!Array.isArray(m.bases) || !m.bases.length) error('[mixing.json] bases 不应为空');

    const ingIds = new Set();
    (Array.isArray(m.ingredients) ? m.ingredients : []).forEach((g, i) => {
      const tag = `[mixing.ingredients#${i} ${g.name || g.id || '?'}]`;
      ['id', 'name', 'emoji', 'word', 'desc'].forEach(k => {
        if (!g[k] || !String(g[k]).trim()) error(`${tag} 缺少字段 ${k}`);
      });
      if (!Array.isArray(g.tags) || !g.tags.length) {
        error(`${tag} tags 不应为空`);
      } else {
        g.tags.forEach(t => { if (!tagKeys.includes(t)) error(`${tag} tags 越界: ${t}`); });
      }
      if (g.id) {
        if (ingIds.has(g.id)) error(`${tag} id 重复`);
        ingIds.add(g.id);
      }
    });
    if (!Array.isArray(m.ingredients) || !m.ingredients.length) error('[mixing.json] ingredients 不应为空');

    const seenCombo = new Set();
    (Array.isArray(m.hidden) ? m.hidden : []).forEach((h, i) => {
      const tag = `[mixing.hidden#${i} ${h.name || h.id || '?'}]`;
      ['id', 'base', 'name', 'text'].forEach(k => {
        if (!h[k] || !String(h[k]).trim()) error(`${tag} 缺少字段 ${k}`);
      });
      if (!Array.isArray(h.ingredients) || h.ingredients.length !== 2 || h.ingredients.some(x => !x || typeof x !== 'string')) {
        error(`${tag} ingredients 必须恰好为 2 个配料 id`);
      } else {
        if (h.ingredients[0] === h.ingredients[1]) error(`${tag} 两个配料 id 相同`);
        h.ingredients.forEach(x => { if (!ingIds.has(x)) error(`${tag} 引用了不存在的配料 id「${x}」`); });
        const combo = h.base + '+' + [...h.ingredients].sort().join('+');
        if (seenCombo.has(combo)) error(`${tag} 隐藏配方组合重复: ${combo}`);
        seenCombo.add(combo);
      }
      if (h.base && !baseIds.has(h.base)) error(`${tag} 引用了不存在的基酒 id「${h.base}」`);
    });
  }
}

/* ---------- dice.json（骰子桌：遇客事件 / 赌局台词） ---------- */
if (diceDoc) {
  const d = diceDoc;
  if (!Array.isArray(d.encounters)) {
    error('[dice.json] encounters 应为数组');
  } else {
    const sums = new Set();
    d.encounters.forEach((e, i) => {
      const tag = `[dice.encounters#${i} sum=${e.sum ?? '?'}]`;
      if (!Number.isInteger(e.sum)) {
        error(`${tag} sum 必须是整数`);
      } else {
        if (e.sum < 2 || e.sum > 12) error(`${tag} sum=${e.sum} 越界（2d6 应为 2~12）`);
        if (sums.has(e.sum)) error(`${tag} sum=${e.sum} 重复`);
        sums.add(e.sum);
      }
      if (!e.title || !String(e.title).trim()) error(`${tag} title 为空`);
      if (!e.text || !String(e.text).trim()) error(`${tag} text 为空`);
      if (e.person !== undefined) {
        let fixed = String(e.person);
        ALIASES.forEach(([bad, good]) => {
          if (fixed.includes(bad)) {
            error(`${tag} person 含别称错字「${bad}」，应为「${good}」`);
            fixed = fixed.split(bad).join(good);
          }
        });
        if (!roster.has(fixed)) error(`${tag} person 引用了花名册之外的人物「${e.person}」`);
      }
    });
    // sum 2~12 恰好全覆盖（缺/多都已在上报；此处补报缺失清单）
    for (let s = 2; s <= 12; s++) {
      if (!sums.has(s)) error(`[dice.json] encounters 缺少 sum=${s} 的事件`);
    }
  }
  if (!d.gamble || typeof d.gamble !== 'object') {
    error('[dice.json] 缺少 gamble 对象');
  } else {
    ['win', 'lose', 'tie'].forEach(k => {
      const arr = d.gamble[k];
      if (!Array.isArray(arr) || !arr.length || arr.some(x => !x || !String(x).trim())) {
        error(`[dice.gamble] ${k} 应为非空字符串数组`);
      }
    });
    if (d.gamble.streak3 !== undefined && (!d.gamble.streak3 || !String(d.gamble.streak3).trim())) {
      error('[dice.gamble] streak3 若存在则必须为非空字符串');
    }
  }
}

/* ---------- notes.json ---------- */
const notes = readJSON('data/notes.json');
if (notes) {
  if (!Array.isArray(notes) || !notes.length) {
    error('[notes.json] 顶层应为非空数组');
  } else {
    notes.forEach((n, i) => {
      const tag = `[notes#${i}]`;
      if (!n.text || !String(n.text).trim()) error(`${tag} text 为空`);
      if (n.person !== undefined && !Array.isArray(n.person)) {
        error(`${tag} person 必须是数组（纯氛围手记用空数组）`);
        return;
      }
      (n.person || []).forEach(name => {
        let fixed = String(name);
        ALIASES.forEach(([bad, good]) => {
          if (fixed.includes(bad)) {
            error(`${tag} person 含别称错字「${bad}」，应为「${good}」`);
            fixed = fixed.split(bad).join(good);
          }
        });
        if (!roster.has(fixed)) error(`${tag} person 引用了不存在的人物「${name}」`);
      });
    });
  }
}

/* ---------- fragments.json ---------- */
const fragmentsDoc = readJSON('data/fragments.json');
if (fragmentsDoc) {
  const frags = fragmentsDoc.fragments;
  if (!Array.isArray(frags) || !frags.length) {
    error('[fragments.json] fragments 应为非空数组');
  } else {
    frags.forEach((f, i) => {
      if (!f.text || !String(f.text).trim()) error(`[fragments.json 普通碎片#${i}] text 为空`);
    });
  }
  const story = fragmentsDoc.story;
  if (!Array.isArray(story) || !story.length) {
    error('[fragments.json] story 应为非空数组（故事碎片按数组顺序拼合）');
  } else {
    const ids = new Set();
    story.forEach((s, i) => {
      const tag = `[story#${i} ${s.id || '?'}]`;
      if (!s.id) error(`${tag} 缺少 id`);
      if (ids.has(s.id)) error(`${tag} id 重复`);
      ids.add(s.id);
      if (!s.text || !String(s.text).trim()) error(`${tag} text 为空`);
    });
    // story 条数与成就 story-complete 的 value 联动
    const sc = Array.isArray(achievements) ? achievements.find(a => a.id === 'story-complete') : null;
    if (sc && sc.value !== story.length) {
      error(`[fragments.json] story 条数（${story.length}）与成就 story-complete.value（${sc.value}）不一致`);
    }
  }
}

/* ---------- 版本号一致性（HTML ?v= 与 update_log 最新版本） ---------- */
const updateLog = readJSON('data/update_log.json');
if (Array.isArray(updateLog) && updateLog.length && updateLog[0].version) {
  const expected = updateLog[0].version;
  const htmlFiles = ['index.html', 'drinker/index.html', 'menu/index.html',
    'achievements/index.html', 'timeline/index.html', 'map/index.html',
    'bar/index.html'].filter(f => exists(f));
  const seenVersions = new Set();
  htmlFiles.forEach(rel => {
    const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    [['js/tavern-core.js', 'core'], ['css/tavern.css', 'css']].forEach(([asset, label]) => {
      const pattern = '"[^"]*' + asset.replace(/[/.]/g, m => '\\' + m) + '(\\?v=([^"&]*))?"';
      const m = html.match(new RegExp(pattern));
      if (!m) {
        warn(`[${rel}] 未找到 ${label} 引用（跳过版本检查）`);
      } else if (!m[1]) {
        error(`[${rel}] ${asset} 引用缺少 ?v= 参数（当前应为 ?v=${expected}）`);
      } else {
        seenVersions.add(m[2]);
        if (m[2] !== expected) error(`[${rel}] ${asset} 的 ?v=${m[2]} 与 update_log 最新版本 ${expected} 不一致`);
      }
    });
  });
  if (seenVersions.size > 1) error(`各页面 ?v= 不一致: ${[...seenVersions].join(' / ')}`);
} else {
  warn('[update_log.json] 无法读取最新版本号，跳过版本一致性检查');
}

/* ---------- 汇总 ---------- */
const blank = (n) => '─'.repeat(Math.max(0, n));
console.log(blank(48));
warnings.forEach(w => console.log(`⚠️  WARN  ${w}`));
errors.forEach(e => console.log(`❌ ERROR ${e}`));
console.log(blank(48));
console.log(`校验完成：${errors.length} 个错误，${warnings.length} 个警告`);
process.exit(errors.length ? 1 : 0);
