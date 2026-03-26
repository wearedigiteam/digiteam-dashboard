import { useState, useEffect } from 'react';
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

// ── Pill ──────────────────────────────────────────────────────────────────────
function Pill({ children, color = 'var(--muted2)', onClick, active }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? color : 'var(--surface2)',
        color: active ? '#fff' : 'var(--muted2)',
        border: `1px solid ${active ? color : 'var(--border2)'}`,
        borderRadius: '3px',
        fontFamily: 'var(--mono)',
        fontSize: '11px',
        padding: '3px 10px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.1s',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

// ── Project row ───────────────────────────────────────────────────────────────
function ProjectRow({ project, githubRepos, userbackProjects, onChange, onRemove }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr auto',
      gap: '10px',
      alignItems: 'center',
      padding: '10px 12px',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '3px',
      marginBottom: '8px',
    }}>
      {/* Display name */}
      <input
        value={project.name}
        onChange={e => onChange({ ...project, name: e.target.value })}
        placeholder="Project display name"
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--border2)',
          borderRadius: '3px',
          color: 'var(--text)',
          fontFamily: 'var(--mono)',
          fontSize: '12px',
          padding: '6px 10px',
          width: '100%',
        }}
      />

      {/* GitHub repo select */}
      <select
        value={project.githubRepo || ''}
        onChange={e => onChange({ ...project, githubRepo: e.target.value || null })}
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--border2)',
          borderRadius: '3px',
          color: project.githubRepo ? 'var(--text)' : 'var(--muted)',
          fontFamily: 'var(--mono)',
          fontSize: '12px',
          padding: '6px 10px',
          width: '100%',
        }}
      >
        <option value="">— No GitHub repo —</option>
        {githubRepos.map(r => (
          <option key={r.name} value={r.name}>{r.name}</option>
        ))}
      </select>

      {/* Userback project select */}
      <select
        value={project.userbackId || ''}
        onChange={e => onChange({ ...project, userbackId: e.target.value || null })}
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--border2)',
          borderRadius: '3px',
          color: project.userbackId ? 'var(--text)' : 'var(--muted)',
          fontFamily: 'var(--mono)',
          fontSize: '12px',
          padding: '6px 10px',
          width: '100%',
        }}
      >
        <option value="">— No Userback project —</option>
        {userbackProjects.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>

      {/* Remove button */}
      <button
        onClick={onRemove}
        style={{
          background: 'none',
          border: '1px solid var(--border2)',
          borderRadius: '3px',
          color: 'var(--muted)',
          fontFamily: 'var(--mono)',
          fontSize: '14px',
          padding: '4px 10px',
          cursor: 'pointer',
          lineHeight: 1,
        }}
        title="Remove project"
      >
        ×
      </button>
    </div>
  );
}

