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

/** Invia un'email. Senza SMTP configurato l'email viene solo registrata (modalità test). */
export async function sendMail(m: Mail): Promise<{ ok: boolean; simulated: boolean; error?: string }> {
  const s = await getSettings();
  const html = layout(m.text, s.brandColor, s.companyName, m.button);
  const text = m.button ? `${m.text}\n\n${m.button.label}: ${m.button.url}` : m.text;
  if (!s.smtpHost || !s.senderEmail) {
    await db.emailLog.create({ data: { contractId: m.contractId, kind: m.kind, to: m.to, subject: m.subject, body: text, status: 'simulata' } });
    if (process.env.NODE_ENV !== 'production') console.log(`\n[EMAIL SIMULATA] a ${m.to}: ${m.subject}\n${text}\n`);
    return { ok: true, simulated: true };
  }
  try {
    const transport = nodemailer.createTransport({
      host: s.smtpHost,
      port: s.smtpPort,
      secure: s.smtpSecure,
      auth: s.smtpUser ? { user: s.smtpUser, pass: decrypt(s.smtpPassEnc) } : undefined,
    });
    await transport.sendMail({
      from: { name: s.senderName, address: s.senderEmail },
      replyTo: s.replyTo || undefined,
      to: m.to,
      subject: m.subject,
      text,
      html,
      attachments: m.attachments,
    });
    // Il codice OTP non viene conservato: nemmeno gli operatori devono poterlo leggere
    const stored = m.kind === 'otp' ? '(contenuto non conservato: codice OTP)' : text;
    await db.emailLog.create({ data: { contractId: m.contractId, kind: m.kind, to: m.to, subject: m.kind === 'otp' ? 'Codice di verifica OTP' : m.subject, body: stored, status: 'inviata' } });
    return { ok: true, simulated: false };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await db.emailLog.create({ data: { contractId: m.contractId, kind: m.kind, to: m.to, subject: m.kind === 'otp' ? 'Codice di verifica OTP' : m.subject, body: m.kind === 'otp' ? '' : text, status: 'errore', error } });
    return { ok: false, simulated: false, error };
  }
}

/** Sostituisce {{nome}}, {{link}}, ecc. nei testi delle email. */
export function fillEmailText(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => vars[k] ?? m);
}
