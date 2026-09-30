import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { getTokenFromRequest, verifyToken } from '../lib/auth';

export async function getServerSideProps({ req }) {
  const token = getTokenFromRequest(req);
  if (token && verifyToken(token)) {
    return { redirect: { destination: '/dashboard', permanent: false } };
  }
  return { props: {} };
}

function DigiteamLogo({ size = 48 }) {
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

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) { router.push('/dashboard'); }
      else { setError('Incorrect password.'); setLoading(false); }
    } catch { setError('Something went wrong.'); setLoading(false); }
  }

  return (
    <>
      <Head>
        <title>Digiteam Dashboard</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '24px' }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          <div style={{ marginBottom: '48px', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
              <DigiteamLogo size={44} />
              <span style={{ fontSize: '26px', fontWeight: '700', letterSpacing: '-0.5px', color: 'var(--text)' }}>digiteam</span>
            </div>
            <div style={{ fontSize: '14px', color: 'var(--muted)', letterSpacing: '2px', textTransform: 'uppercase' }}>Userback Dashboard</div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '36px' }}>
            <div style={{ fontSize: '14px', color: 'var(--muted)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '24px', fontWeight: '600' }}>Sign in</div>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '18px' }}>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" autoFocus
                  style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: '8px', color: 'var(--text)', fontSize: '16px', padding: '14px 16px', outline: 'none' }} />
              </div>
              {error && <div style={{ fontSize: '14px', color: 'var(--red)', marginBottom: '16px' }}>{error}</div>}
              <button type="submit" disabled={loading || !password}
                style={{ width: '100%', background: loading || !password ? 'var(--border2)' : 'var(--orange)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '15px', textTransform: 'uppercase', padding: '14px', cursor: loading || !password ? 'not-allowed' : 'pointer' }}>
                {loading ? 'Authenticating...' : 'Enter'}
              </button>
            </form>
          </div>
          <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '13px', color: 'var(--muted)' }}>Internal use only</div>
        </div>
      </div>
    </>
  );
}
