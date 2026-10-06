// Monday-morning Slack DM: each person switched on in Admin gets a summary of their own Userback queue.
//
// Triggered by Vercel Cron (see vercel.json). Two schedules exist (12:00 and 13:00 UTC)
// so it lands at the right local hour in both EDT and EST; the hour check below lets
// only one of them send. A KV flag stops a second send on the same day.
// Use the "Send test" buttons on the Admin tab to try it on one person.

import { kv } from '@vercel/kv';
import { runWeeklySlack } from '../../../lib/weekly-slack';

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

  if (now.hour !== sendHour) {
    return res.status(200).json({ skipped: `Toronto hour is ${now.hour}, sending at ${sendHour}` });
  }
  if (await kv.get(sentKey).catch(() => null)) {
    return res.status(200).json({ skipped: 'Already sent today' });
  }

  const results = await runWeeklySlack();
  if (results.sent.length > 0) {
    await kv.set(sentKey, new Date().toISOString(), { ex: 60 * 60 * 24 * 7 }).catch(() => {});
  }
  return res.status(200).json(results);
}
