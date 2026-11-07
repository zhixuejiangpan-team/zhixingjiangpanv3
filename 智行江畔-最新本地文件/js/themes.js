/* ============================================================
   智行江畔 V9.0 —— 主题系统（三套可切换）
   - draft : 黑白稿纸（单色纸感、克制）
   - neon  : 霓虹科技（深底 + 高亮发光）
   - doodle: 彩色涂鸦（高饱和撞色 + 手绘抖线 + 纸质纹理，默认）
   - 持久化：localStorage 'zxsj66_theme'
   - 切换时在 <html> 上设置 data-theme，并广播 'zxsj66:theme-change'
     供光标 / 力导图 / 孪生 / 地图等模块按主题重写交互细节。
   ============================================================ */
(function () {
  'use strict';
  var W = window;
  var CFG = (W.THEME_CONFIG) || { themes: ['doodle', 'neon', 'draft'], default: 'doodle', key: 'zxsj66_theme', labels: {} };
  var THEMES = CFG.themes;
  var DEFAULT = CFG.default || 'doodle';
  var KEY = CFG.key || 'zxsj66_theme';

  function current() {
    return document.documentElement.getAttribute('data-theme') || DEFAULT;
  }
  function isValid(name) { return THEMES.indexOf(name) !== -1; }
  function apply(name, persist) {
    if (!isValid(name)) name = DEFAULT;
    document.documentElement.setAttribute('data-theme', name);
    if (persist !== false) { try { localStorage.setItem(KEY, name); } catch (e) {} }
    syncSwitcher();
    try { W.dispatchEvent(new CustomEvent('zxsj66:theme-change', { detail: { theme: name } })); } catch (e) {}
    return name;
  }
  function set(name) { return apply(name, true); }
  function cycle() {
    var i = THEMES.indexOf(current());
    return apply(THEMES[(i + 1) % THEMES.length], true);
  }

  /* 侧边栏/设置里的主题切换 UI：三枚手绘圆钮 + 当前标签 */
  function syncSwitcher() {
    var root = document.getElementById('themeSwitcher');
    if (!root) return;
    var cur = current();
    root.querySelectorAll('[data-theme-opt]').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-theme-opt') === cur);
    });
    var label = document.getElementById('themeLabel');
    if (label) label.textContent = (CFG.labels && CFG.labels[cur]) || cur;
  }
  function renderSwitcher(mount) {
    if (!mount) return;
    var labels = CFG.labels || {};
    mount.innerHTML = '<div class="theme-switcher" id="themeSwitcher" role="group" aria-label="主题切换">' +
      THEMES.map(function (t) {
        return '<button type="button" class="theme-opt theme-opt--' + t + '" data-theme-opt="' + t + '" title="' + (labels[t] || t) + '"><span class="theme-swatch"></span><span class="theme-opt-label">' + (labels[t] || t) + '</span></button>';
      }).join('') +
      '<span class="theme-now" id="themeLabel">' + (labels[current()] || current()) + '</span></div>';
    mount.addEventListener('click', function (e) {
      var b = e.target.closest('[data-theme-opt]');
      if (!b) return;
      set(b.getAttribute('data-theme-opt'));
    });
    syncSwitcher();
  }

  /* 启动：读持久化主题（非法回退默认），尽量在首绘前执行 */
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  if (!isValid(saved)) saved = DEFAULT;
  document.documentElement.setAttribute('data-theme', saved);

  W.ZXSJ = W.ZXSJ || {};
  W.ZXSJ.Themes = { current: current, set: set, cycle: cycle, apply: apply, renderSwitcher: renderSwitcher, isValid: isValid };
  /* DOM 就绪后把切换器挂到侧边栏预留容器 */
  function mountWhenReady() {
    var mount = document.getElementById('themeSwitcherMount');
    if (mount) { renderSwitcher(mount); return; }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { renderSwitcher(document.getElementById('themeSwitcherMount')); });
  }
  mountWhenReady();
})();
