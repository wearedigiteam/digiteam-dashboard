import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { christmasInfo, companyAge, useToast } from './eggs';

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
  return <div key={toast.id} role="status" className="dt-toast">{toast.message}</div>;
}
