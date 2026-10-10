// Definizione dei campi di un template e regole di validazione/formattazione.
// Questo file è condiviso tra server e browser: niente import lato server qui.

export const FIELD_TYPES = {
  text: 'Testo breve',
  textarea: 'Testo lungo',
  date: 'Data',
  number: 'Numero',
  currency: 'Importo (€)',
  email: 'Email',
  phone: 'Telefono',
  cf: 'Codice fiscale',
  cap: 'CAP',
  checkbox: 'Casella di spunta',
  choice: 'Scelta (caselle ☐)',
  select: 'Scelta (menu)',
  signature: 'Firma',
} as const;

export type FieldType = keyof typeof FIELD_TYPES;

export const FILLED_BY = {
  azienda: 'Azienda (scheda d’ordine)',
  cliente: 'Cliente',
  auto: 'Automatico',
} as const;

export type FilledBy = keyof typeof FILLED_BY;

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  filledBy: FilledBy;
  required: boolean;
  options?: string[];
  help?: string;
};

export type SignatureValue = {
  image: string; // data URL PNG
  mode: 'disegnata' | 'digitata';
  name?: string;
  at: string; // ISO
};

export type Values = Record<string, unknown>;

/** Campi automatici riconosciuti dal sistema. */
export const AUTO_FIELDS: Record<string, string> = {
  data_firma: 'Data della firma (automatica)',
  firma_lca: 'Firma dell’azienda (dalle Impostazioni)',
  codice_contratto: 'Codice del contratto',
  data_invio: 'Data di invio',
};

export const VAR_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function extractKeys(html: string): string[] {
  const keys: string[] = [];
  for (const m of html.matchAll(VAR_RE)) if (!keys.includes(m[1])) keys.push(m[1]);
  return keys;
}

/** Proposta di configurazione per una variabile appena inserita nel testo. */
export function guessField(key: string): FieldDef {
  const k = key.toLowerCase();
  const label = key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  if (AUTO_FIELDS[k]) return { key, label: AUTO_FIELDS[k], type: k === 'firma_lca' ? 'signature' : 'text', filledBy: 'auto', required: false };
  const base: FieldDef = { key, label, type: 'text', filledBy: k.startsWith('cliente') ? 'cliente' : 'azienda', required: true };
  if (k.includes('firma')) return { ...base, type: 'signature', filledBy: 'cliente' };
  if (k.includes('email')) return { ...base, type: 'email' };
  if (k.includes('telefono') || k.includes('cellulare')) return { ...base, type: 'phone' };
  if (k.includes('codice_fiscale') || k === 'cf') return { ...base, type: 'cf' };
  if (k.endsWith('cap')) return { ...base, type: 'cap' };
  if (k.includes('data') || k.includes('scadenza')) return { ...base, type: 'date' };
  if (k.includes('prezzo') || k.includes('importo') || k.includes('totale') || k.includes('quota')) return { ...base, type: 'currency' };
  if (k.startsWith('consenso') || k.startsWith('dich')) return { ...base, type: 'checkbox', filledBy: 'cliente', required: false };
  return base;
}

export function syncFields(html: string, current: FieldDef[]): FieldDef[] {
  return extractKeys(html).map((key) => current.find((f) => f.key === key) ?? guessField(key));
}

const CF_RE = /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/;

/** Verifica anche il carattere di controllo del codice fiscale. */
export function isValidCF(raw: string): boolean {
  const cf = raw.toUpperCase().trim();
  if (!CF_RE.test(cf)) return false;
  const odd: Record<string, number> = { '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21, A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18, N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23 };
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    const c = cf[i];
    if (i % 2 === 0) sum += odd[c];
    else sum += /[0-9]/.test(c) ? Number(c) : c.charCodeAt(0) - 65;
  }
  return String.fromCharCode(65 + (sum % 26)) === cf[15];
}

export function isEmpty(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string') return v.trim() === '';
  return false;
}

/** Restituisce un messaggio d'errore o null. */
export function validateField(f: FieldDef, v: unknown): string | null {
  if (f.type === 'checkbox') {
    if (f.required && v !== true) return 'Questa casella è obbligatoria';
    return null;
  }
  if (f.type === 'signature') {
    const s = v as SignatureValue | undefined;
    if (f.required && (!s || typeof s.image !== 'string' || !s.image.startsWith('data:image/png;base64,'))) return 'Firma mancante';
    return null;
  }
  if (isEmpty(v)) return f.required ? 'Campo obbligatorio' : null;
  const s = String(v).trim();
  if (s.length > 2000) return 'Testo troppo lungo';
  switch (f.type) {
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) ? null : 'Email non valida';
    case 'phone':
      return /^\+?[0-9 ()./-]{6,20}$/.test(s) ? null : 'Telefono non valido';
    case 'cf':
      return isValidCF(s) ? null : 'Codice fiscale non valido';
    case 'cap':
      return /^[0-9]{5}$/.test(s) ? null : 'CAP non valido (5 cifre)';
    case 'date':
      return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) ? null : 'Data non valida';
    case 'number':
    case 'currency':
      return Number.isFinite(Number(s.replace(',', '.'))) ? null : 'Numero non valido';
    case 'choice':
    case 'select':
      return f.options?.includes(s) ? null : 'Scegli un’opzione';
    default:
      return null;
  }
}

export function validateAll(fields: FieldDef[], values: Values, who: FilledBy): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of fields) {
    if (f.filledBy !== who) continue;
    const e = validateField(f, values[f.key]);
    if (e) errors[f.key] = e;
  }
  return errors;
}

/** Normalizza un valore inviato da un form al tipo atteso. */
export function normalizeValue(f: FieldDef, v: unknown): unknown {
  if (f.type === 'checkbox') return v === true || v === 'true' || v === 'on';
  if (f.type === 'signature') {
    if (!v || typeof v !== 'object') return undefined;
    const s = v as SignatureValue;
    if (typeof s.image !== 'string' || !s.image.startsWith('data:image/png;base64,') || s.image.length > 400_000) return undefined;
    return { image: s.image, mode: s.mode === 'digitata' ? 'digitata' : 'disegnata', name: typeof s.name === 'string' ? s.name.slice(0, 120) : undefined, at: new Date().toISOString() } satisfies SignatureValue;
  }
  if (v === undefined || v === null) return '';
  let s = String(v).slice(0, 2000);
  if (f.type !== 'textarea') s = s.replace(/\s+/g, ' ').trim();
  if (f.type === 'cf') s = s.toUpperCase();
  if (f.type === 'email') s = s.toLowerCase();
  return s;
}

export function formatDate(iso: string | Date | null | undefined): string {
  if (!iso) return '';
  const d = typeof iso === 'string' ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso + 'T12:00:00' : iso) : iso;
  return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Rome' }).format(d);
}

export function formatDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return '';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Rome' }).format(d);
}

export function formatCurrency(v: unknown): string {
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n)) return String(v);
  return new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}
