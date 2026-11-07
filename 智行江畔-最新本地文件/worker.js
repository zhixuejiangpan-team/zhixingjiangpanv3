/* 智行江畔 —— DeepSeek API 代理（Cloudflare Worker）
 * 环境变量（在 Dashboard → Settings → Variables and Secrets 配置）：
 *   DEEPSEEK_KEY  —— DeepSeek API Key（Secret，platform.deepseek.com 申请）
 *   APP_SECRET    —— 前端请求头 X-App-Key 的校验值（Secret）
 * 严禁把 Key 写进前端代码或本文件。 */
export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, X-App-Key',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    const url = new URL(request.url);
    if (url.pathname === '/health')
      return Response.json({ ok: true }, { headers: cors });
    if (request.method !== 'POST' || url.pathname !== '/ai')
      return new Response('{}', { status: 404, headers: cors });
    if (!env.APP_SECRET || request.headers.get('X-App-Key') !== env.APP_SECRET)
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 403, headers: cors });
    const up = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.DEEPSEEK_KEY },
      body: request.body
    });
    return new Response(up.body, {
      status: up.status,
      headers: { ...cors, 'Content-Type': up.headers.get('content-type') || 'application/json' }
    });
  }
};
