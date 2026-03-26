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

function DigiteamLogo({ size = 32 }) {
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

function ProjectRow({ project, githubRepos, userbackProjects, onChange, onRemove }) {
  const inputStyle = {
    background: 'var(--surface2)',
    border: '1px solid var(--border2)',
    borderRadius: '8px',
    color: 'var(--text)',
    fontSize: '15px',
    padding: '10px 12px',
    width: '100%',
    outline: 'none',
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr auto',
      gap: '12px',
      alignItems: 'center',
      padding: '14px 16px',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '10px',
      marginBottom: '10px',
    }}>
      <input
        value={project.name}
        onChange={e => onChange({ ...project, name: e.target.value })}
        placeholder="Project display name"
        style={inputStyle}
      />
      <select
        value={project.githubRepo || ''}
        onChange={e => onChange({ ...project, githubRepo: e.target.value || null })}
        style={{
          ...inputStyle,
          color: project.githubRepo ? 'var(--text)' : 'var(--muted)',
        }}
      >
        <option value="">— No GitHub repo —</option>
        {githubRepos.map(r => (
          <option key={r.name} value={r.name}>{r.name}</option>
        ))}
      </select>
      <select
        value={project.userbackId || ''}
        onChange={e => onChange({ ...project, userbackId: e.target.value || null })}
        style={{
          ...inputStyle,
          color: project.userbackId ? 'var(--text)' : 'var(--muted)',
        }}
      >
        <option value="">— No Userback project —</option>
        {userbackProjects.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <button
        onClick={onRemove}
        style={{
          background: 'var(--status-blocked-bg)',
          border: '1px solid #e24b4a33',
          borderRadius: '8px',
          color: 'var(--status-blocked-text)',
          fontSize: '16px',
          padding: '8px 12px',
          lineHeight: 1,
        }}
        title="Remove project"
      >
        ×
      </button>
    </div>
  );
}

