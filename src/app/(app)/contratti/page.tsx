import Link from 'next/link';
import type { ContractStatus, Prisma } from '@prisma/client';
import { contractScope, requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { STATUS_LABEL } from '@/lib/status';
import { formatDateTime } from '@/lib/fields';
import { StatusBadge } from '@/components/StatusBadge';

export default async function ContractsPage({ searchParams }: { searchParams: Promise<{ q?: string; stato?: string }> }) {
  const user = await requireUser();
  const { q = '', stato = '' } = await searchParams;
  const where: Prisma.ContractWhereInput = { ...contractScope(user) };
  if (stato && stato in STATUS_LABEL) where.status = stato as ContractStatus;
  if (q) where.OR = [{ code: { contains: q, mode: 'insensitive' } }, { title: { contains: q, mode: 'insensitive' } }, { recipientName: { contains: q, mode: 'insensitive' } }, { recipientEmail: { contains: q, mode: 'insensitive' } }];
  const contracts = await db.contract.findMany({ where, orderBy: { updatedAt: 'desc' }, take: 200, include: { owner: { select: { name: true } } } });
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold">Contratti</h1>
        <Link href="/contratti/nuovo" className="btn-primary">+ Nuovo contratto</Link>
      </div>
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Cerca per cliente, email, codice…" className="input max-w-xs" />
        <select name="stato" defaultValue={stato} className="input w-auto">
          <option value="">Tutti gli stati</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn-secondary">Filtra</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr><th className="px-4 py-3">Codice</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Contratto</th><th className="px-4 py-3">Stato</th><th className="px-4 py-3">Venditore</th><th className="px-4 py-3">Ultima attività</th></tr>
          </thead>
          <tbody>
            {contracts.map((c) => (
              <tr key={c.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
                <td className="px-4 py-3"><Link className="font-medium text-brand hover:underline" href={`/contratti/${c.id}`}>{c.code}</Link></td>
                <td className="px-4 py-3">{c.recipientName || <span className="text-zinc-400">—</span>}<div className="text-xs text-zinc-500">{c.recipientEmail}</div></td>
                <td className="px-4 py-3">{c.title}</td>
                <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                <td className="px-4 py-3">{c.owner.name}</td>
                <td className="px-4 py-3 text-zinc-500">{formatDateTime(c.updatedAt)}</td>
              </tr>
            ))}
            {!contracts.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-zinc-400">Nessun contratto trovato</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
