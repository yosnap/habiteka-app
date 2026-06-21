'use client';

/**
 * Mini-formulario para generar un diseño a partir del lienzo (CRL-4).
 *
 * El usuario elige estilo y tipo de entregable aquí mismo (no necesita pasar por
 * la cualificación del chat). Al confirmar, se envía el documento ACTUAL del store
 * a la Server Action, que lo serializa y rasteriza en el servidor. Se construye
 * con `<select>` nativos estilados como el resto de la toolbar para no añadir
 * dependencias de UI; el panel es un diálogo accesible (rol dialog + Escape).
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useCanvasStore } from '@/canvas/canvas-store';
import { serializeCanvas } from '@/canvas/serialize';
import type { AgentOutcome } from '@/server/agent';
import type { DeliverableType, Estilo } from '@/lib/contracts';

const ESTILOS: Array<{ value: Estilo; label: string }> = [
  { value: 'nordico', label: 'Nórdico' },
  { value: 'moderno', label: 'Moderno' },
  { value: 'minimalista', label: 'Minimalista' },
  { value: 'clasico', label: 'Clásico' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'rustico', label: 'Rústico' },
  { value: 'mediterraneo', label: 'Mediterráneo' },
];

interface Props {
  projectId: string;
  generateAction: (
    projectId: string,
    rawDoc: unknown,
    estilo: Estilo,
    entregable: DeliverableType,
  ) => Promise<AgentOutcome>;
  onClose: () => void;
}

export function GenerateFromCanvasDialog({ projectId, generateAction, onClose }: Props) {
  const objectCount = useCanvasStore((s) => s.doc.objects.length);
  const [estilo, setEstilo] = useState<Estilo>('nordico');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const empty = objectCount === 0;

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const rawDoc = serializeCanvas(useCanvasStore.getState().doc);
      await generateAction(projectId, rawDoc, estilo, 'render3d');
      // El render se persiste como entregable: llevar al usuario a verlo.
      router.push(`/projects/${projectId}/deliverables`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el diseño.');
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label="Generar diseño desde el lienzo"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="bg-surface w-full max-w-sm rounded-[var(--radius-card)] border border-line p-4 shadow-lg">
        <h2 className="text-ink mb-1 text-base font-medium">Generar diseño desde el lienzo</h2>
        <p className="text-ink-soft mb-3 text-xs">
          La IA usará la disposición de tu lienzo como referencia para crear un render.
        </p>

        {empty ? (
          <p className="text-destructive mb-3 text-sm" role="alert">
            El lienzo está vacío. Añade muebles o estructura antes de generar.
          </p>
        ) : (
          <label className="text-ink-soft mb-3 flex flex-col gap-1 text-sm">
            Estilo
            <select
              value={estilo}
              onChange={(e) => setEstilo(e.target.value as Estilo)}
              disabled={busy}
              className="border-line bg-surface rounded-[var(--radius-control)] border px-2 py-1 text-sm disabled:opacity-50"
            >
              {ESTILOS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {error ? (
          <p className="text-destructive mb-3 text-xs" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="button" size="sm" onClick={generate} disabled={busy || empty}>
            {busy ? 'Generando…' : 'Generar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
