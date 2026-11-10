/* ============================================================
   智行江畔 V12.0 —— 多栋总览场景管理器（P1 骨架）
   - 45° 俯瞰（OrbitControls polar 30°~60°）+ 程序化 Canvas 地形
   - 麦庐南 13~15 栋低模（≤800 三角形/栋，主体+屋顶+窗户墨线描边）
   - 旗帜系统（拥挤度三档、顶点飘动、depthTest false）+ 人数数字 Sprite
   - 单击飞入单栋（完整 BUILDERS + 碎片聚合 + 环绕）、其余建筑碎片散场
   - 长按详情卡、返回/ESC
   - 数据全部来自 window.NetworkData；单一渲染循环；DPR≤2；spotId 确定性
   依赖：window.Twin3D.kit（twin3d.js 导出）、window.NetworkData
   ============================================================ */
(function () {
  'use strict';
  if (typeof THREE === 'undefined' || !window.Twin3D || !window.Twin3D.kit) { window.TwinOverview = { available: function () { return false; } }; return; }
  var K = window.Twin3D.kit;
  var host = null, renderer = null, scene = null, camera = null, controls = null;
  var rafId = null, mounted = false, active = false, disposed = false;
  var LOWEND = false, REDUCED = false;
  var campus = 'ml_south';
  var buildings = [];          /* { spotId, name, kind, group, x, z, topY, crowd, color, flag, num, target } */
  var terrain = null, terrainTex = null;
  var gmap5 = null, paperTex = null;
  var mode = 'overview';       /* 'overview' | 'flying' | 'single' */
  var focusB = null;
  var camTween = null, orbitShards = [], burstGroups = [];
  var ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  var pressT0 = 0, pressB = null, pressed = false;
  var key = { d: new THREE.DirectionalLight(0xFFFFFF, 1.1), amb: new THREE.AmbientLight(0xFFFFFF, 0.62), pt: new THREE.PointLight(0xFF3B5C, 8, 60) };
  var CROWD_COLOR = { green: '#12A36B', yellow: '#FFB000', red: '#FF3B5C' };
  var lifeData = null, eduData = null;   /* 最近一次 NetworkData 结果（供单栋面板） */
  var netFilter = null;                  /* 'life' | 'edu' | 'all' | null */
  var panel = null;
  var water = null, waterTex = null, decoGroup = null, cloudGroup = null;
  var netView = 'none';         /* 'none' | 'traffic' | 'wifi' */
  var trafficObjs = null, wifiObjs = null, proj = null;
  var DAY_BG = null, NIGHT_BG = new THREE.Color('#15161F');

  function cssVar(n, fb) { var v = ''; try { v = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); } catch (e) {} return v || fb; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function nowMinute() { var d = new Date(); return d.getHours() * 60 + d.getMinutes(); }

  /* ---------- 5 阶 toon 渐变（Nomadic 柔和玩具感：暖调奶油，暗部偏暖） ---------- */
  function makeGradient5() {
    var steps = 5, c = document.createElement('canvas'); c.width = 1; c.height = steps;
    var ctx = c.getContext('2d'), g = ctx.createLinearGradient(0, 0, 0, steps);
    g.addColorStop(0.0, '#ffffff'); g.addColorStop(0.30, '#fffaeb'); g.addColorStop(0.55, '#f8f0dc');
    g.addColorStop(0.80, '#f0e6d2'); g.addColorStop(1.0, '#e8dcc8');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1, steps);
    var t = new THREE.CanvasTexture(c); t.minFilter = THREE.NearestFilter; t.magFilter = THREE.NearestFilter;
    return t;
  }
  /* ---------- 纸张纹理（纤维噪点 + 手绘高光笔触） ---------- */
  function makePaperTex() {
    var c = document.createElement('canvas'); c.width = c.height = 256;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 256, 256);
    var rnd = K.mulberry32(20261107);
    for (var i = 0; i < 800; i++) {
      var x = rnd() * 256, y = rnd() * 256, a = rnd() * 0.12;
      ctx.fillStyle = 'rgba(60,50,40,' + a.toFixed(3) + ')';
      ctx.fillRect(x, y, 1.1, 1.1);
    }
    /* 2~3 条手绘高光笔触（不规则曲线） */
    for (var h = 0; h < 3; h++) {
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.10 + rnd() * 0.08).toFixed(3) + ')';
      ctx.lineWidth = 2 + rnd() * 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(rnd() * 256, rnd() * 256);
      ctx.quadraticCurveTo(rnd() * 256, rnd() * 256, rnd() * 256, rnd() * 256);
      ctx.stroke();
    }
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2);
    return t;
  }
  /* ---------- 圆角盒（ExtrudeGeometry 手写圆角 + bevel，消除 CG 锐利感） ---------- */
  function bevelBox(w, h, d, bevel) {
    bevel = bevel == null ? 0.05 : bevel;
    var hw = w / 2, hh = h / 2, r = bevel * 3;
    var s = new THREE.Shape();
    s.moveTo(-hw + r, -hh); s.lineTo(hw - r, -hh); s.quadraticCurveTo(hw, -hh, hw, -hh + r);
    s.lineTo(hw, hh - r); s.quadraticCurveTo(hw, hh, hw - r, hh);
    s.lineTo(-hw + r, hh); s.quadraticCurveTo(-hw, hh, -hw, hh - r);
    s.lineTo(-hw, -hh + r); s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
    var geo = new THREE.ExtrudeGeometry(s, { depth: d - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 3 });
    geo.translate(0, 0, -d / 2 + bevel);
    geo.scale(0.96, 1, 0.96);   /* 顶部/底部微收分（手绘稚拙感） */
    return geo;
  }
  /* ---------- 总览低模（≤800 三角形/栋） ---------- */
  function ovPart(parent, v, geo, color, opts) {
    opts = opts || {};
    var g = K.part(parent, K.wobbleGeo(geo, opts.amt == null ? 0.1 : opts.amt, v.r), color, { gmap: gmap5, emissive: new THREE.Color(color).multiplyScalar(0.3), emissiveIntensity: 0.5 });
    if (opts.pos) g.position.set(opts.pos[0], opts.pos[1], opts.pos[2]);
    if (opts.rot) g.rotation.set(opts.rot[0] || 0, opts.rot[1] || 0, opts.rot[2] || 0);
    return g;
  }
  function ovWindows(g, v, cols, rows, w, h, faceZ, baseY) {
    /* faceZ=前立面 z（建筑 d/2）、baseY=首行窗台高。修复旧版 9 参错位：窗户曾浮到屋顶外 */
    for (var c = 0; c < cols; c++) for (var r = 0; r < rows; r++) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0xFFE3A8, side: THREE.DoubleSide }));
      m.position.set(-w * (cols - 1) / 2 + c * w, baseY + r * (h + 0.3), faceZ + 0.02);
      g.add(m);
      if (v.windows) v.windows.push(m);
    }
  }
  /* ---------- V12.1 质感小道具：烟圈 / 条纹雨棚 / 手绘星 ---------- */
  function smokeTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var ctx = c.getContext('2d');
    var g = ctx.createRadialGradient(32, 32, 3, 32, 32, 30);
    g.addColorStop(0, 'rgba(120,108,96,0.5)'); g.addColorStop(0.65, 'rgba(120,108,96,0.22)'); g.addColorStop(1, 'rgba(120,108,96,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  function awningTexture(accentHex) {
    var c = document.createElement('canvas'); c.width = 128; c.height = 64;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, 128, 64);
    ctx.fillStyle = accentHex;
    for (var i = 0; i < 4; i++) ctx.fillRect(i * 32, 0, 16, 64);
    ctx.strokeStyle = '#2B2620'; ctx.lineWidth = 5; ctx.strokeRect(2, 2, 124, 60);
    return new THREE.CanvasTexture(c);
  }
  function makeStar(color) {
    var shape = new THREE.Shape();
    for (var i = 0; i < 10; i++) {
      var ang = i / 10 * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? 0.22 : 0.5;
      if (i === 0) shape.moveTo(Math.cos(ang) * rr, Math.sin(ang) * rr); else shape.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
    }
    shape.closePath();
    var geo = new THREE.ShapeGeometry(shape);
    var grp = new THREE.Group();
    grp.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: color, side: THREE.DoubleSide })));
    grp.add(new THREE.LineLoop(new THREE.EdgesGeometry(geo, 15), new THREE.LineBasicMaterial({ color: 0x2B2620 })));
    return grp;
  }
  var OV = {
    canteen: function (g, v) { var h = 3.4 * v.hs, w = 8 * v.ws, d = 6 * v.ws; v.w = w; v.d = d;
      ovPart(g, v, bevelBox(w, h, d), 0xF3D08E, { pos: [0, h / 2, 0] });
      v.roof = ovPart(g, v, new THREE.ConeGeometry(Math.max(w, d) * 0.6, 2.0 * v.hs, 4), v.accent, { pos: [0, h + 1.0 * v.hs, 0], rot: [(v.r() - 0.5) * 0.06, Math.PI / 4, (v.r() - 0.5) * 0.04], amt: 0.12 });
      /* V12.1：歪烟囱 + 手绘烟圈（3 个渐大 Sprite 慢速上浮循环，低端机省略） */
      var chx = w * 0.26, chz = -d * 0.16;
      var chimney = ovPart(g, v, new THREE.CylinderGeometry(0.2, 0.28, 1.0, 6), 0xE8D9BC, { pos: [chx, h + 1.3 * v.hs, chz] });
      chimney.rotation.z = (v.r() - 0.5) * 0.16;
      if (!LOWEND) {
        v.smoke = [];
        var stex = smokeTexture();
        for (var si = 0; si < 3; si++) {
          var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: stex, transparent: true, opacity: 0, depthWrite: false }));
          sp.scale.set(0.7, 0.55, 1); g.add(sp);
          v.smoke.push({ sp: sp, ph: si / 3, x: chx, y: h + 1.8 * v.hs, z: chz });
        }
      }
      /* V12.1：门口条纹遮阳篷（accent+白条纹 Canvas 贴图） */
      var aw = new THREE.Mesh(K.wobbleGeo(new THREE.PlaneGeometry(w * 0.56, 1.4), 0.04, v.r), new THREE.MeshBasicMaterial({ map: awningTexture('#' + ('000000' + v.accent.toString(16)).slice(-6)), transparent: true, side: THREE.DoubleSide }));
      aw.position.set(0, h * 0.6, d / 2 + 0.48); aw.rotation.x = -Math.PI / 2 + 0.42; g.add(aw);
      ovWindows(g, v, 4, 1, 0.7, 0.8, d / 2, 0.9); v.topY = h + 2.0 * v.hs; },
    library: function (g, v) { var h = 5.6 * v.hs, w = 7 * v.ws, d = 5 * v.ws; v.w = w; v.d = d;
      ovPart(g, v, bevelBox(w, h, d), 0x7E97C9, { pos: [0, h / 2, 0] });
      ovPart(g, v, new THREE.BoxGeometry(w * 0.7, 1.4, d * 0.7), 0xA6B8DA, { pos: [0, h + 0.7, 0] });
      ovPart(g, v, new THREE.BoxGeometry(w * 0.45, 1.1, d * 0.45), v.accent, { pos: [0, h + 1.9, 0] });
      /* V12.1：书脊装饰行——退台上 6 本撞色小书（两两歪斜） */
      for (var bi = 0; bi < 6; bi++) {
        var bk = ovPart(g, v, new THREE.BoxGeometry(0.32, 0.5 + v.r() * 0.22, 0.46), K.ACCENTS[bi % K.ACCENTS.length], { pos: [-w * 0.27 + bi * (w * 0.108), h + 1.66, d * 0.16], amt: 0.04 });
        bk.rotation.z = (v.r() - 0.5) * 0.18;
      }
      /* V12.1：碎片玻璃幕墙——顶层横带 5 片两色不规则四边形（拼缝可见） */
      for (var gi = 0; gi < 5; gi++) {
        var shard = new THREE.Mesh(K.wobbleGeo(new THREE.PlaneGeometry(0.55 + v.r() * 0.2, 1.2 + v.r() * 0.6), 0.07, v.r), new THREE.MeshBasicMaterial({ color: gi % 2 ? 0x8FB6D9 : 0x9FD4C8, transparent: true, opacity: 0.75, side: THREE.DoubleSide }));
        shard.position.set(-w * 0.3 + gi * (w * 0.15), h * 0.78 + (v.r() - 0.5) * 0.3, d / 2 + 0.03);
        shard.rotation.z = (v.r() - 0.5) * 0.1;
        g.add(shard);
      }
      /* V12.1：顶部旋转手绘星（风车式慢转，loop 驱动） */
      v.star = makeStar(K.ACCENTS[Math.floor(v.r() * K.ACCENTS.length)]);
      v.star.position.set(w * 0.3, h + 2.7, -d * 0.18); v.star.rotation.x = -Math.PI / 2; g.add(v.star);
      /* 层间阴影（纸片厚度） */
      var gm = new THREE.MeshBasicMaterial({ color: 0x2B2B2B, transparent: true, opacity: 0.28 });
      g.add(new THREE.Mesh(new THREE.BoxGeometry(w * 0.72, 0.04, d * 0.72), gm).translateY(h + 0.02));
      g.add(new THREE.Mesh(new THREE.BoxGeometry(w * 0.47, 0.04, d * 0.47), gm).translateY(h + 1.37));
      ovWindows(g, v, 6, 3, 0.5, 0.7, d / 2, 0.8); v.topY = h + 3.0; },
    express: function (g, v) { var h = 2.6 * v.hs, w = 6 * v.ws, d = 4.4 * v.ws; v.w = w; v.d = d;
      ovPart(g, v, bevelBox(w, h, d), 0xE0C17E, { pos: [0, h / 2, 0] });
      ovPart(g, v, new THREE.BoxGeometry(w * 0.7, 0.5, 0.16), v.accent, { pos: [0, h * 0.9, d / 2 + 0.05] });
      /* V12.1：门头胶带斜贴（亮黄半透明） */
      var tape = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.34, 0.3), new THREE.MeshBasicMaterial({ color: 0xF9ED69, transparent: true, opacity: 0.65, side: THREE.DoubleSide }));
      tape.position.set(-w * 0.1, h * 0.9, d / 2 + 0.08); tape.rotation.z = 0.4; g.add(tape);
      /* V12.1：堆叠纸箱山——6~8 个撞色小盒随机旋转 */
      var nBox = 6 + Math.floor(v.r() * 3);
      for (var i = 0; i < nBox; i++) {
        var layer = Math.floor(i / 3), col = i % 3;
        var bx = ovPart(g, v, new THREE.BoxGeometry(0.6, 0.48, 0.62), K.ACCENTS[(i + 1) % K.ACCENTS.length], { pos: [w * 0.3 + col * 0.66 + (layer % 2) * 0.26, 0.24 + layer * 0.48, d / 2 + 0.5 + (i % 2) * 0.3], amt: 0.04 });
        bx.rotation.y = (v.r() - 0.5) * 0.5;
      }
      v.topY = h; },
    hospital: function (g, v) { var h = 3.8 * v.hs, w = 7 * v.ws, d = 5 * v.ws; v.w = w; v.d = d;
      ovPart(g, v, bevelBox(w, h, d), 0xE8E8E0, { pos: [0, h / 2, 0] });
      /* V12.1：手绘胶囊十字（末端圆头）+ 呼吸发光（loop 驱动） */
      v.crossMats = [];
      var cm1 = new THREE.MeshToonMaterial({ color: 0xFF3B5C, gradientMap: gmap5, emissive: new THREE.Color(0xFF3B5C), emissiveIntensity: 0.6 });
      var cm2 = cm1.clone();
      var capH = new THREE.Mesh(K.wobbleGeo(new THREE.CapsuleGeometry(0.2, 1.0, 2, 6), 0.03, v.r), cm1);
      capH.rotation.z = Math.PI / 2; capH.position.set(0, h * 0.8, d / 2 + 0.09); g.add(capH);
      var capV = new THREE.Mesh(K.wobbleGeo(new THREE.CapsuleGeometry(0.2, 1.0, 2, 6), 0.03, v.r), cm2);
      capV.position.set(0, h * 0.8, d / 2 + 0.11); g.add(capV);
      v.crossMats.push(cm1, cm2);
      /* V12.1：门前药瓶道具（白瓶身 + 红盖） */
      ovPart(g, v, new THREE.CylinderGeometry(0.24, 0.28, 0.56, 7), 0xFFFFFF, { pos: [w * 0.32, 0.28, d / 2 + 0.42] });
      ovPart(g, v, new THREE.CylinderGeometry(0.26, 0.26, 0.14, 7), 0xFF2E63, { pos: [w * 0.32, 0.62, d / 2 + 0.42] });
      ovWindows(g, v, 5, 1, 0.5, 0.6, d / 2, 1.0); v.topY = h; },
    stadium: function (g, v) { var s = 1 + v.r() * 0.4; v.w = 10 * s; v.d = 7 * s;
      var track = new THREE.Mesh(new THREE.RingGeometry(4.2, 6, 40), new THREE.MeshToonMaterial({ color: 0xD65A72, gradientMap: gmap5 }));
      track.rotation.x = -Math.PI / 2; track.scale.set(1.5 * s, 1, s); track.position.y = 0.05; g.add(track);
      /* V12.1：内圈换色 + 白色车道线环 */
      var trackIn = new THREE.Mesh(new THREE.RingGeometry(3.5, 4.2, 36), new THREE.MeshToonMaterial({ color: 0xC24B63, gradientMap: gmap5 }));
      trackIn.rotation.x = -Math.PI / 2; trackIn.scale.set(1.5 * s, 1, s); trackIn.position.y = 0.055; g.add(trackIn);
      var lane = new THREE.Mesh(new THREE.RingGeometry(4.68, 4.76, 40), new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.5 }));
      lane.rotation.x = -Math.PI / 2; lane.scale.set(1.5 * s, 1, s); lane.position.y = 0.06; g.add(lane);
      var field = new THREE.Mesh(new THREE.CircleGeometry(4.2, 40), new THREE.MeshToonMaterial({ color: 0x5FBF8F, gradientMap: gmap5 }));
      field.rotation.x = -Math.PI / 2; field.scale.set(1.5 * s, 1, s); field.position.y = 0.04; g.add(field);
      /* V12.1：碎片草皮——5 片两色五边形拼合覆盖（拼缝可见的“色纸拼贴”） */
      for (var fi = 0; fi < 5; fi++) {
        var frag = new THREE.Mesh(new THREE.CircleGeometry(1.4 + v.r() * 0.6, 5), new THREE.MeshToonMaterial({ color: fi % 2 ? 0x5FBF8F : 0x6BCB77, gradientMap: gmap5 }));
        frag.rotation.x = -Math.PI / 2; frag.rotation.z = v.r() * Math.PI;
        frag.scale.set(1.5 * s, s, 1);
        frag.position.set((v.r() - 0.5) * 4.4 * s, 0.07 + fi * 0.004, (v.r() - 0.5) * 2.6 * s);
        g.add(frag);
      }
      ovPart(g, v, new THREE.BoxGeometry(5 * s, 1.4, 1.2), v.accent, { pos: [-2.2 * s, 0.7, 4.4 * s] });
      ovPart(g, v, new THREE.BoxGeometry(5 * s, 1.4, 1.2), v.accent, { pos: [2.2 * s, 0.7, 4.4 * s] });
      /* V12.1：看台小人观众 ×3（撞色胶囊） */
      for (var pi = 0; pi < 3; pi++) {
        ovPart(g, v, new THREE.CapsuleGeometry(0.13, 0.26, 2, 6), K.ACCENTS[(pi + 2) % K.ACCENTS.length], { pos: [-2.2 * s + pi * 2.2 * s + (v.r() - 0.5) * 0.5, 1.72, 4.4 * s], amt: 0.03 });
      }
      v.topY = 1.4; },
    dorm: function (g, v) { var h = 6.4 * v.hs, w = 4.6 * v.ws, d = 4 * v.ws; v.w = w; v.d = d;
      ovPart(g, v, bevelBox(w, h, d), 0xEFD08C, { pos: [0, h / 2, 0] });
      /* V12.1：阳台小凸台阵列（随机留空，避免机械感） */
      for (var bi = 0; bi < 2; bi++) for (var bj = 0; bj < 5; bj++) {
        if (v.r() < 0.3) continue;
        ovPart(g, v, new THREE.BoxGeometry(0.5, 0.4, 0.22), 0xE3C48A, { pos: [-w * 0.24 + bi * w * 0.48, 1.15 + bj * (h - 1.9) / 4, d / 2 + 0.09], amt: 0.03 });
      }
      /* V12.1：晾衣杆 + 被子色块 */
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, w * 0.72, 4), new THREE.MeshBasicMaterial({ color: 0x2B2620 }));
      pole.rotation.z = Math.PI / 2; pole.position.set(0, h * 0.94, d / 2 + 0.3); g.add(pole);
      for (var ci = 0; ci < 3; ci++) {
        var quilt = new THREE.Mesh(K.wobbleGeo(new THREE.PlaneGeometry(0.62, 0.85), 0.05, v.r), new THREE.MeshBasicMaterial({ color: K.ACCENTS[(ci + 3) % K.ACCENTS.length], side: THREE.DoubleSide }));
        quilt.position.set(-w * 0.21 + ci * w * 0.21, h * 0.94 - 0.46, d / 2 + 0.3); g.add(quilt);
      }
      ovWindows(g, v, 3, 5, 0.55, 0.55, d / 2, 0.8); v.topY = h; },
    admin: function (g, v) { var h = 3.6 * v.hs, w = 7.5 * v.ws, d = 4.6 * v.ws; v.w = w; v.d = d;
      ovPart(g, v, bevelBox(w, h, d), 0x99B0D8, { pos: [0, h / 2, 0] });
      ovPart(g, v, new THREE.BoxGeometry(2.1, 2.4, 1.1), 0xEFD08C, { pos: [0, 1.2, d / 2 + 0.5] });
      /* V12.1：圆形校徽（黄色碎片圆盘 + 墨线环） */
      var emblem = new THREE.Mesh(K.wobbleGeo(new THREE.CircleGeometry(0.52, 6), 0.04, v.r), new THREE.MeshBasicMaterial({ color: 0xF9ED69, side: THREE.DoubleSide }));
      emblem.position.set(0, 2.0, d / 2 + 1.06); g.add(emblem);
      var ering = new THREE.LineLoop(new THREE.EdgesGeometry(new THREE.CircleGeometry(0.52, 6), 5), new THREE.LineBasicMaterial({ color: 0x2B2620 }));
      ering.position.set(0, 2.0, d / 2 + 1.07); g.add(ering);
      /* 层间阴影（门厅纸片厚度） */
      var gm2 = new THREE.MeshBasicMaterial({ color: 0x2B2B2B, transparent: true, opacity: 0.28 });
      g.add(new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.04, 1.14), gm2).translateY(0.02).translateZ(d / 2 + 0.5));
      ovWindows(g, v, 5, 2, 0.6, 0.7, d / 2, 1.0); v.topY = h; },
    academic: function (g, v) { var h = 5.4 * v.hs, w = 5.6 * v.ws, d = 4.4 * v.ws; v.w = w; v.d = d;
      ovPart(g, v, bevelBox(w, h, d), 0x7E97C9, { pos: [0, h / 2, 0] });
      /* V12.1：院牌色条（accent 横带 + 微歪） */
      var sign = ovPart(g, v, new THREE.BoxGeometry(w * 0.42, 0.42, 0.14), v.accent, { pos: [0, h * 0.82, d / 2 + 0.05], amt: 0.04 });
      sign.rotation.z = (v.r() - 0.5) * 0.05;
      ovWindows(g, v, 3, 4, 0.6, 0.7, d / 2, 0.9); v.topY = h; }
  };
  function ovKindOf(sp) {
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

  /* ---------- 旗帜 / 数字 Sprite ---------- */
  function flagTexture(color) {
    var c = document.createElement('canvas'); c.width = 128; c.height = 72;
    var ctx = c.getContext('2d');
    ctx.fillStyle = color; ctx.strokeStyle = '#2B2620'; ctx.lineWidth = 5; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(4, 6); ctx.quadraticCurveTo(64, 18, 124, 4); ctx.lineTo(118, 66); ctx.quadraticCurveTo(60, 50, 6, 68); ctx.closePath(); ctx.fill(); ctx.stroke();
    return new THREE.CanvasTexture(c);
  }
  function numberTexture(n, color) {
    var c = document.createElement('canvas'); c.width = 128; c.height = 96;
    var ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 128, 96);
    ctx.font = 'bold 60px "Comic Sans MS", "Chalkboard SE", "Segoe Print", cursive';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#2B2620'; ctx.lineWidth = 3; ctx.fillStyle = color;
    var t = String(n); ctx.save(); ctx.translate(64, 50); ctx.rotate(-0.04);
    ctx.strokeText(t, 0, 0); ctx.fillText(t, 0, 0); ctx.restore();
    return new THREE.CanvasTexture(c);
  }
  function makeFlag(color) {
    var g = new THREE.Group();
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.8, 5), new THREE.MeshBasicMaterial({ color: 0x2B2620 }));
    pole.position.y = 0.9; g.add(pole);
    var flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.95, 8, 6), new THREE.MeshBasicMaterial({ map: flagTexture(color), transparent: true, side: THREE.DoubleSide, depthTest: false, depthWrite: false }));
    flag.position.set(0.85, 1.55, 0); flag.renderOrder = 50;
    g.add(flag);
    flag.userData.base = flag.geometry.attributes.position.array.slice();
    g.renderOrder = 50;
    return { group: g, flag: flag };
  }
  function makeNumber(color) {
    var tex = numberTexture(0, color);
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
    sp.scale.set(3.4, 2.55, 1); sp.renderOrder = 60;
    return { sp: sp, tex: tex };
  }
  /* 低端机假阴影贴片（径向渐变椭圆） */
  function makeFakeShadow(r) {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var ctx = c.getContext('2d');
    var g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
    g.addColorStop(0, 'rgba(0,0,0,0.28)'); g.addColorStop(0.6, 'rgba(0,0,0,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    var m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    return m;
  }
  /* ---------- 经纬度 → 世界坐标（与建筑同一投影） ---------- */
  function toWorld(lng, lat) {
    if (!proj) return { x: 0, z: 0 };
    return { x: (lng - proj.minLng) / proj.span * 80 - 40, z: (proj.maxLat - lat) / proj.span * 80 - 40 };
  }
  /* ---------- 合并几何（单车低模，InstancedMesh 单次绘制） ---------- */
  function mergeGeos(geos) {
    var total = 0;
    geos.forEach(function (g) { total += g.attributes.position.count; });
    var pos = new Float32Array(total * 3), norm = new Float32Array(total * 3), uv = new Float32Array(total * 2);
    var indices = [], off = 0;
    geos.forEach(function (g) {
      var p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
      for (var i = 0; i < p.count; i++) {
        pos[(off + i) * 3] = p.getX(i); pos[(off + i) * 3 + 1] = p.getY(i); pos[(off + i) * 3 + 2] = p.getZ(i);
        if (n) { norm[(off + i) * 3] = n.getX(i); norm[(off + i) * 3 + 1] = n.getY(i); norm[(off + i) * 3 + 2] = n.getZ(i); }
        if (u) { uv[(off + i) * 2] = u.getX(i); uv[(off + i) * 2 + 1] = u.getY(i); }
      }
      var gi = g.index ? g.index.array : null;
      if (gi) { for (var k = 0; k < gi.length; k++) indices.push(gi[k] + off); }
      else { for (var k2 = 0; k2 < p.count; k2++) indices.push(k2 + off); }
      off += p.count;
    });
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }
  function makeBikeGeo() {
    var w1 = new THREE.CylinderGeometry(0.42, 0.42, 0.09, 8); w1.rotateZ(Math.PI / 2); w1.translate(0, 0.42, -0.8);
    var w2 = new THREE.CylinderGeometry(0.42, 0.42, 0.09, 8); w2.rotateZ(Math.PI / 2); w2.translate(0, 0.42, 0.8);
    var frame = new THREE.BoxGeometry(0.12, 0.1, 1.7); frame.translate(0, 0.78, 0);
    var seat = new THREE.BoxGeometry(0.26, 0.08, 0.42); seat.translate(0, 1.02, -0.2);
    return mergeGeos([w1, w2, frame, seat]);
  }

  /* ---------- 地形 ---------- */
  function buildTerrain(bbox, positions) {
    var c = document.createElement('canvas'); c.width = 1024; c.height = 1024;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#EAE4D3'; ctx.fillRect(0, 0, 1024, 1024);
    /* 绿地块（手绘抖边椭圆） */
    ctx.fillStyle = '#CBE3B8'; ctx.strokeStyle = '#9BBE8A'; ctx.lineWidth = 3;
    for (var i = 0; i < 7; i++) { var x = 100 + (i * 137) % 900, y = 100 + (i * 97) % 900;
      ctx.beginPath(); ctx.ellipse(x, y, 90 + i * 7, 60 + i * 3, i, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    /* 水体（右上角蓝块） */
    ctx.fillStyle = '#A9D4E8'; ctx.strokeStyle = '#7FB0C8'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(830, 150, 140, 70, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    /* 道路：连接各建筑的手绘折线 */
    ctx.strokeStyle = '#D6CDBB'; ctx.lineWidth = 12; ctx.lineCap = 'round';
    positions.forEach(function (p) { ctx.beginPath(); ctx.moveTo(512, 512); ctx.lineTo(p.px, p.py); ctx.stroke(); });
    ctx.strokeStyle = '#C4BAA6'; ctx.lineWidth = 3; ctx.setLineDash([14, 10]);
    positions.forEach(function (p) { ctx.beginPath(); ctx.moveTo(512, 512); ctx.lineTo(p.px, p.py); ctx.stroke(); });
    ctx.setLineDash([]);
    var oldTex = (terrain && terrain.material && terrain.material.map) || null;
    terrainTex = new THREE.CanvasTexture(c);
    if (terrain) { terrain.material.map = terrainTex; terrain.material.needsUpdate = true; }
    if (oldTex && oldTex !== terrainTex && oldTex !== paperTex) oldTex.dispose();
  }
  /* ---------- 水体（半透明蓝面 + 缓慢 UV 滚动） ---------- */
  function makeWaterTex() {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#A9D4E8'; ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (var i = 0; i < 6; i++) {
      var y = 12 + i * 19;
      ctx.beginPath(); ctx.moveTo(0, y);
      for (var x = 0; x <= 128; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.09 + i) * 3);
      ctx.stroke();
    }
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 1);
    return t;
  }
  function buildWater() {
    waterTex = makeWaterTex();
    water = new THREE.Mesh(new THREE.CircleGeometry(13, 40), new THREE.MeshBasicMaterial({ map: waterTex, color: 0xA9D4E8, transparent: true, opacity: 0.55, depthWrite: false }));
    water.rotation.x = -Math.PI / 2; water.position.set(29.8, 0.03, -33.9); scene.add(water);
  }
  /* ---------- 远景低模装饰（锥形树/圆柱塔，墨线描边） ---------- */
  function buildDeco() {
    decoGroup = new THREE.Group();
    var rnd = K.mulberry32(20261108);
    for (var i = 0; i < 9; i++) {
      var a = i / 9 * Math.PI * 2 + 0.3;
      var r = 43 + rnd() * 3;
      var x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (i % 2 === 0) {
        var trunk = K.part(decoGroup, K.wobbleGeo(new THREE.CylinderGeometry(0.2, 0.28, 1.4, 5), 0.05, rnd), 0x8A6A48, { gmap: gmap5 });
        trunk.position.set(x, 0.7, z);
        /* V12.1：树冠改 3 片多边形碎纸拼合（两色绿，拼贴感） */
        for (var ti = 0; ti < 3; ti++) {
          var shardC = K.part(decoGroup, K.wobbleGeo(new THREE.TetrahedronGeometry(0.85 + rnd() * 0.5), 0.1, rnd), ti % 2 ? 0x4CAF7D : 0x6BCB77, { gmap: gmap5 });
          shardC.position.set(x + (rnd() - 0.5) * 0.9, 2.3 + rnd() * 0.9, z + (rnd() - 0.5) * 0.9);
          shardC.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
        }
      } else {
        var tower = K.part(decoGroup, K.wobbleGeo(new THREE.CylinderGeometry(0.5, 0.7, 3.6, 6), 0.1, rnd), 0xB8C2DA, { gmap: gmap5 });
        tower.position.set(x, 1.8, z);
        var cap = K.part(decoGroup, K.wobbleGeo(new THREE.ConeGeometry(0.7, 1.2, 6), 0.08, rnd), 0xFF3B5C, { gmap: gmap5 });
        cap.position.set(x, 4.2, z);
      }
    }
    /* V12.1：makemepulse 式纸云 ×2（3 个压扁椭球 + 墨线壳，慢速漂浮） */
    cloudGroup = new THREE.Group();
    for (var ci = 0; ci < 2; ci++) {
      var cloud = new THREE.Group();
      for (var pi = 0; pi < 3; pi++) {
        var puff = K.part(cloud, K.wobbleGeo(new THREE.SphereGeometry(0.85 + pi * 0.22, 6, 4), 0.08, rnd), 0xFFFFFF, { gmap: gmap5 });
        puff.scale.set(1.5, 0.6, 1);
        puff.position.set((pi - 1) * 1.05, pi === 1 ? 0.35 : 0, 0);
      }
      cloud.position.set(ci ? -26 : 24, ci ? 14.6 : 11.2, ci ? 20 : -24);
      cloudGroup.add(cloud);
    }
    scene.add(cloudGroup);
    scene.add(decoGroup);
  }

  /* ---------- 初始化 ---------- */
  function mount(el) {
    if (mounted) return true;
    if (!el) return false;
    host = el; mounted = true;
    LOWEND = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
    try { REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    gmap5 = makeGradient5(); paperTex = makePaperTex();
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(host.clientWidth, host.clientHeight);
      if (!LOWEND) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
      host.appendChild(renderer.domElement);
    } catch (e) { mounted = false; host.innerHTML = '<div class="map-placeholder"><h3>3D 初始化失败</h3><p>' + esc(e && e.message ? e.message : String(e)) + '</p><p>列表与网络数据不受影响</p></div>'; return false; }
    scene = new THREE.Scene();
    scene.background = new THREE.Color(cssVar('--bg', '#FBF3E1'));
    scene.fog = new THREE.Fog(scene.background.clone(), 80, 180);

    camera = new THREE.PerspectiveCamera(45, host.clientHeight ? host.clientWidth / host.clientHeight : 1, 0.1, 400);
    camera.position.set(0, 46, 42);
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.06;
    controls.minPolarAngle = THREE.MathUtils.degToRad(30);
    controls.maxPolarAngle = THREE.MathUtils.degToRad(60);
    controls.minDistance = 25; controls.maxDistance = 110;
    controls.target.set(0, 0, 0);

    key.d.position.set(40, 70, 30); key.d.color.set(0xFFF5E0); key.d.intensity = 0.75; key.d.castShadow = !LOWEND;
    if (!LOWEND) { key.d.shadow.mapSize.set(2048, 2048); key.d.shadow.camera.near = 20; key.d.shadow.camera.far = 220; }
    key.amb.intensity = 0.42;
    scene.add(key.d); scene.add(key.amb);
    key.hemi = new THREE.HemisphereLight(0xFEFBF6, 0xD9D2C5, 0.36); scene.add(key.hemi);
    key.pt.position.set(0, 12, 0); key.pt.intensity = 0.35; scene.add(key.pt);
    DAY_BG = new THREE.Color(cssVar('--bg', '#FBF3E1'));

    terrain = new THREE.Mesh(new THREE.PlaneGeometry(96, 96), new THREE.MeshToonMaterial({ color: 0xEAE4D3, gradientMap: gmap5, map: paperTex }));
    terrain.rotation.x = -Math.PI / 2; terrain.position.y = -0.02; terrain.receiveShadow = !LOWEND; scene.add(terrain);
    buildWater();
    buildDeco();

    buildCampus();
    window.addEventListener('resize', onResize);
    bindInput();
    sync();
    updateStats();
    return true;
  }
  function buildCampus() {
    buildings.forEach(function (b) {
      disposeGroup(b.group);
      if (b.flag) disposeGroup(b.flag.group);
      if (b.num) { scene.remove(b.num.sp); if (b.num.sp.material.map) b.num.sp.material.map.dispose(); b.num.sp.material.dispose(); }
      if (b.numShadow) { scene.remove(b.numShadow); b.numShadow.geometry.dispose(); b.numShadow.material.dispose(); }
      if (b.ao) { scene.remove(b.ao); b.ao.geometry.dispose(); b.ao.material.dispose(); }
      if (b.fakeShadow) { scene.remove(b.fakeShadow); b.fakeShadow.geometry.dispose(); b.fakeShadow.material.map.dispose(); b.fakeShadow.material.dispose(); }
      if (b.netGroup) disposeGroup(b.netGroup);
    });
    buildings = [];
    var all = window.NetworkData.spotsOf(campus);
    /* V12.1：与孪生列表同序——生活类优先、教学/宿舍/行政补充（修复稀疏校区仅 2~4 栋的问题） */
    var KP = { canteen: 0, library: 1, express: 2, hospital: 3, stadium: 4, dorm: 5, admin: 6, academic: 7 };
    var picked = all.filter(function (sp) { return OV[ovKindOf(sp)]; })
      .sort(function (a, b) { return (KP[ovKindOf(a)] - KP[ovKindOf(b)]) || String(a.id).localeCompare(String(b.id)); })
      .slice(0, 15);
    /* 经纬度 → 地形平面（bbox 取全校区点位，保证交通/校园网与建筑同投影） */
    var lngs = all.map(function (s) { return s.lng; }), lats = all.map(function (s) { return s.lat; });
    var minLng = Math.min.apply(null, lngs), maxLng = Math.max.apply(null, lngs);
    var minLat = Math.min.apply(null, lats), maxLat = Math.max.apply(null, lats);
    var span = Math.max(maxLng - minLng, maxLat - minLat, 0.0001);
    proj = { minLng: minLng, minLat: minLat, maxLat: maxLat, span: span };
    var positions = [];
    picked.forEach(function (sp) {
      var x = (sp.lng - minLng) / span * 80 - 40;
      var z = (maxLat - sp.lat) / span * 80 - 40;
      positions.push({ px: (x + 40) / 80 * 1024, py: (z + 40) / 80 * 1024 });
      var kind = ovKindOf(sp);
      var v = { r: K.mulberry32(K.hashSeed(sp.id)), hs: 0.9 + K.mulberry32(K.hashSeed(sp.id + 'h'))() * 0.3, ws: 0.9 + K.mulberry32(K.hashSeed(sp.id + 'w'))() * 0.25, accent: K.ACCENTS[Math.floor(K.hashSeed(sp.id) % K.ACCENTS.length)], windows: [] };
      var group = new THREE.Group();
      OV[kind](group, v);
      group.position.set(x, 0, z);
      /* 每栋独立纸张纹理 clone + 随机 offset（撕纸接缝错位） */
      var surf = paperTex.clone(); surf.needsUpdate = true;
      var sr = K.mulberry32(K.hashSeed(sp.id + ':tex'));
      surf.offset.set((sr() - 0.5) * 0.008, (sr() - 0.5) * 0.008);
      group.traverse(function (o) { if (o.isMesh) { o.castShadow = !LOWEND; o.receiveShadow = !LOWEND; if (o.material && o.material.type === 'MeshToonMaterial') { o.material.map = surf; o.material.needsUpdate = true; } } });
      scene.add(group);
      /* 接触阴影：高配 AO 环 / 低端机假阴影贴片 */
      if (LOWEND) {
        var fs = makeFakeShadow(Math.max(3, (v.topY || 3) * 0.7)); fs.position.set(x, 0.015, z); scene.add(fs);
      } else {
        var ao = new THREE.Mesh(new THREE.RingGeometry(2.2, 3.4, 28), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.15 }));
        ao.rotation.x = -Math.PI / 2; ao.position.set(x, 0.012, z); scene.add(ao);
      }
      /* 细节点缀：约 40% 建筑加一块修补色块 */
      if (sr() < 0.4 && kind !== 'stadium') {
        var patch = K.part(group, K.wobbleGeo(new THREE.BoxGeometry(1.0, 0.7, 0.15), 0.06, v.r), K.ACCENTS[Math.floor(sr() * K.ACCENTS.length)], { gmap: gmap5 });
        patch.position.set((sr() - 0.5) * 2.6, (v.topY || 3) * (0.3 + sr() * 0.4), (sr() > 0.5 ? 1 : -1) * 1.3); patch.rotation.z = (sr() - 0.5) * 0.12;
      }
      /* 墨线飞白：约 60% 建筑前左角一条断续竖线（手绘感） */
      if (sr() > 0.4 && v.w && v.d) {
        var cw = v.w * 0.47, cd = v.d * 0.47, ch = (v.topY || 3) * 0.92, lp = [], segs = 4;
        for (var si = 0; si < segs; si++) {
          if (sr() < 0.18) continue;
          lp.push(new THREE.Vector3(-cw, ch * si / segs, cd), new THREE.Vector3(-cw * 0.98, ch * (si + 1) / segs, cd * 0.98));
        }
        if (lp.length) group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lp), new THREE.LineBasicMaterial({ color: 0x2B2620, transparent: true, opacity: 0.45 })));
      }
      var b = { spotId: sp.id, name: sp.name, kind: kind, group: group, x: x, z: z, topY: v.topY || 3, crowd: 0, color: 'green', flag: null, num: null, v: v, windows: v.windows, dim: 1, targetDim: 1, mats: [], ao: ao || null, fakeShadow: fs || null, phase: sr() * Math.PI * 2, winPhase: sr() * Math.PI * 2 };
      group.traverse(function (o) { if (o.isMesh && o.material && b.mats.indexOf(o.material) === -1) b.mats.push(o.material); });
      b.flag = makeFlag(CROWD_COLOR.green); b.flag.group.position.set(x, v.topY || 3, z); scene.add(b.flag.group);
      b.num = makeNumber(CROWD_COLOR.green); b.num.sp.position.set(x, (v.topY || 3) + 3.2, z + 1.2); scene.add(b.num.sp);
      /* 数字 Sprite 投影（G5：落在建筑顶部，极淡） */
      var numShadow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.8), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.1, depthWrite: false }));
      numShadow.rotation.x = -Math.PI / 2; numShadow.position.set(x, (v.topY || 3) + 0.06, z + 0.8); scene.add(numShadow); b.numShadow = numShadow;
      /* 聚类展开：记录需同步位移的对象与基准坐标 */
      b.movers = [{ obj: group, bx: x, bz: z }, { obj: b.flag.group, bx: x, bz: z }, { obj: b.num.sp, bx: x, bz: z + 1.2 }, { obj: b.numShadow, bx: x, bz: z + 0.8 }];
      if (b.ao) b.movers.push({ obj: b.ao, bx: x, bz: z });
      if (b.fakeShadow) b.movers.push({ obj: b.fakeShadow, bx: x, bz: z });
      b.clusterK = 0; b.clusterTarget = 0; b.clusterDX = 0; b.clusterDZ = 0;
      buildings.push(b);
    });
    buildTerrain(null, positions);
  }
  function disposeGroup(g) { if (!g) return; g.traverse(function (o) { if (o.geometry) o.geometry.dispose(); var ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(function (m) { if (!m) return;   /* V12.1 修复：嵌套 Group 无 material，旧代码在此抛 TypeError 导致切校区/网络视图全部“没反应” */ if (m.map && m.map !== paperTex && m.map !== gmap5) m.map.dispose(); if (m.gradientMap && m.gradientMap !== gmap5) m.gradientMap.dispose(); m.dispose(); }); }); scene.remove(g); }

  /* ---------- 数据同步（旗帜/数字/亮灯率，minute 由 TwinModule 心跳传入） ---------- */
  function sync(minute) {
    if (!mounted || disposed) return;
    var mins = (minute == null) ? nowMinute() : (minute | 0);
    window.NetworkData.getLife(campus, mins).then(function (data) {
      if (!mounted) return;
      lifeData = data;
      var byId = {}; (data.buildings || []).forEach(function (b) { byId[b.spotId] = b; });
      buildings.forEach(function (b) {
        var d = byId[b.spotId];
        if (!d) return;
        b.crowd = d.crowd; b.color = d.color;
        var col = CROWD_COLOR[d.color] || CROWD_COLOR.green;
        if (b.flag.flag.material.map) b.flag.flag.material.map.dispose();
        b.flag.flag.material.map = flagTexture(col); b.flag.flag.material.needsUpdate = true;
        if (b.num.sp.material.map) b.num.sp.material.map.dispose();
        b.num.tex = numberTexture(d.crowd, col); b.num.sp.material.map = b.num.tex; b.num.sp.material.needsUpdate = true;
      });
      if (mode === 'single' && focusB) renderNetworkPanel(focusB);
      /* P4：应急被动触发——拥挤度>95 真实持续 ≥60s（时间门，杜绝快速切换/拖时间轴误触发） */
      var nowTs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      buildings.forEach(function (b) {
        if ((b.crowd || 0) > 95) { if (b.hotSince == null) b.hotSince = nowTs; }
        else { b.hotSince = null; }
      });
      if (mode === 'overview' && netView === 'none') {
        var hot = null;
        buildings.forEach(function (b) { if (!hot && b.hotSince != null && (nowTs - b.hotSince) >= 60000) hot = b; });
        if (hot) { buildings.forEach(function (b) { b.hotSince = null; }); triggerEmergency(hot.kind === 'hospital' ? 'medical' : 'fire', hot.spotId); }
      }
    });
    window.NetworkData.getEdu(campus, mins).then(function (edu) {
      if (!mounted) return;
      eduData = edu;
      applyLightRate(edu);
    });
    /* P3/P4：各网络视图的 tick 刷新（交通仅更新停车点计数，单车由视图逐帧插值） */
    if (netView === 'traffic') syncTraffic(false);
    if (netView === 'wifi') syncWifi(false);
    if (netView === 'teachers') syncTeachers();
    if (netView === 'all') { if (layerFlags.flow) buildFlowLayer(); if (layerFlags.wifi) buildWifiForAll(); if (layerFlags.traffic) buildTrafficDots(); }
  }
  /* 教学楼/图书馆窗户亮灯率 = 开放率（教育网络）；夜间按占用至少 55% 亮灯 */
  function applyLightRate(edu) {
    if (!edu || !edu.buildings) return;
    var byId = {}; edu.buildings.forEach(function (x) { byId[x.spotId] = x.openRate; });
    var night = !!window.__twinNight;
    buildings.forEach(function (b) {
      if (!b.windows || !b.windows.length) return;
      if (byId[b.spotId] == null) return;
      var frac = Math.max(byId[b.spotId] / 100, night ? 0.55 : 0);
      var lit = Math.round(frac * b.windows.length);
      b.litCount = lit;
      b.windows.forEach(function (w, i) {
        w.material.color.set(i < lit ? 0xFFE3A8 : 0x4a453c);
        if (i < lit) { w.material.transparent = true; w.material.needsUpdate = true; }
      });
    });
  }
  /* 网络入口：life/edu 高亮压暗；traffic 独立视图；wifi 云团叠加 */
  function setNetwork(net) {
    /* 应急视图：不静默锁死——确认后退出并继续切换，避免整片按键无响应 */
    if (netView === 'emergency-view') {
      if (!window.confirm('确认退出应急视图并切换网络？')) return;
      exitEmergency();
    }
    netFilter = net;
    hideNetworkPanel();   /* V12.1：切换网络时收起上一个网络的面板，避免叠层遮挡 */
    if (netView === 'traffic' && net !== 'traffic') exitTrafficView();
    if (netView === 'wifi' && net !== 'wifi') exitWifiView();
    if (netView === 'teachers' && net !== 'teachers') exitTeacherView();
    if (netView === 'emergency' && net !== 'emergency') exitEmergencyPanel();
    if (netView === 'all' && net !== 'all') exitAllOverlay();
    buildings.forEach(function (b) {
      var inNet = (net === 'life' && (b.kind === 'canteen' || b.kind === 'express')) ||
                  (net === 'edu' && (b.kind === 'academic' || b.kind === 'library'));
      b.targetDim = (net === 'life' || net === 'edu') ? (inNet ? 1 : 0.5) : 1;
      if (b.targetDim < 1) (b.mats || []).forEach(function (m) { m.transparent = true; m.needsUpdate = true; });
    });
    if (net === 'traffic') enterTrafficView();
    else if (net === 'wifi') enterWifiView();
    else if (net === 'teachers') enterTeacherView();
    else if (net === 'emergency') enterEmergencyPanel();
    else if (net === 'all') enterAllOverlay();
  }

  /* ---------- 交通网络视图（独立视图） ---------- */
  function enterTrafficView() {
    if (netView === 'traffic') return;
    netView = 'traffic';
    buildings.forEach(function (b) { b.targetDim = 0.2; (b.mats || []).forEach(function (m) { m.transparent = true; m.needsUpdate = true; }); });
    controls.enabled = false;
    camTween = { fromPos: camera.position.clone(), fromTgt: controls.target.clone(), toPos: new THREE.Vector3(0, 50, 30), toTgt: new THREE.Vector3(0, 0, 0), t0: performance.now(), dur: REDUCED ? 1 : 1000, flyTo: 'net' };
    syncTraffic(true);
  }
  function exitTrafficView() {
    if (netView !== 'traffic') return;
    netView = 'none';
    disposeTraffic();
    controls.enabled = false;
    var fromPos = camera.position.clone(), fromTgt = controls.target.clone();
    camTween = { fromPos: fromPos, fromTgt: fromTgt, toPos: new THREE.Vector3(0, 46, 42), toTgt: new THREE.Vector3(0, 0, 0), t0: performance.now(), dur: REDUCED ? 1 : 800, flyTo: 'net' };
  }
  function disposeTraffic() { if (!trafficObjs) return; disposeGroup(trafficObjs.group); trafficObjs = null; }
  function syncTraffic(build) {
    window.NetworkData.getTraffic(campus, nowMinute()).then(function (data) {
      if (!mounted || netView !== 'traffic') return;
      try {
        if (build || !trafficObjs) buildTrafficObjects(data);
        else refreshTrafficLabels(data);
      } catch (e) { try { console.error('[traffic] build failed', e); } catch (x) {} }
    });
  }
  function buildTrafficObjects(data) {
    disposeTraffic();
    var g = new THREE.Group();
    var roadsById = {}, parkingPos = {};
    data.parkings.forEach(function (pk) { var pw = toWorld(pk.lng, pk.lat); parkingPos[pk.id] = { x: pw.x, z: pw.z }; });
    var roadMat = new THREE.LineBasicMaterial({ color: 0x2B2620, transparent: true, opacity: 0.72 });
    data.roads.forEach(function (r) {
      var a = data.parkings[r.a], b = data.parkings[r.b];
      var pa = parkingPos[a.id], pb = parkingPos[b.id];
      var geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(pa.x, 0.07, pa.z), new THREE.Vector3(pb.x, 0.07, pb.z)]);
      g.add(new THREE.Line(geo, roadMat));
      roadsById[r.id] = { a: a.id, b: b.id };
    });
    var labels = [];
    data.parkings.forEach(function (pk) {
      var pw = parkingPos[pk.id];
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: numberTexture(pk.bikes, '#FFB000'), transparent: true, depthTest: false, depthWrite: false }));
      sp.scale.set(3.8, 2.85, 1); sp.position.set(pw.x, 3.4, pw.z); sp.renderOrder = 60;
      g.add(sp); labels.push({ sp: sp, pkId: pk.id });
    });
    var mesh = new THREE.InstancedMesh(makeBikeGeo(), new THREE.MeshBasicMaterial({ color: 0x08D9D6 }), data.bikes.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    g.add(mesh);
    scene.add(g);
    trafficObjs = { group: g, roadsById: roadsById, parkingPos: parkingPos, labels: labels, mesh: mesh, bikes: data.bikes, dummy: new THREE.Object3D() };
    updateBikeInstances(0);
    try { console.log('[traffic] 已构建 路网=' + data.roads.length + ' 停车点=' + data.parkings.length + ' 单车=' + data.bikes.length); } catch (e) {}
  }
  function refreshTrafficLabels(data) {
    if (!trafficObjs) return;
    var byId = {}; data.parkings.forEach(function (pk) { byId[pk.id] = pk.bikes; });
    trafficObjs.labels.forEach(function (L) {
      var n = byId[L.pkId] || 0;
      if (L.sp.material.map) L.sp.material.map.dispose();
      L.sp.material.map = numberTexture(n, '#FFB000'); L.sp.material.needsUpdate = true;
    });
  }
  function updateBikeInstances(dt) {
    if (!trafficObjs) return;
    var m = trafficObjs.mesh, dummy = trafficObjs.dummy, bikes = trafficObjs.bikes, roads = trafficObjs.roadsById, pp = trafficObjs.parkingPos;
    var now = performance.now();
    for (var i = 0; i < bikes.length; i++) {
      var bk = bikes[i], px = 0, pz = 0, rot = 0;
      if (bk.status === 'idle') {
        var pw = pp[bk.parkingId] || { x: 0, z: 0 };
        var ang = i * 0.7;
        px = pw.x + Math.cos(ang) * (0.8 + (i % 3) * 0.5);
        pz = pw.z + Math.sin(ang) * (0.8 + (i % 3) * 0.5);
      } else {
        var route = bk.route;
        if (!route || !route.length) { dummy.position.set(0, 0, 0); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); continue; }
        var seg = route[bk.routeIdx % route.length];
        var rd = roads[seg.roadId];
        if (!rd) continue;
        var pa = pp[rd.a], pb = pp[rd.b];
        var from = seg.dir > 0 ? pa : pb, to = seg.dir > 0 ? pb : pa;
        var k = Math.min(1, Math.max(0, bk.t));
        px = from.x + (to.x - from.x) * k;
        pz = from.z + (to.z - from.z) * k;
        rot = Math.atan2(to.x - from.x, to.z - from.z);
        if (!REDUCED && !(bk.waitUntil && now < bk.waitUntil)) {
          bk.t += (dt || 0.016) * bk.speed;
          if (bk.t >= 1) {
            bk.t = 0; bk.routeIdx = (bk.routeIdx + 1) % route.length;
            if (Math.random() < (bk.waitProb == null ? 0.3 : bk.waitProb)) bk.waitUntil = now + (bk.waitMs || 6000);
          }
        }
      }
      dummy.position.set(px, 0.02, pz);
      dummy.rotation.set(0, rot, 0);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }

  /* ---------- 校园网云团（ShaderMaterial billboard） ---------- */
  function enterWifiView() {
    if (netView === 'wifi') return;
    netView = 'wifi';
    syncWifi(true);
  }
  function exitWifiView() { if (netView !== 'wifi') return; netView = 'none'; disposeWifi(); }
  function disposeWifi() { if (!wifiObjs) return; disposeGroup(wifiObjs.group); wifiObjs = null; }
  function syncWifi(build) {
    window.NetworkData.getWifi(campus, nowMinute()).then(function (data) {
      if (!mounted || netView !== 'wifi') return;
      if (build || !wifiObjs) buildWifiObjects(data);
      else refreshWifiDensity(data);
    });
  }
  var WIFI_COL = function (d) { return d <= 40 ? 0x08D9D6 : d <= 75 ? 0x8A6FD1 : 0xFF2E63; };
  var WIFI_FRAG = 'uniform float uTime; uniform float uDensity; varying vec2 vUv;' +
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }' +
    'float noise(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);' +
    ' float a=hash(i), b=hash(i+vec2(1.0,0.0)), c=hash(i+vec2(0.0,1.0)), d=hash(i+vec2(1.0,1.0));' +
    ' return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }' +
    'void main(){ vec2 p=vUv*4.0; float n=noise(p+uTime*0.15)*0.6+noise(p*2.3-uTime*0.1)*0.4;' +
    ' float r=distance(vUv, vec2(0.5)); float alpha=smoothstep(0.5,0.05,r)*(0.15+0.2*uDensity);' +
    ' vec3 col=mix(vec3(0.05,0.85,1.0), vec3(0.55,0.1,0.45), uDensity);' +
    ' gl_FragColor=vec4(col, alpha*(0.5+0.5*n)); }';
  function buildWifiObjects(data) {
    disposeWifi();
    var g = new THREE.Group();
    var byId = {};
    buildings.forEach(function (b) { byId[b.spotId] = b; });
    var clouds = [];
    data.buildings.forEach(function (d) {
      var b = byId[d.spotId]; if (!b) return;
      if (LOWEND) {
        var mat = new THREE.MeshBasicMaterial({ color: WIFI_COL(d.density), transparent: true, opacity: 0.5, side: THREE.DoubleSide });
        var ring = new THREE.Mesh(new THREE.RingGeometry(1.4, 2.2, 20), mat);
        ring.rotation.x = -Math.PI / 2; ring.position.set(b.x, (b.topY || 3) + 0.4, b.z);
        g.add(ring);
      } else {
        var sm = new THREE.ShaderMaterial({
          uniforms: { uTime: { value: 0 }, uDensity: { value: d.density / 100 } },
          vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
          fragmentShader: WIFI_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
        });
        var sz = Math.max(3, (b.v && b.v.w ? b.v.w : 5) * 2.2);
        var plane = new THREE.Mesh(new THREE.PlaneGeometry(sz, sz), sm);
        plane.position.set(b.x, (b.topY || 3) * 0.55 + 1.5, b.z);
        g.add(plane);
        clouds.push({ mesh: plane, mat: sm, b: b });
      }
    });
    scene.add(g);
    wifiObjs = { group: g, clouds: clouds };
  }
  function refreshWifiDensity(data) {
    if (!wifiObjs || !wifiObjs.clouds) return;
    var byId = {}; data.buildings.forEach(function (d) { byId[d.spotId] = d; });
    wifiObjs.clouds.forEach(function (c) { var d = byId[c.b.spotId]; if (d) c.mat.uniforms.uDensity.value = d.density / 100; });
  }

  /* ---------- 双指缩放聚类展开 ---------- */
  var CLUSTER_DIST = 45, CLUSTER_CELL = 14, clusterTimer = 0;
  function updateCluster(now, dt) {
    if (!buildings.length || mode !== 'overview' || netView !== 'none' || camTween) return;
    clusterTimer -= dt; if (clusterTimer > 0) return; clusterTimer = 0.12;
    var dist = camera.position.distanceTo(controls.target);
    var expanded = dist < CLUSTER_DIST;
    if (!expanded) { buildings.forEach(function (b) { b.clusterTarget = 0; }); return; }
    var cells = {};
    buildings.forEach(function (b) {
      var cx = Math.round(b.x / CLUSTER_CELL), cz = Math.round(b.z / CLUSTER_CELL), key = cx + ',' + cz;
      var c = cells[key] || (cells[key] = { n: 0, sx: 0, sz: 0, list: [] });
      c.n++; c.sx += b.x; c.sz += b.z; c.list.push(b);
    });
    buildings.forEach(function (b) { b.clusterTarget = 0; });
    Object.keys(cells).forEach(function (k) {
      var c = cells[k]; if (c.n < 3) return;
      var cx = c.sx / c.n, cz = c.sz / c.n;
      c.list.forEach(function (b) {
        var dx = b.x - cx, dz = b.z - cz, len = Math.sqrt(dx * dx + dz * dz) || 1;
        var mag = 2.5 + Math.min(6, c.n) * 0.6;
        b.clusterDX = dx / len * mag; b.clusterDZ = dz / len * mag; b.clusterTarget = 1;
      });
    });
  }
  function applyCluster(dt) {
    for (var i = 0; i < buildings.length; i++) {
      var b = buildings[i];
      if (b.clusterTarget === 1) { if (b.clusterK < 1) b.clusterK = Math.min(1, b.clusterK + dt / 0.6); }
      else if (b.clusterK > 0) { b.clusterK = Math.max(0, b.clusterK - dt / 0.6); }
      else continue;
      if (!b.movers) continue;
      var dx = (b.clusterDX || 0) * b.clusterK, dz = (b.clusterDZ || 0) * b.clusterK;
      b.movers.forEach(function (mv) { mv.obj.position.x = mv.bx + dx; mv.obj.position.z = mv.bz + dz; });
    }
  }

  /* ---------- 教师视图 ---------- */
  var teacherObjs = null;
  function dotTexture(hex) {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var ctx = c.getContext('2d');
    ctx.beginPath(); ctx.arc(32, 32, 24, 0, Math.PI * 2);
    ctx.fillStyle = hex; ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = '#2B2620'; ctx.stroke();
    return new THREE.CanvasTexture(c);
  }
  function enterTeacherView() {
    if (netView === 'teachers') return;
    netView = 'teachers';
    syncTeachers(true);
  }
  function exitTeacherView() {
    if (netView !== 'teachers') return;
    netView = 'none';
    disposeTeacher();
    if (eduData) applyLightRate(eduData);
    else buildings.forEach(function (b) { (b.windows || []).forEach(function (w) { w.material.color.set(0xFFE3A8); }); });
  }
  function disposeTeacher() { if (!teacherObjs) return; disposeGroup(teacherObjs.group); teacherObjs = null; }
  function syncTeachers() {
    window.NetworkData.getTeachers(campus, nowMinute()).then(function (data) {
      if (!mounted || netView !== 'teachers') return;
      buildTeacherObjects(data);
    });
  }
  function buildTeacherObjects(data) {
    disposeTeacher();
    var g = new THREE.Group();
    var byId = {}; buildings.forEach(function (b) { byId[b.spotId] = b; });
    var rnd = K.mulberry32(K.hashSeed('teachers:' + campus));
    (data.teachers || []).forEach(function (t) {
      var b = byId[t.spotId]; if (!b) return;
      var col = t.status === 'free' ? 0x6BCB77 : 0x9E9E9E;
      var hex = '#' + ('000000' + col.toString(16)).slice(-6);
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(hex), transparent: true, depthTest: false, depthWrite: false }));
      sp.scale.set(1.5, 1.5, 1);
      sp.position.set(b.x + (rnd() - 0.5) * 3, (b.topY || 3) + 1.2 + rnd() * 2, b.z + (rnd() - 0.5) * 3);
      sp.renderOrder = 58;
      g.add(sp);
    });
    var bySpot = {};
    (data.courses || []).forEach(function (c) { (bySpot[c.spotId] = bySpot[c.spotId] || []).push(c); });
    buildings.forEach(function (b) {
      var cs = bySpot[b.spotId]; if (!cs || !cs.length) return;
      b.windows.forEach(function (w, i) { var c = cs[i % cs.length]; w.material.color.set(c.color || 0xFFE3A8); w.material.transparent = true; w.material.needsUpdate = true; });
    });
    scene.add(g);
    teacherObjs = { group: g, data: data };
  }
  function pickWindowCourse(ev) {
    var r = renderer.domElement.getBoundingClientRect();
    ndc.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    var wins = [];
    buildings.forEach(function (b) { (b.windows || []).forEach(function (w, i) { w.userData.winIdx = i; wins.push(w); }); });
    var hits = ray.intersectObjects(wins, false);
    if (!hits.length) return null;
    var obj = hits[0].object;
    for (var bi = 0; bi < buildings.length; bi++) {
      var b = buildings[bi];
      if (b.windows.indexOf(obj) !== -1) {
        var cs = ((teacherObjs && teacherObjs.data.courses) || []).filter(function (c) { return c.spotId === b.spotId; });
        return { b: b, c: cs[obj.userData.winIdx % cs.length] };
      }
    }
    return null;
  }
  function showCoursePanel(hit) {
    var el = document.getElementById('twinNetworkPanel');
    if (!el) { el = document.createElement('div'); el.id = 'twinNetworkPanel'; el.className = 'twin-network-panel'; host.appendChild(el); }
    var c = hit.c;
    el.innerHTML = '<b>🏫 ' + esc(hit.b.name) + '</b>' + (c ? '<div class="net-course"><span class="net-course-dot" style="background:' + c.color + '"></span><b>' + esc(c.name) + '</b><i>' + c.type + ' · ' + c.start + ':00–' + c.end + ':00 · ' + c.floor + 'F</i></div>' : '<p>该窗口暂无课程</p>');
    el.hidden = false;
  }

  /* ---------- 应急视图 ---------- */
  var emergencyObjs = null;
  function enterEmergencyPanel() {
    if (netView === 'emergency') return;
    netView = 'emergency';
    window.NetworkData.getRisk(campus, nowMinute()).then(function (risk) {
      if (!mounted || netView !== 'emergency') return;
      renderRiskPanel(risk);
    });
  }
  function exitEmergencyPanel() { if (netView !== 'emergency') return; netView = 'none'; hideNetworkPanel(); }
  function renderRiskPanel(risk) {
    var el = document.getElementById('twinNetworkPanel');
    if (!el) { el = document.createElement('div'); el.id = 'twinNetworkPanel'; el.className = 'twin-network-panel'; host.appendChild(el); }
    var items = (risk.items || []).slice(0, 5);
    el.innerHTML = '<b>🚨 风险预测</b>' + (items.length ? '<div class="net-risk">' + items.map(function (x) {
      return '<div class="net-risk-item"><span>' + esc(x.name) + '</span><b>' + x.score + '</b><i>' + esc((x.reasons || []).join('、')) + '</i></div>';
    }).join('') + '</div>' : '<p class="net-risk-ok">当前各网络平稳，暂无高风险点位</p>') +
      '<div class="net-risk-actions"><button type="button" data-sos="fire">🚒 火灾</button><button type="button" data-sos="medical">🚑 医疗急救</button></div>';
    el.hidden = false;
    el.querySelectorAll('[data-sos]').forEach(function (btn) {
      btn.addEventListener('click', function () { triggerEmergency(btn.getAttribute('data-sos')); });
    });
  }
  function triggerEmergency(scenario, spotId) {
    if (netView === 'emergency-view') return;
    var b = null;
    if (spotId) { for (var i = 0; i < buildings.length; i++) if (buildings[i].spotId === spotId) b = buildings[i]; }
    if (!b && buildings.length) {
      b = buildings[0]; var best = -1;
      buildings.forEach(function (x) { var s = (x.crowd || 0) + (x.kind === 'hospital' ? 40 : 0) + (x.kind === 'canteen' ? 20 : 0); if (s > best) { best = s; b = x; } });
    }
    if (!b) return;
    netView = 'emergency-view';
    buildEmergencyScene(b, scenario);
    buildings.forEach(function (x) { x.targetDim = 0.25; (x.mats || []).forEach(function (m) { m.transparent = true; m.needsUpdate = true; }); });
    controls.enabled = false;
    camTween = { fromPos: camera.position.clone(), fromTgt: controls.target.clone(), toPos: new THREE.Vector3(b.x + 9, 9, b.z + 11), toTgt: new THREE.Vector3(b.x, 2, b.z), t0: performance.now(), dur: REDUCED ? 1 : 900, flyTo: 'net' };
    setBackBtn(true);
    if (window.ZXSJ && window.ZXSJ.Sos && window.ZXSJ.Sos.notify) window.ZXSJ.Sos.notify(scenario || 'medical', { spotId: b.spotId, name: b.name, campus: campus });
  }
  function exitEmergency() {
    if (netView !== 'emergency-view') return;
    netView = 'none';
    disposeEmergency();
    setBackBtn(false);
    hideNetworkPanel();   /* V12.1：退出应急视图时一并收起风险预测面板，避免残留遮挡按键 */
    buildings.forEach(function (x) { x.targetDim = 1; });
    controls.enabled = false;
    camTween = { fromPos: camera.position.clone(), fromTgt: controls.target.clone(), toPos: new THREE.Vector3(0, 46, 42), toTgt: new THREE.Vector3(0, 0, 0), t0: performance.now(), dur: REDUCED ? 1 : 800, flyTo: 'net' };
  }
  function disposeEmergency() { if (!emergencyObjs) return; disposeGroup(emergencyObjs.group); emergencyObjs = null; }
  function buildEmergencyScene(b, scenario) {
    disposeEmergency();
    var g = new THREE.Group();
    var color = scenario === 'fire' ? 0xFF2E63 : 0x08D9D6;
    var rings = [];
    for (var k = 0; k < 2; k++) {
      var ring = new THREE.Mesh(new THREE.RingGeometry(2 + k * 1.6, 2.6 + k * 1.6, 40), new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthTest: false, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(b.x, 0.15, b.z); ring.renderOrder = 50;
      g.add(ring); rings.push(ring);
    }
    var shards = [], rnd = K.mulberry32(K.hashSeed('sos:' + b.spotId));
    for (var i = 0; i < 6; i++) {
      var tri = makeTri(K.ACCENTS[i % K.ACCENTS.length]);
      var ang = i / 6 * Math.PI * 2;
      tri.position.set(b.x + Math.cos(ang) * 9, 3 + rnd() * 3, b.z + Math.sin(ang) * 9);
      tri.renderOrder = 51; g.add(tri);
      shards.push({ el: tri, from: tri.position.clone(), to: new THREE.Vector3(b.x + Math.cos(ang) * 1.8, 2.4, b.z + Math.sin(ang) * 1.8) });
    }
    var ribbons = [];
    var near = buildings.filter(function (x) { return x !== b; }).sort(function (p, q) { return dist2(p, b) - dist2(q, b); }).slice(0, 3);
    near.forEach(function (o) {
      var geo = ribbonQuad(b.x, b.z, o.x, o.z, 0.9, 0.16);
      var mat = new THREE.MeshBasicMaterial({ color: 0xF9ED69, transparent: true, opacity: 0.5, depthTest: false, depthWrite: false });
      var m = new THREE.Mesh(geo, mat); m.renderOrder = 49; g.add(m); ribbons.push(m);
    });
    scene.add(g);
    emergencyObjs = { group: g, rings: rings, shards: shards, ribbons: ribbons, t0: performance.now(), b: b };
  }
  function dist2(a, b) { var dx = a.x - b.x, dz = a.z - b.z; return dx * dx + dz * dz; }
  function ribbonQuad(x1, z1, x2, z2, width, y) {
    var dx = x2 - x1, dz = z2 - z1, len = Math.sqrt(dx * dx + dz * dz) || 0.01;
    var nx = -dz / len, nz = dx / len, hw = width / 2;
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([
      x1 + nx * hw, y, z1 + nz * hw, x1 - nx * hw, y, z1 - nz * hw,
      x2 + nx * hw, y, z2 + nz * hw, x2 - nx * hw, y, z2 - nz * hw
    ], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
    geo.setIndex([0, 1, 2, 2, 1, 3]);
    return geo;
  }

  /* ---------- 全网叠加 ---------- */
  var flowObjs = null, trafficDotObjs = null, layerFlags = { flow: true, wifi: true, traffic: true, flag: true };
  function densityColor(d) { return d <= 40 ? 0x6BCB77 : d <= 75 ? 0xF9ED69 : 0xFF2E63; }
  function makeFlowTex() {
    var c = document.createElement('canvas'); c.width = 16; c.height = 64;
    var ctx = c.getContext('2d');
    for (var i = 0; i < 4; i++) { ctx.fillStyle = 'rgba(255,255,255,' + (i % 2 ? 0.55 : 0.15) + ')'; ctx.fillRect(0, i * 16, 16, 8); }
    var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 3);
    return t;
  }
  function enterAllOverlay() {
    if (netView === 'all') return;
    netView = 'all';
    layerFlags = { flow: true, wifi: !LOWEND, traffic: !LOWEND, flag: true };
    buildFlowLayer(); buildWifiForAll(); buildTrafficDots(); renderLayerPanel(); applyLayerFlags();
  }
  function exitAllOverlay() {
    if (netView !== 'all') return;
    netView = 'none';
    if (flowObjs) { disposeGroup(flowObjs.group); flowObjs = null; }
    if (wifiObjs) disposeWifi();
    if (trafficDotObjs) { disposeGroup(trafficDotObjs); trafficDotObjs = null; }
    buildings.forEach(function (b) { if (b.flag) b.flag.group.visible = true; });
    var lp = document.getElementById('twinLayerPanel'); if (lp) { lp.hidden = true; lp.innerHTML = ''; }
    hideNetworkPanel();
  }
  function buildFlowLayer() {
    if (flowObjs) { disposeGroup(flowObjs.group); flowObjs = null; }
    window.NetworkData.getFlow(campus, nowMinute()).then(function (data) {
      if (!mounted || netView !== 'all' || !layerFlags.flow) return;
      var g = new THREE.Group(), tex = makeFlowTex();
      data.roads.forEach(function (r) {
        var pa = toWorld(r.lngA, r.latA), pb = toWorld(r.lngB, r.latB);
        var geo = ribbonQuad(pa.x, pa.z, pb.x, pb.z, 0.6 + r.density / 100 * 1.8, 0.1);
        var baseOp = 0.12 + r.density / 100 * 0.33;
        var mat = new THREE.MeshBasicMaterial({ map: tex, color: densityColor(r.density), transparent: true, opacity: baseOp, depthTest: false, depthWrite: false });
        var m = new THREE.Mesh(geo, mat); m.renderOrder = 44; m.userData.baseOp = baseOp;
        g.add(m);
      });
      scene.add(g);
      flowObjs = { group: g, tex: tex, fade: 1 };
    });
  }
  function buildWifiForAll() {
    if (LOWEND) return;
    if (wifiObjs) disposeWifi();
    window.NetworkData.getWifi(campus, nowMinute()).then(function (data) {
      if (!mounted || netView !== 'all' || !layerFlags.wifi) return;
      buildWifiObjects(data);
    });
  }
  function buildTrafficDots() {
    if (LOWEND) return;
    if (trafficDotObjs) { disposeGroup(trafficDotObjs); trafficDotObjs = null; }
    window.NetworkData.getTraffic(campus, nowMinute()).then(function (data) {
      if (!mounted || netView !== 'all' || !layerFlags.traffic) return;
      var pts = [], pp = {}, roadsById = {};
      data.parkings.forEach(function (pk) { var w = toWorld(pk.lng, pk.lat); pp[pk.id] = w; });
      data.roads.forEach(function (r) { roadsById[r.id] = { a: data.parkings[r.a].id, b: data.parkings[r.b].id }; });
      data.bikes.forEach(function (bk) {
        if (bk.status === 'idle') { var p = pp[bk.parkingId]; if (p) pts.push(p.x, 0.3, p.z); }
        else {
          if (!bk.route || !bk.route.length) return;
          var seg = bk.route[bk.routeIdx % bk.route.length], rd = roadsById[seg.roadId]; if (!rd) return;
          var pa = pp[rd.a], pb = pp[rd.b]; if (!pa || !pb) return;
          var from = seg.dir > 0 ? pa : pb, to = seg.dir > 0 ? pb : pa, k = Math.min(1, Math.max(0, bk.t));
          pts.push(from.x + (to.x - from.x) * k, 0.3, from.z + (to.z - from.z) * k);
        }
      });
      var geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      var mat = new THREE.PointsMaterial({ color: 0x08D9D6, size: 1.6, sizeAttenuation: true, depthTest: false, depthWrite: false, transparent: true, opacity: 0.9 });
      var obj = new THREE.Points(geo, mat); obj.renderOrder = 46;
      scene.add(obj); trafficDotObjs = obj;
    });
  }
  function renderLayerPanel() {
    var el = document.getElementById('twinLayerPanel');
    if (!el) { el = document.createElement('div'); el.id = 'twinLayerPanel'; el.className = 'twin-layer-panel'; host.appendChild(el); }
    var defs = [['flow', '人流'], ['wifi', '云团'], ['traffic', '交通'], ['flag', '旗帜']];
    el.innerHTML = '<b>🗺 全网叠加</b>' + defs.map(function (d) {
      return '<button type="button" class="layer-chip' + (layerFlags[d[0]] ? ' on' : '') + '" data-layer="' + d[0] + '">' + d[1] + '</button>';
    }).join('');
    el.hidden = false;
    el.querySelectorAll('[data-layer]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-layer');
        layerFlags[key] = !layerFlags[key];
        btn.classList.toggle('on', layerFlags[key]);
        applyLayerFlags();
      });
    });
  }
  function applyLayerFlags() {
    if (flowObjs) flowObjs.group.visible = !!layerFlags.flow;
    if (wifiObjs) wifiObjs.group.visible = !!layerFlags.wifi;
    if (trafficDotObjs) trafficDotObjs.visible = !!layerFlags.traffic;
    buildings.forEach(function (b) { if (b.flag) b.flag.group.visible = !!layerFlags.flag; });
  }


  /* ---------- 输入：单击飞入 / 长按详情 / 双击返回 ---------- */
  function pick(ev) {
    var r = renderer.domElement.getBoundingClientRect();
    ndc.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    var meshes = [];
    buildings.forEach(function (b) { b.group.traverse(function (o) { if (o.isMesh) meshes.push(o); }); });
    var hits = ray.intersectObjects(meshes, false);
    if (!hits.length) return null;
    var obj = hits[0].object;
    for (var i = 0; i < buildings.length; i++) { var b = buildings[i]; var found = false; b.group.traverse(function (o) { if (o === obj) found = true; }); if (found) return b; }
    return null;
  }
  function bindInput() {
    renderer.domElement.addEventListener('pointerdown', function (ev) { pressT0 = performance.now(); pressB = pick(ev); pressed = true; });
    renderer.domElement.addEventListener('pointerup', function (ev) {
      if (!pressed) return; pressed = false;
      if (netView === 'teachers') { var wh = pickWindowCourse(ev); if (wh) { showCoursePanel(wh); return; } }
      if (!pressB || pressB !== pick(ev)) return;
      var dt = performance.now() - pressT0;
      if (dt >= 500) { showDetail(pressB); }
      else if (mode === 'overview' && netView === 'none') { enterSingle(pressB); }
    });
    window.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape') return;
      if (netView !== 'none' && netView !== 'emergency-view') {
        setNetwork(null);
        var bar = document.getElementById('twinNetbar');
        if (bar) bar.querySelectorAll('.net-btn').forEach(function (x) { x.classList.remove('active'); });
        return;
      }
      if (mode === 'single') returnOverview();
    });
    var backBtn = document.getElementById('overviewBackBtn');
    if (backBtn) backBtn.addEventListener('click', function () {
      if (netView === 'emergency-view') { if (window.confirm('确认退出应急视图？退出后将回到总览。')) exitEmergency(); return; }
      returnOverview();
    });
  }
  function showDetail(b) {
    var card = document.getElementById('twinOverviewCard');
    if (!card) { card = document.createElement('div'); card.id = 'twinOverviewCard'; card.className = 'twin-overview-card'; host.appendChild(card); }
    card.innerHTML = '<b>' + esc(b.name) + '</b><span>🔥 ' + b.crowd + ' 人 · ' + (b.color === 'green' ? '畅通' : b.color === 'yellow' ? '较拥挤' : '拥挤') + '</span><i class="card-x" id="ovCardX">✕</i>';
    card.hidden = false;
    document.getElementById('ovCardX').addEventListener('click', function () { card.hidden = true; });
    setTimeout(function () { card.hidden = true; }, 2600);
  }

  /* ---------- 单栋网络面板（生活/教育二级浏览） ---------- */
  function renderNetworkPanel(b) {
    var el = document.getElementById('twinNetworkPanel');
    if (!el) { el = document.createElement('div'); el.id = 'twinNetworkPanel'; el.className = 'twin-network-panel'; host.appendChild(el); }
    var html = '';
    if (b.kind === 'canteen' && lifeData) {
      var c = null; (lifeData.canteens || []).forEach(function (x) { if (x.spotId === b.spotId) c = x; });
      if (c) {
        el.innerHTML = '<b>🍚 ' + esc(b.name) + '</b><div class="net-floors" id="netFloors"></div><div class="net-win-grid" id="netWinGrid"></div>';
        el.hidden = false;
        function drawWin(f) {
          var fl = null; c.floors.forEach(function (x) { if (x.floor === f) fl = x; });
          if (!fl) return;
          document.getElementById('netWinGrid').innerHTML = fl.windows.map(function (w) {
            var tier = w.crowd <= 60 ? 'g' : (w.crowd <= 85 ? 'y' : 'r');
            return '<span class="net-window ' + tier + '" title="' + w.name + '">' + w.crowd + '</span>';
          }).join('');
          document.getElementById('netFloors').innerHTML = c.floors.map(function (fl2) {
            return '<button class="net-floor' + (fl2.floor === f ? ' on' : '') + '" data-floor="' + fl2.floor + '">' + fl2.floor + 'F</button>';
          }).join('');
          document.getElementById('netFloors').querySelectorAll('.net-floor').forEach(function (fb) { fb.addEventListener('click', function () { drawWin(+fb.getAttribute('data-floor')); }); });
        }
        drawWin(1);
        return;
      }
    } else if (b.kind === 'express' && lifeData) {
      var ex = null; (lifeData.expresses || []).forEach(function (x) { if (x.spotId === b.spotId) ex = x; });
      if (ex) { html = '<b>📦 ' + esc(b.name) + '</b><div class="net-exp"><span>取件 <b>' + ex.pickup + '%</b></span><span>寄件 <b>' + ex.delivery + '%</b></span></div>'; }
    } else if (b.kind === 'academic' && eduData) {
      var t = null; (eduData.teachings || []).forEach(function (x) { if (x.spotId === b.spotId) t = x; });
      if (t) {
        el.innerHTML = '<b>🏫 ' + esc(b.name) + '</b><div class="net-floors" id="netFloors"></div><div class="net-zones" id="netZones"></div>';
        el.hidden = false;
        function drawZone(f) {
          var fl = null; t.floors.forEach(function (x) { if (x.floor === f) fl = x; });
          if (!fl) return;
          document.getElementById('netZones').innerHTML = fl.zones.map(function (z) {
            return '<div class="net-zone"><span>' + esc(z.name) + '</span><b>' + z.open + '/' + z.total + '</b><i style="width:' + Math.round(z.open / z.total * 100) + '%"></i></div>';
          }).join('');
          document.getElementById('netFloors').innerHTML = t.floors.map(function (fl2) {
            return '<button class="net-floor' + (fl2.floor === f ? ' on' : '') + '" data-floor="' + fl2.floor + '">' + fl2.floor + 'F</button>';
          }).join('');
          document.getElementById('netFloors').querySelectorAll('.net-floor').forEach(function (fb) { fb.addEventListener('click', function () { drawZone(+fb.getAttribute('data-floor')); }); });
        }
        drawZone(1);
        return;
      }
    } else if (b.kind === 'library' && eduData && eduData.library) {
      var lib = eduData.library;
      html = '<b>📚 ' + esc(b.name) + (lib.exam ? '<i class="net-exam">考试周</i>' : '') + '</b>' + lib.studyRooms.map(function (r) {
        var tier = r.crowd <= 60 ? 'g' : (r.crowd <= 85 ? 'y' : 'r');
        return '<div class="net-room"><span>' + esc(r.name) + '</span><b class="' + tier + '">' + r.crowd + '%</b><i>余 ' + r.openSeats + ' 座</i></div>';
      }).join('');
    } else { el.hidden = true; return; }
    el.innerHTML = html; el.hidden = false;
  }
  function hideNetworkPanel() { var el = document.getElementById('twinNetworkPanel'); if (el) el.hidden = true; }
  /* 快递两组包裹堆（涂鸦小盒低模，堆积高度=数值） */
  function buildParcels(b, pickup, delivery) {
    if (LOWEND) return;
    if (b.netGroup) { disposeGroup(b.netGroup); b.netGroup = null; }
    var g = new THREE.Group();
    var vr = K.mulberry32(K.hashSeed(b.spotId + ':parcel'));
    function pile(n, x, color) {
      var cnt = Math.min(12, Math.max(1, Math.round(n / 8)));
      for (var i = 0; i < cnt; i++) {
        var layer = Math.floor(i / 3), col = i % 3;
        var box = K.part(g, K.wobbleGeo(new THREE.BoxGeometry(0.55, 0.5, 0.6), 0.05, vr), color, { gmap: gmap5 });
        box.position.set(x + col * 0.62 + (layer % 2) * 0.3, 0.25 + layer * 0.5, -2.4 + (i % 2) * 0.35);
        box.rotation.y = vr() * 0.5;
      }
    }
    pile(pickup, -2.4, 0xFF2E63);
    pile(delivery, 1.2, 0x08D9D6);
    g.position.set(b.x, 0, b.z);
    scene.add(g); b.netGroup = g;
  }

  /* ---------- 单栋预览 ---------- */
  function enterSingle(b) {
    if (mode !== 'overview' || camTween) return;
    focusB = b; mode = 'flying';
    /* 聚类偏移复位，保证单栋位置与基准一致 */
    buildings.forEach(function (x) { x.clusterK = 0; x.clusterTarget = 0; if (x.movers) x.movers.forEach(function (mv) { mv.obj.position.x = mv.bx; mv.obj.position.z = mv.bz; }); });
    controls.enabled = false;
    var fromPos = camera.position.clone(), fromTgt = controls.target.clone();
    var toPos = new THREE.Vector3(b.x + 11, 9, b.z + 13), toTgt = new THREE.Vector3(b.x, 3.5, b.z);
    camTween = { fromPos: fromPos, fromTgt: fromTgt, toPos: toPos, toTgt: toTgt, t0: performance.now(), dur: REDUCED ? 1 : 1200, flyTo: 'single' };
    shatterOthers(b);
    setBackBtn(true);
  }
  function onSingleReady() {
    mode = 'single';
    var b = focusB;
    b.group.visible = false; b.flag.group.visible = false; b.num.sp.visible = false;
    /* 完整 BUILDERS + 碎片聚合 */
    var full = new THREE.Group();
    var vr = K.mulberry32(K.hashSeed(b.spotId));
    var v = { r: vr, hs: 0.85 + vr() * 0.4, ws: 0.85 + vr() * 0.35, accent: K.ACCENTS[Math.floor(vr() * K.ACCENTS.length)], name: b.name, type: '', shards: [] };
    v.gmap = gmap5;
    try { (K.BUILDERS[b.kind] || K.BUILDERS.fallback)(full, v); }
    catch (e) { K.BUILDERS.fallback(full, v); }
    full.position.set(b.x, 0, b.z);
    if (!LOWEND) full.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.material.map = paperTex; o.material.needsUpdate = true; } });
    scene.add(full);
    b.fullGroup = full; b.fullShards = v.shards || [];
    b.fullShards.forEach(function (fr) { fr.el.position.copy(fr.start); });
    b.introStart = performance.now();
    /* 碎片环绕（慢速转动的小纸片环） */
    orbitShards.forEach(function (s) { scene.remove(s); });
    orbitShards = [];
    for (var i = 0; i < 7; i++) {
      var tri = makeTri(K.ACCENTS[i % K.ACCENTS.length]);
      var ang = (i / 7) * Math.PI * 2;
      tri.position.set(b.x + Math.cos(ang) * 8, 5 + (i % 3) * 1.4, b.z + Math.sin(ang) * 8);
      orbitShards.push({ el: tri, ang: ang, r: 8, y: 5 + (i % 3) * 1.4, cx: b.x, cz: b.z, spin: 0.5 + (i % 4) * 0.2 });
      scene.add(tri);
    }
    /* 快递两组包裹堆 */
    if (b.kind === 'express' && lifeData) {
      var ex = null; (lifeData.expresses || []).forEach(function (x) { if (x.spotId === b.spotId) ex = x; });
      if (ex) buildParcels(b, ex.pickup, ex.delivery);
    }
    renderNetworkPanel(b);
    controls.target.copy(new THREE.Vector3(b.x, 3.5, b.z)); controls.enabled = true;
    updateStats();
  }
  function makeTri(color) {
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0.6, 0, 0.55, -0.4, 0, -0.55, -0.4, 0]), 3));
    var g = new THREE.Group();
    g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: color, side: THREE.DoubleSide })));
    g.add(new THREE.LineLoop(geo, new THREE.LineBasicMaterial({ color: 0x2B2620 })));
    return g;
  }
  function shatterOthers(b) {
    burstGroups.forEach(function (bg) { scene.remove(bg); });
    burstGroups = [];
    buildings.forEach(function (ob) {
      if (ob === b) return;
      var shards = [];
      var rnd = K.mulberry32(K.hashSeed(ob.spotId + 'burst'));
      for (var i = 0; i < 7; i++) {
        var tri = makeTri(K.ACCENTS[i % K.ACCENTS.length]);
        tri.position.set(ob.x, ob.topY, ob.z);
        scene.add(tri); shards.push({ el: tri, from: tri.position.clone(), to: new THREE.Vector3(ob.x + (rnd() - 0.5) * 18, ob.topY + rnd() * 10, ob.z + (rnd() - 0.5) * 18), rot: (rnd() - 0.5) * 6, t0: performance.now() });
      }
      burstGroups.push({ shards: shards, building: ob, hideAt: performance.now() + 800 });
    });
  }
  function returnOverview() {
    if (mode === 'overview' || camTween) return;
    mode = 'flying';
    controls.enabled = false;
    /* 清掉单栋模型与环绕碎片 */
    if (focusB) {
      if (focusB.fullGroup) { disposeGroup(focusB.fullGroup); focusB.fullGroup = null; }
      if (focusB.netGroup) { disposeGroup(focusB.netGroup); focusB.netGroup = null; }
      focusB.group.visible = true; focusB.flag.group.visible = true; focusB.num.sp.visible = true;
    }
    /* G1：散场建筑恢复可见并错峰重新聚合 */
    var nowT = performance.now();
    buildings.forEach(function (b, i) {
      b.group.visible = true; b.flag.group.visible = true; b.num.sp.visible = true;
      b.group.scale.setScalar(0.8);
      b.reaggT0 = nowT + i * 40;
    });
    hideNetworkPanel();
    orbitShards.forEach(function (s) { scene.remove(s.el); }); orbitShards = [];
    var fromPos = camera.position.clone(), fromTgt = controls.target.clone();
    camTween = { fromPos: fromPos, fromTgt: fromTgt, toPos: new THREE.Vector3(0, 46, 42), toTgt: new THREE.Vector3(0, 0, 0), t0: performance.now(), dur: REDUCED ? 1 : 1000, flyTo: 'overview' };
    setBackBtn(false);
  }
  function setBackBtn(on) { var b = document.getElementById('overviewBackBtn'); if (b) b.hidden = !on; }

  /* ---------- 主循环 ---------- */
  function loop(now) {
    if (!mounted || disposed) return;
    if (!active) { rafId = null; return; }   /* V12.1：离开孪生段即暂停渲染（此前 leave() 并未真正停帧） */
    rafId = requestAnimationFrame(loop);
    var dt = Math.min(0.05, (now - (loop._last || now)) / 1000); loop._last = now;
    /* 相机缓动 */
    if (camTween) {
      var k = Math.min(1, (now - camTween.t0) / camTween.dur);
      var e = k < 1 ? (1 - Math.pow(1 - k, 3)) : 1;
      camera.position.lerpVectors(camTween.fromPos, camTween.toPos, e);
      controls.target.lerpVectors(camTween.fromTgt, camTween.toTgt, e);
      if (k >= 1) {
        var flyTo = camTween.flyTo;
        camTween = null;
        if (flyTo === 'single') onSingleReady();
        else { mode = 'overview'; controls.enabled = true; }
        updateStats();
      }
    }
    /* 旗帜飘动 */
    buildings.forEach(function (b) {
      if (!b.flag || b.flag.group.visible === false) return;
      var speed = 200 + b.crowd * 2.6;   /* 飘动速度随拥挤度 */
      if (REDUCED) { b.flag.flag.rotation.x = 0; return; }
      b.flag.flag.rotation.x = Math.sin(now / 400) * 0.12;
      var pa = b.flag.flag.geometry.attributes.position, base = b.flag.flag.userData.base;
      for (var vi = 0; vi < pa.count; vi++) {
        var bx = base[vi * 3], by = base[vi * 3 + 1];
        pa.setZ(vi, base[vi * 3 + 2] + Math.sin(now / speed + bx * 3.0) * 0.12 * (bx + 0.8) + Math.sin(bx * 2.2 + now / 340) * 0.07 * (1 - Math.abs(by) / 0.5));
      }
      pa.needsUpdate = true;
      /* 面向相机（billboard 语义） */
      b.flag.flag.lookAt(camera.position);
      /* 建筑微呼吸 + 屋顶独立摆动（肉眼几乎不可察；聚合动画期间让位） */
      if (!REDUCED && b.group.visible && !b.reaggT0) {
        b.group.scale.setScalar(1 + Math.sin(now * 0.00025 * Math.PI * 2 + b.phase) * 0.005);
        if (b.v && b.v.roof) b.v.roof.rotation.y = Math.sin(now * 0.001 + b.phase) * 0.02;
        /* V12.1 质感：旋转星 / 胶囊十字呼吸 / 烟圈上浮 */
        if (b.v && b.v.star) b.v.star.rotation.z += dt * 0.7;
        if (b.v && b.v.crossMats) for (var cm = 0; cm < b.v.crossMats.length; cm++) b.v.crossMats[cm].emissiveIntensity = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(now / 3000 * Math.PI * 2 + b.phase));
        if (b.v && b.v.smoke) for (var sm = 0; sm < b.v.smoke.length; sm++) {
          var PU = b.v.smoke[sm], pq = ((now * 0.00022) + PU.ph) % 1;
          PU.sp.position.set(PU.x + Math.sin(pq * 6.28) * 0.22, PU.y + pq * 2.1, PU.z);
          var psc = 0.6 + pq * 0.95; PU.sp.scale.set(psc, psc * 0.8, 1);
          PU.sp.material.opacity = 0.32 * Math.sin(Math.PI * pq);
        }
      }
    });
    /* 窗户灯光呼吸（亮窗，相位随机无机械同步；被压暗时让位给 dim 透明度） */
    if (!REDUCED) buildings.forEach(function (b) {
      if (!b.windows || !b.windows.length || !b.litCount || b.group.visible === false || b.targetDim < 1) return;
      for (var wi = 0; wi < b.litCount; wi++) {
        b.windows[wi].material.opacity = 0.7 + Math.sin(now / 6000 * Math.PI * 2 + b.winPhase + wi * 0.9) * 0.3;
      }
    });
    /* G1：返回总览时散场建筑错峰重新聚合（0.5s 缩放回弹） */
    if (!REDUCED) buildings.forEach(function (b) {
      if (!b.reaggT0) return;
      var rg = (now - b.reaggT0) / 500;
      if (rg <= 0) { b.group.scale.setScalar(0.8); return; }
      if (rg >= 1) { b.group.scale.setScalar(1); b.reaggT0 = 0; return; }
      b.group.scale.setScalar(0.8 + 0.2 * (1 - Math.pow(1 - rg, 3)));
    });
    /* G4：远景装饰独立摆动（低于旗帜频率） */
    if (!REDUCED && decoGroup) decoGroup.children.forEach(function (o, di) { o.rotation.y = Math.sin(now * 0.0006 + di * 0.7) * 0.06; });
    /* V12.1：纸云漂浮（makemepulse 式配角） */
    if (!REDUCED && cloudGroup) cloudGroup.children.forEach(function (c, ci) { c.position.y = (ci ? 14.6 : 11.2) + Math.sin(now * 0.0005 + ci * 2.1) * 0.55; c.rotation.y = Math.sin(now * 0.0003 + ci) * 0.18; });
    /* 单栋：碎片聚合 + 环绕 */
    if (mode === 'single' && focusB && focusB.fullGroup) {
      if (!REDUCED) {
        var b = focusB;
        var k2 = Math.min(1, (now - b.introStart) / 850), ee = 1 - Math.pow(1 - k2, 3);
        b.fullShards.forEach(function (fr) { var q = Math.max(0, Math.min(1, (now - b.introStart - fr.delay) / 720)); fr.el.position.lerpVectors(fr.start, fr.base, 1 - Math.pow(1 - q, 3)); });
        orbitShards.forEach(function (s) { s.ang += dt * s.spin * 0.5; s.el.position.set(s.cx + Math.cos(s.ang) * s.r, s.y + Math.sin(now / 900 + s.ang) * 0.5, s.cz + Math.sin(s.ang) * s.r); s.el.rotation.y += dt * 1.2; });
      }
    }
    /* 散场碎片 */
    burstGroups = burstGroups.filter(function (bg) {
      var done = performance.now() - bg.t0;
      bg.shards.forEach(function (s) {
        var q = Math.min(1, (performance.now() - s.t0) / 800), e = 1 - Math.pow(1 - q, 3);
        s.el.position.lerpVectors(s.from, s.to, e); s.el.rotation.set(0, s.rot * e, 0);
      });
      if (performance.now() >= bg.hideAt) { bg.building.group.visible = false; bg.building.flag.group.visible = false; bg.building.num.sp.visible = false; bg.shards.forEach(function (s) { scene.remove(s.el); }); return false; }
      return true;
    });
    /* 低端机假阴影（贴片）在挂载时未做，此处留空保持干净 */
    /* 网络高亮/压暗 0.4s 平滑 */
    buildings.forEach(function (b) {
      if (!b.mats.length || b.group.visible === false) return;
      if (Math.abs(b.dim - b.targetDim) > 0.001) {
        b.dim += (b.targetDim - b.dim) * Math.min(1, dt * 4);
        for (var mi = 0; mi < b.mats.length; mi++) b.mats[mi].opacity = b.dim;
      }
    });
    /* 水体 UV 缓慢滚动 */
    if (waterTex && !REDUCED) { waterTex.offset.x = (waterTex.offset.x + dt * 0.02) % 1; waterTex.offset.y = (waterTex.offset.y + dt * 0.008) % 1; }
    /* P3：交通单车逐帧插值 / 校园网云团 uTime / 双指聚类展开 */
    if (netView === 'traffic' && trafficObjs) updateBikeInstances(dt);
    if (wifiObjs && !REDUCED && (netView === 'wifi' || netView === 'all')) wifiObjs.clouds.forEach(function (c) { c.mat.uniforms.uTime.value = now * 0.001; c.mesh.lookAt(camera.position); });
    /* P4：应急视图动画（红脉冲 / 碎片聚成箭头 / 疏散流动带） */
    if (emergencyObjs) {
      var eo = emergencyObjs, el2 = now - eo.t0;
      eo.rings.forEach(function (r, i) { var p = ((el2 / 1200) + i * 0.5) % 1; r.scale.setScalar(1 + p * 1.6); r.material.opacity = 0.55 * (1 - p); });
      eo.shards.forEach(function (s) { var q = Math.min(1, el2 / 900), ee = 1 - Math.pow(1 - q, 3); s.el.position.lerpVectors(s.from, s.to, ee); s.el.rotation.z += 0.02; });
      eo.ribbons.forEach(function (m, i) { m.material.opacity = 0.35 + Math.sin(now * 0.004 + i) * 0.2; });
    }
    /* P4：人流色带——相机远隐藏、近渐入、贴地流动 */
    if (flowObjs) {
      var fd = camera.position.distanceTo(controls.target);
      var ftarget = fd < 55 ? 1 : (fd > 70 ? 0 : (70 - fd) / 15);
      flowObjs.fade += (ftarget - flowObjs.fade) * Math.min(1, dt * 4);
      flowObjs.group.visible = flowObjs.fade > 0.02 && !!layerFlags.flow;
      if (flowObjs.tex) flowObjs.tex.offset.y = (flowObjs.tex.offset.y + dt * 0.6) % 1;
      if (flowObjs.group.visible) flowObjs.group.children.forEach(function (m) { if (m.material && m.userData.baseOp != null) m.material.opacity = m.userData.baseOp * flowObjs.fade; });
    }
    if (!REDUCED) { updateCluster(now, dt); applyCluster(dt); }
    /* 昼夜光照跟随孪生段（twin-night），避免夜间仍按白天强光渲染导致发白 */
    var night = !!window.__twinNight;
    key.d.intensity += ((night ? 0.38 : 0.75) - key.d.intensity) * 0.06;
    key.amb.intensity += ((night ? 0.26 : 0.42) - key.amb.intensity) * 0.06;
    if (key.hemi) key.hemi.intensity += ((night ? 0.18 : 0.36) - key.hemi.intensity) * 0.06;
    key.pt.intensity += ((night ? 0.55 : 0.35) - key.pt.intensity) * 0.06;
    if (scene.background && DAY_BG) scene.background.lerp(night ? NIGHT_BG : DAY_BG, 0.06);
    if (scene.fog && scene.background) scene.fog.color.copy(scene.background);
    controls.update();
    renderer.render(scene, camera);
    /* 每 128 帧读一次 stats */
    if ((loop._f = (loop._f || 0) + 1) % 128 === 0) updateStats();
  }
  function updateStats() {
    var tris = 0, meshes = 0, n = 0;
    scene.traverse(function (o) {
      if (o.isMesh) { meshes++; if (o.geometry) tris += o.geometry.attributes.position ? Math.floor(o.geometry.attributes.position.count / 3) : 0; }
    });
    buildings.forEach(function (b) { if (b.group.visible) n++; });
    window.__twin3dStats = { mode: mode, buildings: mode === 'single' ? 1 : n, triangles: tris, meshes: meshes };
  }

  function onResize() { if (!renderer || !host) return; camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(host.clientWidth, host.clientHeight); }
  function enter() { active = true; if (!rafId) { loop._last = performance.now(); rafId = requestAnimationFrame(loop); } }
  function leave() { active = false; }

  window.TwinOverview = {
    available: function () { return true; },
    ready: function () { return !!mounted && !disposed; },   /* V12.1：供 UI 判断 3D 是否就绪 */
    mount: mount,
    enter: enter,
    leave: leave,
    sync: sync,
    /* V12.1 修复「按键无响应」：公共方法一律「未挂载即安全返回 + 内部兜底不抛错」，3D 失败不再连坐 2D 按键 */
    setNetwork: function (net) {
      if (!mounted || disposed) return false;
      try { setNetwork(net); return true; } catch (e) { try { console.error('[twin] setNetwork failed:', e); } catch (x) {} return false; }
    },
    returnOverview: function () {
      if (!mounted || disposed) return false;
      try { returnOverview(); return true; } catch (e) { try { console.error('[twin] returnOverview failed:', e); } catch (x) {} return false; }
    },
    getMode: function () { return mode; },
    getNetView: function () { return netView; },
    triggerEmergency: function (scenario, spotId) {
      if (!mounted || disposed) return false;
      try { triggerEmergency(scenario, spotId); return true; } catch (e) { try { console.error('[twin] triggerEmergency failed:', e); } catch (x) {} return false; }
    },
    exitEmergency: function () {
      if (!mounted || disposed) return false;
      try { exitEmergency(); return true; } catch (e) { try { console.error('[twin] exitEmergency failed:', e); } catch (x) {} return false; }
    },
    setCampus: function (c) {
      if (!mounted || disposed) return false;
      if (c === campus) return true;
      try {
        /* 释放所有网络视图资源（交通/校园网/教师/应急/全网叠加），避免跨校区残留 */
        if (trafficObjs) disposeTraffic();
        if (wifiObjs) disposeWifi();
        if (teacherObjs) disposeTeacher();
        if (emergencyObjs) disposeEmergency();
        if (flowObjs) { disposeGroup(flowObjs.group); flowObjs = null; }
        if (trafficDotObjs) { disposeGroup(trafficDotObjs); trafficDotObjs = null; }
        var lp = document.getElementById('twinLayerPanel'); if (lp) { lp.hidden = true; lp.innerHTML = ''; }
        hideNetworkPanel();
        netView = 'none'; netFilter = null; camTween = null;
        /* 单栋预览 / 散场碎片一并清理，避免引用已销毁的建筑 */
        if (focusB) {
          if (focusB.fullGroup) { disposeGroup(focusB.fullGroup); focusB.fullGroup = null; }
          if (focusB.netGroup) { disposeGroup(focusB.netGroup); focusB.netGroup = null; }
        }
        focusB = null; mode = 'overview'; controls.enabled = true;
        orbitShards.forEach(function (s) { scene.remove(s.el); }); orbitShards = [];
        burstGroups.forEach(function (bg) { bg.shards.forEach(function (s) { scene.remove(s.el); }); }); burstGroups = [];
        buildings.forEach(function (b) { b.hotSince = null; });
        setBackBtn(false);
        campus = c;
        buildCampus(); updateStats();   /* 同步由 switchCampus 的 tick(true) 统一触发，避免双 sync 误触发应急 */
        return true;
      } catch (e) {
        try { console.error('[twin] setCampus failed:', e); } catch (x) {}
        /* 兜底恢复到可用总览（campus 已切换则按新校区重建） */
        try { netView = 'none'; netFilter = null; camTween = null; focusB = null; mode = 'overview'; if (controls) controls.enabled = true; setBackBtn(false); buildCampus(); } catch (e2) {}
        return false;
      }
    },
    focus: function (spotId) {
      if (!mounted || disposed) return false;
      try { for (var i = 0; i < buildings.length; i++) if (buildings[i].spotId === spotId) { if (mode === 'overview') enterSingle(buildings[i]); return true; } } catch (e) {}
      return false;
    },
    dispose: function () { disposed = true; if (rafId) cancelAnimationFrame(rafId); window.removeEventListener('resize', onResize); if (renderer) { renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss(); renderer.domElement.remove(); } scene = null; renderer = null; mounted = false; }
  };
  /* 自检钩子：强制触发应急（不依赖 60s 累积） */
  window.__twinForceEmergency = function (scenario, spotId) { triggerEmergency(scenario || 'fire', spotId); };
})();
