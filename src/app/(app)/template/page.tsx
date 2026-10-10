import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatDateTime, type FieldDef } from '@/lib/fields';
import { duplicateTemplate, setArchived } from './actions';

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ archivio?: string }> }) {
  const user = await requireUser();
  const archived = (await searchParams).archivio === '1';
  const templates = await db.template.findMany({ where: { archived }, orderBy: { updatedAt: 'desc' }, include: { _count: { select: { contracts: true } } } });
  const admin = user.role === 'ADMIN';
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Template {archived && 'archiviati'}</h1>
          <p className="text-sm text-zinc-500">I contratti “madre”: testo, variabili e chi compila cosa.</p>
        </div>
        <div className="flex gap-2">
          <Link href={archived ? '/template' : '/template?archivio=1'} className="btn-ghost">{archived ? '← Attivi' : 'Archiviati'}</Link>
          {admin && <Link href="/template/nuovo" className="btn-primary">+ Nuovo template</Link>}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((t) => {
          const fields = t.fields as unknown as FieldDef[];
          const count = (w: string) => fields.filter((f) => f.filledBy === w).length;
          return (
            <div key={t.id} className="card flex flex-col p-5">
              <div className="flex-1">
                <h2 className="font-semibold">{t.name}</h2>
                <p className="mt-1 text-sm text-zinc-500">{t.description || 'Nessuna descrizione'}</p>
                <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                  <span className="badge bg-[#fff7e0] text-[#7a5a00] ring-[#e0b84a]">{count('azienda')} campi azienda</span>
                  <span className="badge bg-[#e9f2ff] text-[#1f4f96] ring-[#6d9be0]">{count('cliente')} campi cliente</span>
                </div>
                <p className="mt-3 text-xs text-zinc-400">v{t.version} · aggiornato {formatDateTime(t.updatedAt)} · {t._count.contracts} contratti</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {!archived && <Link href={`/contratti/nuovo?template=${t.id}`} className="btn-primary">Usa</Link>}
                <Link href={`/template/${t.id}`} className="btn-secondary">{admin ? 'Modifica' : 'Vedi'}</Link>
                {admin && (
                  <>
                    <form action={duplicateTemplate.bind(null, t.id)}><button className="btn-ghost">Duplica</button></form>
                    <form action={setArchived.bind(null, t.id, !archived)}><button className="btn-ghost">{archived ? 'Ripristina' : 'Archivia'}</button></form>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {!templates.length && <p className="text-sm text-zinc-500">Nessun template.</p>}
      </div>
    </div>
  );
}
