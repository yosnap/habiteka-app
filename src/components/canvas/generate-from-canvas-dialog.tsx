'use client';

/**
 * Mini-formulario para generar un diseño a partir del plano (CRL-4).
 *
 * El usuario elige objetivo, estilo y tipo de entregable aquí mismo (paridad con
 * la cualificación del chat, sin pasar por ella). Al confirmar, se envía el
 * documento ACTUAL del store a la Server Action, que lo serializa y rasteriza en
 * el servidor. Las opciones (estilos, entregables) vienen de la fuente única
 * `design-options` para no duplicar. Diálogo accesible (rol dialog + Escape).
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useCanvasStore } from '@/canvas/canvas-store';
import { serializeCanvas } from '@/canvas/serialize';
import { ENTREGABLES } from '@/lib/design-options';
import { StyleGallery } from './style-gallery';
import type { AgentOutcome } from '@/server/agent';
import type { DeliverableType, Estilo } from '@/lib/contracts';

interface Props {
  projectId: string;
  generateAction: (
    projectId: string,
    rawDoc: unknown,
    estilo: Estilo,
    entregable: DeliverableType,
    objetivo: string,
    promptLibre: string,
  ) => Promise<AgentOutcome>;
  onClose: () => void;
}

export function GenerateFromCanvasDialog({ projectId, generateAction, onClose }: Props) {
  const objectCount = useCanvasStore((s) => s.doc.objects.length);
  const [estilo, setEstilo] = useState<Estilo>('nordico');
  const [entregable, setEntregable] = useState<DeliverableType>('render3d');
  const [objetivo, setObjetivo] = useState('');
  const [promptLibre, setPromptLibre] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Tras generar, la IA puede devolver una explicación de sus decisiones. Si llega,
  // se muestra aquí y el usuario navega manualmente; si no, se navega directo.
  const [explanation, setExplanation] = useState<string | null>(null);
  const router = useRouter();

  const empty = objectCount === 0;

  const goToDeliverables = () => router.push(`/projects/${projectId}/deliverables`);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const rawDoc = serializeCanvas(useCanvasStore.getState().doc);
      const outcome = await generateAction(
        projectId,
        rawDoc,
        estilo,
        entregable,
        objetivo.trim(),
        promptLibre.trim(),
      );
      // Si la IA explicó sus decisiones, mostrarlas antes de salir; si no, ir al diseño.
      if (outcome.explanation) {
        setExplanation(outcome.explanation);
        setBusy(false);
      } else {
        goToDeliverables();
      }
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
      aria-label="Generar diseño desde el plano"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="bg-surface w-full max-w-sm rounded-card border border-line p-4 shadow-lg">
        <h2 className="text-ink mb-1 text-base font-medium">
          {explanation ? 'Diseño generado' : 'Generar diseño desde el plano'}
        </h2>
        <p className="text-ink-soft mb-3 text-xs">
          {explanation
            ? 'La IA preparó tu diseño y explica sus decisiones:'
            : 'La IA usará la disposición de tu plano como referencia para crear el diseño.'}
        </p>

        {explanation ? (
          <p className="text-ink bg-canvas mb-3 rounded-control border border-line p-3 text-sm">
            {explanation}
          </p>
        ) : empty ? (
          <p className="text-destructive mb-3 text-sm" role="alert">
            El plano está vacío. Añade muebles o estructura antes de generar.
          </p>
        ) : (
          <div className="mb-3 flex flex-col gap-3">
            <label className="text-ink-soft flex flex-col gap-1 text-sm">
              Objetivo (opcional)
              <input
                type="text"
                value={objetivo}
                onChange={(e) => setObjetivo(e.target.value)}
                disabled={busy}
                placeholder="p. ej. salón acogedor para recibir visitas"
                maxLength={200}
                className="border-line bg-surface rounded-control border px-2 py-1 text-sm disabled:opacity-50"
              />
            </label>
            <label className="text-ink-soft flex flex-col gap-1 text-sm">
              Instrucción libre (opcional)
              <textarea
                value={promptLibre}
                onChange={(e) => setPromptLibre(e.target.value)}
                disabled={busy}
                rows={2}
                placeholder="p. ej. haz la sala más cálida y añade plantas"
                maxLength={500}
                className="border-line bg-surface resize-none rounded-control border px-2 py-1 text-sm disabled:opacity-50"
              />
            </label>
            <div className="text-ink-soft flex flex-col gap-1 text-sm">
              Estilo
              <StyleGallery value={estilo} onChange={setEstilo} disabled={busy} />
            </div>
            <label className="text-ink-soft flex flex-col gap-1 text-sm">
              Entregable
              <select
                value={entregable}
                onChange={(e) => setEntregable(e.target.value as DeliverableType)}
                disabled={busy}
                className="border-line bg-surface rounded-control border px-2 py-1 text-sm disabled:opacity-50"
              >
                {ENTREGABLES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {error ? (
          <p className="text-destructive mb-3 text-xs" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          {explanation ? (
            <>
              <Button type="button" size="sm" variant="ghost" onClick={onClose}>
                Cerrar
              </Button>
              <Button type="button" size="sm" onClick={goToDeliverables}>
                Ver diseño
              </Button>
            </>
          ) : (
            <>
              <Button type="button" size="sm" variant="ghost" onClick={onClose} disabled={busy}>
                Cancelar
              </Button>
              <Button type="button" size="sm" onClick={generate} disabled={busy || empty}>
                {busy ? 'Generando…' : 'Generar'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
