import { getTokenFromRequest, verifyToken } from '../../../lib/auth';
import { kv } from '@vercel/kv';
import { SLACK_SETTINGS_KEY } from '../../../lib/weekly-slack';

const SLACK_ID = /^[UW][A-Z0-9]{6,}$/;

export default async function handler(req, res) {
  const token = getTokenFromRequest(req);
  if (!token || !verifyToken(token)) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  if (req.method === 'GET') {
    try {
      const settings = await kv.get(SLACK_SETTINGS_KEY) || {};
      return res.status(200).json({ settings });
    } catch (err) {
      return res.status(500).json({ error: err.message, settings: {} });
    }
  }

  if (req.method === 'POST') {
    const { settings } = req.body || {};
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'settings must be an object' });
    }
    const clean = {};
    for (const [userId, s] of Object.entries(settings)) {
      const slackId = String(s?.slackId || '').trim().toUpperCase();
      if (slackId && !SLACK_ID.test(slackId)) {
        return res.status(400).json({ error: `"${slackId}" doesn't look like a Slack member ID (they start with U or W).` });
      }
      clean[userId] = { slackId, enabled: Boolean(s?.enabled) };
    }
    try {
      await kv.set(SLACK_SETTINGS_KEY, clean);
      return res.status(200).json({ ok: true, settings: clean });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
