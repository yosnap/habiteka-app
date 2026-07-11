'use client';

/**
 * Diálogo "Plano desde boceto": el usuario sube la foto de un boceto (papel,
 * pizarra…), la IA extrae la geometría y el servidor devuelve un plano métrico
 * normalizado. Antes de tocar el canvas se muestra una previsualización con
 * aspecto de plano técnico (SVG determinista, sin IA); al aceptar, muros y
 * aberturas aterrizan como objetos EDITABLES del plano.
 */
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ImageUpload, type UploadedImage } from '@/components/chat/image-upload';
import { useCanvasStore } from '@/canvas/canvas-store';
import { planoToDoc } from '@/canvas/plano-to-doc';
import { planoToSvg } from '@/lib/plan-svg/geometry-to-svg';
import type { Plano2dPayload } from '@/lib/contracts';

interface Props {
  projectId: string;
  extractAction: (
    projectId: string,
    imageParts: { type: 'image_url'; base64: string; mimeType: string }[],
  ) => Promise<Plano2dPayload>;
  onClose: () => void;
}

export function SketchToPlanDialog({ projectId, extractAction, onClose }: Props) {
  const insertObjects = useCanvasStore((s) => s.insertObjects);
  const setScale = useCanvasStore((s) => s.setScale);
  const hasScale = useCanvasStore((s) => Boolean(s.doc.scale));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plano, setPlano] = useState<Plano2dPayload | null>(null);

  // Previsualización: el SVG es puro y determinista, se regenera solo si cambia el plano.
  const previewUrl = useMemo(() => {
    if (!plano) return null;
    const svg = planoToSvg(plano, { pxPerMeter: 80 });
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }, [plano]);

  const onUpload = async (image: UploadedImage) => {
    setBusy(true);
    setError(null);
    try {
      const result = await extractAction(projectId, [
        { type: 'image_url', base64: image.base64, mimeType: image.mimeType },
      ]);
      setPlano(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo analizar el boceto.');
    } finally {
      setBusy(false);
    }
  };

  /** Aterriza el plano como muros y aberturas editables del canvas. */
  const addToCanvas = () => {
    if (!plano) return;
    const { objects, scale } = planoToDoc(plano);
    insertObjects(objects);
    // Respeta la escala existente del doc; solo se fija si aún no hay una.
    if (!hasScale) setScale(scale);
    onClose();
  };

  const wallCount = plano ? plano.zones.reduce((n, z) => n + z.walls.length, 0) : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label="Plano desde boceto"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="bg-surface w-full max-w-md rounded-card border border-line p-4 shadow-lg">
        <h2 className="text-ink mb-1 flex items-center gap-2 text-base font-medium">
          Plano desde boceto
          <span className="bg-accent-soft text-accent rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase">
            Beta
          </span>
        </h2>
        <p className="text-ink-soft mb-3 text-xs">
          Sube la foto de un boceto en planta (dibujado a mano vale) y lo convertiremos en un
          plano técnico con muros y aberturas editables.
        </p>

        {plano === null ? (
          <div className="mb-3">
            <ImageUpload onUpload={onUpload} disabled={busy} />
            {busy ? <p className="text-ink-soft mt-2 text-xs">Analizando el boceto…</p> : null}
          </div>
        ) : (
          <div className="mb-3">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- SVG generado en memoria (data URL), no un asset optimizable.
              <img
                src={previewUrl}
                alt="Previsualización del plano generado"
                className="border-line max-h-72 w-full rounded-control border bg-white object-contain"
              />
            ) : null}
            <p className="text-ink-soft mt-2 text-xs">
              {wallCount} muros reconocidos. Se añadirán al plano como objetos editables; podrás
              ajustar cada muro y abertura.
            </p>
          </div>
        )}

        {error ? (
          <p className="text-destructive mb-3 text-xs" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={onClose} disabled={busy}>
            {plano ? 'Cancelar' : 'Cerrar'}
          </Button>
          {plano ? (
            <Button type="button" size="sm" onClick={addToCanvas}>
              Añadir al plano
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
