import { useState, useEffect, useMemo } from 'react';

// Team-first scoreboard: one shared weekly goal, team highlights and recent wins.
// No individual standings anywhere on purpose.
const COLORS = ['#f05a27', '#f7ad39', '#2d8a4e', '#378add', '#8b5cf6'];

function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 36 }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.4,
    dur: 1.6 + Math.random() * 1.2,
    rot: Math.random() * 360,
    color: COLORS[i % COLORS.length],
  })), []);
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
  const [showWins, setShowWins] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/score').then(r => (r.ok ? r.json() : null)).then(s => {
      if (cancelled || !s) return;
      setScore(s);
      // Celebrate once per browser per week when the goal is reached
      if (s.points >= s.goal && s.goal > 0) {
        const key = `dt_goal_celebrated_${s.week}`;
        let seen = false;
        try { seen = localStorage.getItem(key) === '1'; localStorage.setItem(key, '1'); } catch {}
        if (!seen) { setCelebrate(true); setTimeout(() => setCelebrate(false), 3500); }
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [refreshKey]);

  if (!score) return null;

  const pct = score.goal > 0 ? Math.min(score.points / score.goal, 1) : 0;
  const reached = score.points >= score.goal;
  const remaining = Math.max(score.goal - score.points, 0);

  return (
    <section aria-label="Team scoreboard" style={{
      position: 'relative', overflow: 'hidden',
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: '10px', padding: '16px 20px', marginBottom: '20px',
    }}>
      {celebrate && <Confetti />}

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text)' }}>Team goal this week</h2>
        <span style={{ fontSize: '15px', color: 'var(--text)' }}>
          <strong style={{ fontSize: '20px', fontWeight: '700' }}>{score.points}</strong>
          <span style={{ color: 'var(--muted)' }}> of {score.goal} points</span>
        </span>
        <span style={{ fontSize: '14px', color: 'var(--muted)' }}>
          {score.tickets} ticket{score.tickets === 1 ? '' : 's'} moved to review
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: '14px', fontWeight: '500', color: reached ? 'var(--green)' : 'var(--muted)' }}>
          {!score.tracking ? 'Starts counting from the next status change'
            : reached ? 'Goal reached 🎉' : `${remaining} to go`}
        </span>
      </div>

      <div role="progressbar" aria-valuemin={0} aria-valuemax={score.goal} aria-valuenow={score.points}
        aria-label="Team points toward this week's goal"
        style={{ height: '12px', borderRadius: '6px', background: 'var(--surface2)', overflow: 'hidden' }}>
        <div style={{
          width: `${pct * 100}%`, height: '100%', borderRadius: '6px',
          background: reached ? 'var(--green)' : 'linear-gradient(90deg, #f7ad39, #f05a27)',
          transition: 'width 0.6s ease',
        }} />
      </div>

      {(score.highlights.length > 0 || score.recent.length > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
          {score.highlights.map(h => (
            <span key={h} style={{
              fontSize: '13px', fontWeight: '500', color: 'var(--text2)',
              background: 'var(--surface2)', border: '1px solid var(--border)',
              borderRadius: '999px', padding: '3px 10px',
            }}>{h}</span>
          ))}
          <span style={{ flex: 1 }} />
          {score.recent.length > 0 && (
            <button onClick={() => setShowWins(v => !v)} aria-expanded={showWins} style={{
              background: 'none', border: 'none', color: 'var(--orange)', fontSize: '13px', fontWeight: '500', padding: '2px 0',
            }}>{showWins ? '▲ Hide recent wins' : '▼ Recent wins'}</button>
          )}
        </div>
      )}

      {showWins && (
        <ul style={{ listStyle: 'none', marginTop: '10px', borderTop: '1px solid var(--border)' }}>
          {score.recent.slice(0, 8).map((e, i) => (
            <li key={i} style={{
              display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0',
              borderBottom: '1px solid var(--border)', fontSize: '14px',
              opacity: e.type === 'clawback' ? 0.65 : 1,
            }}>
              <span style={{
                fontFamily: 'var(--mono)', fontSize: '13px', fontWeight: '600', minWidth: '34px',
                color: e.type === 'clawback' ? 'var(--red)' : 'var(--green)',
              }}>{e.points > 0 ? `+${e.points}` : e.points}</span>
              {e.url
                ? <a href={e.url} target="_blank" rel="noreferrer" style={{ color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</a>
                : <span style={{ color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</span>}
              {e.type === 'clawback' && <span style={{ fontSize: '12px', color: 'var(--muted)' }}>back from review</span>}
              {e.aging && e.type !== 'clawback' && <span style={{ fontSize: '12px', color: '#e07020' }}>30+ days</span>}
              {e.project && <span style={{ fontSize: '12px', color: 'var(--muted2)', whiteSpace: 'nowrap' }}>{e.project}</span>}
              <span style={{ fontSize: '12px', color: 'var(--muted2)', whiteSpace: 'nowrap', fontFamily: 'var(--mono)' }}>{timeAgo(e.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
