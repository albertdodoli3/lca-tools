import { NextResponse } from 'next/server';
import { withdraw } from '@/lib/contracts';
import { signerRoute } from '@/lib/signer-api';

export const POST = signerRoute(
  async ({ contract, req, body }) => {
    const r = await withdraw(contract, req, String(body.note ?? ''));
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: 400 });
  },
  { session: true },
);
