import { getUser } from '../../lib/auth';
import { getMemberByEmail } from '../../lib/userback';

const USERBACK_BASE = 'https://rest.userback.io/1.0';

function getHeaders() {
  return {
    'Authorization': `Bearer ${process.env.USERBACK_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

export default async function handler(req, res) {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorised' });

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { feedbackId, comment } = req.body;
  if (!feedbackId || !comment) {
    return res.status(400).json({ error: 'Missing feedbackId or comment' });
  }

  const prefixedComment = `[AI Suggestion]\n\n${comment}`;

  // Post as the signed-in person's Userback account; fall back to the default account
  // (DEFAULT_COMMENT_USER_ID, or Chris's) if their email isn't a Userback member.
  const member = await getMemberByEmail(user.email).catch(() => null);
  const userId = Number(member?.userId || process.env.DEFAULT_COMMENT_USER_ID || 38147);

  try {
    const response = await fetch(`${USERBACK_BASE}/feedback/comment`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        feedbackId: String(feedbackId),
        comment: prefixedComment,
        userId,
      }),
    });

    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      return res.status(200).json({ ok: true, data, postedAs: member?.name || null });
    }

    const errBody = await response.text().catch(() => '');
    return res.status(response.status).json({
      error: `Userback comment failed: ${response.status} — ${errBody.slice(0, 300)}`,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
