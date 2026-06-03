/* ============================================================
   Tigabelas — photo album API (Vercel serverless function)
   Image files → Supabase Storage (bucket "photos", public)
   Metadata    → Supabase table "photos"
   Frontend holds no keys; service_role stays server-side.

   Required env vars:
     SUPABASE_URL
     SUPABASE_SERVICE_ROLE_KEY
   Optional:
     TGBLS_CODES = "1305,1304"   (codes allowed to upload/delete)

   One-time setup in Supabase:
     -- table
     create table if not exists photos (
       id text primary key,
       url text not null,
       path text not null,
       meta jsonb not null default '{}'::jsonb,
       created_at timestamptz not null default now()
     );
     alter table photos enable row level security;
     -- storage: create a PUBLIC bucket named "photos" (Storage tab → New bucket)
   ============================================================ */

const TABLE = 'photos';
const BUCKET = 'photos';

function sbEnv() {
  return {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
  };
}
function authHeaders() {
  const { key } = sbEnv();
  return { apikey: key, Authorization: `Bearer ${key}` };
}
const CODES = (process.env.TGBLS_CODES || '1305,1304').split(',').map((s) => s.trim());

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

async function listPhotos() {
  const { url, key } = sbEnv();
  if (!url || !key) throw new Error('Supabase not configured');
  const r = await fetch(`${url}/rest/v1/${TABLE}?select=id,url,meta&order=created_at.desc`, { headers: authHeaders() });
  if (!r.ok) throw new Error('list failed: ' + r.status);
  const rows = await r.json();
  return rows.map((row) => ({ id: row.id, url: row.url, ...(row.meta || {}) }));
}
async function getPath(id) {
  const { url } = sbEnv();
  const r = await fetch(`${url}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}&select=path`, { headers: authHeaders() });
  if (!r.ok) return null;
  const rows = await r.json();
  return rows[0] ? rows[0].path : null;
}
async function insertRow(row) {
  const { url } = sbEnv();
  const r = await fetch(`${url}/rest/v1/${TABLE}`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify([row]),
  });
  if (!r.ok) throw new Error('insert failed: ' + r.status + ' ' + (await r.text()));
}
async function deleteRow(id) {
  const { url } = sbEnv();
  await fetch(`${url}/rest/v1/${TABLE}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: authHeaders() });
}
async function uploadObject(path, buffer, contentType) {
  const { url } = sbEnv();
  const r = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': contentType, 'x-upsert': 'true' },
    body: buffer,
  });
  if (!r.ok) throw new Error('upload failed: ' + r.status + ' ' + (await r.text()));
}
async function deleteObject(path) {
  const { url } = sbEnv();
  await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, { method: 'DELETE', headers: authHeaders() });
}
function publicUrl(path) {
  const { url } = sbEnv();
  return `${url}/storage/v1/object/public/${BUCKET}/${path}`;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-tgbls-code');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const code = (req.headers['x-tgbls-code'] || '').toString();

  try {
    if (req.method === 'GET') {
      return res.status(200).json(await listPhotos());
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      const theCode = code || (body.code || '').toString();
      if (!CODES.includes(theCode)) return res.status(401).json({ error: 'invalid code' });

      const m = /^data:(image\/[\w.+-]+);base64,(.+)$/.exec(body.dataUrl || '');
      if (!m) return res.status(400).json({ error: 'bad image' });
      const contentType = m[1];
      const buffer = Buffer.from(m[2], 'base64');
      const ext = (contentType.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      const id = (body.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 7));
      const path = `${id}.${ext}`;

      await uploadObject(path, buffer, contentType);
      const url = publicUrl(path);
      const meta = body.meta && typeof body.meta === 'object' ? body.meta : {};
      await insertRow({ id, url, path, meta });
      return res.status(200).json({ id, url, ...meta });
    }

    if (req.method === 'DELETE') {
      if (!CODES.includes(code)) return res.status(401).json({ error: 'invalid code' });
      const id = (req.query && req.query.id) || '';
      if (!id) return res.status(400).json({ error: 'missing id' });
      const path = await getPath(id);
      if (path) await deleteObject(path);
      await deleteRow(id);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
};
