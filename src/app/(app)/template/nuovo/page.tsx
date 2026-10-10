import { requireAdmin } from '@/lib/auth';
import { createTemplate } from '../actions';

export default async function NewTemplatePage() {
  await requireAdmin();
  return (
    <div className="max-w-xl">
      <h1 className="mb-1 text-2xl font-semibold">Nuovo template</h1>
      <p className="mb-6 text-sm text-zinc-500">Parti da un file Word oppure da zero: potrai incollare il testo già formattato nell’editor.</p>
      <form action={createTemplate} className="card space-y-5 p-6">
        <div>
          <label className="label" htmlFor="name">Nome del template</label>
          <input className="input" id="name" name="name" required placeholder="Es. Contratto Percorso di Affiancamento" />
        </div>
        <div>
          <label className="label" htmlFor="file">Importa da Word (.docx) — facoltativo</label>
          <input className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:text-brand" id="file" name="file" type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />
          <p className="mt-1 text-xs text-zinc-500">Dopo l’import sostituisci i puntini “……” con le variabili, es. {'{{cliente_nome_cognome}}'}.</p>
        </div>
        <button className="btn-primary">Crea template</button>
      </form>
    </div>
  );
}
