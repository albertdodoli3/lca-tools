import { NextResponse } from 'next/server';
import { requestOtp } from '@/lib/contracts';
import { signerRoute } from '@/lib/signer-api';

export const POST = signerRoute(
  async ({ contract, req }) => {
    const r = await requestOtp(contract, req);
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: 429 });
  },
  // anche dopo la firma serve l'OTP per scaricare la copia o recedere
  { allowClosed: false },
);
