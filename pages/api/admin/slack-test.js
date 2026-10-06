import { getTokenFromRequest, verifyToken } from '../../../lib/auth';
import { runWeeklySlack } from '../../../lib/weekly-slack';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  const token = getTokenFromRequest(req);
  if (!token || !verifyToken(token)) {
    return res.status(401).json({ error: 'Unauthorised' });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  try {
    const r = await runWeeklySlack({ onlyUserId: userId, isTest: true });
    if (r.sent.length)        return res.status(200).json({ ok: true, message: 'Sent' });
    if (r.noSlackUser.length) return res.status(200).json({ ok: false, message: 'No Slack match. Add their member ID and save.' });
    if (r.errors.length)      return res.status(200).json({ ok: false, message: r.errors[0].error });
    return res.status(200).json({ ok: false, message: 'Person not found in Userback' });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
}
