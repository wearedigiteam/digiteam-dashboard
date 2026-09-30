import { getTokenFromRequest, verifyToken } from '../../lib/auth';
import { fetchAllProjects, fetchProjectTasks, computeHealth, getTeamMembers } from '../../lib/userback';

const delay = ms => new Promise(r => setTimeout(r, ms));

export default async function handler(req, res) {
  const token = getTokenFromRequest(req);
  if (!token || !verifyToken(token)) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  try {
    // Auto-discover all non-archived Userback projects
    const projects = await fetchAllProjects();

    // Fetch data for each project sequentially
    const results = [];
    for (const project of projects) {
      const data = await fetchProjectTasks(project.id);
      const health = computeHealth(data);

      results.push({
        name: project.name,
        userbackId: project.id,
        health,
        totalActive: data?.total || 0,
        data,
      });

      await delay(200);
    }

    // Sort alphabetically
    results.sort((a, b) => a.name.localeCompare(b.name));

    // Team members (auto-populated from Userback)
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
