import { getTokenFromRequest, verifyToken } from '../../lib/auth';
import { fetchRepoIssues } from '../../lib/github';
import { fetchProjectTasks } from '../../lib/userback';

const ORG    = 'wearedigiteam';
const REPO   = 'digiteam-dashboard';
const BRANCH = 'main';
const PATH   = 'mapping.json';
const USER_PATH = 'user-mapping.json';

const delay = ms => new Promise(r => setTimeout(r, ms));

async function getGHFile(path) {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${ORG}/${REPO}/contents/${path}?ref=${BRANCH}`,
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

async function getMapping() { return getGHFile(PATH); }
async function getUserMapping() { return getGHFile(USER_PATH); }

function computeHealth({ github, userback }) {
  const ghBlocked    = github?.blocked?.length    || 0;
  const ghStale      = github?.stale?.length      || 0;
  const ghInProgress = github?.inProgress?.length  || 0;
  const ghOpen       = github?.open?.length        || 0;
  const ghClosedRecently = github?.closedThisWeek?.length || 0;
  const ghTotal      = ghBlocked + ghStale + ghInProgress + ghOpen;

  const ubOpen       = userback?.open?.length       || 0;
  const ubInProgress = userback?.inProgress?.length  || 0;
  const ubOnHold     = userback?.onHold?.length      || 0;
  const ubResolvedRecently = userback?.resolvedThisWeek?.length || 0;
  const ubTotal      = ubOpen + ubInProgress + ubOnHold;
  const totalOpen    = ghTotal + ubTotal;

  if (ghBlocked > 0 || ubOnHold > 0) return 'blocked';

  const ghHasRecentWork = (ghInProgress + ghOpen) > 0 || ghClosedRecently > 0;
  const ubHasRecentWork = ubInProgress > 0 || ubResolvedRecently > 0;
  const anyRecentWork   = ghHasRecentWork || ubHasRecentWork;

  if (totalOpen > 0 && !anyRecentWork) return 'stale';
  if (ghHasRecentWork && ubHasRecentWork) return 'inflight';
  if (totalOpen > 0 || anyRecentWork) return 'active';
  return 'clear';
}

export default async function handler(req, res) {
  const token = getTokenFromRequest(req);
  if (!token || !verifyToken(token)) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  try {
    const [mapping, userMappingData] = await Promise.all([
      getMapping(),
      getUserMapping(),
    ]);

    if (!mapping.length) {
      return res.status(200).json({
        projects: [],
        fetchedAt: new Date().toISOString(),
        notice: 'No projects configured. Visit /admin to set up your project mapping.',
      });
    }

    // ── GitHub: parallel (GitHub handles concurrent requests fine) ──
    const githubResults = await Promise.all(
      mapping.map(project =>
        project.githubRepo ? fetchRepoIssues(project.githubRepo) : null
      )
    );

    // ── Userback: sequential with 200ms gaps to respect rate limits ──
    // Each project = 1-2 API calls (100 items/page, sorted newest first)
    const userbackResults = [];
    for (const project of mapping) {
      if (project.userbackId) {
        const result = await fetchProjectTasks(String(project.userbackId));
        userbackResults.push(result);
        await delay(200);
      } else {
        userbackResults.push(null);
      }
    }

    // ── Combine ──
    const results = mapping.map((project, i) => {
      const github = githubResults[i];
      const userback = userbackResults[i];

      const ghTotal = github
        ? (github.blocked?.length || 0) + (github.inProgress?.length || 0) +
          (github.stale?.length || 0) + (github.open?.length || 0)
        : 0;
      const ubTotal = userback
        ? (userback.open?.length || 0) + (userback.inProgress?.length || 0) +
          (userback.onHold?.length || 0)
        : 0;

      const health = computeHealth({ github, userback });

      return {
        name: project.name,
        health,
        totalActive: ghTotal + ubTotal,
        github,
        userback,
      };
    });

    return res.status(200).json({
      projects: results,
      userMapping: userMappingData,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Data fetch error:', err);
    return res.status(500).json({ error: 'Failed to fetch data' });
  }
}