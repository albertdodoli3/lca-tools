# LCA Contratti

Software interno di Love Coach Academy per creare, inviare e far firmare i contratti a distanza, con sblocco tramite codice OTP e registro completo dei passaggi.

## Cosa fa

| Funzione | Dove |
|---|---|
| **Template** dei contratti: incolli il testo già formattato (o importi il .docx) e inserisci le variabili `{{nome_variabile}}`, come nei tool di email marketing. Per ogni variabile scegli tipo (testo, data, codice fiscale, importo, casella, scelta, firma…) e **chi la compila**: azienda o cliente. | *Template* |
| **Nuovo contratto** da template (copia congelata: se modifichi il template, i contratti già creati non cambiano) e **duplicazione** di un contratto per un altro cliente. | *Contratti → Nuovo* |
| **Scheda d’ordine** compilata dall’azienda con anteprima dal vivo del documento. Puoi anche precompilare nome ed email del cliente. | Pagina del contratto |
| **Pannello laterale di invio**: destinatario, oggetto e testo dell’email modificabili, validità del link, pulsante *“Invia con richiesta OTP per lo sblocco”*. C’è anche *“Copia link”* per mandarlo su WhatsApp: l’OTP arriva comunque solo all’email del cliente. | *Invia al cliente →* |
| **Pagina del cliente**: richiesta del codice OTP via email → verifica → compilazione guidata (dati, dichiarazioni, rilettura, firme) → firma disegnata o digitata → PDF. | Link ricevuto via email |
| **Pipeline** `Bozza → Inviato → Aperto → OTP sbloccato → Firmato`, più *Scaduto*, *Annullato* e *Receduto*. | *Pipeline* |
| **Invio misto**: invito e promemoria da GoHighLevel, OTP e copie firmate via SMTP (vedi sotto). | *Impostazioni* |
| **Avvisi in app ed email** al venditore e agli admin (apertura, sblocco, firma, scadenza, recesso) e **promemoria automatici** al cliente (default dopo 2 e 5 giorni). | *Avvisi* |
| **Webhook** per GoHighLevel e altre automazioni, uno per ogni cambio di stato. | *Impostazioni* |
| **Recesso online** con il pulsante *“Recedi dal contratto qui”* entro 14 giorni (art. 54-bis Codice del Consumo, richiamato dall’art. 12.2 del vostro contratto) ed email di conferma di ricezione. | Pagina del cliente |
| **Ruoli**: l’admin vede tutto e gestisce template, impostazioni e utenti; il venditore vede solo i propri contratti. | *Utenti* |

Il template **“Contratto per il Percorso di Affiancamento”** è già pronto: ricavato dal vostro Word, con 75 variabili configurate (dati del cliente, Scheda d’ordine, dichiarazioni A/B, consensi, doppia firma per gli artt. 1341-1342 c.c.).

## Tracciamento e tutela (sintesi)

- **Registro degli eventi a catena di hash**: ogni passaggio (creazione, invio, apertura, OTP inviato/errato/verificato, firma, download, recesso) viene salvato con data e ora, IP e dispositivo. Ogni evento contiene l’impronta del precedente, quindi un’alterazione del registro viene rilevata e mostrata nella *Cronologia*.
- **PDF firmato** con il contenuto congelato al momento della firma, l’impronta SHA-256 del contenuto e una pagina finale *“Certificato di firma elettronica”* con il registro. L’impronta del PDF viene comunicata al cliente nell’email di conferma.
- **Copia su supporto durevole** inviata in automatico al cliente con il PDF allegato (art. 51 Codice del Consumo).
- **OTP**: 6 cifre, scadenza configurabile (default 10 minuti), massimo 5 tentativi, codici precedenti invalidati, limite di invii. Il codice non viene mai salvato in chiaro, nemmeno nel registro delle email visibile agli operatori.
- **Link** casuali a 256 bit con scadenza; nel database sono salvati solo hash e versione cifrata. Le pagine non vengono indicizzate.
- **GDPR**: cancellazione automatica di dati personali, PDF e IP allo scadere dei tempi di conservazione (default 10 anni per i firmati, 12 mesi per bozze, annullati e scaduti). Password SMTP cifrata. Font della firma ospitato in locale, quindi nessuna chiamata a Google Fonts.
- **Sicurezza applicativa**: password con bcrypt, sessioni firmate, cookie HttpOnly, limiti di frequenza su login e API del cliente, testo dei template ripulito da codice malevolo, intestazioni di sicurezza HTTP.

