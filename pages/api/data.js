import { getTokenFromRequest, verifyToken } from '../../lib/auth';
import { fetchRepoIssues } from '../../lib/github';
import { fetchProjectTasks, fetchAllProjects } from '../../lib/userback';
import PROJECTS from '../../config/projects';

export default async function handler(req, res) {
  // Auth check
  const token = getTokenFromRequest(req);
  if (!token || !verifyToken(token)) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  try {
    // Fetch all data in parallel
    const results = await Promise.all(
      PROJECTS.map(async project => {
        const [github, userback] = await Promise.all([
          project.githubRepo ? fetchRepoIssues(project.githubRepo) : null,
          project.userbackId ? fetchProjectTasks(project.userbackId) : null,
        ]);

        // Compute a single health score for the project
        const ghBlocked    = github?.blocked?.length || 0;
        const ghInProgress = github?.inProgress?.length || 0;
        const ghStale      = github?.stale?.length || 0;
        const ghOpen       = github?.open?.length || 0;
        const ubOpen       = userback?.open?.length || 0;
        const ubInProgress = userback?.inProgress?.length || 0;
        const ubOnHold     = userback?.onHold?.length || 0;

        const totalActive = ghBlocked + ghInProgress + ghStale + ghOpen +
                            ubOpen + ubInProgress + ubOnHold;
        const hasBlockers = ghBlocked > 0;
        const hasStale    = ghStale > 0;

        const health = hasBlockers ? 'blocked'
                     : hasStale    ? 'stale'
                     : totalActive > 0 ? 'active'
                     : 'clear';

        return {
          name: project.name,
          health,
          totalActive,
          github,
          userback,
        };
      })
    );

    return res.status(200).json({
      projects: results,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Data fetch error:', err);
    return res.status(500).json({ error: 'Failed to fetch data' });
  }
}
