import { getTokenFromRequest, verifyToken } from '../../../lib/auth';
import { runWeeklySlack } from '../../../lib/weekly-slack';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  const token = getTokenFromRequest(req);
  if (!token || !verifyToken(token)) {
    return res.status(401).json({ error: 'Unauthorised' });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, slackId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  try {
    const r = await runWeeklySlack({ onlyUserId: userId, isTest: true, overrideSlackId: slackId || null });
    if (r.sent.length)        return res.status(200).json({ ok: true, message: 'Sent' });
    if (r.noSlackUser.length) return res.status(200).json({ ok: false, message: r.detail || 'No Slack match.' });
    if (r.errors.length)      return res.status(200).json({ ok: false, message: r.errors[0].error });
    return res.status(200).json({ ok: false, message: `Userback member ${userId} not found` });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
}
