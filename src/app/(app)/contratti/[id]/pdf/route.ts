import { NextResponse } from 'next/server';
import { contractScope, currentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { audit } from '@/lib/audit';
import { reqInfo } from '@/lib/request';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return new NextResponse('Non autorizzato', { status: 401 });
  const { id } = await params;
  const c = await db.contract.findFirst({ where: { id, ...contractScope(user) }, select: { id: true, code: true, pdf: true } });
  if (!c?.pdf) return new NextResponse('PDF non disponibile', { status: 404 });
  await audit(c.id, 'pdf_scaricato', { type: 'utente', id: user.id, label: `${user.name} <${user.email}>` }, await reqInfo());
  return new NextResponse(Buffer.from(c.pdf), { headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="${c.code}.pdf"`, 'cache-control': 'private, no-store' } });
}
