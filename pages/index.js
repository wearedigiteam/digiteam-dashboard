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

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.push('/dashboard');
      } else {
        setError('Incorrect password.');
        setLoading(false);
      }
    } catch {
      setError('Something went wrong. Try again.');
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Digiteam Dashboard</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
        padding: '24px',
      }}>
        {/* Background grid */}
        <div style={{
          position: 'fixed', inset: 0, zIndex: 0,
          backgroundImage: `
            linear-gradient(rgba(224,60,26,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(224,60,26,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '380px' }}>
          {/* Logo area */}
          <div style={{ marginBottom: '48px', textAlign: 'center' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '10px',
              marginBottom: '8px',
            }}>
              <div style={{
                width: '32px', height: '32px',
                background: 'var(--orange)',
                clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
              }} />
              <span style={{
                fontSize: '22px', fontWeight: '800', letterSpacing: '-0.5px',
                fontFamily: 'var(--font)',
              }}>
                digiteam
              </span>
            </div>
            <div style={{
              fontSize: '11px', color: 'var(--muted)', letterSpacing: '3px',
              textTransform: 'uppercase', fontFamily: 'var(--mono)',
            }}>
              Operations Dashboard
            </div>
          </div>

          {/* Login card */}
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '32px',
          }}>
            <div style={{
              fontSize: '11px', color: 'var(--muted)', letterSpacing: '2px',
              textTransform: 'uppercase', marginBottom: '24px',
              fontFamily: 'var(--mono)',
            }}>
              Access Required
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoFocus
                  style={{
                    width: '100%',
                    background: 'var(--bg)',
                    border: `1px solid ${error ? 'var(--red)' : 'var(--border2)'}`,
                    borderRadius: '3px',
                    color: 'var(--text)',
                    fontFamily: 'var(--mono)',
                    fontSize: '15px',
                    padding: '12px 14px',
                    outline: 'none',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--orange)'}
                  onBlur={e => e.target.style.borderColor = error ? 'var(--red)' : 'var(--border2)'}
                />
              </div>

              {error && (
                <div style={{
                  fontSize: '12px', color: 'var(--red)',
                  marginBottom: '16px', fontFamily: 'var(--mono)',
                }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !password}
                style={{
                  width: '100%',
                  background: loading || !password ? 'var(--border2)' : 'var(--orange)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '3px',
                  fontFamily: 'var(--font)',
                  fontWeight: '700',
                  fontSize: '13px',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  padding: '12px',
                  transition: 'background 0.15s',
                  cursor: loading || !password ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Authenticating...' : 'Enter'}
              </button>
            </form>
          </div>

          <div style={{
            marginTop: '24px', textAlign: 'center',
            fontSize: '11px', color: 'var(--muted)',
            fontFamily: 'var(--mono)',
          }}>
            Internal use only — do not share this link
          </div>
        </div>
      </div>
    </>
  );
}
