import { getUser } from '../../../lib/auth';
import { canSee, readChannel, buildDigest, explainSlackError, RANGES, STRICTNESS } from '../../../lib/slack-signal';

export const config = { maxDuration: 60 };

// POST { id, range, strict } → { bullets }
export default async function handler(req, res) {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorised' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { id, range = '3', strict = 'balanced' } = req.body || {};
  if (!RANGES[range] || !STRICTNESS.includes(strict)) return res.status(400).json({ error: 'Bad range or filter' });
  try {
    const channel = await canSee(user.email, String(id || ''));
    if (!channel) return res.status(404).json({ error: 'Channel not found, or you’re not a member of it.' });
    const msgs = await readChannel(channel.id, RANGES[range]);
    const bullets = await buildDigest(channel.id, channel.name, RANGES[range], strict, msgs);
    return res.status(200).json({ bullets });
  } catch (err) {
    console.error('Slack digest failed:', err);
    return res.status(502).json({ error: err.slackError ? explainSlackError(err) : `Couldn’t write the digest: ${err.message}` });
  }
}
