import 'server-only';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto';

function secret(): string {
  const s = process.env.APP_SECRET;
  if (!s || s.length < 32) throw new Error('APP_SECRET mancante o troppo corto (min 32 caratteri)');
  return s;
}

export const sha256 = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');

export const hmac = (data: string, key = secret()) => createHmac('sha256', key).update(data).digest('hex');

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

/** Hash del token del link: in DB non salviamo mai il token in chiaro per la ricerca. */
export const hashToken = (token: string) => hmac('link:' + token);

export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export const hashOtp = (contractId: string, code: string) => hmac(`otp:${contractId}:${code}`);

export function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

function aesKey() {
  return createHash('sha256').update('enc:' + secret()).digest();
}

export function encrypt(plain: string): string {
  if (!plain) return '';
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', aesKey(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64url')).join('.');
}

export function decrypt(payload: string): string {
  if (!payload) return '';
  const [iv, tag, enc] = payload.split('.').map((p) => Buffer.from(p, 'base64url'));
  const d = createDecipheriv('aes-256-gcm', aesKey(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}
