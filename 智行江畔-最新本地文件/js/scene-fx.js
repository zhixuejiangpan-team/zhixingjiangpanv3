/* ============================================================
   智行江畔 V9.0 —— 演示天气场景引擎（Scene FX）
   - 孪生顶栏 [实时天气 / 晴空 / 雨夜 / 雪天] 按钮组，持久化 zxsj66_demo_scene
   - 雨夜：雨丝 ≤50/画布 + 随机闪电（prefers-reduced-motion 下禁用）
   - 雪天：雪花 ≤80/画布 + 积雪层 1.5s lerp 淡入
   - 主地图同步叠加 canvas2d 粒子层（pointer-events:none，不影响任何交互）
   - 全部粒子由本模块唯一 RAF 驱动（孪生卡片 + 主地图共用同一循环）
   场景切换广播 'zxsj66:scene-change'，孪生/3D 查看器同步读取。
   ============================================================ */
(function () {
  'use strict';
  var W = window;
  var KEY = 'zxsj66_demo_scene';
  var SCENES = ['live', 'sunny', 'rain', 'snow'];
  var scene = 'live';
  try { var saved = localStorage.getItem(KEY); if (SCENES.indexOf(saved) !== -1) scene = saved; } catch (e) {}

  var RM = false;
  try { RM = !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}
  var LOWEND = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  var MOBILE = false;
  try { MOBILE = W.matchMedia && W.matchMedia('(max-width: 768px)').matches; } catch (e) {}

  var raf = null, running = false;
  var cardLayers = [];          /* 孪生卡片粒子层（≤4 张） */
  var mapLayer = null;          /* 主地图粒子层 */
  var flashEl = null;           /* 闪电层（孪生段） */
  var lastFlash = 0, nextFlash = 4200;
  var twinActive = false, mapActive = false;

  /* ---------- 有效天气（场景覆盖实时数据） ---------- */
  function weather() {
    if (scene === 'sunny') return { condition: 'sunny', temp: 22 };
    if (scene === 'rain') return { condition: 'rain', temp: 12 };
    if (scene === 'snow') return { condition: 'snow', temp: -2 };
    return (W.ZXSJ && W.ZXSJ.DataSource) ? W.ZXSJ.DataSource.getWeather() : { condition: 'sunny', temp: 20 };
  }
  function label() {
    return { live: '实时天气', sunny: '晴空', rain: '雨夜', snow: '雪天' }[scene] || scene;
  }
  function isNightMin() {
    if (scene === 'rain') return true;                 /* 雨夜固定夜景 */
    var d = new Date(); return d.getHours() < 7 || d.getHours() >= 19;
  }
  function nightOverlay() { return scene === 'rain'; }

  /* ---------- 粒子画布 ---------- */
  function makeLayer(cv, host, kind, max) {
    var parts = [];
    for (var i = 0; i < max; i++) {
      parts.push({
        x: Math.random(), y: Math.random(),
        v: kind === 'rain' ? 0.014 + Math.random() * 0.012 : 0.004 + Math.random() * 0.006,
        drift: Math.random() * Math.PI * 2,
        size: kind === 'rain' ? 0 : 0.8 + Math.random() * 1.6,
        a: 0.2 + Math.random() * 0.35
      });
    }
    return { cv: cv, host: host, kind: kind, parts: parts, ctx: cv.getContext('2d'), max: max };
  }
  function drawLayer(L) {
    var cv = L.cv, w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    var ctx = L.ctx;
    ctx.clearRect(0, 0, w, h);
    if (L.kind === 'rain') {
      L.parts.forEach(function (p) {
        p.y += p.v; p.splash = Math.max(0, (p.splash || 0) - 0.09);
        if (p.y > 1.02) { p.y = -0.04; p.x = Math.random(); p.splash = 1; }
        var x = p.x * w, y = p.y * h;
        ctx.save(); ctx.translate(x, y); ctx.rotate(-0.22); ctx.globalAlpha = p.a + 0.25;
        ctx.fillStyle = 'rgba(150,190,255,0.42)'; ctx.strokeStyle = 'rgba(43,38,32,0.48)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-1, -5); ctx.lineTo(1.4, -4); ctx.lineTo(1, 6); ctx.lineTo(-1.3, 5); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
        if (p.splash > 0) { ctx.globalAlpha = p.splash * 0.45; ctx.fillStyle = '#2B2620'; ctx.beginPath(); ctx.ellipse(x, h - 3, 2.5 + (1 - p.splash) * 4, 1.3, 0, 0, Math.PI * 2); ctx.fill(); }
      });
      ctx.globalAlpha = 1;
    } else {
      /* 六角纸雪花：漂移 + 下落 */
      L.parts.forEach(function (p) {
        p.drift += 0.02;
        p.x += Math.sin(p.drift) * 0.0016;
        p.y += p.v; if (p.y > 1.05) { p.y = -0.05; p.x = Math.random(); }
        ctx.save(); ctx.translate(p.x * w, p.y * h); ctx.rotate(p.drift * 0.3); ctx.globalAlpha = p.a + 0.25;
        ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.strokeStyle = 'rgba(43,38,32,0.28)'; ctx.lineWidth = 0.7; ctx.beginPath();
        for (var si = 0; si < 12; si++) { var sr = si % 2 ? p.size * 0.42 : p.size * 1.65, sa = si / 12 * Math.PI * 2; ctx.lineTo(Math.cos(sa) * sr, Math.sin(sa) * sr); }
        ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      });
      ctx.globalAlpha = 1;
    }
  }

  /* ---------- 目标画布挂载 ---------- */
  function ensureCardCanvas(card) {
    var cv = card.querySelector('.fx-canvas');
    if (!cv) {
      cv = document.createElement('canvas');
      cv.className = 'fx-canvas';
      card.appendChild(cv);
    }
    return cv;
  }
  function visibleCards() {
    var cards = document.querySelectorAll('#twinCards .twin-card');
    return Array.prototype.filter.call(cards, function (c) { return c._inView !== false; });
  }
  function ensureMapCanvas() {
    var wrap = document.querySelector('.map-wrap');
    if (!wrap) return null;
    var cv = wrap.querySelector('.fx-overlay');
    if (!cv) {
      cv = document.createElement('canvas');
      cv.className = 'fx-overlay';
      wrap.appendChild(cv);
    }
    return cv;
  }
  function ensureFlash() {
    if (flashEl || RM) return;
    var host = document.getElementById('sec-twin');
    if (!host) return;
    flashEl = document.createElement('div');
    flashEl.className = 'fx-lightning';
    flashEl.innerHTML = '<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMin slice" aria-hidden="true"><path d="M58 -4 L43 31 L57 29 L35 72 L45 45 L31 48 L48 14 L38 16 Z" fill="#FEFBF6" stroke="#2B2620" stroke-width="1.2" stroke-linejoin="round"/></svg>';
    host.appendChild(flashEl);
  }

  /* ---------- 积雪层（1.5s lerp） ---------- */
  function syncSnowCap() {
    var on = scene === 'snow';
    document.querySelectorAll('#twinCards .twin-card').forEach(function (card) {
      var el = card.querySelector('.fx-snowcap');
      if (!el) {
        el = document.createElement('div');
        el.className = 'fx-snowcap';
        el.style.opacity = '0';
        card.appendChild(el);
      }
      el.style.transition = 'opacity 1.5s var(--ease, ease)';
      el.style.opacity = on ? '0.45' : '0';
    });
    /* 主地图不加积雪层：避免压住高德 logo/版权（合规底线，粒子层不影响） */
  }

  /* ---------- 场景应用 ---------- */
  function effectiveScene() {
    if (scene === 'rain' || scene === 'snow') return scene;
    if (scene === 'live') {
      var w = (W.ZXSJ && W.ZXSJ.DataSource) ? W.ZXSJ.DataSource.getWeather() : null;
      if (w && (w.condition === 'rain' || w.condition === 'snow')) return w.condition;
    }
    return 'none';
  }
  function teardownLayers() {
    cardLayers.forEach(function (L) { if (L.cv) L.cv.remove(); });
    cardLayers = [];
    if (mapLayer && mapLayer.cv) { mapLayer.cv.remove(); }
    mapLayer = null;
    if (flashEl) { flashEl.remove(); flashEl = null; }
  }
  function rebuild() {
    teardownLayers();
    var kind = effectiveScene();
    var needParticles = (kind === 'rain' || kind === 'snow') && !LOWEND && !RM;
    if (!needParticles) { syncSnowCap(); stopLoop(); syncButtons(); return; }
    var cap = kind === 'rain' ? 50 : 80;
    if (MOBILE) cap = Math.ceil(cap / 2);          /* 移动端粒子减半 */
    if (twinActive) {
      visibleCards().forEach(function (card) {
        var cv = ensureCardCanvas(card);
        cardLayers.push(makeLayer(cv, card, kind, cap));
      });
    }
    if (mapActive) {
      var mcv = ensureMapCanvas();
      if (mcv) mapLayer = makeLayer(mcv, mcv.parentNode, kind, cap);
    }
    if (scene === 'rain' && twinActive) ensureFlash();   /* 闪电仅演示雨夜场景 */
    syncSnowCap();
    startLoop();
    syncButtons();
  }
  function apply() {
    rebuild();
    try { W.dispatchEvent(new CustomEvent('zxsj66:scene-change', { detail: { scene: scene } })); } catch (e) {}
  }
  function set(k) {
    if (SCENES.indexOf(k) === -1) k = 'live';
    scene = k;
    try { localStorage.setItem(KEY, k); } catch (e) {}
    apply();
  }

  /* ---------- 唯一 RAF ---------- */
  function loop(now) {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    var active = false;
    cardLayers.forEach(function (L) { if (L.host._inView !== false) { drawLayer(L); active = true; } });
    if (mapLayer) { drawLayer(mapLayer); active = true; }
    /* 闪电：随机间隔，单次 220ms，RM 下禁用 */
    if (scene === 'rain' && flashEl && !RM) {
      if (now - lastFlash > nextFlash) {
        lastFlash = now;
        nextFlash = 3200 + Math.random() * 5200;
        flashEl.classList.remove('flash');
        void flashEl.offsetWidth;
        flashEl.classList.add('flash');
        setTimeout(function () { if (flashEl) flashEl.classList.remove('flash'); }, 220);
      }
    }
    var keepAlive = scene === 'rain' && twinActive && !!flashEl;   /* 雨夜闪电保活 */
    if (!active && !keepAlive) stopLoop();
  }
  function startLoop() {
    if (raf) return;
    running = true;
    raf = requestAnimationFrame(loop);
  }
  function stopLoop() {
    running = false;
    if (raf) { cancelAnimationFrame(raf); raf = null; }
  }

  /* ---------- 活跃区开关（段落挂起/恢复联动） ---------- */
  function setTwinActive(on) {
    twinActive = on;
    rebuild();
  }
  function setMapActive(on) {
    mapActive = on;
    rebuild();
  }

  /* ---------- 按钮组 ---------- */
  function syncButtons() {
    var box = document.getElementById('twinScene');
    if (!box) return;
    box.querySelectorAll('button[data-scene]').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-scene') === scene);
    });
  }
  function bindButtons() {
    var box = document.getElementById('twinScene');
    if (!box) return;
    box.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-scene]');
      if (!b) return;
      set(b.getAttribute('data-scene'));
    });
    syncButtons();
  }

  W.ZXSJ = W.ZXSJ || {};
  W.ZXSJ.Scene = {
    get: function () { return scene; },
    set: set,
    weather: weather,
    label: label,
    isNightMin: isNightMin,
    nightOverlay: nightOverlay,
    refresh: rebuild,
    setTwinActive: setTwinActive,
    setMapActive: setMapActive,
    syncButtons: syncButtons
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindButtons);
  else bindButtons();
})();
