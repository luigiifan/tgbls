/**
 * Vercel Serverless Function: Global Store API (/api/store)
 * Persists events, wishes, and recap config in Firebase Realtime Database via REST API.
 * Compatible with both the Web UI and Kodular Android REST API / FirebaseDB.
 */

const STORE_PATH = 'store.json';

const DEFAULT_STORE_DATA = {
  events: [],
  wishes: {},
  recap: {
    stats: {
      totalMovies: 12,
      targetMovies: 15,
      totalMemories: 24,
      targetMemories: 30
    },
    highlights: {
      bestEvent: 'Annual Planning & Kick-off Meeting',
      bestMovie: 'Interstellar (Sci-Fi)',
      bestMemory: 'Weekend Road Trip (June 2026)',
      bestPlace: 'Ubud, Bali',
      latestMovie: 'Dune: Part Two (08/11/2026)',
      latestMemory: 'Sunset Dinner by the Lake (11/11/2026)'
    }
  }
};

function getFirebaseEndpoint() {
  const baseUrl = (process.env.FIREBASE_DATABASE_URL || '').replace(/\/+$/, '');
  if (!baseUrl) return '';
  const secret = process.env.FIREBASE_AUTH_SECRET || '';
  const query = secret ? `?auth=${encodeURIComponent(secret)}` : '';
  return `${baseUrl}/${STORE_PATH}${query}`;
}

function normalizeStoreData(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw.store && typeof raw.store === 'object' ? raw.store : raw;

  const events = Array.isArray(source.events)
    ? source.events
    : source.events && typeof source.events === 'object'
      ? Object.values(source.events)
      : DEFAULT_STORE_DATA.events;

  const wishes = source.wishes && typeof source.wishes === 'object' ? source.wishes : {};
  const recap = source.recap && typeof source.recap === 'object' ? source.recap : DEFAULT_STORE_DATA.recap;

  return { events, wishes, recap };
}

async function firebaseGet(endpoint) {
  const res = await fetch(endpoint);
  if (!res.ok) {
    throw new Error(`Firebase GET failed with status ${res.status}`);
  }
  const data = await res.json();
  return normalizeStoreData(data);
}

async function firebasePut(endpoint, data) {
  const res = await fetch(endpoint, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    throw new Error(`Firebase PUT failed with status ${res.status}`);
  }
  return res.json();
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const endpoint = getFirebaseEndpoint();
  if (!endpoint) {
    return res.status(503).json({
      status: 'error',
      message:
        'Firebase Realtime Database is not configured. Set FIREBASE_DATABASE_URL in Vercel Environment Variables.'
    });
  }

  try {
    if (req.method === 'GET') {
      let data = await firebaseGet(endpoint);
      if (!data) {
        data = DEFAULT_STORE_DATA;
        await firebasePut(endpoint, data);
      }
      return res.status(200).json({ status: 'success', data });
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      const existing = (await firebaseGet(endpoint)) || DEFAULT_STORE_DATA;

      const updated = {
        events: Array.isArray(body.events) ? body.events : existing.events,
        wishes: body.wishes && typeof body.wishes === 'object' ? body.wishes : existing.wishes,
        recap: body.recap && typeof body.recap === 'object' ? body.recap : existing.recap
      };

      await firebasePut(endpoint, updated);
      return res.status(200).json({ status: 'success', data: updated });
    }

    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      message: err.message || 'Internal server error'
    });
  }
}
