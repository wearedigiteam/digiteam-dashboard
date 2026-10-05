import { getTokenFromRequest, verifyToken } from '../../lib/auth';

export default async function handler(req, res) {
  const token = getTokenFromRequest(req);
  if (!token || !verifyToken(token)) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { question, ticketData } = req.body;
  if (!question) {
    return res.status(400).json({ error: 'No question provided' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  // Build a concise summary of the ticket data for context
  const contextLines = [];
  if (ticketData?.projects) {
    for (const p of ticketData.projects) {
      const d = p.data;
      if (!d) continue;
      const sections = [];
      if (d.inProgress?.length) sections.push(`${d.inProgress.length} in progress`);
      if (d.onHold?.length) sections.push(`${d.onHold.length} on hold`);
      if (d.open?.length) sections.push(`${d.open.length} open`);
      if (d.resolvedThisWeek?.length) sections.push(`${d.resolvedThisWeek.length} resolved this week`);

      contextLines.push(`\n## ${p.name} (${p.totalActive} active tickets — ${sections.join(', ')})`);

      const allItems = [
        ...(d.inProgress || []).map(t => ({ ...t, _section: 'In Progress' })),
        ...(d.onHold || []).map(t => ({ ...t, _section: 'On Hold' })),
        ...(d.open || []).map(t => ({ ...t, _section: 'Open' })),
      ];

      for (const t of allItems) {
        const age = t.updatedAt ? `last modified ${t.updatedAt.split('T')[0]}` : '';
        const assignee = t.assignee || 'unassigned';
        const priority = t.priority && t.priority !== 'None' ? `[${t.priority}]` : '';
        const workflow = t.workflowName || t._section;
        const type = t.feedbackType ? `(${t.feedbackType})` : '';
        const desc = t.description ? ` — ${t.description.slice(0, 120)}` : '';
        const url = t.url || '';
        contextLines.push(`- ${t.title} [URL: ${url}]${desc} | ${workflow} | ${assignee} | ${priority} ${type} | ${age}`);
      }
    }
  }

  const systemPrompt = `You are a project management assistant for Digiteam, a Canadian web development agency. You have access to their current Userback ticket data across all projects.

Your job is to help the team prioritize work, identify what to tackle next, estimate effort, and spot risks. Be direct, practical, and specific — reference actual ticket titles and project names. When suggesting what to work on, consider:
- Priority level (Critical > High > Medium > Low)
- How long the ticket has been untouched (aging tickets need attention)
- Tickets on hold that might be unblocked now
- Quick wins vs longer tasks
- Logical groupings (multiple tickets in the same project)

IMPORTANT FORMATTING RULES:
- Respond in clean HTML (no markdown). Use <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em> tags.
- When referencing a ticket, wrap the title in an <a> tag linking to its Userback URL (provided in the data as [URL: ...]). Example: <a href="https://app.userback.io/..." target="_blank">Ticket title</a>
- Use <span> tags with inline styles for priority badges: <span style="background:#c02020;color:#fff;padding:1px 6px;border-radius:3px;font-size:11px">Critical</span>
- Keep responses concise and scannable. Don't be generic.

Current ticket data:
${contextLines.join('\n')}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: question }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      return res.status(502).json({
        error: `Anthropic API returned ${response.status}: ${errBody.slice(0, 300)}`,
      });
    }

    const data = await response.json();
    const reply = data.content?.map(c => c.text || '').join('\n') || 'No response';

    return res.status(200).json({ reply });
  } catch (err) {
    console.error('Ask API error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
