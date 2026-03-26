// Temporary diagnostic — remove after debugging.
// Usage: /api/debug-userback?project_id=47672
import { getTokenFromRequest, verifyToken } from '../../lib/auth';

const USERBACK_BASE = 'https://rest.userback.io/1.0';

export default async function handler(req, res) {
  const token = getTokenFromRequest(req);
  if (!token || !verifyToken(token)) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  const projectId = req.query.project_id || '47672';
  const maxPages = parseInt(req.query.pages || '10');

  try {
    let matched = [];
    let page = 1;
    let totalPages = 1;
    let totalScanned = 0;

    while (page <= maxPages && page <= totalPages) {
      const apiRes = await fetch(
        `${USERBACK_BASE}/feedback?project_id=${projectId}&per_page=100&page=${page}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.USERBACK_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const raw = await apiRes.json();
      const items = raw.data || raw || [];
      const pagination = raw._pagination || raw.pagination || {};
      totalPages = pagination.totalPages || 1;
      totalScanned += items.length;

      const projectMatches = items.filter(i =>
        String(i.projectId || i.project_id || '') === String(projectId)
      );
      matched.push(...projectMatches);

      if (items.length === 0) break;
      page++;
    }

    const summary = matched.slice(0, 10).map(item => ({
      id: item.id,
      title: item.title || item.description || '(no title)',
      projectId: item.projectId,
      shareUrl: item.shareUrl || '(not present)',
      Workflow: item.Workflow || '(not present)',
      category: item.category || '(not present)',
      status_from_workflow: (() => {
        if (!item.Workflow) return '(no Workflow)';
        if (typeof item.Workflow === 'string') return item.Workflow;
        return JSON.stringify(item.Workflow);
      })(),
      created: item.created,
      modified: item.modified,
    }));

    return res.status(200).json({
      requested_project_id: projectId,
      pages_scanned: page - 1,
      total_items_scanned: totalScanned,
      matched_for_project: matched.length,
      total_pages_available: totalPages,
      first_10_matched: summary,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}