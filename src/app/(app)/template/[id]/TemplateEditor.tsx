'use client';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { FIELD_TYPES, FILLED_BY, AUTO_FIELDS, syncFields, type FieldDef } from '@/lib/fields';
import { DOC_CSS, renderContract } from '@/lib/render';
import { DocPreview } from '@/components/DocPreview';
import { VariableHighlight } from './VariableHighlight';
import { importDocx, saveTemplate } from '../actions';

type T = { id: string; name: string; description: string; html: string; fields: FieldDef[]; version: number };

export function TemplateEditor({ template, readOnly }: { template: T; readOnly: boolean }) {
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description);
  const [html, setHtml] = useState(template.html);
  const [fields, setFields] = useState<FieldDef[]>(template.fields);
  const [version, setVersion] = useState(template.version);
  const [mode, setMode] = useState<'testo' | 'anteprima'>('testo');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [newVar, setNewVar] = useState('');
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    editable: !readOnly,
    extensions: [StarterKit, Underline, TextAlign.configure({ types: ['heading', 'paragraph'] }), Table.configure({ resizable: false }), TableRow, TableHeader, TableCell, VariableHighlight],
    content: template.html,
    editorProps: { attributes: { class: 'doc tiptap min-h-[60vh] outline-none' } },
    onUpdate: ({ editor }) => {
      setHtml(editor.getHTML());
      setDirty(true);
    },
  });

  // Mantiene la lista dei campi allineata alle variabili presenti nel testo
  const synced = useMemo(() => syncFields(html, fields), [html, fields]);
  useEffect(() => {
    const t = setTimeout(() => setFields((cur) => syncFields(html, cur).concat(cur.filter((f) => !synced.find((s) => s.key === f.key)))), 400);
    return () => clearTimeout(t);
  }, [html]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (key: string, patch: Partial<FieldDef>) => {
    setFields((cur) => {
      const has = cur.find((f) => f.key === key);
      const base = has ?? synced.find((f) => f.key === key)!;
      const next = { ...base, ...patch };
      return has ? cur.map((f) => (f.key === key ? next : f)) : [...cur, next];
    });
    setDirty(true);
  };

  const insertVar = (key: string) => {
    const k = key.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
    if (!k || !editor) return;
    editor.chain().focus().insertContent(`{{${k}}}`).run();
    setNewVar('');
  };

  const save = () =>
    start(async () => {
      const r = await saveTemplate(template.id, { name, description, html: editor?.getHTML() ?? html, fields: synced });
      if (r.error) setMsg({ type: 'err', text: r.error });
      else {
        setMsg({ type: 'ok', text: `Template salvato (versione ${r.version}). I contratti già creati non cambiano.` });
        setVersion(r.version!);
        setDirty(false);
      }
    });

  const onImport = (file: File) =>
    start(async () => {
      if (!confirm('Il testo attuale verrà sostituito con quello del file Word. Continuare?')) return;
      const fd = new FormData();
      fd.set('file', file);
      const r = await importDocx(fd);
      if (r.error) setMsg({ type: 'err', text: r.error });
      else {
        editor?.commands.setContent(r.html!, true);
        setMsg({ type: 'ok', text: 'Documento importato. Sostituisci i puntini con le variabili {{…}}.' });
      }
    });

  const preview = useMemo(() => renderContract(html, synced, {}, 'preview'), [html, synced]);
  const groups: [string, FieldDef[]][] = [
    ['Azienda (scheda d’ordine)', synced.filter((f) => f.filledBy === 'azienda')],
    ['Cliente', synced.filter((f) => f.filledBy === 'cliente')],
    ['Automatici', synced.filter((f) => f.filledBy === 'auto')],
  ];

  return (
    <div>
      <style>{DOC_CSS}</style>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm text-zinc-500"><Link href="/template" className="hover:underline">Template</Link> / v{version}</div>
          <input className="mt-1 w-full border-0 bg-transparent p-0 text-2xl font-semibold outline-none" value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }} disabled={readOnly} aria-label="Nome del template" />
          <input className="mt-1 w-full border-0 bg-transparent p-0 text-sm text-zinc-500 outline-none" placeholder="Descrizione breve…" value={description} onChange={(e) => { setDescription(e.target.value); setDirty(true); }} disabled={readOnly} aria-label="Descrizione" />
        </div>
        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept=".docx" className="hidden" onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
            <button className="btn-secondary" onClick={() => fileRef.current?.click()} disabled={pending}>Importa da Word</button>
            <button className="btn-primary" onClick={save} disabled={pending || !dirty}>{pending ? 'Salvataggio…' : dirty ? 'Salva template' : 'Salvato'}</button>
          </div>
        )}
      </div>
      {msg && (
        <div className={`mb-4 flex justify-between rounded-lg px-4 py-2 text-sm ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
          {msg.text}<button onClick={() => setMsg(null)}>×</button>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <div className="card min-w-0">
          <div className="flex flex-wrap items-center gap-1 border-b border-zinc-200 p-2">
            <div className="mr-2 flex rounded-lg bg-zinc-100 p-0.5 text-sm">
              {(['testo', 'anteprima'] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)} className={`rounded-md px-3 py-1 capitalize ${mode === m ? 'bg-white shadow-sm' : 'text-zinc-600'}`}>{m}</button>
              ))}
            </div>
            {mode === 'testo' && editor && !readOnly && <Toolbar editor={editor} />}
          </div>
          <div className="max-h-[75vh] overflow-y-auto p-5 sm:p-8">
            <div className={mode === 'testo' ? '' : 'hidden'}><EditorContent editor={editor} /></div>
            {mode === 'anteprima' && <DocPreview html={preview} />}
          </div>
        </div>

        <aside className="space-y-4">
          {!readOnly && (
            <div className="card p-4">
              <h2 className="font-semibold">Inserisci variabile</h2>
              <p className="mb-2 text-xs text-zinc-500">Come nei tool di email marketing: scrivi nel testo <code className="rounded bg-zinc-100 px-1">{'{{nome_variabile}}'}</code> oppure usa il campo qui sotto (va inserita dove si trova il cursore).</p>
              <div className="flex gap-2">
                <input className="input" placeholder="es. cliente_codice_fiscale" value={newVar} onChange={(e) => setNewVar(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && insertVar(newVar)} />
                <button className="btn-secondary" onClick={() => insertVar(newVar)}>Inserisci</button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {Object.keys(AUTO_FIELDS).map((k) => <button key={k} className="rounded bg-zinc-100 px-2 py-0.5 text-xs hover:bg-zinc-200" onClick={() => insertVar(k)} title={AUTO_FIELDS[k]}>{k}</button>)}
              </div>
            </div>
          )}
          <div className="card max-h-[70vh] overflow-y-auto p-4">
            <h2 className="font-semibold">Campi ({synced.length})</h2>
            <p className="mb-3 text-xs text-zinc-500">Per ogni variabile scegli chi la compila: l’azienda nella scheda d’ordine o il cliente dopo lo sblocco OTP.</p>
            {groups.map(([label, list]) => !!list.length && (
              <div key={label} className="mb-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</h3>
                <div className="space-y-2">
                  {list.map((f) => <FieldConfig key={f.key} field={f} checkboxes={synced.filter((x) => x.type === 'checkbox' && x.key !== f.key)} onChange={(p) => update(f.key, p)} readOnly={readOnly} />)}
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

function FieldConfig({ field: f, checkboxes, onChange, readOnly }: { field: FieldDef; checkboxes: FieldDef[]; onChange: (p: Partial<FieldDef>) => void; readOnly: boolean }) {
  return (
    <details className="rounded-lg ring-1 ring-zinc-200">
      <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm">
        <span className="min-w-0">
          <span className="block truncate font-medium">{f.label}</span>
          <span className="block truncate font-mono text-[11px] text-zinc-500">{`{{${f.key}}}`} · {FIELD_TYPES[f.type]}{f.required ? ' · obbligatorio' : ''}</span>
        </span>
        <span className="text-zinc-400">▾</span>
      </summary>
      <fieldset disabled={readOnly} className="space-y-2 border-t border-zinc-100 p-3">
        <div>
          <label className="label text-xs">Etichetta / testo mostrato</label>
          <textarea className="input text-xs" rows={f.type === 'checkbox' ? 3 : 1} value={f.label} onChange={(e) => onChange({ label: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label text-xs">Tipo</label>
            <select className="input text-xs" value={f.type} onChange={(e) => onChange({ type: e.target.value as FieldDef['type'] })}>
              {Object.entries(FIELD_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs">Compilato da</label>
            <select className="input text-xs" value={f.filledBy} onChange={(e) => onChange({ filledBy: e.target.value as FieldDef['filledBy'] })}>
              {Object.entries(FILLED_BY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
        {(f.type === 'choice' || f.type === 'select') && (
          <div>
            <label className="label text-xs">Opzioni (una per riga)</label>
            <textarea className="input text-xs" rows={3} value={(f.options ?? []).join('\n')} onChange={(e) => onChange({ options: e.target.value.split('\n') })} />
          </div>
        )}
        <div>
          <label className="label text-xs">Aiuto (facoltativo)</label>
          <input className="input text-xs" value={f.help ?? ''} onChange={(e) => onChange({ help: e.target.value })} />
        </div>
        {f.type !== 'checkbox' && f.type !== 'signature' && f.filledBy === 'cliente' && !!checkboxes.length && (
          <div>
            <label className="label text-xs">Si compila solo se è spuntata…</label>
            <select className="input text-xs" value={f.dependsOn ?? ''} onChange={(e) => onChange({ dependsOn: e.target.value || undefined })}>
              <option value="">— sempre —</option>
              {checkboxes.map((c) => <option key={c.key} value={c.key}>{c.shortLabel ?? c.key}</option>)}
            </select>
            <p className="mt-1 text-[11px] text-zinc-500">Es. la modalità della testimonianza, scelta solo se il cliente autorizza le testimonianze. Diventa obbligatoria quando la casella è spuntata.</p>
          </div>
        )}
        <div>
          <label className="label text-xs">Etichetta breve per i riepiloghi (facoltativa)</label>
          <input className="input text-xs" value={f.shortLabel ?? ''} onChange={(e) => onChange({ shortLabel: e.target.value || undefined })} />
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={f.required} onChange={(e) => onChange({ required: e.target.checked })} className="accent-[rgb(var(--brand))]" /> Obbligatorio
        </label>
      </fieldset>
    </details>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const b = (label: string, active: boolean, fn: () => void, title?: string) => (
    <button key={label} type="button" title={title ?? label} onMouseDown={(e) => { e.preventDefault(); fn(); }} className={`min-w-8 rounded px-2 py-1 text-sm ${active ? 'bg-brand-soft text-brand' : 'hover:bg-zinc-100'}`}>{label}</button>
  );
  const ch = () => editor.chain().focus();
  return (
    <div className="flex flex-wrap items-center gap-0.5">
      {b('B', editor.isActive('bold'), () => ch().toggleBold().run(), 'Grassetto')}
      {b('I', editor.isActive('italic'), () => ch().toggleItalic().run(), 'Corsivo')}
      {b('U', editor.isActive('underline'), () => ch().toggleUnderline().run(), 'Sottolineato')}
      <span className="mx-1 h-5 w-px bg-zinc-200" />
      {b('H1', editor.isActive('heading', { level: 1 }), () => ch().toggleHeading({ level: 1 }).run())}
      {b('H2', editor.isActive('heading', { level: 2 }), () => ch().toggleHeading({ level: 2 }).run())}
      {b('H3', editor.isActive('heading', { level: 3 }), () => ch().toggleHeading({ level: 3 }).run())}
      {b('¶', editor.isActive('paragraph'), () => ch().setParagraph().run(), 'Paragrafo')}
      <span className="mx-1 h-5 w-px bg-zinc-200" />
      {b('• Elenco', editor.isActive('bulletList'), () => ch().toggleBulletList().run())}
      {b('1. Elenco', editor.isActive('orderedList'), () => ch().toggleOrderedList().run())}
      {b('⇤', editor.isActive({ textAlign: 'left' }), () => ch().setTextAlign('left').run(), 'Allinea a sinistra')}
      {b('≡', editor.isActive({ textAlign: 'justify' }), () => ch().setTextAlign('justify').run(), 'Giustifica')}
      {b('↔', editor.isActive({ textAlign: 'center' }), () => ch().setTextAlign('center').run(), 'Centra')}
      <span className="mx-1 h-5 w-px bg-zinc-200" />
      {b('+ Tabella', false, () => ch().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}
      {editor.isActive('table') && (
        <>
          {b('+ Riga', false, () => ch().addRowAfter().run())}
          {b('− Riga', false, () => ch().deleteRow().run())}
          {b('+ Col', false, () => ch().addColumnAfter().run())}
          {b('− Col', false, () => ch().deleteColumn().run())}
          {b('✕ Tabella', false, () => ch().deleteTable().run())}
        </>
      )}
      {b('↶', false, () => ch().undo().run(), 'Annulla')}
      {b('↷', false, () => ch().redo().run(), 'Ripeti')}
    </div>
  );
}
