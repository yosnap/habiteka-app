'use client';

/**
 * Bandas de fiabilidad de Jev, editables sin desplegar: por encima de «seguir
 * solo» la plataforma continúa; entre ambas pide confirmación; por debajo de
 * «pedir confirmación» bloquea y manda a corregir el plano.
 */
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { adminUpdateSystemSetting } from '@/server/admin/config/actions';

interface Props { proceed: number; confirm: number; }

export function QualityThresholdsForm({ proceed: initialProceed, confirm: initialConfirm }: Props) {
  const [proceed, setProceed] = useState(String(initialProceed));
  const [confirm, setConfirm] = useState(String(initialConfirm));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () => {
    setError(null);
    setMessage(null);
    start(async () => {
      try {
        await adminUpdateSystemSetting('quality_thresholds', {
          proceed: Number(proceed),
          confirm: Number(confirm),
        });
        setMessage('Umbrales guardados.');
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'No se pudieron guardar los umbrales');
      }
    });
  };

  return <div className="flex max-w-lg flex-col gap-3 rounded-card border border-line p-4">
    <div><h2 className="font-medium">Umbrales de calidad (Jev)</h2><p className="text-muted-foreground text-sm">Por encima de «seguir solo» se continúa sin preguntar; por debajo de «pedir confirmación» se bloquea y se manda a corregir.</p></div>
    <label className="text-sm">Seguir solo a partir de (%)<input className="border-line bg-surface mt-1 w-full rounded-control border px-2 py-1" type="number" min={0} max={100} value={proceed} onChange={(event) => setProceed(event.target.value)} /></label>
    <label className="text-sm">Pedir confirmación a partir de (%)<input className="border-line bg-surface mt-1 w-full rounded-control border px-2 py-1" type="number" min={0} max={100} value={confirm} onChange={(event) => setConfirm(event.target.value)} /></label>
    <Button type="button" size="sm" className="w-fit" disabled={pending} onClick={submit}>{pending ? 'Guardando…' : 'Guardar umbrales'}</Button>
    {message && <p className="text-muted-foreground text-sm">{message}</p>}
    {error && <p className="text-sm text-[--color-danger]">{error}</p>}
  </div>;
}
