/* ============================================
   16号螺旋酒馆 · 共享核心 tavern-core.js
   埋点 / 到访统计 / 指标计算 / 成就判定 / 解锁弹窗
   纯原生、无依赖、无构建。
   用法：
     <script src="(root)/js/tavern-core.js"></script>
     Tavern.init(rootPath)   // 根目录页传 ''，子页面传 '..'
     Tavern.track('cardflip')
     Tavern.track('lightbox', { name: '泠钰' })
   ============================================ */
(function () {
  'use strict';

  var STATE_KEY = 'tavern_state_v1';
  var BORROW_KEY = 'tavern_borrow_log';
  var FAV_KEY = 'tavern_favorites';
  var DRINK_COUNT = 15;

  var state = null;
  var defs = [];
  var defsLoaded = false;
  var queue = [];
  var showing = false;
  var rootPath = '';
  var jsonCache = {};
  var fragOverlay = null;

  /* ---------- 工具 ---------- */
  function pad(n) { return String(n).padStart(2, '0'); }
  function fmtDate(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function parseDate(s) {
    var p = s.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function dayOfYear(d) {
    return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
  }
  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
  }
  function readJsonArray(key) {
    try {
      var v = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }

  /* ---------- 状态（单一数据源：tavern_state_v1） ---------- */
  function defaultState() {
    return {
      firstVisit: null,
      visitDates: [],
      tastedDates: [],
      flags: { lateNightVisit: false, newYearVisit: false, sawBlankCard: false },
      counters: {
        cardFlips: 0, lightboxViews: 0, networkOpens: 0, bookReads: 0,
        diceUses: 0, fragmentsDrawn: 0, menuViews: 0, favoritesAdded: 0
      },
      peopleViewed: [],
      unlocked: {}
    };
  }

  function loadState() {
    var s = defaultState();
    try {
      var raw = localStorage.getItem(STATE_KEY);
      if (raw) {
        var data = JSON.parse(raw);
        s = Object.assign(defaultState(), data);
        s.flags = Object.assign(defaultState().flags, data.flags || {});
        s.counters = Object.assign(defaultState().counters, data.counters || {});
      }
    } catch (e) { /* 存档损坏则重置为默认 */ }
    state = s;
  }

  function saveState() {
    try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  /* ---------- 指标（全部由状态推导） ---------- */
  function calcStreak(dates) {
    if (!dates.length) return 0;
    var set = Object.create(null);
    dates.forEach(function (d) { set[d] = true; });
    var cursor = new Date();
    // 今天还没记录也允许从昨天起算（跨零点不断签）
    if (!set[fmtDate(cursor)]) cursor.setDate(cursor.getDate() - 1);
    var n = 0;
    while (set[fmtDate(cursor)]) {
      n++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return n;
  }

  function calcMetrics() {
    var tastedSet = Object.create(null);
    state.tastedDates.forEach(function (ds) {
      tastedSet[dayOfYear(parseDate(ds)) % DRINK_COUNT] = true;
    });
    var people = state.peopleViewed.filter(function (n) { return n && n !== '？？？'; });
    return {
      visitDays: state.visitDates.length,
      visitStreak: calcStreak(state.visitDates),
      lateNightVisit: !!state.flags.lateNightVisit,
      newYearVisit: !!state.flags.newYearVisit,
      peopleViewed: people.length,
      cardFlips: state.counters.cardFlips,
      networkOpens: state.counters.networkOpens,
      bookReads: state.counters.bookReads,
      diceUses: state.counters.diceUses,
      fragmentsDrawn: state.counters.fragmentsDrawn,
      favoritesAdded: Math.max(state.counters.favoritesAdded, readJsonArray(FAV_KEY).length),
      menuViews: state.counters.menuViews,
      tastingCount: state.tastedDates.length,
      tastingStreak: calcStreak(state.tastedDates),
      drinksTasted: Object.keys(tastedSet).length,
      borrows: readJsonArray(BORROW_KEY).length,
      sawBlankCard: !!state.flags.sawBlankCard
    };
  }

  /* ---------- 成就判定 ---------- */
  function conditionMet(def, m) {
    var cur = m[def.metric];
    if (def.op === '>=') return typeof cur === 'number' && cur >= def.value;
    if (def.op === '==') return cur === def.value;
    return false;
  }

  function evaluate() {
    if (!defsLoaded || !state) return;
    var m = calcMetrics();
    defs.forEach(function (def) {
      if (state.unlocked[def.id]) return;
      if (conditionMet(def, m)) {
        state.unlocked[def.id] = new Date().toISOString();
        queue.push(def);
      }
    });
    saveState();
    pumpQueue();
  }

  /* ---------- 解锁弹窗（去重队列，逐个播放） ---------- */
  function ensureToastCss() {
    if (document.getElementById('tavern-toast-style')) return;
    var css =
      '.tavern-toast{position:fixed;right:24px;bottom:24px;z-index:9999;display:flex;align-items:center;gap:13px;' +
      'min-width:240px;max-width:330px;padding:14px 18px;background:linear-gradient(160deg,#241c16,#14100d);' +
      'border:1px solid rgba(214,168,93,.45);border-radius:10px;box-shadow:0 14px 40px rgba(0,0,0,.55);' +
      'opacity:0;transform:translateY(16px);transition:opacity .35s ease,transform .35s ease;pointer-events:none}' +
      '.tavern-toast.show{opacity:1;transform:translateY(0)}' +
      '.tavern-toast-icon{font-size:30px;line-height:1;filter:drop-shadow(0 0 8px rgba(214,168,93,.55))}' +
      '.tavern-toast-label{font:700 10px/1.4 "Arial Narrow",sans-serif;letter-spacing:.18em;color:#d6a85d;text-transform:uppercase}' +
      '.tavern-toast-name{font-size:15px;color:#eadcc0;margin-top:2px;letter-spacing:.04em}' +
      '@media(prefers-reduced-motion:reduce){.tavern-toast{transition:none}}' +
      '@media(max-width:620px){.tavern-toast{left:16px;right:16px;bottom:16px;max-width:none}}';
    var style = document.createElement('style');
    style.id = 'tavern-toast-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function pumpQueue() {
    if (showing || !queue.length) return;
    showing = true;
    var def = queue.shift();
    ensureToastCss();
    var box = document.createElement('div');
    box.className = 'tavern-toast';
    box.setAttribute('role', 'status');
    box.innerHTML =
      '<div class="tavern-toast-icon">' + escapeHtml(def.icon) + '</div>' +
      '<div><div class="tavern-toast-label">🏆 成就解锁 · 点击查看</div>' +
      '<div class="tavern-toast-name">' + escapeHtml(def.name) + '</div></div>';
    box.style.pointerEvents = 'auto';
    box.style.cursor = 'pointer';
    box.addEventListener('click', function () {
      location.href = rootPath + 'achievements/';
    });
    document.body.appendChild(box);
    requestAnimationFrame(function () { box.classList.add('show'); });
    setTimeout(function () {
      box.classList.remove('show');
      setTimeout(function () {
        box.remove();
        showing = false;
        pumpQueue();
      }, 400);
    }, 3500);
  }

  /* ---------- 埋点 ---------- */
  function track(event, data) {
    if (!state) loadState();
    data = data || {};
    var today = fmtDate(new Date());
    switch (event) {
      case 'cardflip': state.counters.cardFlips++; break;
      case 'lightbox':
        state.counters.lightboxViews++;
        if (data.name) {
          if (data.name === '？？？') state.flags.sawBlankCard = true;
          if (state.peopleViewed.indexOf(data.name) === -1) state.peopleViewed.push(data.name);
        }
        break;
      case 'network': state.counters.networkOpens++; break;
      case 'book': state.counters.bookReads++; break;
      case 'dice': state.counters.diceUses++; break;
      case 'fragment': state.counters.fragmentsDrawn++; break;
      case 'menuview': state.counters.menuViews++; break;
      case 'favorite': state.counters.favoritesAdded++; break;
      case 'tasting':
        if (state.tastedDates.indexOf(today) === -1) state.tastedDates.push(today);
        break;
      case 'borrow':
        /* 借阅指标直接读 tavern_borrow_log，无需计数 */
        break;
      default: break;
    }
    saveState();
    evaluate();
  }

  /* ---------- 带缓存的 JSON 加载（同页只请求一次） ---------- */
  function loadJSON(path) {
    if (jsonCache[path]) return jsonCache[path];
    jsonCache[path] = fetch(path)
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .catch(function (e) { delete jsonCache[path]; throw e; });
    return jsonCache[path];
  }

  /* ---------- 📜 随机碎片弹窗（DOM/样式由 core 注入，页面只提供内容） ---------- */
  function ensureFragDom() {
    if (fragOverlay) return;
    fragOverlay = document.createElement('div');
    fragOverlay.className = 'tavern-frag-overlay';
    fragOverlay.innerHTML =
      '<div class="tavern-frag-card" role="dialog" aria-modal="true">' +
      '<div class="tavern-frag-rule"></div>' +
      '<div class="tavern-frag-source"></div>' +
      '<div class="tavern-frag-text"></div>' +
      '<div class="tavern-frag-hint">点击任意处关闭</div>' +
      '</div>';
    document.body.appendChild(fragOverlay);
    fragOverlay.addEventListener('click', function (e) {
      if (e.target === fragOverlay) closeFragment();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeFragment();
    });
  }
  function openFragment(fragment) {
    if (!fragment) return;
    ensureFragDom();
    fragOverlay.querySelector('.tavern-frag-text').textContent = fragment.text || '……';
    fragOverlay.querySelector('.tavern-frag-source').textContent = '✦ ' + (fragment.source || '档案碎片');
    fragOverlay.classList.add('open');
  }
  function closeFragment() {
    if (fragOverlay) fragOverlay.classList.remove('open');
  }

  /* ---------- 初始化（每页一次） ---------- */
  function init(root) {
    // 规范化根路径：'..' → '../'，'' 保持 ''
    rootPath = root ? String(root).replace(/\/?$/, '/') : '';
    if (!state) loadState();
    var now = new Date();
    var today = fmtDate(now);
    if (!state.firstVisit) state.firstVisit = today;
    if (state.visitDates.indexOf(today) === -1) state.visitDates.push(today);
    if (now.getHours() >= 22 || now.getHours() < 5) state.flags.lateNightVisit = true;
    if (now.getMonth() === 0 && now.getDate() === 1) state.flags.newYearVisit = true;
    saveState();
    evaluate();
    return loadJSON(rootPath + 'data/achievements.json')
      .then(function (list) {
        defs = Array.isArray(list) ? list : [];
        defsLoaded = true;
        evaluate();
      })
      .catch(function () { defsLoaded = false; });
  }

  /* ---------- 对外查询 ---------- */
  function getAchievements() {
    if (!state) loadState();
    var m = calcMetrics();
    return defs.map(function (def) {
      var unlockedAt = state.unlocked[def.id] || null;
      var target = def.op === '>=' ? def.value : 1;
      var cur = m[def.metric];
      var current = def.op === '>='
        ? (typeof cur === 'number' ? cur : 0)
        : (cur === def.value ? 1 : 0);
      return { def: def, unlocked: !!unlockedAt, unlockedAt: unlockedAt, current: current, target: target };
    });
  }

  function todaysDrinkIndex(len) {
    return dayOfYear(new Date()) % len;
  }
  function hasTastedToday() {
    if (!state) loadState();
    return state.tastedDates.indexOf(fmtDate(new Date())) !== -1;
  }
  function tastedDrinkIndices(len) {
    if (!state) loadState();
    var set = Object.create(null);
    state.tastedDates.forEach(function (ds) {
      set[dayOfYear(parseDate(ds)) % len] = true;
    });
    return Object.keys(set).map(Number);
  }

  window.Tavern = {
    init: init,
    track: track,
    loadJSON: loadJSON,
    openFragment: openFragment,
    closeFragment: closeFragment,
    getMetrics: function () { if (!state) loadState(); return calcMetrics(); },
    getAchievements: getAchievements,
    todaysDrinkIndex: todaysDrinkIndex,
    hasTastedToday: hasTastedToday,
    tastedDrinkIndices: tastedDrinkIndices
  };
})();
