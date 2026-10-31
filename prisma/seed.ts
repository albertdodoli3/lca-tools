// Crea il template "Contratto per il Percorso di Affiancamento" a partire dal Word fornito da LCA.
// Esecuzione: npm run db:seed (non tocca template già esistenti con lo stesso nome)
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient, type Prisma } from '@prisma/client';
import type { FieldDef } from '../src/lib/fields';

const db = new PrismaClient();

const A = (key: string, label: string, type: FieldDef['type'] = 'text', extra: Partial<FieldDef> = {}): FieldDef => ({ key, label, type, filledBy: 'azienda', required: true, ...extra });
const C = (key: string, label: string, type: FieldDef['type'] = 'text', extra: Partial<FieldDef> = {}): FieldDef => ({ key, label, type, filledBy: 'cliente', required: true, ...extra });
const opt = (key: string, label: string, options: string[], extra: Partial<FieldDef> = {}) => A(key, label, 'choice', { options, ...extra });

/** Regole delle caselle concordate con LCA: tutte vuote all'inizio, compilate solo dal cliente. */
const DECL: Record<string, Partial<FieldDef>> = {
  consenso_dati_particolari: {
    required: true,
    shortLabel: 'Consenso dati sentimentali e sessuali (obbligatorio)',
    help: 'Obbligatoria: il percorso riguarda la sfera sentimentale, relazionale e sessuale e senza questo consenso non possiamo svolgerlo.',
  },
  dich_a: {
    required: false,
    shortLabel: 'Dichiarazione A – avvio anticipato di coaching, chat e attività in presenza',
    help: 'Facoltativa per firmare. Necessaria se vuoi iniziare subito coaching, chat ed eventuali attività in presenza: se non la selezioni, inizieranno dopo i 14 giorni del recesso. Se la selezioni e poi recedi, paghi solo le prestazioni già ricevute.',
  },
  dich_b: {
    required: false,
    shortLabel: 'Dichiarazione B – accesso immediato ai contenuti digitali',
    help: 'Facoltativa per firmare. Necessaria se vuoi ricevere subito i videocorsi: con l’accesso perdi il diritto di recesso su quei contenuti. Se non la selezioni, li riceverai dopo i 14 giorni del recesso.',
  },
  consenso_reg_individuali: {
    required: false,
    shortLabel: 'Registrazione delle sessioni individuali',
    help: 'Facoltativa: serve a verificare la qualità del servizio e a tutelare le parti. Puoi rifiutarla e seguire comunque il percorso.',
  },
  consenso_promo: {
    required: false,
    shortLabel: 'Uso promozionale (testimonianze)',
    help: 'Facoltativa: non serve per svolgere il coaching. Se autorizzi, scegli sotto una sola modalità.',
  },
  promo_forma: {
    required: false,
    dependsOn: 'consenso_promo',
    options: ['testimonianza scritta anonima', 'testimonianza scritta con nome', 'immagine e voce'],
    shortLabel: 'Forma della testimonianza',
  },
  consenso_reg_gruppo: {
    required: false,
    shortLabel: 'Registrazione nelle sessioni di gruppo',
    help: 'Facoltativa: se non acconsenti partecipi in forma non identificabile (art. 16.5).',
  },
};

