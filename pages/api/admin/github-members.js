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

    // Fetch org members
    const members = [];
    for await (const response of octokit.paginate.iterator(
      octokit.rest.orgs.listMembers,
      { org: ORG, per_page: 100 }
    )) {
      members.push(...response.data.map(m => ({
        login: m.login,
        avatarUrl: m.avatar_url,
      })));
    }

    members.sort((a, b) => a.login.localeCompare(b.login));

    return res.status(200).json({ members });
  } catch (err) {
    return res.status(500).json({ error: err.message, members: [] });
  }
}