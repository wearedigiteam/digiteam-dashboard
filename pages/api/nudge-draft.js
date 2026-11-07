// Drafts a short follow-up email to a client about tickets waiting on their review.
// The person reviews and sends it themselves; nothing is sent from here.
import { getUser } from '../../lib/auth';

const BANNED = 'meticulous, meticulously, intricate, intricately, commendable, delve, delving, ingenious, invaluable, pivotal, potent, compellingly, methodically, excellently, aptly, innovatively';

function fallbackDraft({ project, tickets, firstName }) {
  const lines = tickets.map(t => `- ${t.title} (waiting ${t.days} days): ${t.url}`).join('\n');
  return {
    subject: `${project}: ${tickets.length} item${tickets.length === 1 ? '' : 's'} waiting on your review`,
    body: `Hi,\n\nJust checking in on ${tickets.length === 1 ? 'an item' : 'a few items'} that ${tickets.length === 1 ? 'is' : 'are'} waiting on your review:\n\n${lines}\n\nWhen you get a chance, could you let us know if ${tickets.length === 1 ? 'it looks' : 'these look'} good, or if anything needs changing? If any of them are no longer needed, we can close them out.\n\nThanks,\n${firstName}`,
  };
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

  const prompt = `Write a short follow-up email from ${firstName} at Digiteam (a web development agency) to their client contact at "${project}".
These tickets have been waiting on the client's review:
${clean.map(t => `- "${t.title}" (status: ${t.status}, waiting ${t.days} days) link: ${t.url}`).join('\n')}

Requirements:
- Goal: get the client to review each item, approve it, ask for changes, or say it can be closed.
- Friendly, professional but conversational, brief. No preamble, no filler, no guilt-tripping about delays.
- List every ticket with its exact link on its own line. Do not change or shorten the links.
- ${us ? 'Use US spelling.' : 'Use Canadian spelling.'}
- Never use these words: ${BANNED}.
- Start with "Hi," (the sender will add the name). Sign off with "${firstName}".
Return only JSON: {"subject": "...", "body": "..."}`;

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
    let { subject, body } = json;
    if (!subject || !body) throw new Error('Incomplete draft');
    // Make sure every ticket link made it into the email
    const missing = clean.filter(t => !body.includes(t.url));
    if (missing.length) body += `\n\n${missing.map(t => `- ${t.title}: ${t.url}`).join('\n')}`;
    return res.status(200).json({ subject, body, ai: true });
  } catch (err) {
    console.error('Nudge draft failed, using template:', err.message);
    return res.status(200).json({ ...fallback, ai: false });
  }
}
