// Shared by the browser and the server — keep this file free of server-only imports.

// Userback workflow names that mean "with the client for review"
export const REVIEW_STATUSES = ['for review', 'under review', 'please review'];

export function isReviewTicket(t) {
  return REVIEW_STATUSES.includes((t?.workflowName || '').trim().toLowerCase().replace(/\s+/g, ' '));
}

export const AGING_DAYS   = 30; // team tickets untouched this long need attention
export const WAITING_DAYS = 14; // review tickets this long are worth a nudge to the client

export function daysSinceUpdate(t) {
  const s = t?.updatedAt || t?.createdAt;
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d) ? null : Math.floor((Date.now() - d) / 86400000);
}

// Aging only counts work the team can act on, so review tickets are left out
export function isAgingTicket(t) {
  if (isReviewTicket(t)) return false;
  const days = daysSinceUpdate(t);
  return days !== null && days >= AGING_DAYS;
}

export function isWaitingOnClient(t) {
  if (!isReviewTicket(t)) return false;
  const days = daysSinceUpdate(t);
  return days !== null && days >= WAITING_DAYS;
}

// No owner: no assignee, or assigned to someone no longer in Userback (shows as a bare ID)
export const UNASSIGNED_DAYS = 2;
export function isUnassigned(t) {
  return !t?.assignee || /^\d+$/.test(String(t.assignee));
}
export function daysSinceCreated(t) {
  if (!t?.createdAt) return null;
  const d = new Date(t.createdAt);
  return isNaN(d) ? null : Math.floor((Date.now() - d) / 86400000);
}
export function isStaleUnassigned(t) {
  if (!isUnassigned(t)) return false;
  const days = daysSinceCreated(t);
  return days !== null && days >= UNASSIGNED_DAYS;
}
