/* ============================================================
   智行江畔 V9.0 —— 可选摄像头手势控制（MediaPipe Hands）
   - 默认关闭；用户主动开启后生效（localStorage 'zxsj66_gesture'）。
   - 仅桌面端（hover:fine + 存在摄像头）可选；移动端自动隐藏。
   - 惰性加载 CDN（多源回退：jsdelivr → unpkg）；失败给出明确提示。
   - 开启后右下角显示摄像头 HUD 预览（含指尖跟踪点），可随时在
     设置抽屉 / 孪生 / 地图按钮关闭。
   - 输出统一手势描述，供孪生 3D 查看器 / 地图导航两处消费：
       { point:{x,y}, pinch:0..1, fist:bool, palm:bool, dx, dy, active }
       point 为食指指尖归一化坐标(0..1)；pinch 0=张开 1=捏合。
   ============================================================ */
(function () {
  'use strict';
  var W = window;
  var CFG = (W.GESTURE_CONFIG) || { key: 'zxsj66_gesture', cdn: {} };
  var KEY = CFG.key || 'zxsj66_gesture';
  var CDN = CFG.cdn || {};

  var _on = false, _running = false, _loaded = false, _loading = null;
  var hands = null, camera = null, video = null, hud = null, hudDot = null;
  var lastIdx = null;
  var _latest = { point: null, pinch: 0, fist: false, palm: false, dx: 0, dy: 0, active: false };

  function finePointer() { try { return !!(W.matchMedia && W.matchMedia('(hover: hover) and (pointer: fine)').matches); } catch (e) { return false; } }
  function hasCamera() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia); }
  function persisted() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  function setPersisted(v) { try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) {} }
  function supported() { return finePointer() && hasCamera(); }
  function isEnabled() { return _on; }
  function toast(msg) { if (W.__toast) W.__toast(msg); }

  /* ---------- 多源脚本加载（首个成功即止） ---------- */
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { s.remove(); reject(new Error('加载失败：' + src)); };
      document.head.appendChild(s);
    });
  }
  function tryLoad(urls) {
    urls = (Array.isArray(urls) ? urls : [urls]).slice();
    function next() {
      if (!urls.length) return Promise.reject(new Error('所有 CDN 源均加载失败'));
      return loadScript(urls.shift()).catch(next);
    }
    return next();
  }
  function ensureScripts() {
    if (_loaded) return Promise.resolve(true);
    if (_loading) return _loading;
    _loading = Promise.all([tryLoad(CDN.hands), tryLoad(CDN.camera)]).then(function () { _loaded = true; return true; });
    return _loading;
  }

  /* ---------- HUD 预览（右下角摄像头画面 + 指尖跟踪点） ---------- */
  function buildHud() {
    if (hud) return hud;
    hud = document.createElement('div');
    hud.className = 'gesture-hud';
    hud.innerHTML = '<video playsinline muted autoplay></video><i class="gesture-hud-dot"></i><span class="gesture-hud-label">✋ 手势控制中</span>';
    document.body.appendChild(hud);
    video = hud.querySelector('video');
    hudDot = hud.querySelector('.gesture-hud-dot');
    return hud;
  }
  function showHud() { buildHud().classList.add('on'); }
  function hideHud() { if (hud) hud.classList.remove('on'); }

  /* ---------- 手势识别 ---------- */
  function dist(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function classify(lm) {
    function ext(tip, pip, wrist) { return dist(lm[tip], lm[wrist]) > dist(lm[pip], lm[wrist]); }
    var palm = ext(8, 6, 0) && ext(12, 10, 0) && ext(16, 14, 0) && ext(20, 18, 0);
    var fist = !ext(8, 6, 0) && !ext(12, 10, 0) && !ext(16, 14, 0) && !ext(20, 18, 0);
    var thumb = lm[4], index = lm[8];
    var pinch = clamp(1 - dist(thumb, index) / 0.22, 0, 1);
    var x = index.x, y = index.y;
    var dx = 0, dy = 0;
    if (lastIdx) { dx = x - lastIdx.x; dy = y - lastIdx.y; }
    lastIdx = { x: x, y: y };
    return { point: { x: x, y: y }, pinch: pinch, fist: fist, palm: palm, dx: dx, dy: dy, active: true };
  }
  function onResults(results) {
    if (!_on) return;
    var lm = results && results.multiHandLandmarks && results.multiHandLandmarks[0];
    if (!lm) {
      _latest = { point: null, pinch: 0, fist: false, palm: false, dx: 0, dy: 0, active: false };
      if (hudDot) hudDot.classList.remove('track');
    } else {
      _latest = classify(lm);
      if (hudDot) {
        hudDot.classList.add('track');
        hudDot.style.left = (_latest.point.x * 100).toFixed(1) + '%';
        hudDot.style.top = (_latest.point.y * 100).toFixed(1) + '%';
      }
    }
  }

  /* ---------- 开关 ---------- */
  function enable() {
    if (!supported()) { toast('当前设备不支持手势控制（需桌面浏览器 + 摄像头）'); return false; }
    _on = true;
    setPersisted(true);
    showHud();
    ensureScripts().then(function () {
      if (!_on) return;
      if (!W.Hands || !W.Camera) { toast('手势模型加载失败：请检查网络后重试'); stop(true); return; }
      if (!hands) {
        try {
          hands = new W.Hands({ locateFile: function (f) { return (CDN.wasmRoot || 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/') + f; } });
          hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.6, minTrackingConfidence: 0.5 });
          hands.onResults(onResults);
        } catch (e) { toast('手势模型初始化失败'); stop(true); return; }
      }
      if (!camera) {
        try {
          camera = new W.Camera(video, {
            onFrame: function () { if (_on && hands) { try { hands.send({ image: video }); } catch (e) {} } },
            width: 640, height: 480
          });
        } catch (e) { toast('摄像头初始化失败'); stop(true); return; }
      }
      _running = true;
      camera.start().catch(function (e) {
        _running = false;
        toast('无法访问摄像头：请在浏览器地址栏允许摄像头权限后重试');
        stop(true);
      });
    }).catch(function () {
      toast('手势模型加载失败：CDN 不可达（需联网）');
      stop(true);
    });
    return true;
  }
  function stop(clearPersist) {
    _on = false;
    if (clearPersist !== false) setPersisted(false);
    try { if (camera && camera.stop) camera.stop(); } catch (e) {}
    try { if (hands && hands.close) hands.close(); } catch (e) {}
    _running = false;
    lastIdx = null;
    _latest = { point: null, pinch: 0, fist: false, palm: false, dx: 0, dy: 0, active: false };
    hideHud();
  }
  function disable() { stop(true); }
  function toggle() { return _on ? (disable(), false) : enable(); }

  W.ZXSJ = W.ZXSJ || {};
  W.ZXSJ.Gestures = { supported: supported, isEnabled: isEnabled, enable: enable, disable: disable, toggle: toggle, stop: stop, latest: function () { return _latest; } };
})();
