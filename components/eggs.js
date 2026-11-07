// Easter eggs: shared, browser-side helpers. Keep them rare and never in the way of work.
import { useEffect, useState } from 'react';

// ── Dates ─────────────────────────────────────────────────────────────────────
const md = d => (d.getMonth() + 1) * 100 + d.getDate(); // Dec 25 → 1225

// Day of the year, 1-based (Programmers' Day is day 256)
const dayOfYear = d => Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(d.getFullYear(), 0, 0)) / 86400000);
export const isProgrammersDay = (d = new Date()) => dayOfYear(d) === 256;
export const isGroundhogDay = (d = new Date()) => md(d) === 202;
export const isAprilFools = (d = new Date()) => md(d) === 401;
export const isWrappedSeason = (d = new Date()) => md(d) >= 1231 || md(d) <= 106;
export const isLateNight = (d = new Date()) => d.getHours() >= 23 || d.getHours() < 4;

export function getSeason(d = new Date()) {
  const v = md(d);
  if (v >= 1025 && v <= 1031) return 'halloween';
  if (v === 701) return 'canada-day';
  if (v >= 1201 && v <= 1224) return 'advent';
  if (v >= 1225 || v <= 106) return 'christmas';
  return null;
}
export const isSnowing = (d = new Date()) => d.getMonth() === 11;

// Digiteam was founded on Canada Day, July 1, 2020, so its first Christmas was 2020
export const FOUNDED = new Date(2020, 6, 1);
export const FIRST_CHRISTMAS = 2020;
export const companyAge = (d = new Date()) =>
  d.getFullYear() - FOUNDED.getFullYear() - (md(d) < 701 ? 1 : 0);

// "If we're still doing this by Christmas..." — the running joke
export function christmasInfo(d = new Date()) {
  const first = FIRST_CHRISTMAS;
  // Dec 25–Jan 6 belongs to the Christmas just passed
  const year = d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear();
  const passed = d.getMonth() === 0 || md(d) >= 1225;
  const nextXmas = new Date(passed ? year + 1 : year, 11, 25);
  const today = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const daysUntil = Math.round((nextXmas - today) / 86400000);
  const number = Number.isFinite(first) ? year - first + 1 : null;     // the Christmas just reached
  const upcoming = Number.isFinite(first) ? nextXmas.getFullYear() - first + 1 : null;
  return { year, passed, daysUntil, number, upcoming };
}
const ordinalLabel = n => (n ? `Christmas #${n}` : 'Christmas');

// Friday after 3 pm, Toronto time
export function isFridayAfternoon(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', weekday: 'short', hour: '2-digit', hourCycle: 'h23' })
    .formatToParts(d).map(x => [x.type, x.value]));
  return p.weekday === 'Fri' && parseInt(p.hour, 10) >= 15;
}

// ── Fossils ───────────────────────────────────────────────────────────────────
export function fossilEra(createdAt, now = new Date()) {
  if (!createdAt) return null;
  const c = new Date(createdAt);
  const years = (now - c) / (365.25 * 86400000);
  if (!(years >= 1)) return null;
  const era = years >= 3 ? 'the Triassic' : years >= 2 ? 'the Jurassic' : 'the late Cretaceous';
  const when = c.toLocaleString('en-CA', { month: 'long', year: 'numeric' });
  return `Discovered in ${era} (${when})`;
}

// ── Bruno's opinions (hidden replies in the Ask Bruno box) ────────────────────────────────────────────────
const JOKES = [
  'There are 10 kinds of people: those who understand binary and those who don’t.',
  'A QA engineer walks into a bar. Orders 1 beer. Orders 0 beers. Orders 99999 beers. Orders −1 beers. Orders a lizard. The first real customer asks where the washroom is, and the bar catches fire.',
  'Why do developers prefer dark mode? Light attracts bugs. (Good news: there’s a toggle up top.)',
  'I’d tell you a UDP joke, but you might not get it.',
  '“It works on my machine.” — the first comment on every ticket, ever.',
  'A client asks for “just a small change.” The sprint gasps.',
  'The two hardest problems in computing: cache invalidation, naming things and off-by-one errors.',
];

