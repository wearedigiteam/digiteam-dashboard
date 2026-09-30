import { getTokenFromRequest, verifyToken } from '../../lib/auth';
import { readConfig } from '../../lib/config';
import { fetchProjectTasks, computeHealth } from '../../lib/userback';

const delay = ms => new Promise(r => setTimeout(r, ms));

export default async function handler(req, res) {
  const token = getTokenFromRequest(req);
  if (!token || !verifyToken(token)) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  try {
    const [{ data: mapping }, { data: userMapping }] = await Promise.all([
      readConfig('projects.json'),
      readConfig('users.json'),
    ]);

    if (!mapping.length) {
      return res.status(200).json({
        projects: [],
        userMapping,
        fetchedAt: new Date().toISOString(),
        notice: 'No projects configured. Visit Admin to add Userback projects.',
      });
    }

    // Fetch Userback data sequentially
    const results = [];
    for (const project of mapping) {
      const data = await fetchProjectTasks(String(project.userbackId));
      const health = computeHealth(data);

      results.push({
        name: project.name,
        userbackId: project.userbackId,
        health,
        totalActive: data?.total || 0,
        data,
      });

      await delay(200);
    }

    results.sort((a, b) => a.name.localeCompare(b.name));

    return res.status(200).json({
      projects: results,
      userMapping,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Data fetch error:', err);
    return res.status(500).json({ error: 'Failed to fetch data' });
  }
}
