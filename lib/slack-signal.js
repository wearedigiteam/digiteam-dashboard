// Slack tab: reads channel history and threads with the Slack bot token, and has Claude
// label each human message "w" (work) or "n" (noise). Bot posts (Userback etc.) are always
// work and are grouped in the UI. Labels and team corrections live in KV so a channel sorts
// once and is instant for everyone after that.
//
// Bot scopes needed: channels:history, groups:history, channels:read, groups:read
// (plus users:read / users:read.email, which the Monday DM already uses).
//
// Private channels are only shown to people who are members of them in Slack.

import { kv } from '@vercel/kv';
import { slackCall, lookupSlackUserByEmail } from './slack';
import { getCachedDashboardData } from './dashboard-data';
import { SLACK_SETTINGS_KEY } from './weekly-slack';

export const RANGES = { '1': 1, '3': 3, '7': 7, '14': 14 };
export const STRICTNESS = ['lenient', 'balanced', 'strict'];
const MODEL = 'claude-haiku-4-5-20251001';
const CHUNK = 70;           // messages per Claude call
const MAX_PAGES = 5;        // 5 × 200 history messages
const MAX_THREADS = 40;     // threads opened per load
const BANNED = 'meticulous, meticulously, intricate, intricately, commendable, delve, delving, ingenious, invaluable, pivotal, potent, compellingly, methodically, excellently, aptly, innovatively';

const K = {
  channels:  'signal:channels',              // cached list of channels the bot is in
  users:     'signal:users',                 // cached Slack user directory
  members:   cid => `signal:members:${cid}`, // private channel members
  uid:       email => `signal:uid:${email.toLowerCase()}`,
  labels:    cid => `signal:labels:${cid}`,  // hash  "<ts>|<strictness>" → w | n
  overrides: cid => `signal:fix:${cid}`,     // hash  ts → { l, by, at }
  hist:      (cid, range) => `signal:hist:${cid}:${range}`,
  digest:    (cid, range, strict) => `signal:digest:${cid}:${range}:${strict}`,
  last:      'signal:last',                  // hash  cid → last message time (ms)
};
const LABEL_TTL = 60 * 60 * 24 * 45; // keep labels 45 days after the last write

const parse = v => (typeof v === 'string' ? JSON.parse(v) : v);
const pool = async (items, n, fn) => {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const it = items[i++]; await fn(it); }
  }));
};

// ── Friendly errors ─────────────────────────────────────────────────────────
export function explainSlackError(err) {
  const code = err?.slackError;
  if (code === 'missing_scope') return `The Slack app is missing a permission${err.needed ? ` (${err.needed})` : ''}. Add it under OAuth & Permissions → Bot Token Scopes, reinstall the app, and update SLACK_BOT_TOKEN in Vercel if it changed.`;
  if (code === 'not_in_channel') return 'The Slack app isn’t in this channel. Type /invite @your-app in the channel to add it.';
  if (code === 'channel_not_found') return 'Slack can’t find this channel, or the app isn’t in it.';
  if (code === 'invalid_auth' || code === 'not_authed' || code === 'token_revoked') return 'SLACK_BOT_TOKEN isn’t valid. Copy the Bot User OAuth Token from the Slack app into Vercel.';
  if (code === 'ratelimited') return 'Slack is rate limiting us. Try again in a minute.';
  return err?.message || 'Something went wrong talking to Slack.';
}

