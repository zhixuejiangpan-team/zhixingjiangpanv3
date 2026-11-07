/* ============================================================
   智行江畔 V9.0 —— 涂鸦风格 3D 建模查看器（Doodle 3D）
   美术方向：参考 2019.makemepulse.com（手绘涂鸦 + 高饱和撞色）
   技术底座：Three.js r147 UMD（本地 js/vendor/，零 CDN）
   涂鸦语言：
   ① 手绘抖线：所有几何体按 spotId 种子做顶点抖动（wonky box）
   ② 描边：黑色墨水轮廓（inverted hull，BackSide 放大 1.035）
   ③ 平涂：MeshToonMaterial + 3 阶渐变 map（卡通着色）
   ④ 独立建模：每栋按种子随机比例/屋顶/配色 + 涂鸦小道具（旗/星/树/绕线）
   ⑤ 实时人数涂鸦流动：
      - 涂鸦小人粒子（Canvas 手绘贴图），重力+风力+反弹+两两碰撞
      - 门口「人流流动线」：沿贝塞尔路径移动的涂鸦点，速度随拥挤度
      - 手绘计数牌（Canvas 蜡笔数字），实时人数变化时弹跳
   ⑥ 涂鸦交互：点击建筑喷出星星爆点 + 抖动；悬停轻微倾斜；
      手势控制可选（ZXSJ.Gestures）。
   红线：同时仅一个渲染循环；DPR≤2；低端机关阴影/轮廓/粒子；关闭即释放。
   ============================================================ */