## Avvio in locale

Requisiti: Node 22, PostgreSQL 16, Chromium (per i PDF).

```bash
cp .env.example .env          # imposta DATABASE_URL, APP_URL, APP_SECRET, CHROMIUM_PATH
npm install
npx prisma migrate deploy
npm run db:seed               # crea il template LCA
npm run dev                   # http://localhost:3000 → crea il primo amministratore
```

Oppure tutto con Docker: `docker compose up --build`.

Senza SMTP configurato l’app gira in **modalità test**: le email (compreso l’OTP) non partono, ma vengono registrate nella scheda *Email* del contratto. Così si può provare tutto il flusso.

## Messa online (consiglio)

Per 20-30 contratti al mese basta un piccolo server. Due opzioni:

1. **Railway** (la più semplice, circa 5-10 €/mese): *New Project → Deploy from GitHub repo* (usa il `Dockerfile`), aggiungi un database **PostgreSQL** e scegli la **regione EU (Amsterdam)** sia per l’app sia per il database. Imposta le variabili d’ambiente qui sotto e collega il sottodominio (es. `contratti.lovecoachacademy.it`) con un record CNAME.
2. **Hetzner** (Germania, tutto in UE, da circa 5 €/mese): una VPS con Docker e `docker compose up -d`, più un proxy HTTPS (es. Caddy). Richiede un po’ più di manutenzione.

Variabili d’ambiente in produzione:

| Variabile | Valore |
|---|---|
| `DATABASE_URL` | stringa di connessione PostgreSQL |
| `APP_URL` | `https://contratti.tuodominio.it` (usato nei link inviati ai clienti) |
| `APP_SECRET` | stringa casuale lunga: `openssl rand -base64 48`. **Non cambiarla più**: firma le sessioni e cifra i link e la password SMTP |
| `CHROMIUM_PATH` | già impostata nel Dockerfile (`/usr/bin/chromium`) |

I promemoria e le scadenze girano in automatico ogni 15 minuti all’interno dell’app. In alternativa: `GET /api/cron` con header `Authorization: Bearer <CRON_SECRET>`.

## Email e dominio: invio misto (GoHighLevel + SMTP)

In *Impostazioni → Invio tramite GoHighLevel* scegli **“Misto”**:

| Email | Canale | Perché |
|---|---|---|
| Invito con il link, promemoria | **GoHighLevel** (API Conversations) | partono dal vostro dominio GHL e compaiono nella conversazione del contatto |
| Codice OTP, copia firmata in PDF, conferma di recesso, notifiche al team | **SMTP** | codici e documenti personali non restano salvati in GHL; il PDF viaggia come allegato vero (supporto durevole) |

Se GoHighLevel non risponde (token scaduto, errore), l’email parte in automatico via SMTP. Nella scheda *Email* del contratto ogni messaggio mostra il canale usato.

**Configurazione GoHighLevel**
1. GHL → *Settings → Private Integrations* → crea un’integrazione con i permessi `contacts.write` e `conversations/message.write`, poi copia il token.
2. Copia il **Location ID** del sub-account (*Settings → Business Profile*, oppure dall’URL `/location/<ID>/…`).
3. Incollali nelle Impostazioni, salva e usa *“Invia prova GHL”*. Il contatto viene creato o aggiornato in GHL con origine “LCA Contratti”: eventuali workflow GHL attivati dalla creazione di un contatto partiranno anche qui.

**SMTP (obbligatorio per OTP e copie firmate)**: va bene la casella che usate già, per esempio Google Workspace (`smtp.gmail.com`, porta 465, SSL, con una “password per le app”) oppure il provider della vostra casella aziendale. Senza SMTP l’app resta in modalità test per le email via SMTP.

