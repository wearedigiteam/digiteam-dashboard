import { getTokenFromRequest, verifyToken } from '../../lib/auth';
import { fetchAllProjects, fetchProjectTasks, computeHealth, getTeamMembers } from '../../lib/userback';
import { kv } from '@vercel/kv';

const delay = ms => new Promise(r => setTimeout(r, ms));

export default async function handler(req, res) {
  const token = getTokenFromRequest(req);
  if (!token || !verifyToken(token)) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  try {
    // Auto-discover projects and fetch budget config
    const [projects, budgets] = await Promise.all([
      fetchAllProjects(),
      kv.get('budgets').catch(() => ({})),
    ]);

    // Fetch Userback data sequentially
    const results = [];
    for (const project of projects) {
      const data = await fetchProjectTasks(project.id);
      const health = computeHealth(data);
      const budget = (budgets || {})[project.id] || null;

      results.push({
        name: project.name,
        userbackId: project.id,
        health,
        totalActive: data?.total || 0,
        data,
        budget,
      });

      await delay(200);
    }

    results.sort((a, b) => a.name.localeCompare(b.name));
    const teamMembers = getTeamMembers();

    return res.status(200).json({
      projects: results,
      teamMembers,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Data fetch error:', err);
    return res.status(500).json({ error: 'Failed to fetch data' });
  }
}
