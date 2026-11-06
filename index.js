const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/health') return json({ ok: true, service: 'boss-hunter-60' });
    if (url.pathname === '/api/state' && request.method === 'GET') {
      const row = await env.DB.prepare('SELECT state_json, updated_at FROM shared_state WHERE id = 1').first();
      if (!row) return json({ state: null, updatedAt: null });
      let state;
      try { state = JSON.parse(row.state_json); } catch { return json({ error: '数据库数据格式异常' }, 500); }
      return json({ state, updatedAt: row.updated_at });
    }
    if (url.pathname === '/api/state' && request.method === 'PUT') {
      let body;
      try { body = await request.json(); } catch { return json({ error: '请求不是有效JSON' }, 400); }
      const state = body?.state;
      if (!state || !Array.isArray(state.channels) || state.channels.length !== 60 || !Array.isArray(state.logs)) {
        return json({ error: '数据格式不正确' }, 400);
      }
      const serialized = JSON.stringify(state);
      if (serialized.length > 900000) return json({ error: '数据过大' }, 413);
      await env.DB.prepare(`INSERT INTO shared_state (id, state_json, updated_at)
        VALUES (1, ?, datetime('now'))
        ON CONFLICT(id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at`)
        .bind(serialized).run();
      return json({ ok: true });
    }
    if (url.pathname.startsWith('/api/')) return json({ error: 'Not found' }, 404);
    return env.ASSETS.fetch(request);
  }
};
