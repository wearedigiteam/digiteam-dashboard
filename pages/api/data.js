import { getTokenFromRequest, verifyToken } from '../../lib/auth';
import { fetchRepoIssues } from '../../lib/github';
import { fetchProjectTasks } from '../../lib/userback';

const ORG    = 'wearedigiteam';
const REPO   = 'digiteam-dashboard';
const BRANCH = 'main';
const PATH   = 'mapping.json';

async function getMapping() {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${ORG}/${REPO}/contents/${PATH}?ref=${BRANCH}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.GITHUB_PAT}`,
          'Accept': 'application/vnd.github.v3+json',
        }
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
  } catch {
    return [];
  }
}

export default async function handler(req, res) {
  const token = getTokenFromRequest(req);
  if (!token || !verifyToken(token)) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  try {
    const mapping = await getMapping();

    if (!mapping.length) {
      return res.status(200).json({
        projects: [],
        fetchedAt: new Date().toISOString(),
        notice: 'No projects configured. Visit /admin to set up your project mapping.',
      });
    }

    const results = await Promise.all(
      mapping.map(async project => {
        const [github, userback] = await Promise.all([
          project.githubRepo ? fetchRepoIssues(project.githubRepo) : null,
          project.userbackId ? fetchProjectTasks(String(project.userbackId)) : null,
        ]);

        const ghBlocked    = github?.blocked?.length || 0;
        const ghStale      = github?.stale?.length || 0;
        const ghInProgress = github?.inProgress?.length || 0;
        const ghOpen       = github?.open?.length || 0;
        const ubOpen       = userback?.open?.length || 0;
        const ubInProgress = userback?.inProgress?.length || 0;
        const ubOnHold     = userback?.onHold?.length || 0;

        const totalActive = ghBlocked + ghInProgress + ghStale + ghOpen +
                            ubOpen + ubInProgress + ubOnHold;
        const health = ghBlocked > 0   ? 'blocked'
                     : ghStale > 0     ? 'stale'
                     : totalActive > 0 ? 'active'
                     : 'clear';

        return { name: project.name, health, totalActive, github, userback };
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