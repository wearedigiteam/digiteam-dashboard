import { useState, useEffect } from 'react';

// Theme is stored in a cookie so it survives sign-outs and the 7-day session expiry.
// It's per browser: each person's own machine keeps its own setting.
const COOKIE = 'dt_theme';
const ONE_YEAR = 60 * 60 * 24 * 365;

export default function ThemeToggle() {
  const [theme, setTheme] = useState(null); // null until mounted, avoids a hydration mismatch

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    document.cookie = `${COOKIE}=${next}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax${
      location.protocol === 'https:' ? '; Secure' : ''}`;
    setTheme(next);
  }

  const isDark = theme === 'dark';
  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
        color: '#fff', borderRadius: '6px', fontSize: '14px', lineHeight: 1,
        width: '32px', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        visibility: theme ? 'visible' : 'hidden', flexShrink: 0,
      }}
    >
      {isDark ? '☀' : '☾'}
    </button>
  );
}