// ── Directory ───────────────────────────────────────────────────────────────
export async function getChannels({ fresh = false } = {}) {
  if (!fresh) {
    const cached = await kv.get(K.channels).catch(() => null);
    if (cached) return parse(cached);
  }
  const out = [];
  let cursor;
  for (let page = 0; page < 10; page++) {
    const d = await slackCall('users.conversations', {
      types: 'public_channel,private_channel', exclude_archived: 'true', limit: '200', ...(cursor ? { cursor } : {}),
    }, { get: true });
    for (const c of d.channels || []) out.push({ id: c.id, name: c.name, private: Boolean(c.is_private) });
    cursor = d.response_metadata?.next_cursor;
    if (!cursor) break;
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  await kv.set(K.channels, JSON.stringify(out), { ex: 600 }).catch(() => {});
  return out;
}

export async function getPeople() {
  const cached = await kv.get(K.users).catch(() => null);
  if (cached) return parse(cached);
  const people = {};
  let cursor;
  try {
    for (let page = 0; page < 10; page++) {
      const d = await slackCall('users.list', { limit: '200', ...(cursor ? { cursor } : {}) }, { get: true });
      for (const u of d.members || []) {
        if (u.deleted) continue;
        const p = u.profile || {};
        people[u.id] = {
          name: p.display_name || p.real_name || u.real_name || u.name,
          full: p.real_name || u.real_name || u.name,
          image: p.image_48 || null,
          bot: Boolean(u.is_bot),
        };
      }
      cursor = d.response_metadata?.next_cursor;
      if (!cursor) break;
    }
  } catch (err) {
    // Names are nice to have; messages still work with IDs
    console.error('Slack users.list failed:', err.message);
    return {};
  }
  await kv.set(K.users, JSON.stringify(people), { ex: 60 * 60 * 12 }).catch(() => {});
  return people;
}

// The signed-in person's Slack member ID: from Admin → Slack summary, else by email
export async function slackIdForEmail(email) {
  if (!email) return null;
  const cached = await kv.get(K.uid(email)).catch(() => null);
  if (cached) return String(cached);
  let id = null;
  try {
    const [settingsRaw, data] = await Promise.all([kv.get(SLACK_SETTINGS_KEY).catch(() => null), getCachedDashboardData().catch(() => null)]);
    const settings = parse(settingsRaw) || {};
    const me = (data?.teamMembers || []).find(m => (m.email || '').toLowerCase() === email.toLowerCase());
    if (me && settings[me.userId]?.slackId) id = String(settings[me.userId].slackId).trim();
  } catch { /* fall through to lookup */ }
  if (!id) id = await lookupSlackUserByEmail(email).catch(() => null);
  if (id) await kv.set(K.uid(email), id, { ex: 60 * 60 * 24 }).catch(() => {});
  return id;
}

async function privateMembers(cid) {
  const cached = await kv.get(K.members(cid)).catch(() => null);
  if (cached) return new Set(parse(cached));
  const ids = [];
  let cursor;
  for (let page = 0; page < 5; page++) {
    const d = await slackCall('conversations.members', { channel: cid, limit: '200', ...(cursor ? { cursor } : {}) }, { get: true });
    ids.push(...(d.members || []));
    cursor = d.response_metadata?.next_cursor;
    if (!cursor) break;
  }
  await kv.set(K.members(cid), JSON.stringify(ids), { ex: 600 }).catch(() => {});
  return new Set(ids);
}

// Channels this person may see: every public channel the app is in, private ones only if they're a member
export async function channelsFor(email, opts) {
  const all = await getChannels(opts);
  const priv = all.filter(c => c.private);
  let visiblePrivate = new Set();
  if (priv.length) {
    const me = await slackIdForEmail(email);
    if (me) {
      await pool(priv, 4, async c => {
        try { if ((await privateMembers(c.id)).has(me)) visiblePrivate.add(c.id); } catch { /* hide on error */ }
      });
    }
  }
  const last = (await kv.hgetall(K.last).catch(() => null)) || {};
  return all
    .filter(c => !c.private || visiblePrivate.has(c.id))
    .map(c => ({ ...c, last: Number(last[c.id]) || null }));
}

export async function canSee(email, cid) {
  const list = await channelsFor(email);
  return list.find(c => c.id === cid) || null;
}

// ── Messages ────────────────────────────────────────────────────────────────
const SKIP_SUBTYPES = new Set(['channel_join', 'channel_leave', 'channel_topic', 'channel_purpose', 'channel_name',
  'channel_archive', 'channel_unarchive', 'group_join', 'group_leave', 'group_topic', 'group_purpose', 'group_name',
  'bot_add', 'bot_remove', 'pinned_item', 'unpinned_item', 'reminder_add', 'tombstone']);

function textFromBlocks(blocks) {
  const out = [];
  const walk = b => {
    if (!b || typeof b !== 'object') return;
    if (Array.isArray(b)) return b.forEach(walk);
    if (b.type === 'section' && b.text?.text) out.push(b.text.text);
    if (b.type === 'section' && Array.isArray(b.fields)) b.fields.forEach(f => f?.text && out.push(f.text));
    if (b.type === 'header' && b.text?.text) out.push(`*${b.text.text}*`);
    if (b.type === 'context' && Array.isArray(b.elements)) b.elements.forEach(e => e?.text && out.push(e.text));
  };
  walk(blocks);
  return out.join('\n');
}

export function normalise(m, people) {
  if (!m || SKIP_SUBTYPES.has(m.subtype)) return null;
  const isBot = Boolean(m.bot_id) || m.subtype === 'bot_message';
  let text = m.text || '';
  if (isBot || !text.trim()) {
    const extra = [textFromBlocks(m.blocks), ...(m.attachments || []).map(a => [a.pretext, a.title, a.text || a.fallback].filter(Boolean).join('\n'))]
      .filter(Boolean).join('\n');
    if (extra && extra.length > text.length) text = extra;
  }
  const person = people[m.user] || null;
  const botName = m.bot_profile?.name || m.username || (person?.bot ? person.name : null) || 'Bot';
  const files = (m.files || []).map(f => f.name || f.title).filter(Boolean);
  if (!text.trim() && !files.length) return null;
  return {
    ts: m.ts,
    uid: m.user || null,
    name: isBot ? botName : (person?.name || m.user_profile?.display_name || m.user_profile?.real_name || m.user || 'Someone'),
    isBot,
    userback: isBot && /userback/i.test(botName),
    text: text.slice(0, 4000),
    files,
    replies: Number(m.reply_count || 0),
    thread: [],
  };
}

export async function readChannel(cid, rangeDays, { people, fresh = false } = {}) {
  const key = K.hist(cid, rangeDays);
  if (!fresh) {
    const cached = await kv.get(key).catch(() => null);
    if (cached) return parse(cached);
  }
  people = people || await getPeople();
  const oldest = String(Math.floor(Date.now() / 1000) - rangeDays * 86400);
  const raw = [];
  let cursor;
  for (let page = 0; page < MAX_PAGES; page++) {
    const d = await slackCall('conversations.history', { channel: cid, oldest, limit: '200', ...(cursor ? { cursor } : {}) }, { get: true });
    raw.push(...(d.messages || []));
    cursor = d.has_more ? d.response_metadata?.next_cursor : null;
    if (!cursor) break;
  }
  const msgs = raw.map(m => normalise(m, people)).filter(Boolean).sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts));
  const withThreads = msgs.filter(m => m.replies > 0).slice(-MAX_THREADS);
  await pool(withThreads, 4, async m => {
    try {
      const d = await slackCall('conversations.replies', { channel: cid, ts: m.ts, limit: '200' }, { get: true });
      m.thread = (d.messages || []).filter(r => r.ts !== m.ts).map(r => normalise(r, people)).filter(Boolean);
    } catch { m.threadError = true; }
  });
  if (msgs.length) await kv.hset(K.last, { [cid]: Math.round(parseFloat(msgs[msgs.length - 1].ts) * 1000) }).catch(() => {});
  const json = JSON.stringify(msgs);
  if (json.length < 900_000) await kv.set(key, json, { ex: 120 }).catch(() => {});
  return msgs;
}

