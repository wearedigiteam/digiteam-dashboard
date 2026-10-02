import { getTokenFromRequest, verifyToken } from '../../lib/auth';

export default async function handler(req, res) {
  const token = getTokenFromRequest(req);
  if (!token || !verifyToken(token)) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { feedback, comments } = req.body;
  if (!feedback) return res.status(400).json({ error: 'No feedback data provided' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  // Build rich context from the full issue
  const lines = [];
  lines.push(`## Issue: ${feedback.title || feedback.description || 'Untitled'}`);
  if (feedback.description) lines.push(`\nDescription: ${feedback.description}`);
  if (feedback.pageUrl || feedback.url) lines.push(`Page URL: ${feedback.pageUrl || feedback.url}`);
  if (feedback.feedbackType || feedback.category) lines.push(`Type: ${feedback.feedbackType || feedback.category}`);
  if (feedback.priority) lines.push(`Priority: ${feedback.priority}`);

  const workflowName = feedback.Workflow?.name || feedback.workflowName;
  if (workflowName) lines.push(`Workflow status: ${workflowName}`);

  if (feedback.browserInfo || feedback.browser) lines.push(`Browser: ${JSON.stringify(feedback.browserInfo || feedback.browser)}`);
  if (feedback.osInfo || feedback.os) lines.push(`OS: ${JSON.stringify(feedback.osInfo || feedback.os)}`);
  if (feedback.resolution || feedback.screenSize) lines.push(`Resolution: ${feedback.resolution || feedback.screenSize}`);
  if (feedback.currentUrl || feedback.pageUrl) lines.push(`Current URL: ${feedback.currentUrl || feedback.pageUrl}`);
  if (feedback.customData) lines.push(`Custom data: ${JSON.stringify(feedback.customData)}`);
  if (feedback.consoleErrors || feedback.consoleLogs) {
    lines.push(`\nConsole errors/logs:\n${JSON.stringify(feedback.consoleErrors || feedback.consoleLogs, null, 2)}`);
  }

  // Include existing comments for context
  if (Array.isArray(comments) && comments.length > 0) {
    lines.push('\n## Existing comments:');
    for (const c of comments) {
      const author = c.author?.name || c.authorName || c.name || 'Unknown';
      const body = c.body || c.comment || c.text || c.content || '';
      const date = c.created_at || c.createdAt || c.created || '';
      lines.push(`- ${author} (${date}): ${body}`);
    }
  }

  // Determine the type of response needed
  const feedbackType = (feedback.feedbackType || feedback.category || '').toLowerCase();
  const isBug = feedbackType === 'bug' || feedbackType === 'issue';
  const isFeature = feedbackType === 'feature' || feedbackType === 'idea' || feedbackType === 'enhancement';

  let roleInstruction;
  if (isBug) {
    roleInstruction = `You are a senior web developer helping to diagnose and fix a bug. Provide a specific, actionable technical solution. Include:
- What's likely causing the issue
- Step-by-step fix instructions
- Any code snippets or configuration changes needed
- How to verify the fix works`;
  } else if (isFeature) {
    roleInstruction = `You are a senior web developer and UX consultant recommending an approach for a feature request. Provide:
- A recommended approach for implementation
- Key technical considerations
- Estimated complexity (small/medium/large)
- Any potential gotchas or dependencies`;
  } else {
    roleInstruction = `You are a senior web developer helping resolve a Userback feedback item. Based on the type of issue:
- If it's a bug: diagnose the likely cause and provide a specific fix
- If it's a feature/idea: recommend an implementation approach
- If it's a question: provide a clear answer
- If it's unclear: ask clarifying questions that should be added as a comment

Be specific, reference the actual page URL and description. Keep it practical and actionable.`;
  }

  const systemPrompt = `${roleInstruction}

This is for Digiteam, a Canadian web development agency. Their projects are typically WordPress or Sitefinity sites.

Format your response as a clear, readable comment that will be posted to the issue tracker. Start with a brief assessment, then the recommendation/solution. Don't use markdown headers — use plain text with line breaks. Keep it concise but thorough.

Issue details:
${lines.join('\n')}`;

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
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: 'Analyze this issue and provide a solution or recommended next steps.' }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      return res.status(502).json({ error: `Anthropic API returned ${response.status}: ${errBody.slice(0, 300)}` });
    }

    const data = await response.json();
    const solution = data.content?.map(c => c.text || '').join('\n') || 'No response generated';

    return res.status(200).json({ solution });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
