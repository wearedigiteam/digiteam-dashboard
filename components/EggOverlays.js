import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { christmasInfo, companyAge, useToast } from './eggs';
import { BrunoAvatar } from './Bruno';

function useEscape(onClose) {
  useEffect(() => {
    const k = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
}

function Backdrop({ onClose, label, children }) {
  useEscape(onClose);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div onClick={onClose} role="dialog" aria-label={label} className="dt-egg-backdrop">{children}</div>,
    document.body
  );
}

// Falling pieces in a given palette (leaves for Canada Day, ornaments for Christmas)
export function Shower({ colors, shape = 'confetti', count = 40 }) {
  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => ({
    left: Math.random() * 100, delay: Math.random() * 0.8, dur: 2.2 + Math.random() * 1.6,
    color: colors[i % colors.length], rot: Math.random() * 360,
  })), [colors, count]);
  return (
    <div aria-hidden="true" className="dt-shower">
      {pieces.map((p, i) => (
        <span key={i} className={shape === 'leaf' ? 'dt-leaf' : ''} style={{
          left: `${p.left}%`, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`,
          color: p.color, background: shape === 'leaf' ? 'none' : p.color, transform: `rotate(${p.rot}deg)`,
        }}>{shape === 'leaf' ? '🍁' : ''}</span>
      ))}
    </div>
  );
}

// "...if we're still doing this by Christmas..."
//   mode 'countdown' (Dec 1–24, from the tree in the header): days to go
//   mode 'verdict'   (first visit Dec 25–Jan 6): the stamp comes down
export function ChristmasOverlay({ mode, onClose }) {
  const x = christmasInfo();
  return (
    <Backdrop onClose={onClose} label="If we're still doing this by Christmas">
      {mode === 'verdict' && <Shower colors={['#c0392b', '#1e7d4f', '#f7ad39', '#ffffff']} />}
      <figure className="dt-xmas" onClick={e => e.stopPropagation()}>
        <div className="dt-xmas-art">
          <img src="/eggs/still-doing-this.webp" alt="“…if we’re still doing this by Christmas…”" />
          {mode === 'verdict' && (
            <div className="dt-stamp" aria-hidden="true">
              <span>Still doing this</span>
              <small>Christmas #{x.number}</small>
            </div>
          )}
        </div>
        <figcaption>
          {mode === 'verdict' ? (
            <>
              <strong>Verdict for Christmas #{x.number}: still doing this.</strong>
              <span>Founded July 1, 2020. The joke is now {x.number} Christmases old.</span>
            </>
          ) : (
            <>
              <strong>{x.daysUntil} day{x.daysUntil === 1 ? '' : 's'} until we find out if we’re still doing this.</strong>
              <span>Christmas #{x.upcoming}. Previous verdicts: {x.upcoming - 1} for {x.upcoming - 1}.</span>
            </>
          )}
          <button onClick={onClose}>Back to work</button>
        </figcaption>
      </figure>
    </Backdrop>
  );
}

// July 1: Canada Day and Digiteam's birthday
export function BirthdayOverlay({ onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 6000); return () => clearTimeout(t); }, [onClose]);
  const age = companyAge();
  return (
    <Backdrop onClose={onClose} label="Happy birthday Digiteam">
      <Shower colors={['#d52b1e']} shape="leaf" count={36} />
      <div className="dt-egg-card">
        <div className="dt-egg-big" aria-hidden="true">🍁</div>
        <strong>Happy Canada Day, and happy {age === 1 ? '1st' : age === 2 ? '2nd' : age === 3 ? '3rd' : `${age}th`} birthday, Digiteam.</strong>
        <span>Founded July 1, 2020. Still doing this.</span>
      </div>
    </Backdrop>
  );
}

// Your own queue hit zero
export function TrophyOverlay({ onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 4500); return () => clearTimeout(t); }, [onClose]);
  return (
    <Backdrop onClose={onClose} label="Queue cleared">
      <Shower colors={['#f7ad39', '#f05a27', '#2d8a4e']} />
      <div className="dt-egg-card">
        <div className="dt-egg-big dt-trophy" aria-hidden="true">🏆</div>
        <strong>Queue cleared.</strong>
        <span>Nothing open with your name on it. Enjoy it while it lasts.</span>
      </div>
    </Backdrop>
  );
}

export function ToastHost() {
  const toast = useToast();
  if (!toast) return null;
  return (
    <div key={toast.id} role="status" className={toast.bruno ? 'dt-toast dt-toast-bruno' : 'dt-toast'}>
      {toast.bruno && <BrunoAvatar size={30} />}
      <span>{toast.message}</span>
      {toast.action && <button onClick={toast.action.onClick}>{toast.action.label}</button>}
    </div>
  );
}

// Your own birthday: Bruno shows up with "presents"
export function MyBirthdayOverlay({ name, onClose }) {
  return (
    <Backdrop onClose={onClose} label="Happy birthday">
      <Shower colors={['#f05a27', '#f7ad39', '#8b5cf6', '#378add', '#2d8a4e']} />
      <div className="dt-egg-card">
        <BrunoAvatar size={88} className="dt-bruno-party" />
        <strong>Happy birthday, {name}! 🎂</strong>
        <span>Bruno got you nothing. He’s a baboon. But the team’s glad you’re still doing this.</span>
      </div>
    </Backdrop>
  );
}

// Dec 31 – Jan 6: "Digiteam Wrapped", team numbers only, presented by Bruno
export function WrappedOverlay({ onClose }) {
  const [y, setY] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    fetch('/api/wrapped').then(r => r.json()).then(d => (d.error ? setError(d.error) : setY(d))).catch(e => setError(e.message));
  }, []);
  const since = y?.trackingSince && new Date(y.trackingSince).getFullYear() === y.year
    ? new Date(y.trackingSince).toLocaleDateString('en-CA', { month: 'long', day: 'numeric' }) : null;
  const weekLabel = w => new Date(`${w}T12:00:00`).toLocaleDateString('en-CA', { month: 'long', day: 'numeric' });
  const stats = y ? [
    [y.tickets, 'tickets moved into review'],
    [y.points, 'team points'],
    [y.agingCleared, 'tickets rescued from 30+ days of silence'],
    [y.fossils, `fossil${y.fossils === 1 ? '' : 's'} excavated (over a year old)`],
    y.longestStreak ? [y.longestStreak, `week${y.longestStreak === 1 ? '' : 's'} in a row hitting the goal`] : null,
  ].filter(Boolean) : [];
  return (
    <Backdrop onClose={onClose} label="Digiteam Wrapped">
      <div className="dt-wrapped" onClick={e => e.stopPropagation()}>
        <div className="dt-wrapped-head">
          <BrunoAvatar size={52} />
          <div>
            <h2>Digiteam Wrapped {y?.year || ''}</h2>
            <span>{since ? `Since tracking started on ${since}` : 'Presented by Bruno'}</span>
          </div>
        </div>
        {error && <p className="dt-wrapped-note">Bruno couldn’t find the numbers: {error}</p>}
        {!y && !error && <p className="dt-wrapped-note">Bruno is counting…</p>}
        {y && (
          <>
            <div className="dt-wrapped-grid">
              {stats.map(([n, label]) => (
                <div key={label}><strong>{Number(n).toLocaleString('en-CA')}</strong><span>{label}</span></div>
              ))}
            </div>
            <ul className="dt-wrapped-list">
              {y.bestWeek && <li>Best week: <strong>{weekLabel(y.bestWeek.week)}</strong>, {y.bestWeek.points} points.</li>}
              {y.busiestClient && <li>Kept us busiest: <strong>{y.busiestClient.name}</strong>, {y.busiestClient.tickets} tickets.</li>}
              <li>Verdict for the year: <strong>still doing this.</strong></li>
            </ul>
          </>
        )}
        <button onClick={onClose}>Back to work</button>
      </div>
    </Backdrop>
  );
}
