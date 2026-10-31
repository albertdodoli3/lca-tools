'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { Prisma, User } from '@prisma/client';
import { db } from '@/lib/db';
import { contractScope, requireUser } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { reqInfo } from '@/lib/request';
import { buildSignedPdf, cancelContract, fieldsOf, nextCode, retractContract, sendContract, valuesOf } from '@/lib/contracts';
import { normalizeValue, validateAll, type Values } from '@/lib/fields';

async function loadOwned(user: User, id: string) {
  const c = await db.contract.findFirst({ where: { id, ...contractScope(user) } });
  if (!c) throw new Error('Contratto non trovato');
  return c;
}

const actor = (u: User) => ({ type: 'utente' as const, id: u.id, label: `${u.name} <${u.email}>` });

export async function createContract(form: FormData) {
  const user = await requireUser();
  const tpl = await db.template.findUniqueOrThrow({ where: { id: String(form.get('templateId')) } });
  const title = String(form.get('title') || tpl.name).slice(0, 200);
  const c = await db.contract.create({
    data: { code: await nextCode(), title, templateId: tpl.id, templateVersion: tpl.version, html: tpl.html, fields: tpl.fields as Prisma.InputJsonValue, ownerId: user.id },
  });
  await audit(c.id, 'creato', actor(user), await reqInfo(), { template: tpl.name, versione: tpl.version });
  redirect(`/contratti/${c.id}`);
}

/** Duplica la scheda d'ordine di un contratto esistente (senza i dati del cliente). */
export async function duplicateContract(id: string) {
  const user = await requireUser();
  const src = await loadOwned(user, id);
  const fields = fieldsOf(src);
  const companyValues = Object.fromEntries(Object.entries(valuesOf(src)).filter(([k]) => fields.find((f) => f.key === k)?.filledBy === 'azienda'));
  const c = await db.contract.create({
    data: { code: await nextCode(), title: src.title, templateId: src.templateId, templateVersion: src.templateVersion, html: src.html, fields: src.fields as Prisma.InputJsonValue, values: companyValues as Prisma.InputJsonValue, ownerId: user.id },
  });
  await audit(c.id, 'duplicato', actor(user), await reqInfo(), { da: src.code });
  redirect(`/contratti/${c.id}`);
}

export async function saveContract(id: string, title: string, input: Values) {
  const user = await requireUser();
  const c = await loadOwned(user, id);
  if (c.status !== 'BOZZA') return { error: 'Il contratto è già stato inviato: ritira l’invio per modificarlo.' };
  const values: Values = {};
  // Il venditore compila solo la scheda d'ordine: dati, dichiarazioni, consensi e firme sono del cliente
  for (const f of fieldsOf(c)) {
    if (f.filledBy !== 'azienda' || !(f.key in input)) continue;
    values[f.key] = normalizeValue(f, input[f.key]);
  }
  await db.contract.update({ where: { id }, data: { title: title.slice(0, 200) || c.title, values: values as Prisma.InputJsonValue } });
  await audit(id, 'modificato', actor(user), await reqInfo());
  revalidatePath(`/contratti/${id}`);
  return { ok: true };
}

export async function sendContractAction(id: string, input: { to: string; name: string; subject: string; body: string; expiryDays: number }) {
  const user = await requireUser();
  const c = await loadOwned(user, id);
  if (!['BOZZA', 'INVIATO', 'APERTO', 'SCADUTO'].includes(c.status)) return { error: 'Questo contratto non può essere (re)inviato.' };
  const errors = validateAll(fieldsOf(c), valuesOf(c), 'azienda');
  if (Object.keys(errors).length) return { error: `Completa prima la scheda d’ordine: ${Object.keys(errors).length} campi obbligatori mancanti o non validi.`, fieldErrors: errors };
  const to = input.to.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) return { error: 'Email del destinatario non valida.' };
  if (!input.name.trim()) return { error: 'Inserisci il nome del destinatario.' };
  const expiryDays = Math.min(60, Math.max(1, Math.round(input.expiryDays) || 7));
  const res = await sendContract(c, user, { to, name: input.name.trim().slice(0, 120), subject: input.subject.slice(0, 300), body: input.body.slice(0, 5000), expiryDays }, await reqInfo());
  revalidatePath(`/contratti/${id}`);
  if (!res.ok) return { error: `Contratto pronto ma l’email non è partita: ${res.error}. Puoi copiare il link e inviarlo manualmente.`, link: res.link };
  return { ok: true, simulated: res.simulated, link: res.link };
}

export async function retractAction(id: string) {
  const user = await requireUser();
  const c = await loadOwned(user, id);
  if (!['INVIATO', 'APERTO', 'SCADUTO'].includes(c.status)) return { error: 'Non è possibile ritirare un contratto in compilazione o firmato.' };
  await retractContract(c, user, await reqInfo());
  revalidatePath(`/contratti/${id}`);
  return { ok: true };
}

export async function cancelAction(id: string, reason: string) {
  const user = await requireUser();
  const c = await loadOwned(user, id);
  if (['FIRMATO', 'RECEDUTO', 'ANNULLATO'].includes(c.status)) return { error: 'Contratto non annullabile.' };
  await cancelContract(c, user, await reqInfo(), reason);
  revalidatePath(`/contratti/${id}`);
  return { ok: true };
}

export async function regeneratePdfAction(id: string) {
  const user = await requireUser();
  await loadOwned(user, id);
  try {
    await buildSignedPdf(id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Errore' };
  }
  revalidatePath(`/contratti/${id}`);
  return { ok: true };
}

export async function deleteDraftAction(id: string) {
  const user = await requireUser();
  const c = await loadOwned(user, id);
  if (c.status !== 'BOZZA' || c.sentAt) return { error: 'Si possono eliminare solo bozze mai inviate. Per gli altri usa “Annulla”.' };
  await db.contract.delete({ where: { id } });
  redirect('/contratti');
}
