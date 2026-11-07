import Head from 'next/head';
import Link from 'next/link';

// Any bad link lands here. Bruno has seen worse.
export default function NotFound() {
  return (
    <>
      <Head><title>Page not found | Digiteam</title><meta name="robots" content="noindex,nofollow" /></Head>
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'var(--bg)' }}>
        <div style={{ maxWidth: '520px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <img src="/eggs/bruno-full.webp" alt="Bruno, lounging" style={{ width: '100%', maxWidth: '460px', borderRadius: '14px', boxShadow: '0 16px 48px var(--shadow)' }} />
          <h1 style={{ fontSize: '26px', fontWeight: '700', color: 'var(--text)' }}>Page not found.</h1>
          <p style={{ fontSize: '17px', color: 'var(--muted)', lineHeight: 1.5 }}>
            Unlike us, it didn’t make it to Christmas. Bruno looked everywhere. Well, he looked from here.
          </p>
          <Link href="/dashboard" style={{ background: 'var(--orange)', color: '#fff', borderRadius: '8px', padding: '10px 20px', fontWeight: '600', fontSize: '15px' }}>
            Back to the dashboard
          </Link>
        </div>
      </main>
    </>
  );
}
