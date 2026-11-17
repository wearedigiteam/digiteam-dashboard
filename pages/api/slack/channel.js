import { getUser } from '../../../lib/auth';
import { canSee, readChannel, getLabels, getPeople, explainSlackError, RANGES, STRICTNESS } from '../../../lib/slack-signal';

export const config = { maxDuration: 60 };

// GET ?id=C123&range=3&strict=balanced → messages with threads, current labels and corrections
export default async function handler(req, res) {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorised' });
  const { id, range = '3', strict = 'balanced', fresh } = req.query;
  if (!RANGES[range] || !STRICTNESS.includes(strict)) return res.status(400).json({ error: 'Bad range or filter' });
  try {
    const channel = await canSee(user.email, String(id || ''));
    if (!channel) return res.status(404).json({ error: 'Channel not found, or you’re not a member of it.' });
    const people = await getPeople();
    const messages = await readChannel(channel.id, RANGES[range], { people, fresh: fresh === '1' });
    const { labels, overrides } = await getLabels(channel.id, strict);
    const team = Object.fromEntries(Object.entries(people).filter(([, p]) => !p.bot).map(([uid, p]) => [uid, { name: p.name, image: p.image }]));
    return res.status(200).json({ channel, messages, labels, overrides, people: team, ai: Boolean(process.env.ANTHROPIC_API_KEY) });
  } catch (err) {
    console.error('Slack channel read failed:', err);
    return res.status(502).json({ error: explainSlackError(err) });
  }
}
