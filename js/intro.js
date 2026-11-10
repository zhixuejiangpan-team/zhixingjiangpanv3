/* ============================================================
   智行江畔 V10.2 —— 开屏引导叙事系统（纯 CSS+JS，可插拔独立模块）
   四段：迷茫 → 探索 → 掌控 → 成长
   - 单次滑动/滚轮累积阈值 → 触发一个动画 → 进入下一段（动画期间锁定）
   - 完成写入 zxsj66_intro_done，退回原有四 Tab 模式；ESC/跳过随时退出
   - 移动端触摸滑动替代滚轮；reduced-motion 直接跳过
   - 完成后 remove() 引导层 DOM，单 RAF，碎片/粒子 ≤ 50
   ============================================================ */
(function () {
  'use strict';
  var KEY = 'zxsj66_intro_done';
  var RM = false;
  try { RM = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var done = false;
  try { done = localStorage.getItem(KEY) === '1'; } catch (e) {}
  if (done || RM) return;   /* 已看过 / 低动态：直接进入首页 */

  var MOB = false;
  try { MOB = matchMedia('(max-width: 768px)').matches; } catch (e) {}
  var COLORS = ['#FF2E63', '#08D9D6', '#F9ED69', '#6BCB77'];
  var CLIPS = [
    'polygon(50% 0%, 100% 35%, 78% 100%, 18% 82%, 0% 38%)',
    'polygon(0% 28%, 62% 0%, 100% 55%, 30% 100%)',
    'polygon(50% 0%, 100% 100%, 0% 82%)',
    'polygon(18% 10%, 88% 0%, 100% 84%, 40% 100%)',
    'polygon(8% 18%, 74% 0%, 100% 68%, 56% 100%, 0% 76%)',
    'polygon(12% 0%, 100% 28%, 68% 100%)'
  ];

  var root = document.createElement('div');
  root.className = 'intro-overlay';
  root.id = 'introOverlay';
  root.innerHTML =
    '<button type="button" class="intro-skip" id="introSkip">跳过 ⏭</button>' +
    '<div class="intro-dots" id="introDots"><i></i><i></i><i></i><i></i></div>' +
    '<div class="intro-chtag" id="introChTag"></div>' +
    '<div class="intro-stage" id="introStage"></div>' +
    '<p class="intro-copy" id="introCopy"></p>' +
    '<p class="intro-sub" id="introSub">滑动 / 滚轮 进入下一段</p>';
  document.body.appendChild(root);
  document.body.classList.add('intro-lock');

  var stage = document.getElementById('introStage');
  var copyEl = document.getElementById('introCopy');
  var subEl = document.getElementById('introSub');
  var tagEl = document.getElementById('introChTag');
  var dots = Array.prototype.slice.call(document.querySelectorAll('#introDots i'));

  var cur = 0, locked = false, finished = false, ctaShown = false;
  var rafId = null, follow = { x: 0, y: 0, cx: 0, cy: 0 };

  /* ---------- 段落定义 ---------- */
  var CHAPTERS = [
    { /* 0 迷茫 */
      tag: '迷 茫', copy: '刚进校园，你有 100 个问题，但不知道问谁', sub: '第 1/4 段 · 迷茫',
      paper: false,
      build: function () {
        stage.innerHTML = '<div class="it-shards" id="itShards"><span class="it-question">?</span></div>';
        var host = stage.firstChild;
        var spots = [[7, 10], [24, 16], [44, 8], [62, 12], [80, 9], [88, 26], [75, 42], [57, 52], [34, 60], [15, 40], [48, 26], [66, 58]];
        for (var i = 0; i < 12; i++) {
          var p = document.createElement('div');
          p.className = 'shard-pos';
          p.style.left = spots[i][0] + '%';
          p.style.top = spots[i][1] + '%';
          p.setAttribute('data-depth', (0.35 + (i % 5) * 0.13).toFixed(2));
          var s = document.createElement('span');
          s.className = 'shard';
          s.style.setProperty('--c', COLORS[i % 4]);
          s.style.setProperty('--clip', CLIPS[i % CLIPS.length]);
          s.style.setProperty('--d', ((i % 6) * 0.55).toFixed(2) + 's');
          p.appendChild(s);
          host.insertBefore(p, host.firstChild);
        }
      },
      enter: function () {},
      climax: function (done) {
        var host = document.getElementById('itShards');
        var rect = host.getBoundingClientRect();
        var u = 4.6;
        var Q = [[-0.4, -2.6], [1.2, -3.0], [2.6, -2.3], [3.4, -1.0], [3.3, 0.5], [2.5, 1.6], [1.2, 2.2], [0.0, 2.0], [1.6, 3.2], [2.2, 2.9], [1.9, 3.7], [1.3, 3.4]];
        var shards = Array.prototype.slice.call(host.querySelectorAll('.shard-pos'));
        shards.forEach(function (el, i) {
          var slot = Q[i % Q.length];
          var x0 = parseFloat(el.style.left) / 100 * rect.width;
          var y0 = parseFloat(el.style.top) / 100 * rect.height;
          var tx = rect.width / 2 + slot[0] * u * (MOB ? 3.2 : 4.6) - x0;
          var ty = rect.height / 2 + slot[1] * u * (MOB ? 3.2 : 4.6) - y0;
          el.style.transform = 'translate(' + tx.toFixed(0) + 'px,' + ty.toFixed(0) + 'px) rotate(' + ((i % 3) - 1) * 6 + 'deg)';
        });
        host.classList.add('gathered');
        setTimeout(done, 1500);
      }
    },
    { /* 1 探索 */
      tag: '探 索', copy: '四个校区，71 个地点，先看见全貌', sub: '第 2/4 段 · 探索',
      paper: false,
      build: function () {
        stage.innerHTML = '<div class="it-map"><svg viewBox="0 0 640 420" aria-hidden="true"><g id="itMapG"></g></svg></div>';
        var g = document.getElementById('itMapG');
        var blobs = [
          { x: 150, y: 105, r: 56, c: '#FF2E63', label: '麦庐', lx: 150, ly: 92 },
          { x: 400, y: 78, r: 64, c: '#08D9D6', label: '蛟桥北', lx: 400, ly: 64 },
          { x: 430, y: 252, r: 60, c: '#F9ED69', label: '蛟桥南', lx: 430, ly: 242 },
          { x: 178, y: 268, r: 54, c: '#6BCB77', label: '枫林', lx: 178, ly: 254 }
        ];
        function blobPath(b) {
          var d = 'M';
          for (var k = 0; k <= 20; k++) {
            var a = k / 20 * Math.PI * 2;
            var rr = b.r + Math.sin(a * 5 + k * 1.7) * 4;
            d += ((k ? 'L' : '') + (b.x + Math.cos(a) * rr).toFixed(1) + ' ' + (b.y + Math.sin(a) * rr * 0.82).toFixed(1));
          }
          return d + 'Z';
        }
        var html = '';
        blobs.forEach(function (b, bi) {
          html += '<g class="campus-collage">';
          for (var si = 0; si < 6; si++) {
            var a0 = si / 6 * Math.PI * 2 + 0.035, a1 = (si + 1) / 6 * Math.PI * 2 - 0.035;
            var rr = b.r * 0.91, p0 = [b.x + Math.cos(a0) * rr, b.y + Math.sin(a0) * rr * 0.82], p1 = [b.x + Math.cos(a1) * rr, b.y + Math.sin(a1) * rr * 0.82];
            html += '<polygon class="campus-fragment" points="' + b.x + ',' + b.y + ' ' + p0[0].toFixed(1) + ',' + p0[1].toFixed(1) + ' ' + p1[0].toFixed(1) + ',' + p1[1].toFixed(1) + '" style="--fc:' + (si % 3 === 0 ? COLORS[(bi + 1) % 4] : b.c) + ';--fd:' + (si * 55 + bi * 80) + 'ms"/>';
          }
          html += '</g><path class="campus-path" d="' + blobPath(b) + '" style="--c:' + b.c + '" pathLength="100"/>';
        });
        html += '<path class="road-path" d="M150 105 L400 78" pathLength="100"/><path class="road-path" d="M400 78 L430 252" pathLength="100"/><path class="road-path" d="M430 252 L178 268" pathLength="100"/><path class="road-path" d="M178 268 L150 105" pathLength="100"/>';
        blobs.forEach(function (b) {
          html += '<text class="campus-label" x="' + b.lx + '" y="' + b.ly + '" text-anchor="middle">' + b.label + '</text>';
        });
        g.innerHTML = html;
      },
      enter: function () {
        stage.querySelectorAll('.campus-collage').forEach(function (g) { g.classList.add('assembled'); });
        var paths = stage.querySelectorAll('.campus-path');
        paths.forEach(function (p, i) { setTimeout(function () { p.classList.add('draw'); }, 320 + i * 160); });
        setTimeout(function () { stage.querySelectorAll('.road-path').forEach(function (r) { r.classList.add('draw'); }); }, 900);
        setTimeout(function () { stage.querySelectorAll('.campus-label').forEach(function (l) { l.classList.add('in'); }); }, 1150);
      },
      climax: function (done) {
        stage.querySelectorAll('.campus-path').forEach(function (p, i) {
          setTimeout(function () { p.style.fillOpacity = 0.6; setTimeout(function () { p.style.fillOpacity = ''; }, 420); }, i * 90);
        });
        setTimeout(done, 620);
      }
    },
    { /* 2 掌控 */
      tag: '掌 控', copy: '每一栋楼的人流、每一刻的状态，都在你眼前', sub: '第 3/4 段 · 掌控',
      paper: false,
      build: function () {
        stage.innerHTML = '<div class="it-twin-space"><div class="it-twin-grid" id="itTwinGrid"></div></div>';
        var grid = document.getElementById('itTwinGrid');
        var items = [['麦庐', '#FF2E63', 0, 0], ['蛟桥北', '#08D9D6', 1, 0], ['蛟桥南', '#F9ED69', 0, 1], ['枫林', '#6BCB77', 1, 1]];
        grid.innerHTML = items.map(function (it) {
          return '<div class="it-twin-card" style="left:' + (it[2] * 50) + '%;top:' + (it[3] * 50) + '%;--c:' + it[1] + ';--rz:' + (((it[2] + it[3]) % 2 ? 1 : -1) * 2) + 'deg"><span>' + it[0] + '</span><i class="it-card-glow"></i></div>';
        }).join('');
      },
      enter: function () {
        stage.querySelectorAll('.it-twin-card').forEach(function (c, i) {
          setTimeout(function () { c.classList.add('active'); }, 250 + i * 160);
        });
      },
      climax: function (done) {
        var grid = document.getElementById('itTwinGrid');
        var rect = grid.getBoundingClientRect();
        var N = MOB ? 3 : 6;
        var cards = Array.prototype.slice.call(grid.querySelectorAll('.it-twin-card'));
        cards.forEach(function (card, ci) {
          for (var i = 0; i < N; i++) {
            var pt = document.createElement('span');
            pt.className = 'it-particle';
            pt.style.left = ((ci % 2 === 0 ? 25 : 75) + (Math.random() * 20 - 10)) + '%';
            pt.style.top = ((ci < 2 ? 25 : 75) + (Math.random() * 20 - 10)) + '%';
            pt.style.setProperty('--px', ((Math.random() * 260 - 130).toFixed(0)) + 'px');
            pt.style.setProperty('--py', ((Math.random() * 240 - 160).toFixed(0)) + 'px');
            pt.style.background = COLORS[(ci + i) % 4];
            pt.style.clipPath = CLIPS[(ci + i) % CLIPS.length];
            pt.style.animationDelay = (Math.random() * 0.6).toFixed(2) + 's';
            grid.appendChild(pt);
            requestAnimationFrame(function () {
              requestAnimationFrame(function () {
                pt.style.transition = 'transform 1s cubic-bezier(0.2,0.7,0.3,1), opacity 1s';
                pt.style.transform = 'translate(var(--px), var(--py)) scale(0.4)';
                pt.style.opacity = '0';
              });
            });
          }
        });
        grid.classList.add('burst');
        var pv = document.createElement('div');
        pv.className = 'it-preview';
        var faceColors = ['#FF2E63', '#6BCB77', '#F9ED69', '#08D9D6', '#8A6FD1', '#3FA8B4'];
        pv.innerHTML = '<div class="it-cube">' + faceColors.map(function (fc, fi) { return '<i style="--fc:' + fc + ';--fs:' + faceColors[(fi + 1) % faceColors.length] + '"><b></b><b></b></i>'; }).join('') + '</div>';
        stage.appendChild(pv);
        setTimeout(function () { pv.classList.add('in'); }, 480);
        setTimeout(done, 1050);
      }
    },
    { /* 3 成长 */
      tag: '成 长', copy: '现在，你有了面对校园的一切工具', sub: '第 4/4 段 · 成长',
      paper: true,
      build: function () {
        var d0 = new Date();
        var dateStr = d0.getFullYear() + ' 年 ' + (d0.getMonth() + 1) + ' 月 ' + d0.getDate() + ' 日';
        stage.innerHTML =
          '<div class="it-badges" id="itBadges"></div>' +
          '<div class="it-cert" id="itCert"><h2>通关证书</h2><p>兹证明</p><div class="it-cert-name">江财新生</div><p>已完成「迷茫 → 探索 → 掌控 → 成长」全部旅程</p><div class="it-cert-date">' + dateStr + ' · 智行江畔</div><div class="it-cert-seal">通关</div></div>' +
          '<div class="intro-cta-wrap" id="itCtaWrap"><button type="button" class="intro-cta" id="introCta">开始探索</button></div>';
        var host = document.getElementById('itBadges');
        var icons = ['🏅', '📋', '🗓️', '💊', '🗺️', '🛰️', '💡', '⭐'];
        var starts = [[-46, -38], [42, -44], [-38, 40], [48, 36], [-50, 4], [52, -6], [8, -52], [-6, 52]];
        var ends = [[-150, -60, -8], [150, -60, 6], [-150, 60, 7], [150, 60, -6], [0, -105, -4], [0, 105, 5], [-190, 0, -9], [190, 0, 8]];
        icons.forEach(function (ic, i) {
          var b = document.createElement('span');
          b.className = 'it-badge';
          b.style.left = '50%'; b.style.top = '50%';
          b.style.transform = 'translate(' + starts[i][0] + 'vmin,' + starts[i][1] + 'vmin) rotate(' + ((i % 3) - 1) * 20 + 'deg)';
          b.style.setProperty('--ax', ends[i][0] + 'px');
          b.style.setProperty('--ay', ends[i][1] + 'px');
          b.style.setProperty('--ar', ends[i][2] + 'deg');
          b.innerHTML = '<i>' + ic + '</i>';
          host.appendChild(b);
        });
        document.getElementById('introCta').addEventListener('click', finish);
      },
      enter: function () {
        var badges = Array.prototype.slice.call(document.querySelectorAll('.it-badge'));
        badges.forEach(function (b, i) {
          setTimeout(function () { b.classList.add('arrived'); }, 120 + i * 90);
        });
        setTimeout(function () { document.getElementById('itCert').classList.add('in'); }, 950);
      },
      climax: function (done) {
        document.getElementById('itCert').classList.add('burst');
        document.querySelectorAll('.it-badge').forEach(function (b) { b.style.opacity = '0'; });
        ctaShown = true;
        setTimeout(function () { document.getElementById('itCtaWrap').classList.add('in'); }, 500);
        setTimeout(done, 800);
      }
    }
  ];

  /* ---------- 状态机：单次滑动触发 ---------- */
  var wheelDelta = 0, touchStartY = 0;
  function onSwipe(dir) {
    if (finished || locked) return;
    if (dir === 'up') {
      if (cur <= 0) return;
      locked = true;
      cur--;
      showChapter(cur);
      setTimeout(unlock, 700);
      return;
    }
    if (cur >= 3 && ctaShown) { finish(); return; }
    locked = true;
    var i = cur;
    if (!CHAPTERS[i]) { finish(); return; }   /* 兜底：越界即完成 */
    CHAPTERS[i].climax(function () {
      if (finished) return;
      cur++;
      if (cur >= 4) { /* 证书碎裂后由「开始探索」按钮结束；此处兜底 */ }
      else { showChapter(cur); unlock(); }
    });
  }
  function unlock() { locked = false; }

  function showChapter(i) {
    ctaShown = false;
    var ch = CHAPTERS[i];
    stage.innerHTML = '';
    stage.classList.remove('it-fade-in'); void stage.offsetWidth; stage.classList.add('it-fade-in');
    root.classList.toggle('it-paper', !!ch.paper);
    ch.build();
    tagEl.textContent = ch.tag;
    copyEl.textContent = ch.copy;
    subEl.textContent = ch.sub;
    requestAnimationFrame(function () { tagEl.classList.add('in'); copyEl.classList.add('in'); });
    dots.forEach(function (d, k) { d.classList.toggle('on', k === i); });
    ch.enter();
  }

  /* ---------- 交互输入 ---------- */
  function onWheel(e) {
    if (finished) return;
    wheelDelta += e.deltaY;
    if (Math.abs(wheelDelta) > 50) {
      onSwipe(wheelDelta > 0 ? 'down' : 'up');
      wheelDelta = 0;
    }
  }
  function onTouchStart(e) { touchStartY = e.touches[0].clientY; }
  function onTouchEnd(e) {
    var diff = touchStartY - e.changedTouches[0].clientY;
    if (Math.abs(diff) > 50) onSwipe(diff > 0 ? 'down' : 'up');
  }
  function onKey(e) {
    if (e.key === 'Escape') { e.stopImmediatePropagation(); finish(); }
    else if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); e.stopImmediatePropagation(); onSwipe('down'); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); e.stopImmediatePropagation(); onSwipe('up'); }
  }
  function onMouse(e) { follow.x = (e.clientX / window.innerWidth - 0.5) * 2; follow.y = (e.clientY / window.innerHeight - 0.5) * 2; }
  window.addEventListener('wheel', onWheel, { passive: true });
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchend', onTouchEnd, { passive: true });
  /* 捕获阶段拦截，阻止 app.js 的翻页/ESC 处理器在引导期间生效 */
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('mousemove', onMouse, { passive: true });
  document.getElementById('introSkip').addEventListener('click', finish);

  /* ---------- 单 RAF：碎片跟随（段0）/ 3D 卡片倾斜（段2） ---------- */
  function loop() {
    rafId = requestAnimationFrame(loop);
    if (finished) return;
    follow.cx += (follow.x - follow.cx) * 0.07;
    follow.cy += (follow.y - follow.cy) * 0.07;
    if (cur === 0 && !locked) {
      var host = document.getElementById('itShards');
      if (host && !host.classList.contains('gathered')) {
        Array.prototype.slice.call(host.querySelectorAll('.shard-pos')).forEach(function (el) {
          var d = parseFloat(el.getAttribute('data-depth') || '0.5');
          el.style.transform = 'translate3d(' + (follow.cx * d * 22).toFixed(1) + 'px,' + (follow.cy * d * 22).toFixed(1) + 'px,0)';
        });
      }
    }
    if (cur === 2) {
      var grid = document.getElementById('itTwinGrid');
      if (grid && !grid.classList.contains('burst')) {
        grid.style.transform = 'rotateX(' + (follow.cy * 6).toFixed(2) + 'deg) rotateY(' + (follow.cx * 8).toFixed(2) + 'deg)';
      }
    }
  }

  /* ---------- 完成与退出 ---------- */
  function finish() {
    if (finished) return;
    finished = true;
    try { localStorage.setItem(KEY, '1'); } catch (e) {}
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('touchstart', onTouchStart);
    window.removeEventListener('touchend', onTouchEnd);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('mousemove', onMouse);
    if (rafId) cancelAnimationFrame(rafId);
    document.body.classList.remove('intro-lock');
    root.classList.add('out');
    setTimeout(function () { if (root.parentNode) root.parentNode.removeChild(root); }, 850);
  }

  /* ---------- 启动 ---------- */
  showChapter(0);
  rafId = requestAnimationFrame(loop);
})();
