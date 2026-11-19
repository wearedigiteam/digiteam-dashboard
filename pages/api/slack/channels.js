import { getUser } from '../../../lib/auth';
import { channelListFor, explainSlackError, QUIET_DAYS } from '../../../lib/slack-signal';

export default async function handler(req, res) {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorised' });
  if (!process.env.SLACK_BOT_TOKEN) return res.status(200).json({ channels: [], error: 'SLACK_BOT_TOKEN isn’t set in Vercel.' });
  try {
    const channels = await channelListFor(user.email, { fresh: req.query.fresh === '1' });
    return res.status(200).json({ channels, quietDays: QUIET_DAYS });
  } catch (err) {
    console.error('Slack channels failed:', err);
    return res.status(200).json({ channels: [], error: explainSlackError(err) });
  }
}
