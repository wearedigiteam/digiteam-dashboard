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

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing issue id' });

  try {
    // Fetch full feedback detail
    const feedbackRes = await fetch(`${USERBACK_BASE}/feedback/${id}`, {
      headers: getHeaders(),
    });
    if (!feedbackRes.ok) {
      const err = await feedbackRes.text().catch(() => '');
      return res.status(feedbackRes.status).json({
        error: `Userback feedback fetch failed: ${feedbackRes.status} — ${err.slice(0, 300)}`,
      });
    }
    const feedbackData = await feedbackRes.json();
    const feedback = feedbackData.data || feedbackData;

    // Fetch comments for this feedback
    let comments = [];
    try {
      const commentsRes = await fetch(`${USERBACK_BASE}/feedback/${id}/comment`, {
        headers: getHeaders(),
      });
      if (commentsRes.ok) {
        const commentsData = await commentsRes.json();
        comments = commentsData.data || commentsData || [];
      }
    } catch (e) {
      // Comments endpoint might not exist or have different path — non-fatal
    }

    // Also try alternate comment endpoint
    if (comments.length === 0) {
      try {
        const altRes = await fetch(`${USERBACK_BASE}/feedback/comment?filter=feedbackId eq ${id}&limit=50`, {
          headers: getHeaders(),
        });
        if (altRes.ok) {
          const altData = await altRes.json();
          comments = altData.data || altData || [];
        }
      } catch (e) { /* non-fatal */ }
    }

    return res.status(200).json({ feedback, comments });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
