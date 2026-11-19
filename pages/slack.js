import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Head from 'next/head';
import { signOut } from 'next-auth/react';
import { getUser, isAdmin } from '../lib/auth';
import AppNav, { DigiteamLogo } from '../components/AppNav';
import ThemeToggle from '../components/ThemeToggle';
import { tabTitle } from '../components/tabTitle';

export async function getServerSideProps({ req, resolvedUrl }) {
  const user = await getUser(req);
  if (!user) return { redirect: { destination: `/?next=${encodeURIComponent(resolvedUrl)}`, permanent: false } };
  return { props: { canAdmin: isAdmin(user), workspace: process.env.SLACK_WORKSPACE_URL || 'https://digiteam-space.slack.com' } };
}

const RANGES = [['1', '24h'], ['3', '3 days'], ['7', '7 days'], ['14', '14 days']];
const STRICT = [['lenient', 'Lenient'], ['balanced', 'Balanced'], ['strict', 'Strict']];
const MODES = [['signal', 'Work only'], ['all', 'Everything'], ['noise', 'Hall of shame']];
const COLORS = ['#f05a27', '#2f80ed', '#9b51e0', '#27ae60', '#d4a017', '#e0457b', '#0f8a85'];

// Per-viewer conveniences only; labels and corrections live on the server
const prefs = {
  get(k, d) { try { const v = localStorage.getItem(`dt-slack:${k}`); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(`dt-slack:${k}`, JSON.stringify(v)); } catch { /* private window */ } },
};

