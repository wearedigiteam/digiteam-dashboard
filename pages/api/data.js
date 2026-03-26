import { getTokenFromRequest, verifyToken } from '../../lib/auth';
import { fetchRepoIssues } from '../../lib/github';
import { fetchProjectTasks } from '../../lib/userback';

const ORG    = 'wearedigiteam';
const REPO   = 'digiteam-dashboard';
const BRANCH = 'main';
const PATH   = 'mapping.json';

// ── Status thresholds (days) ────────────────────────────────────────────────
const STALE_DAYS = 30;

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
//   BLOCKED   — GitHub has issues labelled "blocked" OR Userback has tickets "on hold"
//   STALE     — Has open items but nothing updated in the last 30 days across both sources
//   IN FLIGHT — Has activity across BOTH GitHub AND Userback (multi-front work)
//   ACTIVE    — Has open items in at least one source with recent updates
//   CLEAR     — No open items in either source
//
function computeHealth({ github, userback }) {
  const ghBlocked    = github?.blocked?.length    || 0;
  const ghStale      = github?.stale?.length      || 0;
  const ghInProgress = github?.inProgress?.length  || 0;
  const ghOpen       = github?.open?.length        || 0;
  const ghTotal      = ghBlocked + ghStale + ghInProgress + ghOpen;

  const ubOpen       = userback?.open?.length       || 0;
  const ubInProgress = userback?.inProgress?.length  || 0;
  const ubOnHold     = userback?.onHold?.length      || 0;
  const ubTotal      = ubOpen + ubInProgress + ubOnHold;

  const totalActive  = ghTotal + ubTotal;

  // 1. Blocked: any blocked GitHub issues or on-hold Userback tickets
  if (ghBlocked > 0 || ubOnHold > 0) return 'blocked';

  // 2. Stale: has open items but ALL are stale (no recent updates)
  if (totalActive > 0) {
    const ghAllStale = ghTotal > 0 && ghTotal === ghStale;
    const ubAllStale = ubTotal > 0 && ubTotal === ubOpen; // open but not in-progress = likely stale
    const hasGH = ghTotal > 0;
    const hasUB = ubTotal > 0;

    // Check if issue last-update dates are all beyond stale threshold
    const ghHasRecent = (ghInProgress + ghOpen) > 0;
    const ubHasRecent = ubInProgress > 0;

    if (hasGH && !ghHasRecent && hasUB && !ubHasRecent) return 'stale';
    if (hasGH && !hasUB && ghAllStale) return 'stale';
    if (hasUB && !hasGH && ubAllStale && !ubHasRecent) return 'stale';
  }

  // 3. In Flight: active on BOTH GitHub and Userback simultaneously
  const ghActive = (ghInProgress + ghOpen) > 0;
  const ubActive = (ubInProgress + ubOpen) > 0;
  if (ghActive && ubActive) return 'inflight';

  // 4. Active: has open items in at least one source
  if (totalActive > 0) return 'active';

  // 5. Clear: nothing open
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