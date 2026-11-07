// Builds the dashboard's data and keeps a cached copy in KV so the page opens instantly.
//   Page load    → cached copy straight away (if there is one), marked stale after a minute
//   Browser      → if stale, asks for a fresh copy in the background and swaps it in
//   Refresh/cron → always fresh; the result replaces the cache
import { kv } from '@vercel/kv';
import { fetchAllProjects, fetchProjectTasks, computeHealth, getTeamMembers } from './userback';
import { reconcileFromProjects } from './scoreboard';

const CACHE_KEY = 'cache:dashboard';
export const FRESH_FOR_MS = 60 * 1000;
const MAX_CACHE_BYTES = 900 * 1024; // stay under Upstash's request size limit
const delay = ms => new Promise(r => setTimeout(r, ms));

export async function buildDashboardData() {
  const [projects, budgets] = await Promise.all([
    fetchAllProjects(),
    (async () => { try { return (await kv.get('budgets')) || {}; } catch { return {}; } })(),
  ]);
  // fetchAllProjects returns [] when Userback fails; never cache or show that as "no tickets"
  if (!projects.length) throw new Error('Userback returned no projects (the API may be down or access may have changed)');

  const results = [];
  for (const project of projects) {
    const data = await fetchProjectTasks(project.id);
    results.push({
      name: project.name,
      userbackId: project.id,
      health: computeHealth(data),
      totalActive: data?.total || 0,
      data,
      budget: (budgets || {})[project.id] || null,
    });
    await delay(200);
  }
  results.sort((a, b) => a.name.localeCompare(b.name));

  if (results.every(r => r.data?.error)) {
    throw new Error(`Userback errors on every project: ${results[0].data.error}`);
  }
  return { projects: results, teamMembers: getTeamMembers(), fetchedAt: new Date().toISOString() };
}

// Fresh fetch → score check → cache. Used by Refresh, background refresh and the daily cron.
export async function refreshDashboardData() {
  const payload = await buildDashboardData();
  try { await reconcileFromProjects(payload.projects); }
  catch (err) { console.error('Score reconcile failed:', err.message); }
  try {
    const json = JSON.stringify(payload);
    if (json.length <= MAX_CACHE_BYTES) await kv.set(CACHE_KEY, json);
    else console.warn(`Dashboard cache skipped: ${Math.round(json.length / 1024)} KB is over the limit`);
  } catch (err) { console.error('Dashboard cache write failed:', err.message); }
  return payload;
}

export async function getCachedDashboardData() {
  try {
    const v = await kv.get(CACHE_KEY);
    if (!v) return null;
    return typeof v === 'string' ? JSON.parse(v) : v;
  } catch { return null; }
}

export async function clearDashboardCache() {
  try { await kv.del(CACHE_KEY); } catch { /* next fresh fetch rebuilds it */ }
}
