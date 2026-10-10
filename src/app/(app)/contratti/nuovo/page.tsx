import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { createContract } from '../actions';

export default async function NewContractPage({ searchParams }: { searchParams: Promise<{ template?: string }> }) {
  await requireUser();
  const { template } = await searchParams;
  const templates = await db.template.findMany({ where: { archived: false }, orderBy: { updatedAt: 'desc' } });
  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold">Nuovo contratto</h1>
      <p className="mb-6 text-sm text-zinc-500">Scegli il template: verrà creata una copia da compilare per il cliente.</p>
      {!templates.length ? (
        <div className="card p-6 text-sm">Nessun template disponibile. <Link className="text-brand underline" href="/template/nuovo">Crea il primo template</Link>.</div>
      ) : (
        <form action={createContract} className="card space-y-5 p-6">
          <fieldset className="space-y-2">
            <legend className="label">Template</legend>
            {templates.map((t, i) => (
              <label key={t.id} className="flex cursor-pointer items-start gap-3 rounded-lg p-3 ring-1 ring-zinc-200 has-[:checked]:bg-brand-soft has-[:checked]:ring-brand">
                <input type="radio" name="templateId" value={t.id} defaultChecked={template ? template === t.id : i === 0} className="mt-1 accent-[rgb(var(--brand))]" required />
                <span>
                  <span className="block font-medium">{t.name}</span>
                  <span className="block text-xs text-zinc-500">{t.description || 'Nessuna descrizione'} · v{t.version}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div>
            <label className="label" htmlFor="title">Titolo del contratto (facoltativo)</label>
            <input className="input" id="title" name="title" placeholder="Es. Percorso di Affiancamento — Mario Rossi" />
          </div>
          <button className="btn-primary">Crea e compila la scheda d’ordine →</button>
        </form>
      )}
    </div>
  );
}
