import { getTokenFromRequest, verifyToken } from '../../../lib/auth';

const ORG    = 'wearedigiteam';
const REPO   = 'digiteam-dashboard';
const BRANCH = 'main';
const PATH   = 'user-mapping.json';

function ghHeaders() {
  return {
    'Authorization': `Bearer ${process.env.GITHUB_PAT}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };
}

async function getFileSha() {
  const res = await fetch(
    `https://api.github.com/repos/${ORG}/${REPO}/contents/${PATH}?ref=${BRANCH}`,
    { headers: ghHeaders() }
  );
  if (res.status === 404) return { sha: null, content: null };
  if (!res.ok) throw new Error(`GitHub GET failed: ${res.status}`);
  const data = await res.json();
  const content = Buffer.from(data.content, 'base64').toString('utf8');
  return { sha: data.sha, content: JSON.parse(content) };
}

export default async function handler(req, res) {
  const token = getTokenFromRequest(req);
  if (!token || !verifyToken(token)) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  // GET — return current user mapping
  if (req.method === 'GET') {
    try {
      const { content } = await getFileSha();
      return res.status(200).json({ userMapping: content || [] });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // POST — save user mapping
  if (req.method === 'POST') {
    try {
      const { userMapping } = req.body;
      if (!Array.isArray(userMapping)) {
        return res.status(400).json({ error: 'userMapping must be an array' });
      }

      const { sha } = await getFileSha();
      const content = Buffer.from(JSON.stringify(userMapping, null, 2)).toString('base64');

      const body = {
        message: 'Update user mapping via admin dashboard',
        content,
        branch: BRANCH,
        ...(sha ? { sha } : {}),
      };

      const putRes = await fetch(
        `https://api.github.com/repos/${ORG}/${REPO}/contents/${PATH}`,
        { method: 'PUT', headers: ghHeaders(), body: JSON.stringify(body) }
      );

      if (!putRes.ok) {
        const err = await putRes.text();
        throw new Error(`GitHub PUT failed: ${putRes.status} — ${err}`);
      }

      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}