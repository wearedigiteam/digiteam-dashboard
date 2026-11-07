import { getUser, isAdmin } from '../../../lib/auth';
import { getHealthStatus, sendTestAlert, probeUserback } from '../../../lib/health';

export default async function handler(req, res) {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorised' });
  if (!isAdmin(user)) return res.status(403).json({ error: 'Admin access only' });

  if (req.method === 'GET') {
    const [status, live] = await Promise.all([getHealthStatus(), probeUserback()]);
    return res.status(200).json({ ...status, live });
  }
  if (req.method === 'POST') {
    try {
      await sendTestAlert(user.email);
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(200).json({ ok: false, error: err.message });
    }
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
