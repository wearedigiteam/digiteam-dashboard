// Every top-level JSON object in a reply, in order. Claude occasionally adds a second object or
// trailing text, so reading "first { to last }" as one object fails; this reads each one separately.
export function jsonObjects(text) {
  const out = [];
  let depth = 0, start = -1, inStr = false, esc = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { if (depth > 0) inStr = true; continue; }
    if (c === '{') { if (depth === 0) start = i; depth++; }
    else if (c === '}' && depth > 0) {
      depth--;
      if (depth === 0 && start >= 0) {
        try { out.push(JSON.parse(text.slice(start, i + 1))); } catch { /* skip a malformed piece */ }
        start = -1;
      }
    }
  }
  return out;
}

