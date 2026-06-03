/* ============================================================
   Tigabelas — shared state API (Vercel serverless function)
   Stores { events, tags } as one JSON document in Vercel KV
   (Upstash Redis) via its REST API. No npm deps needed.

   Required env vars (set in Vercel project settings):
     KV_REST_API_URL   (or UPSTASH_REDIS_REST_URL)
     KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_TOKEN)
   Optional:
     TGBLS_CODES = "1305,1304"   (codes allowed to write)
   ============================================================ */

const KEY = 'tigabelas:state';

function kvEnv() {
  return {
    url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
  };
}

// Run a Redis command via the Upstash REST API (e.g. ["GET", key]).
async function kv(cmd) {
  const { url, token } = kvEnv();
  if (!url || !token) throw new Error('KV not configured');
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error('KV request failed: ' + r.status);
  return r.json(); // { result: ... }
}

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

const CODES = (process.env.TGBLS_CODES || '1305,1304').split(',').map((s) => s.trim());

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-tgbls-code');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const out = await kv(['GET', KEY]);
      const data = out.result ? JSON.parse(out.result) : { events: [], tags: [], updatedAt: 0 };
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      const code = (req.headers['x-tgbls-code'] || body.code || '').toString();
      if (!CODES.includes(code)) return res.status(401).json({ error: 'invalid code' });

      const data = {
        events: Array.isArray(body.events) ? body.events : [],
        tags: Array.isArray(body.tags) ? body.tags : [],
        updatedAt: Date.now(),
      };
      await kv(['SET', KEY, JSON.stringify(data)]);
      return res.status(200).json({ ok: true, updatedAt: data.updatedAt });
    }

    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
};
