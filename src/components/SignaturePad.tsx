'use client';
import { useEffect, useRef, useState } from 'react';
import type { SignatureValue } from '@/lib/fields';

type Props = { value?: SignatureValue; onChange: (v: SignatureValue | undefined) => void; defaultName?: string };

const W = 600;
const H = 180;

export function SignaturePad({ value, onChange, defaultName = '' }: Props) {
  const [mode, setMode] = useState<'disegnata' | 'digitata'>(value?.mode ?? 'disegnata');
  const [typed, setTyped] = useState(value?.name ?? defaultName);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);

  const ctx = () => {
    const c = canvas.current!.getContext('2d')!;
    c.lineWidth = 2.6;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.strokeStyle = '#11183c';
    return c;
  };

  const clear = () => {
    ctx().clearRect(0, 0, W, H);
    hasInk.current = false;
    onChange(undefined);
  };

  // Firma digitata: disegna il nome con un font calligrafico e lo converte in immagine
  useEffect(() => {
    if (mode !== 'digitata' || !canvas.current) return;
    let alive = true;
    document.fonts.load('56px "Dancing Script"').finally(() => {
      if (!alive || !canvas.current) return;
      const c = ctx();
      c.clearRect(0, 0, W, H);
      const name = typed.trim();
      if (!name) return onChange(undefined);
      let size = 64;
      do {
        c.font = `${size}px "Dancing Script", cursive`;
        size -= 4;
      } while (c.measureText(name).width > W - 40 && size > 20);
      c.fillStyle = '#11183c';
      c.textBaseline = 'middle';
      c.fillText(name, 20, H / 2);
      onChange({ image: canvas.current.toDataURL('image/png'), mode: 'digitata', name, at: new Date().toISOString() });
    });
    return () => {
      alive = false;
    };
  }, [mode, typed]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ripristina la firma salvata quando si torna allo step
  useEffect(() => {
    if (mode === 'disegnata' && value?.mode === 'disegnata' && canvas.current) {
      const img = new Image();
      img.onload = () => ctx().drawImage(img, 0, 0, W, H);
      img.src = value.image;
      hasInk.current = true;
    } else if (mode === 'disegnata') clear();
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const pos = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H] as const;
  };
  const down = (e: React.PointerEvent) => {
    if (mode !== 'disegnata') return;
    canvas.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    const [x, y] = pos(e);
    const c = ctx();
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + 0.1, y + 0.1);
    c.stroke();
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const [x, y] = pos(e);
    const c = ctx();
    c.lineTo(x, y);
    c.stroke();
    hasInk.current = true;
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (hasInk.current) onChange({ image: canvas.current!.toDataURL('image/png'), mode: 'disegnata', at: new Date().toISOString() });
  };

  return (
    <div>
      <div className="mb-2 flex rounded-lg bg-zinc-100 p-0.5 text-sm">
        {(['disegnata', 'digitata'] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)} className={`flex-1 rounded-md px-3 py-1.5 ${mode === m ? 'bg-white font-medium shadow-sm' : 'text-zinc-600'}`}>
            {m === 'disegnata' ? '✍️ Disegna la firma' : '⌨️ Scrivi il nome'}
          </button>
        ))}
      </div>
      {mode === 'digitata' && <input className="input mb-2" placeholder="Nome e cognome" value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Nome per la firma" />}
      <div className="relative rounded-lg bg-white ring-1 ring-zinc-300">
        <canvas
          ref={canvas}
          width={W}
          height={H}
          className={`block h-[150px] w-full touch-none ${mode === 'disegnata' ? 'cursor-crosshair' : ''}`}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          aria-label="Area firma"
        />
        <div className="pointer-events-none absolute bottom-6 left-6 right-6 border-b border-dashed border-zinc-300" />
        {mode === 'disegnata' && !value && <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-sm text-zinc-400">Firma qui con il dito o il mouse</span>}
      </div>
      {mode === 'disegnata' && (
        <button type="button" onClick={clear} className="mt-1 text-xs text-zinc-500 underline">Cancella e rifai</button>
      )}
    </div>
  );
}
