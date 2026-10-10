'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavLinks({ links }: { links: { href: string; label: string; badge?: number }[] }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
      {links.map((l) => {
        const active = l.href === '/' ? path === '/' : path.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} className={`flex shrink-0 items-center justify-between rounded-lg px-3 py-2 text-sm ${active ? 'bg-brand-soft font-medium text-brand' : 'text-zinc-700 hover:bg-zinc-100'}`}>
            {l.label}
            {!!l.badge && <span className="ml-2 rounded-full bg-brand px-1.5 text-xs text-white">{l.badge}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
