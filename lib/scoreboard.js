// Team scoreboard: points for moving tickets into review.
//
// How changes are detected:
//   1. Userback webhook ("Feedback status is changed")  → instant
//   2. Every dashboard load and the daily cron compare tickets to a stored snapshot → safety net
// Both paths go through processTicket(), and each ticket can only score once
// (hsetnx on score:awards), so nothing is ever counted twice.
//
// Scoring:
//   Into For Review / Under Review / Please Review from an active status → points
//   Straight from an active status to Resolved (fast work)               → points
//   Priority: High/Critical 3, Normal 2, Low/none 1
//   Aging bonus: +2 if the ticket hadn't been touched for 30+ days
//   Bounced back from review to an active status → the points come off

import { kv } from '@vercel/kv';

const TIMEZONE      = 'America/Toronto';
const AGING_DAYS    = 30;
const AGING_BONUS   = 2;
const DEFAULT_GOAL  = parseInt(process.env.SCORE_DEFAULT_GOAL || '25', 10);
const MAX_EVENTS    = 200;

const K = {
  snap:       'score:snap',        // hash  ticketId → { s: state, u: updatedAt }
  snapReady:  'score:snapReady',   // flag  baseline taken
  awards:     'score:awards',      // hash  ticketId → award
  weeks:      'score:weeks',       // hash  week → points
  weekTix:    'score:weekTickets', // hash  week → tickets
  weekAging:  'score:weekAging',   // hash  week → aging tickets cleared
  weekGoals:  'score:weekGoals',   // hash  week → goal that applied that week
  weekFossil: 'score:weekFossils', // hash  week → tickets over a year old cleared (easter egg)
  milestones: 'score:milestones',  // hash  N → when the team's Nth ticket reached review
  events:     'score:events',      // list  newest first
};
const yearProjectsKey = year => `score:yearProjects:${year}`; // hash project → tickets that year
const MILESTONES = [100, 250, 500, 1000, 2500, 5000, 10000];

import { REVIEW_STATUSES } from './statuses';
export { REVIEW_STATUSES };

const parse = v => (typeof v === 'string' ? JSON.parse(v) : v);

// ── Helpers ─────────────────────────────────────────────────────────────────
export function ticketState(item) {
  const wf = (item.workflowName || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (REVIEW_STATUSES.includes(wf)) return 'review';
  if (item.category === 'resolved') return 'resolved';
  return 'active';
}

function torontoDate(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  }).formatToParts(d).map(x => [x.type, x.value]));
  return p;
}

// Week key = the Monday (Toronto time) that starts the week, e.g. "2026-10-26"
export function weekKey(d = new Date()) {
  const p = torontoDate(d);
  const order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const offset = order.indexOf(p.weekday);
  const local = new Date(Date.UTC(+p.year, +p.month - 1, +p.day));
  local.setUTCDate(local.getUTCDate() - offset);
  return local.toISOString().slice(0, 10);
}

function shiftWeek(key, weeks) {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  if (!a) return null;
  const t = new Date(a);
  if (isNaN(t)) return null;
  return Math.floor((b - t) / 86400000);
}

function pointsFor(item, prevUpdatedAt) {
  const base = item.priorityLevel >= 3 ? 3 : item.priorityLevel === 2 ? 2 : 1;
  const idle = daysBetween(prevUpdatedAt || item.createdAt, Date.now());
  const aging = idle !== null && idle >= AGING_DAYS;
  return { points: base + (aging ? AGING_BONUS : 0), aging };
}

async function logEvent(event) {
  await kv.lpush(K.events, JSON.stringify(event));
  await kv.ltrim(K.events, 0, MAX_EVENTS - 1);
}

