import type { ContractStatus } from '@prisma/client';

export const STATUS_LABEL: Record<ContractStatus, string> = {
  BOZZA: 'Bozza',
  INVIATO: 'Inviato',
  APERTO: 'Aperto',
  SBLOCCATO: 'OTP sbloccato',
  FIRMATO: 'Firmato',
  RECEDUTO: 'Receduto',
  ANNULLATO: 'Annullato',
  SCADUTO: 'Scaduto',
};

export const STATUS_STYLE: Record<ContractStatus, string> = {
  BOZZA: 'bg-zinc-100 text-zinc-700 ring-zinc-300',
  INVIATO: 'bg-sky-50 text-sky-800 ring-sky-300',
  APERTO: 'bg-indigo-50 text-indigo-800 ring-indigo-300',
  SBLOCCATO: 'bg-amber-50 text-amber-800 ring-amber-300',
  FIRMATO: 'bg-emerald-50 text-emerald-800 ring-emerald-300',
  RECEDUTO: 'bg-rose-50 text-rose-800 ring-rose-300',
  ANNULLATO: 'bg-zinc-100 text-zinc-500 ring-zinc-300',
  SCADUTO: 'bg-orange-50 text-orange-800 ring-orange-300',
};

export const PIPELINE: { key: string; label: string; statuses: ContractStatus[] }[] = [
  { key: 'bozza', label: 'Bozza', statuses: ['BOZZA'] },
  { key: 'inviato', label: 'Inviato', statuses: ['INVIATO'] },
  { key: 'aperto', label: 'Aperto', statuses: ['APERTO'] },
  { key: 'sbloccato', label: 'OTP sbloccato', statuses: ['SBLOCCATO'] },
  { key: 'firmato', label: 'Firmato', statuses: ['FIRMATO'] },
  { key: 'chiusi', label: 'Chiusi', statuses: ['RECEDUTO', 'ANNULLATO', 'SCADUTO'] },
];

/** Contratti in attesa del cliente: link attivo. */
export const OPEN_STATUSES: ContractStatus[] = ['INVIATO', 'APERTO', 'SBLOCCATO'];

export const EVENT_LABEL: Record<string, string> = {
  creato: 'Contratto creato',
  duplicato: 'Contratto creato per duplicazione',
  modificato: 'Scheda d’ordine modificata',
  inviato: 'Contratto inviato al cliente',
  ritirato: 'Invio ritirato, contratto tornato in bozza',
  link_aperto: 'Link aperto dal cliente',
  otp_inviato: 'Codice OTP inviato',
  otp_errato: 'Codice OTP errato',
  otp_bloccato: 'Codice OTP bloccato per troppi tentativi',
  otp_verificato: 'Identità verificata con OTP: compilazione sbloccata',
  dati_salvati: 'Dati salvati dal cliente (bozza)',
  firmato: 'Contratto compilato e firmato dal cliente',
  copia_inviata: 'Copia del contratto firmato inviata al cliente (supporto durevole)',
  pdf_scaricato: 'PDF scaricato',
  promemoria: 'Promemoria inviato al cliente',
  scaduto: 'Link scaduto',
  annullato: 'Contratto annullato',
  recesso: 'Recesso esercitato dal cliente',
  anonimizzato: 'Dati anonimizzati per fine conservazione',
};
