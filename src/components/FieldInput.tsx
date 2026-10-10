'use client';
import type { FieldDef } from '@/lib/fields';

type Props = {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  onFocus?: () => void;
  error?: string;
  disabled?: boolean;
  /** se true la casella mostra l'etichetta lunga accanto */
  compact?: boolean;
};

export function FieldInput({ field: f, value, onChange, onFocus, error, disabled }: Props) {
  const id = `f-${f.key}`;
  const label = (
    <span>
      {f.label}
      {f.required && <span className="text-rose-600"> *</span>}
    </span>
  );
  if (f.type === 'checkbox') {
    return (
      <div>
        <label htmlFor={id} className={`flex cursor-pointer items-start gap-3 rounded-lg p-3 text-sm ring-1 ${value === true ? 'bg-brand-soft ring-brand' : 'ring-zinc-200'} ${error ? 'ring-rose-400' : ''}`}>
          <input id={id} type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-[rgb(var(--brand))]" checked={value === true} onChange={(e) => onChange(e.target.checked)} onFocus={onFocus} disabled={disabled} />
          <span className="leading-relaxed">
            {label}
            {f.help && <span className="mt-1 block text-xs text-zinc-500">{f.help}</span>}
          </span>
        </label>
        {error && <p className="err">{error}</p>}
      </div>
    );
  }
  const common = { id, disabled, onFocus, className: `input ${error ? 'ring-rose-400' : ''}`, 'aria-invalid': !!error };
  const str = typeof value === 'string' ? value : value == null ? '' : String(value);
  let control: React.ReactNode;
  switch (f.type) {
    case 'textarea':
      control = <textarea {...common} rows={3} value={str} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'choice':
      control = (
        <div className="flex flex-wrap gap-2">
          {(f.options ?? []).map((o) => (
            <label key={o} className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm ring-1 ${str === o ? 'bg-brand text-white ring-brand' : 'bg-white ring-zinc-300'}`}>
              <input type="radio" className="sr-only" name={id} checked={str === o} onChange={() => onChange(o)} onFocus={onFocus} disabled={disabled} />
              {o}
            </label>
          ))}
        </div>
      );
      break;
    case 'select':
      control = (
        <select {...common} value={str} onChange={(e) => onChange(e.target.value)}>
          <option value="">— seleziona —</option>
          {(f.options ?? []).map((o) => <option key={o}>{o}</option>)}
        </select>
      );
      break;
    default: {
      const type = f.type === 'date' ? 'date' : f.type === 'email' ? 'email' : f.type === 'phone' ? 'tel' : 'text';
      const inputMode = f.type === 'number' || f.type === 'cap' ? 'numeric' : f.type === 'currency' ? 'decimal' : undefined;
      control = (
        <div className="relative">
          {f.type === 'currency' && <span className="pointer-events-none absolute left-3 top-2 text-sm text-zinc-500">€</span>}
          <input {...common} className={`${common.className} ${f.type === 'currency' ? 'pl-7' : ''} ${f.type === 'cf' ? 'uppercase' : ''}`} type={type} inputMode={inputMode} value={str} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete(f.key)} />
        </div>
      );
    }
  }
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      {control}
      {f.help && <p className="mt-1 text-xs text-zinc-500">{f.help}</p>}
      {error && <p className="err">{error}</p>}
    </div>
  );
}

function autoComplete(key: string) {
  if (key.includes('nome_cognome')) return 'name';
  if (key.includes('email')) return 'email';
  if (key.includes('telefono')) return 'tel';
  if (key.endsWith('_cap')) return 'postal-code';
  if (key.includes('indirizzo')) return 'address-line1';
  if (key.includes('data_nascita')) return 'bday';
  return 'off';
}
