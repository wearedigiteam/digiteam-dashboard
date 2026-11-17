const USERBACK_BASE = 'https://rest.userback.io/1.0';
const WORKSPACE_ID  = '29871';

const delay = ms => new Promise(r => setTimeout(r, ms));

function getHeaders() {
  return {
    'Authorization': `Bearer ${process.env.USERBACK_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

// ── Status mapping ───────────────────────────────────────────────────────────
const STATUS_MAP = {
  'open':        { label: 'Open',        category: 'open' },
  'new':         { label: 'Open',        category: 'open' },
  'in-progress': { label: 'In Progress', category: 'inProgress' },
  'inprogress':  { label: 'In Progress', category: 'inProgress' },
  'in_progress': { label: 'In Progress', category: 'inProgress' },
  'in progress': { label: 'In Progress', category: 'inProgress' },
  'resolved':    { label: 'Resolved',    category: 'resolved' },
  'closed':      { label: 'Resolved',    category: 'resolved' },
  'done':        { label: 'Resolved',    category: 'resolved' },
  'complete':    { label: 'Resolved',    category: 'resolved' },
  'completed':   { label: 'Resolved',    category: 'resolved' },
  'wontfix':     { label: "Won't Fix",   category: 'resolved' },
  "won't fix":   { label: "Won't Fix",   category: 'resolved' },
  'onhold':      { label: 'On Hold',     category: 'onHold' },
  'on-hold':     { label: 'On Hold',     category: 'onHold' },
  'on_hold':     { label: 'On Hold',     category: 'onHold' },
  'on hold':     { label: 'On Hold',     category: 'onHold' },
  'blocked':     { label: 'On Hold',     category: 'onHold' },
};

const PRIORITY_MAP = {
  'critical': { label: 'Critical', level: 4, color: '#c02020' },
  'high':     { label: 'High',     level: 3, color: '#e07020' },
  'medium':   { label: 'Medium',   level: 2, color: '#f7ad39' },
  'normal':   { label: 'Normal',   level: 2, color: '#f7ad39' },
  'low':      { label: 'Low',      level: 1, color: '#7a7a8a' },
  'none':     { label: 'None',     level: 0, color: '#c0c0c0' },
};

function categoriseStatus(status) {
  const key = (status || '').toLowerCase().trim().replace(/\s+/g, ' ');
  return STATUS_MAP[key] || { label: status || 'Open', category: 'open' };
}

function extractStatus(item) {
  if (item.Workflow) {
    const wf = item.Workflow;
    if (typeof wf === 'string') return wf;
    if (wf.name) return wf.name;
    if (wf.status) return wf.status;
    if (wf.label) return wf.label;
  }
  return item.status || item.state || null;
}

function normalisePriority(raw) {
  const key = (raw || '').toLowerCase().trim();
  return PRIORITY_MAP[key] || PRIORITY_MAP['none'];
}

// ── Member name lookup (auto-populated from Userback) ────────────────────────
let _memberMap = null;    // { [id|userId]: name }
let _memberList = null;   // [{ name, userId }] for the team filter dropdown

async function ensureMemberMap() {
  if (_memberMap) return;
  _memberMap = {};
  _memberList = [];
  try {
    let page = 1;
    while (true) {
      const res = await fetch(`${USERBACK_BASE}/member?limit=50&page=${page}`, {
        headers: getHeaders(),
      });
      if (!res.ok) break;
      const data = await res.json();
      const members = data.data || [];
      for (const m of members) {
        if (m.isDisabled) continue;
        const name = m.name || m.email || null;
        if (name) {
          if (m.id) _memberMap[String(m.id)] = name;
          if (m.userId) _memberMap[String(m.userId)] = name;
          _memberList.push({ name, userId: String(m.userId || m.id), email: m.email || null });
        }
      }
      const pagination = data._pagination || data.pagination || {};
      if (page >= (pagination.totalPages || 1)) break;
      page++;
      await delay(150);
    }
  } catch (err) {
    console.error('Userback member fetch error:', err.message);
  }
}

function resolveMemberName(assigneeId) {
  if (!assigneeId || !_memberMap) return null;
  return _memberMap[String(assigneeId)] || null;
}

export async function getMemberByEmail(email) {
  if (!email) return null;
  await ensureMemberMap();
  const e = email.toLowerCase();
  return (_memberList || []).find(m => (m.email || '').toLowerCase() === e) || null;
}

export function getTeamMembers() {
  if (!_memberList) return [];
  // Deduplicate by name
  const seen = new Set();
  return _memberList
    .filter(m => { if (seen.has(m.name)) return false; seen.add(m.name); return true; })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function mapItem(item) {
  const status = extractStatus(item);
  const statusInfo = categoriseStatus(status);
  const pid = String(item.projectId || item.project_id || '');
  const assigneeId = item.assigneeId ? String(item.assigneeId) : null;
  const priority = normalisePriority(item.priority);

  // Extract first screenshot: thumbnail for the list, full-size image for the hover preview
  let thumbnail = null;
  let image = null;
  if (item.Screenshots) {
    const ss = Array.isArray(item.Screenshots) ? item.Screenshots[0] : item.Screenshots;
    if (typeof ss === 'string') image = ss;
    else if (ss) image = ss.url || ss.src || ss.image || ss.thumbnail || null;
    if (typeof image !== 'string') image = null;
  }
  if (item.Screenshots) {
    const ss = item.Screenshots;
    if (Array.isArray(ss) && ss.length > 0) {
      thumbnail = ss[0].thumbnail || ss[0].url || ss[0].src || ss[0];
      if (typeof thumbnail !== 'string') thumbnail = null;
    } else if (typeof ss === 'string') {
      thumbnail = ss;
    } else if (ss.thumbnail || ss.url || ss.src) {
      thumbnail = ss.thumbnail || ss.url || ss.src;
    }
  }

  // Workflow status (the actual status name from the project's workflow)
  const workflowName = item.Workflow?.name || status || null;
  const workflowColor = item.Workflow?.color || null;

  // Keep description separate from title — show it as a preview line
  const title = item.title || item.description || `Feedback #${item.id}`;
  const description = item.description && item.description !== title
    ? item.description
    : null;

  return {
    id: item.id,
    title,
    description,
    status,
    category: statusInfo.category,
    statusLabel: statusInfo.label,
    workflowName,
    workflowColor,
    assignee: resolveMemberName(assigneeId),
    assigneeId,
    priority: priority.label,
    priorityLevel: priority.level,
    priorityColor: priority.color,
    feedbackType: item.feedbackType || item.category || null,
    thumbnail,
    image: image || thumbnail,
    createdAt: item.created,
    updatedAt: item.modified,
    url: item.shareUrl || `https://app.userback.io/viewer/${WORKSPACE_ID}/${pid}/`,
    pageUrl: item.pageUrl || null,
    projectId: pid,
    isPinned: item.isPinned || false,
  };
}

// ── Fetch all non-archived projects ──────────────────────────────────────────
export async function fetchAllProjects() {
  try {
    let allProjects = [];
    let page = 1;
    while (true) {
      const res = await fetch(`${USERBACK_BASE}/project?page=${page}&limit=50`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error(`Userback projects fetch failed: ${res.status}`);
      const data = await res.json();
      const items = data.data || [];
      allProjects.push(...items);
      if (page >= (data._pagination?.totalPages || 1)) break;
      page++;
    }
    return allProjects
      .filter(p => !p.isArchived && !p.archived && p.status !== 'archived')
      .map(p => ({ id: String(p.id), name: p.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    console.error('Userback fetchAllProjects error:', err.message);
    return [];
  }
}

// ── Fetch feedback for a single project ──────────────────────────────────────
// Userback only lets us page through a project's tickets newest-change-first, and busy
// projects have hundreds of resolved tickets, so "the latest N" misses old open tickets.
//   full   → every page; returns all active tickets (used as the saved "open base")
//   recent → only tickets changed in the last RECENT_DAYS, merged over the saved base.
//            A ticket that changed since the base was saved shows up in the recent pass,
//            so anything not in it is exactly as the base recorded it.
export const RECENT_DAYS = 8;
const FULL_MAX_PAGES = 60;   // 3,000 tickets a project
const RECENT_MAX_PAGES = 10;

async function fetchFeedbackPage(projectId, page) {
  const params = new URLSearchParams({ filter: `projectId eq ${projectId}`, sort: 'modified,desc', limit: '50', page: String(page) });
  const url = `${USERBACK_BASE}/feedback?${params.toString()}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: getHeaders() });
    if (res.status === 429) {
      await delay(Math.min(10, parseInt(res.headers.get('retry-after') || '2', 10) || 2) * 1000);
      continue;
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Userback fetch failed: ${res.status} — ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    const pagination = data._pagination || data.pagination || {};
    return { items: data.data || [], totalPages: pagination.totalPages || 1 };
  }
  throw new Error('Userback fetch failed: rate limited');
}

function shapeProjectData(projectId, activeItems, resolvedItems) {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const byNewest = (a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
  activeItems.sort(byNewest);
  const resolvedThisWeek = resolvedItems
    .filter(i => i.updatedAt && new Date(i.updatedAt) >= oneWeekAgo)
    .sort(byNewest);
  return {
    projectId,
    total: activeItems.length,
    open:        activeItems.filter(i => i.category === 'open'),
    inProgress:  activeItems.filter(i => i.category === 'inProgress'),
    onHold:      activeItems.filter(i => i.category === 'onHold'),
    resolvedThisWeek,
    error: null,
  };
}

// Returns { data, active } where active (full mode only) is every active ticket, for the base
export async function fetchProjectTasks(projectId, { mode = 'recent', base = null } = {}) {
  if (!projectId) return { data: null, active: null };
  await ensureMemberMap();
  try {
    const cutoff = Date.now() - RECENT_DAYS * 86400000;
    const raw = [];
    const maxPages = mode === 'full' ? FULL_MAX_PAGES : RECENT_MAX_PAGES;
    for (let page = 1; page <= maxPages; page++) {
      const { items, totalPages } = await fetchFeedbackPage(projectId, page);
      raw.push(...items);
      if (!items.length || page >= totalPages) break;
      if (mode !== 'full') {
        const last = items[items.length - 1];
        if (last?.modified && new Date(last.modified).getTime() < cutoff) break;
      }
    }
    const mapped = raw.map(mapItem);
    if (mode === 'full') {
      const active = mapped.filter(i => i.category !== 'resolved');
      return { data: shapeProjectData(projectId, active, mapped.filter(i => i.category === 'resolved')), active };
    }
    // Recent pass over the saved base: changed tickets replace their saved copy
    const byId = new Map((base || []).map(i => [String(i.id), i]));
    const resolved = [];
    for (const item of mapped) {
      if (item.category === 'resolved') { byId.delete(String(item.id)); resolved.push(item); }
      else byId.set(String(item.id), item);
    }
    return { data: shapeProjectData(projectId, [...byId.values()], resolved), active: null };
  } catch (err) {
    return {
      data: { projectId, total: 0, open: [], inProgress: [], onHold: [], resolvedThisWeek: [], error: err.message },
      active: null,
    };
  }
}

// ── A project's tickets changed since a date (monthly reports) ─────────────────
// Newest first, 50 a page, stopping once a page reaches back past `sinceISO`.
export async function fetchProjectHistory(projectId, sinceISO, maxPages = 8) {
  await ensureMemberMap();
  const since = new Date(sinceISO);
  const out = [];
  for (let page = 1; page <= maxPages; page++) {
    const params = new URLSearchParams({ filter: `projectId eq ${projectId}`, sort: 'modified,desc', limit: '50', page: String(page) });
    let res = await fetch(`${USERBACK_BASE}/feedback?${params}`, { headers: getHeaders() });
    if (res.status === 429) { await delay(2000); res = await fetch(`${USERBACK_BASE}/feedback?${params}`, { headers: getHeaders() }); }
    if (!res.ok) throw new Error(`Userback fetch failed: ${res.status}`);
    const body = await res.json();
    const items = (body.data || []).map(mapItem);
    out.push(...items);
    const last = items[items.length - 1];
    if (!items.length || (last?.updatedAt && new Date(last.updatedAt) < since)) break;
    const pagination = body._pagination || body.pagination || {};
    if (page >= (pagination.totalPages || 1)) break;
    await delay(150);
  }
  return out;
}

// ── Fetch one feedback item (used by the webhook) ────────────────────────────
export async function fetchFeedbackById(id) {
  await ensureMemberMap();
  const res = await fetch(`${USERBACK_BASE}/feedback/${encodeURIComponent(id)}`, { headers: getHeaders() });
  if (!res.ok) throw new Error(`Userback feedback ${id} fetch failed: ${res.status}`);
  const body = await res.json();
  return mapItem(body.data || body);
}

// ── Compute project health ───────────────────────────────────────────────────
export function computeHealth(data) {
  if (!data) return 'clear';
  const open       = data.open?.length       || 0;
  const inProgress = data.inProgress?.length  || 0;
  const onHold     = data.onHold?.length      || 0;
  const resolved   = data.resolvedThisWeek?.length || 0;

  if (onHold > 0) return 'blocked';
  if ((open + inProgress + onHold) > 0 && inProgress === 0 && resolved === 0) return 'stale';
  if (inProgress > 0 || resolved > 0) return 'active';
  return 'clear';
}
