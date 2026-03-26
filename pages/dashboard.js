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

// ── Health indicator ────────────────────────────────────────────────────────
const HEALTH_CONFIG = {
  blocked: { color: '#cc2200', label: 'BLOCKED',    dot: '#ff4422' },
  stale:   { color: '#886600', label: 'STALE',      dot: '#F5A400' },
  active:  { color: '#1a6e1a', label: 'IN FLIGHT',  dot: '#22cc44' },
  clear:   { color: '#333',    label: 'CLEAR',       dot: '#444'    },
};

function HealthDot({ health }) {
  const cfg = HEALTH_CONFIG[health] || HEALTH_CONFIG.clear;
  return (
    <span style={{
      display: 'inline-block',
      width: '8px', height: '8px',
      borderRadius: '50%',
      background: cfg.dot,
      boxShadow: health === 'blocked' ? `0 0 6px ${cfg.dot}` :
                 health === 'active'  ? `0 0 4px ${cfg.dot}` : 'none',
      flexShrink: 0,
    }} />
  );
}

// ── Issue / Task row ────────────────────────────────────────────────────────
function ItemRow({ item, source }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '8px',
      padding: '7px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <span style={{
        fontFamily: 'var(--mono)', fontSize: '11px',
        color: 'var(--muted2)', flexShrink: 0, paddingTop: '1px',
        minWidth: '28px',
      }}>
        {source === 'github' ? `#${item.id}` : '●'}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          style={{
            fontSize: '12px', color: 'var(--text)',
            display: 'block', lineHeight: '1.4',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
          title={item.title}
        >
          {item.title}
        </a>
        {(item.assignees?.length > 0 || item.assignee) && (
          <span style={{ fontSize: '10px', color: 'var(--muted2)', fontFamily: 'var(--mono)' }}>
            {item.assignees?.join(', ') || item.assignee}
          </span>
        )}
      </div>
      {item.daysSince !== undefined && (
        <span style={{
          fontSize: '10px', color: item.daysSince > 14 ? '#886600' : 'var(--muted)',
          fontFamily: 'var(--mono)', flexShrink: 0, paddingTop: '2px',
        }}>
          {item.daysSince}d
        </span>
      )}
    </div>
  );
}

