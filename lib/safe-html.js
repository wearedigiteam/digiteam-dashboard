// Bruno's replies are HTML written by Claude, and part of what Claude reads (ticket titles and
// descriptions) is written by clients. Strip everything except plain formatting before the
// HTML reaches the page, so a hostile ticket can't get a script or event handler through.
import sanitizeHtml from 'sanitize-html';

const OPTIONS = {
  allowedTags: ['h2', 'h3', 'h4', 'p', 'br', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'a', 'code', 'pre', 'blockquote', 'hr'],
  allowedAttributes: { a: ['href', 'target', 'rel'] }, // target and rel are set by transformTags below
  allowedSchemes: ['https', 'http', 'mailto'],
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  transformTags: {
    a: (tagName, attribs) => ({ tagName: 'a', attribs: { href: attribs.href, target: '_blank', rel: 'noopener noreferrer' } }),
    h1: 'h2',
  },
};

export function safeHtml(html) {
  return sanitizeHtml(String(html || ''), OPTIONS);
}
