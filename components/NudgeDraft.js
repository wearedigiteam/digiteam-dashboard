import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { tabTitle, useTabTitleOverride } from './tabTitle';

// Modal that drafts a follow-up email for one client's waiting tickets.
export default function NudgeDraft({ project, tickets, onClose }) {
  const [spelling, setSpelling] = useState('ca');
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [subjectCopied, setSubjectCopied] = useState(false);
  const editorRef = useRef(null); // formatted, editable email (titles are links)
  useTabTitleOverride(tabTitle(project, 'Client follow-up'));

  const generate = useCallback(async sp => {
    setBusy(true); setError(null); setCopied(false); setSubjectCopied(false);
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
      setDraft({ subject: d.subject, body: d.body, html: d.html, ai: d.ai });
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }, [project, tickets]);

  useEffect(() => { generate(spelling); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Copies the formatted email so links survive pasting into Gmail/Outlook.
  // Apps that only take plain text get the title-then-link version.
  async function copy() {
    const html = editorRef.current?.innerHTML || draft.html;
    const plain = editorToPlain(editorRef.current) || draft.body;
    try {
      if (window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plain], { type: 'text/plain' }),
        })]);
      } else {
        await navigator.clipboard.writeText(plain);
      }
      setCopied(true);
    } catch {
      try { await navigator.clipboard.writeText(plain); setCopied(true); } catch {}
    }
  }

  // Plain version of whatever is in the editor now, keeping each link after its title
  function editorToPlain(el) {
    if (!el) return null;
    const text = node => {
      const clone = node.cloneNode(true);
      clone.querySelectorAll('a').forEach(a => a.replaceWith(`${a.textContent}: ${a.getAttribute('href')}`));
      clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
      return clone.textContent.trim();
    };
    const blocks = [];
    for (const node of el.children) {
      if (node.tagName === 'UL' || node.tagName === 'OL') {
        blocks.push(Array.from(node.children).map(li => `- ${text(li)}`).join('\n'));
      } else {
        const t = text(node);
        if (t) blocks.push(t);
      }
    }
    return blocks.length ? blocks.join('\n\n') : el.innerText;
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
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input value={draft.subject} onChange={e => { setDraft({ ...draft, subject: e.target.value }); setSubjectCopied(false); }} style={{ ...field, flex: 1 }} />
              <button onClick={async () => { try { await navigator.clipboard.writeText(draft.subject); setSubjectCopied(true); } catch {} }}
                style={{ ...btn(false), whiteSpace: 'nowrap' }}>{subjectCopied ? '✓ Copied' : 'Copy'}</button>
            </div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--muted)', marginBottom: '4px' }}>Email (you can edit it here)</label>
            <div ref={editorRef} contentEditable suppressContentEditableWarning className="dt-email-draft"
              aria-label="Email draft" role="textbox" aria-multiline="true"
              style={{ ...field, minHeight: '260px', maxHeight: '50vh', overflow: 'auto' }}
              dangerouslySetInnerHTML={{ __html: draft.html }} />
            {!draft.ai && <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>Bruno’s draft wasn’t available, so this is the standard template.</div>}
            <div style={{ display: 'flex', gap: '10px', marginTop: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={copy} style={btn(true)}>{copied ? '✓ Copied' : 'Copy email'}</button>
              <button onClick={() => generate(spelling)} style={btn(false)}>Redraft</button>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Paste into a new email; the titles stay linked. Nothing is sent from here.</span>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
