import { getSettings } from '@/lib/settings';

export async function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const s = await getSettings();
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          {s.logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.logoDataUrl} alt={s.companyName} className="mx-auto mb-3 max-h-14" />
          ) : (
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-lg font-bold text-white">LCA</div>
          )}
          <h1 className="text-xl font-semibold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
        </div>
        <div className="card p-6">{children}</div>
      </div>
    </main>
  );
}
