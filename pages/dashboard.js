import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { getTokenFromRequest, verifyToken } from '../lib/auth';

export async function getServerSideProps({ req }) {
  const token = getTokenFromRequest(req);
  if (!token || !verifyToken(token)) {
    return { redirect: { destination: '/', permanent: false } };
  }
  return { props: {} };
}

// ── Logos ─────────────────────────────────────────────────────────────────────
function DigiteamLogo({ size = 36 }) {
  return (
    <svg width={size} height={size * 122 / 140} viewBox="0 0 140 122" xmlns="http://www.w3.org/2000/svg">
      <polygon points="19.16 38.15 0 57.31 19.16 57.31 38.32 57.31 38.32 38.15" fill="#f7ad39"/>
      <path d="M114.19,38.5c0-.12-.11-.23-.16-.35H57.48V57.31h60.46A56.45,56.45,0,0,0,114.19,38.5Z" fill="#f7ad39"/>
      <path d="M140.77,57.31H117.94c0,1.2.08,2.42.08,3.66q0,13.25-3.83,22.57a28.21,28.21,0,0,1-12.72,14.28q-8.88,5-24.21,5H57.48L76.65,122H78.3q21.44,0,35.28-7.58a47.74,47.74,0,0,0,20.56-21.25q6.71-13.68,6.71-32.15C140.85,59.73,140.81,58.52,140.77,57.31Z" fill="#f05a27"/>
      <path d="M134.14,28.83A47.74,47.74,0,0,0,113.58,7.58Q101.4.9,83.34.11C81.7,0,80,0,78.3,0H57.4l-19,19H77.26q13.06,0,21.45,3.68c1,.43,1.89.87,2.76,1.37A28.62,28.62,0,0,1,114,38.15h23.71A61.22,61.22,0,0,0,134.14,28.83Z" fill="#f05a27"/>
      <polygon points="38.32 57.31 38.32 77.33 38.32 81.49 38.32 83.63 57.48 102.79 57.48 58.17 57.48 57.31" fill="#f7ad39"/>
    </svg>
  );
}

function UserbackIcon({ size = 16 }) {
  return (
    <img src="https://images.g2crowd.com/uploads/product/image/0e598018a26f1c8abd497d33903afb39/userback.png"
      alt="Userback" width={size} height={size}
      style={{ flexShrink: 0, borderRadius: '3px', opacity: 0.8 }} />
  );
}

// ── Aging helpers ─────────────────────────────────────────────────────────────
function getDaysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return Math.floor((new Date() - d) / (1000 * 60 * 60 * 24));
}

function getAgingLevel(days) {
  if (days === null) return 'none';
  if (days >= 60) return 'critical';   // red
  if (days >= 30) return 'warning';    // orange
  if (days >= 14) return 'stale';      // yellow
  return 'ok';
}

const AGING_STYLES = {
  ok:       { bg: 'transparent', color: 'var(--muted)', label: '' },
  stale:    { bg: '#ffeb3b', color: '#6b5900', label: '' },
  warning:  { bg: '#ff9800', color: '#fff', label: '' },
  critical: { bg: '#e53935', color: '#fff', label: '' },
};

// ── Health config ────────────────────────────────────────────────────────────
const HEALTH_CONFIG = {
  blocked:  { bg: 'var(--status-blocked-bg)',  text: 'var(--status-blocked-text)',  dot: 'var(--status-blocked-dot)',  label: 'Blocked',   desc: 'Has tickets on hold' },
  stale:    { bg: 'var(--status-stale-bg)',    text: 'var(--status-stale-text)',    dot: 'var(--status-stale-dot)',    label: 'Stale',     desc: 'Open tickets but none in progress and nothing resolved recently' },
  active:   { bg: 'var(--status-active-bg)',   text: 'var(--status-active-text)',   dot: 'var(--status-active-dot)',   label: 'Active',    desc: 'Tickets in progress or recently resolved' },
  clear:    { bg: 'var(--status-clear-bg)',    text: 'var(--status-clear-text)',    dot: 'var(--status-clear-dot)',    label: 'Clear',     desc: 'No open tickets' },
};