const fields: FieldDef[] = [
  // Dati del cliente (epigrafe)
  C('cliente_nome_cognome', 'Nome e cognome'),
  C('cliente_luogo_nascita', 'Luogo di nascita'),
  C('cliente_data_nascita', 'Data di nascita', 'date'),
  C('cliente_codice_fiscale', 'Codice fiscale', 'cf'),
  C('cliente_comune_residenza', 'Comune di residenza'),
  C('cliente_provincia', 'Provincia (sigla)', 'text', { help: 'Es. PG' }),
  C('cliente_indirizzo', 'Via / piazza'),
  C('cliente_civico', 'Numero civico'),
  C('cliente_cap', 'CAP', 'cap'),
  C('cliente_email', 'Email', 'email'),
  C('cliente_pec', 'PEC (facoltativa)', 'email', { required: false }),
  C('cliente_telefono', 'Telefono', 'phone'),

  // Dichiarazioni e consensi
  C('dich_a', 'Dichiarazione A (esecuzione anticipata dei servizi). Chiedo espressamente che l’esecuzione delle sessioni, delle attività in presenza e dell’assistenza in chat inizi durante il periodo di recesso. Prendo atto che, se recederò, dovrò pagare un importo proporzionale alle prestazioni fornite fino alla comunicazione del recesso, determinato secondo l’art. 12.3, e che perderò il diritto di recesso se le prestazioni saranno integralmente eseguite prima della scadenza del termine.', 'checkbox', DECL.dich_a),
  C('dich_b', 'Dichiarazione B (contenuti digitali). Acconsento espressamente a che la fornitura dei contenuti digitali indicati nella Scheda d’ordine inizi immediatamente, durante il periodo di recesso, e accetto di perdere il diritto di recesso relativo a tali contenuti con l’inizio della fornitura, che avviene con l’invio del collegamento per la creazione delle credenziali di accesso.', 'checkbox', DECL.dich_b),
  C('consenso_dati_particolari', 'Acconsento al trattamento delle informazioni sulla mia vita sentimentale e sessuale e sul mio orientamento sessuale per l’esecuzione del Percorso, come descritto nell’Allegato 3 (necessario per la fruizione del Percorso).', 'checkbox', DECL.consenso_dati_particolari),
  C('consenso_reg_individuali', 'Acconsento alla registrazione delle sessioni individuali ai sensi dell’art. 16.1 (facoltativo).', 'checkbox', DECL.consenso_reg_individuali),
  C('consenso_promo', 'Autorizzo l’uso promozionale descritto nella liberatoria dell’Allegato 3 (facoltativo), nella forma che scelgo qui sotto.', 'checkbox', DECL.consenso_promo),
  C('promo_forma', 'Forma dell’uso promozionale (scegline una sola)', 'choice', DECL.promo_forma),
  C('consenso_reg_gruppo', 'Acconsento alla registrazione della mia immagine, della mia voce e del mio nome nelle sessioni di gruppo cui partecipo e alla messa a disposizione della registrazione agli altri Clienti iscritti alla medesima sessione, ai sensi degli artt. 16.3 e 16.4. Prendo atto che, in mancanza di consenso, la sessione è comunque registrata e che partecipo secondo le modalità dell’art. 16.5, che escludono la mia identificabilità.', 'checkbox', DECL.consenso_reg_gruppo),

  // Sottoscrizione
  C('luogo_firma', 'Luogo della firma (città)'),
  { key: 'data_firma', label: 'Data della firma (automatica)', type: 'text', filledBy: 'auto', required: false },
  C('firma_cliente', 'Firma del contratto', 'signature'),
  { key: 'firma_lca', label: 'Firma dell’azienda (dalle Impostazioni)', type: 'signature', filledBy: 'auto', required: false },
  C('firma_clausole', 'Approvazione specifica delle clausole (artt. 1341 e 1342 c.c.)', 'signature', {
    help: 'Ai sensi degli artt. 1341 e 1342 c.c. approvi specificamente: artt. 7.4, 7.5 e 7.7 (storni, sospensione, decadenza dal beneficio del termine, spese di recupero); art. 7.10-bis (risoluzione per mancato pagamento prima dell’attivazione e penale); art. 8.2 (sessioni non fruite alla scadenza); artt. 9.2, 9.3, 9.5 e 9.6 (limiti alle disdette, sessioni considerate fruite, ritardi, malfunzionamenti); art. 11.2 (limiti di responsabilità); art. 12.7 (obbligo di pagamento integrale dopo la scadenza del termine di recesso); art. 13 (clausola risolutiva espressa); art. 14.2 (penale); art. 16.2 (condizioni di svolgimento delle sessioni successive a contestazione); art. 19.2 (comunicazioni); art. 22.2 (foro competente per il Cliente non consumatore).',
  }),

  // Allegato 1 — Scheda d'ordine
  A('data_ordine', 'Data della scheda d’ordine', 'date'),
  A('pacchetto', 'Pacchetto (denominazione commerciale)'),
  A('durata_mesi', 'Durata del Percorso (mesi)', 'number'),
  A('sessioni_individuali_n', 'Sessioni individuali: numero', 'number'),
  A('sessioni_durata_min', 'Sessioni individuali: durata (minuti)', 'number'),
  opt('sessioni_modalita', 'Sessioni individuali: modalità', ['videochiamata', 'presenza', 'videochiamata e presenza']),
  opt('sessioni_gruppo', 'Sessioni di gruppo', ['incluse', 'non incluse']),
  A('sessioni_gruppo_frequenza', 'Sessioni di gruppo: frequenza', 'text', { required: false }),
  opt('chat', 'Assistenza in chat', ['inclusa', 'non inclusa']),
  A('chat_durata_giorni', 'Assistenza in chat: durata (giorni)', 'number', { required: false }),
  A('chat_orari', 'Assistenza in chat: giorni e orari', 'text', { required: false }),
  A('chat_risposta_ore', 'Assistenza in chat: risposta entro (ore lavorative)', 'number', { required: false }),
  opt('presenza', 'Attività in presenza', ['incluse', 'non incluse']),
  A('presenza_giornate', 'Attività in presenza: n. giornate', 'number', { required: false }),
  A('presenza_luogo', 'Attività in presenza: luogo', 'text', { required: false }),
  opt('presenza_spese', 'Attività in presenza: spese del Cliente', ['a suo carico', 'incluse'], { required: false }),
  opt('giada_twin', 'GIADA TWIN', ['incluso', 'non incluso']),
  A('corso_1_titolo', 'Videocorso 1: titolo', 'text', { required: false }),
  A('corso_1_argomento', 'Videocorso 1: argomento', 'text', { required: false }),
  A('corso_2_titolo', 'Videocorso 2: titolo', 'text', { required: false }),
  A('corso_2_argomento', 'Videocorso 2: argomento', 'text', { required: false }),
  A('corso_3_titolo', 'Videocorso 3: titolo', 'text', { required: false }),
  A('corso_3_argomento', 'Videocorso 3: argomento', 'text', { required: false }),
  A('prezzo_contenuti_digitali', 'Quota contenuti digitali (€)', 'currency'),
  A('prezzo_sessione_individuale', 'Valore unitario sessione individuale (€)', 'currency'),
  A('totale_sessioni_individuali', 'Totale sessioni individuali (€)', 'currency'),
  A('prezzo_sessione_gruppo', 'Valore unitario sessione di gruppo (€)', 'currency', { required: false }),
  A('sessioni_gruppo_n', 'Sessioni di gruppo: numero', 'number', { required: false }),
  A('totale_sessioni_gruppo', 'Totale sessioni di gruppo (€)', 'currency', { required: false }),
  A('chat_quota_giornaliera', 'Quota giornaliera assistenza in chat (€)', 'currency', { required: false }),
  A('totale_chat', 'Totale assistenza in chat (€)', 'currency', { required: false }),
  A('prezzo_presenza', 'Attività in presenza (€)', 'currency', { required: false }),
  A('corrispettivo_totale', 'Corrispettivo totale (€)', 'currency'),
  opt('modalita_pagamento', 'Modalità di pagamento', ['unica soluzione', 'rate dirette con LCA, senza interessi né costi', 'servizio di pagamento di terzi']),
  A('pagamento_terzi_nome', 'Servizio di pagamento di terzi (nome)', 'text', { required: false }),
  opt('strumento_pagamento', 'Strumento di pagamento', ['bonifico bancario', 'Stripe', 'PayPal', 'Klarna', 'altro']),
  A('strumento_altro', 'Strumento: altro (specificare)', 'text', { required: false }),
  A('rata_1_importo', 'Rata 1: importo (€)', 'currency', { required: false }),
  A('rata_1_scadenza', 'Rata 1: scadenza', 'date', { required: false }),
  A('rata_2_importo', 'Rata 2: importo (€)', 'currency', { required: false }),
  A('rata_2_scadenza', 'Rata 2: scadenza', 'date', { required: false }),
  A('rata_3_importo', 'Rata 3: importo (€)', 'currency', { required: false }),
  A('rata_3_scadenza', 'Rata 3: scadenza', 'date', { required: false }),
  A('sost_rata_1_importo', 'Piano sostitutivo — rata 1: importo (€)', 'currency', { required: false }),
  A('sost_rata_2_importo', 'Piano sostitutivo — rata 2: importo (€)', 'currency', { required: false }),
  A('sost_rata_2_scadenza', 'Piano sostitutivo — rata 2: scadenza', 'text', { required: false }),
  A('sost_rata_3_importo', 'Piano sostitutivo — rata 3: importo (€)', 'currency', { required: false }),
  A('sost_rata_3_scadenza', 'Piano sostitutivo — rata 3: scadenza', 'text', { required: false }),
  A('sost_totale', 'Piano sostitutivo — totale (€)', 'currency', { required: false }),
];

