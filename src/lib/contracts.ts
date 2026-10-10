import 'server-only';
import type { Contract, Prisma, User } from '@prisma/client';
import { db } from './db';
import { audit } from './audit';
import { decrypt, encrypt, generateOtp, hashOtp, hashToken, randomToken, safeEqual, sha256 } from './crypto';
import { fillEmailText, sendMail } from './mail';
import { notifyTeam } from './notify';
import { fireWebhook } from './webhook';
import { appUrl, getSettings } from './settings';
import { formatDate, formatDateTime, normalizeValue, validateAll, type FieldDef, type Values } from './fields';
import { renderContract } from './render';
import { certificateHtml, htmlToPdf, pdfDocument } from './pdf';
import { OPEN_STATUSES } from './status';
import type { ReqInfo } from './request';

export const OTP_MAX_ATTEMPTS = 5;
export const WITHDRAWAL_DAYS = 14;

export async function nextCode() {
  const year = new Date().getFullYear();
  const c = await db.counter.upsert({ where: { id: `contract-${year}` }, create: { id: `contract-${year}`, value: 1 }, update: { value: { increment: 1 } } });
  return `LCA-${year}-${String(c.value).padStart(4, '0')}`;
}

export const fieldsOf = (c: { fields: Prisma.JsonValue }) => c.fields as unknown as FieldDef[];
export const valuesOf = (c: { values: Prisma.JsonValue }) => (c.values ?? {}) as Values;

export function signLink(token: string) {
  return `${appUrl()}/firma/${token}`;
}

/** Link attuale del contratto (il token è salvato cifrato per poter rimandare i promemoria). */
export function currentLink(c: Contract) {
  return c.tokenEnc ? signLink(decrypt(c.tokenEnc)) : null;
}

export function maskEmail(e: string) {
  const [u, d] = e.split('@');
  if (!d) return e;
  return `${u.slice(0, 2)}${'•'.repeat(Math.max(1, u.length - 2))}@${d}`;
}

export function withdrawalDeadline(c: Contract) {
  return c.signedAt ? new Date(c.signedAt.getTime() + WITHDRAWAL_DAYS * 86400_000) : null;
}

const actorOf = (u: User) => ({ type: 'utente' as const, id: u.id, label: `${u.name} <${u.email}>` });

// ---------------------------------------------------------------- invio

export async function sendContract(
  c: Contract,
  user: User,
  input: { to: string; name: string; subject: string; body: string; expiryDays: number },
  req: ReqInfo,
) {
  const s = await getSettings();
  const token = randomToken();
  const expires = new Date(Date.now() + input.expiryDays * 86400_000);
  const link = signLink(token);
  const vars = { nome: input.name.split(' ')[0] || input.name, link, scadenza: formatDate(expires), titolo: c.title, azienda: s.companyName, codice: c.code };
  const subject = fillEmailText(input.subject, vars);
  const text = fillEmailText(input.body.includes('{{link}}') ? input.body : input.body + '\n\n{{link}}', vars);

  const updated = await db.contract.update({
    where: { id: c.id },
    data: {
      status: 'INVIATO',
      recipientEmail: input.to,
      recipientName: input.name,
      emailSubject: input.subject,
      emailBody: input.body,
      tokenHash: hashToken(token),
      tokenEnc: encrypt(token),
      tokenExpiresAt: expires,
      sentAt: new Date(),
      openedAt: null,
      otpVerifiedAt: null,
      remindersSent: 0,
      expiredAt: null,
    },
    include: { owner: true },
  });
  const res = await sendMail({ to: input.to, subject, text, kind: 'invito', contractId: c.id, button: { label: 'Apri e firma il contratto', url: link } });
  await audit(c.id, 'inviato', actorOf(user), req, { to: input.to, subject, expiresAt: expires.toISOString(), email: res.simulated ? 'simulata' : res.ok ? 'inviata' : 'errore' });
  await fireWebhook('contratto.inviato', updated);
  return { ...res, link };
}

export async function retractContract(c: Contract, user: User, req: ReqInfo) {
  await db.contract.update({ where: { id: c.id }, data: { status: 'BOZZA', tokenHash: null, tokenEnc: null, tokenExpiresAt: null } });
  await audit(c.id, 'ritirato', actorOf(user), req);
}

