// Test the correct OData-style filter/sort syntax
// /api/debug-userback?project_id=47672
import { getTokenFromRequest, verifyToken } from '../../lib/auth';

const USERBACK_BASE = 'https://rest.userback.io/1.0';

async function testEndpoint(label, url, headers) {
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { label, status: res.status, error: `HTTP ${res.status}`, body: body.slice(0, 200) };
    }
    const data = await res.json();
    const items = data.data || data || [];
    const pagination = data._pagination || data.pagination || null;
    return {
      label,
      status: res.status,
      count: items.length,
      totalRecords: pagination?.totalRecords || '?',
      totalPages: pagination?.totalPages || '?',
      first_item: items[0] ? {
        id: items[0].id,
        title: (items[0].title || items[0].description || '').slice(0, 60),
        projectId: items[0].projectId,
        workflow: items[0].Workflow?.name || '(none)',
        created: items[0].created,
        modified: items[0].modified,
        shareUrl: items[0].shareUrl || '(none)',
      } : null,
    };
  } catch (err) {
    return { label, error: err.message };
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

  const pid = req.query.project_id || '47672';
  const d = ms => new Promise(r => setTimeout(r, ms));
  const tests = [];

  // 1. Sort by modified descending (newest first)
  tests.push(await testEndpoint(
    'sort=modified,desc',
    `${USERBACK_BASE}/feedback?sort=modified,desc&per_page=10&page=1`,
    headers
  ));
  await d(300);

  // 2. Filter by projectId
  tests.push(await testEndpoint(
    `filter=projectId eq ${pid}`,
    `${USERBACK_BASE}/feedback?filter=projectId eq ${pid}&per_page=10&page=1`,
    headers
  ));
  await d(300);

  // 3. Filter by projectId + sort newest first
  tests.push(await testEndpoint(
    `filter=projectId eq ${pid} + sort=modified,desc`,
    `${USERBACK_BASE}/feedback?filter=projectId eq ${pid}&sort=modified,desc&per_page=10&page=1`,
    headers
  ));
  await d(300);

  // 4. Filter by projectId + exclude resolved
  tests.push(await testEndpoint(
    `filter=projectId eq ${pid} and Workflow ne Resolved`,
    `${USERBACK_BASE}/feedback?filter=projectId eq ${pid} and Workflow ne 'Resolved'&per_page=10&page=1`,
    headers
  ));
  await d(300);

  // 5. Try per_page=100 to check if it actually works with sorting
  tests.push(await testEndpoint(
    `per_page=100 + sort=modified,desc`,
    `${USERBACK_BASE}/feedback?sort=modified,desc&per_page=100&page=1`,
    headers
  ));

  return res.status(200).json({ tests });
}