const SLACK_API = 'https://slack.com/api';

export async function slackCall(method, params, { get = false } = {}) {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error('SLACK_BOT_TOKEN env var not set');

  const res = get
    ? await fetch(`${SLACK_API}/${method}?${new URLSearchParams(params)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    : await fetch(`${SLACK_API}/${method}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(params),
      });

  if (res.status === 429) {
    const err = new Error(`Slack ${method} failed: ratelimited`);
    err.slackError = 'ratelimited';
    err.retryAfter = Number(res.headers.get('retry-after') || 2);
    throw err;
  }
  const data = await res.json();
  if (!data.ok) {
    const err = new Error(`Slack ${method} failed: ${data.error}${data.needed ? ` (needs ${data.needed})` : ''}`);
    err.slackError = data.error;
    err.needed = data.needed || null;
    throw err;
  }
  return data;
}

// Find a Slack user ID by email. Returns null if no match.
export async function lookupSlackUserByEmail(email) {
  if (!email) return null;
  try {
    const data = await slackCall('users.lookupByEmail', { email }, { get: true });
    return data.user?.id || null;
  } catch (err) {
    if (err.message.includes('users_not_found')) return null;
    throw err;
  }
}

// Posting to a user ID delivers a DM from the app
export async function sendSlackDM(userId, text, blocks) {
  return slackCall('chat.postMessage', { channel: userId, text, blocks, unfurl_links: false });
}

// Post to a channel by ID (the app must be invited to it)
export async function postSlackMessage(channel, text, blocks) {
  return slackCall('chat.postMessage', { channel, text, blocks, unfurl_links: false });
}

// Slack mrkdwn requires &, < and > to be escaped
export function escapeSlack(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