export async function cancelContract(c: Contract, user: User, req: ReqInfo, reason: string) {
  const updated = await db.contract.update({ where: { id: c.id }, data: { status: 'ANNULLATO', cancelledAt: new Date(), tokenHash: null, tokenEnc: null }, include: { owner: true } });
  await audit(c.id, 'annullato', actorOf(user), req, { motivo: reason });
  await fireWebhook('contratto.annullato', updated);
}

// ---------------------------------------------------------------- lato cliente

export type TokenLookup = { contract: Contract; tokenHash: string; problem?: 'scaduto' | 'annullato' };

export async function findByToken(token: string): Promise<TokenLookup | null> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const tokenHash = hashToken(token);
  const contract = await db.contract.findUnique({ where: { tokenHash } });
  if (!contract) return null;
  if (contract.status === 'ANNULLATO' || contract.status === 'BOZZA') return { contract, tokenHash, problem: 'annullato' };
  const open = OPEN_STATUSES.includes(contract.status);
  if (contract.status === 'SCADUTO' || (open && contract.tokenExpiresAt && contract.tokenExpiresAt < new Date())) return { contract, tokenHash, problem: 'scaduto' };
  return { contract, tokenHash };
}

export async function markOpened(c: Contract, req: ReqInfo) {
  if (c.status === 'INVIATO') {
    const updated = await db.contract.update({ where: { id: c.id }, data: { status: 'APERTO', openedAt: new Date() }, include: { owner: true } });
    await audit(c.id, 'link_aperto', { type: 'cliente' }, req);
    await notifyTeam(c, `${c.recipientName || 'Il cliente'} ha aperto il contratto ${c.code}`);
    await fireWebhook('contratto.aperto', updated);
  }
}

export async function requestOtp(c: Contract, req: ReqInfo): Promise<{ ok: true } | { ok: false; error: string }> {
  const s = await getSettings();
  const recent = await db.otpCode.findMany({ where: { contractId: c.id, createdAt: { gt: new Date(Date.now() - 3600_000) } }, orderBy: { createdAt: 'desc' } });
  if (recent[0] && Date.now() - recent[0].createdAt.getTime() < 45_000) return { ok: false, error: 'Attendi qualche secondo prima di richiedere un nuovo codice.' };
  if (recent.length >= 6) return { ok: false, error: 'Troppi codici richiesti. Riprova tra un’ora o contatta l’assistenza.' };

  const code = generateOtp();
  await db.otpCode.updateMany({ where: { contractId: c.id, usedAt: null }, data: { usedAt: new Date(0) } }); // invalida i precedenti
  await db.otpCode.create({ data: { contractId: c.id, codeHash: hashOtp(c.id, code), sentTo: c.recipientEmail, expiresAt: new Date(Date.now() + s.otpMinutes * 60_000), ip: req.ip } });
  const res = await sendMail({
    to: c.recipientEmail,
    subject: `${code} è il tuo codice per il contratto ${c.code}`,
    text: `Il tuo codice di verifica è:\n\n${code}\n\nInseriscilo nella pagina del contratto "${c.title}" per confermare la tua identità e iniziare la compilazione. Il codice scade tra ${s.otpMinutes} minuti.\n\nNon condividere questo codice con nessuno: ${s.companyName} non te lo chiederà mai per telefono.`,
    kind: 'otp',
    contractId: c.id,
  });
  await audit(c.id, 'otp_inviato', { type: 'cliente' }, req, { to: c.recipientEmail, canale: 'email' });
  if (!res.ok) return { ok: false, error: 'Non è stato possibile inviare l’email. Riprova più tardi.' };
  return { ok: true };
}

