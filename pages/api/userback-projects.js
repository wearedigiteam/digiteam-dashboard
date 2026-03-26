import { getTokenFromRequest, verifyToken } from '../../lib/auth';

export default async function handler(req, res) {
  const token = getTokenFromRequest(req);
  if (!token || !verifyToken(token)) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  // Raw debug — returns the exact Userback API response
  try {
    const response = await fetch('https://api.userback.io/v1/projects', {
      headers: {
        'Authorization': `Bearer ${process.env.USERBACK_API_KEY}`,
        'Content-Type': 'application/json',
      }
    });

    const status = response.status;
    const text = await response.text();

    let parsed = null;
    try { parsed = JSON.parse(text); } catch {}

    return res.status(200).json({
      httpStatus: status,
      raw: text.slice(0, 2000), // first 2000 chars
      parsed,
      keyPresent: !!process.env.USERBACK_API_KEY,
      keyPrefix: process.env.USERBACK_API_KEY?.slice(0, 6),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}