import 'server-only';
import { headers } from 'next/headers';

export type ReqInfo = { ip: string; userAgent: string };

export async function reqInfo(): Promise<ReqInfo> {
  const h = await headers();
  const fwd = h.get('x-forwarded-for')?.split(',')[0]?.trim();
  return { ip: fwd || h.get('x-real-ip') || 'sconosciuto', userAgent: (h.get('user-agent') ?? 'sconosciuto').slice(0, 400) };
}

// Limitatore semplice in memoria (sufficiente per una singola istanza).
const buckets = new Map<string, number[]>();
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    buckets.set(key, arr);
    return false;
  }
  arr.push(now);
  buckets.set(key, arr);
  return true;
}
