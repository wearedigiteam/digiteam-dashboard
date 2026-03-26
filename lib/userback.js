const USERBACK_BASE = 'https://rest.userback.io/1.0';

function getHeaders() {
  return {
    'Authorization': `Bearer ${process.env.USERBACK_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

// Status labels from Userback
const STATUS_MAP = {
  'open':        { label: 'Open',        category: 'open' },
  'in-progress': { label: 'In Progress', category: 'inProgress' },
  'inprogress':  { label: 'In Progress', category: 'inProgress' },
  'in_progress': { label: 'In Progress', category: 'inProgress' },
  'resolved':    { label: 'Resolved',    category: 'resolved' },
  'closed':      { label: 'Resolved',    category: 'resolved' },
  'wontfix':     { label: "Won't Fix",   category: 'resolved' },
  'onhold':      { label: 'On Hold',     category: 'onHold' },
  'on-hold':     { label: 'On Hold',     category: 'onHold' },
  'on_hold':     { label: 'On Hold',     category: 'onHold' },
};

function categoriseStatus(status) {
  const key = (status || '').toLowerCase().replace(/\s/g, '');
  return STATUS_MAP[key] || { label: status || 'Open', category: 'open' };
}

export async function fetchAllProjects() {
  try {
    const res = await fetch(`${USERBACK_BASE}/project`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error(`Userback projects fetch failed: ${res.status}`);
    const data = await res.json();
    // Userback returns { data: [...] } or just [...]
    return (data.data || data || []).map(p => ({
      id: String(p.id),
      name: p.name,
      url: p.url || null,
    }));
  } catch (err) {
    console.error('Userback fetchAllProjects error:', err.message);
    return [];
  }
}

export async function fetchProjectTasks(projectId) {
  if (!projectId) return null;

  try {
    // Fetch all feedback for this project
    let allItems = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const res = await fetch(
        `${USERBACK_BASE}/feedback?project_id=${projectId}&per_page=${perPage}&page=${page}`,
        { headers: getHeaders() }
      );
      if (!res.ok) throw new Error(`Userback feedback fetch failed: ${res.status}`);
      const data = await res.json();
      const items = data.data || data || [];
      allItems.push(...items);
      if (items.length < perPage) break;
      page++;
    }

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const mapItem = item => ({
      id: item.id,
      title: item.title || item.description || `Feedback #${item.id}`,
      status: item.status,
      category: categoriseStatus(item.status).category,
      statusLabel: categoriseStatus(item.status).label,
      assignee: item.assigned_to?.name || item.assignee?.name || null,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      url: item.url || null,
      type: item.feedback_type || item.type || null,
    });

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
      projectId,
      total: 0,
      open: [], inProgress: [], onHold: [], resolvedThisWeek: [],
      error: err.message,
    };
  }
}