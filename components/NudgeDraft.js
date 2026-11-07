import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

// Modal that drafts a follow-up email for one client's waiting tickets.
export default function NudgeDraft({ project, tickets, onClose }) {
  const [spelling, setSpelling] = useState('ca');
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const generate = useCallback(async sp => {
    setBusy(true); setError(null); setCopied(false);
    try {
      const r = await fetch('/api/nudge-draft', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project, spelling: sp,
          tickets: tickets.map(t => ({ title: t.title, url: t.url, status: t.workflowName, days: t._days })),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Couldn’t draft the email');
      setDraft({ subject: d.subject, body: d.body, ai: d.ai });
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }, [project, tickets]);

  useEffect(() => { generate(spelling); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function copy() {
    try { await navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`); setCopied(true); } catch {}
  }

  const field = {
    width: '100%', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: '8px',
    color: 'var(--text)', fontSize: '15px', padding: '10px 12px', fontFamily: 'var(--font)', lineHeight: 1.5,
  };
  const btn = (primary) => ({
    background: primary ? 'var(--orange)' : 'var(--surface2)', color: primary ? '#fff' : 'var(--text)',
    border: primary ? 'none' : '1px solid var(--border2)', borderRadius: '8px',
    fontSize: '14px', fontWeight: '600', padding: '9px 16px',
  });

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 2500, background: 'rgba(10,10,20,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div role="dialog" aria-label={`Follow-up email for ${project}`} onClick={e => e.stopPropagation()} style={{
        width: 'min(680px, 100%)', maxHeight: '90vh', overflow: 'auto',
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '22px',
        boxShadow: '0 16px 48px var(--shadow)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text)', flex: 1 }}>Follow-up for {project}</h2>
          <label style={{ fontSize: '13px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Spelling
            <select value={spelling} disabled={busy} onChange={e => { setSpelling(e.target.value); generate(e.target.value); }}
              className="dt-assignee-select" style={{ minWidth: 0 }}>
              <option value="ca">Canadian</option>
              <option value="us">US</option>
            </select>
          </label>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '20px', lineHeight: 1 }}>×</button>
        </div>

        {busy && <div style={{ color: 'var(--muted)', fontSize: '15px', padding: '30px 0', textAlign: 'center' }}>Drafting…</div>}
        {error && !busy && <div style={{ color: 'var(--red)', fontSize: '14px' }}>{error}</div>}

        {draft && !busy && (
          <>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--muted)', marginBottom: '4px' }}>Subject</label>
            <input value={draft.subject} onChange={e => setDraft({ ...draft, subject: e.target.value })} style={{ ...field, marginBottom: '12px' }} />
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--muted)', marginBottom: '4px' }}>Email</label>
            <textarea value={draft.body} onChange={e => setDraft({ ...draft, body: e.target.value })} rows={14} style={{ ...field, resize: 'vertical' }} />
            {!draft.ai && <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>The AI draft wasn’t available, so this is the standard template.</div>}
            <div style={{ display: 'flex', gap: '10px', marginTop: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={copy} style={btn(true)}>{copied ? '✓ Copied' : 'Copy email'}</button>
              <a href={`mailto:?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`} style={{ ...btn(false), textDecoration: 'none' }}>Open in email app</a>
              <button onClick={() => generate(spelling)} style={btn(false)}>Redraft</button>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Nothing is sent from here. Add the recipient in your email app.</span>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
