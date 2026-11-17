import { getUser, isAdmin } from '../../../lib/auth';
import { getScoringHealth } from '../../../lib/scoreboard';

export default async function handler(req, res) {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorised' });
  if (!isAdmin(user)) return res.status(403).json({ error: 'Admin access only' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    return res.status(200).json(await getScoringHealth());
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
