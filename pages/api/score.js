import { getUser } from '../../lib/auth';
import { getScoreSummary, claimCelebrations } from '../../lib/scoreboard';

export default async function handler(req, res) {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorised' });
  try {
    const summary = await getScoreSummary();
    // Rewards this person hasn't seen yet (each plays once per person)
    const celebrate = await claimCelebrations(user.email, summary).catch(() => []);
    return res.status(200).json({ ...summary, celebrate });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