export async function verifyOtp(c: Contract, code: string, req: ReqInfo): Promise<{ ok: true } | { ok: false; error: string }> {
  const otp = await db.otpCode.findFirst({ where: { contractId: c.id, usedAt: null }, orderBy: { createdAt: 'desc' } });
  if (!otp || otp.expiresAt < new Date()) return { ok: false, error: 'Codice scaduto: richiedine uno nuovo.' };
  if (otp.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, error: 'Troppi tentativi: richiedi un nuovo codice.' };
  const clean = code.replace(/\D/g, '');
  if (!safeEqual(hashOtp(c.id, clean), otp.codeHash)) {
    const upd = await db.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    const blocked = upd.attempts >= OTP_MAX_ATTEMPTS;
    await audit(c.id, blocked ? 'otp_bloccato' : 'otp_errato', { type: 'cliente' }, req, { tentativo: upd.attempts });
    return { ok: false, error: blocked ? 'Troppi tentativi: richiedi un nuovo codice.' : `Codice errato. Tentativi rimasti: ${OTP_MAX_ATTEMPTS - upd.attempts}.` };
  }
  await db.otpCode.update({ where: { id: otp.id }, data: { usedAt: new Date() } });
  await audit(c.id, 'otp_verificato', { type: 'cliente' }, req, { to: otp.sentTo, canale: 'email' });
  if (c.status === 'INVIATO' || c.status === 'APERTO') {
    const updated = await db.contract.update({ where: { id: c.id }, data: { status: 'SBLOCCATO', otpVerifiedAt: new Date(), openedAt: c.openedAt ?? new Date() }, include: { owner: true } });
    await notifyTeam(c, `${c.recipientName || 'Il cliente'} ha verificato l’OTP e sta compilando il contratto ${c.code}`);
    await fireWebhook('contratto.sbloccato', updated);
  }
  return { ok: true };
}

/** Tiene solo i campi che il cliente può compilare. */
export function pickClientValues(fields: FieldDef[], input: Values): Values {
  const out: Values = {};
  for (const f of fields) if (f.filledBy === 'cliente' && f.key in input) out[f.key] = normalizeValue(f, input[f.key]);
  return out;
}

export async function saveDraft(c: Contract, input: Values) {
  const fields = fieldsOf(c);
  const clientValues = pickClientValues(fields.filter((f) => f.type !== 'signature'), input);
  await db.contract.update({ where: { id: c.id }, data: { values: { ...valuesOf(c), ...clientValues } as Prisma.InputJsonValue } });
}

export async function signContract(c: Contract, input: Values, req: ReqInfo): Promise<{ ok: true } | { ok: false; errors: Record<string, string>; error?: string }> {
  const fields = fieldsOf(c);
  const values = { ...valuesOf(c), ...pickClientValues(fields, input) };
  const errors = validateAll(fields, values, 'cliente');
  if (Object.keys(errors).length) return { ok: false, errors };

  // Blocca la firma doppia: solo un contratto ancora aperto può passare a FIRMATO
  const signedAt = new Date();
  const claim = await db.contract.updateMany({ where: { id: c.id, status: 'SBLOCCATO' }, data: { status: 'FIRMATO', signedAt } });
  if (claim.count !== 1) return { ok: false, errors: {}, error: 'Il contratto non è più firmabile.' };

  const s = await getSettings();
  const finalHtml = renderContract(c.html, fields, values, 'final', { companySignature: s.companySignatureUrl, companySignerName: s.companySignerName, code: c.code, sentAt: c.sentAt?.toISOString(), signedAt: signedAt.toISOString() });
  const documentHash = sha256(finalHtml);
  const signerName = String(values.cliente_nome_cognome || c.recipientName || '');

  await db.contract.update({ where: { id: c.id }, data: { values: values as Prisma.InputJsonValue, signedHtml: finalHtml, documentHash, signerIp: req.ip, signerUserAgent: req.userAgent } });
  const checked = fields.filter((f) => f.type === 'checkbox').map((f) => ({ campo: f.key, valore: values[f.key] === true }));
  await audit(c.id, 'firmato', { type: 'cliente', label: signerName }, req, { documentHash, dichiarazioni: checked, firme: fields.filter((f) => f.type === 'signature' && f.filledBy === 'cliente').map((f) => f.key) });

  let pdf: Buffer | null = null;
  try {
    pdf = await buildSignedPdf(c.id);
  } catch (e) {
    console.error('PDF', e);
    await notifyTeam(c, `Errore nella generazione del PDF di ${c.code}: rigeneralo dalla pagina del contratto`);
  }
  const updated = await db.contract.findUniqueOrThrow({ where: { id: c.id }, include: { owner: true } });

  // Copia su supporto durevole (art. 51 Codice del Consumo)
  const deadline = withdrawalDeadline(updated)!;
  const link = currentLink(updated);
  const mail = await sendMail({
    to: c.recipientEmail,
    subject: `Contratto ${c.code} firmato: la tua copia`,
    text: `Ciao ${signerName.split(' ')[0] || ''},\n\ngrazie: il contratto "${c.title}" è stato firmato il ${formatDateTime(signedAt)}.\n\n${pdf ? `In allegato trovi la copia completa in PDF, con la Scheda d’ordine, gli allegati e il certificato di firma. Conservala.\n\nImpronta SHA-256 del PDF: ${updated.pdfHash}` : 'A breve riceverai la copia completa in PDF.'}\n\nDiritto di recesso: puoi recedere entro il ${formatDate(deadline)} scrivendo a ${s.replyTo || s.senderEmail || 'info@conquistalei.com'} oppure dalla pagina del contratto, con il pulsante "Recedi dal contratto qui":\n${link ?? ''}\n\n${s.companyName}`,
    kind: 'copia_firmata',
    contractId: c.id,
    attachments: pdf ? [{ filename: `${c.code}.pdf`, content: pdf }] : undefined,
  });
  if (pdf) await audit(c.id, 'copia_inviata', { type: 'sistema' }, null, { to: c.recipientEmail, pdfHash: updated.pdfHash, email: mail.simulated ? 'simulata' : mail.ok ? 'inviata' : 'errore' });
  await notifyTeam(c, `✅ ${signerName || 'Il cliente'} ha firmato il contratto ${c.code}`, { email: true });
  await fireWebhook('contratto.firmato', updated);
  return { ok: true };
}