// Flatten parents and thread replies in reading order
export function flatten(msgs) {
  const out = [];
  for (const m of msgs) {
    out.push({ m, parent: null });
    for (const r of m.thread || []) out.push({ m: r, parent: m });
  }
  return out;
}

// ── Labels ──────────────────────────────────────────────────────────────────
export async function getLabels(cid, strict) {
  const [all, fixes] = await Promise.all([
    kv.hgetall(K.labels(cid)).catch(() => null),
    kv.hgetall(K.overrides(cid)).catch(() => null),
  ]);
  const labels = {};
  const suffix = `|${strict}`;
  for (const [k, v] of Object.entries(all || {})) if (k.endsWith(suffix)) labels[k.slice(0, -suffix.length)] = v;
  const overrides = {};
  for (const [ts, v] of Object.entries(fixes || {})) overrides[ts] = parse(v);
  return { labels, overrides };
}

export async function setOverride(cid, ts, label, by) {
  if (label === null) { await kv.hdel(K.overrides(cid), ts); return; }
  await kv.hset(K.overrides(cid), { [ts]: JSON.stringify({ l: label, by, at: new Date().toISOString() }) });
  await kv.expire(K.overrides(cid), LABEL_TTL).catch(() => {});
}

const RULES = {
  lenient: 'Only mark messages N when they are clearly jokes, banter or off-topic. Short acknowledgements in a work conversation are W. When unsure, mark W.',
  balanced: 'Short acknowledgements ("yes", "agreed", "sure, I\'ll do that", "got it", "done") count as W only when they directly answer a work message just before them (or the thread they reply in is about work). When genuinely unsure, mark W.',
  strict: 'Keep only messages that carry real work information on their own: facts, decisions, requests, questions, status, links or code. Bare acknowledgements and reactions are N even after a work message.',
};

