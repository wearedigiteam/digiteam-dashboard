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

// ── Auto-compute project health from live data ──────────────────────────────
//
// Status priority (highest wins):
//
//   BLOCKED   — GitHub issues labelled "blocked" OR Userback tickets "on hold"
//   STALE     — Has open items but NO recent activity: no items updated in
//               the last 14 days AND no issues closed / tickets resolved
//               in the last 7 days
//   IN FLIGHT — Active work across BOTH GitHub AND Userback simultaneously
//   ACTIVE    — Has open items OR recent closures/resolutions in at least
//               one source
//   CLEAR     — No open items and no recent activity in either source
//
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

  // 1. Blocked: any blocked GitHub issues or on-hold Userback tickets
  if (ghBlocked > 0 || ubOnHold > 0) return 'blocked';

  // 2. Check for recent activity signals
  //    "Recent" = items updated within 14 days (github.open + github.inProgress)
  //              OR items closed/resolved within 7 days
  const ghHasRecentWork = (ghInProgress + ghOpen) > 0 || ghClosedRecently > 0;
  const ubHasRecentWork = ubInProgress > 0 || ubResolvedRecently > 0;
  const anyRecentWork   = ghHasRecentWork || ubHasRecentWork;

  // 3. Stale: has open items but NO recent work anywhere
  if (totalOpen > 0 && !anyRecentWork) return 'stale';

  // 4. In Flight: recent work across BOTH GitHub AND Userback
  if (ghHasRecentWork && ubHasRecentWork) return 'inflight';

  // 5. Active: has open items OR recent closures in at least one source
  if (totalOpen > 0 || anyRecentWork) return 'active';

  // 6. Clear: nothing open, no recent activity
  return 'clear';
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