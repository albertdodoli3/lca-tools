import type { Metadata } from 'next';
import { findByToken, fieldsOf, markOpened, maskEmail, valuesOf, withdrawalDeadline } from '@/lib/contracts';
import { hasSignerSession } from '@/lib/auth';
import { reqInfo } from '@/lib/request';
import { getSettings } from '@/lib/settings';
import { formatDate } from '@/lib/fields';
import { SignerApp } from './SignerApp';
import '@fontsource/dancing-script/400.css';

export const metadata: Metadata = { title: 'Firma del contratto', robots: { index: false, follow: false }, referrer: 'no-referrer' };

function Shell({ s, children }: { s: Awaited<ReturnType<typeof getSettings>>; children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          {s.logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.logoDataUrl} alt={s.companyName} className="h-9 max-w-[160px] object-contain" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-xs font-bold text-white">LCA</div>
          )}
          <span className="text-sm font-medium">{s.companyName}</span>
          <span className="ml-auto flex items-center gap-1 text-xs text-zinc-500">🔒 Connessione protetta</span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}

export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const s = await getSettings();
  const found = await findByToken(token);
  if (!found || found.problem) {
    const text = !found ? 'Il link non è valido. Controlla di aver copiato l’indirizzo completo.' : found.problem === 'scaduto' ? 'Il link è scaduto. Contattaci per riceverne uno nuovo.' : 'Questo contratto non è più disponibile.';
    return (
      <Shell s={s}>
        <div className="card mx-auto max-w-md p-8 text-center">
          <h1 className="text-lg font-semibold">Link non disponibile</h1>
          <p className="mt-2 text-sm text-zinc-600">{text}</p>
          {s.replyTo && <p className="mt-4 text-sm"><a className="text-brand underline" href={`mailto:${s.replyTo}`}>{s.replyTo}</a></p>}
        </div>
      </Shell>
    );
  }
  const { contract: c, tokenHash } = found;
  await markOpened(c, await reqInfo());
  const authed = await hasSignerSession(c.id, tokenHash);
  const deadline = withdrawalDeadline(c);
  return (
    <Shell s={s}>
      <SignerApp
        token={token}
        authed={authed}
        companyName={s.companyName}
        contact={s.replyTo || s.senderEmail}
        contract={{
          code: c.code,
          title: c.title,
          status: c.status,
          recipientName: c.recipientName,
          maskedEmail: maskEmail(c.recipientEmail),
          html: authed ? c.signedHtml ?? c.html : '',
          fields: authed ? fieldsOf(c) : [],
          values: authed ? valuesOf(c) : {},
          sentAt: c.sentAt?.toISOString() ?? null,
          signedAt: c.signedAt?.toISOString() ?? null,
          withdrawnAt: c.withdrawnAt?.toISOString() ?? null,
          withdrawalDeadline: deadline ? formatDate(deadline) : null,
          canWithdraw: c.status === 'FIRMATO' && !!deadline && deadline > new Date(),
          hasPdf: !!c.pdfHash,
          companySignature: s.companySignatureUrl,
          companySignerName: s.companySignerName,
        }}
      />
    </Shell>
  );
}