// ── Formatting ──────────────────────────────────────────────────────────────
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const decode = s => s.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
const tsDate = ts => new Date(parseFloat(ts) * 1000);
const fmtTime = ts => tsDate(ts).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' });
const fmtDay = ts => tsDate(ts).toLocaleDateString('en-CA', { weekday: 'long', month: 'short', day: 'numeric' });
function ago(ms) {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 60) return `${Math.max(m, 1)}m`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h}h` : `${Math.round(h / 24)}d`;
}
function colorFor(id) {
  let h = 0;
  for (const c of String(id || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

// Slack mrkdwn → safe HTML (everything is escaped first; only http(s) links become anchors)
function mrkdwn(raw, people) {
  let s = decode(raw || '');
  const blocks = [];
  s = s.replace(/```([\s\S]*?)```/g, (_, c) => { blocks.push(c); return `\u0000${blocks.length - 1}\u0000`; });
  s = esc(s);
  s = s.replace(/&lt;@(U\w+)(?:\|([^&]+?))?&gt;/g, (_, id, n) => `<b>@${esc(n || people[id]?.name || id)}</b>`);
  s = s.replace(/&lt;!(here|channel|everyone)[^&]*&gt;/g, '<b>@$1</b>');
  s = s.replace(/&lt;mailto:[^|&]+\|([^&]+?)&gt;/g, '$1');
  s = s.replace(/&lt;(https?:[^|&\s]+(?:&amp;[^|&\s]+)*)\|([^]*?)&gt;/g, (_, u, t) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`);
  s = s.replace(/&lt;(https?:[^&\s]+(?:&amp;[^&\s]+)*)&gt;/g, (_, u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`);
  s = s.replace(/&lt;#(C\w+)\|([^&]*)&gt;/g, (_, id, n) => `#${n || id}`);
  s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>'); // Claude sometimes writes Markdown bold
  s = s.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<b>$2</b>');
  s = s.replace(/(^|[\s(])_([^_\n]+)_/g, '$1<i>$2</i>');
  s = s.replace(/^&gt; ?(.*)$/gm, '<blockquote>$1</blockquote>');
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<pre>${esc(blocks[+i])}</pre>`);
  return s;
}

function Seg({ label, options, value, onChange }) {
  return (
    <div className="dt-sig-seg-wrap">
      <span className="dt-sig-lbl">{label}</span>
      <div className="dt-sig-seg" role="group" aria-label={label}>
        {options.map(([v, l]) => (
          <button key={v} type="button" className={value === v ? 'on' : ''} aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>
        ))}
      </div>
    </div>
  );
}

function Avatar({ m, people, size = 34 }) {
  const p = m.uid ? people[m.uid] : null;
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) };
  if (p?.image && !m.isBot) return <img className="dt-sig-av" src={p.image} alt="" style={style} />;
  return <div className="dt-sig-av" aria-hidden="true" style={{ ...style, background: m.isBot ? '#3b5bdb' : colorFor(m.uid || m.name) }}>{(m.name || '?')[0].toUpperCase()}</div>;
}

export default function SlackTab({ canAdmin, workspace }) {
  const [channels, setChannels] = useState(null);
  const [listError, setListError] = useState(null);
  const [current, setCurrent] = useState(null);
  const [range, setRange] = useState('3');
  const [strict, setStrict] = useState('balanced');
  const [mode, setMode] = useState('signal');
  const [bots, setBots] = useState(true);
  const [data, setData] = useState(null);            // { channel, messages, labels, overrides, people, ai }
  const [status, setStatus] = useState({ text: '', err: false });
  const [digest, setDigest] = useState(undefined);   // undefined = not yet, null = writing, [] / [..]
  // The digest opens by default. Collapsing it is remembered per channel along with what it said;
  // it stays collapsed until the digest changes (i.e. there's new work or ticket movement to read).
  const [collapsedSig, setCollapsedSig] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());
  const [listOpen, setListOpen] = useState(false);
  const token = useRef(0);
  // Messages scroll in their own panel on wider screens (the page scrolls on phones). Opening a
  // channel jumps to the newest message at the bottom and stays pinned there while the digest and
  // labels load, until you scroll up. Scrolled up, a "Jump to latest" button appears (or press End).
  const feedRef = useRef(null);
  const topRef = useRef(null);
  const stick = useRef(true);
  const openedFor = useRef(null);
  const [showJump, setShowJump] = useState(false);
  const isNarrow = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
  const scrollToLatest = (smooth = false) => {
    const narrow = isNarrow();
    const f = feedRef.current;
    const distance = narrow ? document.documentElement.scrollHeight - window.innerHeight - window.scrollY : (f ? f.scrollHeight - f.clientHeight - f.scrollTop : 0);
    const behavior = smooth && distance < 3000 ? 'smooth' : 'auto'; // long jumps are instant
    if (narrow) window.scrollTo({ top: document.documentElement.scrollHeight, behavior });
    else if (f) f.scrollTo({ top: f.scrollHeight, behavior });
  };
  const toBottom = () => { if (stick.current) scrollToLatest(); };
  const jumpToLatest = () => { stick.current = true; setShowJump(false); scrollToLatest(true); };
  useEffect(() => {
    if (!data?.channel) return;
    const key = `${data.channel.id}:${range}`;
    if (openedFor.current !== key) { openedFor.current = key; stick.current = true; setShowJump(false); }
    requestAnimationFrame(toBottom);
  }, [data, digest, range, mode, bots]);
  useEffect(() => {
    const f = feedRef.current;
    if (!f) return;
    const update = () => {
      const gap = isNarrow()
        ? document.documentElement.scrollHeight - window.innerHeight - window.scrollY
        : f.scrollHeight - f.clientHeight - f.scrollTop;
      stick.current = gap < 40;
      setShowJump(gap > 200);
    };
    const onKey = e => {
      if (e.key !== 'End' || /input|select|textarea/i.test(e.target?.tagName || '')) return;
      e.preventDefault(); stick.current = true; setShowJump(false); scrollToLatest(true);
    };
    // Scrolling up stops the pin straight away (a small wheel tick could otherwise be pulled back down)
    const onFeedWheel = e => { if (e.deltaY < 0) stick.current = false; };
    // The top section (toolbar, counts, digest) doesn't scroll on wider screens, so the wheel there
    // moves the messages. The digest scrolls itself first, then hands over to the messages.
    const top = topRef.current;
    const onTopWheel = e => {
      if (isNarrow() || !feedRef.current || e.ctrlKey) return;
      const box = e.target.closest?.('.dt-sig-digest');
      if (box) {
        const canDown = box.scrollTop + box.clientHeight < box.scrollHeight - 1;
        const canUp = box.scrollTop > 0;
        if ((e.deltaY > 0 && canDown) || (e.deltaY < 0 && canUp)) return;
      }
      e.preventDefault();
      if (e.deltaY < 0) stick.current = false;
      const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? feedRef.current.clientHeight : 1;
      feedRef.current.scrollBy({ top: e.deltaY * unit });
    };
    f.addEventListener('wheel', onFeedWheel, { passive: true });
    top?.addEventListener('wheel', onTopWheel, { passive: false });
    f.addEventListener('scroll', update, { passive: true });
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('keydown', onKey);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => toBottom()) : null;
    ro?.observe(f);
    return () => {
      f.removeEventListener('wheel', onFeedWheel); top?.removeEventListener('wheel', onTopWheel);
      f.removeEventListener('scroll', update); window.removeEventListener('scroll', update);
      window.removeEventListener('keydown', onKey); ro?.disconnect();
    };
  }, []);

  // Restore per-viewer settings
  useEffect(() => {
    setRange(prefs.get('range', '3'));
    setStrict(prefs.get('strict', 'balanced'));
    setMode(prefs.get('mode', 'signal'));
    setBots(prefs.get('bots', true));
  }, []);

  const loadChannels = useCallback(async (fresh = false) => {
    setListError(null);
    try {
      const r = await fetch(`/api/slack/channels${fresh ? '?fresh=1' : ''}`);
      if (r.status === 401) { window.location.href = '/?next=/slack'; return; }
      const d = await r.json();
      setChannels(d.channels || []);
      if (d.error) setListError(d.error);
      return d.channels || [];
    } catch (err) { setListError(err.message); setChannels([]); return []; }
  }, []);

  const load = useCallback(async (ch, { fresh = false, r = range, s = strict } = {}) => {
    const my = ++token.current;
    setCurrent(ch);
    prefs.set('current', ch.id);
    try { history.replaceState(null, '', `/slack?c=${ch.id}`); } catch { /* ignore */ }
    setExpanded(new Set());
    stick.current = true;
    openedFor.current = null;
    setData(null);
    setDigest(undefined);
    setStatus({ text: `Reading #${ch.name}…`, err: false });
    try {
      const res = await fetch(`/api/slack/channel?id=${encodeURIComponent(ch.id)}&range=${r}&strict=${s}${fresh ? '&fresh=1' : ''}`);
      const d = await res.json();
      if (my !== token.current) return;
      if (!res.ok) { setStatus({ text: d.error || 'Couldn’t read this channel.', err: true }); return; }
      setData(d);
      if (!d.ai) {
        setStatus({ text: 'ANTHROPIC_API_KEY isn’t set, so nothing can be sorted. Showing everything.', err: true });
        return;
      }
      // Sort whatever's new, a batch at a time
      const known = ts => d.overrides[ts]?.l || d.labels[ts];
      let remaining = d.messages.reduce((n, m) => n + [m, ...(m.thread || [])].filter(x => !x.isBot && !known(x.ts)).length, 0);
      let guard = 0;
      while (remaining > 0 && guard++ < 20) {
        setStatus({ text: `Sorting work from noise… ${remaining} to go`, err: false });
        const sr = await fetch('/api/slack/sort', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: ch.id, range: r, strict: s }) });
        const sd = await sr.json();
        if (my !== token.current) return;
        if (!sr.ok) { setStatus({ text: sd.error || 'Sorting failed.', err: true }); break; }
        setData(prev => prev && ({ ...prev, labels: { ...prev.labels, ...sd.labels } }));
        if (!Object.keys(sd.labels || {}).length) break;
        remaining = sd.remaining;
      }
      if (my !== token.current) return;
      setStatus(prev => (prev.err ? prev : { text: '', err: false }));
      setDigest(null);
      const dr = await fetch('/api/slack/digest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: ch.id, range: r, strict: s }) });
      const dd = await dr.json();
      if (my !== token.current) return;
      setDigest(dr.ok ? (dd.bullets || []) : [`Couldn’t write the digest: ${dd.error || dr.status}`]);
    } catch (err) {
      if (my === token.current) setStatus({ text: `Something went wrong: ${err.message}`, err: true });
    }
  }, [range, strict]);

  // First load: channel list, then the channel from the URL or last visit
  useEffect(() => {
    (async () => {
      const list = await loadChannels();
      const want = new URLSearchParams(window.location.search).get('c') || prefs.get('current', null);
      const ch = list.find(c => c.id === want);
      if (ch) load(ch);
      else setStatus({ text: list.length ? 'Pick a channel on the left.' : '', err: false });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeRange = v => { setRange(v); prefs.set('range', v); if (current) load(current, { r: v }); };
  const changeStrict = v => { setStrict(v); prefs.set('strict', v); if (current) load(current, { s: v }); };
  const changeMode = v => { setMode(v); prefs.set('mode', v); };
  const changeBots = v => { setBots(v); prefs.set('bots', v); };

  const people = data?.people || {};
  const labelOf = useCallback(m => {
    if (m.isBot) return 'b';
    const o = data?.overrides?.[m.ts]?.l;
    if (o) return o;
    if (data?.labels?.[m.ts]) return data.labels[m.ts];
    return data?.ai === false ? 'w' : 'p';
  }, [data]);

  const digestSig = Array.isArray(digest) ? String(digest.join('\n').split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)) : null;
  const digestKey = current ? `digest:${current.id}:${range}:${strict}` : null;
  useEffect(() => { setCollapsedSig(digestKey ? prefs.get(digestKey, null) : null); }, [digestKey]);
  // Collapsed stays collapsed while a fresh digest is being written; once it's back, it opens only if it changed
  const digestOpen = digestSig ? collapsedSig !== digestSig : !collapsedSig;
  function toggleDigest() {
    if (!digestKey) return;
    const next = digestOpen ? digestSig : null; // collapsing remembers what it said; null = open
    if (digestOpen && !digestSig) return;       // nothing to remember while it's still being written
    setCollapsedSig(next);
    prefs.set(digestKey, next);
  }

  async function flip(m) {
    if (!data) return;
    const cur = labelOf(m);
    if (cur !== 'w' && cur !== 'n') return;
    const next = cur === 'w' ? 'n' : 'w';
    const ai = data.labels[m.ts];
    const value = next === ai ? null : next; // flipping back to Claude's call clears the correction
    setData(prev => {
      const overrides = { ...prev.overrides };
      if (value === null) delete overrides[m.ts]; else overrides[m.ts] = { l: value, by: 'you' };
      return { ...prev, overrides };
    });
    try {
      await fetch('/api/slack/label', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: data.channel.id, ts: m.ts, label: value }) });
    } catch { /* stays local until the next load */ }
  }

  // ── Stats and noise meter ──
  const stats = useMemo(() => {
    if (!data) return null;
    let human = 0, work = 0, noise = 0, pend = 0, botN = 0;
    const per = {};
    for (const m of data.messages) for (const x of [m, ...(m.thread || [])]) {
      const l = labelOf(x);
      if (l === 'b') { botN++; continue; }
      human++;
      const key = x.uid || x.name;
      const p = per[key] || (per[key] = { name: x.name, uid: x.uid, w: 0, n: 0 });
      if (l === 'w') { work++; p.w++; } else if (l === 'n') { noise++; p.n++; } else pend++;
    }
    const ppl = Object.values(per).filter(p => p.w + p.n > 0)
      .map(p => ({ ...p, pct: Math.round((p.n / (p.w + p.n)) * 100) }))
      .sort((a, b) => b.pct - a.pct);
    return { human, work, noise, pend, botN, pct: work + noise ? Math.round((noise / (work + noise)) * 100) : 0, ppl };
  }, [data, labelOf]);

  const visible = l => (mode === 'all' ? true : mode === 'noise' ? l === 'n' : l !== 'n');

  // ── Feed ──
  // cont: same person as the message just above (no one else in between), so skip the name and photo
  function renderMessage(m, lab, parentTs, cont = false) {
    const tag = { w: ['w', 'Work'], n: ['n', 'Noise'], b: ['b', m.userback ? 'Userback' : 'Bot'], p: ['p', 'Sorting…'] }[lab];
    const canFlip = lab === 'w' || lab === 'n';
    const link = `${workspace}/archives/${data.channel.id}/p${m.ts.replace('.', '')}${parentTs ? `?thread_ts=${parentTs}&cid=${data.channel.id}` : ''}`;
    const tagEl = canFlip
      ? <button type="button" className={`dt-sig-tag ${tag[0]} flip`} onClick={() => flip(m)}
          title="Wrong? Click to flip it for the whole team" aria-label={`${tag[1]}. Click to mark as ${lab === 'w' ? 'noise' : 'work'}`}>
          {tag[1]}{data.overrides[m.ts] ? ' ✎' : ''}
        </button>
      : <span className={`dt-sig-tag ${tag[0]}`}>{tag[1]}</span>;
    const body = (
      <>
        <div className="dt-sig-body" dangerouslySetInnerHTML={{ __html: mrkdwn(m.text, people) }} />
        {m.files?.length > 0 && <div className="dt-sig-files">📎 {m.files.join(', ')}</div>}
      </>
    );
    const cls = `dt-sig-msg${cont ? ' cont' : ''}${lab === 'n' ? ' noise' : ''}${m.isBot ? ' bot' : ''}`;
    if (cont) {
      return (
        <div key={`${parentTs || ''}${m.ts}`} className={cls}>
          <span className="dt-sig-cont-time" aria-hidden="true">{fmtTime(m.ts).replace(/\s?[ap]\.?m\.?$/i, '')}</span>
          <div className="dt-sig-cont-row">
            <div style={{ minWidth: 0, flex: 1 }}>
              <span className="dt-sr-only">{m.name} at {fmtTime(m.ts)}: </span>
              {body}
            </div>
            <a className="open" href={link} target="_blank" rel="noopener noreferrer" title="Open in Slack" aria-label="Open in Slack">↗</a>
            {tagEl}
          </div>
        </div>
      );
    }
    return (
      <div key={`${parentTs || ''}${m.ts}`} className={cls}>
        <Avatar m={m} people={people} />
        <div style={{ minWidth: 0 }}>
          <div className="dt-sig-meta">
            <b>{m.name}</b>
            <span className="t">{fmtTime(m.ts)}</span>
            <a className="open" href={link} target="_blank" rel="noopener noreferrer">Open in Slack ↗</a>
            {tagEl}
          </div>
          {body}
        </div>
      </div>
    );
  }

  // One run of messages (top level or a thread): hidden runs collapse to a pill, bot runs group
  function renderSeq(seq, groupKey) {
    const out = [];
    let hidden = [], botRun = [];
    // Consecutive messages from the same person, with nothing in between, show as one group
    let last = null;
    const pushMsg = item => {
      const who = item.m.uid || item.m.name;
      out.push(item.node(!item.m.isBot && last === who));
      if (item.after) { out.push(item.after); last = null; } else last = item.m.isBot ? null : who;
    };
    const flushHidden = () => {
      if (!hidden.length) return;
      const key = `${groupKey}:${hidden[0].m.ts}`;
      if (expanded.has(key)) hidden.forEach(pushMsg);
      else {
        last = null;
        const names = [...new Set(hidden.map(h => h.m.name))].join(', ');
        const what = mode === 'noise' ? 'work' : 'noise';
        out.push(
          <button key={`pill-${key}`} type="button" className="dt-sig-pill" onClick={() => setExpanded(prev => new Set(prev).add(key))}>
            {hidden.length} {what} message{hidden.length > 1 ? 's' : ''} hidden · {names}
          </button>
        );
      }
      hidden = [];
    };
    const flushBots = () => {
      if (!botRun.length) return;
      last = null;
      if (botRun.length === 1) { out.push(botRun[0].node()); if (botRun[0].after) out.push(botRun[0].after); }
      else {
        const allUb = botRun.every(b => b.m.userback);
        out.push(
          <details key={`bots-${botRun[0].m.ts}`} className="dt-sig-botgroup">
            <summary>{botRun.length} {allUb ? 'Userback updates' : 'bot updates'}</summary>
            {botRun.map(b => b.node())}
          </details>
        );
      }
      botRun = [];
    };
    for (const item of seq) {
      if (item.m.isBot) {
        if (!bots || mode === 'noise') continue;
        flushHidden(); botRun.push(item); continue;
      }
      if (!item.show) { flushBots(); hidden.push(item); continue; }
      flushHidden(); flushBots();
      pushMsg(item);
    }
    flushHidden(); flushBots();
    return out;
  }

  function renderFeed() {
    if (!data) return null;
    if (!data.messages.length) return <div className="dt-sig-blank"><h3>Nothing posted in this window</h3><p>Try a longer range.</p></div>;
    const days = [];
    for (const m of data.messages) {
      const day = fmtDay(m.ts);
      if (!days.length || days[days.length - 1].day !== day) days.push({ day, items: [] });
      days[days.length - 1].items.push(m);
    }
    let anyShown = false;
    const sections = days.map(({ day, items }) => {
      const seq = items.map(m => {
        const lab = labelOf(m);
        const replies = (m.thread || []).map(r => ({ m: r, lab: labelOf(r) }));
        const replyShown = replies.filter(r => (r.m.isBot ? bots : visible(r.lab))).length;
        const show = m.isBot ? true : visible(lab);
        const keepForThread = !show && replyShown > 0; // keep a hidden parent (dimmed) when its thread has visible replies
        if (show || keepForThread) anyShown = true;
        let after = null;
        if (replies.length) {
          const inner = renderSeq(replies.map(r => ({ m: r.m, lab: r.lab, show: visible(r.lab), node: cont => renderMessage(r.m, r.lab, m.ts, cont) })), `t${m.ts}`);
          after = (
            <div key={`th-${m.ts}`} className="dt-sig-thread">
              <div className="dt-sig-thread-h">Thread · {replies.length} repl{replies.length > 1 ? 'ies' : 'y'}{!replyShown && mode !== 'all' ? ', all filtered' : ''}</div>
              {inner}
            </div>
          );
        } else if (m.replies && m.threadError) {
          after = <div key={`th-${m.ts}`} className="dt-sig-thread"><div className="dt-sig-thread-h">Thread · {m.replies} replies (couldn’t load)</div></div>;
        }
        return { m, lab, show: show || keepForThread, after, node: cont => renderMessage(m, lab, null, cont) };
      });
      const body = renderSeq(seq, `d${day}`);
      return body.length ? <section key={day}><div className="dt-sig-day">{day}</div>{body}</section> : null;
    });
    const busy = stats?.pend > 0;
    return (
      <>
        {!anyShown && !busy && mode !== 'all' && (
          <div className="dt-sig-blank">
            <h3>{mode === 'noise' ? 'Clean as a whistle' : 'Not a single work message'}</h3>
            <p>{mode === 'noise' ? 'No foolishness found in this window.' : 'Everything in this window was banter.'}</p>
          </div>
        )}
        {sections}
      </>
    );
  }

  const title = current ? tabTitle(`#${current.name}`, 'Slack') : tabTitle('Slack');
  const sorted = useMemo(() => [...(channels || [])].sort((a, b) => (b.last || 0) - (a.last || 0) || a.name.localeCompare(b.name)), [channels]);

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div style={{ minHeight: '100vh' }}>
        <header className="dt-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <DigiteamLogo size={28} />
            <span className="dt-header-brand-text">digiteam</span>
          </div>
          <AppNav active="slack" canAdmin={canAdmin} />
          <div style={{ flex: 1 }} />
          <div className="dt-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ThemeToggle />
            <button type="button" className="dt-signout" onClick={() => signOut({ callbackUrl: '/' })} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: '13px' }}>Sign out</button>
          </div>
        </header>

        <div className="dt-admin dt-sig">
          <nav className={listOpen ? 'dt-admin-nav dt-sig-side open' : 'dt-admin-nav dt-sig-side'} aria-label="Slack channels">
            <div className="dt-sig-side-head">
              <span>Channels</span>
              <button type="button" onClick={() => loadChannels(true)} title="Reload the channel list from Slack">Refresh</button>
            </div>
            <button type="button" className="dt-sig-side-toggle" onClick={() => setListOpen(o => !o)} aria-expanded={listOpen}>
              {current ? `#${current.name}` : 'Choose a channel'} ▾
            </button>
            <ul className="dt-sig-channels">
              {channels === null && <li className="dt-sig-side-note">Loading…</li>}
              {sorted.map(c => (
                <li key={c.id}>
                  <button type="button" className={current?.id === c.id ? 'dt-admin-link active' : 'dt-admin-link'}
                    aria-current={current?.id === c.id ? 'page' : undefined}
                    onClick={() => { setListOpen(false); load(c); }}>
                    <span className="dt-sig-chname">{c.private ? '🔒' : '#'} {c.name}</span>
                    {c.last && <span className="dt-sig-when">{ago(c.last)}</span>}
                  </button>
                </li>
              ))}
              {channels && channels.length === 0 && !listError && (
                <li className="dt-sig-side-note">No channels yet. Invite the Slack app to a channel with <code>/invite @app-name</code>, then press Refresh.</li>
              )}
            </ul>
            {listError && <p className="dt-sig-side-note err" role="alert">{listError}</p>}
            <p className="dt-sig-side-note">Private channels only show if you’re a member. Nothing is ever posted to Slack.</p>
          </nav>

          <main className="dt-admin-main dt-sig-main">
            <div className="dt-sig-top" ref={topRef}>
            <div className="dt-sig-bar">
              <h1>{current ? `${current.private ? '🔒 ' : '#'}${current.name}` : 'Slack'}</h1>
              <Seg label="Range" options={RANGES} value={range} onChange={changeRange} />
              <Seg label="Filter" options={STRICT} value={strict} onChange={changeStrict} />
              <Seg label="View" options={MODES} value={mode} onChange={changeMode} />
              <label className="dt-sig-toggle"><input type="checkbox" checked={bots} onChange={e => changeBots(e.target.checked)} /> Userback updates</label>
              <button type="button" className="dt-sig-refresh" disabled={!current} onClick={() => current && load(current, { fresh: true })}>↺ Refresh</button>
            </div>

            {status.text && <p className={status.err ? 'dt-sig-status err' : 'dt-sig-status'} role={status.err ? 'alert' : 'status'}>{status.text}</p>}

            {!current && !status.text && channels?.length > 0 && (
              <div className="dt-sig-blank"><h3>Choose a channel</h3><p>Messages are read from Slack and sorted into work and noise by Claude. Nothing is posted to Slack.</p></div>
            )}

            {data && stats && data.messages.length > 0 && (
              <>
                <div className="dt-sig-cards">
                  <div className="dt-sig-card"><div className="k">Team messages</div><div className="v">{stats.human}</div><div className="s">{stats.botN} bot update{stats.botN === 1 ? '' : 's'}</div></div>
                  <div className="dt-sig-card"><div className="k">Work</div><div className="v" style={{ color: 'var(--green)' }}>{stats.work}</div><div className="s">{stats.pend ? `${stats.pend} still sorting` : 'kept'}</div></div>
                  <div className="dt-sig-card"><div className="k">Noise</div><div className="v" style={{ color: 'var(--muted)' }}>{stats.noise}</div><div className="s">{stats.work + stats.noise ? `${stats.pct}% of the chatter` : '—'}</div></div>
                </div>
                {stats.ppl.length > 0 && (
                  <div className="dt-sig-people" aria-label="Noise meter">
                    {stats.ppl.map(p => (
                      <div key={p.uid || p.name} className="dt-sig-person" title={`${p.w} work, ${p.n} noise`}>
                        <Avatar m={{ uid: p.uid, name: p.name }} people={people} size={24} />
                        <span>{p.name}</span>
                        <span className="dt-sig-meter" role="img" aria-label={`${p.pct}% noise`}><i style={{ width: `${p.pct}%` }} /></span>
                        <span className="dt-sig-pct">{p.pct}% noise</span>
                      </div>
                    ))}
                  </div>
                )}
                {digest !== undefined && (
                  <div className={digestOpen ? 'dt-sig-digest' : 'dt-sig-digest collapsed'}>
                    <h2>
                      <button type="button" className="dt-sig-digest-toggle" onClick={toggleDigest} aria-expanded={digestOpen}
                        title={digestOpen ? 'Collapse. It reopens when there’s something new.' : 'Show the digest'}>
                        <span className="chev" aria-hidden="true">{digestOpen ? '▾' : '▸'}</span>
                        What actually happened
                        {!digestOpen && Array.isArray(digest) && digest.length > 0 && <span className="dt-sig-digest-count">{digest.length} point{digest.length === 1 ? '' : 's'}</span>}
                      </button>
                    </h2>
                    {digestOpen && (digest === null ? <p className="empty">Writing the digest…</p>
                      : digest.length ? <ul>{digest.map((b, i) => <li key={i} dangerouslySetInnerHTML={{ __html: mrkdwn(b, people) }} />)}</ul>
                      : <p className="empty">No work in this window. Just vibes.</p>)}
                  </div>
                )}
              </>
            )}

            </div>
            <div className="dt-sig-feed-wrap">
              <div className="dt-sig-feed" ref={feedRef} tabIndex={-1} aria-label="Messages">{renderFeed()}</div>
              {showJump && data?.messages?.length > 0 && (
                <button type="button" className="dt-sig-jump" onClick={jumpToLatest} title="Jump to the newest message (End)">
                  Jump to latest ↓
                </button>
              )}
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