export function brunoReply(question, { birthdayToday = null } = {}) {
  const raw = question.trim().toLowerCase();
  const q = raw.replace(/[’']/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const p = text => `<p>${text}</p>`;
  if (/^sudo make me a sandwich/.test(q)) return p('Okay. 🥪');
  if (/^sudo\b/.test(q)) return p('Nice try.');
  if (/wrapped|year in review/.test(q)) return { action: 'wrapped', html: p('Pulling up the year in review…') };
  if (/tell me a joke|got any jokes|make me laugh/.test(q)) {
    return p(JOKES[Math.floor(Math.random() * JOKES.length)]);
  }
  if (/who(s| is) the best (dev|developer|programmer)/.test(q)) {
    return p('It’s a team sport. Next question.');
  }
  if (/deploy(ing)? (on|this) friday|friday deploy/.test(q)) {
    return p('Absolutely not. Ask me again on Monday.');
  }
  if (/still doing this/.test(q)) {
    const x = christmasInfo();
    return x.passed
      ? p(`${ordinalLabel(x.number)} came and went. Verdict: <strong>still doing this.</strong>`)
      : p(`Checking the books… ${ordinalLabel(x.upcoming)} is ${x.daysUntil} day${x.daysUntil === 1 ? '' : 's'} away. Early indications: <strong>still doing this.</strong>`);
  }
  if (/^(hi|hello|hey) bruno|who are you bruno|^who are you$/.test(q)) {
    let hello = 'I’m Bruno. I read tickets so you don’t have to.';
    if (isProgrammersDay()) hello += ' Also: happy Programmers’ Day. 0x100 days in, still compiling.';
    if (birthdayToday) hello += ` And it’s ${birthdayToday}’s birthday today. 🎂`;
    return p(hello);
  }
  return null;
}

// ── Toasts ────────────────────────────────────────────────────────────────────
const toastListeners = new Set();
export function showToast(message, ms = 4000, { bruno = false, action = null } = {}) {
  toastListeners.forEach(fn => fn({ message, ms, id: Date.now(), bruno, action }));
}
export function useToast() {
  const [toast, setToast] = useState(null);
  useEffect(() => {
    let timer;
    const fn = t => { setToast(t); clearTimeout(timer); timer = setTimeout(() => setToast(null), t.ms); };
    toastListeners.add(fn);
    return () => { toastListeners.delete(fn); clearTimeout(timer); };
  }, []);
  return toast;
}

// ── Arcade mode (Konami code) ────────────────────────────────────────────────
const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
const arcadeListeners = new Set();

function setArcade(on) {
  const html = document.documentElement;
  if (on) {
    html.dataset.arcade = 'on';
    if (!document.getElementById('dt-arcade-font')) {
      const link = document.createElement('link');
      link.id = 'dt-arcade-font'; link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap';
      document.head.appendChild(link);
    }
  } else {
    delete html.dataset.arcade;
  }
  try { sessionStorage.setItem('dt_arcade', on ? '1' : '0'); } catch {}
  arcadeListeners.forEach(fn => fn(on));
}

export function useKonami() {
  useEffect(() => {
    try { if (sessionStorage.getItem('dt_arcade') === '1') setArcade(true); } catch {}
    let pos = 0;
    const onKey = e => {
      const k = (e.key || '').toLowerCase();
      pos = k === KONAMI[pos] ? pos + 1 : (k === KONAMI[0] ? 1 : 0);
      if (pos === KONAMI.length) {
        pos = 0;
        const on = document.documentElement.dataset.arcade !== 'on';
        setArcade(on);
        showToast(on ? 'ARCADE MODE ON. Enter the code again to exit.' : 'Arcade mode off. Back to work.');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export function useArcade() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(document.documentElement.dataset.arcade === 'on');
    arcadeListeners.add(setOn);
    return () => arcadeListeners.delete(setOn);
  }, []);
  return on;
}

// ── Once-per-person eggs (server remembers who has seen what) ────────────────
export async function claimEgg(kind) {
  try {
    const r = await fetch('/api/eggs/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind }) });
    if (!r.ok) return false;
    return (await r.json()).first === true;
  } catch { return false; }
}


// ── Birthdays (entered on Admin; month and day only) ─────────────────────────
// Returns { today: [names], upcoming: [{ name, inDays }] } for the 7 days before each birthday.
// The person whose birthday it is never sees their own countdown.
export function birthdayStatus(list, myEmail, d = new Date()) {
  const today = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const out = { today: [], upcoming: [], mine: false };
  for (const b of list || []) {
    const [m, day] = String(b.md || '').split('-').map(Number);
    if (!m || !day) continue;
    let next = new Date(today.getFullYear(), m - 1, day);
    if (next < today) next = new Date(today.getFullYear() + 1, m - 1, day);
    const inDays = Math.round((next - today) / 86400000);
    const isMe = myEmail && b.email && b.email.toLowerCase() === myEmail.toLowerCase();
    const first = String(b.name || '').split(' ')[0];
    if (inDays === 0) { out.today.push(first); if (isMe) out.mine = true; }
    else if (inDays <= 7 && !isMe) out.upcoming.push({ name: first, inDays });
  }
  out.upcoming.sort((a, b) => a.inDays - b.inDays);
  return out;
}
