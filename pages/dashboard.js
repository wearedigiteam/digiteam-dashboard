import { useState, useEffect, useCallback } from 'react';
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

// ── Digiteam logo SVG ────────────────────────────────────────────────────────
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

// ── Source logos ──────────────────────────────────────────────────────────────
function GitHubIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0, opacity: 0.7 }}>
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
    </svg>
  );
}

function UserbackIcon({ size = 18 }) {
  return (
    <img
      src="https://images.g2crowd.com/uploads/product/image/0e598018a26f1c8abd497d33903afb39/userback.png"
      alt="Userback"
      width={size}
      height={size}
      style={{ flexShrink: 0, borderRadius: '3px', opacity: 0.8 }}
    />
  );
}

// ── Health config ────────────────────────────────────────────────────────────
const HEALTH_CONFIG = {
  blocked:  { bg: 'var(--status-blocked-bg)',  text: 'var(--status-blocked-text)',  dot: 'var(--status-blocked-dot)',  label: 'Blocked',   desc: 'GitHub issues labelled "blocked" or Userback tickets on hold' },
  stale:    { bg: 'var(--status-stale-bg)',    text: 'var(--status-stale-text)',    dot: 'var(--status-stale-dot)',    label: 'Stale',     desc: 'Open items exist but no recent work — nothing updated in 14+ days and no items closed or resolved in the last 7 days' },
  inflight: { bg: 'var(--status-inflight-bg)', text: 'var(--status-inflight-text)', dot: 'var(--status-inflight-dot)', label: 'In Flight', desc: 'Recent work happening across both GitHub and Userback simultaneously (including recent closures/resolutions)' },
  active:   { bg: 'var(--status-active-bg)',   text: 'var(--status-active-text)',   dot: 'var(--status-active-dot)',   label: 'Active',    desc: 'Has open items or recent closures/resolutions in at least one source' },
  clear:    { bg: 'var(--status-clear-bg)',    text: 'var(--status-clear-text)',    dot: 'var(--status-clear-dot)',    label: 'Clear',     desc: 'No open items and no recent activity in either GitHub or Userback' },
};

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ health }) {
  const cfg = HEALTH_CONFIG[health] || HEALTH_CONFIG.clear;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '7px',
      fontSize: '14px', fontWeight: '600',
      padding: '5px 14px', borderRadius: '20px',
      background: cfg.bg, color: cfg.text,
      whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: '9px', height: '9px', borderRadius: '50%',
        background: cfg.dot, flexShrink: 0,
      }} />
      {cfg.label}
    </span>
  );
}

// ── Status legend (expandable ?) ─────────────────────────────────────────────
function StatusLegend() {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: open ? 'var(--orange)' : 'var(--surface)',
          color: open ? '#fff' : 'var(--muted)',
          border: `1px solid ${open ? 'var(--orange)' : 'var(--border2)'}`,
          borderRadius: '50%', width: '26px', height: '26px',
          fontSize: '14px', fontWeight: '600',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'all 0.15s',
        }}
        title="How are statuses determined?"
      >
        ?
      </button>
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 99 }}
          />
          <div style={{
            position: 'absolute', top: '34px', left: '50%', transform: 'translateX(-50%)',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '10px', padding: '20px', width: '380px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.12)', zIndex: 100,
          }}>
            <div style={{
              fontSize: '15px', fontWeight: '600', color: 'var(--text)',
              marginBottom: '14px',
            }}>
              How statuses are computed
            </div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px', lineHeight: 1.5 }}>
              Statuses are determined automatically from GitHub issues and Userback ticket data. Priority order (highest wins):
            </div>
            {['blocked', 'stale', 'inflight', 'active', 'clear'].map(key => {
              const cfg = HEALTH_CONFIG[key];
              return (
                <div key={key} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '10px',
                  padding: '8px 0',
                  borderBottom: key !== 'clear' ? '1px solid var(--border)' : 'none',
                }}>
                  <span style={{
                    width: '10px', height: '10px', borderRadius: '50%',
                    background: cfg.dot, flexShrink: 0, marginTop: '4px',
                  }} />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: cfg.text }}>{cfg.label}</div>
                    <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.4 }}>{cfg.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </span>
  );
}

// ── Issue / Task row ─────────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

