'use server';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { encrypt } from '@/lib/crypto';
import { ghlConfigured, sendMail, sendViaGhl } from '@/lib/mail';

const str = (f: FormData, k: string, max = 500) => String(f.get(k) ?? '').trim().slice(0, max);
const int = (f: FormData, k: string, min: number, max: number, def: number) => {
  const n = Math.round(Number(f.get(k)));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

async function imageField(f: FormData, k: string): Promise<string | null | undefined> {
  if (f.get(`${k}_remove`) === '1') return null;
  const file = f.get(k);
  if (!(file instanceof File) || !file.size) return undefined;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Formato immagine non supportato (usa PNG, JPG o WebP)');
  if (file.size > 600 * 1024) throw new Error('Immagine troppo grande (max 600 KB)');
  return `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString('base64')}`;
}

export async function saveSettings(_: unknown, f: FormData) {
  await requireAdmin();
  try {
    const logo = await imageField(f, 'logo');
    const signature = await imageField(f, 'signature');
    const pass = String(f.get('smtpPass') ?? '');
    const ghlToken = String(f.get('ghlToken') ?? '').trim();
    const color = str(f, 'brandColor');
    await db.settings.update({
      where: { id: 1 },
      data: {
        companyName: str(f, 'companyName', 200),
        brandColor: /^#[0-9a-f]{6}$/i.test(color) ? color : '#9b2c55',
        companySignerName: str(f, 'companySignerName', 200),
        senderName: str(f, 'senderName', 200),
        senderEmail: str(f, 'senderEmail', 200).toLowerCase(),
        replyTo: str(f, 'replyTo', 200).toLowerCase(),
        smtpHost: str(f, 'smtpHost', 200),
        smtpPort: int(f, 'smtpPort', 1, 65535, 587),
        smtpSecure: f.get('smtpSecure') === 'on',
        smtpUser: str(f, 'smtpUser', 200),
        ...(pass ? { smtpPassEnc: encrypt(pass) } : {}),
        emailMode: f.get('emailMode') === 'misto' ? 'misto' : 'smtp',
        ghlLocationId: str(f, 'ghlLocationId', 100),
        ghlEmailFrom: str(f, 'ghlEmailFrom', 200).toLowerCase(),
        ...(ghlToken ? { ghlTokenEnc: encrypt(ghlToken) } : {}),
        ...(f.get('ghlToken_remove') === '1' ? { ghlTokenEnc: '' } : {}),
        notifyEmails: str(f, 'notifyEmails', 1000),
        linkExpiryDays: int(f, 'linkExpiryDays', 1, 60, 7),
        reminderDays: str(f, 'reminderDays', 50).replace(/[^0-9,]/g, ''),
        otpMinutes: int(f, 'otpMinutes', 3, 30, 10),
        signedRetentionYears: int(f, 'signedRetentionYears', 1, 30, 10),
        unsignedRetentionMonths: int(f, 'unsignedRetentionMonths', 1, 120, 12),
        defaultEmailSubject: str(f, 'defaultEmailSubject', 300),
        defaultEmailBody: str(f, 'defaultEmailBody', 5000),
        webhookUrls: str(f, 'webhookUrls', 2000),
        webhookSecret: str(f, 'webhookSecret', 200),
        ...(logo !== undefined ? { logoDataUrl: logo } : {}),
        ...(signature !== undefined ? { companySignatureUrl: signature } : {}),
      },
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Errore' };
  }
  revalidatePath('/', 'layout');
  return { ok: 'Impostazioni salvate' };
}

export async function testEmail(_: unknown, f: FormData) {
  const user = await requireAdmin();
  const to = String(f.get('to') || user.email);
  const r = await sendMail({ to, subject: 'Prova di invio — gestione contratti', text: 'Se leggi questa email la configurazione SMTP funziona correttamente.', kind: 'test' });
  if (!r.ok) return { error: `Invio non riuscito: ${r.error}` };
  return { ok: r.simulated ? 'SMTP non configurato: email solo simulata.' : `Email di prova inviata a ${to}` };
}

export async function testGhl(_: unknown, f: FormData) {
  const user = await requireAdmin();
  if (!(await ghlConfigured())) return { error: 'Inserisci e salva prima token e Location ID di GoHighLevel.' };
  const to = String(f.get('to') || user.email).trim().toLowerCase();
  try {
    await sendViaGhl({ to, name: user.name, subject: 'Prova di invio tramite GoHighLevel — gestione contratti', html: '<p>Se leggi questa email il collegamento con GoHighLevel funziona correttamente.</p>', text: 'Se leggi questa email il collegamento con GoHighLevel funziona correttamente.' });
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Errore' };
  }
  return { ok: `Email di prova inviata tramite GoHighLevel a ${to} (trovi il contatto e la conversazione in GHL).` };
}
