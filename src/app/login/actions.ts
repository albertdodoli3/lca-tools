'use server';
import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { createSession, destroySession } from '@/lib/auth';
import { rateLimit, reqInfo } from '@/lib/request';

export async function login(_: unknown, form: FormData) {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  const { ip } = await reqInfo();
  if (!rateLimit(`login:${ip}`, 10, 15 * 60_000) || !rateLimit(`login:${email}`, 5, 15 * 60_000)) return { error: 'Troppi tentativi. Riprova tra 15 minuti.' };
  const user = await db.user.findUnique({ where: { email } });
  const ok = user?.active && (await bcrypt.compare(password, user.passwordHash));
  if (!user || !ok) return { error: 'Email o password non corretti.' };
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user.id);
  redirect('/');
}

export async function logout() {
  await destroySession();
  redirect('/login');
}

export async function setupFirstAdmin(_: unknown, form: FormData) {
  if ((await db.user.count()) > 0) redirect('/login');
  const name = String(form.get('name') ?? '').trim();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Inserisci nome ed email validi.' };
  if (password.length < 12) return { error: 'La password deve avere almeno 12 caratteri.' };
  const user = await db.user.create({ data: { name, email, role: 'ADMIN', passwordHash: await bcrypt.hash(password, 12) } });
  await createSession(user.id);
  redirect('/');
}
