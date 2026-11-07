/* 智行江畔 V9.0 —— DeepSeek API 本地跨域代理（<30行核心代码）
 * 用法：DEEPSEEK_KEY=你的key node server.js  →  监听 3001 端口
 * 前端把 AI_CONFIG.PROXY_URL 填为 http://localhost:3001/ai
 * 严禁前端直连 api.deepseek.com（暴露 Key）。
 * DeepSeek 接口为 OpenAI chat/completions 兼容格式，请求体原样透传即可。 */
const http = require('http');
const KEY = process.env.DEEPSEEK_KEY;

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.end();
  if (req.url === '/health') { res.statusCode = 200; return res.end('{"ok":true}'); }
  if (req.method !== 'POST' || req.url !== '/ai') { res.statusCode = 404; return res.end('{}'); }
  let body = '';
  req.on('data', c => body += c);
  req.on('end', async () => {
    try {
      console.log('[proxy] 收到请求', new Date().toLocaleTimeString(), body.slice(0, 80));
      const up = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY },
        body
      });
      console.log('[proxy] 上游响应', up.status);
      res.statusCode = up.status;
      res.setHeader('Content-Type', up.headers.get('content-type') || 'application/json');
      res.end(await up.text());
    } catch (e) {
      console.log('[proxy] 失败', String(e.message || e));
      res.statusCode = 502; res.end(JSON.stringify({ error: String(e.message || e) }));
    }
  });
}).listen(process.env.PORT || 3001, () => console.log('AI proxy on http://localhost:' + (process.env.PORT || 3001) + '/ai'));
