'use client';
import { forwardRef } from 'react';
import { DOC_CSS } from '@/lib/render';

export const DocPreview = forwardRef<HTMLDivElement, { html: string; className?: string }>(function DocPreview({ html, className }, ref) {
  return (
    <>
      <style>{DOC_CSS}</style>
      <div ref={ref} className={`doc ${className ?? ''}`} dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
});

/** Evidenzia e porta in vista il punto del documento dove compare il campo. */
export function focusKey(container: HTMLElement | null, key: string) {
  if (!container) return;
  container.querySelectorAll('.focus').forEach((el) => el.classList.remove('focus'));
  const els = container.querySelectorAll(`[data-key="${CSS.escape(key)}"]`);
  els.forEach((el) => el.classList.add('focus'));
  els[0]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
