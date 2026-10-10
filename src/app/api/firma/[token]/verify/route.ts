import { NextResponse } from 'next/server';
import { verifyOtp } from '@/lib/contracts';
import { createSignerSession } from '@/lib/auth';
import { signerRoute } from '@/lib/signer-api';

export const POST = signerRoute(async ({ contract, tokenHash, req, body }) => {
  const r = await verifyOtp(contract, String(body.code ?? ''), req);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  await createSignerSession(contract.id, tokenHash);
  return NextResponse.json({ ok: true });
});
