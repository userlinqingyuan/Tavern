/* ============================================
   16号螺旋酒馆 · 环境交互 tavern-ambient.js
   鼠标速度 / 空闲检测 / 烛火摇曳 / 打盹模式
   滚动光线 / 灰尘飞扬 / 手机倾斜 / 粒子分级
   纯原生、无依赖、无构建。
   用法：
     <script src="(root)/js/tavern-ambient.js"></script>
   脚本自动检测页面元素，有则启用，无则跳过。
   ============================================ */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isMobile = window.matchMedia('(max-width: 620px)').matches;
  var dpr = window.devicePixelRatio || 1;

  /* 粒子密度分级：移动端单独一档（粒子更少）；移动端还隔帧渲染，
     因为「全屏 canvas 每帧重绘」是移动端滚动卡顿的主要来源之一 */
  var FRAME_SKIP = isMobile ? 2 : 1;
  var particleLevel = isMobile ? 'mobile' : (dpr >= 2 ? 'high' : dpr >= 1.5 ? 'medium' : 'low');
  var DENSITY = {
    mobile: { dust: 8, ember: 2 },
    high:   { dust: 40, ember: 6 },
    medium: { dust: 25, ember: 4 },
    low:    { dust: 15, ember: 3 }
  };

  /* ==========================================
     MouseTracker：鼠标速度 + 空闲检测
     ========================================== */
  var MouseTracker = {
    speed: 0,
    smoothSpeed: 0,
    idle: false,
    _lastX: 0,
    _lastY: 0,
    _lastT: 0,
    _idleTimer: null,
    _rafId: null,

    init: function () {
      var self = this;
      document.addEventListener('mousemove', function (e) {
        var now = performance.now();
        if (self._lastT) {
          var dt = now - self._lastT;
          if (dt > 0) {
            var dx = e.clientX - self._lastX;
            var dy = e.clientY - self._lastY;
            var dist = Math.sqrt(dx * dx + dy * dy);
            self.speed = Math.min(dist / dt, 3);
          }
        }
        self._lastX = e.clientX;
        self._lastY = e.clientY;
        self._lastT = now;
        if (self.idle) { self.idle = false; DozeMode.wake(); }
        self._resetIdle();
      }, { passive: true });

      /* 速度衰减循环 */
      function decay() {
        self.smoothSpeed += (self.speed - self.smoothSpeed) * 0.15;
        self.speed *= 0.92;
        if (self.speed < 0.01) self.speed = 0;
        requestAnimationFrame(decay);
      }
      if (!reduceMotion) requestAnimationFrame(decay);
    },

    _resetIdle: function () {
      var self = this;
      clearTimeout(this._idleTimer);
      this._idleTimer = setTimeout(function () {
        self.idle = true;
        DozeMode.doze();
      }, 30000);
    }
  };

  /* ==========================================
     DozeMode：酒馆打盹（30s 无操作）
     ========================================== */
  var DozeMode = {
    _active: false,

    doze: function () {
      if (this._active || reduceMotion) return;
      this._active = true;
      document.body.classList.add('tavern-doze');
      /* 火焰减弱 */
      var flames = document.querySelectorAll('.flame');
      flames.forEach(function (f) { f.style.animationDuration = '2s'; });
      var glows = document.querySelectorAll('.glow, .glow-outer');
      glows.forEach(function (g) { g.style.opacity = '0.3'; });
    },

    wake: function () {
      if (!this._active) return;
      this._active = false;
      document.body.classList.remove('tavern-doze');
      var flames = document.querySelectorAll('.flame');
      flames.forEach(function (f) { f.style.animationDuration = ''; });
      var glows = document.querySelectorAll('.glow, .glow-outer');
      glows.forEach(function (g) { g.style.opacity = ''; });
    }
  };

  /* ==========================================
     ScrollTracker：滚动深度 → 光线变化
     ========================================== */
  var ScrollTracker = {
    _handler: null,

    init: function () {
      if (reduceMotion) return;
      var self = this;
      var ticking = false;
      this._handler = function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () {
          var maxScroll = document.documentElement.scrollHeight - window.innerHeight;
          var ratio = maxScroll > 0 ? window.scrollY / maxScroll : 0;
          /* 滚动越深，画面越暗（模拟从壁炉走向深处）：
             写 --scroll-tint 交给 .tavern-timelayer 叠加，不再动 body filter
             （body filter 会让 position:fixed 的弹窗/固定栏失效）。
             量化到 5% 一档：整屏叠加层每帧改色会导致移动端滚动时反复重绘 */
          var step = Math.round(ratio * 20) / 20;
          if (step !== self._lastStep) {
            self._lastStep = step;
            document.documentElement.style.setProperty('--scroll-tint',
              'rgba(0,0,0,' + (step * 0.15).toFixed(3) + ')');
          }
          /* 触发灰尘 */
          DustMotes.burst(MouseTracker.smoothSpeed);
          ticking = false;
        });
      };
      window.addEventListener('scroll', this._handler, { passive: true });
    }
  };

  /* ==========================================
     DustMotes：灰尘飞扬（滚动时从底部升起）
     ========================================== */
  var DustMotes = {
    canvas: null,
    ctx: null,
    particles: [],
    _rafId: null,

    init: function () {
      if (reduceMotion) return;
      var canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1;';
      document.body.appendChild(canvas);
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.resize();
      window.addEventListener('resize', this.resize.bind(this));

      var count = DENSITY[particleLevel].dust;
      for (var i = 0; i < count; i++) {
        this.particles.push(this._create());
      }
      if (!reduceMotion) this._loop();
    },

    resize: function () {
      if (!this.canvas) return;
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    },

    _create: function () {
      return {
        x: Math.random() * window.innerWidth,
        y: window.innerHeight + Math.random() * 100,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -(0.2 + Math.random() * 0.4),
        size: 1 + Math.random() * 2,
        opacity: 0.1 + Math.random() * 0.2,
        life: 1
      };
    },

    burst: function (intensity) {
      if (intensity < 0.3) return;
      var count = Math.min(Math.floor(intensity * 3), 8);
      for (var i = 0; i < count; i++) {
        var p = this._create();
        p.vy = -(0.5 + Math.random() * 1.0);
        p.vx = (Math.random() - 0.5) * intensity * 2;
        this.particles.push(p);
      }
      /* 上限 */
      if (this.particles.length > 80) {
        this.particles.splice(0, this.particles.length - 80);
      }
    },

    _loop: function () {
      /* 移动端隔帧渲染：位置更新照旧，少画一半帧 */
      this._frame = (this._frame || 0) + 1;
      if (FRAME_SKIP > 1 && this._frame % FRAME_SKIP !== 0) {
        this._rafId = requestAnimationFrame(this._loop.bind(this));
        return;
      }
      var ctx = this.ctx;
      var w = this.canvas.width;
      var h = this.canvas.height;
      ctx.clearRect(0, 0, w, h);
      var gold = '#d6a85d';
      for (var i = this.particles.length - 1; i >= 0; i--) {
        var p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy *= 0.99;
        p.life -= 0.003;
        if (p.y < -10 || p.life <= 0) {
          this.particles.splice(i, 1);
          continue;
        }
        var alpha = p.opacity * p.life;
        ctx.fillStyle = 'rgba(214, 168, 93, ' + alpha + ')';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      /* 补充 */
      while (this.particles.length < DENSITY[particleLevel].dust) {
        this.particles.push(this._create());
      }
      this._rafId = requestAnimationFrame(this._loop.bind(this));
    }
  };

  /* ==========================================
     DeviceTilt：手机倾斜 → 档案袋晃动
     ========================================== */
  var DeviceTilt = {
    _listening: false,
    _permissionAsked: false,
    _pending: null,
    _rafId: null,
    _lastTilt: 0,

    init: function () {
      if (!isMobile || reduceMotion) return;
      if (!window.DeviceOrientationEvent) return;
      var self = this;

      /* iOS 13+ 必须在用户手势里申请权限，否则事件永远不来 */
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        var ask = function () {
          if (self._permissionAsked) return;
          self._permissionAsked = true;
          DeviceOrientationEvent.requestPermission()
            .then(function (state) { if (state === 'granted') self._listen(); })
            .catch(function () {});
        };
        document.addEventListener('touchend', ask, { once: true, passive: true });
        document.addEventListener('click', ask, { once: true });
        return;
      }
      this._listen();
    },

    _listen: function () {
      if (this._listening) return;
      this._listening = true;
      var self = this;
      window.addEventListener('deviceorientation', function (e) {
        if (e.gamma === null || e.beta === null) return;
        self._queue(e.gamma, e.beta);
      }, { passive: true });
    },

    /* 方向事件来得比帧还密，合并到每帧只处理一次 */
    _queue: function (gamma, beta) {
      var self = this;
      this._pending = { gamma: gamma, beta: beta };
      if (this._rafId) return;
      this._rafId = requestAnimationFrame(function () {
        self._rafId = null;
        var p = self._pending;
        self._pending = null;
        if (p) self._apply(p.gamma, p.beta);
      });
    },

    _apply: function (gamma, beta) {
      var tilt = Math.max(-1, Math.min(1, gamma / 45));
      /* 全站只写一个 CSS 变量：首页卡片与档案页人物卡都读它，
         避免逐张元素写内联样式（十几张卡每帧改样式会明显掉帧） */
      var deg = Math.round(tilt * 3 * 10) / 10;   /* 最多 ±3°，微微倾斜 */
      if (Math.abs(deg - this._lastTilt) >= 0.3) {
        this._lastTilt = deg;
        document.documentElement.style.setProperty('--tilt', deg + 'deg');
      }
    }
  };

  /* ==========================================
     FortuneSign：每日运势签
     ========================================== */
  var FortuneSign = {
    config: null,
    todaySlip: null,

    init: function () {
      var self = this;
      var root = (window.Tavern && Tavern._root) || '';
      this._loadConfig(root).then(function () {
        self._checkAndRender();
      }).catch(function () {});
    },

    _loadConfig: function (root) {
      var self = this;
      /* 同样走 Tavern.loadJSON（自动带 ?v= + 同页缓存） */
      return Tavern.loadJSON(root + 'data/fortune.json').then(function (data) {
        self.config = data;
      });
    },

    _checkAndRender: function () {
      if (!this.config || !this.config.length) return;
      var state = (window.Tavern && Tavern._state) || null;
      var today = new Date();
      var dateStr = today.getFullYear() + '-' +
        String(today.getMonth() + 1).padStart(2, '0') + '-' +
        String(today.getDate()).padStart(2, '0');
      var drawn = state && state.fortuneDates && state.fortuneDates.indexOf(dateStr) !== -1;

      /* 生成今日签（日期种子） */
      var seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
      var weighted = this._buildWeighted();
      var idx = seed % weighted.length;
      this.todaySlip = weighted[idx];

      var container = document.getElementById('fortuneBox');
      if (!container) return;

      if (drawn) {
        /* 已抽过 */
        this._renderSlip(container);
      } else {
        this._renderTube(container);
      }
    },

    _buildWeighted: function () {
      var weights = { '上上': 5, '上': 15, '中上': 15, '中': 30, '中下': 15, '下': 12, '下下': 8, '吉': 8 };
      var arr = [];
      this.config.forEach(function (s) {
        var w = weights[s.level] || 10;
        for (var i = 0; i < w; i++) arr.push(s);
      });
      return arr;
    },

    _renderTube: function (container) {
      var self = this;
      container.innerHTML = '<div class="fortune-tube" id="fortuneTube"><div class="fortune-tube-body"></div><div class="fortune-tube-cap"></div></div><div class="fortune-tube-hint">点击签筒抽取今日运势</div>';
      var tube = document.getElementById('fortuneTube');
      if (tube) {
        tube.style.cursor = 'pointer';
        tube.addEventListener('click', function () {
          self._draw(container);
        });
      }
    },

    _draw: function (container) {
      var self = this;
      var tube = document.getElementById('fortuneTube');
      if (tube) {
        tube.classList.add('fortune-tube-shake');
        setTimeout(function () {
          if (window.Tavern && Tavern.track) Tavern.track('fortuneDraw');
          self._renderSlip(container);
        }, 800);
      }
    },

    _renderSlip: function (container) {
      var slip = this.todaySlip;
      if (!slip) return;
      container.innerHTML =
        '<div class="fortune-slip">' +
          '<div class="fortune-slip-level">' + slip.level + '</div>' +
          '<div class="fortune-slip-text">' + slip.text + '</div>' +
          '<div class="fortune-slip-lucky">幸运 · ' + slip.lucky + '</div>' +
          '<div class="fortune-slip-taboo">' + slip.taboo + '</div>' +
        '</div>';
    }
  };

  /* ==========================================
     FestivalCard：节日/节气事件
     ========================================== */
  var FestivalCard = {
    config: null,

    init: function () {
      var self = this;
      var root = (window.Tavern && Tavern._root) || '';
      /* 走 Tavern.loadJSON：自动带 ?v= 版本号并做同页缓存，避免改完数据被浏览器缓存住 */
      Tavern.loadJSON(root + 'data/festivals.json').then(function (data) {
        self.config = data;
        self._checkAndRender();
      }).catch(function () {});
    },

    _checkAndRender: function () {
      if (!this.config) return;
      var now = new Date();
      var month = now.getMonth() + 1;
      var day = now.getDate();
      var dateStr = String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');

      var matched = null;
      for (var i = 0; i < this.config.length; i++) {
        var f = this.config[i];
        if (f.dateType === 'solar' && f.date === dateStr) { matched = f; break; }
      }

      /* 农历节日：简化检查（实际农历需要 Ambient 月相算法推算） */
      if (!matched) {
        var ambient = window.Tavern && Tavern.Ambient;
        if (ambient && ambient.config) {
          var moonInfo = ambient.calcMoonIllumination ? ambient.calcMoonIllumination(now) : null;
          /* 满月附近检查中秋/元宵等 — 简化：只检查日期接近 */
          for (var j = 0; j < this.config.length; j++) {
            var f2 = this.config[j];
            if (f2.dateType === 'lunar') {
              /* 粗略匹配：中秋(08-15农历)等需要真实农历转换，这里用近似 */
              /* TODO: 完整农历转换在 Ambient 模块中实现 */
            }
          }
        }
      }

      if (matched) {
        if (window.Tavern && Tavern.track) Tavern.track('festivalVisit');
        var container = document.getElementById('festivalCard');
        if (container) {
          container.innerHTML =
            '<div class="festival-card-inner">' +
              '<div class="festival-title">' + (matched.title || matched.name) + '</div>' +
              '<div class="festival-desc">' + matched.desc + '</div>' +
              (matched.drink ? '<div class="festival-drink">推荐 · ' + matched.drink + '</div>' : '') +
            '</div>';
          container.style.display = 'block';
        }
      }
    }
  };

  /* ==========================================
     WeatherLayer：天气感知 Canvas 图层
     ========================================== */
  var WeatherLayer = {
    config: null,
    canvas: null,
    ctx: null,
    weatherType: null,
    particles: [],
    _rafId: null,

    init: function () {
      if (reduceMotion) return;
      var self = this;
      var root = (window.Tavern && Tavern._root) || '';
      Tavern.loadJSON(root + 'data/weather.json').then(function (cfg) {
        self.config = cfg;
        self._determineWeather();
        self._createCanvas();
        self._startAnimation();
        if (window.Tavern && Tavern.track) {
          Tavern.track('weather', { type: self.weatherType });
        }
      }).catch(function () {});
    },

    _determineWeather: function () {
      var cfg = this.config || {};
      var hints = cfg.hints || {};
      var types = cfg.types || {};
      var mode = cfg.mode || 'month';
      var pool = (Array.isArray(cfg.pool) && cfg.pool.length ? cfg.pool : Object.keys(types))
        .filter(function (t) { return !!types[t]; });

      /* month：按月份查表（旧行为）；daily：按日期随机（一天一换，同一天各页面一致）；
         visit：每次打开随机。随机模式下权重取自 weather.json 的 weights。 */
      if (mode === 'month' || !pool.length) {
        this.weatherType = hints[String(new Date().getMonth() + 1)] || hints['default'] || 'cloudy';
        return;
      }
      /* daily 传日期字符串做种子（同一天一致）；visit 传 null 表示每次真随机 */
      var seed = mode === 'visit' ? null : WeatherLayer._dateSeed();
      this.weatherType = WeatherLayer._pickWeighted(pool, cfg.weights, seed);
    },

    /* 日期种子：YYYY-MM-DD（同一天 → 同一个种子 → 各页面天气一致） */
    _dateSeed: function (d) {
      d = d || new Date();
      var p = function (n) { return (n < 10 ? '0' : '') + n; };
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    },

    /* 带权重的挑选：seedText 为空则真随机；否则用 FNV-1a 散列，
       同一个 seedText 得到同一结果，且相邻日期也会被充分打散 */
    _pickWeighted: function (pool, weights, seed) {
      var list = [];
      pool.forEach(function (t) {
        var w = weights && typeof weights[t] === 'number' ? Math.max(0, Math.round(weights[t])) : 1;
        for (var i = 0; i < w; i++) list.push(t);
      });
      if (!list.length) return pool[0];
      if (seed === null || seed === undefined) {
        return list[Math.floor(Math.random() * list.length)];
      }
      var s = String(seed);
      var h = 2166136261 >>> 0;
      for (var i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
      }
      return list[h % list.length];
    },

    _createCanvas: function () {
      var canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:2;';
      document.body.appendChild(canvas);
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.resize();
      window.addEventListener('resize', this.resize.bind(this));
    },

    resize: function () {
      if (!this.canvas) return;
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    },

    _startAnimation: function () {
      var self = this;
      var type = this.weatherType;
      if (type === 'sunny') this._initSunny();
      else if (type === 'rainy' || type === 'stormy') this._initRain(type === 'stormy');
      else if (type === 'snowy') this._initSnow();
      else if (type === 'foggy') this._initFog();
      else return; /* cloudy: no canvas effect */

      var frame = 0;
      function loop() {
        frame++;
        if (FRAME_SKIP > 1 && frame % FRAME_SKIP !== 0) {
          self._rafId = requestAnimationFrame(loop);
          return;
        }
        self._update();
        self._draw();
        self._rafId = requestAnimationFrame(loop);
      }
      loop();
    },

    _initSunny: function () {
      this.particles = [];
      for (var i = 0; i < 4; i++) {
        this.particles.push({
          type: 'beam',
          x: -50 + i * 120,
          width: 80 + Math.random() * 40,
          angle: 0.3,
          opacity: 0.04 + Math.random() * 0.03,
          speed: 0.1 + Math.random() * 0.05
        });
      }
    },

    _initRain: function (withLightning) {
      var count = isMobile ? 36 : 120;
      this.particles = [];
      for (var i = 0; i < count; i++) {
        this.particles.push({
          type: 'raindrop',
          x: Math.random() * (window.innerWidth + 200) - 100,
          y: Math.random() * window.innerHeight,
          length: 8 + Math.random() * 15,
          speed: 8 + Math.random() * 6,
          angle: 0.15,
          opacity: 0.15 + Math.random() * 0.15
        });
      }
      if (withLightning) {
        this._lightningTimer = 0;
        this._lightningFlash = 0;
      }
    },

    _initSnow: function () {
      var count = isMobile ? 18 : 60;
      this.particles = [];
      for (var i = 0; i < count; i++) {
        this.particles.push({
          type: 'snowflake',
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          radius: 1 + Math.random() * 3,
          speed: 0.5 + Math.random() * 1.5,
          sway: Math.random() * Math.PI * 2,
          swaySpeed: 0.01 + Math.random() * 0.02,
          opacity: 0.3 + Math.random() * 0.4
        });
      }
    },

    _initFog: function () {
      this.particles = [];
      for (var i = 0; i < 5; i++) {
        this.particles.push({
          type: 'fog',
          y: window.innerHeight * (0.5 + i * 0.1),
          offsetX: Math.random() * window.innerWidth,
          speed: 0.1 + Math.random() * 0.15,
          opacity: 0.03 + Math.random() * 0.04,
          width: window.innerWidth * (0.8 + Math.random() * 0.4)
        });
      }
    },

    _update: function () {
      var w = window.innerWidth;
      var h = window.innerHeight;
      for (var i = 0; i < this.particles.length; i++) {
        var p = this.particles[i];
        if (p.type === 'beam') {
          p.x += p.speed;
          if (p.x > w + 100) p.x = -100;
        } else if (p.type === 'raindrop') {
          p.y += p.speed;
          p.x += p.speed * p.angle;
          if (p.y > h) { p.y = -20; p.x = Math.random() * (w + 200) - 100; }
        } else if (p.type === 'snowflake') {
          p.y += p.speed;
          p.sway += p.swaySpeed;
          p.x += Math.sin(p.sway) * 0.5;
          if (p.y > h) { p.y = -10; p.x = Math.random() * w; }
        } else if (p.type === 'fog') {
          p.offsetX += p.speed;
          if (p.offsetX > w) p.offsetX = -p.width;
        }
      }
      /* Lightning */
      if (this._lightningTimer !== undefined) {
        this._lightningTimer++;
        if (this._lightningFlash > 0) {
          this._lightningFlash -= 0.05;
        } else if (this._lightningTimer > 120 + Math.random() * 300) {
          this._lightningFlash = 0.6 + Math.random() * 0.3;
          this._lightningTimer = 0;
        }
      }
    },

    _draw: function () {
      var ctx = this.ctx;
      var w = this.canvas.width;
      var h = this.canvas.height;
      ctx.clearRect(0, 0, w, h);

      for (var i = 0; i < this.particles.length; i++) {
        var p = this.particles[i];
        if (p.type === 'beam') {
          var grad = ctx.createLinearGradient(p.x, 0, p.x + p.width * Math.cos(p.angle), h);
          grad.addColorStop(0, 'rgba(255, 220, 150, 0)');
          grad.addColorStop(0.5, 'rgba(255, 220, 150, ' + p.opacity + ')');
          grad.addColorStop(1, 'rgba(255, 220, 150, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(p.x, 0);
          ctx.lineTo(p.x + p.width, 0);
          ctx.lineTo(p.x + p.width + h * Math.tan(p.angle), h);
          ctx.lineTo(p.x + h * Math.tan(p.angle), h);
          ctx.closePath();
          ctx.fill();
        } else if (p.type === 'raindrop') {
          ctx.strokeStyle = 'rgba(180, 200, 220, ' + p.opacity + ')';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.length * p.angle, p.y - p.length);
          ctx.stroke();
        } else if (p.type === 'snowflake') {
          ctx.fillStyle = 'rgba(240, 245, 255, ' + p.opacity + ')';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.type === 'fog') {
          var fogGrad = ctx.createLinearGradient(0, p.y - 60, 0, p.y + 60);
          fogGrad.addColorStop(0, 'rgba(220, 220, 230, 0)');
          fogGrad.addColorStop(0.5, 'rgba(220, 220, 230, ' + p.opacity + ')');
          fogGrad.addColorStop(1, 'rgba(220, 220, 230, 0)');
          ctx.fillStyle = fogGrad;
          ctx.fillRect(p.offsetX, p.y - 60, p.width, 120);
        }
      }

      /* Lightning flash */
      if (this._lightningFlash > 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, ' + this._lightningFlash + ')';
        ctx.fillRect(0, 0, w, h);
      }
    }
  };

  /* ==========================================
     EasterEggs：隐藏彩蛋
     ========================================== */
  var EasterEggs = {
    config: null,
    clickCounts: {},
    seq: {},          /* 连续类触发（dice_sum / ingredient_combo）的连击计数 */
    _eventsBound: false,

    init: function () {
      var self = this;
      var root = (window.Tavern && Tavern._root) || '';
      Tavern.loadJSON(root + 'data/easter_eggs.json').then(function (data) {
        self.config = data;
        self._bind();
        self.bindEventTriggers();
      }).catch(function () {});
    },

    _bind: function () {
      if (!this.config) return;
      var self = this;
      var state = (window.Tavern && Tavern._state) || {};
      var eggsFound = state.eggsFound || [];

      /* 顺手给已存在的目标加上手型光标 */
      this.config.forEach(function (egg) {
        if (egg.trigger !== 'click_count' || eggsFound.indexOf(egg.id) !== -1) return;
        var el = document.querySelector(egg.selector);
        if (el) el.style.cursor = 'pointer';
      });

      /* 点击类彩蛋统一用事件委托：地图足迹、动态渲染的卡片在初始化时还不存在，
         逐个 querySelector 绑定会漏掉它们（2026-09-13 修复） */
      document.addEventListener('click', function (e) {
        if (!e.target || !e.target.closest) return;
        var foundNow = ((window.Tavern && Tavern._state) || {}).eggsFound || [];
        self.config.forEach(function (egg) {
          if (egg.trigger !== 'click_count' || foundNow.indexOf(egg.id) !== -1) return;
          var hit = false;
          try { hit = !!e.target.closest(egg.selector); } catch (err) { hit = false; }
          if (hit) self._handleClick(egg);
        });
      });
    },

    _handleClick: function (egg) {
      var key = egg.id;
      if (!this.clickCounts[key]) this.clickCounts[key] = 0;
      this.clickCounts[key]++;

      if (egg.trigger === 'click_count' && this.clickCounts[key] >= egg.count) {
        this._trigger(egg);
      }
    },

    /* ---------- 非点击类彩蛋 ----------
       bar 页在掷骰 / 调酒结束时派发 tavern:dice / tavern:mix，
       这里按「连续」计数（与彩蛋 hint 的「连续三次」一致，中途断了归零）。 */
    bindEventTriggers: function () {
      if (this._eventsBound) return;
      this._eventsBound = true;
      var self = this;
      document.addEventListener('tavern:dice', function (e) {
        self._trackSequence('dice_sum', (e.detail || {}).sum, function (egg) { return egg.sum; });
      });
      document.addEventListener('tavern:mix', function (e) {
        self._trackSequence('ingredient_combo', (e.detail || {}).ingredients || [], function (egg) { return egg.ingredient; });
      });
    },

    _trackSequence: function (trigger, value, expected) {
      if (!this.config) return;
      var self = this;
      var found = ((window.Tavern && Tavern._state) || {}).eggsFound || [];
      this.config.forEach(function (egg) {
        if (egg.trigger !== trigger || found.indexOf(egg.id) !== -1) return;
        var want = expected(egg);
        var hit = Array.isArray(value) ? value.indexOf(want) !== -1 : value === want;
        var next = hit ? (self.seq[egg.id] || 0) + 1 : 0;
        self.seq[egg.id] = next;
        if (next >= egg.count) self._trigger(egg);
      });
    },

    _trigger: function (egg) {
      if (window.Tavern && Tavern.track) {
        Tavern.track('eggFound', { id: egg.id, fragment: egg.fragment });
      }
      /* 显示提示 */
      var hint = document.createElement('div');
      hint.className = 'egg-hint';
      hint.textContent = egg.hint;
      hint.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(20,12,8,0.9);border:1px solid rgba(214,168,93,0.3);color:#d6a85d;padding:16px 24px;border-radius:8px;z-index:9999;font-size:14px;max-width:400px;text-align:center;animation:pageFadeIn 0.5s ease;';
      document.body.appendChild(hint);
      setTimeout(function () {
        hint.style.transition = 'opacity 0.5s';
        hint.style.opacity = '0';
        setTimeout(function () { hint.remove(); }, 500);
      }, 3000);
    }
  };

  /* ==========================================
     初始化
     ========================================== */
  function init() {
    MouseTracker.init();
    ScrollTracker.init();
    DustMotes.init();
    DeviceTilt.init();
    FortuneSign.init();
    FestivalCard.init();
    WeatherLayer.init();
    EasterEggs.init();
  }

  /* DOM 就绪后启动 */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* 暴露（调试用） */
  window.TavernAmbient = {
    MouseTracker: MouseTracker,
    DozeMode: DozeMode,
    ScrollTracker: ScrollTracker,
    DustMotes: DustMotes,
    DeviceTilt: DeviceTilt,
    FortuneSign: FortuneSign,
    FestivalCard: FestivalCard,
    WeatherLayer: WeatherLayer,
    EasterEggs: EasterEggs,
    particleLevel: particleLevel
  };
})();
