// Daily cron (see vercel.json). Runs at 12:00 and 13:00 UTC so one run always lands at
// SLACK_SEND_HOUR Toronto time in both EDT and EST.
//   Monday, at the send hour → Monday Slack summary (once per day, KV flag)
//   Every other run          → Userback health check, then refresh the cached dashboard data
//                              (which also runs the scoreboard safety-net check)
// Use the "Send test" buttons on the Admin tab to try the Slack DM on one person.

import { kv } from '@vercel/kv';
import { runWeeklySlack } from '../../../lib/weekly-slack';
import { refreshDashboardData } from '../../../lib/dashboard-data';
import { checkUserbackHealth } from '../../../lib/health';
import { presortAll } from '../../../lib/slack-signal';

// Health check first; if Userback is fine, refresh the cached data (which also runs the score check)
async function runScoreCheck(startedAt) {
  const health = await checkUserbackHealth();
  let projects = null;
  if (health.ok) projects = (await refreshDashboardData({ full: true })).projects.length; // full scan refreshes the saved open tickets
  // Slack tab: sort the last day's messages so channels open instantly. Uses whatever time is left.
  let slack = null;
  try { slack = await presortAll({ deadline: startedAt + 55000 }); }
  catch (err) { console.error('Slack pre-sort failed:', err); slack = { error: err.message }; }
  return { health, projects, slack };
}

export const config = { maxDuration: 60 };

const TIMEZONE = 'America/Toronto';

function torontoParts(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', hourCycle: 'h23',
    }).formatToParts(date).map(p => [p.type, p.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: parseInt(parts.hour, 10) };
}

export default async function handler(req, res) {
  const startedAt = Date.now();
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  const now = torontoParts();
  const sendHour = parseInt(process.env.SLACK_SEND_HOUR || '8', 10);
  const sentKey = `weekly-slack:${now.date}`;

  const isMonday = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, weekday: 'short' }).format(new Date()) === 'Mon';

  if (!isMonday || now.hour !== sendHour) {
    try {
      return res.status(200).json({ scoreCheck: await runScoreCheck(startedAt) });
    } catch (err) {
      console.error('Score check failed:', err);
      return res.status(500).json({ error: err.message });
    }
  }
  if (await kv.get(sentKey).catch(() => null)) {
    return res.status(200).json({ skipped: 'Already sent today' });
  }

  let results;
  try {
    results = await runWeeklySlack();
  } catch (err) {
    console.error('Weekly Slack failed:', err);
    return res.status(500).json({ error: err.message });
  }
  if (results.sent.length > 0) {
    await kv.set(sentKey, new Date().toISOString(), { ex: 60 * 60 * 24 * 7 }).catch(() => {});
  }
  return res.status(200).json(results);
}
