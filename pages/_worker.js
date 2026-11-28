// The origin has no public editor. Only this production Pages deployment may forward API calls.
const origin = 'https://urushi-api-600161670355.asia-northeast1.run.app';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (url.hostname !== 'urushi-demo.pages.dev') {
      return Response.json({ error: 'この配信では生成を利用できません' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
    const upstream = new URL(origin);
    upstream.pathname = url.pathname;
    upstream.search = url.search;
    const headers = new Headers();
    for (const name of ['accept', 'content-type', 'cf-access-jwt-assertion', 'origin', 'last-event-id']) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    return fetch(upstream, { method: request.method, headers, body: request.body, redirect: 'manual' });
  },
};
