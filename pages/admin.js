import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { getUser, isAdmin } from '../lib/auth';
import ThemeToggle from '../components/ThemeToggle';

export async function getServerSideProps({ req, resolvedUrl }) {
  const user = await getUser(req);
  if (!user) {
    return { redirect: { destination: `/?next=${encodeURIComponent(resolvedUrl)}`, permanent: false } };
  }
  if (!isAdmin(user)) return { redirect: { destination: '/dashboard', permanent: false } };
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

// ── Currency formatting (all budget figures are before HST) ──────────────────
const cad = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const fmt = n => cad.format(Number(n) || 0);

// Shows "$28,800.00" normally; switches to the plain number while editing
function CurrencyInput({ value, onChange, label, style }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={label}
      value={editing ? draft : (value ? fmt(value) : '')}
      placeholder={fmt(0)}
      onFocus={e => {
        setDraft(value ? String(value) : '');
        setEditing(true);
        requestAnimationFrame(() => e.target.select());
      }}
      onChange={e => {
        const raw = e.target.value.replace(/[^0-9.]/g, '');  // accept pasted "$1,234.56"
        setDraft(raw);
        onChange(raw);
      }}
      onBlur={() => setEditing(false)}
      style={style}
    />
  );
}

// Gauge shows what's left of the annual budget: (annual - used) / annual
function GasGauge({ used, annual }) {
  if (!annual || annual <= 0) return null;
  const spent     = used || 0;
  const remaining = annual - spent;
  const over      = remaining < 0;
  const pct       = Math.max(0, Math.min(remaining / annual, 1));
  const color     = pct > 0.5 ? '#2d8a4e' : pct > 0.25 ? '#e07020' : '#c02020';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
      title={`${fmt(spent)} used of ${fmt(annual)}`}>
      <div style={{
        width: '120px', height: '12px', borderRadius: '6px',
        background: over ? '#c0202033' : 'var(--border)', overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct * 100}%`, height: '100%', borderRadius: '6px',
          background: color, transition: 'width 0.3s',
        }} />
      </div>
      <span style={{
        fontSize: '13px', fontFamily: 'var(--mono)', whiteSpace: 'nowrap',
        color: over ? '#c02020' : 'var(--muted)', fontWeight: over ? '600' : '400',
      }}>
        {over
          ? `${fmt(Math.abs(remaining))} over`
          : `${fmt(remaining)} left`}
      </span>
    </div>
  );
}

export default function Admin() {
  const router = useRouter();
  const [projects, setProjects] = useState([]);
  const [budgets, setBudgets]   = useState({});
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState(null);

  // Monday Slack summary
  const [members, setMembers]             = useState([]);
  const [slack, setSlack]                 = useState({});
  const [slackSaving, setSlackSaving]     = useState(false);
  const [slackSaved, setSlackSaved]       = useState(false);
  const [slackError, setSlackError]       = useState(null);
  const [testState, setTestState]         = useState({}); // { [userId]: { busy, ok, message } }

  // Team birthdays (month and day only)
  const [bdays, setBdays]           = useState({}); // { [email]: 'MM-DD' }
  const [bdaySaving, setBdaySaving] = useState(false);
  const [bdayMsg, setBdayMsg]       = useState(null); // { ok, text }
  useEffect(() => {
    fetch('/api/birthdays').then(r => (r.ok ? r.json() : { birthdays: [] }))
      .then(d => setBdays(Object.fromEntries((d.birthdays || []).map(b => [b.email.toLowerCase(), b.md])))).catch(() => {});
  }, []);
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function setBday(email, part, value) {
    setBdays(prev => {
      const [m = '', d = ''] = (prev[email] || '').split('-');
      const next = part === 'm' ? [value, d] : [m, value];
      return { ...prev, [email]: next[0] || next[1] ? `${next[0]}-${next[1]}` : '' };
    });
    setBdayMsg(null);
  }
  async function saveBdays() {
    setBdaySaving(true); setBdayMsg(null);
    try {
      const list = members.filter(m => m.email).map(m => ({ email: m.email, name: m.name, md: bdays[m.email.toLowerCase()] || '' }))
        .filter(b => /^\d{2}-\d{2}$/.test(b.md));
      const r = await fetch('/api/birthdays', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ birthdays: list }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Save failed');
      setBdayMsg({ ok: true, text: '✓ Saved' });
    } catch (err) { setBdayMsg({ ok: false, text: err.message }); }
    finally { setBdaySaving(false); }
  }

  // Userback API health and #alerts
  const [health, setHealth]       = useState(null);
  const [alertTest, setAlertTest] = useState(null); // { busy } | { ok, message }

  useEffect(() => {
    fetch('/api/admin/health').then(r => (r.ok ? r.json() : null)).then(setHealth).catch(() => {});
  }, []);

  async function sendTestAlert() {
    setAlertTest({ busy: true });
    try {
      const r = await fetch('/api/admin/health', { method: 'POST' });
      const d = await r.json();
      setAlertTest({ ok: d.ok, message: d.ok ? 'Sent' : d.error });
    } catch (err) { setAlertTest({ ok: false, message: err.message }); }
  }

  useEffect(() => {
    async function loadData() {
      setLoading(true); setError(null);
      try {
        const [dataRes, budgetRes, slackRes] = await Promise.all([
          fetch('/api/data'),
          fetch('/api/admin/budgets'),
          fetch('/api/admin/slack-settings'),
        ]);
        if (dataRes.status === 401) { router.push('/'); return; }
        const [dataJson, budgetJson, slackJson] = await Promise.all([
          dataRes.json(), budgetRes.json(), slackRes.json(),
        ]);
        setProjects(dataJson.projects || []);
        setBudgets(budgetJson.budgets || {});
        setMembers(dataJson.teamMembers || []);
        setSlack(slackJson.settings || {});
      } catch (err) { setError(err.message); }
      finally { setLoading(false); }
    }
    loadData();
  }, [router]);

  function updateBudget(projectId, field, value) {
    setBudgets(prev => ({
      ...prev,
      [projectId]: {
        ...(prev[projectId] || { used: 0, annual: 0 }),
        [field]: parseFloat(value) || 0,
      },
    }));
  }

  // Strip the old "credit on hand" field so only annual + used are stored
  function cleanBudgets(all) {
    const out = {};
    for (const [id, b] of Object.entries(all)) {
      out[id] = { annual: b.annual || 0, used: b.used || 0 };
    }
    return out;
  }

  async function saveBudgets() {
    setSaving(true); setError(null); setSaved(false);
    try {
      const res = await fetch('/api/admin/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budgets: cleanBudgets(budgets) }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Save failed');
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  function updateSlack(userId, field, value) {
    setSlack(prev => ({
      ...prev,
      [userId]: { ...(prev[userId] || { slackId: '', enabled: false }), [field]: value },
    }));
    setSlackSaved(false);
  }

  async function saveSlack() {
    setSlackSaving(true); setSlackError(null); setSlackSaved(false);
    try {
      const res = await fetch('/api/admin/slack-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: slack }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Save failed');
      setSlack(d.settings);
      setSlackSaved(true);
      setTimeout(() => setSlackSaved(false), 3000);
    } catch (err) { setSlackError(err.message); }
    finally { setSlackSaving(false); }
  }

  async function sendTest(userId) {
    setTestState(prev => ({ ...prev, [userId]: { busy: true } }));
    try {
      const res = await fetch('/api/admin/slack-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, slackId: (slack[userId]?.slackId || '').trim() }),
      });
      const d = await res.json();
      setTestState(prev => ({ ...prev, [userId]: { ok: d.ok, message: d.message } }));
    } catch (err) {
      setTestState(prev => ({ ...prev, [userId]: { ok: false, message: err.message } }));
    }
  }

  const inputStyle = {
    background: 'var(--surface2)', border: '1px solid var(--border2)',
    borderRadius: '8px', color: 'var(--text)', fontSize: '15px',
    padding: '10px 12px', width: '100%', outline: 'none',
    textAlign: 'right',
  };

  return (
    <>
      <Head>
        <title>Admin – Budgets and settings | Digiteam</title>
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
          <ThemeToggle />
          <button onClick={() => router.push('/dashboard')} style={{
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
            color: '#fff', borderRadius: '6px', fontSize: '13px', fontWeight: '500', padding: '6px 14px',
          }}>← Dashboard</button>
        </header>

        <main className="dt-main" style={{ maxWidth: '900px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '600', color: 'var(--text)', marginBottom: '8px' }}>
            Maintenance budgets
          </h1>
          <p style={{ fontSize: '15px', color: 'var(--muted)', lineHeight: 1.6, marginBottom: '28px' }}>
            Set each project's annual budget and the total invoiced so far this year. The gauge shows what's left.
          </p>
          <div style={{
            fontSize: '14px', color: 'var(--text2)', background: 'var(--surface2)',
            border: '1px solid var(--border)', borderLeft: '3px solid var(--amber)',
            borderRadius: '8px', padding: '10px 14px', marginBottom: '28px', marginTop: '-12px',
          }}>
            All amounts exclude HST.
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
              {/* Column headers */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 160px 160px 1fr',
                gap: '12px', padding: '0 16px 10px',
              }}>
                {['Project', 'Annual budget', 'Budget used', 'Remaining'].map((h, i) => (
                  <div key={i} style={{
                    fontSize: '12px', color: 'var(--muted)', fontWeight: '600',
                    textTransform: 'uppercase', letterSpacing: '0.5px',
                    textAlign: i === 1 || i === 2 ? 'right' : 'left',
                  }}>{h}</div>
                ))}
              </div>

              {projects.map(project => {
                const b = budgets[project.userbackId] || { used: 0, annual: 0 };
                return (
                  <div key={project.userbackId} style={{
                    display: 'grid', gridTemplateColumns: '1fr 160px 160px 1fr',
                    gap: '12px', alignItems: 'center', padding: '12px 16px',
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: '10px', marginBottom: '8px',
                  }}>
                    <div style={{ fontSize: '15px', fontWeight: '500', color: 'var(--text)' }}>
                      {project.name}
                    </div>
                    <div>
                      <CurrencyInput
                        value={b.annual}
                        onChange={v => updateBudget(project.userbackId, 'annual', v)}
                        label={`Annual budget for ${project.name}`}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <CurrencyInput
                        value={b.used}
                        onChange={v => updateBudget(project.userbackId, 'used', v)}
                        label={`Budget used for ${project.name}`}
                        style={inputStyle}
                      />
                    </div>
                    <GasGauge used={b.used} annual={b.annual} />
                  </div>
                );
              })}

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
                <button onClick={saveBudgets} disabled={saving} style={{
                  background: saving ? 'var(--border2)' : 'var(--orange)',
                  border: 'none', color: '#fff', borderRadius: '8px',
                  fontSize: '14px', fontWeight: '600', padding: '10px 22px',
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}>{saving ? 'Saving...' : 'Save budgets'}</button>
                {saved && <span style={{ fontSize: '14px', color: 'var(--green)', fontWeight: '500' }}>✓ Saved</span>}
              </div>

              {/* ── Monday Slack summary ─────────────────────────────── */}
              <h2 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text)', margin: '48px 0 8px' }}>
                Monday Slack summary
              </h2>
              <p style={{ fontSize: '15px', color: 'var(--muted)', lineHeight: 1.6, marginBottom: '28px' }}>
                Each person switched on gets a Slack DM before the production meeting with their own open items.
                Paste their Slack member ID (in Slack: their profile, then the ⋮ menu, then Copy member ID).
                Leave it blank to match by email. Send test uses the ID shown here, saved or not, and sends a real DM to that person.
              </p>

              {slackError && (
                <div style={{ background: 'var(--status-blocked-bg)', border: '1px solid #e24b4a33', borderRadius: '10px', padding: '14px 18px', color: 'var(--red)', fontSize: '14px', marginBottom: '20px' }}>
                  {slackError}
                </div>
              )}

              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 180px 80px 1fr',
                gap: '12px', padding: '0 16px 10px',
              }}>
                {['Person', 'Slack member ID', 'Send', ''].map((h, i) => (
                  <div key={i} style={{
                    fontSize: '12px', color: 'var(--muted)', fontWeight: '600',
                    textTransform: 'uppercase', letterSpacing: '0.5px',
                    textAlign: i === 2 ? 'center' : 'left',
                  }}>{h}</div>
                ))}
              </div>

              {members.map(m => {
                const s = slack[m.userId] || { slackId: '', enabled: false };
                const t = testState[m.userId];
                const badId = s.slackId && !/^[UW][A-Z0-9]{6,}$/i.test(s.slackId.trim());
                return (
                  <div key={m.userId} style={{
                    display: 'grid', gridTemplateColumns: '1fr 180px 80px 1fr',
                    gap: '12px', alignItems: 'center', padding: '12px 16px',
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: '10px', marginBottom: '8px',
                  }}>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: '500', color: 'var(--text)' }}>{m.name}</div>
                      {m.email && <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{m.email}</div>}
                    </div>
                    <div>
                      <input
                        type="text"
                        value={s.slackId}
                        onChange={e => updateSlack(m.userId, 'slackId', e.target.value)}
                        placeholder="Match by email"
                        aria-label={`Slack member ID for ${m.name}`}
                        style={{ ...inputStyle, textAlign: 'left', fontFamily: 'var(--mono)', fontSize: '14px',
                          borderColor: badId ? 'var(--red)' : undefined }}
                      />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={s.enabled}
                        onChange={e => updateSlack(m.userId, 'enabled', e.target.checked)}
                        aria-label={`Send Monday summary to ${m.name}`}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button onClick={() => sendTest(m.userId)} disabled={t?.busy} style={{
                        background: 'var(--surface2)', border: '1px solid var(--border2)',
                        color: 'var(--text)', borderRadius: '6px', fontSize: '13px', fontWeight: '500',
                        padding: '6px 12px', cursor: t?.busy ? 'not-allowed' : 'pointer', flexShrink: 0,
                      }}>{t?.busy ? 'Sending...' : 'Send test'}</button>
                      {t && !t.busy && (
                        <span style={{ fontSize: '13px', color: t.ok ? 'var(--green)' : 'var(--red)' }}>
                          {t.ok ? '✓ Sent' : t.message}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
                <button onClick={saveSlack} disabled={slackSaving} style={{
                  background: slackSaving ? 'var(--border2)' : 'var(--orange)',
                  border: 'none', color: '#fff', borderRadius: '8px',
                  fontSize: '14px', fontWeight: '600', padding: '10px 22px',
                  cursor: slackSaving ? 'not-allowed' : 'pointer',
                }}>{slackSaving ? 'Saving...' : 'Save Slack settings'}</button>
                {slackSaved && <span style={{ fontSize: '14px', color: 'var(--green)', fontWeight: '500' }}>✓ Saved</span>}
              </div>


              {/* ── Team birthdays ─────────────────────────────────── */}
              <h2 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text)', margin: '48px 0 8px' }}>
                Team birthdays
              </h2>
              <p style={{ fontSize: '15px', color: 'var(--muted)', lineHeight: 1.6, marginBottom: '20px' }}>
                Month and day only. For the week before, everyone else sees a countdown in the header and gets a heads-up in their Monday DM. The birthday person sees nothing until the day, when Bruno throws a party.
              </p>
              {members.filter(m => m.email).map(m => {
                const [mm = '', dd = ''] = (bdays[m.email.toLowerCase()] || '').split('-');
                const sel = { background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: '8px', color: 'var(--text)', fontSize: '14px', padding: '8px 10px' };
                return (
                  <div key={m.email} style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', flexWrap: 'wrap',
                    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', marginBottom: '8px',
                  }}>
                    <div style={{ flex: 1, minWidth: '180px', fontSize: '15px', fontWeight: '500', color: 'var(--text)' }}>{m.name}</div>
                    <select aria-label={`Birthday month for ${m.name}`} value={mm} onChange={e => setBday(m.email.toLowerCase(), 'm', e.target.value)} style={sel}>
                      <option value="">Month</option>
                      {MONTHS.map((name, i) => <option key={name} value={String(i + 1).padStart(2, '0')}>{name}</option>)}
                    </select>
                    <select aria-label={`Birthday day for ${m.name}`} value={dd} onChange={e => setBday(m.email.toLowerCase(), 'd', e.target.value)} style={sel}>
                      <option value="">Day</option>
                      {Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0')).map(d => <option key={d} value={d}>{Number(d)}</option>)}
                    </select>
                  </div>
                );
              })}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '16px' }}>
                <button onClick={saveBdays} disabled={bdaySaving} style={{
                  background: bdaySaving ? 'var(--border2)' : 'var(--orange)', border: 'none', color: '#fff', borderRadius: '8px',
                  fontSize: '14px', fontWeight: '600', padding: '10px 22px', cursor: bdaySaving ? 'not-allowed' : 'pointer',
                }}>{bdaySaving ? 'Saving...' : 'Save birthdays'}</button>
                {bdayMsg && <span style={{ fontSize: '14px', color: bdayMsg.ok ? 'var(--green)' : 'var(--red)', fontWeight: '500' }}>{bdayMsg.text}</span>}
              </div>

              {/* ── Userback API alerts ─────────────────────────────── */}
              <h2 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text)', margin: '48px 0 8px' }}>
                Userback API alerts
              </h2>
              <p style={{ fontSize: '15px', color: 'var(--muted)', lineHeight: 1.6, marginBottom: '20px' }}>
                The dashboard checks the Userback API once a day. If it fails two days running, a message goes to your alerts channel, and another when it recovers.
              </p>
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px',
                padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
              }}>
                <div style={{ flex: 1, minWidth: '240px', fontSize: '15px', color: 'var(--text)', lineHeight: 1.6 }}>
                  {!health ? 'Checking…' : (
                    <>
                      <div>
                        Right now: {health.live?.ok
                          ? <strong style={{ color: 'var(--green)' }}>working</strong>
                          : <strong style={{ color: 'var(--red)' }}>failing{health.live?.status ? ` (HTTP ${health.live.status})` : ''}</strong>}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                        {health.lastCheck ? `Last daily check ${new Date(health.lastCheck.at).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}: ${health.lastCheck.ok ? 'OK' : 'failed'}` : 'No daily check has run yet'}
                        {health.failing && ` (failing since ${health.failing.firstFail}${health.failing.alerted ? ', alert sent' : ''})`}
                      </div>
                      {!health.alertsChannelSet && (
                        <div style={{ fontSize: '13px', color: 'var(--red)' }}>SLACK_ALERTS_CHANNEL isn’t set in Vercel, so alerts can’t be sent.</div>
                      )}
                    </>
                  )}
                </div>
                <button onClick={sendTestAlert} disabled={alertTest?.busy} style={{
                  background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--text)',
                  borderRadius: '6px', fontSize: '13px', fontWeight: '500', padding: '8px 14px',
                  cursor: alertTest?.busy ? 'not-allowed' : 'pointer',
                }}>{alertTest?.busy ? 'Sending...' : 'Send test alert'}</button>
                {alertTest && !alertTest.busy && (
                  <span style={{ fontSize: '13px', color: alertTest.ok ? 'var(--green)' : 'var(--red)' }}>
                    {alertTest.ok ? '✓ Sent' : alertTest.message}
                  </span>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}
