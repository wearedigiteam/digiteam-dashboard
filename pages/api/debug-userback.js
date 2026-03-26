// Temporary diagnostic endpoint — remove after debugging.
// Usage: /api/debug-userback?project_id=47672
//
// Shows the raw response from Userback's API so you can verify:
// 1. Whether project_id filtering works server-side
// 2. What fields contain the URL/hash for linking
// 3. Whether the correct issues are being returned

import { getTokenFromRequest, verifyToken } from '../../lib/auth';

const USERBACK_BASE = 'https://rest.userback.io/1.0';
const WORKSPACE_ID = '29871';

export default async function handler(req, res) {
  const token = getTokenFromRequest(req);
  if (!token || !verifyToken(token)) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  const projectId = req.query.project_id;
  if (!projectId) {
    return res.status(400).json({
      error: 'Pass ?project_id=XXXXX',
      hint: 'Use a project ID from mapping.json, e.g. 47672 for First National',
    });
  }

  try {
    const apiRes = await fetch(
      `${USERBACK_BASE}/feedback?project_id=${projectId}&per_page=5&page=1`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.USERBACK_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const raw = await apiRes.json();
    const items = raw.data || raw || [];

    // Look for URL-related fields on each item
    const urlFields = ['share_url', 'permalink', 'viewer_url', 'link',
                       'public_url', 'hash', 'token', 'slug', 'key',
                       'feedback_url', 'view_url', 'web_url'];

    const summary = items.slice(0, 5).map(item => {
      const foundUrlFields = {};
      urlFields.forEach(f => {
        if (item[f] !== undefined && item[f] !== null) {
          foundUrlFields[f] = item[f];
        }
      });

      return {
        id: item.id,
        title: item.title || item.description || '(no title)',
        status: item.status,
        project_id_on_item: item.project_id ?? item.projectId ?? '(field not present)',
        requested_project_id: projectId,
        match: String(item.project_id || item.projectId || '') === String(projectId),
        url_related_fields: foundUrlFields,
        url_field: item.url || '(not present — this is usually the page URL, not a Userback link)',
        expected_url_pattern: `https://app.userback.io/viewer/${WORKSPACE_ID}/${projectId}/{hash}/`,
        all_field_names: Object.keys(item).sort(),
      };
    });

    const allProjectIds = [...new Set(items.map(i => String(i.project_id || i.projectId || 'unknown')))];

    return res.status(200).json({
      requested_project_id: projectId,
      api_status: apiRes.status,
      total_items_returned: items.length,
      unique_project_ids_in_response: allProjectIds,
      filtering_works: allProjectIds.length === 1 && allProjectIds[0] === String(projectId),
      pagination: raw._pagination || raw.pagination || '(not present)',
      first_5_items: summary,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}