// ── Core: decide what a status change is worth ──────────────────────────────
// prev: snapshot entry { s, u } or null. Returns 'award' | 'clawback' | null.
async function processTicket(item, projectName, prev) {
  const curr = ticketState(item);
  const id = String(item.id);

  // Ignore data older than what we already know (stops a stale fetch undoing a webhook)
  if (prev?.u && item.updatedAt && new Date(item.updatedAt) < new Date(prev.u)) return null;

  const enteredReview = curr === 'review' && prev?.s !== 'review' && prev?.s !== 'resolved';
  const fastResolve   = curr === 'resolved' && prev?.s === 'active';
  const bouncedBack   = prev?.s === 'review' && curr === 'active';

  if (enteredReview || fastResolve) {
    const { points, aging } = pointsFor(item, prev?.u);
    const week = weekKey();
    const ageDays = daysBetween(item.createdAt, Date.now());
    const fossil = ageDays !== null && ageDays >= 365;
    const award = {
      id, points, aging, fossil, week, at: new Date().toISOString(),
      title: String(item.title || '').slice(0, 140), url: item.url || null, project: projectName || null,
      assigneeId: item.assigneeId || null,
    };
    const claimed = await kv.hsetnx(K.awards, id, JSON.stringify(award));
    if (!claimed) return null; // already scored
    await kv.hincrby(K.weeks, week, points);
    await kv.hincrby(K.weekTix, week, 1);
    if (aging) await kv.hincrby(K.weekAging, week, 1);
    if (fossil) await kv.hincrby(K.weekFossil, week, 1);
    if (projectName) await kv.hincrby(yearProjectsKey(torontoDate().year), projectName, 1);
    await logEvent({ type: 'award', ...award });
    return 'award';
  }

  if (bouncedBack) {
    const existing = await kv.hget(K.awards, id);
    if (!existing) return null;
    const removed = await kv.hdel(K.awards, id);
    if (!removed) return null; // another request already took it back
    const award = parse(existing);
    const week = weekKey();
    await kv.hincrby(K.weeks, week, -award.points);
    await kv.hincrby(K.weekTix, week, -1);
    if (award.aging) await kv.hincrby(K.weekAging, week, -1);
    if (award.fossil) await kv.hincrby(K.weekFossil, week, -1);
    if (award.project) await kv.hincrby(yearProjectsKey(torontoDate().year), award.project, -1);
    await logEvent({ type: 'clawback', id, points: -award.points, week, at: new Date().toISOString(),
      title: award.title, url: award.url, project: award.project });
    return 'clawback';
  }
  return null;
}

const snapEntry = item => JSON.stringify({ s: ticketState(item), u: item.updatedAt || null });

// ── Webhook path: one ticket ────────────────────────────────────────────────
export async function scoreSingleTicket(item, projectName) {
  const ready = await kv.get(K.snapReady);
  const prevRaw = await kv.hget(K.snap, String(item.id));
  const prev = prevRaw ? parse(prevRaw) : null;
  let result = null;
  if (ready) result = await processTicket(item, projectName, prev);
  if (!prev?.u || !item.updatedAt || new Date(item.updatedAt) >= new Date(prev.u)) {
    await kv.hset(K.snap, { [String(item.id)]: snapEntry(item) });
  }
  return result;
}

// ── Snapshot path: every ticket from a full fetch ───────────────────────────
// projects: [{ name, data: { open, inProgress, onHold, resolvedThisWeek } }]
export async function reconcileFromProjects(projects) {
  const items = [];
  for (const p of projects) {
    const d = p.data;
    if (!d || d.error) continue;
    for (const list of [d.open, d.inProgress, d.onHold, d.resolvedThisWeek]) {
      for (const item of list || []) items.push({ item, project: p.name });
    }
  }
  if (items.length === 0) return { checked: 0 };

  const ready = await kv.get(K.snapReady);
  const snap = (await kv.hgetall(K.snap)) || {};
  const updates = {};
  let awards = 0, clawbacks = 0;

  for (const { item, project } of items) {
    const id = String(item.id);
    const prev = snap[id] ? parse(snap[id]) : null;
    if (ready && prev) {
      // Only tickets we've seen before can score here; brand-new ones wait for their next change
      const r = await processTicket(item, project, prev);
      if (r === 'award') awards++;
      if (r === 'clawback') clawbacks++;
    }
    if (!prev?.u || !item.updatedAt || new Date(item.updatedAt) >= new Date(prev.u)) {
      updates[id] = snapEntry(item);
    }
  }

  if (Object.keys(updates).length) await kv.hset(K.snap, updates);
  if (!ready) await kv.set(K.snapReady, new Date().toISOString());
  return { checked: items.length, awards, clawbacks, baseline: !ready };
}

