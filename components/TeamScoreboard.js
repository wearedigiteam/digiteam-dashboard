import { useState, useEffect, useMemo, useRef } from 'react';
import { useArcade, getSeason } from './eggs';

// Team-first scoreboard: one shared weekly goal, team highlights and recent wins.
// No individual standings anywhere on purpose.
const COLORS = ['#f05a27', '#f7ad39', '#2d8a4e', '#378add', '#8b5cf6'];
const CANADA_DAY = ['#d52b1e', '#ffffff', '#d52b1e'];

function Confetti() {
  const palette = getSeason() === 'canada-day' ? CANADA_DAY : COLORS; // red and white on July 1
  const pieces = useMemo(() => Array.from({ length: 36 }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.4,
    dur: 1.6 + Math.random() * 1.2,
    rot: Math.random() * 360,
    color: palette[i % palette.length],
  })), [palette]);
  return (
    <div aria-hidden="true" className="dt-confetti">
      {pieces.map((p, i) => (
        <span key={i} style={{
          left: `${p.left}%`, background: p.color,
          animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`,
          transform: `rotate(${p.rot}deg)`,
        }} />
      ))}
    </div>
  );
}

function timeAgo(iso) {
  const mins = Math.round((Date.now() - new Date(iso)) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default function TeamScoreboard({ refreshKey }) {
  const [score, setScore] = useState(null);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const [celebrate, setCelebrate] = useState(null); // list of reward messages while playing
  const arcade = useArcade();

  useEffect(() => {
    let cancelled = false;
    fetch('/api/score').then(r => (r.ok ? r.json() : null)).then(s => {
      if (cancelled || !s) return;
      setScore(s);
      // The server decides: each reward plays once for each signed-in person
      if (s.celebrate?.length) {
        setCelebrate(s.celebrate);
        setTimeout(() => setCelebrate(null), 4000);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [refreshKey]);

  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === 'Escape') setOpen(false); };
    const onDoc = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDoc);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDoc); };
  }, [open]);

  if (!score) return null;

  const pct = score.goal > 0 ? Math.min(score.points / score.goal, 1) : 0;
  const reached = score.points >= score.goal;
  const remaining = Math.max(score.goal - score.points, 0);
  const streak = score.highlights.find(h => /running/i.test(h));
  const short = streak ? streak.replace(/^Goal hit (\d+) weeks? running$/i, '$1-week streak') : null;

  return (
    <div ref={wrapRef} className="dt-goal-wrap">
      {celebrate && (
        <div className="dt-celebrate-layer" aria-hidden={false}>
          <Confetti />
          <div role="status" className="dt-reward-toast">{celebrate.join(' and ')} 🎉</div>
        </div>
      )}

      {arcade ? (
        <button type="button" className="dt-goal-pill dt-arcade-banner dt-arcade-pill" onClick={() => setOpen(o => !o)} aria-expanded={open}>
          <span>HIGH SCORE</span>
          <span>TEAM&nbsp;&nbsp;{String(score.points).padStart(3, '0')}&nbsp;PTS</span>
          <span className="dt-blink">INSERT COIN</span>
        </button>
      ) : (
        <button type="button" className="dt-goal-pill" onClick={() => setOpen(o => !o)} aria-expanded={open}
          aria-label={`Team goal this week: ${score.points} of ${score.goal} points. Show details`}>
          <span className="dt-goal-label">Team goal</span>
          <span role="progressbar" aria-valuemin={0} aria-valuemax={score.goal} aria-valuenow={score.points}
            aria-label="Team points toward this week's goal" className="dt-goal-bar">
            <span style={{
              width: `${pct * 100}%`,
              background: reached ? 'var(--green)' : 'linear-gradient(90deg, #f7ad39, #f05a27)',
            }} />
          </span>
          <span className="dt-goal-num"><strong>{score.points}</strong><span> / {score.goal}</span></span>
          {reached ? <span className="dt-goal-extra" style={{ color: 'var(--green)' }}>· Goal reached 🎉</span>
            : short && <span className="dt-goal-extra">· {short}</span>}
          <span className="dt-goal-caret" aria-hidden="true">{open ? '▴' : '▾'}</span>
        </button>
      )}

      {open && (
        <section aria-label="Team scoreboard" className="dt-goal-pop">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text)' }}>Team goal this week</h2>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: '13px', fontWeight: '500', color: reached ? 'var(--green)' : 'var(--muted)' }}>
              {!score.tracking ? 'Starts counting from the next status change'
                : reached ? 'Goal reached 🎉' : `${remaining} to go`}
            </span>
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text)', margin: '6px 0 10px' }}>
            <strong style={{ fontSize: '18px' }}>{score.points}</strong>
            <span style={{ color: 'var(--muted)' }}> of {score.goal} points · {score.tickets} ticket{score.tickets === 1 ? '' : 's'} moved to review</span>
          </div>
          <div style={{ height: '8px', borderRadius: '4px', background: 'var(--surface2)', overflow: 'hidden' }}>
            <div style={{ width: `${pct * 100}%`, height: '100%', background: reached ? 'var(--green)' : 'linear-gradient(90deg, #f7ad39, #f05a27)' }} />
          </div>
          {score.highlights.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '12px' }}>
              {score.highlights.map(h => (
                <span key={h} style={{
                  fontSize: '12px', fontWeight: '500', color: 'var(--text2)',
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                  borderRadius: '999px', padding: '3px 10px',
                }}>{h}</span>
              ))}
            </div>
          )}
          <h3 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--muted)', margin: '14px 0 2px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Recent wins</h3>
          {score.recent.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '6px 0 0' }}>Nothing yet this week.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {score.recent.slice(0, 8).map((e, i) => (
                <li key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0',
                  borderBottom: '1px solid var(--border)', fontSize: '13px',
                  opacity: e.type === 'clawback' ? 0.65 : 1,
                }}>
                  <span style={{
                    fontFamily: 'var(--mono)', fontSize: '12px', fontWeight: '600', minWidth: '30px',
                    color: e.type === 'clawback' ? 'var(--red)' : 'var(--green)',
                  }}>{e.points > 0 ? `+${e.points}` : e.points}</span>
                  {e.url
                    ? <a href={e.url} target="_blank" rel="noreferrer" style={{ color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</a>
                    : <span style={{ color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</span>}
                  {e.type === 'clawback' && <span style={{ fontSize: '11px', color: 'var(--muted)' }}>back from review</span>}
                  {e.fossil && e.type !== 'clawback' && <span style={{ fontSize: '11px' }} title="Ticket over a year old">🦴 fossil</span>}
                  {e.aging && !e.fossil && e.type !== 'clawback' && <span style={{ fontSize: '11px', color: '#e07020' }}>30+ days</span>}
                  {e.project && <span style={{ fontSize: '11px', color: 'var(--muted2)', whiteSpace: 'nowrap' }}>{e.project}</span>}
                  <span style={{ fontSize: '11px', color: 'var(--muted2)', whiteSpace: 'nowrap', fontFamily: 'var(--mono)' }}>{timeAgo(e.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
