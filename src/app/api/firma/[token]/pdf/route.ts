import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { audit } from '@/lib/audit';
import { signerRoute } from '@/lib/signer-api';

export const GET = signerRoute(
  async ({ contract, req }) => {
    const c = await db.contract.findUnique({ where: { id: contract.id }, select: { pdf: true, code: true } });
    if (!c?.pdf) return NextResponse.json({ error: 'PDF non ancora disponibile' }, { status: 404 });
    await audit(contract.id, 'pdf_scaricato', { type: 'cliente' }, req);
    return new NextResponse(Buffer.from(c.pdf), { headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="${c.code}.pdf"`, 'cache-control': 'private, no-store' } });
  },
  { session: true },
);
