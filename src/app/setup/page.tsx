import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { AuthForm } from '@/components/AuthForm';
import { AuthShell } from '@/components/AuthShell';
import { setupFirstAdmin } from '../login/actions';

export default async function SetupPage() {
  if ((await db.user.count()) > 0) redirect('/login');
  return (
    <AuthShell title="Benvenuto" subtitle="Crea il primo account amministratore">
      <AuthForm action={setupFirstAdmin} setup />
    </AuthShell>
  );
}
