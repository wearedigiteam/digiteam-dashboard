import { getTokenFromRequest, verifyToken } from '../../../lib/auth';
import { Octokit } from '@octokit/rest';

const ORG = 'wearedigiteam';

export default async function handler(req, res) {
  const token = getTokenFromRequest(req);
  if (!token || !verifyToken(token)) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  try {
    const octokit = new Octokit({ auth: process.env.GITHUB_PAT });
    const repos = [];

    for await (const response of octokit.paginate.iterator(
      octokit.rest.repos.listForOrg,
      { org: ORG, type: 'all', per_page: 100, sort: 'pushed' }
    )) {
      repos.push(...response.data.map(r => ({
        name: r.name,
        fullName: r.full_name,
        url: r.html_url,
        pushedAt: r.pushed_at,
        private: r.private,
      })));
    }

    // Sort alphabetically
    repos.sort((a, b) => a.name.localeCompare(b.name));

    return res.status(200).json({ repos });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}