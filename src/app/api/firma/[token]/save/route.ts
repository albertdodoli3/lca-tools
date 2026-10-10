import { NextResponse } from 'next/server';
import { saveDraft } from '@/lib/contracts';
import { signerRoute } from '@/lib/signer-api';
import type { Values } from '@/lib/fields';

export const POST = signerRoute(
  async ({ contract, body }) => {
    if (contract.status !== 'SBLOCCATO') return NextResponse.json({ error: 'Contratto non modificabile' }, { status: 409 });
    await saveDraft(contract, (body.values ?? {}) as Values);
    return NextResponse.json({ ok: true });
  },
  { session: true },
);
