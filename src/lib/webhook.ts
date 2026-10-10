import 'server-only';
import type { Contract } from '@prisma/client';
import { db } from './db';
import { getSettings } from './settings';
import { hmac } from './crypto';

const PUBLIC_KEYS = ['cliente_nome_cognome', 'cliente_email', 'cliente_telefono', 'pacchetto', 'corrispettivo_totale', 'durata_mesi', 'modalita_pagamento'];

/** Invia l'evento agli URL configurati (es. "Inbound Webhook" di GoHighLevel). Non blocca mai il flusso principale. */
export async function fireWebhook(event: string, c: Contract & { owner?: { name: string; email: string } | null }) {
  try {
    const s = await getSettings();
    const urls = s.webhookUrls.split(/\s+/).filter((u) => /^https:\/\//.test(u));
    if (!urls.length) return;
    const values = (c.values ?? {}) as Record<string, unknown>;
    const payload = {
      event,
      occurredAt: new Date().toISOString(),
      contract: {
        id: c.id,
        code: c.code,
        title: c.title,
        status: c.status,
        sentAt: c.sentAt,
        otpVerifiedAt: c.otpVerifiedAt,
        signedAt: c.signedAt,
        withdrawnAt: c.withdrawnAt,
        recipientName: c.recipientName,
        recipientEmail: c.recipientEmail,
        seller: c.owner ? { name: c.owner.name, email: c.owner.email } : undefined,
      },
      data: Object.fromEntries(PUBLIC_KEYS.filter((k) => values[k] !== undefined).map((k) => [k, values[k]])),
    };
    const body = JSON.stringify(payload);
    const signature = s.webhookSecret ? hmac(body, s.webhookSecret) : '';
    await Promise.all(
      urls.map(async (url) => {
        try {
          const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-lca-event': event, 'x-lca-signature': signature }, body, signal: AbortSignal.timeout(10_000) });
          await db.webhookLog.create({ data: { event, url, status: res.status, contractId: c.id } });
        } catch (e) {
          await db.webhookLog.create({ data: { event, url, error: e instanceof Error ? e.message : String(e), contractId: c.id } });
        }
      }),
    );
  } catch (e) {
    console.error('webhook', e);
  }
}
