'use client';
import { startTransition, useActionState } from 'react';
import { saveSettings, testEmail, testGhl } from './actions';

type S = Record<string, string | number | boolean | null> & { hasSmtpPass: boolean; hasGhlToken: boolean; hasBrevoKey: boolean };

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="card grid gap-4 p-5 md:grid-cols-[240px_1fr]">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {desc && <p className="mt-1 text-xs text-zinc-500">{desc}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function F({ label, name, defaultValue, type = 'text', help, placeholder }: { label: string; name: string; defaultValue?: string | number | null; type?: string; help?: string; placeholder?: string }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input className="input" id={name} name={name} type={type} defaultValue={defaultValue ?? ''} placeholder={placeholder} />
      {help && <p className="mt-1 text-xs text-zinc-500">{help}</p>}
    </div>
  );
}

export function SettingsForm({ s, appUrl }: { s: S; appUrl: string }) {
  const [state, action, pending] = useActionState(saveSettings, undefined);
  const [testState, testAction, testPending] = useActionState(testEmail, undefined);
  const [ghlState, ghlAction, ghlPending] = useActionState(testGhl, undefined);
  return (
    <div className="max-w-5xl space-y-5">
      <h1 className="text-2xl font-semibold">Impostazioni</h1>
      {/* Invio manuale: con l'attributo action React svuoterebbe il modulo anche in caso di errore */}
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(() => action(fd));
        }}
      >
        <Section title="Azienda e brand" desc="Logo e colore usati nell’app, nella pagina di firma e nelle email.">
          <F label="Ragione sociale" name="companyName" defaultValue={s.companyName as string} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="brandColor">Colore principale</label>
              <input className="h-10 w-20 cursor-pointer rounded-lg ring-1 ring-zinc-300" id="brandColor" name="brandColor" type="color" defaultValue={s.brandColor as string} />
            </div>
            <div>
              <label className="label" htmlFor="logo">Logo (PNG/JPG, max 600 KB)</label>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {s.logoDataUrl && <img src={s.logoDataUrl as string} alt="" className="mb-2 max-h-12" />}
              <input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" className="text-sm" />
              {s.logoDataUrl && <label className="mt-1 flex items-center gap-1 text-xs"><input type="checkbox" name="logo_remove" value="1" /> Rimuovi logo</label>}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <F label="Firmatario per l’azienda" name="companySignerName" defaultValue={s.companySignerName as string} help="Compare dove il template usa {{firma_lca}}." />
            <div>
              <label className="label" htmlFor="signature">Immagine firma azienda (facoltativa)</label>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {s.companySignatureUrl && <img src={s.companySignatureUrl as string} alt="" className="mb-2 max-h-12" />}
              <input id="signature" name="signature" type="file" accept="image/png,image/jpeg" className="text-sm" />
              {s.companySignatureUrl && <label className="mt-1 flex items-center gap-1 text-xs"><input type="checkbox" name="signature_remove" value="1" /> Rimuovi</label>}
            </div>
          </div>
        </Section>

        <Section title="Invio email (SMTP)" desc={`Dominio e casella si possono configurare in qualsiasi momento. Senza SMTP l’app funziona in modalità test (email solo registrate). I link inviati ai clienti usano l’indirizzo dell’app: ${appUrl}`}>
          <div className="grid gap-4 sm:grid-cols-2">
            <F label="Nome mittente" name="senderName" defaultValue={s.senderName as string} />
            <F label="Email mittente" name="senderEmail" type="email" defaultValue={s.senderEmail as string} placeholder="contratti@tuodominio.it" />
            <F label="Rispondi a (Reply-To)" name="replyTo" type="email" defaultValue={s.replyTo as string} placeholder="info@conquistalei.com" />
            <F label="Notifiche al team (separate da virgola)" name="notifyEmails" defaultValue={s.notifyEmails as string} />
          </div>
          <div className="rounded-lg bg-zinc-50 p-4 ring-1 ring-zinc-200">
            <label className="label" htmlFor="brevoApiKey">Chiave API Brevo (consigliata su Railway)</label>
            <input className="input" id="brevoApiKey" name="brevoApiKey" type="password" autoComplete="off" placeholder="xkeysib-…" />
            <p className="mt-1 text-xs text-zinc-500">
              {s.hasBrevoKey ? 'Già impostata: le email partono tramite l’API di Brevo e i campi SMTP qui sotto vengono ignorati. Lascia vuoto per non cambiarla. ' : 'Se impostata, le email partono tramite l’API HTTPS di Brevo invece che via SMTP (Railway blocca le porte SMTP sui piani Trial e Hobby). '}
              Brevo → SMTP e API → Chiavi API → Genera. Salvata cifrata.
            </p>
            {s.hasBrevoKey && <label className="mt-1 flex items-center gap-1 text-xs"><input type="checkbox" name="brevoApiKey_remove" value="1" /> Rimuovi chiave API (torna a usare l’SMTP)</label>}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <F label="Server SMTP" name="smtpHost" defaultValue={s.smtpHost as string} placeholder="smtp-relay.brevo.com" />
            <F label="Porta" name="smtpPort" type="number" defaultValue={s.smtpPort as number} />
            <label className="mt-7 flex items-center gap-2 text-sm"><input type="checkbox" name="smtpSecure" defaultChecked={!!s.smtpSecure} /> SSL/TLS diretto (porta 465)</label>
            <F label="Utente SMTP" name="smtpUser" defaultValue={s.smtpUser as string} />
            <F label="Password SMTP" name="smtpPass" type="password" help={s.hasSmtpPass ? 'Già impostata: lascia vuoto per non cambiarla. Viene salvata cifrata.' : 'Viene salvata cifrata.'} />
          </div>
        </Section>

        <Section title="Invio tramite GoHighLevel" desc="Modalità mista: invito e promemoria partono da GHL (dal vostro dominio di invio GHL e compaiono nella conversazione del contatto). Il codice OTP, la copia firmata in PDF, la conferma di recesso e le notifiche al team partono sempre via SMTP, così codici e documenti non restano in GHL. Se GHL non risponde, l’email parte via SMTP.">
          <div>
            <label className="label" htmlFor="emailMode">Modalità di invio</label>
            <select className="input" id="emailMode" name="emailMode" defaultValue={s.emailMode as string}>
              <option value="smtp">Tutto via SMTP</option>
              <option value="misto">Misto: invito e promemoria via GoHighLevel, il resto via SMTP</option>
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="ghlToken">Token Private Integration</label>
              <input className="input" id="ghlToken" name="ghlToken" type="password" autoComplete="off" />
              <p className="mt-1 text-xs text-zinc-500">{s.hasGhlToken ? 'Già impostato: lascia vuoto per non cambiarlo. ' : ''}GHL → Settings → Private Integrations → crea con permessi “contacts.write” e “conversations/message.write”. Salvato cifrato.</p>
              {s.hasGhlToken && <label className="mt-1 flex items-center gap-1 text-xs"><input type="checkbox" name="ghlToken_remove" value="1" /> Rimuovi token</label>}
            </div>
            <F label="Location ID (sub-account)" name="ghlLocationId" defaultValue={s.ghlLocationId as string} help="GHL → Settings → Business Profile, oppure nell’URL: /location/<ID>/…" />
            <F label="Mittente in GHL (facoltativo)" name="ghlEmailFrom" type="email" defaultValue={s.ghlEmailFrom as string} help="Deve essere un indirizzo del dominio di invio configurato in GHL. Vuoto = mittente predefinito di GHL." />
          </div>
        </Section>

        <Section title="Email al cliente" desc="Testo predefinito, modificabile a ogni invio dal pannello laterale.">
          <F label="Oggetto" name="defaultEmailSubject" defaultValue={s.defaultEmailSubject as string} />
          <div>
            <label className="label" htmlFor="defaultEmailBody">Testo</label>
            <textarea className="input" id="defaultEmailBody" name="defaultEmailBody" rows={10} defaultValue={s.defaultEmailBody as string} />
            <p className="mt-1 text-xs text-zinc-500">Variabili: {'{{nome}} {{link}} {{scadenza}} {{titolo}} {{azienda}} {{codice}}'}</p>
          </div>
        </Section>

        <Section title="Link, OTP e promemoria">
          <div className="grid gap-4 sm:grid-cols-3">
            <F label="Validità link (giorni)" name="linkExpiryDays" type="number" defaultValue={s.linkExpiryDays as number} />
            <F label="Validità codice OTP (minuti)" name="otpMinutes" type="number" defaultValue={s.otpMinutes as number} />
            <F label="Promemoria dopo (giorni)" name="reminderDays" defaultValue={s.reminderDays as string} help="Es. 2,5 = due promemoria" />
          </div>
        </Section>

        <Section title="Conservazione dei dati (GDPR)" desc="Allo scadere, dati personali, PDF e IP vengono cancellati automaticamente; resta solo lo scheletro anonimo del contratto.">
          <div className="grid gap-4 sm:grid-cols-2">
            <F label="Contratti firmati: anni" name="signedRetentionYears" type="number" defaultValue={s.signedRetentionYears as number} help="Consigliato 10 (art. 2220 c.c. e prescrizione ordinaria)." />
            <F label="Bozze/annullati/scaduti: mesi" name="unsignedRetentionMonths" type="number" defaultValue={s.unsignedRetentionMonths as number} />
          </div>
        </Section>

        <Section title="Webhook (GoHighLevel e automazioni)" desc="A ogni cambio di stato inviamo un POST JSON. In GHL: Automation → Workflow → trigger “Inbound Webhook”, incolla qui l’URL.">
          <div>
            <label className="label" htmlFor="webhookUrls">URL (uno per riga, solo https)</label>
            <textarea className="input font-mono text-xs" id="webhookUrls" name="webhookUrls" rows={3} defaultValue={s.webhookUrls as string} />
            <p className="mt-1 text-xs text-zinc-500">Eventi: contratto.inviato, contratto.aperto, contratto.sbloccato, contratto.firmato, contratto.receduto, contratto.scaduto, contratto.annullato.</p>
          </div>
          <F label="Segreto di firma (facoltativo)" name="webhookSecret" defaultValue={s.webhookSecret as string} help="Se impostato, ogni richiesta ha l’header x-lca-signature = HMAC-SHA256 del corpo." />
        </Section>

        <div className="sticky bottom-0 flex items-center gap-3 border-t border-zinc-200 bg-[#f7f6f8]/95 py-3">
          <button className="btn-primary" disabled={pending}>{pending ? 'Salvataggio…' : 'Salva impostazioni'}</button>
          {state?.ok && <span className="text-sm text-emerald-700">{state.ok}</span>}
          {state?.error && <span className="text-sm text-rose-700">{state.error}</span>}
        </div>
      </form>

      <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => testAction(fd)); }} className="card flex flex-wrap items-end gap-3 p-5">
        <div className="flex-1">
          <label className="label" htmlFor="to">Prova invio email</label>
          <input className="input" id="to" name="to" type="email" placeholder="tua@email.it" />
        </div>
        <button className="btn-secondary" disabled={testPending}>Invia prova</button>
        {testState?.ok && <p className="w-full text-sm text-emerald-700">{testState.ok}</p>}
        {testState?.error && <p className="w-full text-sm text-rose-700">{testState.error}</p>}
      </form>

      <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => ghlAction(fd)); }} className="card flex flex-wrap items-end gap-3 p-5">
        <div className="flex-1">
          <label className="label" htmlFor="ghl-to">Prova invio tramite GoHighLevel</label>
          <input className="input" id="ghl-to" name="to" type="email" placeholder="tua@email.it" />
          <p className="mt-1 text-xs text-zinc-500">Crea (o aggiorna) il contatto in GHL e gli invia un’email di prova.</p>
        </div>
        <button className="btn-secondary" disabled={ghlPending}>Invia prova GHL</button>
        {ghlState?.ok && <p className="w-full text-sm text-emerald-700">{ghlState.ok}</p>}
        {ghlState?.error && <p className="w-full text-sm text-rose-700">{ghlState.error}</p>}
      </form>
    </div>
  );
}
