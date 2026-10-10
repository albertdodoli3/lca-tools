import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatDateTime } from '@/lib/fields';
import { UserForm, ResetButton } from './UserForm';
import { toggleUser } from './actions';

export default async function UsersPage() {
  const me = await requireAdmin();
  const users = await db.user.findMany({ orderBy: { createdAt: 'asc' }, include: { _count: { select: { contracts: true } } } });
  return (
    <div className="max-w-4xl space-y-5">
      <h1 className="text-2xl font-semibold">Utenti</h1>
      <p className="text-sm text-zinc-500">Gli amministratori vedono tutto e gestiscono template e impostazioni. I venditori vedono solo i propri contratti.</p>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-500">
            <tr><th className="px-4 py-3">Nome</th><th className="px-4 py-3">Ruolo</th><th className="px-4 py-3">Contratti</th><th className="px-4 py-3">Ultimo accesso</th><th className="px-4 py-3" /></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={`border-b border-zinc-100 last:border-0 ${u.active ? '' : 'opacity-50'}`}>
                <td className="px-4 py-3"><div className="font-medium">{u.name}</div><div className="text-xs text-zinc-500">{u.email}</div></td>
                <td className="px-4 py-3">{u.role === 'ADMIN' ? 'Amministratore' : 'Venditore'}</td>
                <td className="px-4 py-3">{u._count.contracts}</td>
                <td className="px-4 py-3 text-zinc-500">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : '—'}</td>
                <td className="px-4 py-3 text-right">
                  {u.id !== me.id && (
                    <div className="flex justify-end gap-2">
                      <ResetButton id={u.id} />
                      <form action={toggleUser.bind(null, u.id)}><button className="btn-ghost text-xs">{u.active ? 'Disattiva' : 'Riattiva'}</button></form>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <UserForm />
    </div>
  );
}
