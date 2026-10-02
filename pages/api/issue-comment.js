import { getTokenFromRequest, verifyToken } from '../../lib/auth';

const USERBACK_BASE = 'https://rest.userback.io/1.0';

function getHeaders() {
  return {
    'Authorization': `Bearer ${process.env.USERBACK_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

export default async function handler(req, res) {
  const token = getTokenFromRequest(req);
  if (!token || !verifyToken(token)) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { feedbackId, comment } = req.body;
  if (!feedbackId || !comment) {
    return res.status(400).json({ error: 'Missing feedbackId or comment' });
  }

  const prefixedComment = `[AI Suggestion]\n\n${comment}`;

  try {
    const response = await fetch(`${USERBACK_BASE}/feedback/comment`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        feedbackId: String(feedbackId),
        comment: prefixedComment,
        userId: 38527,
      }),
    });

    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      return res.status(200).json({ ok: true, data });
    }

    const errBody = await response.text().catch(() => '');
    return res.status(response.status).json({
      error: `Userback comment failed: ${response.status} — ${errBody.slice(0, 300)}`,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
