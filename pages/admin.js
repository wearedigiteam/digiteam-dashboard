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

function DigiteamLogo({ size = 28 }) {
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

export default function Admin() {
  const router = useRouter();
  const [mapping, setMapping] = useState([]);
  const [userbackProjects, setUserbackProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [adminTab, setAdminTab] = useState('projects');

  const [userMapping, setUserMapping] = useState([]);
  const [userbackMembers, setUserbackMembers] = useState([]);
  const [savingUsers, setSavingUsers] = useState(false);
  const [savedUsers, setSavedUsers] = useState(false);

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      setError(null);
      try {
        const [mappingRes, ubRes, userMapRes, ubMembersRes] = await Promise.all([
          fetch('/api/admin/mapping'),
          fetch('/api/userback-projects'),
          fetch('/api/admin/user-mapping'),
          fetch('/api/admin/userback-members'),
        ]);
        if (mappingRes.status === 401) { router.push('/'); return; }
        const [mappingData, ubData, userMapData, ubMembersData] = await Promise.all([
          mappingRes.json(), ubRes.json(), userMapRes.json(), ubMembersRes.json(),
        ]);
        setMapping(mappingData.mapping || []);
        setUserbackProjects(ubData.projects || []);
        setUserMapping(userMapData.userMapping || []);
        setUserbackMembers(ubMembersData.members || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, [router]);

  // ── Project mapping CRUD ──
  function addProject() {
    setMapping(m => [...m, { name: '', userbackId: '' }]);
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
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Save failed'); }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  // ── User mapping CRUD ──
  function addUserMapping() {
    setUserMapping(m => [...m, { displayName: '', userbackUserId: '' }]);
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
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Save failed'); }
      setSavedUsers(true);
      setTimeout(() => setSavedUsers(false), 3000);
    } catch (err) { setError(err.message); }
    finally { setSavingUsers(false); }
  }

  const inputStyle = {
    background: 'var(--surface2)', border: '1px solid var(--border2)',
    borderRadius: '8px', color: 'var(--text)', fontSize: '15px',
    padding: '10px 12px', width: '100%', outline: 'none',
  };

  return (
    <>
      <Head>
        <title>Admin — Digiteam Dashboard</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{ minHeight: '100vh' }}>
        <header className="dt-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <DigiteamLogo />
            <span className="dt-header-brand-text">digiteam</span>
          </div>
          <nav style={{ display: 'flex', gap: '6px', marginLeft: '24px' }}>
            <button onClick={() => router.push('/dashboard')} style={{
              background: 'transparent', color: 'rgba(255,255,255,0.5)',
              border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '500', padding: '6px 14px',
            }}>Dashboard</button>
            <button style={{
              background: 'rgba(247,173,57,0.15)', color: '#f7ad39',
              border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '500', padding: '6px 14px',
            }}>Admin</button>
          </nav>
          <div style={{ flex: 1 }} />
          <button onClick={() => router.push('/dashboard')} style={{
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
            color: '#fff', borderRadius: '6px', fontSize: '13px', fontWeight: '500', padding: '6px 14px',
          }}>← Dashboard</button>
        </header>

        <main className="dt-main">
          <h1 style={{ fontSize: '24px', fontWeight: '600', color: 'var(--text)', marginBottom: '20px' }}>Admin</h1>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '0', marginBottom: '28px', borderBottom: '2px solid var(--border)' }}>
            {[
              { key: 'projects', label: 'Projects', count: mapping.length },
              { key: 'team', label: 'Team members', count: userMapping.length },
            ].map(tab => (
              <button key={tab.key} onClick={() => setAdminTab(tab.key)} style={{
                background: 'none', border: 'none', padding: '10px 20px',
                fontSize: '15px', fontWeight: '600',
                color: adminTab === tab.key ? 'var(--orange)' : 'var(--muted)',
                borderBottom: adminTab === tab.key ? '2px solid var(--orange)' : '2px solid transparent',
                marginBottom: '-2px', cursor: 'pointer',
              }}>
                {tab.label}
                <span style={{
                  marginLeft: '8px', fontSize: '13px',
                  background: adminTab === tab.key ? 'var(--orange)' : 'var(--surface2)',
                  color: adminTab === tab.key ? '#fff' : 'var(--muted)',
                  padding: '2px 8px', borderRadius: '10px',
                }}>{tab.count}</span>
              </button>
            ))}
          </div>

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--muted)', fontSize: '15px' }}>
              <div style={{ width: '18px', height: '18px', border: '2px solid var(--border)', borderTopColor: 'var(--orange)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              Loading...
            </div>
          )}
          {error && (
            <div style={{ background: 'var(--status-blocked-bg)', border: '1px solid #e24b4a33', borderRadius: '10px', padding: '14px 18px', color: 'var(--red)', fontSize: '14px', marginBottom: '20px' }}>
              {error}
            </div>
          )}

          {!loading && (
            <>
              {/* ═══ Projects tab ═══ */}
              {adminTab === 'projects' && (
                <div>
                  <p style={{ fontSize: '15px', color: 'var(--muted)', lineHeight: 1.6, marginBottom: '24px' }}>
                    Select which Userback projects to track on the dashboard.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', padding: '0 16px 10px' }}>
                    {['Display name', 'Userback project', ''].map((h, i) => (
                      <div key={i} style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</div>
                    ))}
                  </div>

                  {mapping.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)', fontSize: '15px', border: '1px dashed var(--border2)', borderRadius: '10px', marginBottom: '16px' }}>
                      No projects configured. Click "Add project" to get started.
                    </div>
                  )}

                  {mapping.map((project, index) => (
                    <div key={index} style={{
                      display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px',
                      alignItems: 'center', padding: '14px 16px',
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: '10px', marginBottom: '10px',
                    }}>
                      <input value={project.name} onChange={e => updateProject(index, { ...project, name: e.target.value })}
                        placeholder="Project display name" style={inputStyle} />
                      <select value={project.userbackId || ''} onChange={e => {
                        const sel = userbackProjects.find(p => String(p.id) === e.target.value);
                        updateProject(index, {
                          ...project,
                          userbackId: e.target.value || null,
                          name: project.name || (sel?.name || ''),
                        });
                      }} style={{ ...inputStyle, color: project.userbackId ? 'var(--text)' : 'var(--muted)' }}>
                        <option value="">— Select project —</option>
                        {userbackProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <button onClick={() => removeProject(index)} style={{
                        background: 'var(--status-blocked-bg)', border: '1px solid #e24b4a33',
                        borderRadius: '8px', color: 'var(--status-blocked-text)',
                        fontSize: '16px', padding: '8px 12px', lineHeight: 1,
                      }}>×</button>
                    </div>
                  ))}

                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
                    <button onClick={addProject} style={{
                      background: 'var(--surface)', border: '1px solid var(--border2)',
                      color: 'var(--text)', borderRadius: '8px', fontSize: '14px', fontWeight: '500', padding: '10px 18px',
                    }}>+ Add project</button>
                    <button onClick={saveMapping} disabled={saving} style={{
                      background: saving ? 'var(--border2)' : 'var(--orange)',
                      border: 'none', color: '#fff', borderRadius: '8px',
                      fontSize: '14px', fontWeight: '600', padding: '10px 22px',
                      cursor: saving ? 'not-allowed' : 'pointer',
                    }}>{saving ? 'Saving...' : 'Save projects'}</button>
                    {saved && <span style={{ fontSize: '14px', color: 'var(--green)', fontWeight: '500' }}>✓ Saved</span>}
                    <div style={{ flex: 1 }} />
                    <span style={{ fontSize: '13px', color: 'var(--muted)' }}>{mapping.length} project{mapping.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              )}

              {/* ═══ Team members tab ═══ */}
              {adminTab === 'team' && (
                <div>
                  <p style={{ fontSize: '15px', color: 'var(--muted)', lineHeight: 1.6, marginBottom: '24px' }}>
                    Map display names to Userback members for consistent names and team filtering on the dashboard.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', padding: '0 16px 10px' }}>
                    {['Display name', 'Userback member', ''].map((h, i) => (
                      <div key={i} style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</div>
                    ))}
                  </div>

                  {userMapping.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)', fontSize: '15px', border: '1px dashed var(--border2)', borderRadius: '10px', marginBottom: '16px' }}>
                      No team members mapped. Click "Add member" to get started.
                    </div>
                  )}

                  {userMapping.map((user, index) => (
                    <div key={index} style={{
                      display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px',
                      alignItems: 'center', padding: '14px 16px',
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: '10px', marginBottom: '10px',
                    }}>
                      <input value={user.displayName} onChange={e => updateUserMapping(index, { ...user, displayName: e.target.value })}
                        placeholder="e.g. Chris Howell" style={inputStyle} />
                      <select value={user.userbackUserId || ''} onChange={e => {
                        const sel = userbackMembers.find(m => String(m.userId) === e.target.value);
                        updateUserMapping(index, {
                          ...user,
                          userbackUserId: e.target.value || '',
                          displayName: user.displayName || (sel?.name || ''),
                        });
                      }} style={{ ...inputStyle, color: user.userbackUserId ? 'var(--text)' : 'var(--muted)' }}>
                        <option value="">— Select member —</option>
                        {userbackMembers.map(m => <option key={m.userId || m.id} value={m.userId || m.id}>{m.name}</option>)}
                      </select>
                      <button onClick={() => removeUserMapping(index)} style={{
                        background: 'var(--status-blocked-bg)', border: '1px solid #e24b4a33',
                        borderRadius: '8px', color: 'var(--status-blocked-text)',
                        fontSize: '16px', padding: '8px 12px', lineHeight: 1,
                      }}>×</button>
                    </div>
                  ))}

                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '20px' }}>
                    <button onClick={addUserMapping} style={{
                      background: 'var(--surface)', border: '1px solid var(--border2)',
                      color: 'var(--text)', borderRadius: '8px', fontSize: '14px', fontWeight: '500', padding: '10px 18px',
                    }}>+ Add member</button>
                    <button onClick={saveUserMapping} disabled={savingUsers} style={{
                      background: savingUsers ? 'var(--border2)' : 'var(--orange)',
                      border: 'none', color: '#fff', borderRadius: '8px',
                      fontSize: '14px', fontWeight: '600', padding: '10px 22px',
                      cursor: savingUsers ? 'not-allowed' : 'pointer',
                    }}>{savingUsers ? 'Saving...' : 'Save team mapping'}</button>
                    {savedUsers && <span style={{ fontSize: '14px', color: 'var(--green)', fontWeight: '500' }}>✓ Saved</span>}
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
