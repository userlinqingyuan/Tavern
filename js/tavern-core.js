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

  /* 站点版本号：从本文件 <script> 标签的 ?v= 参数解析（唯一来源见 data/update_log.json） */
  var CORE_VERSION = (function () {
    try {
      var src = (document.currentScript && document.currentScript.src) || '';
      var m = src.match(/[?&]v=([^&]+)/);
      return m ? decodeURIComponent(m[1]) : '';
    } catch (e) { return ''; }
  })();

  var STATE_KEY = 'tavern_state_v1';
  var BORROW_KEY = 'tavern_borrow_log';
  var FAV_KEY = 'tavern_favorites';
  /* 旧存档兜底：仅当 state.drinkTotal 没记录过时才会用到（酒单总数见 data/drinks.json） */
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
  /* 转义：不依赖 DOM，页面与 Node 单测可共用同一份实现 */
  function escapeHtml(text) {
    return String(text == null ? '' : text).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
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
        diceUses: 0, fragmentsDrawn: 0, menuViews: 0, favoritesAdded: 0,
        notesRead: 0,
        mixes: 0, diceRolls: 0, encounters: 0, gambleWins: 0,
        fullMoonVisit: 0, fortuneDays: 0, festivalVisit: 0,
        weatherTypes: 0, eggsFound: 0
      },
      peopleViewed: [],
      storyFragments: [],
      drinkTotal: 0,
      mixLog: [],
      hiddenRecipes: [],
      gambleStreak: 0,
      unlocked: {},
      lastSeason: null,
      fullMoonVisited: null,
      greetingShown: false,
      fortuneDates: [],
      weatherTypes: [],
      eggsFound: []
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
    var drinkTotal = state.drinkTotal || DRINK_COUNT;
    var tastedSet = Object.create(null);
    state.tastedDates.forEach(function (ds) {
      tastedSet[dayOfYear(parseDate(ds)) % drinkTotal] = true;
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
      notesRead: state.counters.notesRead,
      storyFragments: (state.storyFragments || []).length,
      sawBlankCard: !!state.flags.sawBlankCard,
      mixes: state.counters.mixes,
      hiddenRecipes: (state.hiddenRecipes || []).length,
      diceRolls: state.counters.diceRolls,
      encounters: state.counters.encounters,
      gambleWins: state.counters.gambleWins,
      gambleStreak: state.gambleStreak || 0,
      fullMoonVisit: state.counters.fullMoonVisit || 0,
      fortuneDays: state.counters.fortuneDays || 0,
      festivalVisit: state.counters.festivalVisit || 0,
      weatherTypes: state.counters.weatherTypes || 0,
      eggsFound: state.counters.eggsFound || 0
    };
  }

  /* ---------- 成就判定 ---------- */
  function conditionMet(def, m) {
    /* 彩蛋成就（def.egg）：按彩蛋 id 解锁，来源是 ambient 的 eggFound 埋点 */
    if (def.egg) return (state.eggsFound || []).indexOf(def.egg) !== -1;
    var cur = m[def.metric];
    if (def.op === '>=') return typeof cur === 'number' && cur >= def.value;
    if (def.op === '==') return cur === def.value;
    return false;
  }

  function evaluate() {
    if (!defsLoaded || !state) return;
    var m = calcMetrics();
    var currentSeason = Ambient.season;
    defs.forEach(function (def) {
      if (state.unlocked[def.id]) return;
      if (def.season && def.season !== currentSeason) return;
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
      case 'notesRead': state.counters.notesRead++; break;
      case 'storyFragment':
        if (data.id && state.storyFragments.indexOf(data.id) === -1) state.storyFragments.push(data.id);
        break;
      case 'menuview': state.counters.menuViews++; break;
      case 'favorite': state.counters.favoritesAdded++; break;
      case 'tasting':
        if (data.total > state.drinkTotal) state.drinkTotal = data.total;
        if (state.tastedDates.indexOf(today) === -1) state.tastedDates.push(today);
        break;
      case 'borrow':
        /* 借阅指标直接读 tavern_borrow_log，无需计数 */
        break;
      case 'mix':
        state.counters.mixes++;
        if (data.hidden && state.hiddenRecipes.indexOf(data.hidden) === -1) {
          state.hiddenRecipes.push(data.hidden);
        }
        break;
      case 'diceRoll': state.counters.diceRolls++; break;
      case 'encounter': state.counters.encounters++; break;
      case 'gambleWin':
        state.counters.gambleWins++;
        state.gambleStreak = (state.gambleStreak || 0) + 1;
        break;
      case 'gambleLose': state.gambleStreak = 0; break;
      case 'fullMoonVisit': state.counters.fullMoonVisit = 1; break;
      case 'fortuneDraw':
        if (state.fortuneDates && state.fortuneDates.indexOf(today) === -1) {
          state.fortuneDates.push(today);
          state.counters.fortuneDays = state.fortuneDates.length;
        }
        break;
      case 'festivalVisit': state.counters.festivalVisit = 1; break;
      case 'weather':
        if (!state.weatherTypes) state.weatherTypes = [];
        if (data.type && state.weatherTypes.indexOf(data.type) === -1) {
          state.weatherTypes.push(data.type);
          state.counters.weatherTypes = state.weatherTypes.length;
        }
        break;
      case 'eggFound':
        if (!state.eggsFound) state.eggsFound = [];
        if (data.id && state.eggsFound.indexOf(data.id) === -1) {
          state.eggsFound.push(data.id);
          state.counters.eggsFound = state.eggsFound.length;
          if (data.fragment) track('storyFragment', { id: data.fragment });
        }
        break;
      default: break;
    }
    saveState();
    evaluate();
  }

  /* ---------- 带缓存的 JSON 加载（同页只请求一次） ---------- */
  function loadJSON(path) {
    if (jsonCache[path]) return jsonCache[path];
    var url = path;
    if (CORE_VERSION) url += (path.indexOf('?') === -1 ? '?' : '&') + 'v=' + CORE_VERSION;
    jsonCache[path] = fetch(url)
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
      '<div class="tavern-frag-card" role="dialog" aria-modal="true" aria-label="随机碎片">' +
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
    fragOverlay.querySelector('.tavern-frag-card').classList.toggle('special', !!fragment.special);
    fragOverlay.classList.add('open');
    /* 锁背景滚动：否则弹窗盖住了页面，背后还能滑 */
    document.body.style.overflow = 'hidden';
  }
  function closeFragment() {
    if (!fragOverlay) return;
    fragOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  /* ---------- 🗔 通用弹窗（.tavern-modal-overlay） ----------
     统一处理：Esc / 点遮罩 / ✕ 按钮 / 背景滚动锁 / 焦点归还。
     页面只需要 Tavern.openModal(overlay) 与 Tavern.closeModal(overlay)。 */
  var openedModal = null;
  var modalLastFocus = null;
  var modalBound = false;

  function bindModalEvents() {
    if (modalBound) return;
    modalBound = true;
    document.addEventListener('click', function (e) {
      if (!openedModal) return;
      if (e.target === openedModal) { closeModal(); return; }
      if (e.target.closest && e.target.closest('.tavern-modal-close')) closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && openedModal) closeModal();
    });
  }

  function openModal(overlay) {
    if (!overlay) return;
    bindModalEvents();
    if (openedModal && openedModal !== overlay) closeModal();
    openedModal = overlay;
    modalLastFocus = document.activeElement;
    overlay.classList.add('open');
    /* 锁背景滚动：移动端在弹窗内滑到底不再带动背后的页面 */
    document.body.style.overflow = 'hidden';
    var target = overlay.querySelector('[data-modal-focus]') || overlay.querySelector('.tavern-modal-close');
    if (target && target.focus) target.focus();
  }

  function closeModal(overlay) {
    /* 允许直接当事件处理器用（此时第一个参数是 Event，不是弹窗元素） */
    var el = (overlay && overlay.classList) ? overlay : openedModal;
    if (!el) return;
    el.classList.remove('open');
    if (el === openedModal) openedModal = null;
    if (!openedModal) document.body.style.overflow = '';
    if (modalLastFocus && modalLastFocus.focus && document.body.contains(modalLastFocus)) {
      modalLastFocus.focus();
    }
    modalLastFocus = null;
  }

  /* ==========================================
     Ambient 模块：季节 / 时段 / 月相 / 欢迎语
     ========================================== */
  /* ---------- 🕯️ 明暗叠加层（替代 body filter） ----------
     body 上挂 filter 会让内部所有 position:fixed 失效（弹窗被居中到整篇文档中间、
     固定栏跟着滚），所以改成往 body 注入一层固定覆盖层，由「时段亮度 / 滚动深度 /
     打盹」分别提供颜色变量，CSS 叠成几层半透明色。 */
  function timeTint(brightness) {
    var b = typeof brightness === 'number' ? brightness : 1;
    if (b === 1) return 'transparent';
    if (b < 1) return 'rgba(0,0,0,' + Math.min(0.8, (1 - b) * 0.9).toFixed(3) + ')';
    return 'rgba(255,238,210,' + Math.min(0.4, (b - 1) * 0.6).toFixed(3) + ')';
  }

  function ensureTimeLayer() {
    if (!document.body || document.querySelector('.tavern-timelayer')) return;
    var layer = document.createElement('div');
    layer.className = 'tavern-timelayer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);
  }

  var Ambient = {
    season: null,
    timeSlot: null,
    moonPhase: null,
    isFirstVisit: false,
    config: null,
    _intervalId: null,

    /* ---- 离线月相计算 ----
       参考朔日: 2000-01-06 18:14 UTC, 朔望月 29.530588853 天 */
    _SYNODIC: 29.530588853,
    _REF_NEW_MOON: Date.UTC(2000, 0, 6, 18, 14) / 86400000,

    calcMoonIllumination: function (date) {
      var now = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
      var phase = ((now - this._REF_NEW_MOON) % this._SYNODIC + this._SYNODIC) % this._SYNODIC / this._SYNODIC;
      return { phase: phase, illumination: (1 - Math.cos(2 * Math.PI * phase)) / 2 };
    },

    calcSeason: function (now) {
      var month = now.getMonth() + 1; /* 1-12 */
      var cfg = this.config;
      if (!cfg || !cfg.seasons) { this.season = 'autumn'; return; }
      for (var key in cfg.seasons) {
        if (cfg.seasons[key].months.indexOf(month) !== -1) { this.season = key; return; }
      }
      this.season = 'autumn';
    },

    calcTimeSlot: function (hour) {
      var cfg = this.config;
      if (!cfg || !cfg.timeSlots) { this.timeSlot = 'noon'; return; }
      for (var key in cfg.timeSlots) {
        if (cfg.timeSlots[key].hours.indexOf(hour) !== -1) { this.timeSlot = key; return; }
      }
      this.timeSlot = 'noon';
    },

    getMoonPhase: function (date) {
      var info = this.calcMoonIllumination(date);
      var cfg = this.config;
      if (!cfg || !cfg.moonPhases) {
        this.moonPhase = { name: '未知', emoji: '🌑', illumination: info.illumination };
        return this.moonPhase;
      }
      var phases = cfg.moonPhases;
      var matched = phases[0];
      for (var i = 0; i < phases.length; i++) {
        if (info.phase >= phases[i].threshold) matched = phases[i];
      }
      /* phase 接近 1 时回绕到新月 */
      if (info.phase >= 0.875 && info.phase < 1.0) matched = phases[7];
      this.moonPhase = { name: matched.name, emoji: matched.emoji, illumination: info.illumination };
      return this.moonPhase;
    },

    isFullMoon: function () {
      if (!this.moonPhase) return false;
      return this.moonPhase.illumination >= 0.95;
    },

    applySeason: function () {
      if (!this.season || !this.config || !this.config.seasons) return;
      var vars = this.config.seasons[this.season];
      if (!vars || !vars.vars) return;
      var root = document.documentElement;
      for (var cssVar in vars.vars) {
        root.style.setProperty(cssVar, vars.vars[cssVar]);
      }
      /* 季节色只作为叠加层（见 css 的 body::after，30% 不透明度），
         不覆盖各页面自己的背景图：--bg-gradient 已在上面的循环里写到 :root */
    },

    applyTimeSlot: function () {
      if (!this.timeSlot || !this.config || !this.config.timeSlots) return;
      var ts = this.config.timeSlots[this.timeSlot];
      if (!ts) return;
      var root = document.documentElement;
      root.style.setProperty('--bg-tint', ts.bgTint);
      /* 时段亮度改为「叠加层」而不是 body 滤镜：
         body 上只要挂了 filter，内部所有 position:fixed（弹窗、固定栏）都会改成
         相对 body 定位 —— 弹窗会被居中到整篇文档中间、固定栏会跟着滚（2026-09-13 修复） */
      root.style.setProperty('--time-tint', timeTint(ts.brightness));
      ensureTimeLayer();
      /* 夜晚 class */
      if (this.timeSlot === 'night') document.body.classList.add('time-night');
      else document.body.classList.remove('time-night');
    },

    handleGreetingAndFullMoon: function () {
      if (!state || !this.config) return;
      var now = new Date();
      var today = fmtDate(now);

      /* 欢迎语 */
      this.isFirstVisit = !state.lastSeason;
      if (!state.greetingShown) {
        var greetingEl = document.getElementById('greeting');
        if (greetingEl) {
          greetingEl.textContent = this.getGreeting();
          greetingEl.style.opacity = '0';
          greetingEl.style.transition = 'opacity 0.8s ease';
          requestAnimationFrame(function () { greetingEl.style.opacity = '1'; });
        }
        state.greetingShown = true;
      }
      state.lastSeason = this.season;

      /* 满月事件 */
      if (this.isFullMoon() && state.fullMoonVisited !== today) {
        state.fullMoonVisited = today;
        track('fullMoonVisit', 1);
        /* 首页展示满月事件 */
        var moonEl = document.getElementById('moonEvent');
        if (moonEl && this.config.moonEvents) {
          var events = this.config.moonEvents;
          var text = events[Math.floor(Math.random() * events.length)];
          moonEl.textContent = '🌕 ' + text;
          moonEl.style.display = 'block';
        }
      }
      saveState();
    },

    getGreeting: function () {
      if (!this.config || !this.config.greetings) return '';
      var g = this.config.greetings;
      if (this.isFirstVisit) return g.firstVisit || '';
      var subs = this.config.seasonSubs || {};
      var labels = this.config.seasonLabels || {};
      if (state.lastSeason === this.season) {
        return (g.returnSameSeason || '').replace('{seasonSub}', subs[this.season] || '');
      } else {
        return (g.returnNewSeason || '')
          .replace('{oldSeasonLabel}', labels[state.lastSeason] || '')
          .replace('{newSeasonLabel}', labels[this.season] || '');
      }
    },

    startInterval: function () {
      if (this._intervalId) clearInterval(this._intervalId);
      var self = this;
      this._intervalId = setInterval(function () {
        var now = new Date();
        var newSlot = self.timeSlot;
        self.calcTimeSlot(now.getHours());
        if (newSlot !== self.timeSlot) self.applyTimeSlot();
      }, 60000);
    },

    init: function (root) {
      var self = this;
      return loadJSON(root + 'data/ambient.json')
        .then(function (cfg) {
          self.config = cfg;
          var now = new Date();
          self.calcSeason(now);
          self.calcTimeSlot(now.getHours());
          self.getMoonPhase(now);
          self.applySeason();
          self.applyTimeSlot();
          self.handleGreetingAndFullMoon();
          self.startInterval();
        })
        .catch(function () {
          /* 配置加载失败：回退到 autumn 配色 */
          self.season = 'autumn';
          self.timeSlot = 'noon';
        });
    }
  };

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
    /* 先加载 ambient 配置（季节/时段/月相/欢迎语） */
    return Ambient.init(rootPath)
      .then(function () {
        /* ambient 就绪后重新评估成就（季节限定成就需要 Ambient.season） */
        evaluate();
        return loadJSON(rootPath + 'data/achievements.json');
      })
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
      var current, target;
      if (def.egg) {
        current = (state.eggsFound || []).indexOf(def.egg) !== -1 ? 1 : 0;
        target = 1;
      } else {
        target = def.op === '>=' ? def.value : 1;
        var cur = m[def.metric];
        current = def.op === '>='
          ? (typeof cur === 'number' ? cur : 0)
          : (cur === def.value ? 1 : 0);
      }
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
    escapeHtml: escapeHtml,
    openModal: openModal,
    closeModal: closeModal,
    openFragment: openFragment,
    closeFragment: closeFragment,
    v: CORE_VERSION,
    getStoryFragments: function () { if (!state) loadState(); return (state.storyFragments || []).slice(); },
    getMetrics: function () { if (!state) loadState(); return calcMetrics(); },
    getAchievements: getAchievements,
    getMixLog: function () { if (!state) loadState(); return (state.mixLog || []).slice(); },
    getHiddenRecipes: function () { if (!state) loadState(); return (state.hiddenRecipes || []).slice(); },
    pushMixLog: function (entry) {
      if (!state) loadState();
      state.mixLog.unshift({ d: entry.d, n: entry.n, h: entry.h });
      if (state.mixLog.length > 100) state.mixLog.length = 100;
      saveState();
    },
    todaysDrinkIndex: todaysDrinkIndex,
    hasTastedToday: hasTastedToday,
    tastedDrinkIndices: tastedDrinkIndices,
    Ambient: Ambient,
    _root: rootPath,
    get _state() { if (!state) loadState(); return state; }
  };
})();
