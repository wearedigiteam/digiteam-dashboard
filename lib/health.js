// Daily Userback API health check. Posts to SLACK_ALERTS_CHANNEL when the API has been
// failing on two separate days, and again when it recovers. Your Userback API access isn't
// formally part of the legacy Company plan, so this is the early warning if it's switched off.
import { kv } from '@vercel/kv';
import { postSlackMessage } from './slack';

const KEY = 'health:userback';
const TIMEZONE = 'America/Toronto';
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date()); // YYYY-MM-DD

export async function probeUserback() {
  try {
    const res = await fetch('https://rest.userback.io/1.0/project?limit=1', {
      headers: { Authorization: `Bearer ${process.env.USERBACK_API_KEY}` },
    });
    if (!res.ok) {
      const body = (await res.text().catch(() => '')).slice(0, 200);
      return { ok: false, status: res.status, detail: body };
    }
    const data = await res.json().catch(() => null);
    if (!Array.isArray(data?.data)) return { ok: false, status: res.status, detail: 'Unexpected response shape' };
    return { ok: true, status: res.status };
  } catch (err) {
    return { ok: false, status: null, detail: err.message };
  }
}

function explain(status) {
  if (status === 401 || status === 403) return 'Userback is refusing the API key. The most likely cause is Userback removing API access from the legacy Company plan, or the key being revoked. Check Userback → Settings → API Token, then contact Userback.';
  if (status === 429) return 'Userback is rate-limiting the dashboard.';
  if (status >= 500) return 'Userback’s API is having problems on their end.';
  return 'The Userback API isn’t responding normally.';
}

async function alert(text) {
  const channel = process.env.SLACK_ALERTS_CHANNEL;
  if (!channel) { console.warn('SLACK_ALERTS_CHANNEL not set; alert not sent:', text); return false; }
  await postSlackMessage(channel, text);
  return true;
}

export async function checkUserbackHealth() {
  const probe = await probeUserback();
  const state = (await kv.get(KEY).catch(() => null)) || null;
  const s = typeof state === 'string' ? JSON.parse(state) : state;
  const day = today();
  const dashboardUrl = (process.env.DASHBOARD_URL || 'https://digiteam-dashboard.vercel.app').replace(/\/$/, '');

  await kv.set('health:lastCheck', JSON.stringify({ at: new Date().toISOString(), ...probe })).catch(() => {});

  if (probe.ok) {
    if (s?.alerted) {
      await alert(`✅ *Userback API is working again.* The <${dashboardUrl}/dashboard|dashboard>, Monday DMs and team scoring are back to normal.`).catch(() => {});
    }
    if (s) await kv.del(KEY).catch(() => {});
    return { ok: true };
  }

  const next = { firstFail: s?.firstFail || day, lastStatus: probe.status, alerted: Boolean(s?.alerted) };
  if (!next.alerted && next.firstFail < day) {
    const text = `⚠️ *Userback API has been failing since ${next.firstFail}*` +
      (probe.status ? ` (HTTP ${probe.status})` : '') + `. The dashboard, Monday DMs and team scoring have stalled.\n${explain(probe.status)}`;
    next.alerted = await alert(text).catch(err => { console.error('Health alert failed:', err.message); return false; });
  }
  await kv.set(KEY, JSON.stringify(next)).catch(() => {});
  return { ok: false, ...probe, firstFail: next.firstFail, alerted: next.alerted };
}

export async function sendTestAlert(byEmail) {
  const sent = await alert(`🧪 Test alert from the Digiteam dashboard${byEmail ? ` (sent by ${byEmail})` : ''}. If you can read this, Userback outage alerts will reach this channel.`);
  if (!sent) throw new Error('SLACK_ALERTS_CHANNEL isn’t set in Vercel');
}

export async function getHealthStatus() {
  const [last, state] = await Promise.all([kv.get('health:lastCheck').catch(() => null), kv.get(KEY).catch(() => null)]);
  const p = v => (typeof v === 'string' ? JSON.parse(v) : v);
  return { lastCheck: p(last), failing: p(state), alertsChannelSet: Boolean(process.env.SLACK_ALERTS_CHANNEL) };
}
