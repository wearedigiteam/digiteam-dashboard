// Shared logic for the Monday Slack summary. Used by the cron route and the Admin "Send test" button.
import { kv } from '@vercel/kv';
import { fetchAllProjects, fetchProjectTasks, getTeamMembers } from './userback';
import { lookupSlackUserByEmail, sendSlackDM, escapeSlack } from './slack';

export const SLACK_SETTINGS_KEY = 'slackSettings'; // { [userbackUserId]: { slackId, enabled } }

const AGING_DAYS    = 30;
const MAX_ATTENTION = 5;
const delay = ms => new Promise(r => setTimeout(r, ms));

function daysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return Math.floor((Date.now() - d) / 86400000);
}

// Let KV errors surface instead of looking like "no settings saved"
export async function getSlackSettings() {
  const value = await kv.get(SLACK_SETTINGS_KEY);
  if (!value) return {};
  return typeof value === 'string' ? JSON.parse(value) : value;
}

export function buildMessage(member, items, dashboardBase) {
  const firstName  = member.name.split(' ')[0];
  const inProgress = items.filter(i => i.category === 'inProgress').length;
  const onHold     = items.filter(i => i.category === 'onHold').length;
  const open       = items.filter(i => i.category === 'open').length;
  const aging      = items.filter(i => i.days !== null && i.days >= AGING_DAYS).length;

  // On hold first, then oldest without an update, then high/critical priority
  const attention = items
    .filter(i => i.category === 'onHold' || (i.days !== null && i.days >= AGING_DAYS) || i.priorityLevel >= 3)
    .sort((a, b) =>
      (b.category === 'onHold') - (a.category === 'onHold') ||
      (b.days || 0) - (a.days || 0) ||
      b.priorityLevel - a.priorityLevel)
    .slice(0, MAX_ATTENTION);

  const queueUrl = `${dashboardBase}/dashboard?team=${encodeURIComponent(member.name).replace(/%20/g, '+')}`;

  const summary =
    `*${items.length} active*: ${inProgress} in progress, ${onHold} on hold, ${open} open.` +
    (aging > 0 ? ` *${aging} aging* (${AGING_DAYS}+ days without an update).` : '');

  const attentionText = attention.length
    ? '*Needs attention*\n' + attention.map(i => {
        const notes = [i.projectName];
        if (i.category === 'onHold') notes.push('on hold');
        if (i.priorityLevel >= 3) notes.push(i.priority.toLowerCase());
        if (i.days !== null) notes.push(`${i.days} days`);
        return `• <${i.url}|${escapeSlack(String(i.title || '').slice(0, 90))}> (${escapeSlack(notes.join(', '))})`;
      }).join('\n')
    : 'Nothing on hold, aging or high priority.';

  const intro = `Morning ${firstName}. Here's your Userback queue ahead of today's production meeting.`;

  return {
    text: `${intro} ${items.length} active, ${aging} aging.`,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: `${intro}\n\n${summary}` } },
      { type: 'section', text: { type: 'mrkdwn', text: attentionText } },
      { type: 'section', text: { type: 'mrkdwn', text: `<${queueUrl}|Open your queue on the dashboard>` } },
    ],
  };
}

// Builds and (unless dryRun) sends the summaries.
//   onlyUserId      — limit to one Userback member (used by tests)
//   isTest          — send even if that person isn't switched on, and even if they have no items
//   overrideSlackId — use this Slack ID instead of the saved one (the test button sends what's on screen)
export async function runWeeklySlack({ onlyUserId = null, isTest = false, dryRun = false, overrideSlackId = null } = {}) {
  const settings = await getSlackSettings();

  // Gather every active item across projects, grouped by assignee userId
  const projects = await fetchAllProjects();
  const byAssignee = {};
  for (const project of projects) {
    const data = await fetchProjectTasks(project.id);
    const active = [...(data?.inProgress || []), ...(data?.onHold || []), ...(data?.open || [])];
    for (const item of active) {
      if (!item.assigneeId) continue;
      (byAssignee[item.assigneeId] ||= []).push({
        ...item,
        projectName: project.name,
        days: daysSince(item.updatedAt || item.createdAt),
      });
    }
    await delay(200);
  }

  const dashboardBase = (process.env.DASHBOARD_URL || 'https://digiteam-dashboard.vercel.app').replace(/\/$/, '');

  let members = getTeamMembers();
  if (onlyUserId) members = members.filter(m => m.userId === String(onlyUserId));
  else            members = members.filter(m => settings[m.userId]?.enabled);

  const results = { sent: [], noItems: [], noSlackUser: [], errors: [], preview: [] };

  for (const member of members) {
    const items = byAssignee[member.userId] || [];
    if (items.length === 0 && !isTest) { results.noItems.push(member.name); continue; }

    const message = items.length
      ? buildMessage(member, items, dashboardBase)
      : {
          text: `Test from the Digiteam dashboard: you have no active Userback items right now.`,
          blocks: [{ type: 'section', text: { type: 'mrkdwn', text:
            `Test from the Digiteam dashboard. You have no active Userback items right now, so on a real Monday you wouldn't get a message.` } }],
        };

    if (dryRun) { results.preview.push({ name: member.name, ...message }); continue; }

    try {
      const savedId = String(settings[member.userId]?.slackId || '').trim();
      const slackId = (overrideSlackId && overrideSlackId.trim()) || savedId
        || await lookupSlackUserByEmail(member.email);
      if (!slackId) {
        results.noSlackUser.push(member.name);
        results.detail = member.email
          ? `No member ID entered, and no Slack account uses ${member.email}.`
          : 'No member ID entered, and this person has no email in Userback.';
        continue;
      }
      await sendSlackDM(slackId, message.text, message.blocks);
      results.sent.push(member.name);
    } catch (err) {
      results.errors.push({ name: member.name, error: err.message });
    }
  }

  return results;
}
