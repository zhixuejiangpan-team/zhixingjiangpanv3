/* ============================================================
   智行江畔 V7.3 —— 数据源层（模块零，最高优先级）
   职责：
   1) 纯函数状态引擎 ZXSJ.calculateCrowd(spotId, minutesOfDay, refDate)
      —— 禁止内部读取系统时间，时间参数全站统一 minutesOfDay（0-1439 整数）
   2) 双源策略：localStorage 'zxsj66_realdata' 存在实测数据时优先返回 real，
      否则走 simulation；监听 'zxsj66:import-data' 事件热切换，零刷新
   3) 学校文件热更新：spot.docUrl / spot.docUpdateTime + 未读红点
      （zxsj66_doc_seen_<id>），运行时更新经 ZXSJ.updateSchoolDocs 校验后
      持久化到 'zxsj66_docs'
   4) 天气：和风/高德 Web 服务 Key（与 JS API Key 不同，需单独申请），
      30 分钟缓存 'zxsj66_weather'；未配置 Key 时优雅降级为晴天
   ============================================================ */
(function () {
  'use strict';
  window.ZXSJ = window.ZXSJ || {};

  var LS_REAL = 'zxsj66_realdata';
  var LS_DOCS = 'zxsj66_docs';
  var LS_DOC_SEEN = 'zxsj66_doc_seen_';
  var LS_WEATHER = 'zxsj66_weather';

  function lsGet(k, def) { try { var v = localStorage.getItem(k); return v === null ? def : JSON.parse(v); } catch (e) { return def; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  /* ---------- 点位查找 ---------- */
  function findSpot(id) {
    var all = (window.spots || []).concat(window.surroundingSpots || []);
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }

  /* ---------- 纯函数模拟引擎（自 V6.9 状态引擎原样迁移，曲线参数不变） ---------- */
  function gauss(t, mu, sig) { var d = (t - mu) / sig; return Math.exp(-d * d / 2); }
  function kindOf(sp) {
    var t = sp.type || '', n = sp.name || '', tags = (sp.tags || []).join('');
    if (t === '食堂') return 'canteen';
    if (/图书馆|图文/.test(n)) return 'library';
    if (/快递/.test(n + tags)) return 'express';
    if (t === '医疗') return 'clinic';
    return 'gym';
  }
  function isExamWeek(date) {
    try {
      var nodes = (window.calendarData && window.calendarData.nodes) || [];
      var now = date.getTime();
      for (var i = 0; i < nodes.length; i++) {
        if (!/考试|院考|校考/.test(nodes[i].title)) continue;
        var t0 = new Date(nodes[i].date).getTime();
        if (Math.abs(now - t0) < 14 * 86400000) return true;
      }
    } catch (e) {}
    return false;
  }
  /* 容量表：实测数据 count → 拥挤度百分比时复用同一容量口径 */
  function capacityOf(sp) {
    var kind = kindOf(sp);
    if (kind === 'canteen') return 150 + ((sp.tags && sp.tags.length) || 2) * 30;
    if (kind === 'library') return 800;
    if (kind === 'express') return 300;
    if (kind === 'clinic') return 80;
    return 200;
  }
  /* calculateCrowd(spotOrId, minutesOfDay, refDate) —— 纯函数，不读系统时间。
     refDate 缺省时按"非周末、非考试周"的确定性日期计算（保证可测试）。 */
  function calculateCrowd(spotOrId, minutesOfDay, refDate) {
    var sp = typeof spotOrId === 'string' ? findSpot(spotOrId) : spotOrId;
    if (!sp) return { p: 0.02, n: 0, cap: 100, level: 'green', kind: 'gym' };
    var date = refDate || new Date(2026, 9, 14);   /* 2026-10-14 周三，固定参考日 */
    var t = Math.max(0, Math.min(1439, minutesOfDay | 0)) / 60;   /* 小时（浮点） */
    var day = date.getDay(), weekend = (day === 0 || day === 6), kind = kindOf(sp);
    var p = 0.2, cap = capacityOf(sp);
    if (kind === 'canteen') {
      p = 0.55 * gauss(t, 7.5, 1) + 1 * gauss(t, 12, 1.1) + 0.8 * gauss(t, 17.5, 1.1);
      if (t < 6 || t > 21) p = 0.02;
    } else if (kind === 'library') {
      p = (t < 8 || t > 22.5) ? 0.02 : (0.35 + 0.5 * gauss(t, 19, 3));
      if (isExamWeek(date)) p = Math.min(1, p * 1.4);   /* 考试周加成 40% */
      if (t >= 22.5) p = 0;                              /* 22:30 闭馆归零 */
    } else if (kind === 'express') {
      p = 0.9 * gauss(t, 17, 1.6);
      if (weekend) p = Math.min(1, p * 1.25);
      if (t < 9 || t > 20) p = 0.03;
    } else if (kind === 'clinic') {
      p = 0.5 * gauss(t, 10, 2) + 0.6 * gauss(t, 15.5, 2);
      if (t < 8 || t > 17.5) p = 0.03;
    } else {
      p = (t < 7 || t > 21) ? 0.05 : (0.3 + 0.45 * gauss(t, 18, 2.5));
    }
    p = Math.max(0.02, Math.min(1, p));
    return { p: p, n: Math.round(p * cap), cap: cap, level: p <= 0.6 ? 'green' : (p <= 0.85 ? 'yellow' : 'red'), kind: kind };
  }
  /* 闭馆判定（与 calculateCrowd 的小时规则一致，预测强制归零用） */
  function isClosed(kind, tH) {
    if (kind === 'canteen') return tH < 6 || tH > 21;
    if (kind === 'library') return tH >= 22.5;
    if (kind === 'express') return tH < 9 || tH > 20;
    if (kind === 'clinic') return tH < 8 || tH > 17.5;
    return tH < 7 || tH > 21;
  }

  /* ---------- 实测数据（导入格式 [{spotId, date, timeSlot, count}]） ---------- */
  var realCache = null;   /* { spotId: [ {mins, count, date} … ] } 按时间升序 */
  function parseSlot(ts) {
    if (typeof ts === 'number') return ts | 0;
    var m = /^(\d{1,2}):(\d{2})/.exec(String(ts || ''));
    return m ? (+m[1]) * 60 + (+m[2]) : -1;
  }
  function realData() {
    if (realCache) return realCache;
    realCache = {};
    var arr = lsGet(LS_REAL, []);
    if (!Array.isArray(arr)) return realCache;
    arr.forEach(function (r) {
      if (!r || !r.spotId) return;
      var mins = parseSlot(r.timeSlot);
      if (mins < 0 || typeof r.count !== 'number') return;
      (realCache[r.spotId] = realCache[r.spotId] || []).push({ mins: mins, count: r.count, date: r.date || '' });
    });
    Object.keys(realCache).forEach(function (id) {
      realCache[id].sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.mins - b.mins; });
    });
    return realCache;
  }
  function isRealData(spotId) { return !!realData()[spotId]; }
  /* 实测命中规则：取最新日期、与 minutesOfDay 相差 ≤45 分钟的最近记录 */
  function realLookup(spotId, minutesOfDay) {
    var recs = realData()[spotId];
    if (!recs || !recs.length) return null;
    var maxDate = recs[recs.length - 1].date, best = null, bestDiff = 46;
    for (var i = recs.length - 1; i >= 0; i--) {
      if (recs[i].date !== maxDate) break;
      var d = Math.abs(recs[i].mins - minutesOfDay);
      if (d < bestDiff) { bestDiff = d; best = recs[i]; }
    }
    return best;
  }
  /* 数据导入热切换：清空缓存，全站下一次读取即用新数据 */
  window.addEventListener('zxsj66:import-data', function () { realCache = null; });

  /* ---------- DataSource 命名空间 ---------- */
  var DataSource = {
    /* getCrowd(spotId, minutesOfDay, refDate) →
       { level: 0-100 拥挤度百分比, color: 'green|yellow|red', source: 'simulation|real', n, cap, kind } */
    getCrowd: function (spotId, minutesOfDay, refDate) {
      var sp = findSpot(spotId);
      if (!sp) return { level: 0, color: 'green', source: 'simulation', n: 0, cap: 100, kind: 'gym' };
      var rec = realLookup(spotId, minutesOfDay | 0);
      if (rec) {
        var cap = capacityOf(sp);
        var pct = Math.max(0, Math.min(100, Math.round(rec.count / cap * 100)));
        return { level: pct, color: pct <= 60 ? 'green' : (pct <= 85 ? 'yellow' : 'red'), source: 'real', n: rec.count, cap: cap, kind: kindOf(sp) };
      }
      var s = calculateCrowd(sp, minutesOfDay, refDate);
      return { level: Math.round(s.p * 100), color: s.level, source: 'simulation', n: s.n, cap: s.cap, kind: s.kind };
    },
    /* 天气：同步读缓存（30 分钟过期）；未配置 Key 时降级为晴天 */
    getWeather: function () {
      var c = lsGet(LS_WEATHER, null);
      if (c && c.ts && (Date.now() - c.ts) < 30 * 60000) return { condition: c.condition, temp: c.temp };
      return { condition: 'sunny', temp: 20 };
    },
    /* 异步刷新天气（高德 Web 服务 / 和风，Key 需单独申请，与 JS API Key 不同） */
    refreshWeather: function () {
      var cfg = window.WEATHER_CONFIG || {};
      if (!cfg.KEY) return Promise.resolve(DataSource.getWeather());   /* 未配置：静默降级晴天 */
      var url = cfg.PROVIDER === 'qweather'
        ? 'https://devapi.qweather.com/v7/weather/now?location=101240101&key=' + encodeURIComponent(cfg.KEY)
        : 'https://restapi.amap.com/v3/weather/weatherInfo?key=' + encodeURIComponent(cfg.KEY) + '&city=360100';
      return fetch(url).then(function (r) { return r.json(); }).then(function (j) {
        var text = '', temp = 20;
        if (cfg.PROVIDER === 'qweather' && j.now) { text = j.now.text || ''; temp = +j.now.temp || 20; }
        else if (j.lives && j.lives[0]) { text = j.lives[0].weather || ''; temp = +j.lives[0].temperature || 20; }
        var cond = /雨/.test(text) ? 'rain' : (/雪/.test(text) ? 'snow' : 'sunny');
        lsSet(LS_WEATHER, { condition: cond, temp: temp, ts: Date.now(), text: text });
        return { condition: cond, temp: temp };
      }).catch(function () { return DataSource.getWeather(); });
    },
    /* 学校正式文件热更新：读取 spot.docUrl / docUpdateTime（含运行时覆盖层） */
    getSpotFile: function (spotId) {
      var sp = findSpot(spotId);
      if (!sp || !sp.docUrl) return null;
      return { pdfUrl: sp.docUrl, updateTime: sp.docUpdateTime || '' };
    },
    isRealData: isRealData,
    /* 未读红点：docUpdateTime 晚于已见时间（ISO 字符串字典序可比） */
    hasUnreadDoc: function (spotId) {
      var f = DataSource.getSpotFile(spotId);
      if (!f || !f.updateTime) return false;
      var seen = null;
      try { seen = localStorage.getItem(LS_DOC_SEEN + spotId); } catch (e) {}
      return !seen || f.updateTime > seen;
    },
    markDocSeen: function (spotId) {
      var f = DataSource.getSpotFile(spotId);
      try { localStorage.setItem(LS_DOC_SEEN + spotId, f ? f.updateTime : new Date().toISOString()); } catch (e) {}
    },
    /* 运行时更新学校文件：https + ISO 日期双重校验，持久化覆盖层 */
    updateSchoolDocs: function (spotId, newUrl, newTime) {
      if (!/^https:\/\//.test(String(newUrl || ''))) return { ok: false, err: 'docUrl 必须以 https:// 开头' };
      if (!/^\d{4}-\d{2}-\d{2}/.test(String(newTime || '')) || isNaN(new Date(newTime).getTime())) return { ok: false, err: 'docUpdateTime 须为 ISO 日期格式' };
      var sp = findSpot(spotId);
      if (!sp) return { ok: false, err: '点位不存在：' + spotId };
      sp.docUrl = newUrl; sp.docUpdateTime = newTime;
      var overlay = lsGet(LS_DOCS, {});
      overlay[spotId] = { docUrl: newUrl, docUpdateTime: newTime };
      lsSet(LS_DOCS, overlay);
      return { ok: true };
    },
    importRealData: function (arr) {
      if (!Array.isArray(arr)) return { ok: false, err: '格式须为 JSON 数组' };
      var valid = arr.filter(function (r) { return r && r.spotId && typeof r.count === 'number' && parseSlot(r.timeSlot) >= 0; });
      if (!valid.length) return { ok: false, err: '无有效记录（需含 spotId/timeSlot/count）' };
      lsSet(LS_REAL, valid);
      realCache = null;
      window.dispatchEvent(new CustomEvent('zxsj66:import-data', { detail: { count: valid.length } }));
      return { ok: true, count: valid.length };
    },
    clearRealData: function () {
      try { localStorage.removeItem(LS_REAL); } catch (e) {}
      realCache = null;
      window.dispatchEvent(new CustomEvent('zxsj66:import-data', { detail: { count: 0 } }));
    },
    realCount: function () { return lsGet(LS_REAL, []).length; }
  };
  ZXSJ.DataSource = DataSource;
  ZXSJ.calculateCrowd = calculateCrowd;
  ZXSJ.isClosed = isClosed;
  ZXSJ.capacityOf = capacityOf;
  ZXSJ.updateSchoolDocs = DataSource.updateSchoolDocs;

  /* 启动：合并运行时文档覆盖层到点位（热更新持久化生效） */
  (function mergeDocOverlay() {
    var overlay = lsGet(LS_DOCS, {});
    Object.keys(overlay).forEach(function (id) {
      var sp = findSpot(id);
      if (sp) { sp.docUrl = overlay[id].docUrl; sp.docUpdateTime = overlay[id].docUpdateTime; }
    });
  })();
  /* 启动：后台刷新天气（未配置 Key 时立即返回晴天，零网络请求） */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { DataSource.refreshWeather(); });
  } else { DataSource.refreshWeather(); }
})();
