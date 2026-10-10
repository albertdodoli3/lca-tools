'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ContractStatus } from '@prisma/client';
import { formatDateTime, validateField, type FieldDef, type SignatureValue, type Values } from '@/lib/fields';
import { renderContract } from '@/lib/render';
import { DocPreview, focusKey } from '@/components/DocPreview';
import { FieldInput } from '@/components/FieldInput';
import { SignaturePad } from '@/components/SignaturePad';

type C = {
  code: string; title: string; status: ContractStatus; recipientName: string; maskedEmail: string; html: string; fields: FieldDef[]; values: Values;
  sentAt: string | null; signedAt: string | null; withdrawnAt: string | null; withdrawalDeadline: string | null; canWithdraw: boolean; hasPdf: boolean;
  companySignature: string | null; companySignerName: string;
};

async function api(token: string, path: string, body?: unknown) {
  const res = await fetch(`/api/firma/${token}/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, ...data } as { ok: boolean; error?: string; errors?: Record<string, string>; relogin?: boolean };
}

export function SignerApp({ token, authed, contract: c, companyName, contact }: { token: string; authed: boolean; contract: C; companyName: string; contact: string }) {
  if (!authed) return <OtpGate token={token} c={c} companyName={companyName} />;
  if (c.status === 'SBLOCCATO') return <Wizard token={token} c={c} companyName={companyName} />;
  return <SignedView token={token} c={c} contact={contact} />;
}

// ------------------------------------------------------------------ 1. OTP

function OtpGate({ token, c, companyName }: { token: string; c: C; companyName: string }) {
  const router = useRouter();
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const signed = c.status === 'FIRMATO' || c.status === 'RECEDUTO';

  useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = async () => {
    setBusy(true);
    setErr('');
    const r = await api(token, 'otp');
    setBusy(false);
    if (!r.ok) return setErr(r.error ?? 'Errore');
    setSent(true);
    setCooldown(45);
  };
  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const r = await api(token, 'verify', { code });
    if (!r.ok) {
      setBusy(false);
      return setErr(r.error ?? 'Errore');
    }
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-6 sm:p-8">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-2xl">🔐</div>
        <h1 className="text-xl font-semibold">{c.recipientName ? `Ciao ${c.recipientName.split(' ')[0]},` : 'Benvenuto,'}</h1>
        <p className="mt-2 text-sm text-zinc-600">
          {signed ? (
            <>per consultare il contratto <b>{c.title}</b> che hai firmato, conferma la tua identità.</>
          ) : (
            <><b>{companyName}</b> ti ha inviato il contratto <b>{c.title}</b> ({c.code}) da completare e firmare.</>
          )}
        </p>
        <p className="mt-3 text-sm text-zinc-600">Per proteggere i tuoi dati, prima di iniziare ti inviamo un <b>codice di verifica</b> all’indirizzo <b>{c.maskedEmail}</b>.</p>

        {!sent ? (
          <button className="btn-primary mt-6 w-full py-2.5" onClick={send} disabled={busy}>{busy ? 'Invio…' : 'Inviami il codice'}</button>
        ) : (
          <form onSubmit={verify} className="mt-6 space-y-3">
            <label className="label" htmlFor="otp">Codice ricevuto via email</label>
            <input id="otp" className="input text-center font-mono text-2xl tracking-[0.5em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
            <button className="btn-primary w-full py-2.5" disabled={busy || code.length !== 6}>{busy ? 'Verifica…' : signed ? 'Verifica' : 'Verifica e inizia la compilazione'}</button>
            <button type="button" className="w-full text-center text-xs text-zinc-500 underline disabled:no-underline" onClick={send} disabled={busy || cooldown > 0}>
              {cooldown > 0 ? `Puoi richiedere un nuovo codice tra ${cooldown}s` : 'Non hai ricevuto il codice? Invialo di nuovo'}
            </button>
            <p className="text-xs text-zinc-500">Controlla anche nella cartella spam. Il codice scade dopo pochi minuti.</p>
          </form>
        )}
        {err && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">{err}</p>}
      </div>
      <p className="mt-4 px-2 text-center text-xs text-zinc-500">
        L’accesso, la verifica del codice e la firma vengono registrati con data, ora, indirizzo IP e dispositivo, a tutela di entrambe le parti. I dati sono trattati da {companyName} come descritto nell’informativa privacy allegata al contratto.
      </p>
    </div>
  );
}

// ------------------------------------------------------------------ 2. Compilazione e firma

const STEPS = ['I tuoi dati', 'Dichiarazioni', 'Rileggi', 'Firma'] as const;

function Wizard({ token, c, companyName }: { token: string; c: C; companyName: string }) {
  const router = useRouter();
  const clientFields = c.fields.filter((f) => f.filledBy === 'cliente');
  const dataFields = clientFields.filter((f) => !['checkbox', 'signature'].includes(f.type));
  const declFields = clientFields.filter((f) => f.type === 'checkbox');
  const sigFields = clientFields.filter((f) => f.type === 'signature');
  const steps = STEPS.filter((s) => (s === 'Dichiarazioni' ? declFields.length > 0 : s === 'I tuoi dati' ? dataFields.length > 0 : true));

  const [values, setValues] = useState<Values>(c.values);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [readConfirmed, setReadConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle');
  const previewRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const current = steps[step];

  const html = useMemo(() => renderContract(c.html, c.fields, values, 'preview', { companySignature: c.companySignature, companySignerName: c.companySignerName, code: c.code, sentAt: c.sentAt }), [c, values]);

  // Salvataggio automatico dei dati (non delle firme)
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setSaved('saving');
    const t = setTimeout(async () => {
      const toSave = Object.fromEntries(Object.entries(values).filter(([k]) => !sigFields.find((f) => f.key === k)));
      const r = await api(token, 'save', { values: toSave });
      if (r.relogin) return router.refresh();
      setSaved('saved');
    }, 1200);
    return () => clearTimeout(t);
  }, [values]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: string, v: unknown) => {
    setValues((p) => ({ ...p, [k]: v }));
    setErrors((e) => ({ ...e, [k]: '' }));
  };

  const check = (list: FieldDef[]) => {
    const e: Record<string, string> = {};
    for (const f of list) {
      const m = validateField(f, values[f.key]);
      if (m) e[f.key] = m;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const go = (to: number) => {
    setStep(to);
    setErr('');
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const next = () => {
    if (current === 'I tuoi dati' && !check(dataFields)) return setErr('Controlla i campi evidenziati.');
    if (current === 'Dichiarazioni' && !check(declFields)) return setErr('Alcune dichiarazioni sono obbligatorie.');
    if (current === 'Rileggi' && !readConfirmed) return setErr('Conferma di aver letto il contratto per proseguire.');
    go(step + 1);
  };

  const sign = async () => {
    if (!check(clientFields)) return setErr('Mancano dati o firme: controlla i passaggi precedenti.');
    setBusy(true);
    setErr('');
    const r = await api(token, 'sign', { values, readConfirmed });
    if (!r.ok) {
      setBusy(false);
      if (r.relogin) return router.refresh();
      if (r.errors) setErrors(r.errors);
      return setErr(r.error ?? 'Errore durante la firma');
    }
    router.refresh();
  };

  const showDocAside = current !== 'Rileggi';

  return (
    <div ref={topRef}>
      <div className="mb-5">
        <h1 className="text-xl font-semibold">{c.title}</h1>
        <p className="text-sm text-zinc-500">{c.code} · proposto da {companyName}</p>
      </div>
      <ol className="mb-6 flex gap-2 overflow-x-auto text-sm">
        {steps.map((s, i) => (
          <li key={s} className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 ring-1 ${i === step ? 'bg-brand text-white ring-brand' : i < step ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-white text-zinc-500 ring-zinc-200'}`}>
            <span className="text-xs">{i < step ? '✓' : i + 1}</span> {s}
          </li>
        ))}
        <li className="ml-auto self-center text-xs text-zinc-400">{saved === 'saving' ? 'Salvataggio…' : saved === 'saved' ? 'Salvato ✓' : ''}</li>
      </ol>

      <div className={showDocAside ? 'grid gap-6 lg:grid-cols-[minmax(320px,440px)_1fr]' : ''}>
        <div className="space-y-4">
          {current === 'I tuoi dati' && (
            <section className="card space-y-4 p-5">
              <div>
                <h2 className="font-semibold">I tuoi dati</h2>
                <p className="text-xs text-zinc-500">Inseriscili come risultano dal documento d’identità.</p>
              </div>
              {dataFields.map((f) => <FieldInput key={f.key} field={f} value={values[f.key]} onChange={(v) => set(f.key, v)} onFocus={() => focusKey(previewRef.current, f.key)} error={errors[f.key]} />)}
            </section>
          )}

          {current === 'Dichiarazioni' && (
            <section className="card space-y-3 p-5">
              <div>
                <h2 className="font-semibold">Dichiarazioni e consensi</h2>
                <p className="text-xs text-zinc-500">Le caselle sono presentate non selezionate: spunta solo quelle che intendi confermare. Quelle con * sono necessarie.</p>
              </div>
              {declFields.map((f) => <FieldInput key={f.key} field={f} value={values[f.key]} onChange={(v) => set(f.key, v)} onFocus={() => focusKey(previewRef.current, f.key)} error={errors[f.key]} />)}
            </section>
          )}

          {current === 'Rileggi' && (
            <section className="card p-5 sm:p-8">
              <h2 className="mb-1 font-semibold">Rileggi il contratto completo</h2>
              <p className="mb-5 text-sm text-zinc-500">Controlla i tuoi dati, la Scheda d’ordine e gli allegati prima di firmare.</p>
              <div className="max-h-[65vh] overflow-y-auto rounded-lg p-4 ring-1 ring-zinc-200 sm:p-6">
                <DocPreview html={html} />
              </div>
              <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-lg bg-zinc-50 p-3 text-sm ring-1 ring-zinc-200">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[rgb(var(--brand))]" checked={readConfirmed} onChange={(e) => setReadConfirmed(e.target.checked)} />
                <span>Dichiaro di aver ricevuto, letto e compreso il contratto, la Scheda d’ordine, le informazioni sul diritto di recesso con il relativo modulo e l’informativa sul trattamento dei dati personali.</span>
              </label>
            </section>
          )}

          {current === 'Firma' && (
            <section className="card space-y-6 p-5">
              <div>
                <h2 className="font-semibold">Firma</h2>
                <p className="text-xs text-zinc-500">Ogni firma è un atto separato: firma in ciascun riquadro.</p>
              </div>
              {sigFields.map((f) => (
                <div key={f.key} onFocus={() => focusKey(previewRef.current, f.key)}>
                  <div className="mb-2 text-sm font-medium">{f.label}{f.required && <span className="text-rose-600"> *</span>}</div>
                  {f.help && <p className="mb-2 rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">{f.help}</p>}
                  <SignaturePad value={values[f.key] as SignatureValue | undefined} onChange={(v) => set(f.key, v)} defaultName={String(values.cliente_nome_cognome ?? c.recipientName ?? '')} />
                  {errors[f.key] && <p className="err">{errors[f.key]}</p>}
                </div>
              ))}
              <p className="text-xs text-zinc-500">Cliccando su “Firma il contratto” apponi la tua firma elettronica. Data, ora, indirizzo IP e dispositivo verranno registrati e riportati nel certificato allegato al PDF.</p>
            </section>
          )}

          {err && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">{err}</p>}
          <div className="flex gap-2">
            {step > 0 && <button className="btn-secondary" onClick={() => go(step - 1)} disabled={busy}>← Indietro</button>}
            {current !== 'Firma' ? (
              <button className="btn-primary flex-1 py-2.5" onClick={next}>Continua →</button>
            ) : (
              <button className="btn-primary flex-1 py-2.5" onClick={sign} disabled={busy}>{busy ? 'Firma in corso…' : '✍️ Firma il contratto'}</button>
            )}
          </div>
        </div>

        {showDocAside && (
          <div className="card hidden min-w-0 p-6 lg:block">
            <div className="mb-3 text-xs text-zinc-500">Anteprima del contratto · i campi in blu sono quelli che compili tu</div>
            <div className="max-h-[75vh] overflow-y-auto pr-2">
              <DocPreview ref={previewRef} html={html} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ 3. Firmato / recesso

function SignedView({ token, c, contact }: { token: string; c: C; contact: string }) {
  const router = useRouter();
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const confirmWithdraw = async () => {
    setBusy(true);
    const r = await api(token, 'withdraw', { note });
    setBusy(false);
    if (!r.ok) return setErr(r.error ?? 'Errore');
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {c.status === 'RECEDUTO' ? (
        <div className="card p-6">
          <h1 className="text-xl font-semibold">Recesso registrato</h1>
          <p className="mt-2 text-sm text-zinc-600">Hai esercitato il diritto di recesso il {formatDateTime(c.withdrawnAt)}. Ti abbiamo inviato la conferma di ricevimento via email.</p>
        </div>
      ) : (
        <div className="card p-6">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl">✓</div>
          <h1 className="text-xl font-semibold">Contratto firmato</h1>
          <p className="mt-2 text-sm text-zinc-600">Hai firmato il contratto <b>{c.title}</b> il {formatDateTime(c.signedAt)}. Ti abbiamo inviato una copia completa in PDF via email.</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {c.hasPdf && <a className="btn-primary" href={`/api/firma/${token}/pdf`}>Scarica il PDF firmato</a>}
      </div>
      {c.status === 'FIRMATO' && (
        <div className="card p-6">
          <h2 className="font-semibold">Diritto di recesso</h2>
          {c.canWithdraw ? (
            <>
              <p className="mt-1 text-sm text-zinc-600">Puoi recedere senza indicarne le ragioni entro il <b>{c.withdrawalDeadline}</b>, anche scrivendo a {contact || 'info@conquistalei.com'}.</p>
              {!withdrawOpen ? (
                <button className="btn-danger mt-4" onClick={() => setWithdrawOpen(true)}>Recedi dal contratto qui</button>
              ) : (
                <div className="mt-4 space-y-3 rounded-lg bg-rose-50/50 p-4 ring-1 ring-rose-200">
                  <p className="text-sm">Stai per recedere dal contratto <b>{c.title}</b> ({c.code}).</p>
                  <div>
                    <label className="label" htmlFor="note">Nota (facoltativa)</label>
                    <textarea id="note" className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
                  </div>
                  {err && <p className="text-sm text-rose-800">{err}</p>}
                  <div className="flex gap-2">
                    <button className="btn-secondary" onClick={() => setWithdrawOpen(false)} disabled={busy}>Indietro</button>
                    <button className="btn-danger bg-rose-600 text-white hover:bg-rose-700" onClick={confirmWithdraw} disabled={busy}>{busy ? 'Invio…' : 'Conferma recesso'}</button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="mt-1 text-sm text-zinc-600">Il termine per il recesso è scaduto il {c.withdrawalDeadline}.</p>
          )}
        </div>
      )}
      {c.html && (
        <div className="card p-5 sm:p-8">
          <DocPreview html={c.html} />
        </div>
      )}
    </div>
  );
}
