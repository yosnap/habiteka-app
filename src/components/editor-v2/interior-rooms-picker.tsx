'use client';

/**
 * Elige de qué estancias se quiere una vista interior realista (una imagen por
 * estancia, cobrada por imagen). Vive aparte del diálogo de generación porque
 * ese fichero ya es grande y esta lista tiene su propia lógica de selección.
 */
import type { RoomInteriorCamera } from '@/lib/editor-document/room-interior-cameras';
import { CheckToggle } from '@/components/ui/check-toggle';

interface Props {
  cameras: RoomInteriorCamera[];
  selected: string[];
  disabled?: boolean;
  onChange: (roomIds: string[]) => void;
}

export function InteriorRoomsPicker({ cameras, selected, disabled, onChange }: Props) {
  if (!cameras.length)
    return (
      <p className="bg-canvas text-muted-foreground rounded-control p-2 text-xs">
        Este plano aún no tiene estancias cerradas. Cierra los muros en el editor para poder
        generar vistas interiores.
      </p>
    );

  const toggle = (roomId: string) =>
    onChange(
      selected.includes(roomId)
        ? selected.filter((item) => item !== roomId)
        : [...selected, roomId],
    );

  return (
    <div className="mt-2 grid gap-1 sm:grid-cols-2">
      {cameras.map((camera) => (
        <CheckToggle key={camera.roomId}
            checked={selected.includes(camera.roomId)}
            disabled={disabled}
            onChange={() => toggle(camera.roomId)}
          label={<span>
            {camera.name}{' '}
            <span className="text-muted-foreground">
              · {camera.areaM2.toFixed(1)} m²{camera.habitable ? '' : ' · paso o hueco'}
            </span>
          </span>} />
      ))}
    </div>
  );
}

export default InteriorRoomsPicker;