// ── Reusable components ──────────────────────────────────────────────────────
function StatusBadge({ health }) {
  const cfg = HEALTH_CONFIG[health] || HEALTH_CONFIG.clear;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '7px',
      fontSize: '14px', fontWeight: '600', padding: '5px 14px', borderRadius: '20px',
      background: cfg.bg, color: cfg.text, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}

function PriorityBadge({ priority, color }) {
  if (!priority || priority === 'None') return null;
  return (
    <span style={{
      fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '4px',
      whiteSpace: 'nowrap', background: `${color}18`, color,
      textTransform: 'uppercase', letterSpacing: '0.3px',
    }}>{priority}</span>
  );
}

function TypeTag({ type }) {
  if (!type) return null;
  const colors = {
    bug: { bg: '#fcebeb', text: '#a32d2d' },
    task: { bg: '#e6f1fb', text: '#185fa5' },
    feature: { bg: '#e1f5ee', text: '#0f6e56' },
  };
  const c = colors[(type || '').toLowerCase()] || { bg: 'var(--surface2)', text: 'var(--muted)' };
  return (
    <span style={{ fontSize: '11px', fontWeight: '500', padding: '2px 7px', borderRadius: '4px', background: c.bg, color: c.text }}>{type}</span>
  );
}

function StatusLegend() {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  function handleToggle() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 8, left: Math.max(12, Math.min(rect.left - 160, window.innerWidth - 392)) });
    }
    setOpen(o => !o);
  }
  return (
    <span style={{ display: 'inline-block' }}>
      <button ref={btnRef} onClick={handleToggle} style={{
        background: open ? 'var(--orange)' : 'var(--surface)',
        color: open ? '#fff' : 'var(--muted)',
        border: `1px solid ${open ? 'var(--orange)' : 'var(--border2)'}`,
        borderRadius: '50%', width: '26px', height: '26px',
        fontSize: '14px', fontWeight: '600',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
      }} title="How are statuses determined?">?</button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 999 }} />
          <div style={{
            position: 'fixed', top: pos.top, left: pos.left,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '10px', padding: '20px', width: '380px', maxWidth: 'calc(100vw - 24px)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.12)', zIndex: 1000,
          }}>
            <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text)', marginBottom: '14px' }}>
              Status logic
            </div>
            {['blocked', 'stale', 'active', 'clear'].map(key => {
              const cfg = HEALTH_CONFIG[key];
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 0', borderBottom: key !== 'clear' ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: cfg.dot, flexShrink: 0, marginTop: '4px' }} />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: cfg.text }}>{cfg.label}</div>
                    <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.4 }}>{cfg.desc}</div>
                  </div>
                </div>
              );
            })}
            <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border)', fontSize: '13px', color: 'var(--muted)', lineHeight: 1.5 }}>
              <strong style={{ color: 'var(--text)' }}>Age indicators:</strong>{' '}
              <span style={{ background: '#ffeb3b', color: '#6b5900', padding: '1px 6px', borderRadius: '3px', fontSize: '12px' }}>14+ days</span>{' '}
              <span style={{ background: '#ff9800', color: '#fff', padding: '1px 6px', borderRadius: '3px', fontSize: '12px' }}>30+ days</span>{' '}
              <span style={{ background: '#e53935', color: '#fff', padding: '1px 6px', borderRadius: '3px', fontSize: '12px' }}>60+ days</span>
            </div>
          </div>
        </>
      )}
    </span>
  );
}

// ── Date formatter ───────────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  const diffDays = Math.floor((new Date() - d) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Sort: priority desc, then age desc (oldest first) ────────────────────────
function sortByUrgency(items) {
  return [...items].sort((a, b) => {
    // Priority first (higher level = more urgent)
    const pDiff = (b.priorityLevel || 0) - (a.priorityLevel || 0);
    if (pDiff !== 0) return pDiff;
    // Then by age (oldest modification first = needs attention)
    const aDate = new Date(a.updatedAt || a.createdAt || 0);
    const bDate = new Date(b.updatedAt || b.createdAt || 0);
    return aDate - bDate;
  });
}

// ── Ticket row ───────────────────────────────────────────────────────────────
const PREVIEW_COUNT = 3;

