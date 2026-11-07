// Drafts a short follow-up email to a client about tickets waiting on their review.
// The person reviews and sends it themselves; nothing is sent from here.
import { getUser } from '../../lib/auth';

const BANNED = 'meticulous, meticulously, intricate, intricately, commendable, delve, delving, ingenious, invaluable, pivotal, potent, compellingly, methodically, excellently, aptly, innovatively';

// The ticket list is always built here, never by the AI: models drop titles and
// mistype long Userback links, and a broken link in a client email is worse than none.
const waited = t => `waiting ${t.days} day${t.days === 1 ? '' : 's'}`;
const esc = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Two versions of the same email:
//   html  → titles are the links (for pasting into Gmail/Outlook)
//   plain → title then link (for email apps opened with mailto:, which can't hold links)
function assemble({ opening, closing, tickets, firstName }) {
  const plain = `Hi,\n\n${opening}\n\n${tickets.map(t => `- ${t.title} (${waited(t)}): ${t.url}`).join('\n')}\n\n${closing}\n\nThanks,\n${firstName}`;
  const html = `<p>Hi,</p><p>${esc(opening)}</p><ul>${tickets.map(t => `<li><a href="${esc(t.url)}">${esc(t.title)}</a> (${waited(t)})</li>`).join('')}</ul><p>${esc(closing)}</p><p>Thanks,<br>${esc(firstName)}</p>`;
  return { body: plain, html };
}

// Anything the AI writes is prose only. A piece that sneaks in a link is replaced with
// the standard wording rather than patched, so no half-sentences reach the client.
const hasLink = text => /https?:\/\/|www\./i.test(String(text || ''));
const proseOr = (text, standard) => (!text || hasLink(text) ? standard : String(text).trim());

function standardWording(project, tickets) {
  const one = tickets.length === 1;
  return {
    subject: `${project}: ${tickets.length} item${one ? '' : 's'} waiting on your review`,
    opening: `Just checking in on ${one ? 'an item' : 'a few items'} that ${one ? 'is' : 'are'} waiting on your review:`,
    closing: `When you get a chance, could you let us know if ${one ? 'it looks' : 'these look'} good, or if anything needs changing? If any of them are no longer needed, we can close them out.`,
  };
}

function fallbackDraft({ project, tickets, firstName }) {
  const w = standardWording(project, tickets);
  return { subject: w.subject, ...assemble({ opening: w.opening, closing: w.closing, tickets, firstName }) };
}

export default async function handler(req, res) {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorised' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { project, tickets, spelling } = req.body || {};
  if (!project || !Array.isArray(tickets) || tickets.length === 0) {
    return res.status(400).json({ error: 'Missing project or tickets' });
  }
  const clean = tickets.slice(0, 20).map(t => ({
    title: String(t.title || 'Untitled').slice(0, 160),
    url: typeof t.url === 'string' && /^https:\/\//.test(t.url) ? t.url : null,
    status: String(t.status || 'review').slice(0, 40),
    days: Number(t.days) || 0,
  })).filter(t => t.url);
  if (!clean.length) return res.status(400).json({ error: 'No ticket links to include' });

  const firstName = (user.name || user.email).split(/[\s@]/)[0];
  const us = spelling === 'us';
  const fallback = fallbackDraft({ project, tickets: clean, firstName });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(200).json({ ...fallback, ai: false });

  const prompt = `You're helping ${firstName} at Digiteam (a web development agency) write a short follow-up email to their client contact at "${project}".
${clean.length} ticket${clean.length === 1 ? ' has' : 's have'} been waiting on the client's review, the longest for ${Math.max(...clean.map(t => t.days))} days:
${clean.map(t => `- ${t.title} (${t.status})`).join('\n')}

The email's ticket list (titles and links) is inserted automatically between your opening and closing. Write only:
- "subject": a short subject line mentioning ${project}.
- "opening": 1–2 sentences leading into the list, ending with a colon.
- "closing": 1–2 sentences after the list asking them to approve each item, request changes, or say it can be closed.

Rules: friendly, professional but conversational, brief. No greeting and no sign-off (both are added). No links, no ticket titles, no list. No guilt-tripping about delays. ${us ? 'Use US spelling.' : 'Use Canadian spelling.'} Never use these words: ${BANNED}.
Return only JSON: {"subject": "...", "opening": "...", "closing": "..."}`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1200, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!r.ok) throw new Error(`Anthropic ${r.status}`);
    const data = await r.json();
    const text = (data.content || []).map(c => c.text || '').join('');
    const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    const w = standardWording(project, clean);
    const subject = proseOr(json.subject, w.subject).slice(0, 150);
    const opening = proseOr(json.opening, w.opening);
    const closing = proseOr(json.closing, w.closing);
    return res.status(200).json({ subject, ...assemble({ opening, closing, tickets: clean, firstName }), ai: true });
  } catch (err) {
    console.error('Nudge draft failed, using template:', err.message);
    return res.status(200).json({ ...fallback, ai: false });
  }
}