## GoHighLevel (webhook)

In GHL crea un Workflow con trigger **Inbound Webhook**, copia l’URL in *Impostazioni → Webhook*, poi fai un invio di prova per mappare i campi.

Esempio di payload:

```json
{
  "event": "contratto.firmato",
  "occurredAt": "2026-10-10T10:51:41.823Z",
  "contract": { "id": "…", "code": "LCA-2026-0001", "title": "…", "status": "FIRMATO", "signedAt": "…", "recipientEmail": "mario.rossi@example.com", "seller": { "name": "…", "email": "…" } },
  "data": { "cliente_nome_cognome": "Mario Rossi", "cliente_email": "…", "cliente_telefono": "…", "pacchetto": "Premium 6 mesi", "corrispettivo_totale": "2900" }
}
```

Eventi disponibili: `contratto.inviato`, `contratto.aperto`, `contratto.sbloccato`, `contratto.firmato`, `contratto.receduto`, `contratto.scaduto`, `contratto.annullato`. Se imposti un segreto, l’header `x-lca-signature` contiene l’HMAC-SHA256 del corpo della richiesta.

## Note legali da verificare con l’avvocato

Il software fornisce gli strumenti, ma il testo dei contratti va validato da un legale. Punti emersi dal vostro contratto:

1. **Allegato 3, punto 5 (destinatari)**: indica HighLevel come piattaforma di compilazione e firma. Va aggiornato con questo software e i relativi fornitori come responsabili del trattamento (hosting e servizio email), con i loro accordi sul trattamento dei dati (DPA).
2. **Art. 7.1 e 4.5 (valore di GIADA TWIN)**: il contratto rimanda al “valore di GIADA TWIN” indicato nella Scheda d’ordine, ma la tabella *Corrispettivo* dell’Allegato 1 non ha una riga per quel valore. Se volete aggiungerla, basta inserire nel template la riga con una nuova variabile (es. `{{valore_giada_twin}}`).
3. **Firma di LCA**: in base all’art. 6.1 il contratto si conclude quando LCA riceve il documento firmato dal cliente, quindi non serve una controfirma attiva. La firma dell’azienda (`{{firma_lca}}`) viene apposta in automatico con il nome del firmatario o con l’immagine caricata nelle Impostazioni.
4. **Tipo di firma**: OTP via email, firma grafica e registro dei passaggi costituiscono una **firma elettronica semplice** (eIDAS / art. 20 CAD), liberamente valutabile dal giudice. Per l’approvazione specifica delle clausole vessatorie (artt. 1341-1342 c.c.) è previsto un secondo atto di firma separato, che rafforza la prova ma non equivale a una firma avanzata o qualificata. Se l’avvocato lo ritiene necessario, si può integrare un fornitore di firma avanzata o qualificata (es. Namirial, InfoCert, Yousign).
5. **Consenso per i dati particolari** (vita sentimentale e sessuale): nel template è obbligatorio per proseguire, come scritto nel contratto (“necessario per la fruizione”). Va confermato che il consenso così condizionato sia la base giuridica corretta.
6. **Verifica dell’identità**: l’OTP prova il controllo della casella email, non l’identità anagrafica. Se serve una prova più forte si può aggiungere il caricamento del documento d’identità oppure l’OTP via SMS.

## Struttura del codice

```
prisma/schema.prisma          modello dati (contratti, template, registro, OTP, email, avvisi)
prisma/seed.ts                template LCA con la configurazione dei 75 campi
src/lib/contracts.ts          logica: invio, OTP, firma, PDF, recesso
src/lib/audit.ts              registro a catena di hash
src/lib/jobs.ts               promemoria, scadenze, conservazione dei dati
src/lib/render.ts, fields.ts  variabili, validazioni (incluso il codice fiscale), anteprima
src/app/(app)/…               area interna (pipeline, contratti, template, impostazioni)
src/app/firma/[token]         pagina pubblica del cliente
src/app/api/firma/[token]/…   API del cliente (OTP, salvataggio, firma, PDF, recesso)
```
