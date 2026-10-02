import { getTokenFromRequest, verifyToken } from '../../lib/auth';

const USERBACK_BASE = 'https://rest.userback.io/1.0';

function getHeaders() {
  return {
    'Authorization': `Bearer ${process.env.USERBACK_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function tryEndpoint(label, url, method, body) {
  try {
    const opts = { method, headers: getHeaders() };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    const text = await res.text().catch(() => '');
    return { label, url, method, status: res.status, body: text.slice(0, 500) };
  } catch (err) {
    return { label, url, method, error: err.message };
  }
}

export default async function handler(req, res) {
  const token = getTokenFromRequest(req);
  if (!token || !verifyToken(token)) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  // Use a real feedback ID from the query, or a default
  const feedbackId = req.query.id || '7006913';
  const testComment = 'Test comment from API debug — please ignore';
  const d = ms => new Promise(r => setTimeout(r, ms));
  const results = [];

  // 1. POST /feedback/comment with { feedback_id, comment }
  results.push(await tryEndpoint('POST /feedback/comment {feedback_id, comment}',
    `${USERBACK_BASE}/feedback/comment`,
    'POST', { feedback_id: feedbackId, comment: testComment }));
  await d(300);

  // 2. POST /feedback/comment with { feedbackId, comment }
  results.push(await tryEndpoint('POST /feedback/comment {feedbackId, comment}',
    `${USERBACK_BASE}/feedback/comment`,
    'POST', { feedbackId: feedbackId, comment: testComment }));
  await d(300);

  // 3. POST /feedback/comment with { feedback_id, body }
  results.push(await tryEndpoint('POST /feedback/comment {feedback_id, body}',
    `${USERBACK_BASE}/feedback/comment`,
    'POST', { feedback_id: feedbackId, body: testComment }));
  await d(300);

  // 4. POST /feedback/{id}/comment with { comment }
  results.push(await tryEndpoint('POST /feedback/{id}/comment {comment}',
    `${USERBACK_BASE}/feedback/${feedbackId}/comment`,
    'POST', { comment: testComment }));
  await d(300);

  // 5. POST /feedback/{id}/comment with { body }
  results.push(await tryEndpoint('POST /feedback/{id}/comment {body}',
    `${USERBACK_BASE}/feedback/${feedbackId}/comment`,
    'POST', { body: testComment }));
  await d(300);

  // 6. POST /feedback/{id}/comments with { body }
  results.push(await tryEndpoint('POST /feedback/{id}/comments {body}',
    `${USERBACK_BASE}/feedback/${feedbackId}/comments`,
    'POST', { body: testComment }));
  await d(300);

  // 7. POST /feedback/{id}/comment with { text }
  results.push(await tryEndpoint('POST /feedback/{id}/comment {text}',
    `${USERBACK_BASE}/feedback/${feedbackId}/comment`,
    'POST', { text: testComment }));
  await d(300);

  // 8. POST /feedback/comment with { id, comment }
  results.push(await tryEndpoint('POST /feedback/comment {id, comment}',
    `${USERBACK_BASE}/feedback/comment`,
    'POST', { id: feedbackId, comment: testComment }));

  return res.status(200).json({ feedbackId, results });
}
