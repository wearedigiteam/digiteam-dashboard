import { getTokenFromRequest, verifyToken } from '../../../lib/auth';
import { readConfig, writeConfig } from '../../../lib/config';

const FILE = 'projects.json';

export default async function handler(req, res) {
  const token = getTokenFromRequest(req);
  if (!token || !verifyToken(token)) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  if (req.method === 'GET') {
    const { data } = await readConfig(FILE);
    return res.status(200).json({ mapping: data });
  }

  if (req.method === 'POST') {
    try {
      const { mapping } = req.body;
      if (!Array.isArray(mapping)) return res.status(400).json({ error: 'mapping must be an array' });
      await writeConfig(FILE, mapping);
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