function WorkflowBadge({ name, color }) {
  if (!name) return null;
  const bgColor = color ? `${color}20` : 'var(--surface2)';
  const textColor = color || 'var(--muted)';
  return (
    <span style={{
      fontSize: '11px', fontWeight: '600', padding: '2px 7px',
      borderRadius: '4px', whiteSpace: 'nowrap',
      background: bgColor, color: textColor,
      border: `1px solid ${color ? `${color}40` : 'var(--border)'}`,
    }}>{name}</span>
  );
}

function TicketRow({ item, showProject }) {
  const lastModified = item.updatedAt || item.createdAt;
  const dateLabel = formatDate(lastModified);
  const days = getDaysSince(lastModified);
  const aging = getAgingLevel(days);
  const agingStyle = AGING_STYLES[aging];
  const rawAssignee = item.assignee || '';
  const assigneeLabel = /^\d+$/.test(rawAssignee) ? '' : rawAssignee;

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '10px',
      padding: '8px 0', borderBottom: '1px solid var(--border)',
    }}>
      {/* Thumbnail */}
      {item.thumbnail && (
        <a href={item.url || '#'} target="_blank" rel="noreferrer" style={{ flexShrink: 0 }}>
          <img
            src={item.thumbnail}
            alt=""
            style={{
              width: '48px', height: '36px',
              objectFit: 'cover', borderRadius: '4px',
              border: '1px solid var(--border)',
              background: 'var(--surface2)',
            }}
            onError={e => { e.target.style.display = 'none'; }}
          />
        </a>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {item.url ? (
            <a href={item.url} target="_blank" rel="noreferrer" style={{
              fontSize: '15px', color: 'var(--text)', lineHeight: '1.4',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              textDecoration: 'none', flex: 1, minWidth: 0,
            }} title={item.title}>{item.title}</a>
          ) : (
            <span style={{
              fontSize: '15px', color: 'var(--text)', lineHeight: '1.4',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              flex: 1, minWidth: 0,
            }} title={item.title}>{item.title}</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px', flexWrap: 'wrap' }}>
          {dateLabel && (
            <span style={{
              fontSize: '12px', fontFamily: 'var(--mono)',
              color: agingStyle.color, background: agingStyle.bg,
              padding: aging !== 'ok' ? '1px 6px' : '0',
              borderRadius: '4px', whiteSpace: 'nowrap',
            }}>{dateLabel}</span>
          )}
          <WorkflowBadge name={item.workflowName} color={item.workflowColor} />
          {showProject && item._projectName && (
            <span style={{ fontSize: '11px', color: 'var(--muted2)', background: 'var(--surface2)', padding: '1px 6px', borderRadius: '4px' }}>
              {item._projectName}
            </span>
          )}
          {assigneeLabel && <span style={{ fontSize: '12px', color: 'var(--muted2)' }}>{assigneeLabel}</span>}
          <PriorityBadge priority={item.priority} color={item.priorityColor} />
          <TypeTag type={item.feedbackType} />
        </div>
      </div>
    </div>
  );
}

// ── Ticket section ───────────────────────────────────────────────────────────
function TicketSection({ title, items, color, bgColor, showProject }) {
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState(false);
  if (!items || items.length === 0) return null;

  const sorted = sortByUrgency(items);
  const visibleItems = open ? (expanded ? sorted : sorted.slice(0, PREVIEW_COUNT)) : [];
  const hasMore = sorted.length > PREVIEW_COUNT;

  return (
    <div style={{ marginBottom: '14px' }}>
      <button onClick={() => { setOpen(o => !o); if (!open) setExpanded(false); }}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          width: '100%', background: 'none', border: 'none',
          padding: '0 0 6px 0', cursor: 'pointer',
          borderBottom: `2px solid ${color}`,
        }}>
        <span style={{ fontSize: '13px', fontWeight: '600', letterSpacing: '0.5px', textTransform: 'uppercase', color }}>{title}</span>
        <span style={{ fontSize: '13px', fontFamily: 'var(--mono)', background: bgColor || `${color}18`, color, padding: '2px 8px', borderRadius: '10px', fontWeight: '600' }}>{items.length}</span>
        <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--muted)' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ paddingTop: '4px' }}>
          {visibleItems.map((item, i) => <TicketRow key={item.id || i} item={item} showProject={showProject} />)}
          {hasMore && (
            <button onClick={() => setExpanded(e => !e)} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              width: '100%', background: 'none', border: 'none',
              padding: '8px 0 4px', cursor: 'pointer',
              fontSize: '13px', color: 'var(--orange)', fontWeight: '500',
            }}>{expanded ? '▲ Show fewer' : `▼ Show ${sorted.length - PREVIEW_COUNT} more`}</button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Needs Attention panel ────────────────────────────────────────────────────
function NeedsAttentionPanel({ projects }) {
  // Collect all active tickets across all projects, tag with project name
  const allTickets = [];
  for (const p of projects) {
    const d = p.data;
    if (!d) continue;
    const tag = item => ({ ...item, _projectName: p.name });
    (d.open || []).forEach(i => allTickets.push(tag(i)));
    (d.inProgress || []).forEach(i => allTickets.push(tag(i)));
    (d.onHold || []).forEach(i => allTickets.push(tag(i)));
  }

  // Filter to tickets aging 30+ days
  const aging = allTickets.filter(t => {
    const days = getDaysSince(t.updatedAt || t.createdAt);
    return days !== null && days >= 30;
  });

  if (aging.length === 0) return null;

  // Sort: critical aging first, then warning
  const sorted = sortByUrgency(aging);
  const critical = sorted.filter(t => getAgingLevel(getDaysSince(t.updatedAt || t.createdAt)) === 'critical');
  const warning = sorted.filter(t => getAgingLevel(getDaysSince(t.updatedAt || t.createdAt)) === 'warning');

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderLeft: '4px solid #e53935', borderRadius: '10px',
      padding: '20px', marginBottom: '20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <span style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text)' }}>
          Needs attention
        </span>
        <span style={{
          fontSize: '13px', fontFamily: 'var(--mono)', fontWeight: '600',
          background: '#e53935', color: '#fff', padding: '2px 10px', borderRadius: '10px',
        }}>{aging.length}</span>
        <span style={{ fontSize: '14px', color: 'var(--muted)' }}>
          ticket{aging.length !== 1 ? 's' : ''} untouched for 30+ days
        </span>
      </div>

      {critical.length > 0 && (
        <TicketSection title="60+ days" items={critical} color="#e53935" bgColor="#fcebeb" showProject />
      )}
      {warning.length > 0 && (
        <TicketSection title="30–59 days" items={warning} color="#e07020" bgColor="#fff3e0" showProject />
      )}
    </div>
  );
}

