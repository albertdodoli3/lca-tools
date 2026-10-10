// Sostituzione delle variabili {{chiave}} nel testo del contratto.
// Condiviso tra server (PDF) e browser (anteprima dal vivo).
import { formatCurrency, formatDate, isEmpty, VAR_RE, type FieldDef, type SignatureValue, type Values } from './fields';

export type RenderMode = 'preview' | 'final';

export type RenderContext = {
  companySignature?: string | null;
  companySignerName?: string;
  code?: string;
  sentAt?: string | null;
  signedAt?: string | null;
};

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function placeholder(f: FieldDef | undefined, key: string) {
  const who = f?.filledBy ?? 'missing';
  const label = f?.label ?? `variabile sconosciuta: ${key}`;
  return `<span class="ph ph-${who}" data-key="${escapeHtml(key)}">${escapeHtml(label)}</span>`;
}

function signatureHtml(s: SignatureValue) {
  const alt = s.mode === 'digitata' ? `Firma digitata: ${s.name ?? ''}` : 'Firma';
  return `<img class="sig" src="${s.image}" alt="${escapeHtml(alt)}" />`;
}

export function formatValue(f: FieldDef, v: unknown): string {
  switch (f.type) {
    case 'checkbox':
      return v === true ? '☒' : '☐';
    case 'choice':
      return (f.options ?? []).map((o) => `${o === v ? '☒' : '☐'} ${escapeHtml(o)}`).join(' ');
    case 'date':
      return escapeHtml(formatDate(String(v)));
    case 'currency':
      return escapeHtml(formatCurrency(v));
    case 'signature':
      return signatureHtml(v as SignatureValue);
    case 'textarea':
      return escapeHtml(String(v)).replace(/\n/g, '<br/>');
    default:
      return escapeHtml(String(v));
  }
}

export function renderContract(html: string, fields: FieldDef[], values: Values, mode: RenderMode, ctx: RenderContext = {}): string {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  // In anteprima i valori compilati sono marcati, così l'editor può evidenziarli
  const wrap = (key: string, out: string) => (mode === 'preview' && !out.startsWith('<span class="ph') ? `<span class="fv" data-key="${escapeHtml(key)}">${out}</span>` : out);
  return html.replace(VAR_RE, (_m, key: string) => wrap(key, replaceOne(key)));

  function replaceOne(key: string): string {
    const f = byKey.get(key);
    // Campi automatici
    if (key === 'firma_lca') {
      if (ctx.companySignature) return `<img class="sig" src="${ctx.companySignature}" alt="Firma ${escapeHtml(ctx.companySignerName ?? '')}" />`;
      return mode === 'final' ? `<em>${escapeHtml(ctx.companySignerName ?? '')}</em>` : placeholder(f, key);
    }
    if (key === 'data_firma') return ctx.signedAt ? escapeHtml(formatDate(ctx.signedAt)) : mode === 'final' ? '—' : placeholder(f, key);
    if (key === 'codice_contratto') return ctx.code ? escapeHtml(ctx.code) : placeholder(f, key);
    if (key === 'data_invio') return ctx.sentAt ? escapeHtml(formatDate(ctx.sentAt)) : mode === 'final' ? '—' : placeholder(f, key);

    if (!f) return mode === 'final' ? '' : placeholder(undefined, key);
    const v = values[key];
    if (f.type === 'checkbox') return formatValue(f, v);
    if (f.type === 'choice' && isEmpty(v)) return mode === 'final' ? formatValue(f, '') : placeholder(f, key);
    if (f.type === 'signature') {
      if (v && typeof v === 'object') return formatValue(f, v);
      return mode === 'final' ? '<span class="sig-empty">__________________</span>' : placeholder(f, key);
    }
    if (isEmpty(v)) return mode === 'final' ? '—' : placeholder(f, key);
    return formatValue(f, v);
  }
}

/** Stile del documento, usato sia nell'anteprima sia nel PDF. */
export const DOC_CSS = `
.doc { font-family: Georgia, 'Times New Roman', serif; font-size: 11pt; line-height: 1.55; color: #1b1b1f; }
.doc h1 { font-size: 18pt; text-align: center; margin: 0 0 18px; }
.doc h2 { font-size: 12.5pt; margin: 22px 0 8px; }
.doc h3 { font-size: 11.5pt; margin: 16px 0 6px; }
.doc p { margin: 0 0 8px; text-align: justify; }
.doc ul, .doc ol { margin: 0 0 8px 22px; }
.doc table { width: 100%; border-collapse: collapse; margin: 8px 0 14px; font-size: 10pt; }
.doc th, .doc td { border: 1px solid #b9b9c3; padding: 5px 7px; vertical-align: top; text-align: left; }
.doc th { background: #f3f1f4; }
.doc td p, .doc th p { margin: 0; text-align: left; }
.doc img.sig { height: 54px; max-width: 240px; vertical-align: middle; margin: 0 6px; }
.doc .ph { display: inline-block; padding: 0 6px; border-radius: 4px; font-family: system-ui, sans-serif; font-size: 9pt; line-height: 1.6; border: 1px dashed; }
.doc .ph-azienda { background: #fff7e0; border-color: #e0b84a; color: #7a5a00; }
.doc .ph-cliente { background: #e9f2ff; border-color: #6d9be0; color: #1f4f96; }
.doc .ph-auto { background: #eef0f2; border-color: #a5adb6; color: #4b5560; }
.doc .ph-missing { background: #ffe9e9; border-color: #e07070; color: #8a1f1f; }
.doc .ph.focus, .doc .fv.focus { outline: 3px solid rgba(37, 99, 235, .45); border-radius: 3px; }
.doc .sig-empty { letter-spacing: 1px; }
`;