// ── Read side: what the dashboard and Slack show ────────────────────────────
async function goalFor(week, weeks) {
  const saved = await kv.hget(K.weekGoals, week);
  if (saved) return Number(saved);
  // Rolling average of the last 4 completed weeks with activity, +10%, rounded to 5
  const past = [1, 2, 3, 4].map(n => Number(weeks[shiftWeek(week, -n)] || 0)).filter(v => v > 0);
  const goal = past.length
    ? Math.max(10, Math.round((past.reduce((a, b) => a + b, 0) / past.length) * 1.1 / 5) * 5)
    : DEFAULT_GOAL;
  await kv.hsetnx(K.weekGoals, week, String(goal));
  return goal;
}

export async function getScoreSummary() {
  const [weeksRaw, tixRaw, agingRaw, eventsRaw, ready, fossilsThisWeek] = await Promise.all([
    kv.hgetall(K.weeks), kv.hgetall(K.weekTix), kv.hgetall(K.weekAging),
    kv.lrange(K.events, 0, 11), kv.get(K.snapReady), kv.hget(K.weekFossil, weekKey()),
  ]);
  const weeks = weeksRaw || {}, tix = tixRaw || {}, aging = agingRaw || {};
  const thisWeek = weekKey();
  const lastWeek = shiftWeek(thisWeek, -1);
  const goal = await goalFor(thisWeek, weeks);
  const points = Number(weeks[thisWeek] || 0);

  // Goal streak over completed weeks
  let streak = 0;
  for (let n = 1; n <= 52; n++) {
    const w = shiftWeek(thisWeek, -n);
    const g = await kv.hget(K.weekGoals, w);
    if (!g || Number(weeks[w] || 0) < Number(g)) break;
    streak++;
  }

  const pastTotals = Object.entries(weeks).filter(([w]) => w < thisWeek).map(([, v]) => Number(v));
  const bestPast = pastTotals.length ? Math.max(...pastTotals) : 0;

  const highlights = [];
  if (points >= goal) highlights.push('Weekly goal reached');
  if (streak >= 2) highlights.push(`Goal hit ${streak} weeks running`);
  if (pastTotals.length >= 2 && points > bestPast) highlights.push('Best week since tracking started');
  if (Number(aging[thisWeek] || 0) > 0) {
    const n = Number(aging[thisWeek]);
    highlights.push(`${n} long-waiting ticket${n === 1 ? '' : 's'} cleared`);
  }

  const fossils = Number(fossilsThisWeek || 0);
  if (fossils > 0) highlights.push(`🦴 ${fossils} fossil${fossils === 1 ? '' : 's'} excavated (tickets over a year old)`);

  const history = Array.from({ length: 8 }, (_, i) => {
    const w = shiftWeek(thisWeek, i - 7);
    return { week: w, points: Number(weeks[w] || 0) };
  });

  // All-time milestones: the team's 100th, 500th, 1000th… ticket into review
  const allTime = Object.values(tix).reduce((a, v) => a + Number(v || 0), 0);
  let milestone = null;
  for (const m of MILESTONES) {
    if (allTime < m) break;
    await kv.hsetnx(K.milestones, String(m), new Date().toISOString());
    milestone = { n: m, at: await kv.hget(K.milestones, String(m)) };
  }

  return {
    tracking: Boolean(ready),
    allTime,
    milestone,
    trackingSince: ready ? String(ready) : null,
    week: thisWeek,
    goal,
    points,
    tickets: Number(tix[thisWeek] || 0),
    agingCleared: Number(aging[thisWeek] || 0),
    streak,
    highlights,
    history,
    lastWeek: {
      week: lastWeek,
      points: Number(weeks[lastWeek] || 0),
      tickets: Number(tix[lastWeek] || 0),
      agingCleared: Number(aging[lastWeek] || 0),
      goal: Number((await kv.hget(K.weekGoals, lastWeek)) || 0) || null,
    },
    recent: (eventsRaw || []).map(parse).map(e => ({
      type: e.type, points: e.points, title: e.title, url: e.url, project: e.project, at: e.at, aging: e.aging, fossil: e.fossil,
    })),
  };
}

// ── Per-person celebrations ─────────────────────────────────────────────────
// Each team reward plays once for each signed-in person, on whichever device they
// open next, even if the team hit it while they were away. sadd returns 1 only the
// first time, so two tabs or two devices never both play it.
const REWARDS = [
  { id: 'goal', message: 'Weekly goal reached', earned: s => s.goal > 0 && s.points >= s.goal },
  { id: 'best', message: 'Best week since tracking started', earned: s => s.highlights.includes('Best week since tracking started') },
];
const SEEN_TTL = 60 * 60 * 24 * 21; // keep "seen" flags for three weeks

