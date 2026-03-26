const USERBACK_BASE = 'https://rest.userback.io/1.0';
const WORKSPACE_ID  = '29871';

// ── Rate-limit helper ────────────────────────────────────────────────────────
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

// ── Map a raw Userback item to our internal shape ────────────────────────────
function mapItem(item) {
  const status = extractStatus(item);
  const statusInfo = categoriseStatus(status);
  const pid = String(item.projectId || item.project_id || '');

  return {
    id: item.id,
    title: item.title || item.description || `Feedback #${item.id}`,
    status,
    category: statusInfo.category,
    statusLabel: statusInfo.label,
    assignee: item.assigneeId || null,
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
      const res = await fetch(`${USERBACK_BASE}/project?page=${page}&per_page=50`, {
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

// ── Fetch ALL feedback in one pass, grouped by project ───────────────────────
// This replaces the per-project approach to avoid rate-limiting (429s).
// We paginate through the entire workspace once, with delays between requests,
// and group results by projectId.
export async function fetchAllFeedbackByProject(projectIds) {
  if (!projectIds || projectIds.length === 0) return {};

  const pidSet = new Set(projectIds.map(String));
  const buckets = {};       // { projectId: [items...] }
  pidSet.forEach(pid => { buckets[pid] = []; });

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  let page = 1;
  let totalPages = 1;
  const maxPages = 200;     // Scan up to 2000 items (API returns ~10/page)
  const delayMs = 250;      // 250ms between requests = ~4 req/sec

  try {
    while (page <= maxPages && page <= totalPages) {
      const res = await fetch(
        `${USERBACK_BASE}/feedback?per_page=100&page=${page}`,
        { headers: getHeaders() }
      );

      if (res.status === 429) {
        // Rate limited — wait longer and retry this page
        console.warn(`Userback 429 on page ${page}, waiting 2s...`);
        await delay(2000);
        continue;
      }
      if (!res.ok) throw new Error(`Userback feedback fetch failed: ${res.status}`);

      const data = await res.json();
      const items = data.data || data || [];
      const pagination = data._pagination || data.pagination || {};
      totalPages = pagination.totalPages || 1;

      for (const item of items) {
        const pid = String(item.projectId || item.project_id || '');
        if (pidSet.has(pid)) {
          buckets[pid].push(mapItem(item));
        }
      }

      if (items.length === 0) break;
      page++;

      // Delay between requests to stay under rate limit
      if (page <= totalPages) await delay(delayMs);
    }
  } catch (err) {
    console.error('Userback bulk fetch error:', err.message);
    // Return whatever we've collected so far rather than failing entirely
  }

  // ── Build per-project result objects ──
  const results = {};
  for (const pid of pidSet) {
    const allMapped = buckets[pid];
    const activeItems = allMapped.filter(i => i.category !== 'resolved');
    const resolvedThisWeek = allMapped.filter(i =>
      i.category === 'resolved' &&
      i.updatedAt && new Date(i.updatedAt) >= oneWeekAgo
    );

    results[pid] = {
      projectId: pid,
      total: activeItems.length,
      open:        activeItems.filter(i => i.category === 'open'),
      inProgress:  activeItems.filter(i => i.category === 'inProgress'),
      onHold:      activeItems.filter(i => i.category === 'onHold'),
      resolvedThisWeek,
      error: null,
    };
  }

  return results;
}

// ── Legacy per-project fetch (kept for backward compat, not used by data.js) ─
export async function fetchProjectTasks(projectId) {
  if (!projectId) return null;
  const results = await fetchAllFeedbackByProject([projectId]);
  return results[String(projectId)] || {
    projectId, total: 0,
    open: [], inProgress: [], onHold: [], resolvedThisWeek: [],
    error: null,
  };
}