// Receives Userback "Feedback status is changed" webhooks and scores the move.
// Userback doesn't sign webhooks, so the URL carries a secret:
//   https://digiteam-dashboard.vercel.app/api/webhooks/userback?key=USERBACK_WEBHOOK_SECRET
//
// The payload format isn't fully documented, so we only take the feedback ID from it
// and fetch the ticket's current state from the API. The last 20 payloads are kept in
// KV (score:webhookLog) to help if Userback ever changes the format.

import crypto from 'crypto';
import { fetchFeedbackById, fetchAllProjects } from '../../../lib/userback';
import { scoreSingleTicket, logWebhook } from '../../../lib/scoreboard';

export const config = { maxDuration: 30 };

let projectNames = null; // cached per server instance

function safeEqual(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function findFeedbackId(body) {
  const d = body?.data || {};
  const direct = d.feedback_id ?? d.feedbackId ?? d.feedback?.id ?? d.id ?? body?.feedback_id ?? body?.id;
  if (direct && /^\d+$/.test(String(direct))) return String(direct);
  // Fall back to the numeric ID in a feedback link
  for (const u of [body?.feedback_url, d.feedback_url, d.share_url, body?.url, d.url]) {
    const m = typeof u === 'string' && u.match(/(\d{4,})/g);
    if (m) return m[m.length - 1];
  }
  return null;
}

export default async function handler(req, res) {
  const secret = process.env.USERBACK_WEBHOOK_SECRET;
  if (!secret || !safeEqual(req.query.key, secret)) {
    return res.status(401).json({ error: 'Unauthorised' });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  await logWebhook(body);

  const id = findFeedbackId(body);
  if (!id) return res.status(200).json({ ok: true, skipped: 'No feedback ID in payload' });

  try {
    const item = await fetchFeedbackById(id);
    if (!projectNames) {
      projectNames = Object.fromEntries((await fetchAllProjects()).map(p => [p.id, p.name]));
    }
    const result = await scoreSingleTicket(item, projectNames[item.projectId] || null);
    return res.status(200).json({ ok: true, id, result: result || 'no change' });
  } catch (err) {
    // 200 so Userback doesn't retry endlessly; the daily check will catch it
    console.error('Userback webhook error:', err);
    return res.status(200).json({ ok: false, error: err.message });
  }
}
