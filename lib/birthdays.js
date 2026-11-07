// Team birthdays: month and day only, stored in KV (never in the code — the repo is public).
import { kv } from '@vercel/kv';
const KEY = 'birthdays'; // { [email]: { name, md: 'MM-DD' } }

export async function getBirthdays() {
  const v = await kv.get(KEY).catch(() => null);
  const map = (typeof v === 'string' ? JSON.parse(v) : v) || {};
  return Object.entries(map).map(([email, b]) => ({ email, name: b.name, md: b.md })).filter(b => /^\d{2}-\d{2}$/.test(b.md || ''));
}

export async function saveBirthdays(list) {
  const map = {};
  for (const b of list || []) {
    if (!b?.email) continue;
    const md = String(b.md || '').trim();
    if (!md) continue;
    if (!/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(md)) throw new Error(`"${md}" isn't a valid month and day`);
    map[String(b.email).toLowerCase()] = { name: String(b.name || '').slice(0, 80), md };
  }
  await kv.set(KEY, JSON.stringify(map));
  return getBirthdays();
}

// For the Monday DM: "Heads up: Mike's birthday is Wednesday" (never told to the birthday person)
export function upcomingFor(list, recipientEmail, days = 7, now = new Date()) {
  const tz = { timeZone: 'America/Toronto' };
  const today = new Date(new Date(now.toLocaleString('en-US', tz)).toDateString());
  return list.filter(b => b.email.toLowerCase() !== String(recipientEmail || '').toLowerCase()).map(b => {
    const [m, d] = b.md.split('-').map(Number);
    let next = new Date(today.getFullYear(), m - 1, d);
    if (next < today) next = new Date(today.getFullYear() + 1, m - 1, d);
    return { name: b.name.split(' ')[0], inDays: Math.round((next - today) / 86400000), date: next };
  }).filter(b => b.inDays <= days).sort((a, b) => a.inDays - b.inDays);
}
