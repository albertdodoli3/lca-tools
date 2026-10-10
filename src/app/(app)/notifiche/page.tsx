import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatDateTime } from '@/lib/fields';

async function markAllRead() {
  'use server';
  const user = await requireUser();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath('/', 'layout');
}

export default async function NotificationsPage() {
  const user = await requireUser();
  const items = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 100 });
  return (
    <div className="max-w-3xl">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Avvisi</h1>
        <form action={markAllRead}><button className="btn-secondary">Segna tutti come letti</button></form>
      </div>
      <div className="card divide-y divide-zinc-100">
        {items.map((n) => (
          <div key={n.id} className={`flex items-start gap-3 px-4 py-3 text-sm ${n.readAt ? 'text-zinc-500' : ''}`}>
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? 'bg-zinc-200' : 'bg-brand'}`} />
            <div className="flex-1">
              {n.contractId ? <Link href={`/contratti/${n.contractId}`} className="hover:underline">{n.message}</Link> : n.message}
              <div className="text-xs text-zinc-400">{formatDateTime(n.createdAt)}</div>
            </div>
          </div>
        ))}
        {!items.length && <p className="px-4 py-10 text-center text-sm text-zinc-400">Nessun avviso</p>}
      </div>
    </div>
  );
}