export async function withdraw(c: Contract, req: ReqInfo, note: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const deadline = withdrawalDeadline(c);
  if (c.status !== 'FIRMATO' || !deadline) return { ok: false, error: 'Recesso non disponibile per questo contratto.' };
  if (deadline < new Date()) return { ok: false, error: 'Il termine di 14 giorni per il recesso è scaduto.' };
  const at = new Date();
  const updated = await db.contract.update({ where: { id: c.id }, data: { status: 'RECEDUTO', withdrawnAt: at }, include: { owner: true } });
  await audit(c.id, 'recesso', { type: 'cliente' }, req, { nota: note.slice(0, 1000) });
  const s = await getSettings();
  // Conferma di ricevimento su supporto durevole (art. 54-bis Codice del Consumo)
  await sendMail({
    to: c.recipientEmail,
    subject: `Conferma di ricevimento del recesso — ${c.code}`,
    text: `Confermiamo di aver ricevuto il ${formatDateTime(at)} la tua comunicazione di recesso dal contratto "${c.title}" (${c.code}).\n\n${note ? `Tua nota: ${note}\n\n` : ''}Il rimborso degli importi dovuti avverrà entro 14 giorni, secondo quanto previsto dal contratto.\n\n${s.companyName}`,
    kind: 'recesso',
    contractId: c.id,
  });
  await notifyTeam(c, `⚠️ Recesso esercitato sul contratto ${c.code}`, { email: true });
  await fireWebhook('contratto.receduto', updated);
  return { ok: true };
}

/** Genera (o rigenera) il PDF firmato con il certificato e il registro degli eventi. */
export async function buildSignedPdf(contractId: string): Promise<Buffer> {
  const c = await db.contract.findUniqueOrThrow({ where: { id: contractId } });
  if (!c.signedAt || !c.documentHash || !c.signedHtml) throw new Error('Contratto non firmato');
  const s = await getSettings();
  const values = valuesOf(c);
  const finalHtml = c.signedHtml;
  if (sha256(finalHtml) !== c.documentHash) throw new Error('Il contenuto firmato non corrisponde all’impronta registrata');
  const events = await db.auditEvent.findMany({ where: { contractId, createdAt: { lte: new Date(c.signedAt.getTime() + 60_000) } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  const signerName = String(values.cliente_nome_cognome || c.recipientName || '');
  const cert = certificateHtml({ code: c.code, title: c.title, companyName: s.companyName, signerName, signerEmail: c.recipientEmail, signedAt: c.signedAt, documentHash: c.documentHash, events: events.filter((e) => e.type !== 'pdf_scaricato') });
  const pdf = await htmlToPdf(pdfDocument(finalHtml, cert, s.logoDataUrl), `${c.code} · SHA-256 contenuto: ${c.documentHash.slice(0, 24)}…`);
  await db.contract.update({ where: { id: c.id }, data: { pdf: new Uint8Array(pdf), pdfHash: sha256(pdf) } });
  return pdf;
}
