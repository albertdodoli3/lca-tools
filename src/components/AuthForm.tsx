'use client';
import { useActionState } from 'react';

type Action = (prev: unknown, form: FormData) => Promise<{ error?: string } | undefined>;

export function AuthForm({ action, setup }: { action: Action; setup?: boolean }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-4">
      {setup && (
        <div>
          <label className="label" htmlFor="name">Nome e cognome</label>
          <input className="input" id="name" name="name" required autoComplete="name" />
        </div>
      )}
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input className="input" id="password" name="password" type="password" required minLength={setup ? 12 : 1} autoComplete={setup ? 'new-password' : 'current-password'} />
        {setup && <p className="mt-1 text-xs text-zinc-500">Almeno 12 caratteri.</p>}
      </div>
      {state?.error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? 'Attendere…' : setup ? 'Crea amministratore' : 'Accedi'}</button>
    </form>
  );
}
