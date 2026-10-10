import 'server-only';
import { cache } from 'react';
import { db } from './db';

export const getSettings = cache(async () => {
  return (await db.settings.findUnique({ where: { id: 1 } })) ?? (await db.settings.create({ data: { id: 1 } }));
});

export function appUrl() {
  return (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}

/** "#9b2c55" -> "155 44 85" per le variabili CSS di Tailwind. */
export function hexToRgbTriplet(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = parseInt(m ? m[1] : '9b2c55', 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}
