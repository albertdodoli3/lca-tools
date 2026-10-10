import 'server-only';
import type { Prisma } from '@prisma/client';
import { db } from './db';
import { audit } from './audit';
import { currentLink } from './contracts';
import { fillEmailText, sendMail } from './mail';
import { notifyTeam } from './notify';
import { fireWebhook } from './webhook';
import { getSettings } from './settings';
import { formatDate } from './fields';
import { OPEN_STATUSES } from './status';

/** Promemoria, scadenze dei link e cancellazione dei dati oltre i tempi di conservazione. */
export async function runJobs() {
  const s = await getSettings();
  const now = new Date();
  const reminderDays = s.reminderDays.split(/[,\s]+/).map(Number).filter((n) => n > 0).sort((a, b) => a - b);

  // 1. Link scaduti
  const expired = await db.contract.findMany({ where: { status: { in: OPEN_STATUSES }, tokenExpiresAt: { lt: now } }, include: { owner: true } });
  for (const c of expired) {
    const updated = await db.contract.update({ where: { id: c.id }, data: { status: 'SCADUTO', expiredAt: now }, include: { owner: true } });
    await audit(c.id, 'scaduto', { type: 'sistema' });
    await notifyTeam(c, `Il link del contratto ${c.code} (${c.recipientName}) è scaduto senza firma`);
    await fireWebhook('contratto.scaduto', updated);
  }

  // 2. Promemoria
  const pending = await db.contract.findMany({ where: { status: { in: OPEN_STATUSES }, sentAt: { not: null } } });
  for (const c of pending) {
    const due = reminderDays[c.remindersSent];
    if (due === undefined || !c.sentAt) continue;
    if (now.getTime() - c.sentAt.getTime() < due * 86400_000) continue;
    const link = currentLink(c);
    if (!link) continue;
    const vars = { nome: c.recipientName.split(' ')[0], link, scadenza: formatDate(c.tokenExpiresAt), titolo: c.title, azienda: s.companyName, codice: c.code };
    await sendMail({
      to: c.recipientEmail,
      name: c.recipientName,
      subject: `Promemoria: ${fillEmailText(c.emailSubject || s.defaultEmailSubject, vars)}`,
      text: `Ciao ${vars.nome},\n\nti ricordiamo che il contratto "${c.title}" è in attesa della tua firma. Il link è valido fino al ${vars.scadenza}.\n\n${s.companyName}`,
      kind: 'promemoria',
      contractId: c.id,
      button: { label: 'Completa e firma', url: link },
    });
    await db.contract.update({ where: { id: c.id }, data: { remindersSent: { increment: 1 } } });
    await audit(c.id, 'promemoria', { type: 'sistema' }, null, { to: c.recipientEmail, numero: c.remindersSent + 1 });
    await notifyTeam(c, `Promemoria n. ${c.remindersSent + 1} inviato a ${c.recipientName} per il contratto ${c.code} (non ancora firmato)`);
  }

  // 3. Conservazione (GDPR, minimizzazione): anonimizza i contratti oltre i termini
  const signedLimit = new Date(now);
  signedLimit.setFullYear(signedLimit.getFullYear() - s.signedRetentionYears);
  const unsignedLimit = new Date(now);
  unsignedLimit.setMonth(unsignedLimit.getMonth() - s.unsignedRetentionMonths);
  const old = await db.contract.findMany({
    where: {
      anonymizedAt: null,
      OR: [
        { status: { in: ['FIRMATO', 'RECEDUTO'] }, signedAt: { lt: signedLimit } },
        { status: { in: ['BOZZA', 'ANNULLATO', 'SCADUTO'] }, updatedAt: { lt: unsignedLimit } },
      ],
    },
    select: { id: true },
  });
  for (const { id } of old) {
    await db.$transaction(async (tx) => {
      await tx.contract.update({ where: { id }, data: { values: {} as Prisma.InputJsonValue, signedHtml: null, pdf: null, recipientName: 'anonimizzato', recipientEmail: 'anonimizzato', emailBody: '', signerIp: null, signerUserAgent: null, tokenHash: null, tokenEnc: null, anonymizedAt: now } });
      await tx.otpCode.deleteMany({ where: { contractId: id } });
      await tx.emailLog.deleteMany({ where: { contractId: id } });
      await tx.auditEvent.updateMany({ where: { contractId: id }, data: { ip: null, userAgent: null } });
    });
    await audit(id, 'anonimizzato', { type: 'sistema' });
  }
  return { expired: expired.length, reminders: pending.length, anonymized: old.length };
}
