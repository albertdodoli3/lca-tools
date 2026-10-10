import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignJWT, jwtVerify } from 'jose';
import type { User } from '@prisma/client';
import { db } from './db';

const COOKIE = 'lca_session';
const key = () => new TextEncoder().encode('session:' + process.env.APP_SECRET);
const secure = () => (process.env.APP_URL ?? '').startsWith('https://');

export async function createSession(userId: string) {
  const jwt = await new SignJWT({ sub: userId }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('12h').sign(key());
  (await cookies()).set(COOKIE, jwt, { httpOnly: true, sameSite: 'lax', secure: secure(), path: '/', maxAge: 60 * 60 * 12 });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    const user = await db.user.findUnique({ where: { id: String(payload.sub) } });
    return user?.active ? user : null;
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) redirect('/login');
  return u;
}

export async function requireAdmin(): Promise<User> {
  const u = await requireUser();
  if (u.role !== 'ADMIN') redirect('/');
  return u;
}

/** Filtro sui contratti visibili: il venditore vede solo i propri. */
export function contractScope(u: User) {
  return u.role === 'ADMIN' ? {} : { ownerId: u.id };
}

// --- Sessione del firmatario (dopo verifica OTP) ---
const signKey = () => new TextEncoder().encode('signer:' + process.env.APP_SECRET);
const signCookie = (contractId: string) => `lca_sign_${contractId}`;

export async function createSignerSession(contractId: string, tokenHash: string) {
  const jwt = await new SignJWT({ c: contractId, t: tokenHash }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('2h').sign(signKey());
  (await cookies()).set(signCookie(contractId), jwt, { httpOnly: true, sameSite: 'strict', secure: secure(), path: '/', maxAge: 60 * 60 * 2 });
}

export async function hasSignerSession(contractId: string, tokenHash: string): Promise<boolean> {
  const token = (await cookies()).get(signCookie(contractId))?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, signKey());
    return payload.c === contractId && payload.t === tokenHash;
  } catch {
    return false;
  }
}
