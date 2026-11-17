// Builds the dashboard's data and keeps a cached copy in KV so the page opens instantly.
//   Page load    → cached copy straight away (if there is one), marked stale after FRESH_FOR_MS
//   Browser      → if stale, asks for a fresh copy in the background and swaps it in
//   Refresh/cron → fresh; the result replaces the cache
//
// Two kinds of fresh fetch:
//   full   → every ticket in every project (the morning cron, or when the saved base is
//            missing or too old). Saves every active ticket as the "open base".
//   recent → only tickets changed in the last few days, merged over the open base.
// Only one refresh runs at a time; anyone else waits for it and gets its result.
import { kv } from '@vercel/kv';
import { fetchAllProjects, fetchProjectTasks, computeHealth, getTeamMembers } from './userback';
import { reconcileFromProjects } from './scoreboard';

const CACHE_KEY = 'cache:dashboard';
const BASE_KEY = 'cache:openBase';
const LOCK_KEY = 'lock:dashboardRefresh';
export const FRESH_FOR_MS = 3 * 60 * 1000;
const BASE_MAX_AGE_MS = 6 * 24 * 60 * 60 * 1000; // must stay inside the recent window (8 days)
const MAX_CACHE_BYTES = 900 * 1024; // stay under Upstash's request size limit
const CONCURRENCY = 4;
const delay = ms => new Promise(r => setTimeout(r, ms));
const parse = v => (typeof v === 'string' ? JSON.parse(v) : v);

async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const idx = i++; await fn(items[idx], idx); }
  }));
}

async function getBase() {
  try {
    const b = parse(await kv.get(BASE_KEY));
    if (!b?.at || Date.now() - new Date(b.at).getTime() > BASE_MAX_AGE_MS) return null;
    return b;
  } catch { return null; }
}

// Long descriptions are trimmed in the saved base so it fits in one KV value
const slim = item => (item.description && item.description.length > 1000 ? { ...item, description: `${item.description.slice(0, 1000)}…` } : item);

export async function buildDashboardData({ full = false } = {}) {
  const [projects, budgets, savedBase] = await Promise.all([
    fetchAllProjects(),
    (async () => { try { return (await kv.get('budgets')) || {}; } catch { return {}; } })(),
    full ? Promise.resolve(null) : getBase(),
  ]);
  // fetchAllProjects returns [] when Userback fails; never cache or show that as "no tickets"
  if (!projects.length) throw new Error('Userback returned no projects (the API may be down or access may have changed)');

  const mode = full || !savedBase ? 'full' : 'recent';
  const results = new Array(projects.length);
  const newBase = { at: new Date().toISOString(), projects: {} };
  await pool(projects, CONCURRENCY, async (project, idx) => {
    const base = mode === 'recent' ? savedBase.projects?.[project.id] : null;
    // A project added since the base was saved has no base: scan it in full
    const projectMode = mode === 'recent' && !base ? 'full' : mode;
    const { data, active } = await fetchProjectTasks(project.id, { mode: projectMode, base: base || [] });
    if (active) newBase.projects[project.id] = active.map(slim);
    results[idx] = {
      name: project.name,
      userbackId: project.id,
      health: computeHealth(data),
      totalActive: data?.total || 0,
      data,
      budget: (budgets || {})[project.id] || null,
    };
  });
  results.sort((a, b) => a.name.localeCompare(b.name));

  if (results.every(r => r.data?.error)) {
    throw new Error(`Userback errors on every project: ${results[0].data.error}`);
  }

  if (mode === 'full' && results.every(r => !r.data?.error)) {
    try {
      const json = JSON.stringify(newBase);
      if (json.length <= MAX_CACHE_BYTES) await kv.set(BASE_KEY, json);
      else console.warn(`Open base skipped: ${Math.round(json.length / 1024)} KB is over the limit`);
    } catch (err) { console.error('Open base write failed:', err.message); }
  }
  return { projects: results, teamMembers: getTeamMembers(), fetchedAt: new Date().toISOString(), scan: mode };
}

export async function getCachedDashboardData() {
  try {
    const v = await kv.get(CACHE_KEY);
    if (!v) return null;
    return parse(v);
  } catch { return null; }
}

// Fresh fetch → score check → cache. Used by Refresh, background refresh and the daily cron.
// If another refresh is already running, wait for it (up to ~40s) and return its result.
export async function refreshDashboardData({ full = false } = {}) {
  const lockId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let locked = false;
  try { locked = Boolean(await kv.set(LOCK_KEY, lockId, { nx: true, ex: 90 })); } catch { locked = true; /* KV down: just run */ }

  if (!locked) {
    const before = await getCachedDashboardData();
    const since = before?.fetchedAt || null;
    for (let i = 0; i < 40; i++) {
      await delay(1000);
      const holder = await kv.get(LOCK_KEY).catch(() => null);
      const now = await getCachedDashboardData();
      if (now && now.fetchedAt !== since) return now;
      if (!holder) break; // the other refresh finished (or failed) without a new cache: run our own
    }
    const now = await getCachedDashboardData();
    if (now && now.fetchedAt !== since) return now;
    try { locked = Boolean(await kv.set(LOCK_KEY, lockId, { nx: true, ex: 90 })); } catch { locked = true; }
    if (!locked && now) return now;
  }

  try {
    const payload = await buildDashboardData({ full });
    try { await reconcileFromProjects(payload.projects, { prune: payload.scan === 'full' }); }
    catch (err) { console.error('Score reconcile failed:', err.message); }
    try {
      const json = JSON.stringify(payload);
      if (json.length <= MAX_CACHE_BYTES) await kv.set(CACHE_KEY, json);
      else console.warn(`Dashboard cache skipped: ${Math.round(json.length / 1024)} KB is over the limit`);
    } catch (err) { console.error('Dashboard cache write failed:', err.message); }
    return payload;
  } finally {
    try { if ((await kv.get(LOCK_KEY)) === lockId) await kv.del(LOCK_KEY); } catch { /* expires on its own */ }
  }
}

export async function clearDashboardCache() {
  try { await kv.del(CACHE_KEY); } catch { /* next fresh fetch rebuilds it */ }
}
