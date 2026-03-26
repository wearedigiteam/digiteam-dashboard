const USERBACK_BASE = 'https://rest.userback.io/1.0';
const WORKSPACE_ID  = '29871';

function getHeaders() {
  return {
    'Authorization': `Bearer ${process.env.USERBACK_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

// ── Status mapping ───────────────────────────────────────────────────────────
// The API returns status inside a Workflow object, or as a direct field.
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

// ── Extract status from a feedback item ─────────────────────────────────────
// The Workflow field is an object that likely contains the status.
function extractStatus(item) {
  if (item.Workflow) {
    const wf = item.Workflow;
    if (typeof wf === 'string') return wf;
    // Try common field names inside the Workflow object
    const val = wf.status || wf.name || wf.label || wf.value || wf.state || wf.title;
    if (val) return val;
    // If Workflow is an object but none of the known keys match,
    // check if it has a single string value
    const vals = Object.values(wf).filter(v => typeof v === 'string');
    if (vals.length > 0) return vals[0];
  }
  return item.status || item.state || item.category || null;
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

    const mapped = allProjects.map(p => ({
      id: String(p.id),
      name: p.name,
      url: p.url || null,
    }));

    return mapped.sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    console.error('Userback fetchAllProjects error:', err.message);
    return [];
  }
}

// ── Fetch feedback for a specific project ────────────────────────────────────
export async function fetchProjectTasks(projectId) {
  if (!projectId) return null;

  try {
    // IMPORTANT: The Userback API does NOT filter by project_id server-side.
    // It returns ALL feedback across the entire workspace.
    // We must filter client-side by item.projectId.
    //
    // The API also caps page size (appears to be ~10 per page regardless of
    // per_page param). With thousands of items across all projects, we cannot
    // feasibly fetch every page. Instead, we fetch up to maxPages and collect
    // items that match our project.
    let matchedItems = [];
    let page = 1;
    const perPage = 100; // Request 100, API may return fewer
    const maxPages = 100; // Safety ceiling
    let totalPages = 1;

    while (page <= maxPages && page <= totalPages) {
      const res = await fetch(
        `${USERBACK_BASE}/feedback?project_id=${projectId}&per_page=${perPage}&page=${page}`,
        { headers: getHeaders() }
      );
      if (!res.ok) throw new Error(`Userback feedback fetch failed: ${res.status}`);
      const data = await res.json();
      const items = data.data || data || [];

      // Update total pages from pagination response
      const pagination = data._pagination || data.pagination || {};
      totalPages = pagination.totalPages || 1;

      // Filter to only items belonging to this project
      // API uses camelCase: projectId (not project_id)
      const projectMatches = items.filter(item =>
        String(item.projectId || item.project_id || '') === String(projectId)
      );
      matchedItems.push(...projectMatches);

      // If we've found a good number of items AND there are many pages left,
      // we can stop early. We're looking for this project's items, not all items.
      if (items.length === 0) break;
      page++;
    }

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // ── Map each item using the correct camelCase field names ──
    const mapItem = item => {
      const status = extractStatus(item);
      const statusInfo = categoriseStatus(status);

      // shareUrl is the viewer link (camelCase from the API)
      const userbackUrl = item.shareUrl || item.ShareUrl
        || `https://app.userback.io/viewer/${WORKSPACE_ID}/${projectId}/`;

      return {
        id: item.id,
        title: item.title || item.description || `Feedback #${item.id}`,
        status: status,
        category: statusInfo.category,
        statusLabel: statusInfo.label,
        assignee: item.assigneeId || null,
        createdAt: item.created,
        updatedAt: item.modified,
        url: userbackUrl,
        pageUrl: item.pageUrl || null,
        type: item.feedbackType || null,
      };
    };

    const allMapped = matchedItems.map(mapItem);
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