// ── Project card ─────────────────────────────────────────────────────────────
function ProjectCard({ project }) {
  const [expanded, setExpanded] = useState(true);
  const cfg = HEALTH_CONFIG[project.health] || HEALTH_CONFIG.clear;
  const d = project.data;

  // Count aging tickets for badge
  const allActive = [...(d?.open || []), ...(d?.inProgress || []), ...(d?.onHold || [])];
  const aging30 = allActive.filter(t => {
    const days = getDaysSince(t.updatedAt || t.createdAt);
    return days !== null && days >= 30;
  }).length;

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderLeft: `4px solid ${cfg.dot}`,
      borderRadius: '10px', marginBottom: '14px', overflow: 'hidden',
    }}>
      <button className="dt-card-header" onClick={() => setExpanded(e => !e)}
        style={{ borderBottom: expanded ? '1px solid var(--border)' : 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, textAlign: 'left' }}>
          <UserbackIcon size={16} />
          <span style={{ fontSize: '17px', fontWeight: '600', color: 'var(--text)' }}>{project.name}</span>
        </div>
        <div className="dt-card-meta">
          <span style={{
            fontSize: '13px', fontFamily: 'var(--mono)', color: 'var(--muted2)',
            background: 'var(--surface2)', padding: '3px 10px', borderRadius: '6px',
          }}>{project.totalActive} open</span>
          {aging30 > 0 && (
            <span style={{
              fontSize: '12px', fontWeight: '600',
              background: '#ff9800', color: '#fff',
              padding: '3px 10px', borderRadius: '6px',
            }}>{aging30} aging</span>
          )}
          <StatusBadge health={project.health} />
          <span style={{ fontSize: '14px', color: 'var(--muted)', marginLeft: '4px' }}>
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {expanded && d && (
        <div style={{ padding: '16px 20px' }}>
          {d.error ? (
            <div style={{ fontSize: '14px', color: 'var(--red)', fontFamily: 'var(--mono)' }}>Error: {d.error}</div>
          ) : (d.total === 0 && (!d.resolvedThisWeek || d.resolvedThisWeek.length === 0)) ? (
            <div style={{ fontSize: '15px', color: 'var(--muted)', fontStyle: 'italic' }}>No open tickets</div>
          ) : (
            <>
              <TicketSection title="In Progress" items={d.inProgress} color="var(--status-inflight-text)" bgColor="var(--status-inflight-bg)" />
              <TicketSection title="On Hold"     items={d.onHold}     color="var(--status-blocked-text)" bgColor="var(--status-blocked-bg)" />
              <TicketSection title="Open"        items={d.open}       color="var(--muted2)" />
              <TicketSection title="Resolved This Week" items={d.resolvedThisWeek} color="var(--green)" bgColor="var(--status-active-bg)" />
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const router = useRouter();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [filter, setFilter]   = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/data');
      if (res.status === 401) { router.push('/'); return; }
      if (!res.ok) throw new Error('Failed to load data');
      const json = await res.json();
      setData(json);
      setLastFetch(new Date());
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/');
  }

  // ── Team members (from Userback API directly) ──
  const teamMembers = (data?.teamMembers || []).map(m => m.name);

  // ── Assignee filtering (supports "unassigned") ──
  function filterByAssignee(project, filterValue) {
    if (!filterValue || filterValue === 'all') return project;

    const filterItems = filterValue === 'unassigned'
      ? items => (items || []).filter(item => !item.assignee || /^\d+$/.test(item.assignee))
      : items => (items || []).filter(item => item.assignee === filterValue);

    const d = project.data;
    if (!d) return null;
    const open = filterItems(d.open);
    const inProgress = filterItems(d.inProgress);
    const onHold = filterItems(d.onHold);
    const resolvedThisWeek = filterItems(d.resolvedThisWeek);
    const total = open.length + inProgress.length + onHold.length;
    if (total + resolvedThisWeek.length === 0) return null;
    return { ...project, totalActive: total, data: { ...d, open, inProgress, onHold, resolvedThisWeek, total } };
  }

  const statusCounts = {};
  data?.projects?.forEach(p => { statusCounts[p.health] = (statusCounts[p.health] || 0) + 1; });

  const filteredProjects = (data?.projects || [])
    .filter(p => filter === 'all' || p.health === filter)
    .map(p => filterByAssignee(p, assigneeFilter))
    .filter(Boolean);

  // teamMembers already defined above from API

  // ── Aging summary stats ──
  const totalAging30 = (data?.projects || []).reduce((n, p) => {
    const all = [...(p.data?.open || []), ...(p.data?.inProgress || []), ...(p.data?.onHold || [])];
    return n + all.filter(t => { const d = getDaysSince(t.updatedAt || t.createdAt); return d !== null && d >= 30; }).length;
  }, 0);

  return (
    <>
      <Head>
        <title>Digiteam Dashboard</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{ minHeight: '100vh' }}>
        <header className="dt-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <DigiteamLogo size={28} />
            <span className="dt-header-brand-text">digiteam</span>
          </div>
          <nav style={{ display: 'flex', gap: '6px', marginLeft: '24px' }}>
            <button onClick={() => router.push('/dashboard')} style={{ background: 'rgba(247,173,57,0.15)', color: '#f7ad39', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '500', padding: '6px 14px' }}>Dashboard</button>
          </nav>
          <div style={{ flex: 1 }} />
          <div className="dt-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {lastFetch && <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--mono)' }}>{lastFetch.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}</span>}
            <button onClick={fetchData} disabled={loading} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: loading ? 'rgba(255,255,255,0.3)' : '#fff', borderRadius: '6px', padding: '6px 14px', fontSize: '13px', fontWeight: '500' }}>{loading ? '⟳' : '↺ Refresh'}</button>
            <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: '13px' }}>Sign out</button>
          </div>
        </header>

        <main className="dt-main">
          <div className="dt-page-title" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h1>Userback overview</h1>
              {data && !loading && <span style={{ fontSize: '15px', color: 'var(--muted)' }}>{data.projects.length} projects</span>}
            </div>
            {lastFetch && !loading && (
              <span style={{ fontSize: '13px', color: 'var(--muted)', fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>
                Updated {lastFetch.toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          {loading && !data && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '16px' }}>
              <div style={{ width: '36px', height: '36px', border: '3px solid var(--border)', borderTopColor: 'var(--orange)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontSize: '15px', color: 'var(--muted)' }}>Fetching Userback data...</span>
            </div>
          )}

          {error && (
            <div style={{ background: 'var(--status-blocked-bg)', border: '1px solid #e24b4a33', borderRadius: '10px', padding: '18px 22px', color: 'var(--red)', fontSize: '15px', marginBottom: '20px' }}>Error: {error}</div>
          )}

          {data && (
            <>
              <div className="dt-status-strip">
                <button className="dt-status-btn" onClick={() => setFilter('all')} style={{
                  background: filter === 'all' ? 'var(--dt-navy)' : 'var(--surface)',
                  color: filter === 'all' ? '#fff' : 'var(--text)',
                  borderColor: filter === 'all' ? 'var(--dt-navy)' : 'var(--border)',
                }}>
                  <div className="dt-status-num">{data.projects.length}</div>
                  <div className="dt-status-label" style={{ color: filter === 'all' ? 'rgba(255,255,255,0.6)' : 'var(--muted)' }}>All</div>
                </button>

                {['blocked', 'stale', 'active', 'clear'].map(key => {
                  const cfg = HEALTH_CONFIG[key];
                  const count = statusCounts[key] || 0;
                  const isActive = filter === key;
                  return (
                    <button key={key} className="dt-status-btn" onClick={() => setFilter(isActive ? 'all' : key)} style={{
                      background: isActive ? cfg.bg : 'var(--surface)',
                      borderColor: isActive ? cfg.dot : 'var(--border)',
                      borderLeft: `4px solid ${cfg.dot}`, opacity: count === 0 ? 0.5 : 1,
                    }}>
                      <div className="dt-status-num" style={{ color: cfg.dot }}>{count}</div>
                      <div className="dt-status-label" style={{ color: cfg.text }}>{cfg.label}</div>
                    </button>
                  );
                })}

                {/* Aging count */}
                {totalAging30 > 0 && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0,
                    background: '#fff3e0', border: '1px solid #ff9800',
                    borderRadius: '10px', padding: '8px 14px',
                  }}>
                    <span style={{ fontSize: '18px', fontWeight: '700', color: '#e07020' }}>{totalAging30}</span>
                    <span style={{ fontSize: '11px', fontWeight: '500', color: '#e07020' }}>aging</span>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}><StatusLegend /></div>

                {teamMembers.length > 0 && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: '4px',
                    paddingLeft: '12px', borderLeft: '1px solid var(--border)',
                  }}>
                    <label style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: '500', whiteSpace: 'nowrap' }}>Team:</label>
                    <select className="dt-assignee-select" value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)} style={{ minWidth: '150px' }}>
                      <option value="all">Everyone</option>
                      <option value="unassigned">Unassigned</option>
                      {teamMembers.map(name => <option key={name} value={name}>{name}</option>)}
                    </select>
                    {assigneeFilter !== 'all' && (
                      <button onClick={() => setAssigneeFilter('all')} style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: '6px', color: 'var(--muted)', fontSize: '12px', padding: '3px 8px', cursor: 'pointer', whiteSpace: 'nowrap' }}>✕</button>
                    )}
                  </div>
                )}
              </div>

              {/* Needs Attention — aging tickets across all projects */}
              <NeedsAttentionPanel projects={filteredProjects} />

              {filteredProjects.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', color: 'var(--muted)', fontSize: '16px', background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                  No projects match this filter
                </div>
              ) : (
                filteredProjects.map(project => <ProjectCard key={project.name} project={project} />)
              )}
            </>
          )}
        </main>
      </div>
    </>
  );
}
