import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

// Hovering (or keyboard-focusing) a thumbnail shows a mid-sized preview beside it.
// The preview is rendered into <body> so card overflow can't clip it, and it ignores
// the mouse so it never gets in the way of moving to the next row.
const SHOW_DELAY = 250;   // ms, so skimming past thumbnails doesn't flash previews
const MAX_W = 760;
const MAX_H = 560;
const GAP = 14;

function placeNear(rect) {
  const vw = window.innerWidth, vh = window.innerHeight;
  const w = Math.min(MAX_W, vw * 0.6);
  const h = Math.min(MAX_H, vh * 0.75);
  const spaceRight = vw - rect.right - GAP;
  const left = spaceRight >= w + 16
    ? rect.right + GAP
    : Math.max(16, rect.left - GAP - w);           // flip to the left if needed
  const top = Math.min(Math.max(16, rect.top + rect.height / 2 - h / 2), vh - h - 16);
  return { left, top, width: w, height: h };
}

export default function ThumbPreview({ thumb, full, href, width, height, radius = '4px' }) {
  const [box, setBox] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const timer = useRef(null);
  const anchor = useRef(null);

  function show() {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (anchor.current) setBox(placeNear(anchor.current.getBoundingClientRect()));
    }, SHOW_DELAY);
  }
  function hide() {
    clearTimeout(timer.current);
    setBox(null);
  }

  // Close on scroll so the preview doesn't drift away from its thumbnail
  useEffect(() => {
    if (!box) return;
    window.addEventListener('scroll', hide, { passive: true, capture: true });
    return () => window.removeEventListener('scroll', hide, { capture: true });
  }, [box]);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <>
      <a ref={anchor} href={href || '#'} target="_blank" rel="noreferrer"
        onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}
        style={{ flexShrink: 0, display: 'block', lineHeight: 0 }}>
        <img src={thumb} alt="Screenshot" style={{
          width, height, objectFit: 'cover', borderRadius: radius,
          border: '1px solid var(--border)', background: 'var(--surface2)',
          cursor: 'zoom-in',
        }} onError={e => { e.target.style.display = 'none'; }} />
      </a>

      {box && typeof document !== 'undefined' && createPortal(
        <div style={{
          position: 'fixed', left: box.left, top: box.top,
          width: box.width, height: box.height, zIndex: 2000,
          background: 'var(--surface)', border: '1px solid var(--border2)',
          borderRadius: '10px', boxShadow: '0 16px 48px var(--shadow)',
          padding: '8px', pointerEvents: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {!loaded && (
            <img src={thumb} alt="" aria-hidden="true" style={{
              position: 'absolute', maxWidth: 'calc(100% - 16px)', maxHeight: 'calc(100% - 16px)',
              objectFit: 'contain', filter: 'blur(2px)', opacity: 0.6,
            }} />
          )}
          <img src={full || thumb} alt="Screenshot preview"
            onLoad={() => setLoaded(true)}
            style={{
              maxWidth: '100%', maxHeight: '100%', objectFit: 'contain',
              borderRadius: '6px', opacity: loaded ? 1 : 0,
            }} />
        </div>,
        document.body
      )}
    </>
  );
}
