'use server';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function createUser(_: unknown, f: FormData) {
  await requireAdmin();
  const name = String(f.get('name') ?? '').trim();
  const email = String(f.get('email') ?? '').trim().toLowerCase();
  const password = String(f.get('password') ?? '');
  const role = f.get('role') === 'ADMIN' ? 'ADMIN' : 'SELLER';
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Nome o email non validi' };
  if (password.length < 12) return { error: 'Password di almeno 12 caratteri' };
  if (await db.user.findUnique({ where: { email } })) return { error: 'Esiste già un utente con questa email' };
  await db.user.create({ data: { name, email, role, passwordHash: await bcrypt.hash(password, 12) } });
  revalidatePath('/utenti');
  return { ok: `Utente ${email} creato. Comunicagli la password in modo sicuro.` };
}

export async function toggleUser(id: string) {
  const me = await requireAdmin();
  if (id === me.id) return;
  const u = await db.user.findUniqueOrThrow({ where: { id } });
  await db.user.update({ where: { id }, data: { active: !u.active } });
  revalidatePath('/utenti');
}

export async function resetPassword(id: string, password: string) {
  await requireAdmin();
  if (password.length < 12) return { error: 'Password di almeno 12 caratteri' };
  await db.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(password, 12) } });
  return { ok: true };
}
