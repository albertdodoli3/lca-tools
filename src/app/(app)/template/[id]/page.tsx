import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import type { FieldDef } from '@/lib/fields';
import { TemplateEditor } from './TemplateEditor';

export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const t = await db.template.findUnique({ where: { id: (await params).id } });
  if (!t) notFound();
  return <TemplateEditor template={{ id: t.id, name: t.name, description: t.description, html: t.html, fields: t.fields as unknown as FieldDef[], version: t.version }} readOnly={user.role !== 'ADMIN'} />;
}
