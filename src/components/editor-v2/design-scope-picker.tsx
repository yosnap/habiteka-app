'use client';

import { useMemo } from 'react';
import type { EditorDocument } from '@/lib/editor-document/schema';
import type { RenderDesignOptions } from '@/lib/editor-document/render-design-options';
import { deriveRoomsSafe } from '@/lib/editor-document/rooms';
import { eligibleCeilingRooms, insideRoom } from '@/lib/editor-document/ceiling-geometry';
import { ModernSelect } from '@/components/ui/modern-select';
import { CheckToggle } from '@/components/ui/check-toggle';

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
  return <div className="mt-4 rounded-control border border-line p-3 text-sm">
    <label htmlFor="editor-design-scope" className="text-ink mb-1 block font-medium">Qué parte del inmueble diseñar</label>
    <ModernSelect compact id="editor-design-scope" value={options.designScope} disabled={disabled}
      onChange={(event) => onChange({ ...options, designScope: event.target.value as RenderDesignOptions['designScope'] })}>
      {scopes.map(([kind, label]) => <option key={kind} value={kind}
        disabled={kind === 'interior' ? !interiorCount : kind === 'exterior' ? !exteriorCount : kind === 'rooms' ? !rooms.length : false}>
        {label}
      </option>)}
    </ModernSelect>
    {options.designScope === 'rooms' && <div className="mt-3 grid max-h-40 gap-2 overflow-y-auto border-t border-line pt-3 sm:grid-cols-2">
      {rooms.map((room) => <CheckToggle key={room.id} checked={options.designRoomIds.includes(room.id)}
        disabled={disabled} onChange={() => toggleRoom(room.id)}
        label={<>{room.label} <span className="text-muted-foreground">· {room.outdoor ? 'exterior' : 'interior'}</span></>} />)}
    </div>}
    <p className="text-muted-foreground mt-2 text-xs">Las propuestas se suman en la misma escena 3D. Guarda y aprueba el diseño conjunto al terminar.</p>
  </div>;
}
