import 'server-only';
import { chromium } from 'playwright-core';
import type { AuditEvent } from '@prisma/client';
import { DOC_CSS, escapeHtml } from './render';
import { formatDateTime } from './fields';
import { EVENT_LABEL } from './status';

export async function htmlToPdf(html: string, footer: string): Promise<Buffer> {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage();
    // Il contenuto è statico: blocchiamo qualsiasi richiesta di rete esterna
    await page.route('**/*', (route) => (route.request().url().startsWith('data:') ? route.continue() : route.abort()));
    await page.setContent(html, { waitUntil: 'load' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '18mm', bottom: '20mm', left: '18mm', right: '18mm' },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `<div style="font-size:7.5px;color:#777;width:100%;padding:0 18mm;display:flex;justify-content:space-between;font-family:Arial"><span>${escapeHtml(footer)}</span><span>Pag. <span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

type CertInput = {
  code: string;
  title: string;
  companyName: string;
  signerName: string;
  signerEmail: string;
  signedAt: Date;
  documentHash: string;
  events: AuditEvent[];
};

function device(ua: string | null) {
  if (!ua) return '';
  const os = /Windows/.test(ua) ? 'Windows' : /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Altro';
  const br = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  return `${br} su ${os}`;
}

export function certificateHtml(c: CertInput) {
  const rows = c.events
    .map(
      (e) => `<tr><td>${escapeHtml(formatDateTime(e.createdAt))}</td><td>${escapeHtml(EVENT_LABEL[e.type] ?? e.type)}${
        (e.data as Record<string, unknown>)?.to ? `<br/><small>${escapeHtml(String((e.data as Record<string, unknown>).to))}</small>` : ''
      }</td><td>${escapeHtml(e.actorType === 'utente' ? e.actorLabel ?? 'Operatore' : e.actorType === 'cliente' ? 'Cliente' : 'Sistema')}</td><td>${escapeHtml(e.ip ?? '')}<br/><small>${escapeHtml(device(e.userAgent))}</small></td></tr>`,
    )
    .join('');
  return `<section class="cert">
<h1>Certificato di firma elettronica</h1>
<table class="kv">
<tr><th>Documento</th><td>${escapeHtml(c.title)}</td></tr>
<tr><th>Codice</th><td>${escapeHtml(c.code)}</td></tr>
<tr><th>Proponente</th><td>${escapeHtml(c.companyName)}</td></tr>
<tr><th>Firmatario</th><td>${escapeHtml(c.signerName)} &lt;${escapeHtml(c.signerEmail)}&gt;</td></tr>
<tr><th>Data e ora della firma</th><td>${escapeHtml(formatDateTime(c.signedAt))} (ora italiana) — ${escapeHtml(c.signedAt.toISOString())} UTC</td></tr>
<tr><th>Impronta SHA-256 del contenuto firmato</th><td class="mono">${escapeHtml(c.documentHash)}</td></tr>
<tr><th>Metodo</th><td>Firma elettronica ai sensi del Reg. (UE) 910/2014 (eIDAS) e dell'art. 20 del D.Lgs. 82/2005 (CAD). Accesso al documento subordinato alla verifica di un codice monouso (OTP) inviato all'indirizzo email del firmatario; firma apposta graficamente dal firmatario; ogni passaggio registrato con data, ora, indirizzo IP e dispositivo.</td></tr>
</table>
<h2>Registro degli eventi</h2>
<table class="log"><thead><tr><th>Data e ora</th><th>Evento</th><th>Soggetto</th><th>IP / dispositivo</th></tr></thead><tbody>${rows}</tbody></table>
<p class="note">Il registro è conservato in forma concatenata (ogni evento contiene l'impronta del precedente) per renderne rilevabile qualsiasi alterazione. L'impronta SHA-256 del file PDF è comunicata al firmatario nell'email di conferma e conservata dal proponente.</p>
</section>`;
}

export function pdfDocument(bodyHtml: string, certHtml: string, logo?: string | null) {
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"/><style>
${DOC_CSS}
body { margin: 0; }
.logo { text-align: center; margin-bottom: 10px; } .logo img { max-height: 48px; }
.cert { page-break-before: always; font-family: Arial, Helvetica, sans-serif; font-size: 9.5pt; color: #1b1b1f; }
.cert h1 { font-size: 15pt; margin: 0 0 12px; } .cert h2 { font-size: 11pt; margin: 18px 0 6px; }
.cert table { width: 100%; border-collapse: collapse; } .cert th, .cert td { border: 1px solid #c9c9d1; padding: 5px 7px; text-align: left; vertical-align: top; }
.cert .kv th { width: 34%; background: #f3f1f4; } .cert .log th { background: #f3f1f4; } .cert .mono { font-family: monospace; word-break: break-all; }
.cert small { color: #666; } .cert .note { color: #555; margin-top: 10px; font-size: 8.5pt; }
tr { page-break-inside: avoid; }
</style></head><body>${logo ? `<div class="logo"><img src="${logo}" alt=""/></div>` : ''}<div class="doc">${bodyHtml}</div>${certHtml}</body></html>`;
}