const PROMO_RE = /\{\{\s*promo_anonima\s*\}\}\s*testimonianza scritta anonima\s*\{\{\s*promo_nome\s*\}\}\s*testimonianza scritta con nome\s*\{\{\s*promo_immagine_voce\s*\}\}\s*immagine e voce/;

/**
 * Aggiornamento dei template LCA già esistenti (idempotente):
 * le tre modalità della testimonianza diventano una scelta unica, abilitata solo dal consenso,
 * e le caselle ricevono le regole di obbligatorietà e le spiegazioni concordate.
 * I contratti già creati non cambiano: hanno la loro copia del template.
 */
async function upgradeExisting() {
  const all = await db.template.findMany();
  for (const t of all) {
    const current = t.fields as unknown as FieldDef[];
    if (!current.some((f) => f.key === 'promo_anonima') || current.some((f) => f.key === 'promo_forma')) continue;
    if (!PROMO_RE.test(t.html)) {
      console.log(`Template "${t.name}": testo delle testimonianze modificato a mano, aggiornamento saltato.`);
      continue;
    }
    const html = t.html.replace(PROMO_RE, '{{promo_forma}}');
    const keys = [...new Set([...html.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]))];
    const next = keys.map((k) => {
      const existing = current.find((f) => f.key === k);
      if (k === 'promo_forma') return fields.find((f) => f.key === k)!;
      return existing && DECL[k] ? { ...existing, ...DECL[k], filledBy: 'cliente' as const } : existing ?? fields.find((f) => f.key === k)!;
    });
    await db.template.update({ where: { id: t.id }, data: { html, fields: next as unknown as Prisma.InputJsonValue, version: { increment: 1 } } });
    console.log(`Template "${t.name}" aggiornato: testimonianze a scelta unica e regole delle caselle.`);
  }
}

async function main() {
  await db.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  await upgradeExisting();
  const name = 'Contratto per il Percorso di Affiancamento';
  if (await db.template.findFirst({ where: { name } })) {
    console.log('Template già presente, nessuna modifica.');
    return;
  }
  const html = readFileSync(join(__dirname, 'seed-data', 'lca-template.html'), 'utf8');
  const keys = [...new Set([...html.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))];
  const missing = keys.filter((k) => !fields.find((f) => f.key === k));
  if (missing.length) throw new Error('Campi senza definizione: ' + missing.join(', '));
  const ordered = keys.map((k) => fields.find((f) => f.key === k)!);
  await db.template.create({ data: { name, description: 'Love Coach Academy — contratto standard con Scheda d’ordine e allegati', html, fields: ordered as unknown as Prisma.InputJsonValue } });
  console.log(`Template creato con ${ordered.length} campi.`);
}

main().finally(() => db.$disconnect());
