import { notFound } from 'next/navigation';
import { contractScope, requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { verifyAuditChain } from '@/lib/audit';
import { currentLink, fieldsOf, valuesOf, withdrawalDeadline } from '@/lib/contracts';
import { emailConfigured } from '@/lib/mail';
import { getSettings } from '@/lib/settings';
import { EVENT_LABEL } from '@/lib/status';
import { ContractWorkspace } from './ContractWorkspace';

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const c = await db.contract.findFirst({ where: { id, ...contractScope(user) }, include: { owner: { select: { name: true } } } });
  if (!c) notFound();
  const [events, emails, s, mailOk, chainOk] = await Promise.all([
    db.auditEvent.findMany({ where: { contractId: id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
    db.emailLog.findMany({ where: { contractId: id }, orderBy: { createdAt: 'desc' } }),
    getSettings(),
    emailConfigured(),
    verifyAuditChain(id),
  ]);
  // Il destinatario predefinito viene dai dati cliente eventualmente precompilati
  const values = valuesOf(c);
  return (
    <ContractWorkspace
      contract={{
        id: c.id,
        code: c.code,
        title: c.title,
        status: c.status,
        html: c.html,
        fields: fieldsOf(c),
        values,
        ownerName: c.owner.name,
        recipientName: c.recipientName || String(values.cliente_nome_cognome ?? ''),
        recipientEmail: c.recipientEmail || String(values.cliente_email ?? ''),
        emailSubject: c.emailSubject || s.defaultEmailSubject,
        emailBody: c.emailBody || s.defaultEmailBody,
        sentAt: c.sentAt?.toISOString() ?? null,
        openedAt: c.openedAt?.toISOString() ?? null,
        otpVerifiedAt: c.otpVerifiedAt?.toISOString() ?? null,
        signedAt: c.signedAt?.toISOString() ?? null,
        withdrawnAt: c.withdrawnAt?.toISOString() ?? null,
        tokenExpiresAt: c.tokenExpiresAt?.toISOString() ?? null,
        withdrawalDeadline: withdrawalDeadline(c)?.toISOString() ?? null,
        link: ['INVIATO', 'APERTO', 'SBLOCCATO', 'FIRMATO'].includes(c.status) ? currentLink(c) : null,
        signedHtml: c.signedHtml,
        documentHash: c.documentHash,
        pdfHash: c.pdfHash,
        hasPdf: !!c.pdfHash,
        anonymized: !!c.anonymizedAt,
      }}
      events={events.map((e) => ({ id: e.id, label: EVENT_LABEL[e.type] ?? e.type, type: e.type, at: e.createdAt.toISOString(), actor: e.actorType === 'utente' ? e.actorLabel ?? 'Operatore' : e.actorType === 'cliente' ? 'Cliente' : 'Sistema', ip: e.ip, userAgent: e.userAgent, data: e.data as Record<string, unknown>, hash: e.hash }))}
      emails={emails.map((m) => ({ id: m.id, kind: m.kind, to: m.to, subject: m.subject, body: m.body, status: m.status, error: m.error, at: m.createdAt.toISOString() }))}
      settings={{ companySignature: s.companySignatureUrl, companySignerName: s.companySignerName, linkExpiryDays: s.linkExpiryDays, emailConfigured: mailOk }}
      chainOk={chainOk}
    />
  );
}
