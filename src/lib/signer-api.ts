import 'server-only';
import { NextResponse } from 'next/server';
import { findByToken, type TokenLookup } from './contracts';
import { hasSignerSession } from './auth';
import { rateLimit, reqInfo, type ReqInfo } from './request';

type Handler = (ctx: TokenLookup & { req: ReqInfo; body: Record<string, unknown> }) => Promise<NextResponse>;

/** Wrapper comune per le API del firmatario: token valido, limiti di frequenza e (se richiesto) sessione OTP. */
export function signerRoute(handler: Handler, opts: { session?: boolean; allowClosed?: boolean } = {}) {
  return async (request: Request, { params }: { params: Promise<{ token: string }> }) => {
    const { token } = await params;
    const req = await reqInfo();
    if (!rateLimit(`firma:${req.ip}`, 60, 60_000)) return NextResponse.json({ error: 'Troppe richieste, riprova tra poco.' }, { status: 429 });
    // Protezione CSRF: le richieste devono provenire dalla stessa origine
    const origin = request.headers.get('origin');
    if (origin && new URL(origin).host !== request.headers.get('host')) return NextResponse.json({ error: 'Origine non valida' }, { status: 403 });
    const found = await findByToken(token);
    if (!found) return NextResponse.json({ error: 'Link non valido.' }, { status: 404 });
    if (found.problem && !opts.allowClosed) return NextResponse.json({ error: found.problem === 'scaduto' ? 'Il link è scaduto.' : 'Il contratto non è più disponibile.' }, { status: 410 });
    if (opts.session && !(await hasSignerSession(found.contract.id, found.tokenHash))) return NextResponse.json({ error: 'Sessione scaduta: verifica di nuovo il codice OTP.', relogin: true }, { status: 401 });
    let body: Record<string, unknown> = {};
    if (request.method === 'POST') {
      const text = await request.text();
      if (text.length > 1_500_000) return NextResponse.json({ error: 'Richiesta troppo grande' }, { status: 413 });
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        return NextResponse.json({ error: 'Richiesta non valida' }, { status: 400 });
      }
    }
    return handler({ ...found, req, body });
  };
}
