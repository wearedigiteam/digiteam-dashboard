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
    // Try the most likely endpoint format
    const endpoints = [
      { url: `${USERBACK_BASE}/feedback/${feedbackId}/comment`, body: { comment: prefixedComment } },
      { url: `${USERBACK_BASE}/feedback/${feedbackId}/comment`, body: { body: prefixedComment } },
      { url: `${USERBACK_BASE}/feedback/${feedbackId}/comments`, body: { body: prefixedComment } },
      { url: `${USERBACK_BASE}/feedback/comment`, body: { feedback_id: feedbackId, comment: prefixedComment } },
      { url: `${USERBACK_BASE}/feedback/comment`, body: { feedbackId: feedbackId, body: prefixedComment } },
    ];

    for (const endpoint of endpoints) {
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(endpoint.body),
      });

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        return res.status(200).json({ ok: true, data });
      }

      // If 404 or 405, try next endpoint
      if (response.status === 404 || response.status === 405) continue;

      // If 422 (validation), try next endpoint with different body
      if (response.status === 422) continue;

      // Any other error, report it
      const errBody = await response.text().catch(() => '');
      return res.status(response.status).json({
        error: `Userback comment failed: ${response.status} — ${errBody.slice(0, 300)}`,
        attemptedUrl: endpoint.url,
      });
    }

    // None of the endpoints worked
    return res.status(500).json({
      error: 'Could not find a working Userback comment endpoint. The comment was not posted.',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
