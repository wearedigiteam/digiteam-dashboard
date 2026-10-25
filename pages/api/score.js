import { getTokenFromRequest, verifyToken } from '../../lib/auth';
import { getScoreSummary } from '../../lib/scoreboard';

export default async function handler(req, res) {
  const token = getTokenFromRequest(req);
  if (!token || !verifyToken(token)) return res.status(401).json({ error: 'Unauthorised' });
  try {
    return res.status(200).json(await getScoreSummary());
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