export async function claimCelebrations(email, summary) {
  if (!email) return [];
  const earned = [];
  for (const r of REWARDS) {
    if (!r.earned(summary)) continue;
    const key = `score:seen:${r.id}:${summary.week}`;
    const added = await kv.sadd(key, email.toLowerCase());
    await kv.expire(key, SEEN_TTL);
    if (added === 1) earned.push(r.message);
  }
  // A milestone plays once for each person, for two weeks after the team reaches it
  const m = summary.milestone;
  if (m?.at && Date.now() - new Date(m.at).getTime() < 14 * 86400000) {
    const key = `score:seen:milestone:${m.n}`;
    const added = await kv.sadd(key, email.toLowerCase());
    await kv.expire(key, 60 * 60 * 24 * 30);
    if (added === 1) earned.push(`Ticket #${m.n} into review. Still doing this`);
  }
  return earned;
}

// ── Year in review ("Digiteam Wrapped") — team numbers only ─────────────────
export async function getYearInReview(year) {
  const [weeksRaw, tixRaw, agingRaw, fossilRaw, goalsRaw, projectsRaw, ready] = await Promise.all([
    kv.hgetall(K.weeks), kv.hgetall(K.weekTix), kv.hgetall(K.weekAging), kv.hgetall(K.weekFossil),
    kv.hgetall(K.weekGoals), kv.hgetall(yearProjectsKey(year)), kv.get(K.snapReady),
  ]);
  const inYear = obj => Object.entries(obj || {}).filter(([w]) => w.startsWith(String(year)));
  const sum = obj => inYear(obj).reduce((a, [, v]) => a + Number(v || 0), 0);
  const weeks = inYear(weeksRaw).map(([w, v]) => [w, Number(v || 0)]).sort(([a], [b]) => a.localeCompare(b));
  const best = weeks.reduce((b, cur) => (cur[1] > (b?.[1] ?? -1) ? cur : b), null);

  let streak = 0, run = 0;
  for (const [w, pts] of weeks) {
    const g = Number((goalsRaw || {})[w] || 0);
    run = g && pts >= g ? run + 1 : 0;
    streak = Math.max(streak, run);
  }
  const busiest = Object.entries(projectsRaw || {}).map(([p, v]) => [p, Number(v || 0)]).sort((a, b) => b[1] - a[1])[0] || null;

  return {
    year,
    trackingSince: ready ? String(ready) : null,
    points: sum(weeksRaw),
    tickets: sum(tixRaw),
    agingCleared: sum(agingRaw),
    fossils: sum(fossilRaw),
    bestWeek: best && best[1] > 0 ? { week: best[0], points: best[1] } : null,
    longestStreak: streak,
    busiestClient: busiest && busiest[1] > 0 ? { name: busiest[0], tickets: busiest[1] } : null,
  };
}

// One shared line for the Monday Slack DM (team-first: no individual numbers)
export async function teamRecapLine() {
  try {
    const s = await getScoreSummary();
    if (!s.tracking) return null;
    const lw = s.lastWeek;
    // Tracking started this week, so there's no full week to report yet
    if (weekKey(new Date(s.trackingSince)) > lw.week) return null;
    if (!lw.tickets) return 'Last week the team didn’t move any tickets into review. Fresh start this week.';
    let line = `Last week the team moved *${lw.tickets} ticket${lw.tickets === 1 ? '' : 's'}* into review (${lw.points} pts)`;
    if (lw.agingCleared) line += `, including ${lw.agingCleared} that had been waiting 30+ days`;
    line += '.';
    if (lw.goal && lw.points >= lw.goal) {
      line += s.streak >= 2 ? ` Goal hit ${s.streak} weeks running. 🎉` : ' Weekly goal hit. 🎉';
    }
    return line;
  } catch {
    return null;
  }
}

export async function logWebhook(payload) {
  try {
    await kv.lpush('score:webhookLog', JSON.stringify({ at: new Date().toISOString(), payload }).slice(0, 8000));
    await kv.ltrim('score:webhookLog', 0, 19);
  } catch { /* debugging aid only */ }
}
