// Diagnostic: test sort order and status filtering
// /api/debug-userback?project_id=47672
import { getTokenFromRequest, verifyToken } from '../../lib/auth';

const USERBACK_BASE = 'https://rest.userback.io/1.0';

async function testEndpoint(url, headers) {
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return { status: res.status, error: `HTTP ${res.status}` };
    const data = await res.json();
    const items = data.data || data || [];
    return {
      status: res.status,
      count: items.length,
      pagination: data._pagination || data.pagination || null,
      first_item: items[0] ? {
        id: items[0].id,
        title: items[0].title || items[0].description,
        projectId: items[0].projectId,
        created: items[0].created,
        modified: items[0].modified,
        workflow: items[0].Workflow?.name || '(none)',
        shareUrl: items[0].shareUrl || '(none)',
      } : null,
      last_item: items.length > 1 ? {
        id: items[items.length - 1].id,
        title: items[items.length - 1].title || items[items.length - 1].description,
        projectId: items[items.length - 1].projectId,
        created: items[items.length - 1].created,
        modified: items[items.length - 1].modified,
        workflow: items[items.length - 1].Workflow?.name || '(none)',
      } : null,
    };
  } catch (err) {
    return { error: err.message };
  }
}

export default async function handler(req, res) {
  const token = getTokenFromRequest(req);
  if (!token || !verifyToken(token)) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  const headers = {
    'Authorization': `Bearer ${process.env.USERBACK_API_KEY}`,
    'Content-Type': 'application/json',
  };

  const projectId = req.query.project_id || '47672';

  // Test multiple approaches to find what works
  const results = {};

  // 1. Default (what we've been using)
  results['default_page1'] = await testEndpoint(
    `${USERBACK_BASE}/feedback?per_page=10&page=1`, headers
  );

  // Small delay between requests
  await new Promise(r => setTimeout(r, 300));

  // 2. Try sort=created&order=desc (newest first)
  results['sort_created_desc'] = await testEndpoint(
    `${USERBACK_BASE}/feedback?per_page=10&page=1&sort=created&order=desc`, headers
  );

  await new Promise(r => setTimeout(r, 300));

  // 3. Try sort=modified&order=desc
  results['sort_modified_desc'] = await testEndpoint(
    `${USERBACK_BASE}/feedback?per_page=10&page=1&sort=modified&order=desc`, headers
  );

  await new Promise(r => setTimeout(r, 300));

  // 4. Try status filter (exclude resolved)
  results['status_not_resolved'] = await testEndpoint(
    `${USERBACK_BASE}/feedback?per_page=10&page=1&status=open`, headers
  );

  await new Promise(r => setTimeout(r, 300));

  // 5. Try with project_id AND sort
  results['project_sorted'] = await testEndpoint(
    `${USERBACK_BASE}/feedback?project_id=${projectId}&per_page=10&page=1&sort=created&order=desc`, headers
  );

  return res.status(200).json({
    note: 'Compare first_item dates across tests to see which sort params work',
    tests: results,
  });
}