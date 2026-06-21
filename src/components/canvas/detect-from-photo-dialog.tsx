'use client';

/**
 * Diálogo "Detectar desde foto" (F5, BETA): el usuario sube una foto/boceto, la
 * IA detecta elementos con su posición y se proponen para poblar el plano como
 * objetos editables. Reusa la subida de imagen del chat (gestión de consentimiento
 * incluida) y el store del plano. Marcado BETA: la detección sobre foto en
 * perspectiva es imprecisa; funciona mejor con planos en planta.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ImageUpload, type UploadedImage } from '@/components/chat/image-upload';
import { useCanvasStore } from '@/canvas/canvas-store';
import { detectedToObjects } from '@/canvas/detected-layout';
import { CATALOG_BY_KIND } from '@/canvas/catalog';
import type { DetectedObject } from '@/lib/contracts';

// Tamaño de referencia del plano al mapear las bbox normalizadas a píxeles. El
// usuario reposiciona luego; lo importante es la disposición relativa.
const STAGE_REF_WIDTH = 900;
const STAGE_REF_HEIGHT = 600;

interface Props {
  projectId: string;
  detectAction: (
    projectId: string,
    imageParts: { type: 'image_url'; base64: string; mimeType: string }[],
  ) => Promise<DetectedObject[]>;
  onClose: () => void;
}

export function DetectFromPhotoDialog({ projectId, detectAction, onClose }: Props) {
  const insertObjects = useCanvasStore((s) => s.insertObjects);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detected, setDetected] = useState<DetectedObject[] | null>(null);

  const onUpload = async (image: UploadedImage) => {
    setBusy(true);
    setError(null);
    try {
      const recs = await detectAction(projectId, [
        { type: 'image_url', base64: image.base64, mimeType: image.mimeType },
      ]);
      setDetected(recs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo analizar la imagen.');
    } finally {
      setBusy(false);
    }
  };

  /** Añade todos los elementos detectados como objetos editables del plano. */
  const addAll = () => {
    if (!detected?.length) return;
    insertObjects(detectedToObjects(detected, STAGE_REF_WIDTH, STAGE_REF_HEIGHT));
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label="Detectar desde foto"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="bg-surface w-full max-w-sm rounded-card border border-line p-4 shadow-lg">
        <h2 className="text-ink mb-1 flex items-center gap-2 text-base font-medium">
          Detectar desde foto
          <span className="bg-accent-soft text-accent rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase">
            Beta
          </span>
        </h2>
        <p className="text-ink-soft mb-3 text-xs">
          Sube una foto o plano y la IA detectará sus elementos para poblar el plano. Funciona mejor
          con planos en planta (vista cenital); revisa y corrige lo detectado antes de generar.
        </p>

        {detected === null ? (
          <div className="mb-3">
            <ImageUpload onUpload={onUpload} disabled={busy} />
          </div>
        ) : detected.length === 0 ? (
          <p className="text-ink-soft mb-3 text-sm">
            No se detectaron elementos. Prueba con un plano en planta más nítido.
          </p>
        ) : (
          <div className="mb-3">
            <p className="text-ink-soft mb-2 text-xs">
              Detectados {detected.length} elementos. Se añadirán al plano para que los ajustes:
            </p>
            <ul className="flex flex-wrap gap-1">
              {detected.map((d, i) => (
                <li
                  key={`${d.kind}-${i}`}
                  className="border-line text-ink rounded-control border px-2 py-0.5 text-xs"
                >
                  {CATALOG_BY_KIND[d.kind]?.label ?? d.kind}
                </li>
              ))}
            </ul>
          </div>
        )}

        {error ? (
          <p className="text-destructive mb-3 text-xs" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={onClose} disabled={busy}>
            {detected ? 'Cancelar' : 'Cerrar'}
          </Button>
          {detected && detected.length > 0 ? (
            <Button type="button" size="sm" onClick={addAll}>
              Añadir al plano
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
