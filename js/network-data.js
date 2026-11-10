/* ============================================================
   智行江畔 V12.0 —— 统一数据访问层（多网络数字孪生）
   数据总原则：全部 AI 模拟，但每个网络的数据都通过本层统一接口获取；
   接口内部当前返回模拟数据，未来把 __USE_REAL_API__ 置 true 即无缝切真实接口。
   —— 答辩亮点：接口文档必须清晰（见 文档/网络数据接口契约.md）

   规则：
   - 时间用 minutesOfDay（0-1439 整数）传入，本层不读"时分"系统时钟；
     校历/考试周依赖的"日期"用可选 refDate（默认 new Date()，可传固定值测试）
   - campus ∈ CAMPUSES（与 TWIN_MINI_MAP 的 jq/ml_{north,south} 键一致）
   - 模拟为纯函数、无 DOM、无定时器、无网络；随机量用 hashSeed/mulberry32 确定性种子
   - 分层响应：生活每次重算；教育按"时段分桶 + 日期"缓存（慢变数据不重算）
   ============================================================ */
(function () {
  'use strict';

  var CAMPUSES = ['ml_south', 'ml_north', 'jq_south', 'jq_north'];
  var CAMPUS_MAP = {
    ml_south: { campus: '麦庐园', area: '南区' },
    ml_north: { campus: '麦庐园', area: '北区' },
    jq_south: { campus: '蛟桥园', area: '南区' },
    jq_north: { campus: '蛟桥园', area: '北区' }
  };
  /* P5：校区差异参数（食堂强度/高峰时段；宿舍分布由 data.js 点位天然区分） */
  var CAMPUS_PARAMS = {
    ml_south: { canteenFactor: 1.00, lunch: 12.0, dinner: 17.5 },
    ml_north: { canteenFactor: 0.82, lunch: 11.8, dinner: 17.2 },
    jq_south: { canteenFactor: 1.06, lunch: 11.9, dinner: 17.6 },
    jq_north: { canteenFactor: 0.94, lunch: 12.1, dinner: 17.4 }
  };
  var __USE_REAL_API__ = false;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function spotsOf(campus) {
    var m = CAMPUS_MAP[campus] || CAMPUS_MAP.ml_south;
    return (window.spots || []).filter(function (s) { return s.campus === m.campus && s.area === m.area; });
  }
  function hashSeed(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function gauss(t, mu, sig) { var d = (t - mu) / sig; return Math.exp(-d * d / 2); }
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
  function netKind(sp) {
    var t = sp.type || '', n = sp.name || '', tags = (sp.tags || []).join('');
    if (t === '食堂') return 'canteen';
    if (/图书馆|图文/.test(n)) return 'library';
    if (/快递/.test(n + tags)) return 'express';
    if (t === '医疗') return 'hospital';
    if (t === '体育' || t === '场馆' || /运动场|操场|球馆/.test(n)) return 'stadium';
    if (/宿舍|公寓|寝|君来安/.test(n)) return 'dorm';
    if (/行政|办公|团委|财务|资助|学工|教务|综合楼|大活/.test(n)) return 'admin';
    return 'academic';
  }
  function tierOf(crowd) { return crowd <= 60 ? 'green' : (crowd <= 85 ? 'yellow' : 'red'); }

  /* 教育时段分桶：课表节点（8:00/12:00/14:00/17:30/19:00/21:30/22:30） */
  function eduPeriodOf(min) {
    var m = clamp(min | 0, 0, 1439);
    if (m >= 1350) return 7;   /* 22:30+ 闭馆 */
    if (m >= 1290) return 6;   /* 21:30-22:30 收尾 */
    if (m >= 1140) return 5;   /* 19:00-21:30 晚自习 */
    if (m >= 1050) return 4;   /* 17:30-19:00 晚饭 */
    if (m >= 840) return 3;    /* 14:00-17:30 下午课 */
    if (m >= 720) return 2;    /* 12:00-14:00 午休 */
    if (m >= 480) return 1;    /* 08:00-12:00 早课 */
    return 0;                  /* 06:00-08:00 闭馆 */
  }
  var EDU_OPEN = [0.02, 0.65, 0.40, 0.70, 0.30, 0.85, 0.20, 0.02];

  /* ---------- 模拟器 ---------- */
  var simulate = {
    /* 生活网络：【真实接口契约】GET /api/life?campus=ml_south&t=720 频率 30s */
    life: function (campus, minute, date) {
      var mins = clamp(minute | 0, 0, 1439);
      var day = date || new Date();
      var t = mins / 60;
      var DS = window.ZXSJ && window.ZXSJ.DataSource;
      var CP = CAMPUS_PARAMS[campus] || CAMPUS_PARAMS.ml_south;
      var spots = spotsOf(campus);
      var canteens = [], expresses = [], buildings = [];
      spots.forEach(function (sp) {
        var k = netKind(sp);
        if (k === 'canteen') {
          var P = CAMPUS_PARAMS[campus] || CAMPUS_PARAMS.ml_south;
          var rawBase = DS ? DS.getCrowd(sp.id, mins, day).level : 40;
          var base = clamp(Math.round(rawBase * P.canteenFactor + (gauss(t, P.lunch, 1.1) + gauss(t, P.dinner, 1.1)) * 16 * P.canteenFactor), 0, 100);
          var rnd = mulberry32(hashSeed(sp.id + ':win'));
          var floors = [];
          for (var f = 1; f <= 2; f++) {
            var wc = 4 + Math.floor(rnd() * 3);   /* 每层 4-6 窗 */
            var windows = [];
            for (var w = 0; w < wc; w++) {
              windows.push({ id: sp.id + ':f' + f + ':w' + w, name: f + 'F-' + (w + 1) + '号窗', crowd: clamp(Math.round(base * (0.75 + rnd() * 0.5)), 0, 100) });
            }
            floors.push({ floor: f, windows: windows });
          }
          canteens.push({ id: sp.id, name: sp.name, spotId: sp.id, crowd: base, floors: floors });
          buildings.push({ spotId: sp.id, name: sp.name, kind: 'canteen', crowd: base, color: tierOf(base) });
        } else if (k === 'express') {
          /* 取件峰 16:00~19:00、寄件峰 12:00~14:00，独立波动 */
          var weekend = day.getDay() === 0 || day.getDay() === 6;
          var pickup = clamp(Math.round((0.9 * gauss(t, CP.dinner, 1.6) + (weekend ? 0.15 : 0)) * 100), 0, 100);
          var delivery = clamp(Math.round(0.85 * gauss(t, CP.lunch + 1, 1.2) * 100), 0, 100);
          if (t < 9 || t > 20) { pickup = Math.round(pickup * 0.1); delivery = Math.round(delivery * 0.1); }
          expresses.push({ id: sp.id, name: sp.name, spotId: sp.id, pickup: pickup, delivery: delivery });
          buildings.push({ spotId: sp.id, name: sp.name, kind: 'express', crowd: Math.max(pickup, delivery), color: tierOf(Math.max(pickup, delivery)) });
        }
      });
      return { campus: campus, minute: mins, buildings: buildings, canteens: canteens, expresses: expresses };
    },
    /* 教育网络：【真实接口契约】GET /api/edu?campus=&t= 频率 30s（时段缓存） */
    edu: function (campus, minute, date) {
      var mins = clamp(minute | 0, 0, 1439);
      var day = date || new Date();
      var period = eduPeriodOf(mins);
      var openRate = EDU_OPEN[period];
      var exam = isExamWeek(day);
      var DS = window.ZXSJ && window.ZXSJ.DataSource;
      var spots = spotsOf(campus);
      var teachings = [], library = null, buildings = [];
      spots.forEach(function (sp) {
        var k = netKind(sp);
        if (k === 'academic') {
          var rnd = mulberry32(hashSeed(sp.id + ':zone'));
          var floors = [];
          for (var f = 1; f <= 3; f++) {
            var zc = 2 + Math.floor(rnd() * 2);
            var zones = [];
            for (var z = 0; z < zc; z++) {
              var total = 8;
              var open = clamp(Math.round(total * openRate * (0.8 + rnd() * 0.4)), 0, total);
              zones.push({ id: sp.id + ':f' + f + ':z' + z, name: f + 'F-' + String.fromCharCode(65 + z) + '区', open: open, total: total });
            }
            floors.push({ floor: f, zones: zones });
          }
          teachings.push({ id: sp.id, name: sp.name, spotId: sp.id, floors: floors, openRate: Math.round(openRate * 100) });
          buildings.push({ spotId: sp.id, name: sp.name, kind: 'teaching', openRate: Math.round(openRate * 100) });
        } else if (k === 'library' && !library) {
          var base = DS ? DS.getCrowd(sp.id, mins, day).level : 30;
          var rr = mulberry32(hashSeed(sp.id + ':room'));
          var rc = 4;
          var studyRooms = [];
          for (var r = 0; r < rc; r++) {
            var crowd = clamp(Math.round(base * (0.7 + rr() * 0.6)), 0, 100);
            var seats = 40 + Math.floor(rr() * 80);
            studyRooms.push({ id: sp.id + ':room' + r, name: String.fromCharCode(65 + r) + '区自习室', crowd: crowd, openSeats: Math.max(0, seats - Math.round(crowd / 100 * seats)) });
          }
          library = { id: sp.id, name: sp.name, spotId: sp.id, studyRooms: studyRooms, exam: exam };
          buildings.push({ spotId: sp.id, name: sp.name, kind: 'library', openRate: Math.round(openRate * 100) });
        }
      });
      return { campus: campus, minute: mins, period: period, exam: exam, buildings: buildings, teachings: teachings, library: library };
    },
    /* 交通/校园网/教师/风险：本期占位，P3~P4 补全 */
    /* 交通网络：【契约】GET /api/traffic?campus=&t= 频率 30s（单车位置由视图逐帧插值）
       返回 roads[a,b 停车点索引] / parkings[lng,lat] / bikes[route: [{roadId,dir}]]
       80% 闲置在停车点、20% 骑行；早晚高峰 30% 概率偏向 宿舍↔教学楼 方向 */
    traffic: function (campus, minute) {
      var mins = clamp(minute | 0, 0, 1439), t = mins / 60;
      var rnd = mulberry32(hashSeed(campus + ':traffic'));   /* 稳定种子：跨 tick 路线不跳变 */
      var net = roadNetwork(campus);
      var parkings = net.parkings, R = net.roads;
      if (!parkings.length) return { campus: campus, minute: mins, peak: false, roads: [], parkings: [], bikes: [] };
      function connected(cur) { return R.filter(function (r) { return r.a === cur || r.b === cur; }); }
      function buildRoute(start) {
        var cur = start, route = [];
        for (var step = 0; step < 5; step++) {
          var cands = connected(cur); if (!cands.length) break;
          var r = cands[Math.floor(rnd() * cands.length)];
          route.push({ roadId: r.id, dir: (r.a === cur) ? 1 : -1 });
          cur = (r.a === cur) ? r.b : r.a;
        }
        return route;
      }
      var N = 80, bikes = [], peak = (t >= 7.5 && t <= 8.5) || (t >= 17 && t <= 18.5);
      var dorms = parkings.filter(function (p) { return p.kind === 'dorm'; });
      for (var bi = 0; bi < N; bi++) {
        if (rnd() < 0.8) {
          var pk = parkings[Math.floor(rnd() * parkings.length)]; pk.bikes++;
          bikes.push({ id: 'b' + bi, status: 'idle', parkingId: pk.id, route: null, routeIdx: 0, t: 0, speed: 0, waitUntil: 0 });
        } else {
          var start = Math.floor(rnd() * parkings.length);
          /* 早晚高峰 30% 概率从宿舍区发车（偏向宿舍→教学楼车流） */
          if (peak && dorms.length && rnd() < 0.3) start = parkings.indexOf(dorms[Math.floor(rnd() * dorms.length)]);
          var route2 = buildRoute(start);
          var lowbat = rnd() < 0.1;
          bikes.push({ id: 'b' + bi, status: lowbat ? 'lowbat' : 'riding', parkingId: null, route: route2, routeIdx: 0, t: rnd(), speed: (lowbat ? 0.03 : 0.06) + rnd() * 0.06, waitUntil: 0, waitProb: 0.3, waitMs: 5000 + rnd() * 5000 });
        }
      }
      return { campus: campus, minute: mins, peak: peak, roads: R, parkings: parkings, bikes: bikes };
    },
    /* 校园网网络：【契约】GET /api/wifi?campus=&t= → { buildings:[{spotId,density,occupancy}] } 频率 30s */
    wifi: function (campus, minute) {
      var mins = clamp(minute | 0, 0, 1439), t = mins / 60;
      var spots = spotsOf(campus);
      var buildings = spots.map(function (sp) {
        var k = netKind(sp), base = 40;
        if (k === 'canteen') base = 60 * (gauss(t, 12, 1.2) + gauss(t, 17.5, 1.2));
        else if (k === 'library') base = 50 + 40 * gauss(t, 19, 3);
        else if (k === 'dorm') base = 25 + 55 * gauss(t, 21, 2.5) + 25 * gauss(t, 8, 2);
        else if (k === 'academic') base = 30 + 60 * (gauss(t, 10, 2) + gauss(t, 15, 2));
        else if (k === 'admin') base = 20 + 50 * gauss(t, 10, 3);
        else base = 30 + 30 * gauss(t, 18, 3);
        if (t < 6 || t > 23) base *= 0.15;
        var density = clamp(Math.round(base), 0, 100);
        var occupancy = clamp(Math.round(density * 0.8 + (hashSeed(sp.id) % 20)), 0, 100);
        return { spotId: sp.id, name: sp.name, lng: sp.lng, lat: sp.lat, density: density, occupancy: occupancy };
      });
      return { campus: campus, minute: mins, buildings: buildings };
    },
    /* 教师网络：【契约】GET /api/teachers?campus=&t= 频率 30s
       teachers[{spotId,name,status:'free'|'busy'}] 按课表反推；courses[{spotId,floor,window,name,type,color,start,end}] */
    teachers: function (campus, minute) {
      var mins = clamp(minute | 0, 0, 1439), t = mins / 60;
      var spots = spotsOf(campus);
      var rnd = mulberry32(hashSeed(campus + ':teachers'));
      var COURSE_COLORS = { '正课': '#FF2E63', '实验': '#08D9D6', '讲座': '#F9ED69', '自习': '#6BCB77', '体育': '#F9ED69', '美育': '#08D9D6' };
      var COURSE_TYPES = ['正课', '实验', '讲座', '自习', '体育', '美育'];
      var teachers = [], courses = [];
      spots.forEach(function (sp) {
        var k = netKind(sp);
        if (k !== 'academic' && k !== 'library' && k !== 'admin') return;
        var n = 1 + Math.floor(rnd() * 3);
        var inClass = (t >= 8 && t < 12) || (t >= 14 && t < 17.5) || (t >= 19 && t < 21.5);
        for (var i = 0; i < n; i++) {
          var busy = inClass && rnd() < 0.6;
          teachers.push({ spotId: sp.id, name: sp.name + ' · 教师' + (i + 1), status: busy ? 'busy' : 'free', freeAt: busy ? null : mins });
        }
        var winN = k === 'academic' ? 6 : 3;
        for (var w = 0; w < winN; w++) {
          var type = COURSE_TYPES[Math.floor(rnd() * COURSE_TYPES.length)];
          var t0 = 8 + Math.floor(rnd() * 10);
          courses.push({ spotId: sp.id, floor: 1 + Math.floor(rnd() * 3), window: w, name: type + '课 · ' + (1 + Math.floor(rnd() * 6)) + ' 班', type: type, color: COURSE_COLORS[type], start: t0, end: t0 + 1 + Math.floor(rnd() * 2) });
        }
      });
      return { campus: campus, minute: mins, teachers: teachers, courses: courses };
    },
    /* 应急风险预测：【契约】GET /api/risk?campus=&t= 综合各网络异常评分 */
    risk: function (campus, minute) {
      var mins = clamp(minute | 0, 0, 1439);
      var items = [], maxScore = 0;
      try {
        var life = simulate.life(campus, mins);
        (life.buildings || []).forEach(function (b) {
          var s = 0, reasons = [];
          if (b.crowd > 90) { s += 40; reasons.push('拥挤度 ' + b.crowd + '%'); }
          if (b.crowd > 95) { s += 20; reasons.push('持续高位'); }
          if (s > 0) { items.push({ spotId: b.spotId, name: b.name, kind: 'life', score: Math.min(100, s), reasons: reasons }); }
        });
        var wifi = simulate.wifi(campus, mins);
        (wifi.buildings || []).forEach(function (b) {
          if (b.density > 90) items.push({ spotId: b.spotId, name: b.name, kind: 'wifi', score: b.density, reasons: ['网络密度 ' + b.density + '%'] });
        });
      } catch (e) {}
      items.forEach(function (x) { if (x.score > maxScore) maxScore = x.score; });
      return { campus: campus, minute: mins, score: maxScore, items: items };
    },
    /* 人流色带：【契约】GET /api/flow?campus=&t= 沿路网密度 0~100（复用路网） */
    flow: function (campus, minute) {
      var mins = clamp(minute | 0, 0, 1439), t = mins / 60;
      var net = roadNetwork(campus);
      var life = simulate.life(campus, mins);
      var peak = (t >= 7.5 && t <= 8.5) || (t >= 17 && t <= 18.5);
      var roads = net.roads.map(function (r) {
        var a = net.parkings[r.a], b = net.parkings[r.b], ca = 0, cb = 0;
        (life.buildings || []).forEach(function (bd) { if (bd.spotId === a.spotId) ca = bd.crowd; if (bd.spotId === b.spotId) cb = bd.crowd; });
        var base = (ca + cb) / 2;
        var density = clamp(Math.round(base * (peak ? 1.25 : 1)), 5, 100);
        return { id: r.id, lngA: a.lng, latA: a.lat, lngB: b.lng, latB: b.lat, spotA: a.spotId, spotB: b.spotId, density: density };
      });
      return { campus: campus, minute: mins, roads: roads };
    },
  };

  /* 教育缓存（分层响应：时段 + 日期 未变则复用，慢变不重算） */
  var eduCache = null;
  function getEduCached(campus, minute) {
    var c = CAMPUS_MAP[campus] ? campus : 'ml_south';
    var t = clamp(minute | 0, 0, 1439);
    var d = new Date();
    var key = c + '|' + d.toDateString() + '|' + eduPeriodOf(t);
    if (eduCache && eduCache.key === key) return eduCache.result;
    eduCache = { key: key, result: simulate.edu(c, t, d) };
    return eduCache.result;
  }

  /* 路网生成（traffic / flow 共用，确定性、无随机） */
  function roadNetwork(campus) {
    var spots = spotsOf(campus);
    var pkSpots = spots.filter(function (sp) { var k = netKind(sp); return k === 'dorm' || k === 'admin' || k === 'canteen'; });
    if (pkSpots.length < 8) pkSpots = spots.slice(0, 10);
    var parkings = pkSpots.slice(0, 12).map(function (sp, i) {
      return { id: 'pk' + i, spotId: sp.id, name: sp.name, kind: netKind(sp), lng: sp.lng, lat: sp.lat, capacity: 24, bikes: 0 };
    });
    if (!parkings.length) return { parkings: [], roads: [] };
    var R = [];
    parkings.forEach(function (p, i) {
      var ds = parkings.map(function (q, j) { return { j: j, d: (q.lng - p.lng) * (q.lng - p.lng) + (q.lat - p.lat) * (q.lat - p.lat) }; })
        .filter(function (x) { return x.j !== i; }).sort(function (a, b) { return a.d - b.d; }).slice(0, 3);
      ds.forEach(function (x) {
        var a = Math.min(i, x.j), b = Math.max(i, x.j);
        if (!R.some(function (r) { return r.a === a && r.b === b; })) R.push({ id: 'rd' + R.length, a: a, b: b });
      });
    });
    if (R.length > 26) R = R.slice(0, 26);
    return { parkings: parkings, roads: R };
  }

  /* ---------- 统一路由 ---------- */
  function route(net, campus, minute) {
    var c = CAMPUS_MAP[campus] ? campus : 'ml_south';
    var t = clamp(minute | 0, 0, 1439);
    if (__USE_REAL_API__) return fetch('/api/' + net + '?campus=' + encodeURIComponent(c) + '&t=' + t).then(function (r) { return r.json(); });
    if (net === 'edu') return Promise.resolve(getEduCached(c, t));
    return Promise.resolve(simulate[net](c, t));
  }

  var NetworkData = {
    CAMPUSES: CAMPUSES,
    CAMPUS_MAP: CAMPUS_MAP,
    spotsOf: spotsOf,
    netKind: netKind,
    eduPeriodOf: eduPeriodOf,
    __USE_REAL_API__: __USE_REAL_API__,
    getLife: function (campus, minute) { return route('life', campus, minute); },
    getEdu: function (campus, minute) { return route('edu', campus, minute); },
    getTraffic: function (campus, minute) { return route('traffic', campus, minute); },
    getWifi: function (campus, minute) { return route('wifi', campus, minute); },
    getTeachers: function (campus, minute) { return route('teachers', campus, minute); },
    getRisk: function (campus, minute) { return route('risk', campus, minute); },
    getFlow: function (campus, minute) { return route('flow', campus, minute); }
  };

  window.NetworkData = NetworkData;
  window.ZXSJ = window.ZXSJ || {};
  window.ZXSJ.NetworkData = NetworkData;
})();
