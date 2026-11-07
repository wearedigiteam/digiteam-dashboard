// Browser tab titles for time tracking (Timely reads tab titles).
// The client name always goes first, because tabs cut off the end of long titles.
// Open windows (AI solve panel, follow-up draft) push a more specific title while open;
// the most recently opened one wins, and closing it restores the one underneath.
import { useEffect, useState } from 'react';

const SUFFIX = ' | Digiteam';
let stack = [];
const listeners = new Set();
const emit = () => listeners.forEach(fn => fn());

export function tabTitle(...parts) {
  return parts.filter(Boolean).join(' – ') + SUFFIX;
}

export function shorten(text, max = 60) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

// While `active`, this title replaces the page's own title
export function useTabTitleOverride(title, active = true) {
  useEffect(() => {
    if (!active || !title) return;
    const entry = { title };
    stack.push(entry);
    emit();
    return () => { stack = stack.filter(e => e !== entry); emit(); };
  }, [title, active]);
}

// The title an open window wants, or null
export function useTabTitleTop() {
  const [top, setTop] = useState(null);
  useEffect(() => {
    const update = () => setTop(stack.length ? stack[stack.length - 1].title : null);
    listeners.add(update);
    update();
    return () => listeners.delete(update);
  }, []);
  return top;
}
