'use client';
import { useActionState } from 'react';
import { createUser, resetPassword } from './actions';

export function UserForm() {
  const [state, action, pending] = useActionState(createUser, undefined);
  return (
    <form action={action} className="card grid gap-4 p-5 sm:grid-cols-2">
      <h2 className="font-semibold sm:col-span-2">Aggiungi utente</h2>
      <div><label className="label" htmlFor="name">Nome</label><input className="input" id="name" name="name" required /></div>
      <div><label className="label" htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" required /></div>
      <div><label className="label" htmlFor="password">Password iniziale</label><input className="input" id="password" name="password" type="password" minLength={12} required /></div>
      <div>
        <label className="label" htmlFor="role">Ruolo</label>
        <select className="input" id="role" name="role" defaultValue="SELLER"><option value="SELLER">Venditore</option><option value="ADMIN">Amministratore</option></select>
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button className="btn-primary" disabled={pending}>Crea utente</button>
        {state?.ok && <span className="text-sm text-emerald-700">{state.ok}</span>}
        {state?.error && <span className="text-sm text-rose-700">{state.error}</span>}
      </div>
    </form>
  );
}

export function ResetButton({ id }: { id: string }) {
  return (
    <button
      className="btn-ghost text-xs"
      onClick={async () => {
        const p = prompt('Nuova password (almeno 12 caratteri):');
        if (!p) return;
        const r = await resetPassword(id, p);
        alert(r.error ?? 'Password aggiornata');
      }}
    >
      Reimposta password
    </button>
  );
}
