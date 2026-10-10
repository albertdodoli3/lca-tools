import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { logout } from '../login/actions';
import { NavLinks } from '@/components/NavLinks';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const s = await getSettings();
  const unread = await db.notification.count({ where: { userId: user.id, readAt: null } });
  const links = [
    { href: '/', label: 'Pipeline' },
    { href: '/contratti', label: 'Contratti' },
    { href: '/template', label: 'Template' },
    { href: '/notifiche', label: 'Avvisi', badge: unread },
    ...(user.role === 'ADMIN' ? [{ href: '/impostazioni', label: 'Impostazioni' }, { href: '/utenti', label: 'Utenti' }] : []),
  ];
  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-zinc-200 bg-white md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col md:border-b-0 md:border-r">
        <div className="flex items-center gap-2 px-4 py-3 md:py-5">
          {s.logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.logoDataUrl} alt="" className="h-8 max-w-[120px] object-contain" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-xs font-bold text-white">LCA</div>
          )}
          <Link href="/" className="text-sm font-semibold leading-tight">Contratti<br /><span className="font-normal text-zinc-500">{s.senderName}</span></Link>
        </div>
        <NavLinks links={links} />
        <div className="hidden border-t border-zinc-200 px-4 py-3 text-sm md:mt-auto md:block">
          <div className="font-medium">{user.name}</div>
          <div className="text-xs text-zinc-500">{user.role === 'ADMIN' ? 'Amministratore' : 'Venditore'}</div>
          <form action={logout}><button className="mt-2 text-xs text-zinc-500 underline hover:text-zinc-800">Esci</button></form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8">{children}</main>
    </div>
  );
}
