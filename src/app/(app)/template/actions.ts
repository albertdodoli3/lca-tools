'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { Prisma } from '@prisma/client';
import mammoth from 'mammoth';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { sanitizeTemplate } from '@/lib/sanitize';
import { FIELD_TYPES, FILLED_BY, syncFields, type FieldDef } from '@/lib/fields';

async function docxToHtml(file: File) {
  if (file.size > 8 * 1024 * 1024) throw new Error('File troppo grande (max 8 MB)');
  const { value } = await mammoth.convertToHtml({ buffer: Buffer.from(await file.arrayBuffer()) });
  return sanitizeTemplate(value);
}

export async function createTemplate(form: FormData) {
  await requireAdmin();
  const name = String(form.get('name') || 'Nuovo template').slice(0, 200);
  const file = form.get('file');
  let html = '<h1>Titolo del contratto</h1><p>Tra {{azienda_nome}} e il/la Sig./Sig.ra {{cliente_nome_cognome}}, codice fiscale {{cliente_codice_fiscale}}…</p><p>Firma del Cliente {{firma_cliente}}</p>';
  if (file instanceof File && file.size > 0) html = await docxToHtml(file);
  const t = await db.template.create({ data: { name, html, fields: syncFields(html, []) as unknown as Prisma.InputJsonValue } });
  redirect(`/template/${t.id}`);
}

export async function importDocx(form: FormData) {
  await requireAdmin();
  const file = form.get('file');
  if (!(file instanceof File) || !file.size) return { error: 'Seleziona un file .docx' };
  try {
    return { html: await docxToHtml(file) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Import non riuscito' };
  }
}

function cleanFields(html: string, input: FieldDef[]): FieldDef[] {
  return syncFields(html, input).map((f) => {
    const src = input.find((x) => x.key === f.key) ?? f;
    return {
      key: f.key,
      label: String(src.label || f.key).slice(0, 2000),
      type: src.type in FIELD_TYPES ? src.type : 'text',
      filledBy: src.filledBy in FILLED_BY ? src.filledBy : 'azienda',
      required: !!src.required,
      options: (src.type === 'choice' || src.type === 'select') ? (src.options ?? []).map((o) => String(o).trim()).filter(Boolean).slice(0, 30) : undefined,
      help: src.help ? String(src.help).slice(0, 500) : undefined,
    };
  });
}

export async function saveTemplate(id: string, input: { name: string; description: string; html: string; fields: FieldDef[] }) {
  await requireAdmin();
  const html = sanitizeTemplate(input.html);
  const fields = cleanFields(html, input.fields);
  const problems = fields.filter((f) => (f.type === 'choice' || f.type === 'select') && !f.options?.length).map((f) => f.key);
  if (problems.length) return { error: `Aggiungi le opzioni per: ${problems.join(', ')}` };
  const t = await db.template.update({
    where: { id },
    data: { name: input.name.slice(0, 200) || 'Senza nome', description: input.description.slice(0, 500), html, fields: fields as unknown as Prisma.InputJsonValue, version: { increment: 1 } },
  });
  revalidatePath('/template');
  return { ok: true, version: t.version };
}

export async function duplicateTemplate(id: string) {
  await requireAdmin();
  const src = await db.template.findUniqueOrThrow({ where: { id } });
  const t = await db.template.create({ data: { name: `${src.name} (copia)`, description: src.description, html: src.html, fields: src.fields as Prisma.InputJsonValue } });
  redirect(`/template/${t.id}`);
}

export async function setArchived(id: string, archived: boolean) {
  await requireAdmin();
  await db.template.update({ where: { id }, data: { archived } });
  revalidatePath('/template');
}
