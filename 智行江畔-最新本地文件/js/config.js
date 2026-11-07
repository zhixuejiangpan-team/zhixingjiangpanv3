/* ============================================================
   智行江畔 V9.0 —— 全局配置（外部输入接口集中于此）
   ------------------------------------------------------------
   【高德地图】Key 已由团队申请并填入（Web端JS API）。
     如需更换：将 AMAP_KEY / AMAP_SECURITY_JS_CODE 替换为新值；
     域名白名单填 zhixuejiangpan-team.github.io 主域名（不含子路径）。
     留空时地图段自动显示申请指引占位层，不白屏不报错。
   【AI · DeepSeek】AI_CONFIG.PROXY_URL 已指向线上代理（Cloudflare Pages Function），
     API Key 由服务端机密变量持有，前端无需填写 API_KEY。
     本地调试可改回 'http://localhost:3001/ai' 并 `node server.js`
     （服务端环境变量 DEEPSEEK_KEY 持有 Key）。
     模型接口为 OpenAI chat/completions 兼容格式：
     deepseek-chat（通用对话）/ deepseek-reasoner（深度推理）。
   ============================================================ */
window.AMAP_KEY = '8c32faab57b6db42668c2015902fcbad';
window.AMAP_SECURITY_JS_CODE = 'c7d194cb1a0480fe8b5c889a503edfd9';
/* 深色/主题化：高德自定义样式总开关（false 可全局禁用深色预检） */
window.MAP_DARK_STYLE = true;

window.AI_CONFIG = {
  API_KEY: '',  // Key 由服务端代理持有，前端无需填写
  APP_KEY: 'zhixuejiangpan2026',  // 代理访问校验（与服务端 APP_SECRET 一致）
  MODEL: 'deepseek-chat',         // DeepSeek 通用对话模型；深度推理可换 'deepseek-reasoner'
  ENDPOINT: 'https://api.deepseek.com/chat/completions',  // DeepSeek API（OpenAI 兼容）
  PROXY_URL: 'https://zhixuejiangpan-v2.pages.dev/ai',   // 线上代理（Cloudflare Pages Function，V2 独立项目）
  MAX_CONTEXT: 5,
  TIMEOUT: 60000,                  // deepseek-chat 常规响应 <30s，60s 兜底（换 reasoner 可调回 120s）
  SYSTEM_PROMPT: '你是"智行江畔"的江财校园生活助手。规则：1.优先基于本地知识库（js/data.js 的 spots/hotQuestions/workflows）回答，准确引用具体点位名和步骤；2.本地知识没有时基于通用知识回答并提示"建议向相关部门确认"；3.回答控制在 200 字内，办事类问题必须给出具体地点和步骤；4.涉及心理/医疗话题时，提供一般性支持信息（如告知校医院位置、心理咨询预约方式），但明确不作医疗诊断，并建议联系专业老师。'
};

window.TEAM_NAME = '智行江畔团队';
window.SITE_VERSION = 'V9.0';
/* 天气数据源：和风/高德 Web 服务 Key —— 与 index.html 的 JS API Key
   不同，需单独申请。留空时全站优雅降级为晴天，不发任何网络请求。
   PROVIDER: 'amap'（高德 Web 服务，city=360100 南昌）或 'qweather'（和风天气） */
window.WEATHER_CONFIG = { PROVIDER: 'amap', KEY: 'def361f20129e489dea6c214f0fa96df', CITY: '360100' };
/* 知识库演示种子开关：true 时首次访问自动注入 10 条演示知识+7 天演示统计，
   成长卡片显示"演示数据"角标；false 时完全不注入，知识库从空白开始自然沉淀 */
window.KB_DEMO_MODE = true;
/* 校区卡片小地图视野（人工校准固定值，禁止运行时动态计算）。
   依据 js/data.js 实测坐标聚合：蛟桥北 n=25 / 蛟桥南 n=10 / 麦庐北 n=4 / 麦庐南 n=28 */
window.TWIN_MINI_MAP = {
  jq_north: { center: [115.85519, 28.74656], zoom: 16 },
  jq_south: { center: [115.85472, 28.74051], zoom: 16 },
  ml_north: { center: [115.81759, 28.73264], zoom: 16 },
  ml_south: { center: [115.81637, 28.72777], zoom: 16 }
};

/* ============================================================
   V9.0 新增配置
   ============================================================ */
/* 三套主题：draft=黑白稿纸 / neon=霓虹科技 / doodle=彩色涂鸦。
   默认 doodle（V9 核心美术方向）。localStorage 键 zxsj66_theme。 */
window.THEME_CONFIG = {
  themes: ['doodle', 'neon', 'draft'],
  labels: { doodle: '彩色涂鸦', neon: '霓虹科技', draft: '黑白稿纸' },
  default: 'doodle',
  key: 'zxsj66_theme'
};
/* 摄像头手势（MediaPipe Hands）：默认关闭，用户主动开启后生效。
   仅桌面端可选，移动端自动隐藏。localStorage 键 zxsj66_gesture。
   CDN 使用官方 UMD 包文件名（hands.js / camera_utils.js，无 .min 版本），
   wasmRoot 供 locateFile 加载 model/loader 资源。 */
window.GESTURE_CONFIG = {
  key: 'zxsj66_gesture',
  default: false,
  cdn: {
    hands: [
      'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/hands.js',
      'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js',
      'https://unpkg.com/@mediapipe/hands@0.4/hands.js'
    ],
    camera: [
      'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3/camera_utils.js',
      'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
      'https://unpkg.com/@mediapipe/camera_utils@0.3/camera_utils.js'
    ],
    wasmRoot: 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/'
  }
};
/* 滚动叙事：四段 id 顺序；桌面滚轮整屏翻页，移动端关闭 snap 改自然滚动 */
window.NARRATIVE_CONFIG = {
  sections: ['ask', 'map', 'twin', 'guide'],
  key: 'zxsj66_intro'
};
