/* 智行江畔 —— DeepSeek API 代理（Cloudflare Pages Function，挂载于 /ai）
 * 机密变量（Pages 项目 Settings → Variables and Secrets）：
 *   DEEPSEEK_KEY —— DeepSeek API Key（platform.deepseek.com 申请）
 *   APP_SECRET   —— 前端请求头 X-App-Key 的校验值
 * DeepSeek 接口为 OpenAI chat/completions 兼容格式，请求体原样透传。 */
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, X-App-Key',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-App-Key'
  };
  if (!env.APP_SECRET || request.headers.get('X-App-Key') !== env.APP_SECRET) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 403, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
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
