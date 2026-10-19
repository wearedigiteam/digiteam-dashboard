import { useEffect } from 'react';
import { createPortal } from 'react-dom';

// Easter egg shown when someone expands a "Needs attention" section.
// Closes on click, Escape, or by itself after a few seconds.
const GIF_URL = 'https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExenczbm51dTB6aXZtaXloeTAwZnRzMnpubzVibzZ1NDV5dDQxY3F5cyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/13bdZafj52a5qM/giphy.gif';
const AUTO_CLOSE_MS = 4000;

// Preload so the overlay doesn't open empty on the first click
if (typeof window !== 'undefined') { const img = new Image(); img.src = GIF_URL; }

export default function EasterEgg({ open, onClose }) {
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(onClose, AUTO_CLOSE_MS);
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(timer); window.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div onClick={onClose} role="dialog" aria-label="Easter egg, click to close" style={{
      position: 'fixed', inset: 0, zIndex: 3000,
      background: 'rgba(10,10,20,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', padding: '16px',
    }}>
      <img src={GIF_URL} alt="" style={{
        maxWidth: 'min(480px, 90vw)', maxHeight: '70vh',
        borderRadius: '12px', boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
      }} />
    </div>,
    document.body
  );
}
