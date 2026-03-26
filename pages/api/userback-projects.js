import { getTokenFromRequest, verifyToken } from '../../lib/auth';
import { fetchAllProjects } from '../../lib/userback';

export default async function handler(req, res) {
  const token = getTokenFromRequest(req);
  if (!token || !verifyToken(token)) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  const projects = await fetchAllProjects();
  return res.status(200).json({ projects });
}