(function () {
  'use strict';
  var NO3D = /[?&]no3d=1/.test(location.search);
  var _avail = null;
  var viewer = null;

  function cssVar(name, fb) { var v = ''; try { v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); } catch (e) {} return v || fb; }
  function levelColor(level) { return cssVar('--twin-' + level, level === 'green' ? '#12A36B' : level === 'yellow' ? '#FFB000' : '#FF3B5C'); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function detect() {
    if (_avail !== null) return _avail;
    if (NO3D) { _avail = false; return _avail; }
    try { var c = document.createElement('canvas'); _avail = !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { _avail = false; }
    return _avail;
  }

  /* ---------- 种子随机 ---------- */
  function hashSeed(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  var ACCENTS = [0xFF3B5C, 0x2E6BFF, 0xFFB000, 0x12A36B, 0x8A6FD1, 0x3FA8B4];
  var INK = 0x2B2620;

  /* ---------- 蜡笔/涂鸦 Canvas 贴图 ---------- */
  function doodlePersonTexture(hex, rnd) {
    try {
      var c = document.createElement('canvas'); c.width = c.height = 64;
      var ctx = c.getContext('2d');
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      /* 头：手绘双圈 */
      ctx.strokeStyle = '#26221B'; ctx.lineWidth = 3.5;
      ctx.fillStyle = hex;
      ctx.beginPath(); ctx.arc(32 + (rnd() - 0.5) * 4, 17 + (rnd() - 0.5) * 3, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (rnd() < 0.3) { ctx.beginPath(); ctx.arc(32, 17, 12 + rnd() * 2, 0.2, Math.PI * 1.9); ctx.stroke(); }
      /* 脚下淡墨影 */
      ctx.save(); ctx.globalAlpha = 0.2; ctx.fillStyle = '#26221B'; ctx.beginPath(); ctx.ellipse(32, 61, 13, 2.4, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.fillStyle = hex;
      /* 身体涂鸦线 */
      ctx.beginPath(); ctx.moveTo(32, 29); ctx.lineTo(32, 52); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(32, 37); ctx.lineTo(17, 30 + (rnd() - 0.5) * 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(32, 37); ctx.lineTo(47, 30 + (rnd() - 0.5) * 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(32, 52); ctx.lineTo(24, 62); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(32, 52); ctx.lineTo(41, 62); ctx.stroke();
      var t = new THREE.CanvasTexture(c);
      return t;
    } catch (e) { return null; }
  }
  function starTexture(color, rnd) {
    try {
      var c = document.createElement('canvas'); c.width = c.height = 64;
      var ctx = c.getContext('2d');
      ctx.fillStyle = color; ctx.strokeStyle = '#26221B'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
      var points = 6 + Math.floor(rnd() * 5), open = rnd() < 0.34;
      ctx.beginPath();
      for (var s = 0; s < points * 2; s++) { var rr = s % 2 ? 9 + rnd() * 4 : 26; var a = s / (points * 2) * Math.PI * 2 - Math.PI / 2; ctx.lineTo(32 + Math.cos(a) * rr, 32 + Math.sin(a) * rr); }
      if (!open) { ctx.closePath(); ctx.fill(); }
      ctx.stroke();
      return new THREE.CanvasTexture(c);
    } catch (e) { return null; }
  }
  function toonGradient() {
    var steps = 4, c = document.createElement('canvas'); c.width = 1; c.height = steps;
    var ctx = c.getContext('2d');
    var g = ctx.createLinearGradient(0, 0, 0, steps);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#c8c8c8'); g.addColorStop(0.8, '#7f7f7f'); g.addColorStop(1, '#3f3f3f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1, steps);
    var t = new THREE.CanvasTexture(c);
    t.minFilter = THREE.NearestFilter; t.magFilter = THREE.NearestFilter;
    return t;
  }
  function signTexture(draw) {
    var c = document.createElement('canvas'); c.width = 256; c.height = 128;
    draw(c.getContext('2d'));
    return new THREE.CanvasTexture(c);
  }
  function drawCountSign(ctx, n, levelColorHex, rnd) {
    ctx.clearRect(0, 0, 256, 128);
    /* 手绘边框（双圈抖线） */
    ctx.strokeStyle = '#26221B'; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.setLineDash([9, 5]);
    ctx.beginPath();
    for (var i = 0; i <= 32; i++) {
      var a = i / 32 * Math.PI * 2, r = 58 + (rnd() - 0.5) * 4;
      var x = 128 + Math.cos(a) * r, y = 64 + Math.sin(a) * r * 0.8;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.stroke();
    ctx.beginPath();
    for (var j = 0; j <= 32; j++) {
      var a2 = j / 32 * Math.PI * 2, r2 = 52 + (rnd() - 0.5) * 4;
      var x2 = 128 + Math.cos(a2) * r2, y2 = 64 + Math.sin(a2) * r2 * 0.8;
      if (j === 0) ctx.moveTo(x2, y2); else ctx.lineTo(x2, y2);
    }
    ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
    /* 蜡笔大数字 */
    ctx.font = 'bold 54px "Comic Sans MS", "Chalkboard SE", "Segoe Print", cursive';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = levelColorHex;
    ctx.strokeStyle = '#26221B'; ctx.lineWidth = 2;
    var txt = String(n);
    ctx.save();
    ctx.translate(128, 66);
    ctx.rotate((rnd() - 0.5) * 0.16);
    ctx.strokeText(txt, 1, -1); ctx.strokeText(txt, 0, 0); ctx.fillText(txt, 0, 0);
    ctx.restore();
    ctx.font = 'bold 22px "Comic Sans MS", "Chalkboard SE", cursive';
    ctx.fillStyle = '#26221B';
    ctx.fillText('人 · 实时', 128, 106);
  }

  /* ---------- 涂鸦建模工具 ---------- */
  function wobbleGeo(geo, amt, rand) {
    var pos = geo.attributes.position;
    var v = new THREE.Vector3();
    for (var i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      v.x += (rand() - 0.5) * amt; v.y += (rand() - 0.5) * amt; v.z += (rand() - 0.5) * amt;
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }
  /* 一个涂鸦部件 = 平涂体 + 黑色描边（倒置外壳） */
  function part(parent, geo, color, opts) {
    opts = opts || {};
    var g = new THREE.Group();
    var mat = new THREE.MeshToonMaterial({ color: color, gradientMap: opts.gmap, emissive: opts.emissive || 0x000000, emissiveIntensity: opts.emissiveIntensity || 0 });
    var mesh = new THREE.Mesh(geo, mat);
    g.add(mesh);
    var outline = new THREE.Mesh(geo.clone(), new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }));
    outline.scale.setScalar(1.045);
    g.add(outline);
    if (opts.pos) g.position.set(opts.pos[0], opts.pos[1], opts.pos[2]);
    if (opts.rot) g.rotation.set(opts.rot[0] || 0, opts.rot[1] || 0, opts.rot[2] || 0);
    if (opts.scale) g.scale.set(opts.scale[0], opts.scale[1], opts.scale[2]);
    parent.add(g);
    return g;
  }
  function flat(parent, geo, color, opts) {   /* 平面双面平涂（旗/招牌） */
    opts = opts || {};
    var m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: color, side: THREE.DoubleSide }));
    if (opts.pos) m.position.set(opts.pos[0], opts.pos[1], opts.pos[2]);
    if (opts.rot) m.rotation.set(opts.rot[0] || 0, opts.rot[1] || 0, opts.rot[2] || 0);
    parent.add(m);
    return m;
  }

  /* ---------- 独立建模（每类细节更丰富 + 涂鸦道具，参数由种子随机） ---------- */
  var BUILDERS = {
    canteen: function (g, v) {
      var h = 4 * v.hs, w = 10 * v.ws, d = 7 * v.ws;
      part(g, wobbleGeo(new THREE.BoxGeometry(w, h, d), 0.12, v.r), 0xF6E7C8, { gmap: v.gmap, pos: [0, h / 2, 0] });
      part(g, wobbleGeo(new THREE.ConeGeometry(Math.max(w, d) * 0.62, 2.6 * v.hs, 4), 0.14, v.r), v.accent, { gmap: v.gmap, pos: [0, h + 1.3 * v.hs, 0], rot: [0, Math.PI / 4 + v.r() * 0.5, 0] });
      /* 蜡笔烟囱 */
      part(g, wobbleGeo(new THREE.CylinderGeometry(0.5, 0.62, 1.6, 7), 0.1, v.r), 0xC75D6E, { gmap: v.gmap, pos: [w * 0.3, h + 2.2, d * 0.2] });
      /* 发光窗（平涂暖色块） */
      var winMat = new THREE.MeshBasicMaterial({ color: 0xFFE3A8 });
      var cols = 5, rowsN = 2;
      for (var c2 = 0; c2 < cols; c2++) for (var r2 = 0; r2 < rowsN; r2++) {
        var win = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.8), winMat);
        win.position.set(-w * 0.38 + c2 * (w * 0.76 / (cols - 1)), h * 0.3 + r2 * 1.7, d / 2 + 0.02);
        g.add(win);
      }
      /* 门口雨棚 + 手绘招牌 */
      part(g, wobbleGeo(new THREE.BoxGeometry(4 * v.ws, 0.18, 1.8), 0.08, v.r), v.accent, { gmap: v.gmap, pos: [0, h * 0.66, d / 2 + 1.1] });
      /* 涂鸦道具：旗子 */
      doodleFlag(g, v, w * 0.42, h + 3.6, d * 0.3);
      doodleStars(g, v, 2, w * 0.5, h + 4.2);
    },
    stadium: function (g, v) {
      var s = 1 + v.r() * 0.5;
      var track = new THREE.Mesh(new THREE.RingGeometry(4.2, 6, 48), new THREE.MeshToonMaterial({ color: 0xD65A72, gradientMap: v.gmap }));
      track.rotation.x = -Math.PI / 2; track.scale.set(1.5 * s, 1, s); track.position.y = 0.06; g.add(track);
      [4.7, 5.4, 6.0].forEach(function (r) {
        var lane = new THREE.Mesh(new THREE.RingGeometry(r - 0.05, r, 48), new THREE.MeshBasicMaterial({ color: 0xFFFFFF }));
        lane.rotation.x = -Math.PI / 2; lane.scale.set(1.5 * s, 1, s); lane.position.y = 0.08; g.add(lane);
      });
      var field = new THREE.Mesh(new THREE.CircleGeometry(4.2, 48), new THREE.MeshToonMaterial({ color: 0x5FBF8F, gradientMap: v.gmap }));
      field.rotation.x = -Math.PI / 2; field.scale.set(1.5 * s, 1, s); field.position.y = 0.05; g.add(field);
      /* 看台（两段小盒） */
      part(g, wobbleGeo(new THREE.BoxGeometry(5 * s, 1.6, 1.4), 0.12, v.r), v.accent, { gmap: v.gmap, pos: [-2.2 * s, 0.8, 4.4 * s] });
      part(g, wobbleGeo(new THREE.BoxGeometry(5 * s, 1.6, 1.4), 0.12, v.r), v.accent, { gmap: v.gmap, pos: [2.2 * s, 0.8, 4.4 * s] });
      /* 球门 + 篮架 */
      var post = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
      [[-7.2 * s, 0], [7.2 * s, 0]].forEach(function (p) {
        var bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 8), post); bar.rotation.z = Math.PI / 2; bar.position.set(p[0], 0.8, 0); g.add(bar);
      });
      [[0, -3.2 * s], [0, 3.2 * s]].forEach(function (p) {
        var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.2, 8), post); pole.position.set(p[0], 1.6, p[1]); g.add(pole);
        part(g, wobbleGeo(new THREE.BoxGeometry(1.4, 0.9, 0.08), 0.06, v.r), v.accent, { gmap: v.gmap, pos: [p[0], 3.1, p[1]] });
      });
      doodleStars(g, v, 2, 0, 4.5);
    },
    library: function (g, v) {
      var h = 7 * v.hs, w = 9 * v.ws, d = 6 * v.ws;
      part(g, wobbleGeo(new THREE.BoxGeometry(w, h, d), 0.14, v.r), 0x9AA8C8, { gmap: v.gmap, pos: [0, h / 2, 0] });
      /* 玻璃幕墙竖条 */
      var gm = new THREE.MeshBasicMaterial({ color: v.r() < 0.5 ? 0x8FB6D9 : 0x9FD4C8, transparent: true, opacity: 0.75 });
      for (var i = 0; i < 9; i++) {
        var strip = new THREE.Mesh(new THREE.BoxGeometry(0.55, h * 0.88, 0.1), gm);
        strip.position.set(-w * 0.44 + i * (w * 0.88 / 8), h * 0.46, d / 2 + 0.05); g.add(strip);
      }
      /* 退台两层 + 书脊装饰 */
      part(g, wobbleGeo(new THREE.BoxGeometry(w * 0.7, 1.6, d * 0.7), 0.1, v.r), 0xB8C2DA, { gmap: v.gmap, pos: [0, h + 0.8, 0] });
      part(g, wobbleGeo(new THREE.BoxGeometry(w * 0.45, 1.3, d * 0.45), 0.1, v.r), v.accent, { gmap: v.gmap, pos: [0, h + 2.2, 0] });
      /* 台阶 */
      for (var k = 0; k < 3; k++) part(g, wobbleGeo(new THREE.BoxGeometry(2.6 - k * 0.5, 0.18, 0.9), 0.06, v.r), 0x8A92A6, { gmap: v.gmap, pos: [0, 0.1 + k * 0.18, d / 2 + 0.5 + (2 - k) * 0.4] });
      doodleFlag(g, v, -w * 0.46, h + 3.4, d * 0.25);
      doodleStars(g, v, 1, w * 0.4, h + 4.6);
    },
    express: function (g, v) {
      var w = 7 * v.ws, h = 3 * v.hs, d = 5 * v.ws;
      part(g, wobbleGeo(new THREE.BoxGeometry(w, h, d), 0.12, v.r), 0xE8D5AC, { gmap: v.gmap, pos: [0, h / 2, 0] });
      /* 货架 + 散落快递盒 */
      var shelf = new THREE.MeshToonMaterial({ color: 0xC7A26B, gradientMap: v.gmap });
      for (var r = 0; r < 2; r++) for (var c = 0; c < 3; c++) {
        var cell = new THREE.Mesh(wobbleGeo(new THREE.BoxGeometry(1.4, 0.9, 0.9), 0.08, v.r), shelf);
        cell.position.set(-w * 0.3 + c * (w * 0.6 / 2), 0.5 + r * 1.1, d / 2 - 0.5); g.add(cell);
      }
      [[-w * 0.35, d * 0.3], [w * 0.2, -d * 0.25]].forEach(function (p) {
        var box = new THREE.Mesh(wobbleGeo(new THREE.BoxGeometry(0.9, 0.7, 0.8), 0.08, v.r), new THREE.MeshToonMaterial({ color: ACCENTS[Math.floor(v.r() * ACCENTS.length)], gradientMap: v.gmap }));
        box.position.set(p[0], 0.35, p[1]); box.rotation.y = v.r() * Math.PI; g.add(box);
      });
      /* 门头招牌色块 */
      part(g, wobbleGeo(new THREE.BoxGeometry(w * 0.7, 0.7, 0.16), 0.06, v.r), v.accent, { gmap: v.gmap, pos: [0, h * 0.92, d / 2 + 0.05] });
      doodleFlag(g, v, w * 0.4, h + 1.8, d * 0.3);
    },
    hospital: function (g, v) {
      var w = 8 * v.ws, h = 4.5 * v.hs, d = 6 * v.ws;
      part(g, wobbleGeo(new THREE.BoxGeometry(w, h, d), 0.12, v.r), 0xF4F4EF, { gmap: v.gmap, pos: [0, h / 2, 0] });
      /* 红色十字（两盒交叉） */
      part(g, wobbleGeo(new THREE.BoxGeometry(1.7, 0.55, 0.18), 0.05, v.r), 0xD9534F, { gmap: v.gmap, pos: [0, h * 0.82, d / 2 + 0.05] });
      part(g, wobbleGeo(new THREE.BoxGeometry(0.55, 1.7, 0.18), 0.05, v.r), 0xD9534F, { gmap: v.gmap, pos: [0, h * 0.82, d / 2 + 0.05] });
      /* 入口台阶 */
      for (var i = 0; i < 3; i++) part(g, wobbleGeo(new THREE.BoxGeometry(3 - i * 0.6, 0.18, 0.9), 0.06, v.r), 0x9AA3B2, { gmap: v.gmap, pos: [0, 0.09 + i * 0.18, d / 2 + 0.5 + (2 - i) * 0.45] });
      /* 涂鸦树 */
      doodleTree(g, v, w * 0.55, 0, d * 0.5);
    },
    fallback: function (g, v) {
      var cube = part(g, wobbleGeo(new THREE.BoxGeometry(3.2 * v.ws, 3.2 * v.hs, 3.2 * v.ws), 0.16, v.r), 0xB8C2DA, { gmap: v.gmap, pos: [0, 1.6 * v.hs, 0] });
      cube.rotation.y = v.r() * Math.PI;
      part(g, wobbleGeo(new THREE.BoxGeometry(1.4, 1.4, 1.4), 0.1, v.r), v.accent, { gmap: v.gmap, pos: [0, 3.9 * v.hs, 0] });
      doodleStars(g, v, 2, 0, 5);
    }
  };

  /* 涂鸦道具 */
  function doodleFlag(g, v, x, y, z) {
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), new THREE.MeshBasicMaterial({ color: 0x26221B }));
    pole.position.set(x, y + 1.1, z); g.add(pole);
    var flag = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.9), new THREE.MeshBasicMaterial({ color: v.accent, side: THREE.DoubleSide }));
    flag.position.set(x + 0.75, y + 1.9, z); flag.rotation.y = v.r() * 0.3;
    g.add(flag);
    g.userData.props = g.userData.props || [];
    g.userData.props.push({ el: flag, kind: 'flag', phase: v.r() * 10 });
  }
  function doodleStars(g, v, n, x, y) {
    for (var i = 0; i < n; i++) {
      var tex = starTexture('#' + ACCENTS[Math.floor(v.r() * ACCENTS.length)].toString(16).padStart(6, '0'), v.r);
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      sp.position.set(x + (v.r() - 0.5) * 4, y + (v.r() - 0.5) * 3, (v.r() - 0.5) * 4);
      sp.scale.setScalar(0.8 + v.r() * 0.7);
      g.add(sp);
      g.userData.props = g.userData.props || [];
      g.userData.props.push({ el: sp, kind: 'star', phase: v.r() * 10, base: sp.position.clone() });
    }
  }
  function doodleTree(g, v, x, y, z) {
    var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.6, 7), new THREE.MeshToonMaterial({ color: 0x8A6A48, gradientMap: v.gmap }));
    trunk.position.set(x, 0.8, z); g.add(trunk);
    var crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0, 0), new THREE.MeshToonMaterial({ color: 0x4CAF7D, gradientMap: v.gmap }));
    crown.position.set(x, 2.1, z); crown.rotation.y = v.r() * 3;
    g.add(crown);
  }

  /* ---------- V11 碎纸拼贴升级：共享部件 + 八类建筑 ----------
     所有碎片由参数生成；同一 spotId 的形状、色彩、错位与动画相位完全确定。 */
  function colorHex(n) { return '#' + n.toString(16).padStart(6, '0'); }
  function canvasTexture(w, h, draw) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    var t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
  }
  function shrinkPoly(points, gap) {
    var cx = 0, cy = 0;
    points.forEach(function (p) { cx += p[0]; cy += p[1]; }); cx /= points.length; cy /= points.length;
    return points.map(function (p) { return [cx + (p[0] - cx) * (1 - gap), cy + (p[1] - cy) * (1 - gap)]; });
  }
  function gridShards(w, h, cols, rows, rnd, gap) {
    var out = [], cw = w / cols, ch = h / rows;
    for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) {
      var x0 = -w / 2 + x * cw, y0 = -h / 2 + y * ch, j = Math.min(cw, ch) * 0.09;
      var p = [
        [x0 + (rnd() - 0.5) * j, y0 + (rnd() - 0.5) * j],
        [x0 + cw + (rnd() - 0.5) * j, y0 + (rnd() - 0.5) * j],
        [x0 + cw + (rnd() - 0.5) * j, y0 + ch + (rnd() - 0.5) * j],
        [x0 + (rnd() - 0.5) * j, y0 + ch + (rnd() - 0.5) * j]
      ];
      if ((x + y) % 3 === 1) p = [p[0], p[1], p[3]];
      out.push(shrinkPoly(p, gap || 0.025));
    }
    return out;
  }
  function discShards(r, n, rnd, gap, inner) {
    var out = [], step = Math.PI * 2 / n;
    for (var i = 0; i < n; i++) {
      var a0 = i * step + step * 0.035, a1 = (i + 1) * step - step * 0.035;
      var rr = r * (0.96 + rnd() * 0.05), ri = inner || 0;
      var p = ri ? [
        [Math.cos(a0) * ri, Math.sin(a0) * ri], [Math.cos(a0) * rr, Math.sin(a0) * rr],
        [Math.cos(a1) * rr, Math.sin(a1) * rr], [Math.cos(a1) * ri, Math.sin(a1) * ri]
      ] : [[0, 0], [Math.cos(a0) * rr, Math.sin(a0) * rr], [Math.cos(a1) * rr, Math.sin(a1) * rr]];
      out.push(shrinkPoly(p, gap || 0.018));
    }
    return out;
  }
  function paperShard(g, v, points, color, opts) {
    opts = opts || {}; v.shards = v.shards || [];
    var shape = new THREE.Shape(); shape.moveTo(points[0][0], points[0][1]);
    for (var i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]); shape.closePath();
    var group = new THREE.Group();
    var mat = new THREE.MeshBasicMaterial({ color: color, side: THREE.DoubleSide, transparent: true, opacity: opts.opacity == null ? 1 : opts.opacity, depthWrite: opts.depthWrite !== false });
    var mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat); group.add(mesh);
    var lp = points.map(function (p) { return new THREE.Vector3(p[0], p[1], 0.018); });
    var line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(lp), new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: opts.opacity == null ? 0.92 : opts.opacity })); group.add(line);
    if (opts.pos) group.position.set(opts.pos[0], opts.pos[1], opts.pos[2]);
    if (opts.rot) group.rotation.set(opts.rot[0] || 0, opts.rot[1] || 0, opts.rot[2] || 0);
    g.add(group);
    var a = v.r() * Math.PI * 2, lift = 2.5 + v.r() * 4;
    v.shards.push({ el: group, base: group.position.clone(), start: group.position.clone().add(new THREE.Vector3(Math.cos(a) * lift, (v.r() - 0.25) * lift, Math.sin(a) * lift)), delay: (v.shards.length % 12) * 45, spin: (v.r() - 0.5) * 0.8 });
    return group;
  }
  function labelPlane(g, text, color, pos, size, rotate) {
    var tex = canvasTexture(512, 160, function (ctx, w, h) {
      ctx.fillStyle = '#FEFBF6'; ctx.strokeStyle = '#2B2620'; ctx.lineWidth = 8; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(18, 24); ctx.lineTo(w - 24, 12); ctx.lineTo(w - 12, h - 25); ctx.lineTo(24, h - 10); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.font = 'bold 82px "ZCOOL KuaiLe", "Comic Sans MS", "STKaiti", cursive'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = color; ctx.strokeStyle = '#2B2620'; ctx.lineWidth = 3; ctx.strokeText(text, w / 2, h / 2 + 4); ctx.fillText(text, w / 2, h / 2 + 4);
    });
    var m = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }));
    m.position.set(pos[0], pos[1], pos[2]); if (rotate) m.rotation.z = rotate; g.add(m); return m;
  }
  function windowTexture(person, accent) {
    return canvasTexture(96, 112, function (ctx, w, h) {
      ctx.fillStyle = '#FFE3A8'; ctx.strokeStyle = '#2B2620'; ctx.lineWidth = 7; ctx.fillRect(5, 5, w - 10, h - 10); ctx.strokeRect(5, 5, w - 10, h - 10);
      ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(w / 2, 7); ctx.lineTo(w / 2, h - 7); ctx.moveTo(7, h / 2); ctx.lineTo(w - 7, h / 2); ctx.stroke();
      if (person) { ctx.fillStyle = '#2B2620'; ctx.beginPath(); ctx.arc(w * 0.62, h * 0.47, 10, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(w * 0.62, h * 0.56); ctx.lineTo(w * 0.62, h * 0.88); ctx.lineTo(w * 0.42, h * 0.88); ctx.closePath(); ctx.fill(); }
      ctx.strokeStyle = accent || '#FF2E63'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(10, 12); ctx.lineTo(w - 15, 8); ctx.stroke();
    });
  }
  function gridDecals(g, v, w, h, d, cols, rows, balcony) {
    var tex = balcony ? canvasTexture(120, 100, function (ctx, ww, hh) {
      ctx.fillStyle = '#FEFBF6'; ctx.strokeStyle = '#2B2620'; ctx.lineWidth = 6; ctx.fillRect(4, 4, ww - 8, hh - 8); ctx.strokeRect(4, 4, ww - 8, hh - 8);
      ctx.fillStyle = colorHex(v.accent); ctx.fillRect(12, 44, ww - 24, 22); ctx.strokeRect(12, 44, ww - 24, 22);
      ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(8, 78); ctx.lineTo(ww - 8, 78); ctx.moveTo(20, 66); ctx.lineTo(20, 94); ctx.moveTo(ww - 20, 66); ctx.lineTo(ww - 20, 94); ctx.stroke();
      ctx.fillStyle = '#F9ED69'; ctx.fillRect(28, 48, 30, 17); ctx.fillStyle = '#08D9D6'; ctx.fillRect(62, 48, 26, 17);
    }) : windowTexture(false, colorHex(v.accent));
    var geo = new THREE.PlaneGeometry(balcony ? 0.86 : 0.66, balcony ? 0.72 : 0.82);
    var mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
    var inst = new THREE.InstancedMesh(geo, mat, cols * rows), dummy = new THREE.Object3D(), k = 0;
    for (var yy = 0; yy < rows; yy++) for (var xx = 0; xx < cols; xx++) {
      dummy.position.set(-w * 0.38 + xx * (w * 0.76 / Math.max(1, cols - 1)), 0.85 + yy * ((h - 1.4) / Math.max(1, rows - 1)), d / 2 + 0.055);
      dummy.rotation.z = (v.r() - 0.5) * 0.025; dummy.updateMatrix(); inst.setMatrixAt(k++, dummy.matrix);
    }
    g.add(inst); return inst;
  }
  function doodleCloud(g, v, x, y, z, sc) {
    var tex = canvasTexture(256, 144, function (ctx) {
      ctx.fillStyle = '#FEFBF6'; ctx.strokeStyle = '#2B2620'; ctx.lineWidth = 6; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.ellipse(82, 84, 60, 35, -0.08, 0, Math.PI * 2); ctx.ellipse(135, 62, 52, 45, 0.1, 0, Math.PI * 2); ctx.ellipse(178, 87, 54, 31, 0.04, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(48, 108); ctx.quadraticCurveTo(128, 128, 211, 105); ctx.stroke();
    });
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sp.position.set(x, y, z); sp.scale.set(3.4 * sc, 1.9 * sc, 1); g.add(sp);
    g.userData.props = g.userData.props || []; g.userData.props.push({ el: sp, kind: 'cloud', phase: v.r() * 8, base: sp.position.clone() });
  }
  function doodleSmoke(g, v, x, y, z) {
    var tex = canvasTexture(96, 72, function (ctx) { ctx.strokeStyle = '#2B2620'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(48, 36, 34, 21, -0.12, 0.15, Math.PI * 1.9); ctx.stroke(); });
    for (var i = 0; i < 4; i++) {
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.55, depthWrite: false }));
      sp.position.set(x, y + i * 0.55, z); sp.scale.setScalar(0.55 + i * 0.16); g.add(sp);
      g.userData.props = g.userData.props || []; g.userData.props.push({ el: sp, kind: 'smoke', phase: i / 4, base: sp.position.clone(), index: i });
    }
  }
  function stripedAwning(g, v, w, y, z) {
    var tex = canvasTexture(256, 64, function (ctx, ww, hh) {
      ctx.fillStyle = '#FEFBF6'; ctx.fillRect(0, 0, ww, hh); ctx.fillStyle = colorHex(v.accent);
      for (var i = -1; i < 9; i++) { ctx.beginPath(); ctx.moveTo(i * 40, 0); ctx.lineTo(i * 40 + 26, 0); ctx.lineTo(i * 40 + 52, hh); ctx.lineTo(i * 40 + 26, hh); ctx.closePath(); ctx.fill(); }
      ctx.strokeStyle = '#2B2620'; ctx.lineWidth = 6; ctx.strokeRect(2, 2, ww - 4, hh - 4);
    });
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.3), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    m.position.set(0, y, z); m.rotation.x = -0.34; g.add(m);
  }
  function heartDoodle(g, x, y, z) {
    var tex = canvasTexture(160, 140, function (ctx) { ctx.fillStyle = '#F9ED69'; ctx.strokeStyle = '#2B2620'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(80, 124); ctx.bezierCurveTo(5, 80, 12, 15, 55, 22); ctx.bezierCurveTo(75, 26, 80, 48, 80, 48); ctx.bezierCurveTo(80, 48, 92, 8, 127, 23); ctx.bezierCurveTo(166, 45, 128, 96, 80, 124); ctx.fill(); ctx.stroke(); });
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true })); sp.position.set(x, y, z); sp.scale.set(1.25, 1.1, 1); g.add(sp);
  }
  function finishBuilding(g, v) { doodleCloud(g, v, -5.4, 6.4, -2.8, 0.9 + v.r() * 0.25); }

  BUILDERS.canteen = function (g, v) {
    var h = 4 * v.hs, w = 10 * v.ws, d = 7 * v.ws;
    part(g, wobbleGeo(new THREE.BoxGeometry(w, h, d), 0.12, v.r), 0xF6E7C8, { gmap: v.gmap, pos: [0, h / 2, 0] });
    var papers = gridShards(w * 0.96, h * 0.82, 4, 2, v.r, 0.035), pcs = [0xF6E7C8, 0xFF2E63, 0xF9ED69, 0xF6E7C8];
    papers.forEach(function (p, i) { paperShard(g, v, p, pcs[i % pcs.length], { pos: [0, h * 0.52, d / 2 + 0.025] }); });
    part(g, wobbleGeo(new THREE.ConeGeometry(Math.max(w, d) * 0.62, 2.6 * v.hs, 4), 0.14, v.r), v.accent, { gmap: v.gmap, pos: [0, h + 1.3 * v.hs, 0], rot: [0, Math.PI / 4 + v.r() * 0.5, 0] });
    part(g, wobbleGeo(new THREE.CylinderGeometry(0.5, 0.62, 1.6, 7), 0.1, v.r), 0xC75D6E, { gmap: v.gmap, pos: [w * 0.3, h + 2.2, d * 0.2] });
    var normal = windowTexture(false, colorHex(v.accent)), person = windowTexture(true, colorHex(v.accent));
    for (var c = 0; c < 5; c++) for (var r = 0; r < 2; r++) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.8), new THREE.MeshBasicMaterial({ map: (c + r * 3) % 4 === 0 ? person : normal, transparent: true }));
      m.position.set(-w * 0.38 + c * (w * 0.76 / 4), h * 0.3 + r * 1.7, d / 2 + 0.075); g.add(m);
    }
    stripedAwning(g, v, 4 * v.ws, h * 0.66, d / 2 + 1.12);
    labelPlane(g, '食堂', colorHex(v.accent), [0, h * 0.43, d / 2 + 1.58], [2.2, 0.72], -0.035);
    doodleSmoke(g, v, w * 0.3, h + 3.15, d * 0.2);
    doodleFlag(g, v, w * 0.42, h + 3.6, d * 0.3); doodleStars(g, v, 2, w * 0.5, h + 4.2); finishBuilding(g, v);
  };

  BUILDERS.stadium = function (g, v) {
    var s = 1 + v.r() * 0.5, groundRot = [-Math.PI / 2, 0, 0];
    discShards(6, 6, v.r, 0.025, 4.2).forEach(function (p, i) { var sh = paperShard(g, v, p, i % 2 ? 0xD65A72 : 0xFF3B5C, { pos: [0, 0.065, 0], rot: groundRot }); sh.scale.set(1.5 * s, s, 1); });
    [4.7, 5.4, 6.0].forEach(function (r) { var lane = new THREE.Mesh(new THREE.RingGeometry(r - 0.05, r, 48), new THREE.MeshBasicMaterial({ color: 0xFEFBF6, side: THREE.DoubleSide })); lane.rotation.x = -Math.PI / 2; lane.scale.set(1.5 * s, 1, s); lane.position.y = 0.09; g.add(lane); });
    discShards(4.12, 6, v.r, 0.03, 0).forEach(function (p, i) { var sh = paperShard(g, v, p, i % 3 === 0 ? 0xF9ED69 : 0x6BCB77, { pos: [0, 0.055, 0], rot: groundRot }); sh.scale.set(1.5 * s, s, 1); });
    part(g, wobbleGeo(new THREE.BoxGeometry(5 * s, 1.6, 1.4), 0.12, v.r), v.accent, { gmap: v.gmap, pos: [-2.2 * s, 0.8, 4.4 * s] });
    part(g, wobbleGeo(new THREE.BoxGeometry(5 * s, 1.6, 1.4), 0.12, v.r), v.accent, { gmap: v.gmap, pos: [2.2 * s, 0.8, 4.4 * s] });
    var post = new THREE.MeshBasicMaterial({ color: 0xFEFBF6 });
    [[-7.2 * s, 0], [7.2 * s, 0]].forEach(function (p) { var bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 8), post); bar.rotation.z = Math.PI / 2; bar.position.set(p[0], 0.8, 0); g.add(bar); });
    [[0, -3.2 * s], [0, 3.2 * s]].forEach(function (p) {
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.2, 8), post); pole.position.set(p[0], 1.6, p[1]); g.add(pole);
      part(g, wobbleGeo(new THREE.BoxGeometry(1.4, 0.9, 0.08), 0.06, v.r), v.accent, { gmap: v.gmap, pos: [p[0], 3.1, p[1]] });
      var net = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(1.1, 0.65, 2, 2)), new THREE.LineBasicMaterial({ color: 0xFEFBF6 })); net.position.set(p[0], 2.55, p[1]); g.add(net);
    });
    for (var i = 0; i < 3; i++) { var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: doodlePersonTexture(i % 2 ? '#F9ED69' : '#08D9D6', v.r), transparent: true })); sp.position.set(-3 + i * 2.8, 2.05, 4.3 * s); sp.scale.set(0.75, 0.75, 1); g.add(sp); }
    doodleStars(g, v, 1, 0, 4.5); finishBuilding(g, v);
  };

  BUILDERS.library = function (g, v) {
    var h = 7 * v.hs, w = 9 * v.ws, d = 6 * v.ws;
    part(g, wobbleGeo(new THREE.BoxGeometry(w, h, d), 0.14, v.r), 0x9AA8C8, { gmap: v.gmap, pos: [0, h / 2, 0] });
    gridShards(w * 0.9, h * 0.86, 7, 1, v.r, 0.04).forEach(function (p, i) { paperShard(g, v, p, i % 2 ? 0x9FD4C8 : 0x8FB6D9, { pos: [0, h * 0.47, d / 2 + 0.04], opacity: 0.78, depthWrite: false }); });
    part(g, wobbleGeo(new THREE.BoxGeometry(w * 0.7, 1.6, d * 0.7), 0.1, v.r), 0xB8C2DA, { gmap: v.gmap, pos: [0, h + 0.8, 0] });
    part(g, wobbleGeo(new THREE.BoxGeometry(w * 0.45, 1.3, d * 0.45), 0.1, v.r), v.accent, { gmap: v.gmap, pos: [0, h + 2.2, 0] });
    for (var b = 0; b < 6; b++) part(g, wobbleGeo(new THREE.BoxGeometry(0.36, 0.75 + v.r() * 0.25, 0.5), 0.035, v.r), ACCENTS[b % ACCENTS.length], { gmap: v.gmap, pos: [-1.25 + b * 0.5, h + 3.15, d * 0.1] });
    for (var k = 0; k < 3; k++) part(g, wobbleGeo(new THREE.BoxGeometry(2.6 - k * 0.5, 0.18, 0.9), 0.06, v.r), 0x8A92A6, { gmap: v.gmap, pos: [0, 0.1 + k * 0.18, d / 2 + 0.5 + (2 - k) * 0.4] });
    doodleTree(g, v, -w * 0.56, 0, d * 0.45); doodleFlag(g, v, -w * 0.46, h + 3.4, d * 0.25); doodleStars(g, v, 1, w * 0.4, h + 4.6); finishBuilding(g, v);
  };

  BUILDERS.express = function (g, v) {
    var w = 7 * v.ws, h = 3 * v.hs, d = 5 * v.ws;
    part(g, wobbleGeo(new THREE.BoxGeometry(w, h, d), 0.12, v.r), 0xE8D5AC, { gmap: v.gmap, pos: [0, h / 2, 0] });
    gridShards(w * 0.94, h * 0.78, 3, 1, v.r, 0.035).forEach(function (p, i) { paperShard(g, v, p, [0xE8D5AC, 0xF9ED69, 0xFF2E63][i], { pos: [0, h * 0.52, d / 2 + 0.035] }); });
    for (var b = 0; b < 7; b++) { var box = part(g, wobbleGeo(new THREE.BoxGeometry(0.85 + v.r() * 0.35, 0.65 + v.r() * 0.3, 0.8), 0.08, v.r), ACCENTS[Math.floor(v.r() * ACCENTS.length)], { gmap: v.gmap, pos: [-w * 0.32 + (b % 4) * 1.25, 0.38 + Math.floor(b / 4) * 0.72, d / 2 + 0.4 + (b % 2) * 0.4] }); box.rotation.y = (v.r() - 0.5) * 0.6; }
    labelPlane(g, '快递', colorHex(v.accent), [0, h * 0.94, d / 2 + 0.11], [2.5, 0.78], 0.025);
    var tape = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.28), new THREE.MeshBasicMaterial({ color: 0xF9ED69, transparent: true, opacity: 0.75, side: THREE.DoubleSide })); tape.position.set(0.65, h * 1.05, d / 2 + 0.14); tape.rotation.z = -0.35; g.add(tape);
    doodleFlag(g, v, w * 0.4, h + 1.8, d * 0.3); finishBuilding(g, v);
  };

  BUILDERS.hospital = function (g, v) {
    var w = 8 * v.ws, h = 4.5 * v.hs, d = 6 * v.ws;
    part(g, wobbleGeo(new THREE.BoxGeometry(w, h, d), 0.12, v.r), 0xF4F4EF, { gmap: v.gmap, pos: [0, h / 2, 0] });
    var cross1 = part(g, new THREE.CapsuleGeometry(0.28, 1.15, 4, 8), 0xFF3B5C, { gmap: v.gmap, pos: [0, h * 0.82, d / 2 + 0.08], emissive: 0xFF3B5C, emissiveIntensity: 0.6 });
    var cross2 = part(g, new THREE.CapsuleGeometry(0.28, 1.15, 4, 8), 0xFF3B5C, { gmap: v.gmap, pos: [0, h * 0.82, d / 2 + 0.09], rot: [0, 0, Math.PI / 2], emissive: 0xFF3B5C, emissiveIntensity: 0.6 });
    cross1.children[0].material.userData.pulse = cross2.children[0].material.userData.pulse = true;
    for (var i = 0; i < 3; i++) part(g, wobbleGeo(new THREE.BoxGeometry(3 - i * 0.6, 0.18, 0.9), 0.06, v.r), 0x9AA3B2, { gmap: v.gmap, pos: [0, 0.09 + i * 0.18, d / 2 + 0.5 + (2 - i) * 0.45] });
    part(g, new THREE.CylinderGeometry(0.36, 0.42, 1.1, 10), 0xF4F4EF, { gmap: v.gmap, pos: [-w * 0.42, 0.55, d * 0.55] });
    part(g, new THREE.CylinderGeometry(0.39, 0.39, 0.3, 10), 0xFF2E63, { gmap: v.gmap, pos: [-w * 0.42, 1.25, d * 0.55] });
    labelPlane(g, '+', '#FF3B5C', [-w * 0.42, 0.62, d * 0.55 + 0.43], [0.48, 0.42], 0);
    heartDoodle(g, w * 0.32, h * 0.55, d / 2 + 0.12); doodleTree(g, v, w * 0.55, 0, d * 0.5); finishBuilding(g, v);
  };

  BUILDERS.fallback = function (g, v) {
    var text = String(v.name || '') + ' ' + String(v.type || ''), dorm = /宿舍|公寓|寝|君来安/.test(text), admin = /行政|办公|团委|财务|资助|学工|教务|综合楼|大活/.test(text);
    if (dorm) {
      var w = 5.2 * v.ws, h = 7.4 * v.hs, d = 4.4 * v.ws;
      part(g, wobbleGeo(new THREE.BoxGeometry(w, h, d), 0.14, v.r), 0xF6E7C8, { gmap: v.gmap, pos: [0, h / 2, 0] });
      gridDecals(g, v, w, h, d, 3, 5, true); labelPlane(g, '宿舍', colorHex(v.accent), [0, h + 0.3, d / 2 + 0.1], [2.1, 0.66], -0.025); doodleFlag(g, v, w * 0.42, h + 0.6, 0);
    } else if (admin) {
      var aw = 8.6 * v.ws, ah = 4.2 * v.hs, ad = 5.2 * v.ws;
      part(g, wobbleGeo(new THREE.BoxGeometry(aw, ah, ad), 0.12, v.r), 0xB8C2DA, { gmap: v.gmap, pos: [0, ah / 2, 0] });
      gridDecals(g, v, aw, ah, ad, 5, 2, false);
      part(g, wobbleGeo(new THREE.BoxGeometry(2.3, 2.8, 1.3), 0.09, v.r), 0xF6E7C8, { gmap: v.gmap, pos: [0, 1.4, ad / 2 + 0.55] });
      for (var s = 0; s < 3; s++) part(g, wobbleGeo(new THREE.BoxGeometry(3.4 - s * 0.45, 0.18, 0.9), 0.05, v.r), 0x8A92A6, { gmap: v.gmap, pos: [0, 0.09 + s * 0.18, ad / 2 + 1.2 + (2 - s) * 0.35] });
      discShards(0.68, 5, v.r, 0.04, 0).forEach(function (p, i) { paperShard(g, v, p, i % 2 ? 0xF9ED69 : 0xFFB000, { pos: [0, ah * 0.82, ad / 2 + 0.09] }); });
      labelPlane(g, '行政', colorHex(v.accent), [0, ah + 0.35, 0], [2.1, 0.66], 0.02);
    } else {
      var cw = 6 * v.hs, ch = 6.2 * v.hs, cd = 4.8 * v.ws;
      part(g, wobbleGeo(new THREE.BoxGeometry(cw, ch, cd), 0.14, v.r), 0x9AA8C8, { gmap: v.gmap, pos: [0, ch / 2, 0] });
      gridDecals(g, v, cw, ch, cd, 3, 4, false); labelPlane(g, '学院', colorHex(v.accent), [0, ch * 0.87, cd / 2 + 0.1], [2.25, 0.7], -0.02); doodleFlag(g, v, cw * 0.4, ch + 0.5, 0);
    }
    doodleStars(g, v, 1, 0, 7.2); finishBuilding(g, v);
  };

  doodleFlag = function (g, v, x, y, z) {
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), new THREE.MeshBasicMaterial({ color: INK })); pole.position.set(x, y + 1.1, z); g.add(pole);
    var tex = canvasTexture(192, 112, function (ctx, w, h) { ctx.fillStyle = colorHex(v.accent); ctx.strokeStyle = '#2B2620'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(5, 8); ctx.quadraticCurveTo(w * 0.5, 22, w - 6, 5); ctx.lineTo(w - 12, h - 12); ctx.quadraticCurveTo(w * 0.45, h - 28, 8, h - 5); ctx.closePath(); ctx.fill(); ctx.stroke(); });
    var flag = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.9, 4, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide })); flag.position.set(x + 0.75, y + 1.9, z); flag.rotation.y = v.r() * 0.3; g.add(flag);
    g.userData.props = g.userData.props || []; g.userData.props.push({ el: flag, kind: 'flag', phase: v.r() * 10, basePositions: flag.geometry.attributes.position.array.slice() });
  };
  doodleTree = function (g, v, x, y, z) {
    var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.6, 7), new THREE.MeshToonMaterial({ color: 0x8A6A48, gradientMap: v.gmap })); trunk.position.set(x, 0.8, z); g.add(trunk);
    var crown = new THREE.Group(); crown.position.set(x, 2.1, z); crown.rotation.y = (v.r() - 0.5) * 0.5; g.add(crown);
    discShards(1.15, 5, v.r, 0.045, 0).forEach(function (p, i) { paperShard(crown, v, p, i % 2 ? 0x6BCB77 : 0x12A36B, { pos: [0, 0, 0] }); });
  };

  /* ---------- 查看器 ---------- */
  function open(opts) {
    if (!detect()) { if (window.__toast) window.__toast('当前设备不支持 3D 查看'); return; }
    if (viewer) viewer.close();
    var REDUCED = false; try { REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    var LOWEND = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
    var rand = mulberry32(hashSeed(opts.id || opts.name || 'x'));
    var v = { r: rand, hs: 0.85 + rand() * 0.4, ws: 0.85 + rand() * 0.35, accent: ACCENTS[Math.floor(rand() * ACCENTS.length) % ACCENTS.length], name: opts.name || '', type: opts.type || '', shards: [] };
    v.gmap = toonGradient();

    var wrap = document.createElement('div'); wrap.className = 'v3d-overlay';
    wrap.innerHTML = '<div class="v3d-topbar"><div class="v3d-title"><b>' + esc(opts.name) + '</b><span class="v3d-kind">' + esc(opts.type || opts.kind || '') + '</span></div>' +
      '<div class="v3d-tools"><button class="v3d-btn" id="v3dSec" title="查看楼层">▤</button><button class="v3d-btn" id="v3dFs" title="全屏">⛶</button><button class="v3d-btn" id="v3dX" title="关闭">✕</button></div></div>' +
      '<div class="v3d-stage" id="v3dStage"></div><p class="v3d-hint">拖拽旋转 · 滚轮缩放 · 点击涂鸦建筑放星星 · 双击建筑看楼层</p>' +
      '<span class="v3d-gesture-tag" id="v3dGestureTag" hidden>✋ 手势已开启</span>';
    document.body.appendChild(wrap);
    document.body.style.overflow = 'hidden';

    var stage = wrap.querySelector('#v3dStage');
    var renderer, scene, camera, controls, raf = null, disposed = false;
    var model = new THREE.Group(), haloMat, baseMat, baseMats = [], baseGroup, bodyGroup, signTex, signMesh, signPop = 0;

    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch (e) { _avail = false; wrap.remove(); document.body.style.overflow = ''; if (window.__setTwin3dAvail) window.__setTwin3dAvail(); if (window.__toast) window.__toast('当前设备不支持 3D 查看'); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(stage.clientWidth, stage.clientHeight);
    if (!LOWEND) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
    renderer.localClippingEnabled = true;
    stage.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    var fogDay = new THREE.Color(cssVar('--bg', '#FBF3E1')); var fogNight = new THREE.Color('#02040A');
    scene.fog = new THREE.Fog(fogDay.clone(), 30, 80);
    try {
      var pmrem = new THREE.PMREMGenerator(renderer);
      var envScene = new THREE.Scene();
      var envCols = [0x8FB8FF, 0x8FB8FF, 0xE8ECEF, 0xC9B58E, 0xFFD9A0, 0xFFB0C0];
      var envMats = envCols.map(function (c) { return new THREE.MeshBasicMaterial({ color: c, side: THREE.BackSide }); });
      envScene.add(new THREE.Mesh(new THREE.BoxGeometry(80, 80, 80), envMats));
      scene.environment = pmrem.fromScene(envScene, 0.04).texture;
      pmrem.dispose();
    } catch (e) { scene.environment = null; }

    camera = new THREE.PerspectiveCamera(45, stage.clientWidth / stage.clientHeight, 0.1, 200);
    camera.position.set(14, 12, 18);
    if (opts.kind === 'stadium') camera.position.multiplyScalar(1.2);
    var initialAspect = stage.clientWidth / Math.max(1, stage.clientHeight);
    if (initialAspect < 0.9) camera.position.multiplyScalar(Math.min(1.65, 0.9 / initialAspect));
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.06;
    controls.minPolarAngle = THREE.MathUtils.degToRad(20); controls.maxPolarAngle = THREE.MathUtils.degToRad(85);
    controls.minDistance = 8; controls.maxDistance = (opts.kind === 'stadium' && initialAspect < 0.9) ? 60 : 40;

    var KEY_BASE = 1.15, AMB_BASE = 0.5;
    var key = new THREE.DirectionalLight(0xFFFFFF, KEY_BASE); key.position.set(10, 16, 8);
    if (!LOWEND) { key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.camera.near = 1; key.shadow.camera.far = 60; }
    scene.add(key);
    var amb = new THREE.AmbientLight(0xFFFFFF, AMB_BASE);
    scene.add(amb);
    var accentLight = new THREE.PointLight(cssVar('--accent', '#FF3B5C'), 10, 30); accentLight.position.set(0, 0.6, 0); scene.add(accentLight);

    /* 十二片碎纸底座 + 手绘虚线双圈 + 淡墨接触阴影 */
    var baseColor = new THREE.Color(levelColor(opts.getState().level));
    baseGroup = new THREE.Group(); baseGroup.position.y = 0.012; model.add(baseGroup);
    discShards(8.4, 12, rand, 0.025, 0).forEach(function (poly, i) {
      var sg = paperShard(baseGroup, v, poly, baseColor.getHex(), { pos: [0, 0, 0], rot: [-Math.PI / 2, 0, 0], opacity: 0.88 });
      baseMats.push(sg.children[0].material);
    });
    baseMat = baseMats[0];
    var haloTex = canvasTexture(512, 512, function (ctx) {
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 7; ctx.setLineDash([22, 14]);
      ctx.beginPath(); ctx.arc(256, 256, 205, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 3; ctx.setLineDash([9, 15]); ctx.beginPath(); ctx.arc(256, 256, 232, 0, Math.PI * 2); ctx.stroke();
    });
    haloTex.center.set(0.5, 0.5);
    haloMat = new THREE.MeshBasicMaterial({ color: baseColor, map: haloTex, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
    var halo = new THREE.Mesh(new THREE.PlaneGeometry(20.8, 20.8), haloMat); halo.rotation.x = -Math.PI / 2; halo.position.y = 0.025; model.add(halo);
    var aoTex = null;
    try {
      var ac = document.createElement('canvas'); ac.width = ac.height = 256;
      var actx = ac.getContext('2d');
      var ag = actx.createRadialGradient(128, 128, 6, 128, 128, 126);
      ag.addColorStop(0, 'rgba(0,0,0,0.42)'); ag.addColorStop(0.55, 'rgba(0,0,0,0.13)'); ag.addColorStop(1, 'rgba(0,0,0,0)');
      actx.fillStyle = ag; actx.fillRect(0, 0, 256, 256);
      actx.fillStyle = 'rgba(43,38,32,0.16)';
      for (var sp = 0; sp < 11; sp++) { var sa = rand() * Math.PI * 2, sr = 72 + rand() * 42; actx.beginPath(); actx.ellipse(128 + Math.cos(sa) * sr, 128 + Math.sin(sa) * sr, 2 + rand() * 5, 1.5 + rand() * 3, sa, 0, Math.PI * 2); actx.fill(); }
      aoTex = new THREE.CanvasTexture(ac);
      var aoPlane = new THREE.Mesh(new THREE.PlaneGeometry(17, 17), new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, depthWrite: false }));
      aoPlane.rotation.x = -Math.PI / 2; aoPlane.position.y = 0.005; model.add(aoPlane);
    } catch (e) {}
    var onStatus = function (e) { if (!e || !e.detail || e.detail.id !== opts.id) return; var c2 = new THREE.Color(e.detail.color || levelColor(e.detail.crowdLevel)); baseMats.forEach(function (m) { m.color.copy(c2); }); haloMat.color.copy(c2); };
    window.addEventListener('twin:status-update', onStatus);

    /* 模型本体（涂鸦建模，独立种子） */
    bodyGroup = new THREE.Group(); var simplified = false;
    try { (BUILDERS[opts.kind] || BUILDERS.fallback)(bodyGroup, v); }
    catch (err) { simplified = true; try { console.warn('[Twin3D] 建模失败，使用简化模型：', opts.kind, err); } catch (e) {} while (bodyGroup.children.length) bodyGroup.remove(bodyGroup.children[0]); BUILDERS.fallback(bodyGroup, v); }
    if (simplified) { var tag = document.createElement('span'); tag.className = 'v3d-simple'; tag.textContent = '简化模型渲染'; wrap.querySelector('.v3d-stage').appendChild(tag); }
    if (!LOWEND) bodyGroup.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    model.add(bodyGroup); scene.add(model);
    controls.target.set(0, 2.6, 0); controls.update();
    var triCount = 0, meshCount = 0;
    bodyGroup.traverse(function (o) { if (o.isMesh && o.geometry) { meshCount++; var gg = o.geometry; triCount += gg.index ? gg.index.count / 3 : (gg.attributes.position ? gg.attributes.position.count / 3 : 0); } });
    window.__twin3dStats = { triangles: Math.round(triCount), meshes: meshCount, fragments: v.shards.length, kind: opts.kind, id: opts.id };
    wrap.setAttribute('data-triangles', String(Math.round(triCount))); wrap.setAttribute('data-fragments', String(v.shards.length));

    var glowMats = [];
    bodyGroup.traverse(function (o) { if (o.isMesh && o.material && o.material.emissive && o.material.emissiveIntensity > 0.2 && glowMats.every(function (g2) { return g2.m !== o.material; })) glowMats.push({ m: o.material, base: o.material.emissiveIntensity }); });

    /* 涂鸦小人粒子（物理：重力/风力/反弹/碰撞）+ 门口流动线 */
    var MAX_P = LOWEND ? 0 : 60;
    var pTex = doodlePersonTexture('#FFFFFF', rand);
    var pGeo = new THREE.BufferGeometry();
    var pPos = new Float32Array(MAX_P * 3), pVel = new Float32Array(MAX_P * 3);
    for (var pi = 0; pi < MAX_P; pi++) {
      pPos[pi * 3] = (rand() - 0.5) * 5; pPos[pi * 3 + 1] = 0.4 + rand() * 2; pPos[pi * 3 + 2] = 4.2 + rand() * 5;
      pVel[pi * 3] = (rand() - 0.5) * 0.3; pVel[pi * 3 + 1] = rand() * 0.4; pVel[pi * 3 + 2] = (rand() - 0.5) * 0.3;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    var pMat = new THREE.PointsMaterial({ color: 0xffffff, map: pTex, size: 1.15, transparent: true, alphaTest: 0.1, sizeAttenuation: true, depthWrite: false });
    var people = new THREE.Points(pGeo, pMat); people.visible = false; scene.add(people);
    var R_P = 0.3;
    function stepPeople(dt) {
      if (!people.visible || MAX_P === 0) return;
      var cnt = people.geometry.drawRange.count;
      var wind = Math.sin(performance.now() * 0.001) * 0.9;
      for (var i = 0; i < cnt; i++) {
        pVel[i * 3 + 1] -= 9.8 * dt;
        pVel[i * 3] += wind * dt;
        pPos[i * 3] += pVel[i * 3] * dt;
        pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt;
        pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
        if (pPos[i * 3 + 1] < R_P) { pPos[i * 3 + 1] = R_P; pVel[i * 3 + 1] = -pVel[i * 3 + 1] * 0.4; }
        var dx = pPos[i * 3], dz = pPos[i * 3 + 2], rr = Math.sqrt(dx * dx + dz * dz);
        if (rr > 6.5) { pPos[i * 3] *= 6.5 / rr; pPos[i * 3 + 2] *= 6.5 / rr; pVel[i * 3] *= -0.3; pVel[i * 3 + 2] *= -0.3; }
        pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
      }
      for (var a = 0; a < cnt; a++) for (var b = a + 1; b < cnt; b++) {
        var ddx = pPos[a * 3] - pPos[b * 3], ddz = pPos[a * 3 + 2] - pPos[b * 3 + 2];
        var dist = Math.sqrt(ddx * ddx + ddz * ddz);
        if (dist < R_P * 2 && dist > 0.0001) {
          var push = (R_P * 2 - dist) * 0.5, nx = ddx / dist, nz = ddz / dist;
          pPos[a * 3] += nx * push; pPos[a * 3 + 2] += nz * push;
          pPos[b * 3] -= nx * push; pPos[b * 3 + 2] -= nz * push;
        }
      }
      pGeo.attributes.position.needsUpdate = true;
    }
    /* 人流流动线：沿门口贝塞尔路径移动的涂鸦点（速度随拥挤度） */
    var FLOW_N = 12;
    var flowGeo = new THREE.BufferGeometry();
    var flowPos = new Float32Array(FLOW_N * 3);
    flowGeo.setAttribute('position', new THREE.BufferAttribute(flowPos, 3));
    var arrowTex = canvasTexture(64, 64, function (ctx) { ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = '#2B2620'; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(54, 32); ctx.lineTo(25, 8); ctx.lineTo(29, 24); ctx.lineTo(8, 24); ctx.lineTo(8, 40); ctx.lineTo(29, 40); ctx.lineTo(25, 56); ctx.closePath(); ctx.fill(); ctx.stroke(); });
    var flowMat = new THREE.PointsMaterial({ color: baseColor.clone(), map: arrowTex, size: 0.55, transparent: true, opacity: 0.9, alphaTest: 0.1, depthWrite: false });
    var flow = new THREE.Points(flowGeo, flowMat); scene.add(flow);
    var P0 = new THREE.Vector3(0, 0.5, 5.2), P1 = new THREE.Vector3(0, 1.4, 8.5), P2 = new THREE.Vector3(2.6, 0.5, 10.5);
    var flowT = [];
    for (var f2 = 0; f2 < FLOW_N; f2++) flowT.push(f2 / FLOW_N);
    function bez(t, a, b, c) {
      var u = 1 - t;
      return new THREE.Vector3(u * u * a.x + 2 * u * t * b.x + t * t * c.x, u * u * a.y + 2 * u * t * b.y + t * t * c.y, u * u * a.z + 2 * u * t * b.z + t * t * c.z);
    }

    /* 手绘计数牌（实时人数，蜡笔数字） */
    var signCanvas = document.createElement('canvas'); signCanvas.width = 256; signCanvas.height = 128;
    signTex = new THREE.CanvasTexture(signCanvas);
    drawCountSign(signCanvas.getContext('2d'), 0, '#12A36B', rand);
    signMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), new THREE.MeshBasicMaterial({ map: signTex, transparent: true, side: THREE.DoubleSide }));
    signMesh.position.set(-5.4, 2.4, 2.2); signMesh.rotation.y = 0.5;
    model.add(signMesh);

    /* 剖面查看器 */
    var clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 99);
    var clipMats = [];
    bodyGroup.traverse(function (o) { if (o.isMesh && o.material && clipMats.indexOf(o.material) === -1) clipMats.push(o.material); });
    var sec = { on: false, anim: 0, from: 99, to: 99 }; var SEC_TOP = 12, SEC_CUT = 2.6, SEC_MS = 500;
    var floorsEl = document.createElement('div'); floorsEl.className = 'v3d-floors'; floorsEl.hidden = true;
    (function () { var sp = null; (window.spots || []).concat(window.surroundingSpots || []).forEach(function (s) { if (s.id === opts.id) sp = s; }); var fs = sp && sp.floors; floorsEl.innerHTML = '<b>楼层导览</b>' + (fs && fs.length ? '<ul>' + fs.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>' : '<p class="v3d-floors-empty">楼层信息待补充</p>'); })();
    wrap.appendChild(floorsEl);
    function setClip(c) { clipPlane.constant = c; }
    function applyClip(on) { clipMats.forEach(function (m) { m.clippingPlanes = on ? [clipPlane] : null; m.needsUpdate = true; }); }
    function toggleSection() {
      if (sec.anim) return;
      if (!sec.on) { sec.on = true; sec.from = SEC_TOP; sec.to = SEC_CUT; sec.anim = performance.now(); applyClip(true); floorsEl.hidden = false; }
      else { sec.from = SEC_CUT; sec.to = SEC_TOP; sec.anim = performance.now(); floorsEl.hidden = true; }
    }
    wrap.querySelector('#v3dSec').addEventListener('click', toggleSection);

    var introStart = performance.now(); var fadeMats = [], fragmentRig = v.shards || [];
    model.traverse(function (o) { if (o.isMesh) { o.material.transparent = true; o.material.userData.baseOpacity = o.material.opacity; fadeMats.push(o.material); } });
    fragmentRig.forEach(function (fr) { if (!REDUCED) fr.el.position.copy(fr.start); else fr.el.position.copy(fr.base); });
    if (REDUCED) { model.scale.set(1, 1, 1); fadeMats.forEach(function (m) { m.opacity = m.userData.baseOpacity; }); }

    function onResize() { if (disposed || !renderer) return; camera.aspect = stage.clientWidth / stage.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(stage.clientWidth, stage.clientHeight); }
    window.addEventListener('resize', onResize);

    var wxTick = 0, wxCond = 'sunny', lastTrem = 0, fsSync = 0;
    var gTag = wrap.querySelector('#v3dGestureTag');
    var signTimer = 0, lastN = -1, hoverK = 0, shakeK = 0, shakeT = 0, lastLevel = '';
    var sparkles = [];   /* 点击爆星 */

    /* 涂鸦交互：点击建筑 → 星星爆点 + 抖动 */
    var raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
    var mouseNdc = null;
    function fireSparkles(x, y, z) {
      if (LOWEND || REDUCED) return;
      var color = '#' + v.accent.toString(16).padStart(6, '0');
      for (var i = 0; i < 10; i++) {
        var tex = starTexture(i % 2 ? color : '#FFB000', rand);
        var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
        sp.position.set(x, y, z);
        sp.scale.setScalar(0.5 + rand() * 0.5);
        var dir = new THREE.Vector3(rand() - 0.5, rand() * 0.8 + 0.2, rand() - 0.5).normalize().multiplyScalar(2.5 + rand() * 2);
        scene.add(sp);
        sparkles.push({ sp: sp, vel: dir, born: performance.now() });
      }
      shakeK = 1; shakeT = performance.now();
      if (window.__sfx) window.__sfx.play('click');
    }
    renderer.domElement.addEventListener('pointerdown', function (ev) {
      var rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      var hits = raycaster.intersectObjects(bodyGroup.children, true);
      if (hits.length) {
        var p = hits[0].point;
        fireSparkles(p.x, p.y, p.z);
      }
    });
    renderer.domElement.addEventListener('mousemove', function (ev) {
      var rect = renderer.domElement.getBoundingClientRect();
      mouseNdc = { x: ((ev.clientX - rect.left) / rect.width) * 2 - 1, y: -((ev.clientY - rect.top) / rect.height) * 2 + 1 };
    });
    renderer.domElement.addEventListener('mouseleave', function () { mouseNdc = null; });
    renderer.domElement.addEventListener('dblclick', function (ev) {
      var rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      var hits = raycaster.intersectObjects(bodyGroup.children, true);
      if (hits.length) toggleSection(); else toggleFs();
    });

    function tick(now) {
      if (disposed) return;
      raf = requestAnimationFrame(tick);
      var dt = Math.min(0.05, (now - (tick._last || now)) / 1000); tick._last = now;
      if ((fsSync & 31) === 0) wrap.classList.toggle('fs', !!document.fullscreenElement); fsSync++;
      if (!REDUCED) {
        var k = Math.min(1, (now - introStart) / 850), e = 1 - Math.pow(1 - k, 3);
        model.scale.setScalar(0.94 + 0.06 * e + Math.sin(k * Math.PI) * 0.018 * (1 - k)); fadeMats.forEach(function (m) { m.opacity = e * m.userData.baseOpacity; });
        fragmentRig.forEach(function (fr) {
          var q = Math.max(0, Math.min(1, (now - introStart - fr.delay) / 720)), ee = 1 - Math.pow(1 - q, 3);
          fr.el.position.lerpVectors(fr.start, fr.base, ee);
        });
      }
      var st = opts.getState(); var pct = Math.round((st.p || 0) * 100);
      var c = new THREE.Color(levelColor(st.level));
      baseMats.forEach(function (m) { m.color.lerp(c, 0.12); }); haloMat.color.lerp(c, 0.12); flowMat.color.lerp(c, 0.15);
      var ph = (now % 4000) / 4000;
      var s = ph < 0.3 ? 0.55 + (ph / 0.3) * 0.63 : (ph < 0.6 ? 1.18 : 1.18 - ((ph - 0.6) / 0.4) * 0.63);
      halo.scale.setScalar(s); haloMat.opacity = 0.28 * (1.2 - s * 0.45);
      if (!REDUCED) { baseGroup.rotation.y = now * Math.PI * 2 / 6000; haloTex.rotation = -now * 0.00022; }

      /* 呼吸 + 红态颤抖 */
      if (!REDUCED) {
        var breathe = Math.sin(now * Math.PI * 2 / 3200) * 0.008;
        bodyGroup.scale.x = 1 + breathe; bodyGroup.scale.z = 1 - breathe * 0.6;
        bodyGroup.scale.y = 1 - breathe + (pct >= 30 ? 0.01 * (1 + Math.sin(now / 1000 * Math.PI * 2 / 3)) : 0);
        if (pct > 85 && !LOWEND && now - lastTrem >= 100) { lastTrem = now; bodyGroup.position.x = (rand() - 0.5) * 0.012; bodyGroup.position.z = (rand() - 0.5) * 0.012; }
        else { bodyGroup.position.x *= 0.8; bodyGroup.position.z *= 0.8; }
      }
      /* 点击抖动衰减 */
      if (shakeK > 0.01) {
        var sk = 1 - Math.min(1, (now - shakeT) / 500);
        shakeK = sk;
        bodyGroup.rotation.y = (rand() - 0.5) * 0.06 * shakeK;
        bodyGroup.rotation.x = (rand() - 0.5) * 0.04 * shakeK;
      } else { bodyGroup.rotation.y = 0; bodyGroup.rotation.x = 0; }
      /* 悬停倾斜（涂鸦互动） */
      if (mouseNdc && !REDUCED) {
        raycaster.setFromCamera(mouseNdc, camera);
        var hov = raycaster.intersectObjects(bodyGroup.children, true).length > 0;
        hoverK += ((hov ? 1 : 0) - hoverK) * 0.12;
        bodyGroup.rotation.z = hoverK * 0.04;
      } else hoverK *= 0.9;

      /* 涂鸦小人：拥挤度>60% 出现，数量随人数；头部颜色随状态切换 */
      if (st.level !== lastLevel) {
        lastLevel = st.level;
        var nTex = doodlePersonTexture(levelColor(st.level), rand);
        if (nTex) { var oldTex = pMat.map; pMat.map = nTex; pMat.needsUpdate = true; if (oldTex) oldTex.dispose(); }
      }
      if (!LOWEND && !REDUCED && pct > 60) {
        var cnt = Math.min(MAX_P, Math.floor(pct / 2));
        people.visible = true; pGeo.setDrawRange(0, cnt);
        stepPeople(dt);
      } else people.visible = false;
      /* 人流流动线：速度随拥挤度（0.3 + pct×0.9） */
      if (!LOWEND && !REDUCED) {
        var speed = 0.25 + (pct / 100) * 0.85;
        for (var fi = 0; fi < FLOW_N; fi++) {
          flowT[fi] = (flowT[fi] + dt * speed * 0.14) % 1;
          var bp = bez(flowT[fi], P0, P1, P2);
          flowPos[fi * 3] = bp.x; flowPos[fi * 3 + 1] = bp.y + Math.sin(now / 300 + fi) * 0.15; flowPos[fi * 3 + 2] = bp.z;
        }
        flowGeo.attributes.position.needsUpdate = true;
      }
      /* 计数牌：实时人数蜡笔数字，变化时弹跳 */
      signTimer -= dt;
      if (lastN !== st.n) {
        lastN = st.n; signPop = 1;
      }
      if (signTimer <= 0) {
        signTimer = 1.2;
        var lc = levelColor(st.level);
        if (signCanvas) { drawCountSign(signCanvas.getContext('2d'), lastN, lc, rand); signTex.needsUpdate = true; }
      }
      signPop = Math.max(0, signPop - dt * 2.4);
      if (signMesh) signMesh.scale.setScalar(1 + signPop * 0.25);

      /* 拟生道具：折面旗、漂浮星、视差纸云、循环烟圈 */
      if (!REDUCED && bodyGroup.userData.props) {
        bodyGroup.userData.props.forEach(function (pr) {
          if (pr.kind === 'flag') {
            pr.el.rotation.x = Math.sin(now / 400 + pr.phase) * 0.18;
            var pa = pr.el.geometry.attributes.position;
            for (var vi = 0; vi < pa.count; vi++) { var bx = pr.basePositions[vi * 3]; pa.setZ(vi, pr.basePositions[vi * 3 + 2] + Math.sin(now / 260 + pr.phase + bx * 3.2) * 0.11 * (bx + 0.75)); }
            pa.needsUpdate = true;
          } else if (pr.kind === 'star') {
            pr.el.position.y = pr.base.y + Math.sin(now / 600 + pr.phase) * 0.5;
            pr.el.material.rotation = pr.el.material.rotation + dt * 1.2;
          } else if (pr.kind === 'cloud') {
            pr.el.position.x = pr.base.x + (mouseNdc ? mouseNdc.x * 0.5 : 0) + Math.sin(now / 1800 + pr.phase) * 0.25;
            pr.el.position.y = pr.base.y + (mouseNdc ? mouseNdc.y * 0.22 : 0) + Math.sin(now / 700 + pr.phase) * 0.18;
          } else if (pr.kind === 'smoke') {
            var life = (now / 3200 + pr.phase) % 1;
            pr.el.position.y = pr.base.y + life * 2.2; pr.el.position.x = pr.base.x + Math.sin(life * Math.PI * 2) * 0.22;
            pr.el.material.opacity = (1 - life) * 0.52; pr.el.scale.setScalar((0.55 + pr.index * 0.16) * (1 + life * 0.65));
          }
        });
      }
      /* 爆星粒子 */
      sparkles = sparkles.filter(function (skl) {
        var age = now - skl.born;
        if (age > 700) { scene.remove(skl.sp); skl.sp.material.dispose(); skl.sp.material.map && skl.sp.material.map.dispose(); return false; }
        skl.vel.y -= 6 * dt;
        skl.sp.position.addScaledVector(skl.vel, dt);
        skl.sp.material.opacity = 1 - age / 700;
        return true;
      });

      if (sec.anim) { var skk = Math.min(1, (now - sec.anim) / SEC_MS); var se = 1 - Math.pow(1 - skk, 3); setClip(sec.from + (sec.to - sec.from) * se); if (skk >= 1) { sec.anim = 0; if (sec.to === SEC_TOP) { sec.on = false; applyClip(false); } } }

      /* 手势控制（可选，默认关） */
      var G = window.ZXSJ && window.ZXSJ.Gestures;
      if (G && G.isEnabled()) {
        gTag.hidden = false;
        var gg = G.latest();
        if (gg && gg.active && !gg.palm) {
          controls.rotateLeft(-gg.dx * 7);
          controls.rotateUp(-gg.dy * 7);
          if (gg.pinch >= 0) {
            var dist = 8 + (1 - gg.pinch) * 32;
            var dir = camera.position.clone().sub(controls.target).normalize();
            var cur = camera.position.distanceTo(controls.target);
            var nd = THREE.MathUtils.lerp(cur, dist, 0.1);
            camera.position.copy(controls.target).add(dir.multiplyScalar(nd));
          }
        }
      } else gTag.hidden = true;

      if ((wxTick & 127) === 0) {
        var WXS = window.ZXSJ && window.ZXSJ.Scene;
        wxCond = WXS ? WXS.weather().condition : ((window.ZXSJ && window.ZXSJ.DataSource) ? window.ZXSJ.DataSource.getWeather().condition : 'sunny');
      }
      wxTick++;
      var nightK = window.__twinNight ? 1 : 0;
      var dimK = (wxCond === 'rain' || wxCond === 'snow') ? 0.8 : 1;
      key.intensity += (KEY_BASE * dimK * (1 - 0.45 * nightK) - key.intensity) * 0.08;
      amb.intensity += (AMB_BASE * dimK * (1 - 0.25 * nightK) - amb.intensity) * 0.08;
      glowMats.forEach(function (g2) { var pulse = g2.m.userData.pulse && !REDUCED ? 0.8 + 0.2 * (1 + Math.sin(now * Math.PI * 2 / 3000)) : 1; g2.m.emissiveIntensity += (g2.base * pulse * (1 + 1.3 * nightK) - g2.m.emissiveIntensity) * 0.08; });
      scene.fog.color.lerp(nightK ? fogNight : fogDay, 0.06);

      controls.update(); renderer.render(scene, camera);
    }
    tick._last = performance.now();
    raf = requestAnimationFrame(tick);

    function toggleFs() {
      if (!document.fullscreenElement) { (wrap.requestFullscreen || wrap.webkitRequestFullscreen || function () {}).call(wrap); wrap.classList.add('fs'); }
      else { (document.exitFullscreen || document.webkitExitFullscreen || function () {}).call(document); wrap.classList.remove('fs'); }
    }
    wrap.querySelector('#v3dFs').addEventListener('click', toggleFs);
    function onFsChange() { wrap.classList.toggle('fs', !!document.fullscreenElement); }
    document.addEventListener('fullscreenchange', onFsChange);
    function onEsc(e) { if (e.key === 'Escape' && document.fullscreenElement) { try { document.exitFullscreen(); } catch (err) {} wrap.classList.remove('fs'); } }
    document.addEventListener('keydown', onEsc);

    function close() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('twin:status-update', onStatus);
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('keydown', onEsc);
      if (document.fullscreenElement) { try { document.exitFullscreen(); } catch (e) {} }
      applyClip(false);
      scene.traverse(function (o) {
        if (o.isMesh || o.isPoints || o.isSprite || o.isLine) {
          if (o.geometry) o.geometry.dispose();
          var ms = Array.isArray(o.material) ? o.material : [o.material];
          ms.forEach(function (m) { if (m.map) m.map.dispose(); if (m.gradientMap) m.gradientMap.dispose(); m.dispose(); });
        }
      });
      sparkles.forEach(function (skl) { scene.remove(skl.sp); try { skl.sp.material.dispose(); } catch (e) {} });
      sparkles = [];
      if (aoTex) aoTex.dispose();
      if (pTex) pTex.dispose();
      if (signTex) signTex.dispose();
      if (v.gmap) v.gmap.dispose();
      controls.dispose(); window.removeEventListener('resize', onResize);
      renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss();
      renderer.domElement.remove(); wrap.remove();
      document.body.style.overflow = '';
      viewer = null;
    }
    wrap.querySelector('#v3dX').addEventListener('click', close);
    viewer = { close: close };
  }

  window.Twin3D = { open: open, close: function () { if (viewer) viewer.close(); }, available: detect };
  if (window.__setTwin3dAvail) window.__setTwin3dAvail();
})();
