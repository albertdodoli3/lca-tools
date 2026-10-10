import 'server-only';
import nodemailer from 'nodemailer';
import { db } from './db';
import { decrypt } from './crypto';
import { getSettings } from './settings';
import { escapeHtml } from './render';

type Mail = {
  to: string;
  subject: string;
  text: string;
  kind: string;
  contractId?: string;
  /** Testo del pulsante principale (opzionale) */
  button?: { label: string; url: string };
  attachments?: { filename: string; content: Buffer }[];
};

export async function emailConfigured() {
  const s = await getSettings();
  return Boolean(s.smtpHost && s.senderEmail);
}

function layout(text: string, brand: string, company: string, button?: Mail['button']) {
  const paragraphs = escapeHtml(text)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${p.replace(/\n/g, '<br/>').replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:' + brand + '">$1</a>')}</p>`)
    .join('');
  const btn = button
    ? `<p style="margin:22px 0"><a href="${escapeHtml(button.url)}" style="background:${brand};color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;display:inline-block;font-weight:600">${escapeHtml(button.label)}</a></p>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#f5f4f6;font-family:Arial,Helvetica,sans-serif;color:#1b1b1f">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden">
<tr><td style="background:${brand};color:#fff;padding:16px 24px;font-weight:700;font-size:16px">${escapeHtml(company)}</td></tr>
<tr><td style="padding:24px;font-size:15px;line-height:1.55">${paragraphs}${btn}</td></tr>
<tr><td style="padding:14px 24px;font-size:12px;color:#777;border-top:1px solid #eee">Email inviata da ${escapeHtml(company)}. Se non attendevi questo messaggio puoi ignorarlo.</td></tr>
</table></td></tr></table></body></html>`;
}

/** Email che possono passare da GoHighLevel in modalità "misto": solo quelle senza codici né allegati personali. */
const GHL_KINDS = new Set(['invito', 'promemoria']);

type Result = { ok: boolean; simulated: boolean; error?: string; channel?: 'smtp' | 'ghl' };

export async function ghlConfigured() {
  const s = await getSettings();
  return Boolean(s.ghlTokenEnc && s.ghlLocationId);
}

// Sovrascrivibile solo per i test
const GHL_API = process.env.GHL_API_URL || 'https://services.leadconnectorhq.com';

async function ghlFetch(path: string, token: string, version: string, body: unknown) {
  const res = await fetch(GHL_API + path, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, version, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(`GoHighLevel ${res.status}: ${String(data.message ?? data.error ?? res.statusText).slice(0, 300)}`);
  return data;
}

/** Invia tramite l'API Conversations di GoHighLevel: crea/aggiorna il contatto e manda l'email dal dominio configurato in GHL. */
export async function sendViaGhl(m: { to: string; name?: string; subject: string; html: string; text: string }) {
  const s = await getSettings();
  const token = decrypt(s.ghlTokenEnc);
  const [firstName, ...rest] = (m.name ?? '').trim().split(/\s+/);
  const up = await ghlFetch('/contacts/upsert', token, '2021-07-28', {
    locationId: s.ghlLocationId,
    email: m.to,
    ...(firstName ? { firstName, lastName: rest.join(' ') || undefined } : {}),
    source: 'LCA Contratti',
  });
  const contactId = (up.contact as { id?: string } | undefined)?.id;
  if (!contactId) throw new Error('GoHighLevel: contatto non creato');
  await ghlFetch('/conversations/messages', token, '2021-04-15', {
    type: 'Email',
    contactId,
    subject: m.subject,
    html: m.html,
    message: m.text,
    ...(s.ghlEmailFrom ? { emailFrom: s.ghlEmailFrom } : {}),
  });
}

async function sendViaSmtp(m: Mail, html: string, text: string) {
  const s = await getSettings();
  const transport = nodemailer.createTransport({
    host: s.smtpHost,
    port: s.smtpPort,
    secure: s.smtpSecure,
    auth: s.smtpUser ? { user: s.smtpUser, pass: decrypt(s.smtpPassEnc) } : undefined,
  });
  await transport.sendMail({ from: { name: s.senderName, address: s.senderEmail }, replyTo: s.replyTo || undefined, to: m.to, subject: m.subject, text, html, attachments: m.attachments });
}

/**
 * Invia un'email scegliendo il canale:
 * - modalità "misto": invito e promemoria via GoHighLevel (con ripiego su SMTP se GHL fallisce);
 *   OTP, copia firmata, conferma di recesso e notifiche al team sempre via SMTP;
 * - senza SMTP configurato le email via SMTP vengono solo registrate (modalità test).
 */
export async function sendMail(m: Mail & { name?: string }): Promise<Result> {
  const s = await getSettings();
  const html = layout(m.text, s.brandColor, s.companyName, m.button);
  const text = m.button ? `${m.text}\n\n${m.button.label}: ${m.button.url}` : m.text;
  // Il codice OTP non viene conservato: nemmeno gli operatori devono poterlo leggere
  const isOtp = m.kind === 'otp';
  const log = (channel: string, status: string, error?: string) =>
    db.emailLog.create({ data: { contractId: m.contractId, kind: m.kind, channel, to: m.to, subject: isOtp && status !== 'simulata' ? 'Codice di verifica OTP' : m.subject, body: isOtp && status !== 'simulata' ? '(contenuto non conservato: codice OTP)' : text, status, error } });

  let ghlError: string | undefined;
  if (s.emailMode === 'misto' && GHL_KINDS.has(m.kind) && !m.attachments?.length && (await ghlConfigured())) {
    try {
      await sendViaGhl({ to: m.to, name: m.name, subject: m.subject, html, text });
      await log('ghl', 'inviata');
      return { ok: true, simulated: false, channel: 'ghl' };
    } catch (e) {
      ghlError = e instanceof Error ? e.message : String(e);
      await log('ghl', 'errore', `${ghlError} — provo con SMTP`);
    }
  }

  if (!s.smtpHost || !s.senderEmail) {
    await log('smtp', 'simulata');
    if (process.env.NODE_ENV !== 'production') console.log(`\n[EMAIL SIMULATA] a ${m.to}: ${m.subject}\n${text}\n`);
    return { ok: true, simulated: true, error: ghlError };
  }
  try {
    await sendViaSmtp(m, html, text);
    await log('smtp', 'inviata');
    return { ok: true, simulated: false, channel: 'smtp' };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await log('smtp', 'errore', error);
    return { ok: false, simulated: false, error: ghlError ? `${ghlError}; SMTP: ${error}` : error };
  }
}

/** Sostituisce {{nome}}, {{link}}, ecc. nei testi delle email. */
export function fillEmailText(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => vars[k] ?? m);
}
