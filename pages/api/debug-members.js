// /api/debug-members — check what the Members API returns
import { getTokenFromRequest, verifyToken } from '../../lib/auth';

const USERBACK_BASE = 'https://rest.userback.io/1.0';

export default async function handler(req, res) {
  const token = getTokenFromRequest(req);
  if (!token || !verifyToken(token)) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  const headers = {
    'Authorization': `Bearer ${process.env.USERBACK_API_KEY}`,
    'Content-Type': 'application/json',
  };

  const tests = {};

  // 1. List all members
  try {
    const r = await fetch(`${USERBACK_BASE}/member?limit=50`, { headers });
    const data = await r.json();
    const members = data.data || data || [];
    tests['list_members'] = {
      status: r.status,
      count: Array.isArray(members) ? members.length : 'not array',
      first_3: (Array.isArray(members) ? members.slice(0, 3) : []).map(m => ({
        id: m.id,
        name: m.name,
        displayName: m.displayName,
        firstName: m.firstName,
        lastName: m.lastName,
        email: m.email,
        all_keys: Object.keys(m),
      })),
    };
  } catch (err) {
    tests['list_members'] = { error: err.message };
  }

  // 2. Try fetching a specific member (38527 from your screenshots)
  const testId = req.query.member_id || '38527';
  try {
    const r = await fetch(`${USERBACK_BASE}/member/${testId}`, { headers });
    const body = await r.text();
    tests[`get_member_${testId}`] = {
      status: r.status,
      body: body.slice(0, 500),
    };
  } catch (err) {
    tests[`get_member_${testId}`] = { error: err.message };
  }

  return res.status(200).json(tests);
}