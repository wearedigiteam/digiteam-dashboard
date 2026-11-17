import { getUser } from '../../../lib/auth';
import { canSee, setOverride } from '../../../lib/slack-signal';

// POST { id, ts, label: 'w' | 'n' | null } → a team-wide correction (null clears it)
export default async function handler(req, res) {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorised' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { id, ts, label } = req.body || {};
  if (!/^\d+\.\d+$/.test(String(ts || '')) || !['w', 'n', null].includes(label)) return res.status(400).json({ error: 'Bad request' });
  const channel = await canSee(user.email, String(id || '')).catch(() => null);
  if (!channel) return res.status(404).json({ error: 'Channel not found, or you’re not a member of it.' });
  await setOverride(channel.id, String(ts), label, user.email);
  return res.status(200).json({ ok: true });
}
