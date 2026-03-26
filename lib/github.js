import { Octokit } from '@octokit/rest';

const ORG = 'wearedigiteam';
const STALE_DAYS = 14;

let _octokit = null;
function getOctokit() {
  if (!_octokit) {
    _octokit = new Octokit({ auth: process.env.GITHUB_PAT });
  }
  return _octokit;
}

const now = () => new Date();

function daysSince(dateStr) {
  return Math.floor((now() - new Date(dateStr)) / (1000 * 60 * 60 * 24));
}

function labelNames(issue) {
  return issue.labels.map(l => l.name.toLowerCase());
}

function isBlocked(issue) {
  const labels = labelNames(issue);
  return labels.includes('blocked') || labels.includes('on hold') ||
    issue.title.toLowerCase().includes('[blocked]');
}

function isInProgress(issue) {
  const labels = labelNames(issue);
  return labels.includes('in progress') || labels.includes('wip') ||
    labels.some(l => l.includes('in-progress'));
}

function assigneeList(issue) {
  const assignees = issue.assignees?.length
    ? issue.assignees
    : issue.assignee ? [issue.assignee] : [];
  return assignees.map(a => a.login);
}

export async function fetchRepoIssues(repo) {
  if (!repo) return null;

  const octokit = getOctokit();
  const staleCutoff = new Date(now() - STALE_DAYS * 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(now() - 7 * 24 * 60 * 60 * 1000);

  try {
    let openIssues = [];
    let closedThisWeek = [];

    for await (const response of octokit.paginate.iterator(
      octokit.rest.issues.listForRepo,
      { owner: ORG, repo, state: 'open', per_page: 100 }
    )) {
      openIssues.push(...response.data.filter(i => !i.pull_request));
    }

    for await (const response of octokit.paginate.iterator(
      octokit.rest.issues.listForRepo,
      { owner: ORG, repo, state: 'closed', since: oneWeekAgo.toISOString(), per_page: 100 }
    )) {
      const closed = response.data.filter(i =>
        !i.pull_request && new Date(i.closed_at) >= oneWeekAgo
      );
      closedThisWeek.push(...closed);
      if (response.data.length &&
        new Date(response.data[response.data.length - 1].closed_at) < oneWeekAgo) break;
    }

    const mapIssue = i => ({
      id: i.number,
      title: i.title,
      url: i.html_url,
      assignees: assigneeList(i),
      updatedAt: i.updated_at,
      closedAt: i.closed_at || null,
      daysSince: daysSince(i.updated_at),
      labels: labelNames(i),
    });

    const blocked    = openIssues.filter(isBlocked).map(mapIssue);
    const inProgress = openIssues.filter(i => !isBlocked(i) && isInProgress(i)).map(mapIssue);
    const stale      = openIssues.filter(i =>
      !isBlocked(i) && !isInProgress(i) && new Date(i.updated_at) < staleCutoff
    ).map(mapIssue);
    const open       = openIssues.filter(i =>
      !isBlocked(i) && !isInProgress(i) && new Date(i.updated_at) >= staleCutoff
    ).map(mapIssue);

    return {
      repo,
      totalOpen: openIssues.length,
      blocked,
      inProgress,
      stale,
      open,
      closedThisWeek: closedThisWeek.map(mapIssue),
      error: null,
    };
  } catch (err) {
    return {
      repo,
      totalOpen: 0,
      blocked: [], inProgress: [], stale: [], open: [], closedThisWeek: [],
      error: err.message,
    };
  }
}