// ── Admin page ────────────────────────────────────────────────────────────────
export default function Admin() {
  const router = useRouter();

  const [mapping,           setMapping]           = useState([]);
  const [githubRepos,       setGithubRepos]       = useState([]);
  const [userbackProjects,  setUserbackProjects]  = useState([]);
  const [loading,           setLoading]           = useState(true);
  const [saving,            setSaving]            = useState(false);
  const [saved,             setSaved]             = useState(false);
  const [error,             setError]             = useState(null);
  const [repoSearch,        setRepoSearch]        = useState('');

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      setError(null);
      try {
        const [mappingRes, reposRes, ubRes] = await Promise.all([
          fetch('/api/admin/mapping'),
          fetch('/api/admin/repos'),
          fetch('/api/userback-projects'),
        ]);

        if (mappingRes.status === 401 || reposRes.status === 401) {
          router.push('/');
          return;
        }

        const [mappingData, reposData, ubData] = await Promise.all([
          mappingRes.json(),
          reposRes.json(),
          ubRes.json(),
        ]);

        setMapping(mappingData.mapping || []);
        setGithubRepos(reposData.repos || []);
        setUserbackProjects(ubData.projects || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, [router]);

  function addProject() {
    setMapping(m => [...m, { name: '', githubRepo: null, userbackId: null }]);
  }

  function updateProject(index, updated) {
    setMapping(m => m.map((p, i) => i === index ? updated : p));
  }

  function removeProject(index) {
    setMapping(m => m.filter((_, i) => i !== index));
  }

  async function saveMapping() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/admin/mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapping }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Save failed');
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const filteredRepos = githubRepos.filter(r =>
    r.name.toLowerCase().includes(repoSearch.toLowerCase())
  );

  return (
    <>
      <Head>
        <title>Admin — Digiteam Dashboard</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '20px', height: '20px',
              background: 'var(--orange)',
              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
            }} />
            <span style={{ fontSize: '14px', fontWeight: '800' }}>digiteam</span>
            <span style={{
              fontSize: '9px', color: 'var(--muted)', letterSpacing: '2px',
              textTransform: 'uppercase', fontFamily: 'var(--mono)',
              paddingLeft: '8px', borderLeft: '1px solid var(--border)',
            }}>
              Admin
            </span>
          </div>

          <div style={{ flex: 1 }} />

          <button
            onClick={() => router.push('/dashboard')}
            style={{
              background: 'none', border: '1px solid var(--border2)',
              color: 'var(--muted2)', borderRadius: '3px',
              fontFamily: 'var(--mono)', fontSize: '10px',
              letterSpacing: '0.5px', padding: '4px 12px', cursor: 'pointer',
            }}
          >
            ← Dashboard
          </button>
        </header>

        <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px' }}>

          {/* Page title */}
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{
              fontSize: '24px', fontWeight: '800', color: 'var(--text)',
              marginBottom: '6px',
            }}>
              Project Mapping
            </h1>
            <p style={{
              fontSize: '13px', color: 'var(--muted)',
              fontFamily: 'var(--mono)', lineHeight: 1.6,
            }}>
              Link GitHub repos to their Userback counterparts. Changes are saved to{' '}
              <code style={{ color: 'var(--orange)' }}>mapping.json</code> in your repo via the GitHub API.
            </p>
          </div>

          {loading && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: '12px',
            }}>
              <div style={{
                width: '16px', height: '16px',
                border: '2px solid var(--border2)',
                borderTopColor: 'var(--orange)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              Loading repos and projects...
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {error && (
            <div style={{
              background: '#cc220011', border: '1px solid #cc220033',
              borderRadius: '4px', padding: '12px 16px',
              color: 'var(--red)', fontFamily: 'var(--mono)', fontSize: '12px',
              marginBottom: '20px',
            }}>
              {error}
            </div>
          )}

          {!loading && (
            <>
              {/* Column headers */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr auto',
                gap: '10px',
                padding: '0 12px 8px',
                marginBottom: '4px',
              }}>
                {['Display Name', 'GitHub Repo', 'Userback Project', ''].map((h, i) => (
                  <div key={i} style={{
                    fontSize: '10px', color: 'var(--muted)',
                    fontFamily: 'var(--mono)', letterSpacing: '1.5px',
                    textTransform: 'uppercase',
                  }}>
                    {h}
                  </div>
                ))}
              </div>

              {/* Repo search — shown above the GitHub column */}
              <div style={{ marginBottom: '12px' }}>
                <input
                  value={repoSearch}
                  onChange={e => setRepoSearch(e.target.value)}
                  placeholder="Filter GitHub repos..."
                  style={{
                    width: '300px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border2)',
                    borderRadius: '3px',
                    color: 'var(--text)',
                    fontFamily: 'var(--mono)',
                    fontSize: '11px',
                    padding: '5px 10px',
                  }}
                />
                <span style={{
                  marginLeft: '10px', fontSize: '11px',
                  color: 'var(--muted)', fontFamily: 'var(--mono)',
                }}>
                  {filteredRepos.length} of {githubRepos.length} repos
                </span>
              </div>

              {/* Project rows */}
              {mapping.length === 0 && (
                <div style={{
                  textAlign: 'center', padding: '40px',
                  color: 'var(--muted)', fontFamily: 'var(--mono)',
                  fontSize: '12px', border: '1px dashed var(--border2)',
                  borderRadius: '4px', marginBottom: '16px',
                }}>
                  No projects configured yet. Click "Add Project" to get started.
                </div>
              )}

              {mapping.map((project, index) => (
                <ProjectRow
                  key={index}
                  project={project}
                  githubRepos={repoSearch ? filteredRepos : githubRepos}
                  userbackProjects={userbackProjects}
                  onChange={updated => updateProject(index, updated)}
                  onRemove={() => removeProject(index)}
                />
              ))}

              {/* Actions */}
              <div style={{
                display: 'flex', gap: '10px', alignItems: 'center',
                marginTop: '20px', paddingTop: '20px',
                borderTop: '1px solid var(--border)',
              }}>
                <button
                  onClick={addProject}
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border2)',
                    color: 'var(--text)',
                    borderRadius: '3px',
                    fontFamily: 'var(--mono)', fontSize: '11px',
                    letterSpacing: '0.5px', textTransform: 'uppercase',
                    padding: '8px 16px', cursor: 'pointer',
                  }}
                >
                  + Add Project
                </button>

                <button
                  onClick={saveMapping}
                  disabled={saving}
                  style={{
                    background: saving ? 'var(--border2)' : 'var(--orange)',
                    border: 'none',
                    color: '#fff',
                    borderRadius: '3px',
                    fontFamily: 'var(--mono)', fontSize: '11px',
                    letterSpacing: '0.5px', textTransform: 'uppercase',
                    padding: '8px 20px',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    transition: 'background 0.15s',
                  }}
                >
                  {saving ? 'Saving...' : 'Save Mapping'}
                </button>

                {saved && (
                  <span style={{
                    fontSize: '11px', color: 'var(--green)',
                    fontFamily: 'var(--mono)',
                  }}>
                    ✓ Saved to repo
                  </span>
                )}

                <div style={{ flex: 1 }} />

                <span style={{
                  fontSize: '10px', color: 'var(--muted)',
                  fontFamily: 'var(--mono)',
                }}>
                  {mapping.length} project{mapping.length !== 1 ? 's' : ''} configured
                </span>
              </div>

              {/* Userback project reference */}
              <div style={{ marginTop: '40px' }}>
                <div style={{
                  fontSize: '10px', color: 'var(--muted)',
                  fontFamily: 'var(--mono)', letterSpacing: '1.5px',
                  textTransform: 'uppercase', marginBottom: '12px',
                }}>
                  Userback Projects ({userbackProjects.length})
                </div>
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: '6px',
                }}>
                  {userbackProjects.map(p => (
                    <div
                      key={p.id}
                      style={{
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: '3px',
                        padding: '4px 10px',
                        fontFamily: 'var(--mono)', fontSize: '11px',
                        color: 'var(--muted2)',
                      }}
                    >
                      <span style={{ color: 'var(--orange)' }}>{p.id}</span>
                      {' '}{p.name}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}