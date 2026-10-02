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
          _memberList.push({ name, userId: String(m.userId || m.id) });
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

  // Extract first screenshot thumbnail if available
  let thumbnail = null;
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

  return {
    id: item.id,
    title: item.title || item.description || `Feedback #${item.id}`,
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
const MAX_PAGES = 2;

export async function fetchProjectTasks(projectId) {
  if (!projectId) return null;
  await ensureMemberMap();

  try {
    let allItems = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const params = new URLSearchParams({
        filter: `projectId eq ${projectId}`,
        sort: 'modified,desc',
        limit: '50',
        page: String(page),
      });
      const url = `${USERBACK_BASE}/feedback?${params.toString()}`;
      const res = await fetch(url, { headers: getHeaders() });

      if (res.status === 429) {
        const wait = parseInt(res.headers.get('retry-after') || '2');
        await delay(wait * 1000);
        const retry = await fetch(url, { headers: getHeaders() });
        if (retry.ok) allItems.push(...((await retry.json()).data || []));
        continue;
      }
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Userback fetch failed: ${res.status} — ${body.slice(0, 200)}`);
      }

      const data = await res.json();
      const items = data.data || [];
      allItems.push(...items);
      if (items.length === 0) break;
      const pagination = data._pagination || data.pagination || {};
      if (page >= (pagination.totalPages || 1)) break;
      if (page < MAX_PAGES) await delay(150);
    }

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const allMapped = allItems.map(mapItem);
    const activeItems = allMapped.filter(i => i.category !== 'resolved');
    const resolvedThisWeek = allMapped.filter(i =>
      i.category === 'resolved' &&
      i.updatedAt && new Date(i.updatedAt) >= oneWeekAgo
    );

    return {
      projectId,
      total: activeItems.length,
      open:        activeItems.filter(i => i.category === 'open'),
      inProgress:  activeItems.filter(i => i.category === 'inProgress'),
      onHold:      activeItems.filter(i => i.category === 'onHold'),
      resolvedThisWeek,
      error: null,
    };
  } catch (err) {
    return {
      projectId, total: 0,
      open: [], inProgress: [], onHold: [], resolvedThisWeek: [],
      error: err.message,
    };
  }
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