function ItemRow({ item, source }) {
  // For GitHub: updatedAt comes from the issue. For Userback: it's the modified field.
  const lastModified = item.updatedAt || item.createdAt;
  const dateLabel = formatDate(lastModified);
  const daysSince = lastModified
    ? Math.floor((new Date() - new Date(lastModified)) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '10px',
      padding: '9px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      {/* Show issue number for GitHub only */}
      {source === 'github' && (
        <span style={{
          fontFamily: 'var(--mono)', fontSize: '13px',
          color: 'var(--muted2)', flexShrink: 0, paddingTop: '1px',
          minWidth: '30px',
        }}>
          #{item.id}
        </span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        {item.url ? (
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: '15px', color: 'var(--text)',
              display: 'block', lineHeight: '1.4',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              textDecoration: 'none',
            }}
            title={item.title}
          >
            {item.title}
          </a>
        ) : (
          <span
            style={{
              fontSize: '15px', color: 'var(--text)',
              display: 'block', lineHeight: '1.4',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
            title={item.title}
          >
            {item.title}
          </span>
        )}
        {(item.assignees?.length > 0 || item.assignee) && (
          <span style={{ fontSize: '13px', color: 'var(--muted2)', fontFamily: 'var(--mono)' }}>
            {item.assignees?.join(', ') || item.assignee}
          </span>
        )}
      </div>
      {dateLabel && (
        <span style={{
          fontSize: '13px',
          color: daysSince > 14 ? 'var(--status-stale-text)' : 'var(--muted)',
          fontFamily: 'var(--mono)', flexShrink: 0, paddingTop: '2px',
          background: daysSince > 14 ? 'var(--status-stale-bg)' : 'transparent',
          padding: daysSince > 14 ? '1px 8px' : '1px 0',
          borderRadius: '4px',
          whiteSpace: 'nowrap',
        }}>
          {dateLabel}
        </span>
      )}
    </div>
  );
}

// ── Section within a data column ─────────────────────────────────────────────
const PREVIEW_COUNT = 3;

function IssueSection({ title, items, color, bgColor, source, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  const [expanded, setExpanded] = useState(false);
  if (!items || items.length === 0) return null;

  const visibleItems = open
    ? (expanded ? items : items.slice(0, PREVIEW_COUNT))
    : [];
  const hasMore = items.length > PREVIEW_COUNT;

  return (
    <div style={{ marginBottom: '14px' }}>
      <button
        onClick={() => { setOpen(o => !o); if (!open) setExpanded(false); }}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          width: '100%', background: 'none', border: 'none',
          padding: '0 0 6px 0', cursor: 'pointer',
          borderBottom: `2px solid ${color}`,
        }}
      >
        <span style={{
          fontSize: '13px', fontWeight: '600', letterSpacing: '0.5px',
          textTransform: 'uppercase', color,
        }}>
          {title}
        </span>
        <span style={{
          fontSize: '13px', fontFamily: 'var(--mono)',
          background: bgColor || `${color}18`, color, padding: '2px 8px', borderRadius: '10px',
          fontWeight: '600',
        }}>
          {items.length}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--muted)' }}>
          {open ? '▲' : '▼'}
        </span>
      </button>
      {open && (
        <div style={{ paddingTop: '4px' }}>
          {visibleItems.map((item, i) => (
            <ItemRow key={item.id || i} item={item} source={source} />
          ))}
          {hasMore && (
            <button
              onClick={() => setExpanded(e => !e)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                width: '100%', background: 'none', border: 'none',
                padding: '8px 0 4px', cursor: 'pointer',
                fontSize: '13px', color: 'var(--orange)', fontWeight: '500',
              }}
            >
              {expanded
                ? `▲ Show fewer`
                : `▼ Show ${items.length - PREVIEW_COUNT} more`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Data column (GitHub or Userback) ─────────────────────────────────────────
function DataColumn({ title, icon, data, source, emptyMsg, loading: isLoading }) {
  if (isLoading) {
    return (
      <div style={{
        flex: 1, minWidth: 0,
        background: 'var(--surface2)', border: '1px solid var(--border)',
        borderRadius: '10px', padding: '20px',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          fontSize: '13px', letterSpacing: '0.5px', textTransform: 'uppercase',
          color: 'var(--muted)', fontWeight: '600', marginBottom: '10px',
        }}>
          {icon} {title}
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          fontSize: '14px', color: 'var(--muted)',
        }}>
          <div style={{
            width: '14px', height: '14px',
            border: '2px solid var(--border)',
            borderTopColor: 'var(--orange)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          Loading Userback data...
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{
        flex: 1, minWidth: 0,
        background: 'var(--surface2)', border: '1px solid var(--border)',
        borderRadius: '10px', padding: '20px',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          fontSize: '13px', letterSpacing: '0.5px', textTransform: 'uppercase',
          color: 'var(--muted)', fontWeight: '600', marginBottom: '10px',
        }}>
          {icon} {title}
        </div>
        <div style={{ fontSize: '15px', color: 'var(--muted)', fontStyle: 'italic' }}>
          {emptyMsg || 'Not configured'}
        </div>
      </div>
    );
  }

  if (data.error) {
    return (
      <div style={{
        flex: 1, minWidth: 0,
        background: 'var(--surface2)', border: '1px solid var(--status-blocked-bg)',
        borderRadius: '10px', padding: '20px',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          fontSize: '13px', letterSpacing: '0.5px', textTransform: 'uppercase',
          color: 'var(--muted)', fontWeight: '600', marginBottom: '10px',
        }}>
          {icon} {title}
        </div>
        <div style={{ fontSize: '14px', color: 'var(--red)', fontFamily: 'var(--mono)' }}>
          Error: {data.error}
        </div>
      </div>
    );
  }

  const hasAnything = source === 'github'
    ? (data.blocked.length + data.inProgress.length + data.stale.length + data.open.length) > 0
    : (data.open.length + data.inProgress.length + data.onHold.length) > 0;

  return (
    <div style={{
      flex: 1, minWidth: 0,
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: '10px', padding: '20px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '14px',
      }}>
        <span style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          fontSize: '13px', letterSpacing: '0.5px', textTransform: 'uppercase',
          color: 'var(--muted)', fontWeight: '600',
        }}>
          {icon} {title}
        </span>
        <span style={{
          fontSize: '13px', fontFamily: 'var(--mono)', color: 'var(--muted2)',
        }}>
          {source === 'github' ? `${data.totalOpen} open` : `${data.total} active`}
        </span>
      </div>

      {!hasAnything ? (
        <div style={{ fontSize: '15px', color: 'var(--muted)', fontStyle: 'italic' }}>
          No open items
        </div>
      ) : source === 'github' ? (
        <>
          <IssueSection title="Blocked"     items={data.blocked}     color="var(--status-blocked-text)"  bgColor="var(--status-blocked-bg)"  source="github" />
          <IssueSection title="In Progress" items={data.inProgress}  color="var(--status-inflight-text)" bgColor="var(--status-inflight-bg)" source="github" />
          <IssueSection title="Stale"       items={data.stale}       color="var(--status-stale-text)"    bgColor="var(--status-stale-bg)"    source="github" />
          <IssueSection title="Open"        items={data.open}        color="var(--muted2)"               source="github" />
        </>
      ) : (
        <>
          <IssueSection title="In Progress" items={data.inProgress}  color="var(--status-inflight-text)" bgColor="var(--status-inflight-bg)" source="userback" />
          <IssueSection title="Open"        items={data.open}        color="var(--muted2)"               source="userback" />
          <IssueSection title="On Hold"     items={data.onHold}      color="var(--status-stale-text)"    bgColor="var(--status-stale-bg)"    source="userback" />
        </>
      )}

      {source === 'github' && data.closedThisWeek?.length > 0 && (
        <IssueSection title="Closed this week" items={data.closedThisWeek} color="var(--green)" bgColor="var(--status-active-bg)" source="github" />
      )}
      {source === 'userback' && data.resolvedThisWeek?.length > 0 && (
        <IssueSection title="Resolved this week" items={data.resolvedThisWeek} color="var(--green)" bgColor="var(--status-active-bg)" source="userback" />
      )}
    </div>
  );
}

// ── Project card ─────────────────────────────────────────────────────────────
function ProjectCard({ project }) {
  const [expanded, setExpanded] = useState(true);
  const cfg = HEALTH_CONFIG[project.health] || HEALTH_CONFIG.clear;

  const ghTotal = project.github
    ? (project.github.blocked?.length || 0) +
      (project.github.inProgress?.length || 0) +
      (project.github.stale?.length || 0) +
      (project.github.open?.length || 0)
    : null;

  const ubTotal = project.userback
    ? (project.userback.open?.length || 0) +
      (project.userback.inProgress?.length || 0) +
      (project.userback.onHold?.length || 0)
    : null;

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderLeft: `4px solid ${cfg.dot}`,
      borderRadius: '10px',
      marginBottom: '14px',
      overflow: 'hidden',
    }}>
      {/* Card header */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          width: '100%', background: 'none', border: 'none',
          padding: '16px 20px', cursor: 'pointer',
          borderBottom: expanded ? '1px solid var(--border)' : 'none',
        }}
      >
        <span style={{
          fontSize: '17px', fontWeight: '600', color: 'var(--text)',
          flex: 1, textAlign: 'left',
        }}>
          {project.name}
        </span>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {ghTotal !== null && (
            <span style={{
              fontSize: '13px', fontFamily: 'var(--mono)', color: 'var(--muted2)',
              background: 'var(--surface2)', padding: '3px 10px', borderRadius: '6px',
            }}>
              GH: {ghTotal}
            </span>
          )}
          {ubTotal !== null && (
            <span style={{
              fontSize: '13px', fontFamily: 'var(--mono)', color: 'var(--muted2)',
              background: 'var(--surface2)', padding: '3px 10px', borderRadius: '6px',
            }}>
              UB: {ubTotal}
            </span>
          )}
          <StatusBadge health={project.health} />
          <span style={{ fontSize: '14px', color: 'var(--muted)', marginLeft: '4px' }}>
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {expanded && (
        <div style={{
          display: 'flex', gap: '14px', padding: '16px 20px',
          flexWrap: 'wrap',
        }}>
          <DataColumn
            title="GitHub Issues"
            icon={<GitHubIcon size={16} />}
            data={project.github}
            source="github"
            emptyMsg="No GitHub repo configured"
          />
          <DataColumn
            title="Userback"
            icon={<UserbackIcon size={16} />}
            data={project.userback}
            source="userback"
            emptyMsg="No Userback project configured"
          />
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/data');
      if (res.status === 401) { router.push('/'); return; }
      if (!res.ok) throw new Error('Failed to load data');
      const json = await res.json();
      setData(json);
      setLastFetch(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/');
  }

  const filteredProjects = data?.projects?.filter(p => {
    if (filter === 'all') return true;
    return p.health === filter;
  }) || [];

  const statusCounts = {};
  data?.projects?.forEach(p => {
    statusCounts[p.health] = (statusCounts[p.health] || 0) + 1;
  });

  return (
    <>
      <Head>
        <title>Digiteam Dashboard</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <div style={{ minHeight: '100vh' }}>
        {/* ── Top bar ── */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 10,
          background: 'var(--dt-navy)',
          padding: '0 24px',
          display: 'flex', alignItems: 'center', gap: '16px', height: '60px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <DigiteamLogo size={32} />
            <span style={{ fontSize: '18px', fontWeight: '600', color: '#fff', letterSpacing: '-0.3px' }}>
              digiteam
            </span>
          </div>

          {/* Nav */}
          <nav style={{ display: 'flex', gap: '6px', marginLeft: '24px' }}>
            <button
              onClick={() => router.push('/dashboard')}
              style={{
                background: 'rgba(247,173,57,0.15)', color: '#f7ad39',
                border: 'none', borderRadius: '6px',
                fontSize: '14px', fontWeight: '500',
                padding: '6px 14px',
              }}
            >
              Projects
            </button>
            <button
              onClick={() => router.push('/admin')}
              style={{
                background: 'transparent', color: 'rgba(255,255,255,0.5)',
                border: 'none', borderRadius: '6px',
                fontSize: '14px', fontWeight: '500',
                padding: '6px 14px',
              }}
            >
              Admin
            </button>
          </nav>

          <div style={{ flex: 1 }} />

          {/* Refresh + sign out */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {lastFetch && (
              <span style={{
                fontSize: '13px', color: 'rgba(255,255,255,0.35)',
                fontFamily: 'var(--mono)',
              }}>
                {lastFetch.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button
              onClick={fetchData}
              disabled={loading}
              style={{
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                color: loading ? 'rgba(255,255,255,0.3)' : '#fff',
                borderRadius: '6px', padding: '6px 14px',
                fontSize: '13px', fontWeight: '500',
              }}
            >
              {loading ? '⟳' : '↺ Refresh'}
            </button>
            <button
              onClick={handleLogout}
              style={{
                background: 'none', border: 'none',
                color: 'rgba(255,255,255,0.35)', fontSize: '13px',
              }}
            >
              Sign out
            </button>
          </div>
        </header>

        {/* ── Main content ── */}
        <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '28px 24px' }}>

          {/* Page title */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            marginBottom: '24px',
          }}>
            <h1 style={{ fontSize: '24px', fontWeight: '600', color: 'var(--text)' }}>
              Project overview
            </h1>
            <StatusLegend />
            {data && !loading && (
              <span style={{
                fontSize: '15px', color: 'var(--muted)', marginLeft: '8px',
              }}>
                {data.projects.length} projects
              </span>
            )}
          </div>

          {loading && !data && (
            <div style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              minHeight: '60vh', gap: '16px',
            }}>
              <div style={{
                width: '36px', height: '36px',
                border: '3px solid var(--border)',
                borderTopColor: 'var(--orange)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              <span style={{
                fontSize: '15px', color: 'var(--muted)',
              }}>
                Fetching data...
              </span>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {error && (
            <div style={{
              background: 'var(--status-blocked-bg)', border: '1px solid #e24b4a33',
              borderRadius: '10px', padding: '18px 22px',
              color: 'var(--red)', fontSize: '15px',
              marginBottom: '20px',
            }}>
              Error: {error}
            </div>
          )}

          {data && (
            <>
              {/* ── Status summary strip ── */}
              <div style={{
                display: 'flex', gap: '12px', marginBottom: '24px',
                flexWrap: 'wrap',
              }}>
                {/* All filter */}
                <button
                  onClick={() => setFilter('all')}
                  style={{
                    background: filter === 'all' ? 'var(--dt-navy)' : 'var(--surface)',
                    color: filter === 'all' ? '#fff' : 'var(--text)',
                    border: `1px solid ${filter === 'all' ? 'var(--dt-navy)' : 'var(--border)'}`,
                    borderRadius: '10px', padding: '12px 20px',
                    cursor: 'pointer', minWidth: '100px', textAlign: 'left',
                  }}
                >
                  <div style={{ fontSize: '24px', fontWeight: '700', lineHeight: 1 }}>
                    {data.projects.length}
                  </div>
                  <div style={{
                    fontSize: '13px', marginTop: '4px',
                    color: filter === 'all' ? 'rgba(255,255,255,0.6)' : 'var(--muted)',
                    fontWeight: '500',
                  }}>
                    All projects
                  </div>
                </button>

                {['blocked', 'stale', 'inflight', 'active', 'clear'].map(key => {
                  const cfg = HEALTH_CONFIG[key];
                  const count = statusCounts[key] || 0;
                  const isActive = filter === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setFilter(isActive ? 'all' : key)}
                      style={{
                        background: isActive ? cfg.bg : 'var(--surface)',
                        border: `1px solid ${isActive ? cfg.dot : 'var(--border)'}`,
                        borderLeft: `4px solid ${cfg.dot}`,
                        borderRadius: '10px', padding: '12px 20px',
                        cursor: 'pointer', minWidth: '100px', textAlign: 'left',
                        opacity: count === 0 ? 0.5 : 1,
                      }}
                    >
                      <div style={{
                        fontSize: '24px', fontWeight: '700', lineHeight: 1,
                        color: cfg.dot,
                      }}>
                        {count}
                      </div>
                      <div style={{
                        fontSize: '13px', marginTop: '4px', color: cfg.text,
                        fontWeight: '500',
                      }}>
                        {cfg.label}
                      </div>
                    </button>
                  );
                })}

                {lastFetch && !loading && (
                  <div style={{
                    marginLeft: 'auto', alignSelf: 'center',
                    fontSize: '13px', color: 'var(--muted)',
                    fontFamily: 'var(--mono)',
                  }}>
                    Updated {lastFetch.toLocaleString('en-CA', {
                      month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </div>
                )}
              </div>

              {/* ── Project cards ── */}
              {filteredProjects.length === 0 ? (
                <div style={{
                  textAlign: 'center', padding: '60px',
                  color: 'var(--muted)', fontSize: '16px',
                  background: 'var(--surface)', borderRadius: '10px',
                  border: '1px solid var(--border)',
                }}>
                  No projects match this filter
                </div>
              ) : (
                filteredProjects.map(project => (
                  <ProjectCard key={project.name} project={project} />
                ))
              )}
            </>
          )}
        </main>
      </div>
    </>
  );
}