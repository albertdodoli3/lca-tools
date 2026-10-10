import 'server-only';
import sanitizeHtml from 'sanitize-html';

/** Il testo dei template viene mostrato ai clienti: teniamo solo la formattazione, niente script o stili arbitrari. */
export function sanitizeTemplate(html: string) {
  return sanitizeHtml(html, {
    allowedTags: ['h1', 'h2', 'h3', 'h4', 'p', 'br', 'hr', 'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'span', 'blockquote', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'colgroup', 'col', 'a'],
    allowedAttributes: { a: ['href'], td: ['colspan', 'rowspan', 'style'], th: ['colspan', 'rowspan', 'style'], p: ['style'], h1: ['style'], h2: ['style'], h3: ['style'], h4: ['style'], col: ['style'] },
    allowedStyles: { '*': { 'text-align': [/^(left|right|center|justify)$/], 'min-width': [/^\d+px$/], width: [/^\d+px$/] } },
    allowedSchemes: ['https', 'mailto'],
  });
}
