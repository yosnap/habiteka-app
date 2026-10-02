'use client';

/**
 * Botón "Usar como fondo del lienzo": trae un render generado al editor.
 *
 * El render y el editor son páginas distintas del mismo proyecto y el store del
 * canvas se rehidrata desde el servidor al navegar. Por eso el flujo es:
 * 1) medir el tamaño natural de la imagen en cliente (lo necesita la capa de
 *    fondo para escalar manteniendo proporción),
 * 2) persistir el `baseImage` en el canvas vía Server Action,
 * 3) navegar al editor, que ya hidrata el fondo guardado.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { applyBaseImageToCanvas } from '@/server/actions/canvas';
import { applyRenderBackdrop } from '@/server/editor/render-backdrop-actions';

interface Props {
  projectId: string;
  assetUrl: string;
  /** Zona que originó el diseño; el fondo se aplica a SU plano (null = por defecto). */
  zoneId?: string | null;
  deliverableId?: string;
}

// Mide el ancho/alto natural de una imagen sin insertarla en el DOM.
function measureNaturalSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('No se pudo cargar la imagen del render'));
    img.src = url;
  });
}

export function UseAsBackgroundButton({ projectId, assetUrl, zoneId = null, deliverableId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = async () => {
    setBusy(true);
    setError(null);
    try {
      const { width, height } = await measureNaturalSize(assetUrl);
      const native = deliverableId ? await applyRenderBackdrop({ projectId, zoneId }, deliverableId, width / height) : false;
      if (!native) await applyBaseImageToCanvas(projectId, { url: assetUrl, width, height }, zoneId);
      // Abre el editor en la zona del diseño (sin zona, el plano por defecto).
      const href = `/projects/${encodeURIComponent(projectId)}${zoneId ? `?zona=${encodeURIComponent(zoneId)}` : ''}`;
      if (native) window.location.assign(href); else router.push(href);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo aplicar el render como fondo. Inténtalo de nuevo.');
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" size="sm" onClick={apply} disabled={busy}>
        {busy ? 'Aplicando…' : 'Usar como fondo del plano'}
      </Button>
      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
