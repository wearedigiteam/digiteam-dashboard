import { useState } from 'react';
import Head from 'next/head';
import { signIn } from 'next-auth/react';
import { getUser } from '../lib/auth';

// Only allow redirects to paths on this site (blocks //evil.com and full URLs)
function safeNext(next) {
  if (typeof next !== 'string') return '/dashboard';
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/dashboard';
  return next;
}

const ERRORS = {
  AccessDenied: 'That Google account isn’t a Digiteam account. Sign in with your @digiteam.ca address.',
  default: 'Sign-in didn’t work. Try again.',
};

export async function getServerSideProps({ req, query }) {
  // NextAuth sends people back with callbackUrl; older links use next
  const next = safeNext(query.callbackUrl || query.next);
  if (await getUser(req)) {
    return { redirect: { destination: next, permanent: false } };
  }
  const error = query.error ? (ERRORS[query.error] || ERRORS.default) : null;
  return { props: { next, error } };
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
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

export default function Login({ next = '/dashboard', error = null }) {
  const [loading, setLoading] = useState(false);

  function handleSignIn() {
    setLoading(true);
    signIn('google', { callbackUrl: next });
  }

  return (
    <>
      <Head>
        <title>Sign in | Digiteam</title>
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
            {error && <div role="alert" style={{ fontSize: '14px', color: 'var(--red)', marginBottom: '16px', lineHeight: 1.5 }}>{error}</div>}
            <button type="button" onClick={handleSignIn} disabled={loading}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                background: '#fff', color: '#1f1f1f', border: '1px solid #dadce0', borderRadius: '8px',
                fontWeight: '600', fontSize: '15px', padding: '13px', cursor: loading ? 'wait' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}>
              <GoogleMark />
              {loading ? 'Redirecting to Google…' : 'Sign in with Google'}
            </button>
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '14px', textAlign: 'center' }}>
              Use your @digiteam.ca account
            </div>
          </div>
          <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '13px', color: 'var(--muted)' }}>Internal use only</div>
        </div>
      </div>
    </>
  );
}
