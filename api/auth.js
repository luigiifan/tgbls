/* ============================================================
   Tigabelas — Authentication & User Management API
   Vercel serverless function storing users in Supabase JSON state.
   ============================================================ */

const TABLE = 'app_state';
const ROW_ID = 'tigabelas';

const DEFAULT_USERS = [
  {
    id: 'usr_lgiifn',
    username: 'lgiifn',
    pass: '13052004',
    name: 'Luigi Ifan',
    sex: 'Him',
    theme: 'dark',
    role: 'admin',
    permissions: {
      canManageEvents: true,
      canManageMovies: true,
      canManageUsers: true,
    },
    createdAt: 1700000000000,
  },
  {
    id: 'usr_ysfany',
    username: 'ysfany',
    pass: '13042003',
    name: 'Yousyta Fany',
    sex: 'Her',
    theme: 'pink',
    role: 'admin',
    permissions: {
      canManageEvents: true,
      canManageMovies: true,
      canManageUsers: true,
    },
    createdAt: 1700000000000,
  },
];

function sbEnv() {
  return {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
  };
}

async function sbGetState() {
  const { url, key } = sbEnv();
  if (!url || !key) return null;
  try {
    const r = await fetch(`${url}/rest/v1/${TABLE}?id=eq.${ROW_ID}&select=data`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!r.ok) return null;
    const rows = await r.json();
    return rows[0] ? rows[0].data : null;
  } catch (e) {
    return null;
  }
}

async function sbSaveState(data) {
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
  if (!r.ok) throw new Error('Supabase save failed: ' + r.status + ' ' + (await r.text()));
}

function sanitizeUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    name: u.name || u.username,
    sex: u.sex || 'Him',
    theme: u.theme || 'dark',
    role: u.role || 'editor',
    permissions: {
      canManageEvents: u.permissions ? Boolean(u.permissions.canManageEvents) : true,
      canManageMovies: u.permissions ? Boolean(u.permissions.canManageMovies) : true,
      canManageUsers: u.permissions ? Boolean(u.permissions.canManageUsers) : (u.role === 'admin'),
    },
    createdAt: u.createdAt || Date.now(),
  };
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
    const state = (await sbGetState()) || { events: [], tags: [], movies: [], users: DEFAULT_USERS };
    let users = Array.isArray(state.users) && state.users.length > 0 ? state.users : [...DEFAULT_USERS];

    // GET: List users
    if (req.method === 'GET') {
      const sanitized = users.map(sanitizeUser);
      return res.status(200).json({ ok: true, users: sanitized });
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      const action = body.action || (body.username && body.password ? 'login' : 'list');

      // 1. LOGIN
      if (action === 'login') {
        const username = (body.username || '').trim().toLowerCase();
        const password = (body.password || '').trim();

        const match = users.find(
          (u) => u.username.toLowerCase() === username && String(u.pass) === password
        );

        if (!match) {
          return res.status(401).json({ ok: false, error: 'Username atau password salah.' });
        }

        return res.status(200).json({ ok: true, user: sanitizeUser(match) });
      }

      // 2. LIST USERS
      if (action === 'list') {
        return res.status(200).json({ ok: true, users: users.map(sanitizeUser) });
      }

      // 3. SAVE / EDIT USER
      if (action === 'save') {
        const uData = body.user || {};
        const username = (uData.username || '').trim().toLowerCase();
        if (!username) {
          return res.status(400).json({ ok: false, error: 'Username wajib diisi.' });
        }

        // Check if editing or creating
        const existingIdx = users.findIndex((u) => u.id === uData.id || u.username.toLowerCase() === username);

        if (uData.id && existingIdx !== -1) {
          // Edit existing user
          const existing = users[existingIdx];
          users[existingIdx] = {
            ...existing,
            username: username,
            name: (uData.name || '').trim() || existing.name,
            sex: uData.sex || existing.sex,
            theme: uData.theme || existing.theme,
            role: uData.role || existing.role,
            pass: uData.pass ? String(uData.pass).trim() : existing.pass,
            permissions: {
              canManageEvents: uData.permissions ? Boolean(uData.permissions.canManageEvents) : existing.permissions.canManageEvents,
              canManageMovies: uData.permissions ? Boolean(uData.permissions.canManageMovies) : existing.permissions.canManageMovies,
              canManageUsers: uData.permissions ? Boolean(uData.permissions.canManageUsers) : existing.permissions.canManageUsers,
            },
          };
        } else {
          // Create new user
          if (existingIdx !== -1) {
            return res.status(400).json({ ok: false, error: 'Username sudah digunakan.' });
          }
          if (!uData.pass) {
            return res.status(400).json({ ok: false, error: 'Password wajib diisi untuk user baru.' });
          }

          const newUser = {
            id: 'usr_' + Math.random().toString(36).substring(2, 9),
            username: username,
            pass: String(uData.pass).trim(),
            name: (uData.name || '').trim() || username,
            sex: uData.sex || 'Him',
            theme: uData.theme || 'dark',
            role: uData.role || 'editor',
            permissions: {
              canManageEvents: uData.permissions ? Boolean(uData.permissions.canManageEvents) : true,
              canManageMovies: uData.permissions ? Boolean(uData.permissions.canManageMovies) : true,
              canManageUsers: uData.permissions ? Boolean(uData.permissions.canManageUsers) : (uData.role === 'admin'),
            },
            createdAt: Date.now(),
          };
          users.push(newUser);
        }

        // Save state to Supabase
        state.users = users;
        state.updatedAt = Date.now();
        await sbSaveState(state);

        return res.status(200).json({ ok: true, users: users.map(sanitizeUser) });
      }

      // 4. DELETE USER
      if (action === 'delete') {
        const idToDelete = body.id;
        if (!idToDelete) {
          return res.status(400).json({ ok: false, error: 'User ID wajib disertakan.' });
        }

        if (users.length <= 1) {
          return res.status(400).json({ ok: false, error: 'Tidak dapat menghapus user terakhir.' });
        }

        users = users.filter((u) => u.id !== idToDelete);
        state.users = users;
        state.updatedAt = Date.now();
        await sbSaveState(state);

        return res.status(200).json({ ok: true, users: users.map(sanitizeUser) });
      }

      return res.status(400).json({ ok: false, error: 'Aksi tidak dikenali.' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
};
