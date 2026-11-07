import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { BrunoAvatar } from './Bruno';
import { tabTitle, useTabTitleOverride } from './tabTitle';

// Month options: this month and the previous five
function monthOptions(now = new Date()) {
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });
    return { value, label: i === 0 ? `${label} (so far)` : label };
  });
}
// Early in a month, the meeting is usually about the month just finished
const defaultMonth = (now = new Date()) => monthOptions(now)[now.getDate() <= 10 ? 1 : 0].value;

// Plain-text version of whatever is in the editor (links kept after each title)
function editorToPlain(el) {
  if (!el) return '';
  const text = node => {
    const c = node.cloneNode(true);
    c.querySelectorAll('a').forEach(a => a.replaceWith(`${a.textContent}: ${a.getAttribute('href')}`));
    c.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
    return c.textContent.trim();
  };
  const blocks = [];
  for (const node of el.children) {
    if (node.tagName === 'UL' || node.tagName === 'OL') blocks.push(Array.from(node.children).map(li => `- ${text(li)}`).join('\n'));
    else { const t = text(node); if (t) blocks.push(t); }
  }
  return blocks.join('\n\n');
}

export default function MonthlyReport({ project, onClose }) {
  const [month, setMonth] = useState(defaultMonth());
  const [spelling, setSpelling] = useState('ca');
  const [withBudget, setWithBudget] = useState(true);
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const editorRef = useRef(null);
  useTabTitleOverride(tabTitle(project.name, 'Monthly report'));

  const load = useCallback(async (m, sp, b) => {
    setBusy(true); setError(null); setCopied(false);
    try {
      const qs = new URLSearchParams({ project: project.userbackId, name: project.name, month: m, spelling: sp, budget: b ? '1' : '0' });
      const r = await fetch(`/api/report?${qs}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Couldn’t build the report');
      setReport(d);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }, [project]);

  useEffect(() => { load(month, spelling, withBudget); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const k = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  async function copy() {
    const html = editorRef.current?.innerHTML || report.html;
    const plain = editorToPlain(editorRef.current) || report.plain;
    try {
      if (window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plain], { type: 'text/plain' }),
        })]);
      } else await navigator.clipboard.writeText(plain);
      setCopied(true);
    } catch { try { await navigator.clipboard.writeText(plain); setCopied(true); } catch {} }
  }

  const sel = { background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: '8px', color: 'var(--text)', fontSize: '14px', padding: '7px 10px' };
  const change = (m, sp, b) => { setMonth(m); setSpelling(sp); setWithBudget(b); load(m, sp, b); };

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 2500, background: 'rgba(10,10,20,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div role="dialog" aria-label={`Monthly report for ${project.name}`} onClick={e => e.stopPropagation()} style={{
        width: 'min(760px, 100%)', maxHeight: '92vh', overflow: 'auto',
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '22px',
        boxShadow: '0 16px 48px var(--shadow)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
          <BrunoAvatar size={36} />
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text)' }}>Monthly report: {project.name}</h2>
            <div style={{ fontSize: '13px', color: 'var(--muted)' }}>{busy ? 'Bruno is pulling the month together…' : 'Prepared by Bruno for your status meeting. Edit anything before you share it.'}</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '20px', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '14px' }}>
          <select aria-label="Month" value={month} disabled={busy} onChange={e => change(e.target.value, spelling, withBudget)} style={sel}>
            {monthOptions().map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select aria-label="Spelling" value={spelling} disabled={busy} onChange={e => change(month, e.target.value, withBudget)} style={sel}>
            <option value="ca">Canadian spelling</option>
            <option value="us">US spelling</option>
          </select>
          <label style={{ fontSize: '14px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input type="checkbox" checked={withBudget} disabled={busy} onChange={e => change(month, spelling, e.target.checked)} /> Include budget
          </label>
        </div>

        {busy && <div style={{ color: 'var(--muted)', fontSize: '15px', padding: '40px 0', textAlign: 'center' }}>Bruno is pulling the month together…</div>}
        {error && !busy && <div style={{ color: 'var(--red)', fontSize: '14px' }}>{error}</div>}

        {report && !busy && (
          <>
            <div ref={editorRef} contentEditable suppressContentEditableWarning className="dt-email-draft dt-report"
              role="textbox" aria-multiline="true" aria-label="Report"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: '8px', padding: '14px 16px', color: 'var(--text)', fontSize: '15px', lineHeight: 1.55, maxHeight: '56vh', overflow: 'auto' }}
              dangerouslySetInnerHTML={{ __html: report.html }} />
            {!report.summaryAi && <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>Bruno’s overview wasn’t available, so the opening line is the standard wording.</div>}
            <div style={{ display: 'flex', gap: '10px', marginTop: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={copy} style={{ background: 'var(--orange)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', padding: '9px 16px' }}>
                {copied ? '✓ Copied' : 'Copy report'}
              </button>
              <button onClick={() => load(month, spelling, withBudget)} style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: '8px', fontSize: '14px', fontWeight: '600', padding: '9px 16px' }}>
                Refresh
              </button>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Paste into your agenda or an email; ticket titles stay linked.</span>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
