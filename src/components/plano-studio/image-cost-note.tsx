'use client';

/**
 * Autorización del coste real de generar una imagen desde el estudio del plano: el
 * precio por imagen del modelo principal de «Render 3D». No descuenta créditos de la
 * app, pero el proveedor sí lo cobra. Sin marcarla no se genera.
 */
import { useState } from 'react';
import { useMountEffect } from '@/lib/use-mount-effect';
import { callAction } from '@/lib/action-result';
import { imageGenerationQuote } from '@/app/(app)/projects/[id]/_actions/plan-redraw-actions';

export function ImageCostNote({ projectId, authorized, onAuthorizedChange, disabled = false }: {
  projectId: string; authorized: boolean; onAuthorizedChange: (value: boolean) => void; disabled?: boolean;
}) {
  const [quote, setQuote] = useState<{ label: string; priceUsd: number } | null>(null);
  const [failed, setFailed] = useState(false);
  useMountEffect(() => {
    void callAction(imageGenerationQuote(projectId)).then(setQuote).catch(() => setFailed(true));
  });
  const text = quote
    ? `Autorizo 1 imagen, unos ${quote.priceUsd.toFixed(2).replace(".", ",")} USD con ${quote.label}, más su revisión con IA de visión. Si el modelo falla, puede usarse un respaldo de «Modelos por uso» con su propio precio.`
    : failed ? 'Autorizo generar una imagen con IA, con el coste del modelo de «Render 3D» configurado.' : 'Calculando el coste…';
  return <label className="text-ink-soft mt-2 flex items-start gap-2 text-xs">
    <input type="checkbox" checked={authorized} disabled={disabled || (!quote && !failed)}
      onChange={(event) => onAuthorizedChange(event.target.checked)} />
    <span>{text}</span>
  </label>;
}