export default function Admin() {
  const router = useRouter();
  const [mapping, setMapping] = useState([]);
  const [githubRepos, setGithubRepos] = useState([]);
  const [userbackProjects, setUserbackProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [repoSearch, setRepoSearch] = useState('');
  const [adminTab, setAdminTab] = useState('projects');

  // User mapping state
  const [userMapping, setUserMapping] = useState([]);
  const [githubMembers, setGithubMembers] = useState([]);
  const [userbackMembers, setUserbackMembers] = useState([]);
  const [savingUsers, setSavingUsers] = useState(false);
  const [savedUsers, setSavedUsers] = useState(false);

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      setError(null);
      try {
        const [mappingRes, reposRes, ubRes, userMapRes, ghMembersRes, ubMembersRes] = await Promise.all([
          fetch('/api/admin/mapping'),
          fetch('/api/admin/repos'),
          fetch('/api/userback-projects'),
          fetch('/api/admin/user-mapping'),
          fetch('/api/admin/github-members'),
          fetch('/api/admin/userback-members'),
        ]);
        if (mappingRes.status === 401 || reposRes.status === 401) {
          router.push('/'); return;
        }
        const [mappingData, reposData, ubData, userMapData, ghMembersData, ubMembersData] = await Promise.all([
          mappingRes.json(), reposRes.json(), ubRes.json(),
          userMapRes.json(), ghMembersRes.json(), ubMembersRes.json(),
        ]);
        setMapping(mappingData.mapping || []);
        setGithubRepos(reposData.repos || []);
        setUserbackProjects(ubData.projects || []);
        setUserMapping(userMapData.userMapping || []);
        setGithubMembers(ghMembersData.members || []);
        setUserbackMembers(ubMembersData.members || []);
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
    setSaving(true); setError(null); setSaved(false);
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

  // ── User mapping functions ──
  function addUserMapping() {
    setUserMapping(m => [...m, { displayName: '', githubLogin: '', userbackUserId: '' }]);
  }

  function updateUserMapping(index, updated) {
    setUserMapping(m => m.map((u, i) => i === index ? updated : u));
  }

  function removeUserMapping(index) {
    setUserMapping(m => m.filter((_, i) => i !== index));
  }

  async function saveUserMapping() {
    setSavingUsers(true); setError(null); setSavedUsers(false);
    try {
      const res = await fetch('/api/admin/user-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userMapping }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Save failed');
      }
      setSavedUsers(true);
      setTimeout(() => setSavedUsers(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingUsers(false);
    }
  }

  return (
    <>
      <Head>
        <title>Admin — Digiteam Dashboard</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <div style={{ minHeight: '100vh' }}>
        {/* Top bar */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 10,
          background: 'var(--dt-navy)',
          padding: '0 24px',
          display: 'flex', alignItems: 'center', gap: '16px', height: '60px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <DigiteamLogo size={28} />
            <span style={{ fontSize: '18px', fontWeight: '600', color: '#fff' }}>
              digiteam
            </span>
          </div>

          <nav style={{ display: 'flex', gap: '6px', marginLeft: '24px' }}>
            <button
              onClick={() => router.push('/dashboard')}
              style={{
                background: 'transparent', color: 'rgba(255,255,255,0.5)',
                border: 'none', borderRadius: '6px',
                fontSize: '14px', fontWeight: '500', padding: '6px 14px',
              }}
            >
              Projects
            </button>
            <button
              style={{
                background: 'rgba(247,173,57,0.15)', color: '#f7ad39',
                border: 'none', borderRadius: '6px',
                fontSize: '14px', fontWeight: '500', padding: '6px 14px',
              }}
            >
              Admin
            </button>
          </nav>

          <div style={{ flex: 1 }} />

          <button
            onClick={() => router.push('/dashboard')}
            style={{
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
              color: '#fff', borderRadius: '6px',
              fontSize: '13px', fontWeight: '500', padding: '6px 14px',
            }}
          >
            ← Dashboard
          </button>
        </header>

        <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px' }}>

          {/* Page title */}
          <h1 style={{ fontSize: '24px', fontWeight: '600', color: 'var(--text)', marginBottom: '20px' }}>
            Admin
          </h1>

          {/* Tab bar */}
          <div style={{
            display: 'flex', gap: '0', marginBottom: '28px',
            borderBottom: '2px solid var(--border)',
          }}>
            {[
              { key: 'projects', label: 'Project mapping', count: mapping.length },
              { key: 'team', label: 'Team members', count: userMapping.length },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setAdminTab(tab.key)}
                style={{
                  background: 'none', border: 'none',
                  padding: '10px 20px',
                  fontSize: '15px', fontWeight: '600',
                  color: adminTab === tab.key ? 'var(--orange)' : 'var(--muted)',
                  borderBottom: adminTab === tab.key ? '2px solid var(--orange)' : '2px solid transparent',
                  marginBottom: '-2px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {tab.label}
                <span style={{
                  marginLeft: '8px', fontSize: '13px',
                  background: adminTab === tab.key ? 'var(--orange)' : 'var(--surface2)',
                  color: adminTab === tab.key ? '#fff' : 'var(--muted)',
                  padding: '2px 8px', borderRadius: '10px',
                }}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {loading && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              color: 'var(--muted)', fontSize: '15px',
            }}>
              <div style={{
                width: '18px', height: '18px',
                border: '2px solid var(--border)',
                borderTopColor: 'var(--orange)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              Loading...
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {error && (
            <div style={{
              background: 'var(--status-blocked-bg)', border: '1px solid #e24b4a33',
              borderRadius: '10px', padding: '14px 18px',
              color: 'var(--red)', fontSize: '14px', marginBottom: '20px',
            }}>
              {error}
            </div>
          )}

          {!loading && (
            <>
              {/* ═══ TAB: Project Mapping ═══ */}
              {adminTab === 'projects' && (
                <div>
                  <p style={{ fontSize: '15px', color: 'var(--muted)', lineHeight: 1.6, marginBottom: '24px' }}>
                    Link GitHub repos to their Userback counterparts. Changes are saved to{' '}
                    <code style={{
                      color: 'var(--orange)', background: 'var(--surface2)',
                      padding: '2px 6px', borderRadius: '4px', fontSize: '14px',
                    }}>mapping.json</code> in your repo via the GitHub API.
                  </p>
              {/* Column headers */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr auto',
                gap: '12px', padding: '0 16px 10px',
              }}>
                {['Display name', 'GitHub repo', 'Userback project', ''].map((h, i) => (
                  <div key={i} style={{
                    fontSize: '13px', color: 'var(--muted)',
                    fontWeight: '600', textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}>
                    {h}
                  </div>
                ))}
              </div>

              {/* Repo filter */}
              <div style={{ marginBottom: '14px' }}>
                <input
                  value={repoSearch}
                  onChange={e => setRepoSearch(e.target.value)}
                  placeholder="Filter GitHub repos..."
                  style={{
                    width: '320px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border2)',
                    borderRadius: '8px',
                    color: 'var(--text)', fontSize: '14px',
                    padding: '8px 12px', outline: 'none',
                  }}
                />
                <span style={{
                  marginLeft: '12px', fontSize: '13px',
                  color: 'var(--muted)',
                }}>
                  {filteredRepos.length} of {githubRepos.length} repos
                </span>
              </div>

              {mapping.length === 0 && (
                <div style={{
                  textAlign: 'center', padding: '40px',
                  color: 'var(--muted)', fontSize: '15px',
                  border: '1px dashed var(--border2)',
                  borderRadius: '10px', marginBottom: '16px',
                }}>
                  No projects configured yet. Click "Add project" to get started.
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
                display: 'flex', gap: '12px', alignItems: 'center',
                marginTop: '20px', paddingTop: '20px',
                borderTop: '1px solid var(--border)',
              }}>
                <button
                  onClick={addProject}
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border2)',
                    color: 'var(--text)', borderRadius: '8px',
                    fontSize: '14px', fontWeight: '500',
                    padding: '10px 18px',
                  }}
                >
                  + Add project
                </button>

                <button
                  onClick={saveMapping}
                  disabled={saving}
                  style={{
                    background: saving ? 'var(--border2)' : 'var(--orange)',
                    border: 'none', color: '#fff',
                    borderRadius: '8px', fontSize: '14px',
                    fontWeight: '600', padding: '10px 22px',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    transition: 'background 0.15s',
                  }}
                >
                  {saving ? 'Saving...' : 'Save mapping'}
                </button>

                {saved && (
                  <span style={{
                    fontSize: '14px', color: 'var(--green)',
                    fontWeight: '500',
                  }}>
                    ✓ Saved to repo
                  </span>
                )}

                <div style={{ flex: 1 }} />

                <span style={{
                  fontSize: '13px', color: 'var(--muted)',
                }}>
                  {mapping.length} project{mapping.length !== 1 ? 's' : ''} configured
                </span>
              </div>

                  {/* Userback reference list */}
                  <div style={{ marginTop: '40px' }}>
                    <div style={{
                      fontSize: '13px', color: 'var(--muted)', fontWeight: '600',
                      textTransform: 'uppercase', letterSpacing: '0.5px',
                      marginBottom: '12px',
                    }}>
                      Userback projects ({userbackProjects.length})
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {userbackProjects.map(p => (
                        <div key={p.id} style={{
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px', padding: '6px 12px',
                          fontSize: '13px', color: 'var(--muted2)',
                        }}>
                          <span style={{ color: 'var(--orange)', fontWeight: '600' }}>{p.id}</span>
                          {' '}{p.name}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ═══ TAB: Team Members ═══ */}
              {adminTab === 'team' && (
                <div>
                  <p style={{ fontSize: '15px', color: 'var(--muted)', lineHeight: 1.6, marginBottom: '24px' }}>
                    Link GitHub usernames to Userback members so the dashboard can show consistent names
                    and filter by team member across both systems.
                  </p>

                {/* Column headers */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr auto',
                  gap: '12px', padding: '0 16px 10px',
                }}>
                  {['Display name', 'GitHub user', 'Userback member', ''].map((h, i) => (
                    <div key={i} style={{
                      fontSize: '13px', color: 'var(--muted)',
                      fontWeight: '600', textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                      {h}
                    </div>
                  ))}
                </div>

                {userMapping.length === 0 && (
                  <div style={{
                    textAlign: 'center', padding: '40px',
                    color: 'var(--muted)', fontSize: '15px',
                    border: '1px dashed var(--border2)',
                    borderRadius: '10px', marginBottom: '16px',
                  }}>
                    No team members mapped yet. Click "Add member" to get started.
                  </div>
                )}

                {userMapping.map((user, index) => {
                  const inputStyle = {
                    background: 'var(--surface2)',
                    border: '1px solid var(--border2)',
                    borderRadius: '8px',
                    color: 'var(--text)',
                    fontSize: '15px',
                    padding: '10px 12px',
                    width: '100%',
                    outline: 'none',
                  };

                  return (
                    <div key={index} style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr auto',
                      gap: '12px',
                      alignItems: 'center',
                      padding: '14px 16px',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '10px',
                      marginBottom: '10px',
                    }}>
                      {/* Display name */}
                      <input
                        value={user.displayName}
                        onChange={e => updateUserMapping(index, { ...user, displayName: e.target.value })}
                        placeholder="e.g. Chris Howell"
                        style={inputStyle}
                      />

                      {/* GitHub user */}
                      <select
                        value={user.githubLogin || ''}
                        onChange={e => updateUserMapping(index, { ...user, githubLogin: e.target.value || '' })}
                        style={{
                          ...inputStyle,
                          color: user.githubLogin ? 'var(--text)' : 'var(--muted)',
                        }}
                      >
                        <option value="">— No GitHub user —</option>
                        {githubMembers.map(m => (
                          <option key={m.login} value={m.login}>{m.login}</option>
                        ))}
                      </select>

                      {/* Userback member */}
                      <select
                        value={user.userbackUserId || ''}
                        onChange={e => {
                          const selected = userbackMembers.find(m => String(m.userId) === e.target.value);
                          updateUserMapping(index, {
                            ...user,
                            userbackUserId: e.target.value || '',
                            displayName: user.displayName || (selected?.name || ''),
                          });
                        }}
                        style={{
                          ...inputStyle,
                          color: user.userbackUserId ? 'var(--text)' : 'var(--muted)',
                        }}
                      >
                        <option value="">— No Userback member —</option>
                        {userbackMembers.map(m => (
                          <option key={m.userId || m.id} value={m.userId || m.id}>{m.name}</option>
                        ))}
                      </select>

                      {/* Remove */}
                      <button
                        onClick={() => removeUserMapping(index)}
                        style={{
                          background: 'var(--status-blocked-bg)',
                          border: '1px solid #e24b4a33',
                          borderRadius: '8px',
                          color: 'var(--status-blocked-text)',
                          fontSize: '16px',
                          padding: '8px 12px',
                          lineHeight: 1,
                        }}
                        title="Remove mapping"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}

                {/* Actions */}
                <div style={{
                  display: 'flex', gap: '12px', alignItems: 'center',
                  marginTop: '20px',
                }}>
                  <button
                    onClick={addUserMapping}
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border2)',
                      color: 'var(--text)', borderRadius: '8px',
                      fontSize: '14px', fontWeight: '500',
                      padding: '10px 18px',
                    }}
                  >
                    + Add member
                  </button>

                  <button
                    onClick={saveUserMapping}
                    disabled={savingUsers}
                    style={{
                      background: savingUsers ? 'var(--border2)' : 'var(--orange)',
                      border: 'none', color: '#fff',
                      borderRadius: '8px', fontSize: '14px',
                      fontWeight: '600', padding: '10px 22px',
                      cursor: savingUsers ? 'not-allowed' : 'pointer',
                      transition: 'background 0.15s',
                    }}
                  >
                    {savingUsers ? 'Saving...' : 'Save team mapping'}
                  </button>

                  {savedUsers && (
                    <span style={{ fontSize: '14px', color: 'var(--green)', fontWeight: '500' }}>
                      ✓ Saved to repo
                    </span>
                  )}
                </div>
              </div>
              )}
            </>
          )}
        </main>
      </div>
    </>
  );
}