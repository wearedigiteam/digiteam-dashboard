import { getUser } from '../../lib/auth';
import { refreshDashboardData, getCachedDashboardData, FRESH_FOR_MS } from '../../lib/dashboard-data';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (!(await getUser(req))) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  const wantFresh = req.query.fresh === '1';

  if (!wantFresh) {
    const cached = await getCachedDashboardData();
    if (cached) {
      const age = Date.now() - new Date(cached.fetchedAt).getTime();
      return res.status(200).json({ ...cached, cached: true, stale: age > FRESH_FOR_MS });
    }
  }

  try {
    return res.status(200).json(await refreshDashboardData());
  } catch (err) {
    console.error('Data fetch error:', err);
    return res.status(502).json({ error: err.message || 'Failed to fetch data from Userback' });
  }
}
