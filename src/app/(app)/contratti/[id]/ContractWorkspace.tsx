'use client';
import { useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import type { ContractStatus } from '@prisma/client';
import { formatDateTime, type FieldDef, type Values } from '@/lib/fields';
import { renderContract } from '@/lib/render';
import { DocPreview, focusKey } from '@/components/DocPreview';
import { FieldInput } from '@/components/FieldInput';
import { STATUS_LABEL, STATUS_STYLE } from '@/lib/status';
import { cancelAction, deleteDraftAction, duplicateContract, regeneratePdfAction, retractAction, saveContract, sendContractAction } from '../actions';

type C = {
  id: string; code: string; title: string; status: ContractStatus; html: string; fields: FieldDef[]; values: Values; ownerName: string;
  recipientName: string; recipientEmail: string; emailSubject: string; emailBody: string;
  sentAt: string | null; openedAt: string | null; otpVerifiedAt: string | null; signedAt: string | null; withdrawnAt: string | null;
  tokenExpiresAt: string | null; withdrawalDeadline: string | null; link: string | null; signedHtml: string | null;
  documentHash: string | null; pdfHash: string | null; hasPdf: boolean; anonymized: boolean;
};
type Ev = { id: string; label: string; type: string; at: string; actor: string; ip: string | null; userAgent: string | null; data: Record<string, unknown>; hash: string };
type Em = { id: string; kind: string; to: string; subject: string; body: string; status: string; error: string | null; at: string };
type S = { companySignature: string | null; companySignerName: string; linkExpiryDays: number; emailConfigured: boolean };

export function ContractWorkspace({ contract: c, events, emails, settings, chainOk }: { contract: C; events: Ev[]; emails: Em[]; settings: S; chainOk: boolean }) {
  const [values, setValues] = useState<Values>(c.values);
  const [title, setTitle] = useState(c.title);
  const [tab, setTab] = useState<'scheda' | 'cronologia' | 'email'>('scheda');
  const [sendOpen, setSendOpen] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();
  const previewRef = useRef<HTMLDivElement>(null);
  const editable = c.status === 'BOZZA';

  const companyFields = c.fields.filter((f) => f.filledBy === 'azienda');
  const prefillable = c.fields.filter((f) => f.filledBy === 'cliente' && !['signature', 'checkbox'].includes(f.type));
  const html = useMemo(
    () => c.signedHtml ?? renderContract(c.html, c.fields, values, 'preview', { companySignature: settings.companySignature, companySignerName: settings.companySignerName, code: c.code, sentAt: c.sentAt }),
    [c, values, settings],
  );
  const missing = companyFields.filter((f) => f.required && (values[f.key] === undefined || values[f.key] === '')).length;

  const set = (k: string, v: unknown) => {
    setValues((p) => ({ ...p, [k]: v }));
    setDirty(true);
    setFieldErrors((e) => ({ ...e, [k]: '' }));
  };
  const save = () =>
    start(async () => {
      const r = await saveContract(c.id, title, values);
      setMsg(r.error ? { type: 'err', text: r.error } : { type: 'ok', text: 'Scheda d’ordine salvata' });
      if (!r.error) setDirty(false);
    });
  const run = (fn: () => Promise<{ error?: string; ok?: boolean } | undefined | void>, okText: string) =>
    start(async () => {
      const r = await fn();
      if (r && 'error' in r && r.error) setMsg({ type: 'err', text: r.error });
      else setMsg({ type: 'ok', text: okText });
    });

  return (
    <div>
      {/* Intestazione */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Link href="/contratti" className="hover:underline">Contratti</Link> / <span>{c.code}</span>
            <span className={`badge ${STATUS_STYLE[c.status]}`}>{STATUS_LABEL[c.status]}</span>
          </div>
          {editable ? (
            <input className="mt-1 w-full max-w-xl border-0 bg-transparent p-0 text-2xl font-semibold outline-none focus:ring-0" value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} aria-label="Titolo del contratto" />
          ) : (
            <h1 className="mt-1 text-2xl font-semibold">{c.title}</h1>
          )}
          <p className="text-xs text-zinc-500">Venditore: {c.ownerName}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {editable && <button className="btn-secondary" onClick={save} disabled={pending || !dirty}>{dirty ? 'Salva' : 'Salvato'}</button>}
          {['BOZZA', 'INVIATO', 'APERTO', 'SCADUTO'].includes(c.status) && (
            <button className="btn-primary" onClick={() => (dirty ? setMsg({ type: 'err', text: 'Salva prima le modifiche.' }) : setSendOpen(true))}>
              {c.status === 'BOZZA' ? 'Invia al cliente →' : 'Reinvia'}
            </button>
          )}
          {c.hasPdf && <a className="btn-primary" href={`/contratti/${c.id}/pdf`}>Scarica PDF firmato</a>}
          <details className="relative">
            <summary className="btn-secondary list-none">Altro ▾</summary>
            <div className="absolute right-0 z-20 mt-1 w-60 rounded-lg bg-white p-1 text-sm shadow-lg ring-1 ring-zinc-200">
              <button className="w-full rounded px-3 py-2 text-left hover:bg-zinc-100" onClick={() => start(() => duplicateContract(c.id))}>Duplica per un altro cliente</button>
              {c.link && <button className="w-full rounded px-3 py-2 text-left hover:bg-zinc-100" onClick={() => { navigator.clipboard.writeText(c.link!); setMsg({ type: 'ok', text: 'Link copiato' }); }}>Copia link del cliente</button>}
              {['INVIATO', 'APERTO', 'SCADUTO'].includes(c.status) && (
                <button className="w-full rounded px-3 py-2 text-left hover:bg-zinc-100" onClick={() => confirm('Il link attuale smetterà di funzionare e potrai modificare la scheda d’ordine. Continuare?') && run(() => retractAction(c.id), 'Invio ritirato: contratto in bozza')}>Ritira invio e modifica</button>
              )}
              {c.status === 'FIRMATO' && <button className="w-full rounded px-3 py-2 text-left hover:bg-zinc-100" onClick={() => run(() => regeneratePdfAction(c.id), 'PDF rigenerato')}>Rigenera PDF</button>}
              {!['FIRMATO', 'RECEDUTO', 'ANNULLATO'].includes(c.status) && (
                <button className="w-full rounded px-3 py-2 text-left text-rose-700 hover:bg-rose-50" onClick={() => { const r = prompt('Motivo dell’annullamento?'); if (r !== null) run(() => cancelAction(c.id, r), 'Contratto annullato'); }}>Annulla contratto</button>
              )}
              {c.status === 'BOZZA' && !c.sentAt && (
                <button className="w-full rounded px-3 py-2 text-left text-rose-700 hover:bg-rose-50" onClick={() => confirm('Eliminare definitivamente questa bozza?') && run(() => deleteDraftAction(c.id), 'Eliminata')}>Elimina bozza</button>
              )}
            </div>
          </details>
        </div>
      </div>

      {msg && (
        <div className={`mb-4 flex items-center justify-between rounded-lg px-4 py-2 text-sm ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
          {msg.text}
          <button onClick={() => setMsg(null)} aria-label="Chiudi">×</button>
        </div>
      )}

      <Progress c={c} />

      <div className="mb-4 flex gap-1 border-b border-zinc-200">
        {([['scheda', editable ? 'Scheda d’ordine e anteprima' : 'Documento'], ['cronologia', `Cronologia (${events.length})`], ['email', `Email (${emails.length})`]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === k ? 'border-brand font-medium text-brand' : 'border-transparent text-zinc-600 hover:text-zinc-900'}`}>{l}</button>
        ))}
      </div>

      {tab === 'scheda' && (
        <div className={editable ? 'grid gap-6 lg:grid-cols-[minmax(320px,420px)_1fr]' : ''}>
          {editable && (
            <div className="space-y-5 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pr-2">
              <section className="card space-y-4 p-4">
                <div>
                  <h2 className="font-semibold">Scheda d’ordine</h2>
                  <p className="text-xs text-zinc-500">{missing ? `${missing} campi obbligatori da compilare` : 'Tutti i campi obbligatori sono compilati ✓'}</p>
                </div>
                {companyFields.map((f) => (
                  <FieldInput key={f.key} field={f} value={values[f.key]} onChange={(v) => set(f.key, v)} onFocus={() => focusKey(previewRef.current, f.key)} error={fieldErrors[f.key]} />
                ))}
                {!companyFields.length && <p className="text-sm text-zinc-500">Questo template non ha campi per l’azienda.</p>}
              </section>
              {!!prefillable.length && (
                <details className="card p-4">
                  <summary className="cursor-pointer font-semibold">Precompila dati cliente <span className="text-xs font-normal text-zinc-500">(facoltativo)</span></summary>
                  <p className="mb-3 mt-1 text-xs text-zinc-500">Il cliente vedrà questi dati già inseriti e potrà correggerli prima di firmare.</p>
                  <div className="space-y-4">
                    {prefillable.map((f) => (
                      <FieldInput key={f.key} field={{ ...f, required: false }} value={values[f.key]} onChange={(v) => set(f.key, v)} onFocus={() => focusKey(previewRef.current, f.key)} />
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
          <div className={`card min-w-0 p-5 sm:p-8 ${editable ? 'lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto' : ''}`}>
            {editable && (
              <div className="mb-4 flex flex-wrap gap-3 text-xs">
                <span className="ph-legend bg-[#fff7e0] ring-[#e0b84a]">Da compilare dall’azienda</span>
                <span className="ph-legend bg-[#e9f2ff] ring-[#6d9be0]">Compilato dal cliente</span>
                <span className="ph-legend bg-[#eef0f2] ring-[#a5adb6]">Automatico</span>
              </div>
            )}
            {c.anonymized ? <p className="text-sm text-zinc-500">Contenuto anonimizzato al termine del periodo di conservazione.</p> : <DocPreview ref={previewRef} html={html} />}
            {c.documentHash && (
              <div className="mt-6 space-y-1 border-t border-zinc-200 pt-4 font-mono text-[11px] text-zinc-500">
                <div>SHA-256 contenuto firmato: {c.documentHash}</div>
                {c.pdfHash && <div>SHA-256 PDF: {c.pdfHash}</div>}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'cronologia' && (
        <div className="card p-4">
          <p className={`mb-4 rounded-lg px-3 py-2 text-xs ${chainOk ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
            {chainOk ? 'Registro integro: la catena di hash degli eventi è verificata.' : 'Attenzione: la catena di hash del registro non è verificabile (registro alterato o anonimizzato).'}
          </p>
          <ol className="relative space-y-4 border-l border-zinc-200 pl-5">
            {events.map((e) => (
              <li key={e.id}>
                <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-brand" />
                <div className="text-sm font-medium">{e.label}</div>
                <div className="text-xs text-zinc-500">
                  {formatDateTime(e.at)} · {e.actor}
                  {e.ip && ` · IP ${e.ip}`}
                  {typeof e.data?.to === 'string' && ` · a ${e.data.to}`}
                  {typeof e.data?.motivo === 'string' && e.data.motivo && ` · motivo: ${e.data.motivo}`}
                </div>
                {e.userAgent && <div className="truncate text-[11px] text-zinc-400" title={e.userAgent}>{e.userAgent}</div>}
              </li>
            ))}
          </ol>
        </div>
      )}

      {tab === 'email' && (
        <div className="space-y-3">
          {!settings.emailConfigured && <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-900">Modalità test: l’invio email non è configurato, i messaggi sono solo registrati qui. Configura l’SMTP in Impostazioni.</p>}
          {emails.map((m) => (
            <details key={m.id} className="card p-4">
              <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm">
                <span className={`badge ${m.status === 'inviata' ? 'bg-emerald-50 text-emerald-800 ring-emerald-300' : m.status === 'simulata' ? 'bg-amber-50 text-amber-800 ring-amber-300' : 'bg-rose-50 text-rose-800 ring-rose-300'}`}>{m.status}</span>
                <span className="font-medium">{m.subject}</span>
                <span className="text-xs text-zinc-500">a {m.to} · {formatDateTime(m.at)}</span>
              </summary>
              {m.error && <p className="mt-2 text-xs text-rose-700">{m.error}</p>}
              <pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-zinc-700">{m.body}</pre>
            </details>
          ))}
          {!emails.length && <p className="text-sm text-zinc-500">Nessuna email inviata.</p>}
        </div>
      )}

      {sendOpen && <SendPanel c={c} settings={settings} onClose={() => setSendOpen(false)} onResult={(text, type, errs) => { setMsg({ type, text }); if (errs) { setFieldErrors(errs); setTab('scheda'); } }} />}
    </div>
  );
}

function Progress({ c }: { c: C }) {
  const steps = [
    { label: 'Inviato', at: c.sentAt },
    { label: 'Aperto', at: c.openedAt },
    { label: 'OTP sbloccato', at: c.otpVerifiedAt },
    { label: 'Firmato', at: c.signedAt },
  ];
  return (
    <div className="mb-5">
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.label} className={`rounded-lg px-3 py-2 ring-1 ${s.at ? 'bg-emerald-50 ring-emerald-200' : 'bg-white ring-zinc-200'}`}>
            <div className="flex items-center gap-2 text-sm font-medium">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${s.at ? 'bg-emerald-600 text-white' : 'bg-zinc-200 text-zinc-600'}`}>{s.at ? '✓' : i + 1}</span>
              {s.label}
            </div>
            <div className="mt-0.5 text-xs text-zinc-500">{s.at ? formatDateTime(s.at) : '—'}</div>
          </li>
        ))}
      </ol>
      <div className="mt-2 flex flex-wrap gap-x-4 text-xs text-zinc-500">
        {c.tokenExpiresAt && ['INVIATO', 'APERTO', 'SBLOCCATO'].includes(c.status) && <span>Link valido fino al {formatDateTime(c.tokenExpiresAt)}</span>}
        {c.withdrawalDeadline && c.status === 'FIRMATO' && <span>Termine di recesso: {formatDateTime(c.withdrawalDeadline)}</span>}
        {c.withdrawnAt && <span className="text-rose-700">Recesso esercitato il {formatDateTime(c.withdrawnAt)}</span>}
      </div>
    </div>
  );
}

function SendPanel({ c, settings, onClose, onResult }: { c: C; settings: S; onClose: () => void; onResult: (text: string, type: 'ok' | 'err', errs?: Record<string, string>) => void }) {
  const [to, setTo] = useState(c.recipientEmail);
  const [name, setName] = useState(c.recipientName);
  const [subject, setSubject] = useState(c.emailSubject);
  const [body, setBody] = useState(c.emailBody);
  const [days, setDays] = useState(settings.linkExpiryDays);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<{ link: string; simulated: boolean } | null>(null);
  const [pending, start] = useTransition();

  const send = () =>
    start(async () => {
      setErr('');
      const r = await sendContractAction(c.id, { to, name, subject, body, expiryDays: days });
      if ('fieldErrors' in r && r.fieldErrors) {
        onResult(r.error!, 'err', r.fieldErrors);
        onClose();
        return;
      }
      if (r.error) {
        setErr(r.error);
        if ('link' in r && r.link) setDone({ link: r.link, simulated: false });
        return;
      }
      setDone({ link: r.link!, simulated: !!r.simulated });
      onResult(r.simulated ? 'Contratto inviato (modalità test: email registrata ma non spedita)' : `Contratto inviato a ${to}`, 'ok');
    });

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
      <aside className="flex h-full w-full max-w-md flex-col bg-white shadow-xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Invia al cliente">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <div>
            <h2 className="font-semibold">Invia al cliente</h2>
            <p className="text-xs text-zinc-500">{c.code} · {c.title}</p>
          </div>
          <button className="btn-ghost" onClick={onClose} aria-label="Chiudi">✕</button>
        </div>
        {done ? (
          <div className="space-y-4 p-5 text-sm">
            <div className="rounded-lg bg-emerald-50 p-4 text-emerald-900">
              <div className="font-semibold">Contratto inviato ✓</div>
              <p className="mt-1">Il cliente riceverà l’email con il link. Per aprirlo dovrà confermare con il codice OTP inviato a <b>{to}</b>.</p>
            </div>
            {done.simulated && <p className="rounded-lg bg-amber-50 p-3 text-amber-900">Modalità test: l’email non è stata spedita. Configura l’SMTP in Impostazioni.</p>}
            {err && <p className="rounded-lg bg-rose-50 p-3 text-rose-800">{err}</p>}
            <div>
              <div className="label">Link del cliente (per inviarlo anche su WhatsApp)</div>
              <div className="flex gap-2">
                <input className="input font-mono text-xs" readOnly value={done.link} />
                <button className="btn-secondary" onClick={() => navigator.clipboard.writeText(done.link)}>Copia</button>
              </div>
              <p className="mt-1 text-xs text-zinc-500">Il codice OTP arriva comunque solo all’email del cliente.</p>
            </div>
            <button className="btn-primary w-full" onClick={() => location.reload()}>Chiudi</button>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {!settings.emailConfigured && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Modalità test: l’SMTP non è configurato, l’email verrà solo registrata (la trovi nella scheda “Email”).</p>}
              <div>
                <label className="label" htmlFor="s-name">Nome del destinatario</label>
                <input id="s-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="s-to">Email del destinatario</label>
                <input id="s-to" type="email" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
                <p className="mt-1 text-xs text-zinc-500">Riceverà il link e il codice OTP per sbloccare la compilazione e la firma.</p>
              </div>
              <div>
                <label className="label" htmlFor="s-sub">Oggetto</label>
                <input id="s-sub" className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="s-body">Testo dell’email</label>
                <textarea id="s-body" className="input font-sans" rows={11} value={body} onChange={(e) => setBody(e.target.value)} />
                <p className="mt-1 text-xs text-zinc-500">Variabili: {'{{nome}} {{link}} {{scadenza}} {{titolo}} {{azienda}} {{codice}}'}</p>
              </div>
              <div>
                <label className="label" htmlFor="s-days">Validità del link (giorni)</label>
                <input id="s-days" type="number" min={1} max={60} className="input w-28" value={days} onChange={(e) => setDays(Number(e.target.value))} />
              </div>
              <div className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600 ring-1 ring-zinc-200">
                <div className="mb-1 font-semibold text-zinc-800">Cosa succede</div>
                <ol className="list-decimal space-y-0.5 pl-4">
                  <li>Il cliente riceve l’email con il link personale.</li>
                  <li>Aprendo il link richiede un codice OTP via email e lo conferma.</li>
                  <li>Compila i suoi dati, spunta le dichiarazioni e firma.</li>
                  <li>Riceve il PDF firmato; tu ricevi l’avviso e lo stato passa a “Firmato”.</li>
                </ol>
              </div>
              {err && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{err}</p>}
            </div>
            <div className="border-t border-zinc-200 p-4">
              <button className="btn-primary w-full py-2.5" onClick={send} disabled={pending}>{pending ? 'Invio in corso…' : '🔒 Invia con richiesta OTP per lo sblocco'}</button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