// ── Section within a data column ─────────────────────────────────────────────
function IssueSection({ title, items, color, source, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!items || items.length === 0) return null;
  return (
    <div style={{ marginBottom: '12px' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          width: '100%', background: 'none', border: 'none',
          padding: '0 0 5px 0', cursor: 'pointer',
          borderBottom: `1px solid ${color}33`,
        }}
      >
        <span style={{
          fontSize: '10px', fontWeight: '700', letterSpacing: '1.5px',
          textTransform: 'uppercase', color, fontFamily: 'var(--mono)',
        }}>
          {title}
        </span>
        <span style={{
          fontSize: '10px', fontFamily: 'var(--mono)',
          background: `${color}22`, color, padding: '1px 6px', borderRadius: '2px',
        }}>
          {items.length}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--muted)' }}>
          {open ? '▲' : '▼'}
        </span>
      </button>
      {open && (
        <div style={{ paddingTop: '4px' }}>
          {items.map((item, i) => (
            <ItemRow key={item.id || i} item={item} source={source} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Data column (GitHub or Userback) ─────────────────────────────────────────
function DataColumn({ title, icon, data, source, emptyMsg }) {
  if (!data) {
    return (
      <div style={{
        flex: 1, minWidth: 0,
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
        borderRadius: '3px',
        padding: '16px',
      }}>
        <div style={{
          fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase',
          color: 'var(--muted)', fontFamily: 'var(--mono)', marginBottom: '8px',
        }}>
          {icon} {title}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--muted)', fontStyle: 'italic' }}>
          {emptyMsg || 'Not configured'}
        </div>
      </div>
    );
  }

  if (data.error) {
    return (
      <div style={{
        flex: 1, minWidth: 0,
        background: 'var(--surface2)',
        border: '1px solid #cc220033',
        borderRadius: '3px',
        padding: '16px',
      }}>
        <div style={{
          fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase',
          color: 'var(--muted)', fontFamily: 'var(--mono)', marginBottom: '8px',
        }}>
          {icon} {title}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--red)', fontFamily: 'var(--mono)' }}>
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
      background: 'var(--surface2)',
      border: '1px solid var(--border)',
      borderRadius: '3px',
      padding: '16px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '12px',
      }}>
        <span style={{
          fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase',
          color: 'var(--muted)', fontFamily: 'var(--mono)',
        }}>
          {icon} {title}
        </span>
        <span style={{
          fontSize: '10px', fontFamily: 'var(--mono)', color: 'var(--muted2)',
        }}>
          {source === 'github' ? `${data.totalOpen} open` : `${data.total} active`}
        </span>
      </div>

      {!hasAnything ? (
        <div style={{ fontSize: '12px', color: 'var(--muted)', fontStyle: 'italic' }}>
          No open items
        </div>
      ) : source === 'github' ? (
        <>
          <IssueSection title="Blocked"     items={data.blocked}     color="var(--red)"   source="github" />
          <IssueSection title="In Progress" items={data.inProgress}  color="var(--blue)"  source="github" />
          <IssueSection title="Stale"       items={data.stale}       color="#886600"       source="github" defaultOpen={false} />
          <IssueSection title="Open"        items={data.open}        color="var(--muted2)" source="github" defaultOpen={false} />
        </>
      ) : (
        <>
          <IssueSection title="In Progress" items={data.inProgress}  color="var(--blue)"  source="userback" />
          <IssueSection title="Open"        items={data.open}        color="var(--muted2)" source="userback" defaultOpen={false} />
          <IssueSection title="On Hold"     items={data.onHold}      color="#886600"       source="userback" defaultOpen={false} />
        </>
      )}

      {source === 'github' && data.closedThisWeek?.length > 0 && (
        <IssueSection
          title="Closed this week"
          items={data.closedThisWeek}
          color="var(--green)"
          source="github"
          defaultOpen={false}
        />
      )}
      {source === 'userback' && data.resolvedThisWeek?.length > 0 && (
        <IssueSection
          title="Resolved this week"
          items={data.resolvedThisWeek}
          color="var(--green)"
          source="userback"
          defaultOpen={false}
        />
      )}
    </div>
  );
}

// ── Project card ──────────────────────────────────────────────────────────────
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
      border: `1px solid var(--border)`,
      borderLeft: `3px solid ${cfg.dot}`,
      borderRadius: '4px',
      marginBottom: '12px',
      overflow: 'hidden',
    }}>
      {/* Card header */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          width: '100%', background: 'none', border: 'none',
          padding: '14px 16px', cursor: 'pointer',
          borderBottom: expanded ? '1px solid var(--border)' : 'none',
        }}
      >
        <HealthDot health={project.health} />
        <span style={{
          fontSize: '15px', fontWeight: '700', color: 'var(--text)',
          flex: 1, textAlign: 'left',
        }}>
          {project.name}
        </span>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {project.github?.blocked?.length > 0 && (
            <span style={{
              fontSize: '10px', fontFamily: 'var(--mono)',
              background: '#cc220022', color: 'var(--red)',
              padding: '2px 7px', borderRadius: '2px', border: '1px solid #cc220033',
            }}>
              {project.github.blocked.length} blocked
            </span>
          )}
          {ghTotal !== null && (
            <span style={{
              fontSize: '10px', fontFamily: 'var(--mono)', color: 'var(--muted2)',
            }}>
              GH: {ghTotal}
            </span>
          )}
          {ubTotal !== null && (
            <span style={{
              fontSize: '10px', fontFamily: 'var(--mono)', color: 'var(--muted2)',
            }}>
              UB: {ubTotal}
            </span>
          )}
          <span style={{
            fontSize: '11px', fontFamily: 'var(--mono)',
            background: `${cfg.color}18`, color: cfg.dot,
            padding: '2px 8px', borderRadius: '2px',
            letterSpacing: '0.5px',
          }}>
            {cfg.label}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--muted)', marginLeft: '4px' }}>
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {expanded && (
        <div style={{
          display: 'flex', gap: '12px', padding: '14px 16px',
          flexWrap: 'wrap',
        }}>
          <DataColumn
            title="GitHub Issues"
            icon="⌥"
            data={project.github}
            source="github"
            emptyMsg="No GitHub repo configured"
          />
          <DataColumn
            title="Userback"
            icon="◈"
            data={project.userback}
            source="userback"
            emptyMsg="No Userback project configured"
          />
        </div>
      )}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const router = useRouter();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [filter, setFilter]   = useState('all'); // all | blocked | active

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/data');
      if (res.status === 401) {
        router.push('/');
        return;
      }
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
    if (filter === 'blocked') return p.health === 'blocked';
    if (filter === 'active')  return p.health === 'active' || p.health === 'blocked' || p.health === 'stale';
    return true;
  }) || [];

  const totalBlocked = data?.projects?.reduce((n, p) =>
    n + (p.github?.blocked?.length || 0), 0) || 0;
  const totalActive  = data?.projects?.filter(p =>
    p.health !== 'clear').length || 0;

  return (
    <>
      <Head>
        <title>Digiteam Ops Dashboard</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      {/* Background grid */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        backgroundImage: `
          linear-gradient(rgba(224,60,26,0.02) 1px, transparent 1px),
          linear-gradient(90deg, rgba(224,60,26,0.02) 1px, transparent 1px)
        `,
        backgroundSize: '48px 48px',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh' }}>
        {/* Top bar */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 10,
          background: 'rgba(10,10,10,0.95)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid var(--border)',
          padding: '0 24px',
          display: 'flex', alignItems: 'center', gap: '16px', height: '52px',
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <div style={{
              width: '20px', height: '20px',
              background: 'var(--orange)',
              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
            }} />
            <span style={{ fontSize: '14px', fontWeight: '800', letterSpacing: '-0.3px' }}>
              digiteam
            </span>
            <span style={{
              fontSize: '9px', color: 'var(--muted)', letterSpacing: '2px',
              textTransform: 'uppercase', fontFamily: 'var(--mono)',
              paddingLeft: '8px', borderLeft: '1px solid var(--border)',
            }}>
              Ops
            </span>
          </div>

          {/* Stats */}
          {data && !loading && (
            <div style={{
              display: 'flex', gap: '16px', marginLeft: '16px',
              fontFamily: 'var(--mono)', fontSize: '11px',
            }}>
              {totalBlocked > 0 && (
                <span style={{ color: 'var(--red)' }}>
                  ⚠ {totalBlocked} blocked
                </span>
              )}
              <span style={{ color: 'var(--muted2)' }}>
                {totalActive}/{data.projects.length} active
              </span>
            </div>
          )}

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Filters */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {['all', 'blocked', 'active'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  background: filter === f ? 'var(--orange)' : 'var(--surface)',
                  color: filter === f ? '#fff' : 'var(--muted2)',
                  border: `1px solid ${filter === f ? 'var(--orange)' : 'var(--border2)'}`,
                  borderRadius: '3px',
                  fontFamily: 'var(--mono)', fontSize: '10px',
                  letterSpacing: '0.5px', textTransform: 'uppercase',
                  padding: '4px 10px',
                }}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Refresh + last updated */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {lastFetch && (
              <span style={{
                fontSize: '10px', color: 'var(--muted)',
                fontFamily: 'var(--mono)',
              }}>
                {lastFetch.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button
              onClick={fetchData}
              disabled={loading}
              style={{
                background: 'var(--surface2)',
                border: '1px solid var(--border2)',
                color: loading ? 'var(--muted)' : 'var(--text)',
                borderRadius: '3px', padding: '4px 10px',
                fontFamily: 'var(--mono)', fontSize: '10px',
                letterSpacing: '0.5px',
              }}
            >
              {loading ? '⟳' : '↺ Refresh'}
            </button>
            <button
              onClick={handleLogout}
              style={{
                background: 'none', border: 'none',
                color: 'var(--muted)', fontSize: '10px',
                fontFamily: 'var(--mono)', letterSpacing: '0.5px',
                textTransform: 'uppercase',
              }}
            >
              Sign out
            </button>
          </div>
        </header>

        {/* Main content */}
        <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>

          {loading && !data && (
            <div style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              minHeight: '60vh', gap: '16px',
            }}>
              <div style={{
                width: '32px', height: '32px',
                border: '2px solid var(--border2)',
                borderTopColor: 'var(--orange)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              <span style={{
                fontSize: '11px', color: 'var(--muted)',
                fontFamily: 'var(--mono)', letterSpacing: '2px',
                textTransform: 'uppercase',
              }}>
                Fetching data...
              </span>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {error && (
            <div style={{
              background: '#cc220011', border: '1px solid #cc220033',
              borderRadius: '4px', padding: '16px 20px',
              color: 'var(--red)', fontFamily: 'var(--mono)', fontSize: '13px',
              marginBottom: '20px',
            }}>
              Error: {error}
            </div>
          )}

          {data && (
            <>
              {/* Summary strip */}
              <div style={{
                display: 'flex', gap: '12px', marginBottom: '24px',
                flexWrap: 'wrap',
              }}>
                {Object.entries(HEALTH_CONFIG).map(([key, cfg]) => {
                  const count = data.projects.filter(p => p.health === key).length;
                  return (
                    <div
                      key={key}
                      onClick={() => setFilter(key === 'clear' ? 'all' : key === 'blocked' ? 'blocked' : 'active')}
                      style={{
                        background: 'var(--surface)',
                        border: `1px solid var(--border)`,
                        borderLeft: `3px solid ${cfg.dot}`,
                        borderRadius: '3px',
                        padding: '10px 16px',
                        cursor: 'pointer',
                        minWidth: '100px',
                      }}
                    >
                      <div style={{
                        fontSize: '22px', fontWeight: '800', color: cfg.dot,
                        lineHeight: 1,
                      }}>
                        {count}
                      </div>
                      <div style={{
                        fontSize: '9px', color: 'var(--muted)',
                        fontFamily: 'var(--mono)', letterSpacing: '1.5px',
                        textTransform: 'uppercase', marginTop: '4px',
                      }}>
                        {cfg.label}
                      </div>
                    </div>
                  );
                })}

                {lastFetch && !loading && (
                  <div style={{
                    marginLeft: 'auto', alignSelf: 'center',
                    fontSize: '10px', color: 'var(--muted)',
                    fontFamily: 'var(--mono)',
                  }}>
                    Last updated {lastFetch.toLocaleString('en-CA', {
                      month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </div>
                )}
              </div>

              {/* Project cards */}
              {filteredProjects.length === 0 ? (
                <div style={{
                  textAlign: 'center', padding: '60px',
                  color: 'var(--muted)', fontFamily: 'var(--mono)',
                  fontSize: '12px', letterSpacing: '1px',
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
