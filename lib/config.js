// Config storage via GitHub API — reads/writes JSON files in the repo.
// Used only for project mapping and user mapping config, not for project data.

const ORG    = 'wearedigiteam';
const REPO   = 'digiteam-dashboard';
const BRANCH = 'main';

function ghHeaders() {
  return {
    'Authorization': `Bearer ${process.env.GITHUB_PAT}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };
}

export async function readConfig(filename) {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${ORG}/${REPO}/contents/${filename}?ref=${BRANCH}`,
      { headers: ghHeaders() }
    );
    if (res.status === 404) return { data: [], sha: null };
    if (!res.ok) throw new Error(`GitHub GET failed: ${res.status}`);
    const json = await res.json();
    const content = JSON.parse(Buffer.from(json.content, 'base64').toString('utf8'));
    return { data: content, sha: json.sha };
  } catch (err) {
    console.error(`Config read error (${filename}):`, err.message);
    return { data: [], sha: null };
  }
}

export async function writeConfig(filename, data) {
  const { sha } = await readConfig(filename);
  const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');

  const body = {
    message: `Update ${filename} via dashboard admin`,
    content,
    branch: BRANCH,
    ...(sha ? { sha } : {}),
  };

  const res = await fetch(
    `https://api.github.com/repos/${ORG}/${REPO}/contents/${filename}`,
    { method: 'PUT', headers: ghHeaders(), body: JSON.stringify(body) }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub PUT failed: ${res.status} — ${err}`);
  }

  return { ok: true };
}
