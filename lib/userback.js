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

// ── Member name cache ────────────────────────────────────────────────────────
let _memberCache = null;

async function getMemberLookup() {
  if (_memberCache) return _memberCache;

  try {
    const res = await fetch(`${USERBACK_BASE}/member?limit=100`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      console.error('Userback member fetch failed:', res.status);
      return {};
    }
    const data = await res.json();
    const members = data.data || [];
    const lookup = {};
    for (const m of members) {
      lookup[String(m.id)] = m.name || m.email || `User ${m.id}`;
    }
    _memberCache = lookup;
    return lookup;
  } catch (err) {
    console.error('Userback member lookup error:', err.message);
    return {};
  }
}

function mapItem(item, memberLookup) {
  const status = extractStatus(item);
  const statusInfo = categoriseStatus(status);
  const pid = String(item.projectId || item.project_id || '');
  const assigneeId = item.assigneeId ? String(item.assigneeId) : null;
  const assigneeName = assigneeId && memberLookup
    ? (memberLookup[assigneeId] || null)
    : null;

  return {
    id: item.id,
    title: item.title || item.description || `Feedback #${item.id}`,
    status,
    category: statusInfo.category,
    statusLabel: statusInfo.label,
    assignee: assigneeName,
    createdAt: item.created,
    updatedAt: item.modified,
    url: item.shareUrl || `https://app.userback.io/viewer/${WORKSPACE_ID}/${pid}/`,
    pageUrl: item.pageUrl || null,
    type: item.feedbackType || null,
    projectId: pid,
  };
}

// ── Fetch all projects (for admin screen) ────────────────────────────────────
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
      .map(p => ({ id: String(p.id), name: p.name, url: p.url || null }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    console.error('Userback fetchAllProjects error:', err.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FETCH FEEDBACK FOR A SINGLE PROJECT
//
// API query:
//   filter=projectId eq {id}   → only this project
//   sort=modified,desc         → newest-modified first
//   limit=100                  → 100 items per page (not per_page)
//   page=N                     → pagination
//
// With sort=modified,desc, all open/active items appear on the first pages
// because they've been recently modified. We fetch up to MAX_PAGES pages
// (200 items) which captures all active work plus recent resolutions.
// Resolved items are filtered out client-side.
// ═══════════════════════════════════════════════════════════════════════════════

const MAX_PAGES = 2; // 200 most recently modified items per project

export async function fetchProjectTasks(projectId) {
  if (!projectId) return null;

  try {
    // Fetch member lookup for resolving assignee IDs to names
    const memberLookup = await getMemberLookup();
    let allItems = [];

    for (let page = 1; page <= MAX_PAGES; page++) {
      // Use URLSearchParams for proper encoding of filter spaces
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
        // Retry once
        const retry = await fetch(url, { headers: getHeaders() });
        if (retry.ok) {
          const data = await retry.json();
          allItems.push(...(data.data || []));
        }
        continue;
      }

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Userback feedback fetch failed: ${res.status} — ${body.slice(0, 200)}`);
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
    const allMapped = allItems.map(item => mapItem(item, memberLookup));
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
      projectId,
      total: 0,
      open: [], inProgress: [], onHold: [], resolvedThisWeek: [],
      error: err.message,
    };
  }
}