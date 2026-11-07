// Monthly client status report: what got done, what's waiting on the client, what's next.
// Written for the client: no assignees, no internal jokes, every ticket linked to Userback.
import { kv } from '@vercel/kv';
import { fetchProjectHistory } from './userback';
import { isReviewTicket } from './statuses';

const TZ = 'America/Toronto';
const BANNED = 'meticulous, meticulously, intricate, intricately, commendable, delve, delving, ingenious, invaluable, pivotal, potent, compellingly, methodically, excellently, aptly, innovatively';
const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const money = n => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Number(n) || 0);

// Month boundaries in Toronto time, as UTC instants
function monthWindow(ym) {
  const [y, m] = ym.split('-').map(Number);
  // Hours Toronto is behind UTC on the 1st (5 in winter, 4 in summer), whatever the server's own time zone
  const offset = (yy, mm) => {
    const name = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'shortOffset' })
      .formatToParts(new Date(Date.UTC(yy, mm - 1, 1, 12))).find(x => x.type === 'timeZoneName')?.value || 'GMT-5';
    return -parseInt(name.replace('GMT', '') || '0', 10);
  };
  const start = new Date(Date.UTC(y, m - 1, 1, offset(y, m)));
  const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;
  const end = new Date(Date.UTC(ny, nm - 1, 1, offset(ny, nm)));
  const label = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('en-CA', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return { start, end, label };
}

const daysSince = iso => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso)) / 86400000)) : null);
const byPriority = (a, b) => (b.priorityLevel || 0) - (a.priorityLevel || 0) || new Date(a.createdAt) - new Date(b.createdAt);

function section(title, items, line) {
  if (!items.length) return { html: '', plain: '' };
  return {
    html: `<h3>${esc(title)} (${items.length})</h3><ul>${items.map(t => `<li><a href="${esc(t.url)}">${esc(t.title)}</a>${line(t) ? ` (${esc(line(t))})` : ''}</li>`).join('')}</ul>`,
    plain: `${title} (${items.length})\n${items.map(t => `- ${t.title}${line(t) ? ` (${line(t)})` : ''}: ${t.url}`).join('\n')}`,
  };
}

async function brunoSummary({ project, label, counts, completedTitles, spelling }) {
  const one = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const fallback = `In ${label}, we completed ${one(counts.completed, 'item')} for ${project}. ` +
    `${counts.waiting ? `${one(counts.waiting, 'item')} ${counts.waiting === 1 ? 'is' : 'are'} ready for your review, ` : ''}` +
    `${one(counts.inProgress, 'item')} ${counts.inProgress === 1 ? 'is' : 'are'} in progress, and ${counts.open} ${counts.open === 1 ? 'is' : 'are'} queued up next.`;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { text: fallback, ai: false };
  const prompt = `Write a 2–3 sentence overview for a monthly website status meeting between Digiteam (a web development agency) and its client "${project}", covering ${label}.
Facts (use only these, never invent):
- Completed this month: ${counts.completed}${completedTitles.length ? ` — e.g. ${completedTitles.slice(0, 8).join('; ')}` : ''}
- Ready for the client's review: ${counts.waiting}
- In progress: ${counts.inProgress}
- On hold: ${counts.onHold}
- Queued up next: ${counts.open}
Tone: professional but conversational, plain, no hype, no filler. ${spelling === 'us' ? 'Use US spelling.' : 'Use Canadian spelling.'} Never use these words: ${BANNED}. No links, no lists, no greeting.
Return only JSON: {"summary": "..."}`;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 400, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!r.ok) throw new Error(`Anthropic ${r.status}`);
    const d = await r.json();
    const text = (d.content || []).map(c => c.text || '').join('');
    const s = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)).summary;
    if (!s || /https?:\/\//.test(s)) throw new Error('Unusable summary');
    return { text: String(s).trim(), ai: true };
  } catch (err) {
    console.error('Report summary fell back to template:', err.message);
    return { text: fallback, ai: false };
  }
}

export async function buildMonthlyReport({ projectId, projectName, month, spelling = 'ca', includeBudget = true }) {
  const { start, end, label } = monthWindow(month);
  const items = await fetchProjectHistory(projectId, start.toISOString());
  const inMonth = t => t.updatedAt && new Date(t.updatedAt) >= start && new Date(t.updatedAt) < end;

  const completed = items.filter(t => t.category === 'resolved' && inMonth(t)).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  const active = items.filter(t => t.category !== 'resolved');
  const waiting = active.filter(isReviewTicket).map(t => ({ ...t, _days: daysSince(t.updatedAt) })).sort((a, b) => b._days - a._days);
  const inProgress = active.filter(t => !isReviewTicket(t) && t.category === 'inProgress');
  const onHold = active.filter(t => !isReviewTicket(t) && t.category === 'onHold');
  const open = active.filter(t => !isReviewTicket(t) && t.category === 'open').sort(byPriority);
  const counts = { completed: completed.length, waiting: waiting.length, inProgress: inProgress.length, onHold: onHold.length, open: open.length };

  let budget = null;
  if (includeBudget) {
    const all = await kv.get('budgets').catch(() => null);
    const b = (typeof all === 'string' ? JSON.parse(all) : all || {})[projectId];
    if (b?.annual > 0) {
      const used = Number(b.used) || 0;
      budget = { annual: Number(b.annual), used, remaining: Number(b.annual) - used, pctUsed: Math.round((used / b.annual) * 100) };
    }
  }

  const summary = await brunoSummary({ project: projectName, label, counts, completedTitles: completed.map(t => t.title), spelling });

  const fmtDay = iso => new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: TZ });
  const parts = [
    section(`Completed in ${label}`, completed, t => `completed ${fmtDay(t.updatedAt)}`),
    section('Ready for your review', waiting, t => `waiting ${t._days} day${t._days === 1 ? '' : 's'}`),
    section('In progress', inProgress, () => ''),
    section('On hold', onHold, () => ''),
    section('Up next', open.slice(0, 10), t => (t.priorityLevel >= 3 ? 'high priority' : '')),
  ];
  const moreOpen = open.length > 10 ? `Plus ${open.length - 10} more queued.` : '';
  const budgetHtml = budget
    ? `<h3>Maintenance budget</h3><p>${money(budget.used)} of ${money(budget.annual)} used (${budget.pctUsed}%), ${budget.remaining >= 0 ? `${money(budget.remaining)} remaining` : `${money(-budget.remaining)} over`}. Amounts exclude HST.</p>`
    : '';
  const budgetPlain = budget
    ? `Maintenance budget\n${money(budget.used)} of ${money(budget.annual)} used (${budget.pctUsed}%), ${budget.remaining >= 0 ? `${money(budget.remaining)} remaining` : `${money(-budget.remaining)} over`}. Amounts exclude HST.`
    : '';

  const html = `<h2>${esc(projectName)}: ${esc(label)} status</h2><p>${esc(summary.text)}</p>` +
    parts.map(p => p.html).join('') + (moreOpen ? `<p>${esc(moreOpen)}</p>` : '') + budgetHtml;
  const plain = [`${projectName}: ${label} status`, summary.text, ...parts.map(p => p.plain), moreOpen, budgetPlain].filter(Boolean).join('\n\n');

  return { project: projectName, month, label, counts, budget, summaryAi: summary.ai, html, plain };
}
