import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { AuthForm } from '@/components/AuthForm';
import { AuthShell } from '@/components/AuthShell';
import { login } from './actions';

export default async function LoginPage() {
  if ((await db.user.count()) === 0) redirect('/setup');
  if (await currentUser()) redirect('/');
  return (
    <AuthShell title="Gestione contratti" subtitle="Accedi con il tuo account aziendale">
      <AuthForm action={login} />
    </AuthShell>
  );
}
