import { getUser } from '../../../lib/auth';
import { canSee, markSeen } from '../../../lib/slack-signal';

// POST { id, ts } → this person has seen the channel up to ts (clears its unread highlight)
export default async function handler(req, res) {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorised' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { id, ts } = req.body || {};
  if (!/^\d+\.\d+$/.test(String(ts || ''))) return res.status(400).json({ error: 'Bad request' });
  const channel = await canSee(user.email, String(id || '')).catch(() => null);
  if (!channel) return res.status(404).json({ error: 'Channel not found, or you’re not a member of it.' });
  await markSeen(user.email, channel.id, String(ts));
  return res.status(200).json({ ok: true });
}
