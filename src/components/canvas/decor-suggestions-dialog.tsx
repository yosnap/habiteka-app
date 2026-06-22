'use client';

/**
 * Diálogo de sugerencias de decoración (F4).
 *
 * Pide a la IA recomendaciones de elementos del catálogo para el plano actual y
 * las lista con su motivo. El usuario ACEPTA (se añade el objeto al plano, con el
 * tamaño por defecto del catálogo en la posición sugerida) o RECHAZA cada una.
 * Reusa el store y las formas del catálogo (F-CAT): las sugerencias aceptadas
 * quedan como objetos editables. Diálogo accesible (rol dialog + Escape).
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useCanvasStore } from '@/canvas/canvas-store';
import { serializeCanvas } from '@/canvas/serialize';
import { CATALOG_BY_KIND } from '@/canvas/catalog';
import { ESTILOS } from '@/lib/design-options';
import type { DecorRecommendation, Estilo } from '@/lib/contracts';

interface Props {
  projectId: string;
  recommendAction: (
    projectId: string,
    rawDoc: unknown,
    estilo: Estilo,
    objetivo: string,
  ) => Promise<DecorRecommendation[]>;
  onClose: () => void;
}

export function DecorSuggestionsDialog({ projectId, recommendAction, onClose }: Props) {
  const objectCount = useCanvasStore((s) => s.doc.objects.length);
  const addObject = useCanvasStore((s) => s.addObject);
  const [estilo, setEstilo] = useState<Estilo>('nordico');
  const [objetivo, setObjetivo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // null = aún no se pidió; [] = se pidió y no hubo sugerencias.
  const [suggestions, setSuggestions] = useState<DecorRecommendation[] | null>(null);

  const empty = objectCount === 0;

  const ask = async () => {
    setBusy(true);
    setError(null);
    try {
      const rawDoc = serializeCanvas(useCanvasStore.getState().doc);
      const recs = await recommendAction(projectId, rawDoc, estilo, objetivo.trim());
      setSuggestions(recs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron obtener sugerencias.');
    } finally {
      setBusy(false);
    }
  };

  /** Acepta una sugerencia: la añade como objeto del plano y la quita de la lista. */
  const accept = (rec: DecorRecommendation, index: number) => {
    const entry = CATALOG_BY_KIND[rec.kind];
    if (!entry) return;
    addObject({
      id: `obj-sugerido-${globalThis.crypto.randomUUID()}`,
      kind: rec.kind,
      x: rec.x,
      y: rec.y,
      width: entry.defaultWidth,
      height: entry.defaultHeight,
      rotation: 0,
    });
    reject(index);
  };

  /** Rechaza (descarta) una sugerencia sin tocar el plano. */
  const reject = (index: number) => {
    setSuggestions((prev) => prev?.filter((_, i) => i !== index) ?? null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label="Sugerir decoración"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="bg-surface w-full max-w-sm rounded-card border border-line p-4 shadow-lg">
        <h2 className="text-ink mb-1 text-base font-medium">Sugerir decoración</h2>
        <p className="text-ink-soft mb-3 text-xs">
          La IA propondrá elementos para tu plano. Acepta los que te gusten y se añadirán como
          objetos editables.
        </p>

        {empty ? (
          <p className="text-destructive mb-3 text-sm" role="alert">
            El plano está vacío. Añade muros o muebles antes de pedir sugerencias.
          </p>
        ) : suggestions === null ? (
          <div className="mb-3 flex flex-col gap-3">
            <label className="text-ink-soft flex flex-col gap-1 text-sm">
              Objetivo (opcional)
              <input
                type="text"
                value={objetivo}
                onChange={(e) => setObjetivo(e.target.value)}
                disabled={busy}
                placeholder="p. ej. sala acogedora para recibir visitas"
                maxLength={200}
                className="border-line bg-surface rounded-control border px-2 py-1 text-sm disabled:opacity-50"
              />
            </label>
            <label className="text-ink-soft flex flex-col gap-1 text-sm">
              Estilo
              <select
                value={estilo}
                onChange={(e) => setEstilo(e.target.value as Estilo)}
                disabled={busy}
                className="border-line bg-surface rounded-control border px-2 py-1 text-sm disabled:opacity-50"
              >
                {ESTILOS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : suggestions.length === 0 ? (
          <p className="text-ink-soft mb-3 text-sm">
            La IA no propuso elementos nuevos para este plano.
          </p>
        ) : (
          <ul className="mb-3 flex flex-col gap-2">
            {suggestions.map((rec, i) => (
              <li
                key={`${rec.kind}-${i}`}
                className="border-line flex items-start justify-between gap-2 rounded-control border p-2"
              >
                <div className="min-w-0">
                  <p className="text-ink text-sm font-medium">
                    {CATALOG_BY_KIND[rec.kind]?.label ?? rec.kind}
                  </p>
                  <p className="text-ink-soft text-xs">{rec.motivo}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button type="button" size="sm" onClick={() => accept(rec, i)}>
                    Añadir
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => reject(i)}>
                    Descartar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {error ? (
          <p className="text-destructive mb-3 text-xs" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={onClose} disabled={busy}>
            {suggestions ? 'Cerrar' : 'Cancelar'}
          </Button>
          {suggestions === null ? (
            <Button type="button" size="sm" onClick={ask} disabled={busy || empty}>
              {busy ? 'Pensando…' : 'Sugerir'}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