export function buildClassifyPrompt(items, context, strict) {
  const lines = [];
  context.forEach(c => lines.push(`[CONTEXT ${c.label.toUpperCase()}] ${c.name}: ${c.text}`));
  items.forEach(it => lines.push(`[${it.id}]${it.parentId ? ` (thread reply to ${it.parentId})` : ''} ${it.name}: ${it.text.slice(0, 500).replace(/\n+/g, ' ⏎ ')}${it.files.length ? ` [attached: ${it.files.join(', ')}]` : ''}`));
  return `You are filtering a Slack channel for Digiteam, a small web development agency. Much of the chatter between the partners is jokes and banter; your job is to find the work.

Label each message W (work) or N (noise).
W = client or project information, technical details, code, bugs, decisions, requests, task assignments or status, deadlines, scheduling work, billing, questions about the work, and files or links shared for work.
N = jokes, puns, banter, role-play, memes, reactions ("lol", "oof", "ROFL"), personal chat, wordplay and anything off-topic, even when it riffs on a work term.
${RULES[strict] || RULES.balanced}
Lines marked CONTEXT are already labelled; use them only to understand the conversation.

Messages:
${lines.join('\n')}

Return JSON only: {"w": ["ids of the W messages"]}. Use only the bracketed ids above; omit N messages.`;
}

async function claudeJSON(prompt, maxTokens = 1500) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY isn’t set in Vercel');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!r.ok) throw new Error(`Claude returned ${r.status}`);
  const d = await r.json();
  const text = (d.content || []).map(c => c.text || '').join('');
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('Claude didn’t return JSON');
  return JSON.parse(text.slice(start, end + 1));
}

// Label up to `limit` unlabelled human messages. Returns { labels: { ts: w|n }, remaining }.
export async function sortPending(cid, msgs, strict, { limit = CHUNK * 2, deadline = Infinity } = {}) {
  const { labels, overrides } = await getLabels(cid, strict);
  const flat = flatten(msgs);
  const idOf = new Map(flat.map((f, i) => [f.m, `m${i + 1}`]));
  const known = ts => overrides[ts]?.l || labels[ts];
  const pending = flat.filter(f => !f.m.isBot && !known(f.m.ts));
  const batch = pending.slice(0, limit);
  const chunks = [];
  for (let i = 0; i < batch.length; i += CHUNK) chunks.push(batch.slice(i, i + CHUNK));
  const fresh = {};
  await pool(chunks, 2, async chunk => {
    if (Date.now() > deadline) return;
    const firstIdx = flat.indexOf(chunk[0]);
    const context = flat.slice(Math.max(0, firstIdx - 8), firstIdx).map(f => ({
      name: f.m.name,
      text: f.m.text.slice(0, 200).replace(/\n+/g, ' '),
      label: f.m.isBot ? 'bot update' : ((fresh[f.m.ts] || known(f.m.ts)) === 'n' ? 'noise' : 'work'),
    }));
    const items = chunk.map(f => ({ id: idOf.get(f.m), name: f.m.name, text: f.m.text, files: f.m.files, parentId: f.parent ? idOf.get(f.parent) : null }));
    const res = await claudeJSON(buildClassifyPrompt(items, context, strict));
    const w = new Set(Array.isArray(res?.w) ? res.w.map(String) : []);
    const update = {};
    for (const f of chunk) {
      const l = w.has(idOf.get(f.m)) ? 'w' : 'n';
      fresh[f.m.ts] = l;
      update[`${f.m.ts}|${strict}`] = l;
    }
    await kv.hset(K.labels(cid), update);
  });
  if (Object.keys(fresh).length) await kv.expire(K.labels(cid), LABEL_TTL).catch(() => {});
  return { labels: fresh, remaining: Math.max(0, pending.length - Object.keys(fresh).length) };
}

