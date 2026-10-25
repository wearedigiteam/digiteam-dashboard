// Daily cron (see vercel.json). Runs at 12:00 and 13:00 UTC so one run always lands at
// SLACK_SEND_HOUR Toronto time in both EDT and EST.
//   Monday, at the send hour → Monday Slack summary (once per day, KV flag)
//   Every other run          → scoreboard safety-net check against the snapshot
// Use the "Send test" buttons on the Admin tab to try the Slack DM on one person.

import { kv } from '@vercel/kv';
import { runWeeklySlack } from '../../../lib/weekly-slack';
import { fetchAllProjects, fetchProjectTasks } from '../../../lib/userback';
import { reconcileFromProjects } from '../../../lib/scoreboard';

const delay = ms => new Promise(r => setTimeout(r, ms));

async function runScoreCheck() {
  const projects = await fetchAllProjects();
  const results = [];
  for (const p of projects) {
    results.push({ name: p.name, data: await fetchProjectTasks(p.id) });
    await delay(200);
  }
  return reconcileFromProjects(results);
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
      return res.status(200).json({ scoreCheck: await runScoreCheck() });
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
