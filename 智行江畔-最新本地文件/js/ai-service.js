/* ============================================================
   智行江畔 V9.0 —— AI 服务层（DeepSeek API，OpenAI chat/completions 兼容）
   功能：调用代理 / 点位模糊解析 / 敏感词分级 / 医疗内容过滤 /
         频率限制 / 断网检测
   本文件对 Node 环境安全（typeof 守卫），便于单元测试解析函数
   ============================================================ */
(function () {
  'use strict';
  var W = (typeof window !== 'undefined') ? window : globalThis;

  /* ---------- 调用频率限制：10秒内最多3次 ---------- */
  var callTimes = [];
  function rateLimited() {
    var now = Date.now();
    callTimes = callTimes.filter(function (t) { return now - t < 10000; });
    if (callTimes.length >= 3) return true;
    callTimes.push(now);
    return false;
  }

  /* ---------- 敏感词分级 ---------- */
  function hitHighRisk(q) {
    var list = (W.HIGH_RISK_KEYWORDS) || [];
    for (var i = 0; i < list.length; i++) if (q.indexOf(list[i]) !== -1) return list[i];
    return null;
  }
  function hitMidRisk(q) {
    var list = (W.SENSITIVE_KEYWORDS) || [];
    for (var i = 0; i < list.length; i++) if (q.indexOf(list[i]) !== -1) return list[i];
    return null;
  }

  /* ---------- AI 返回内容二次过滤：医疗诊断类词汇替换 ---------- */
  var MEDICAL_WORDS = ['诊断', '开药', '治疗方案', '处方', '确诊', '药品剂量'];
  var MEDICAL_REPLACE = '该问题涉及专业医疗，建议联系校医院（蛟桥园南区大学生活动中心204，0791-83802309）或辅导员获取专业帮助';
  function filterMedical(text) {
    for (var i = 0; i < MEDICAL_WORDS.length; i++) {
      if (text.indexOf(MEDICAL_WORDS[i]) !== -1) return MEDICAL_REPLACE;
    }
    return text;
  }

  /* ---------- 调用 DeepSeek（经本地代理，请求体 OpenAI 兼容原样透传） ---------- */
  /* V6.9：统一 localStorage 前缀 zxsj66_（旧键 aiChatHistory 一次性迁移） */
  var HIST_KEY = 'zxsj66_aichat';
  function loadHistory() {
    try {
      var raw = localStorage.getItem(HIST_KEY);
      if (raw === null) { raw = localStorage.getItem('aiChatHistory'); if (raw !== null) localStorage.setItem(HIST_KEY, raw); }
      return JSON.parse(raw) || [];
    } catch (e) { return []; }
  }
  function saveHistory(h) {
    try { localStorage.setItem(HIST_KEY, JSON.stringify(h.slice(-10))); } catch (e) {}
  }
  function callAI(query) {
    return new Promise(function (resolve, reject) {
      var cfg = W.AI_CONFIG || {};
      if (!cfg.API_KEY && !cfg.PROXY_URL) { reject(new Error('未配置：请启动本地代理（node server.js）并在 js/config.js 填入 PROXY_URL')); return; }
      if (!cfg.PROXY_URL) { reject(new Error('未配置：请在 js/config.js 填入 PROXY_URL（本地代理地址）')); return; }
      var history = loadHistory().slice(-(cfg.MAX_CONTEXT || 5));
      var messages = [{ role: 'system', content: cfg.SYSTEM_PROMPT || '' }]
        .concat(history.map(function (h) { return { role: h.role, content: h.content }; }))
        .concat([{ role: 'user', content: query }]);
      var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, cfg.TIMEOUT || 15000);
      fetch(cfg.PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-App-Key': cfg.APP_KEY || '' },
        signal: ctrl ? ctrl.signal : undefined,
        body: JSON.stringify({ model: cfg.MODEL || 'deepseek-chat', messages: messages })
      }).then(function (r) {
        clearTimeout(timer);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      }).then(function (data) {
        var text = data && data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
        text = filterMedical(String(text));
        /* 记录上下文（最多10条） */
        var h = loadHistory();
        h.push({ role: 'user', content: query }, { role: 'assistant', content: text });
        saveHistory(h);
        resolve(text);
      }).catch(function (e) { clearTimeout(timer); reject(e); });
    });
  }

  /* ---------- 点位解析：精确匹配 → 模糊匹配 ---------- */
  /* 相似度：Dice 系数（字符 bigram），> 0.6 视为命中 */
  function dice(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;
    function grams(s) {
      var m = {};
      for (var i = 0; i < s.length - 1; i++) { var g = s.slice(i, i + 2); m[g] = (m[g] || 0) + 1; }
      return m;
    }
    var ga = grams(a), gb = grams(b), overlap = 0, ta = 0, tb = 0, k;
    for (k in ga) ta += ga[k];
    for (k in gb) { tb += gb[k]; if (ga[k]) overlap += Math.min(ga[k], gb[k]); }
    return (ta && tb) ? (2 * overlap) / (ta + tb) : 0;
  }
  function tokenize(text) {
    /* 中文按2-6字滑窗分词 + 英文/数字整词 */
    var tokens = [], m = text.match(/[A-Za-z0-9]+/g);
    if (m) tokens = tokens.concat(m.map(function (x) { return x.toLowerCase(); }));
    var clean = text.replace(/[\s，。、；：？！""''（）()【】《》<>]/g, '');
    for (var len = 6; len >= 2; len--) {
      for (var i = 0; i + len <= clean.length; i++) tokens.push(clean.slice(i, i + len));
    }
    return tokens;
  }
  function parseSpotsFromAnswer(answer) {
    var all = (W.spots || []).concat(W.surroundingSpots || []);
    var matched = [], used = {};
    /* 1) 精确匹配：name / aliases / tags 被回答包含 */
    all.forEach(function (sp) {
      var names = [sp.name].concat(sp.aliases || [], sp.tags || []);
      for (var i = 0; i < names.length; i++) {
        if (names[i] && names[i].length >= 2 && answer.indexOf(names[i]) !== -1) {
          if (!used[sp.id]) { used[sp.id] = 1; matched.push(sp); }
          return;
        }
      }
    });
    if (matched.length) return matched.slice(0, 4);
    /* 2) 模糊匹配：回答分词 × 点位 name/aliases 相似度 > 0.6 */
    var tokens = tokenize(answer);
    all.forEach(function (sp) {
      var names = [sp.name].concat(sp.aliases || []);
      for (var i = 0; i < names.length; i++) {
        for (var j = 0; j < tokens.length; j++) {
          if (dice(names[i], tokens[j]) > 0.6) {
            if (!used[sp.id]) { used[sp.id] = 1; matched.push(sp); }
            return;
          }
        }
      }
    });
    return matched.slice(0, 4);
  }
  function parseCampusFromAnswer(answer) {
    var campuses = ['蛟桥园', '麦庐园', '枫林园'];
    for (var i = 0; i < campuses.length; i++) if (answer.indexOf(campuses[i]) !== -1) return campuses[i];
    return null;
  }

  W.AIService = {
    callAI: callAI,
    parseSpotsFromAnswer: parseSpotsFromAnswer,
    parseCampusFromAnswer: parseCampusFromAnswer,
    hitHighRisk: hitHighRisk,
    hitMidRisk: hitMidRisk,
    filterMedical: filterMedical,
    rateLimited: rateLimited,
    loadHistory: loadHistory,
    saveHistory: saveHistory,
    clearHistory: function () { saveHistory([]); },
    _dice: dice
  };
})();
