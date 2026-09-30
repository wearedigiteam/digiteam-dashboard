import { getTokenFromRequest, verifyToken } from '../../../lib/auth';

const USERBACK_BASE = 'https://rest.userback.io/1.0';

export default async function handler(req, res) {
  const token = getTokenFromRequest(req);
  if (!token || !verifyToken(token)) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  try {
    const headers = {
      'Authorization': `Bearer ${process.env.USERBACK_API_KEY}`,
      'Content-Type': 'application/json',
    };

    let allMembers = [];
    let page = 1;

    while (true) {
      const r = await fetch(`${USERBACK_BASE}/member?limit=50&page=${page}`, { headers });
      if (!r.ok) throw new Error(`Userback member fetch failed: ${r.status}`);
      const data = await r.json();
      const items = data.data || [];
      allMembers.push(...items);
      const pagination = data._pagination || data.pagination || {};
      if (page >= (pagination.totalPages || 1)) break;
      page++;
    }

    const members = allMembers
      .filter(m => !m.isDisabled)
      .map(m => ({
        id: m.id,
        userId: m.userId,
        name: m.name || m.email,
        email: m.email,
      })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    return res.status(200).json({ members });
  } catch (err) {
    return res.status(500).json({ error: err.message, members: [] });
  }
}
