import Link from 'next/link';
import { contractScope, requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { PIPELINE } from '@/lib/status';
import { formatDateTime } from '@/lib/fields';
import { StatusBadge } from '@/components/StatusBadge';

export default async function PipelinePage() {
  const user = await requireUser();
  const since = new Date(Date.now() - 90 * 86400_000);
  const contracts = await db.contract.findMany({
    where: { ...contractScope(user), OR: [{ status: { notIn: ['ANNULLATO', 'SCADUTO', 'RECEDUTO', 'FIRMATO'] } }, { updatedAt: { gt: since } }] },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, code: true, title: true, status: true, recipientName: true, updatedAt: true, sentAt: true, signedAt: true, owner: { select: { name: true } } },
  });
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [sentMonth, signedMonth] = await Promise.all([
    db.contract.count({ where: { ...contractScope(user), sentAt: { gte: monthStart } } }),
    db.contract.count({ where: { ...contractScope(user), signedAt: { gte: monthStart } } }),
  ]);
  const waiting = contracts.filter((c) => ['INVIATO', 'APERTO', 'SBLOCCATO'].includes(c.status)).length;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Pipeline contratti</h1>
          <p className="text-sm text-zinc-500">Inviato → Aperto → OTP sbloccato → Firmato</p>
        </div>
        <Link href="/contratti/nuovo" className="btn-primary">+ Nuovo contratto</Link>
      </div>
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          ['Inviati questo mese', sentMonth],
          ['Firmati questo mese', signedMonth],
          ['In attesa del cliente', waiting],
        ].map(([l, v]) => (
          <div key={l} className="card px-4 py-3">
            <div className="text-xs text-zinc-500">{l}</div>
            <div className="text-2xl font-semibold">{v}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {PIPELINE.map((col) => {
          const items = contracts.filter((c) => col.statuses.includes(c.status));
          return (
            <section key={col.key} className="w-64 shrink-0 rounded-xl bg-zinc-100/80 p-2">
              <h2 className="flex items-center justify-between px-2 py-1 text-sm font-semibold text-zinc-700">
                {col.label} <span className="text-xs font-normal text-zinc-500">{items.length}</span>
              </h2>
              <div className="mt-1 space-y-2">
                {items.map((c) => (
                  <Link key={c.id} href={`/contratti/${c.id}`} className="block rounded-lg bg-white p-3 text-sm shadow-sm ring-1 ring-zinc-200 hover:ring-brand">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-zinc-500">{c.code}</span>
                      {col.key === 'chiusi' && <StatusBadge status={c.status} />}
                    </div>
                    <div className="mt-1 font-medium">{c.recipientName || 'Cliente da definire'}</div>
                    <div className="truncate text-xs text-zinc-500">{c.title}</div>
                    <div className="mt-2 flex justify-between text-[11px] text-zinc-400">
                      <span>{c.owner.name}</span>
                      <span>{formatDateTime(c.updatedAt).slice(0, 10)}</span>
                    </div>
                  </Link>
                ))}
                {!items.length && <p className="px-2 py-4 text-center text-xs text-zinc-400">Nessun contratto</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
