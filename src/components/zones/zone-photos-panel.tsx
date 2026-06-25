'use client';

/**
 * Panel de fotos por zona (F2). Reutilizable: se monta en el asistente y en el plano.
 * Permite subir varias fotos del espacio a la zona activa, verlas como miniaturas y
 * elegir cuál es la ACTIVA (la referencia que usa el render por foto, F1 img2img).
 *
 * Carga la lista al montar (`useMountEffect`); tras subir o cambiar la activa, las
 * acciones devuelven la lista ya actualizada y se refresca el estado sin recargar.
 * La subida reusa `ImageUpload` (consentimiento RGPD + lectura a base64 en cliente).
 */
import { useState, useTransition } from 'react';
import { cn } from '@/lib/utils';
import { useMountEffect } from '@/lib/use-mount-effect';
import { ImageUpload, type UploadedImage } from '@/components/chat/image-upload';
import { ZONE_KINDS } from '@/lib/zone-kinds';
import {
  listZonePhotos,
  uploadZonePhoto,
  setActiveZonePhoto,
  type ZonePhoto,
} from '@/app/(app)/projects/[id]/_actions/zone-photos-actions';
import { listZones, setZoneKind } from '@/app/(app)/projects/[id]/_actions/zone-actions';

interface Props {
  projectId: string;
  /** Zona activa; null = flujo por defecto del proyecto. */
  zoneId?: string | null;
  /** Título opcional del panel (por defecto "Fotos del espacio"). */
  title?: string;
}

export function ZonePhotosPanel({ projectId, zoneId = null, title = 'Fotos del espacio' }: Props) {
  const [photos, setPhotos] = useState<ZonePhoto[]>([]);
  // Tipo de la zona (interior/exterior); solo aplica a zonas reales, no al plano por
  // defecto (zoneId null), que no tiene fila ProjectZone donde guardarlo.
  const [kind, setKind] = useState<string>('interior');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useMountEffect(() => {
    void listZonePhotos(projectId, zoneId)
      .then(setPhotos)
      .catch(() => setError('No se pudieron cargar las fotos.'));
    // El tipo vive en la fila de la zona; se resuelve de la lista de zonas (no hay
    // getter de una sola zona y el número de zonas por proyecto es bajo).
    if (zoneId) {
      void listZones(projectId)
        .then((zones) => setKind(zones.find((z) => z.id === zoneId)?.kind ?? 'interior'))
        .catch(() => {
          /* el tipo es un extra; su fallo no rompe el panel */
        });
    }
  });

  const onChangeKind = (next: string) => {
    if (!zoneId) return;
    setKind(next); // optimista: refleja la elección de inmediato
    setError(null);
    startTransition(async () => {
      try {
        await setZoneKind(projectId, zoneId, next);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo guardar el tipo de zona.');
      }
    });
  };

  const onUpload = (image: UploadedImage) => {
    setError(null);
    startTransition(async () => {
      try {
        setPhotos(await uploadZonePhoto(projectId, zoneId, image));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo subir la foto.');
      }
    });
  };

  const onPickActive = (photoId: string) => {
    setError(null);
    startTransition(async () => {
      try {
        setPhotos(await setActiveZonePhoto(projectId, zoneId, photoId));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo cambiar la foto activa.');
      }
    });
  };

  return (
    <div className="border-line bg-surface flex flex-col gap-2 rounded-control border p-3">
      <div className="flex items-center justify-between">
        <p className="text-ink text-sm font-medium">{title}</p>
        {photos.length > 0 ? (
          <span className="text-ink-soft text-xs">{photos.length} foto(s)</span>
        ) : null}
      </div>

      {zoneId ? (
        <label className="text-ink-soft flex items-center gap-2 text-xs">
          <span className="shrink-0">Tipo de espacio:</span>
          <select
            value={kind}
            disabled={pending}
            onChange={(e) => onChangeKind(e.target.value)}
            className="border-line bg-surface text-ink min-w-0 flex-1 rounded-control border px-2 py-1"
            title="Determina si el render se interpreta como interior o exterior"
          >
            {ZONE_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {photos.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                disabled={pending}
                onClick={() => onPickActive(p.id)}
                aria-pressed={p.active}
                title={p.active ? 'Foto activa (la usa el render)' : 'Usar como foto activa'}
                className={cn(
                  'relative block aspect-square w-full overflow-hidden rounded-control border-2 transition',
                  p.active ? 'border-brand-500' : 'border-line hover:border-brand-300',
                )}
              >
                {/* La miniatura es decorativa; el botón ya describe la acción. */}
                {p.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.url} alt="" className="size-full object-cover" />
                ) : (
                  <span className="text-ink-soft flex size-full items-center justify-center text-xs">
                    sin vista
                  </span>
                )}
                {p.active ? (
                  <span className="bg-brand-500 absolute bottom-0 left-0 right-0 py-0.5 text-center text-[10px] font-medium text-white">
                    Activa
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-soft text-xs">
          Aún no hay fotos en esta zona. Sube una para que el diseño parta de tu espacio real.
        </p>
      )}

      <ImageUpload onUpload={onUpload} disabled={pending} />
      {error ? <p className="text-danger text-xs">{error}</p> : null}
    </div>
  );
}
