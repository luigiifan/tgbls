/* ============================================================
   Tigabelas — shared state API (Vercel serverless function)
   Stores { events, tags } as one JSON row in Supabase (Postgres)
   via its REST API (PostgREST). No npm deps needed.

   Required env vars (set in Vercel project settings):
     SUPABASE_URL                 e.g. https://xxxx.supabase.co
     SUPABASE_SERVICE_ROLE_KEY    (service_role key — server-side only!)
   Optional:
     TGBLS_CODES = "1305,1304"    (codes allowed to write)

   One-time SQL to run in Supabase (SQL editor):
     create table if not exists app_state (
       id text primary key,
       data jsonb not null default '{}'::jsonb,
       updated_at timestamptz not null default now()
     );
     alter table app_state enable row level security;
   (service_role bypasses RLS, so no policies are needed.)
   ============================================================ */

const TABLE = 'app_state';
const ROW_ID = 'tigabelas';

function sbEnv() {
  return {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
  };
}

async function sbGet() {
  const { url, key } = sbEnv();
  if (!url || !key) throw new Error('Supabase not configured');
  const r = await fetch(`${url}/rest/v1/${TABLE}?id=eq.${ROW_ID}&select=data`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!r.ok) throw new Error('Supabase GET failed: ' + r.status);
  const rows = await r.json();
  return rows[0] ? rows[0].data : null;
}

async function sbUpsert(data) {
  const { url, key } = sbEnv();
  if (!url || !key) throw new Error('Supabase not configured');
  const r = await fetch(`${url}/rest/v1/${TABLE}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify([{ id: ROW_ID, data, updated_at: new Date().toISOString() }]),
  });
  if (!r.ok) throw new Error('Supabase upsert failed: ' + r.status + ' ' + (await r.text()));
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

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const data = (await sbGet()) || { events: [], tags: [], movies: [], updatedAt: 0 };
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      const data = {
        events: Array.isArray(body.events) ? body.events : [],
        tags: Array.isArray(body.tags) ? body.tags : [],
        movies: Array.isArray(body.movies) ? body.movies : [],
        updatedAt: Date.now(),
      };
      await sbUpsert(data);
      return res.status(200).json({ ok: true, updatedAt: data.updatedAt });
    }

    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
};
