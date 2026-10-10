import { NextResponse } from 'next/server';
import { signContract } from '@/lib/contracts';
import { signerRoute } from '@/lib/signer-api';
import type { Values } from '@/lib/fields';

export const POST = signerRoute(
  async ({ contract, req, body }) => {
    if (body.readConfirmed !== true) return NextResponse.json({ error: 'Conferma di aver letto il contratto.' }, { status: 400 });
    const r = await signContract(contract, (body.values ?? {}) as Values, req);
    if (!r.ok) return NextResponse.json({ error: r.error ?? 'Controlla i campi evidenziati.', errors: r.errors }, { status: 400 });
    return NextResponse.json({ ok: true });
  },
  { session: true },
);