// ── Digest ──────────────────────────────────────────────────────────────────
const fmtWhen = ts => new Date(parseFloat(ts) * 1000).toLocaleString('en-CA', { timeZone: 'America/Toronto', weekday: 'short', hour: 'numeric', minute: '2-digit' });

export async function buildDigest(cid, channelName, rangeDays, strict, msgs, { fresh = false } = {}) {
  const { labels, overrides } = await getLabels(cid, strict);
  const label = m => overrides[m.ts]?.l || labels[m.ts];
  const work = [], bots = [];
  for (const { m } of flatten(msgs)) {
    if (m.isBot) bots.push(m);
    else if (label(m) === 'w') work.push(m);
  }
  const sig = `${work.length}:${bots.length}:${work.at(-1)?.ts || ''}:${bots.at(-1)?.ts || ''}`;
  const key = K.digest(cid, rangeDays, strict);
  if (!fresh) {
    const cached = parse(await kv.get(key).catch(() => null));
    if (cached && cached.sig === sig) return cached.bullets;
  }
  if (!work.length && !bots.length) return [];
  const clean = t => t.replace(/<(https?:[^|>]+)\|([^>]+)>/g, '$2').replace(/<@(\w+)>/g, '@someone').replace(/\s+/g, ' ');
  const prompt = `Summarize the WORK that happened in the Slack channel #${channelName} over the last ${rangeDays === 1 ? '24 hours' : `${rangeDays} days`}, for a busy agency partner. Jokes have already been removed.

Team messages (oldest first):
${work.slice(-200).map(m => `${fmtWhen(m.ts)} ${m.name}: ${clean(m.text).slice(0, 400)}`).join('\n') || '(none)'}

Bot updates (Userback tickets and alerts):
${bots.slice(-60).map(m => `${m.name}: ${clean(m.text).slice(0, 220)}`).join('\n') || '(none)'}

Write 2 to 6 short bullets covering decisions, open questions, who owes what, and ticket movement. Plain, direct language. Canadian spelling. No preamble, no filler. Never use these words: ${BANNED}. Return JSON only: {"bullets": ["..."]}.`;
  const res = await claudeJSON(prompt, 800);
  const bullets = Array.isArray(res?.bullets) ? res.bullets.map(String).slice(0, 6) : [];
  await kv.set(key, JSON.stringify({ sig, bullets }), { ex: 60 * 60 * 6 }).catch(() => {});
  return bullets;
}

// ── Daily pre-sort (runs in the morning cron) ───────────────────────────────
export async function presortAll({ deadline }) {
  const result = { channels: 0, sorted: 0, skipped: null };
  if (!process.env.SLACK_BOT_TOKEN || !process.env.ANTHROPIC_API_KEY) { result.skipped = 'Slack or Claude not configured'; return result; }
  let channels;
  try { channels = await getChannels({ fresh: true }); }
  catch (err) { result.skipped = explainSlackError(err); return result; }
  const people = await getPeople();
  for (const c of channels) {
    if (Date.now() > deadline - 8000) break;
    try {
      const msgs = await readChannel(c.id, 1, { people, fresh: true });
      const r = await sortPending(c.id, msgs, 'balanced', { limit: 140, deadline: deadline - 5000 });
      result.channels++;
      result.sorted += Object.keys(r.labels).length;
    } catch (err) {
      console.error(`Slack pre-sort failed for #${c.name}:`, err.message);
    }
  }
  return result;
}
