'use client';

import { useMemo } from 'react';
import type { EditorDocument } from '@/lib/editor-document/schema';
import type { RenderDesignOptions } from '@/lib/editor-document/render-design-options';
import { deriveRoomsSafe } from '@/lib/editor-document/rooms';
import { eligibleCeilingRooms, insideRoom } from '@/lib/editor-document/ceiling-geometry';

interface Props {
  document?: EditorDocument;
  options: RenderDesignOptions;
  onChange: (options: RenderDesignOptions) => void;
  disabled?: boolean;
}

const scopes = [
  ['all', 'Toda esta planta'],
  ['interior', 'Solo interior'],
  ['exterior', 'Solo exterior'],
  ['rooms', 'Estancias concretas'],
] as const;

export function DesignScopePicker({ document, options, onChange, disabled }: Props) {
  const rooms = useMemo(() => {
    if (!document) return [];
    const derived = deriveRoomsSafe(document);
    if (!derived.length) return [];
    const indoor = new Set(eligibleCeilingRooms(document).map((room) => room.id));
    return derived.map((room, index) => ({
      id: room.id,
      label: document.labels.find((item) => insideRoom(item, room.boundary))?.text.trim()
        || `${indoor.has(room.id) ? 'Estancia' : 'Exterior'} ${index + 1}`,
      outdoor: !indoor.has(room.id),
    }));
  }, [document]);
  const interiorCount = rooms.filter((room) => !room.outdoor).length;
  const exteriorCount = rooms.length - interiorCount;
  const toggleRoom = (id: string) => onChange({ ...options,
    designRoomIds: options.designRoomIds.includes(id)
      ? options.designRoomIds.filter((value) => value !== id)
      : [...options.designRoomIds, id],
  });
  return <fieldset className="mt-4 rounded-control border border-line p-3 text-sm" disabled={disabled}>
    <legend className="text-ink px-1 font-medium">Qué parte del inmueble diseñar</legend>
    <div className="grid gap-2 sm:grid-cols-2">
      {scopes.map(([kind, label]) => <label key={kind} className="flex items-center gap-2">
        <input type="radio" name="design-scope" checked={options.designScope === kind}
          disabled={kind === 'interior' ? !interiorCount : kind === 'exterior' ? !exteriorCount : kind === 'rooms' ? !rooms.length : false}
          onChange={() => onChange({ ...options, designScope: kind })} />{label}
      </label>)}
    </div>
    {options.designScope === 'rooms' && <div className="mt-3 grid max-h-40 gap-1 overflow-y-auto border-t border-line pt-3 sm:grid-cols-2">
      {rooms.map((room) => <label key={room.id} className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={options.designRoomIds.includes(room.id)} onChange={() => toggleRoom(room.id)} />
        {room.label} <span className="text-muted-foreground">· {room.outdoor ? 'exterior' : 'interior'}</span>
      </label>)}
    </div>}
    <p className="text-muted-foreground mt-2 text-xs">Cada aplicación conserva el resto de esta planta. Las propuestas siguientes se suman en la misma escena 3D; guarda y aprueba la versión conjunta cuando esté terminada.</p>
  </fieldset>;
}
