import 'server-only';
import type { Prisma } from '@prisma/client';
import { db } from './db';
import { sha256 } from './crypto';
import type { ReqInfo } from './request';

type Actor = { type: 'utente' | 'cliente' | 'sistema'; id?: string; label?: string };

type Tx = Prisma.TransactionClient;

/** JSON con chiavi ordinate: Postgres (jsonb) non conserva l'ordine delle chiavi. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + stable((v as Record<string, unknown>)[k])).join(',') + '}';
  return JSON.stringify(v ?? null);
}

/** Aggiunge un evento al registro, concatenandolo all'hash del precedente. */
export async function audit(contractId: string, type: string, actor: Actor, req?: ReqInfo | null, data: Record<string, unknown> = {}, tx?: Tx) {
  const run = async (t: Tx) => {
    // Lock per contratto: evita due eventi con lo stesso prevHash in caso di richieste simultanee
    await t.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${contractId}))`;
    const prev = await t.auditEvent.findFirst({ where: { contractId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { hash: true } });
    const prevHash = prev?.hash ?? 'GENESIS';
    const createdAt = new Date();
    const body = { contractId, type, actorType: actor.type, actorId: actor.id ?? null, actorLabel: actor.label ?? null, ip: req?.ip ?? null, userAgent: req?.userAgent ?? null, data, createdAt: createdAt.toISOString() };
    const hash = sha256(prevHash + stable(body));
    return t.auditEvent.create({
      data: { contractId, type, actorType: actor.type, actorId: actor.id, actorLabel: actor.label, ip: req?.ip, userAgent: req?.userAgent, data: data as Prisma.InputJsonValue, createdAt, prevHash, hash },
    });
  };
  return tx ? run(tx) : db.$transaction(run);
}

/** Ricalcola la catena e indica se il registro è integro. */
export async function verifyAuditChain(contractId: string): Promise<boolean> {
  const events = await db.auditEvent.findMany({ where: { contractId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  let prev = 'GENESIS';
  for (const e of events) {
    const body = { contractId, type: e.type, actorType: e.actorType, actorId: e.actorId, actorLabel: e.actorLabel, ip: e.ip, userAgent: e.userAgent, data: e.data, createdAt: e.createdAt.toISOString() };
    if (e.prevHash !== prev || sha256(prev + stable(body)) !== e.hash) return false;
    prev = e.hash;
  }
  return true;
}
