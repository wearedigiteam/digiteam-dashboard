import { getUser, isAdmin } from '../../../lib/auth';
import { kv } from '@vercel/kv';
import { clearDashboardCache } from '../../../lib/dashboard-data';

export default async function handler(req, res) {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorised' });
  if (!isAdmin(user)) return res.status(403).json({ error: 'Admin access only' });

  if (req.method === 'GET') {
    try {
      const budgets = await kv.get('budgets') || {};
      return res.status(200).json({ budgets });
    } catch (err) {
      return res.status(500).json({ error: err.message, budgets: {} });
    }
  }

  if (req.method === 'POST') {
    try {
      const { budgets } = req.body;
      if (!budgets || typeof budgets !== 'object') {
        return res.status(400).json({ error: 'budgets must be an object' });
      }
      await kv.set('budgets', budgets);
      await clearDashboardCache();
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
