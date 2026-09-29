'use client';

import { useMemo, useState } from 'react';
import type { EditorDocument, Point } from '@/lib/editor-document/schema';
import type { RenderDesignOptions } from '@/lib/editor-document/render-design-options';
import { deriveRoomsSafe } from '@/lib/editor-document/rooms';
import { eligibleCeilingRooms, insideRoom } from '@/lib/editor-document/ceiling-geometry';
import { ModernSelect } from '@/components/ui/modern-select';
import { CheckToggle } from '@/components/ui/check-toggle';
import { localToWorld } from '@/lib/editor-document/spatial-properties';
import { scopeContainsPoint } from '@/lib/editor-document/design-scope';
import { ZoneDrawCanvas } from './zone-draw-canvas';
import { MAX_DESIGN_ZONES } from '@/lib/editor-document/design-zone-validation';

interface Props {
  document?: EditorDocument;
  options: RenderDesignOptions;
  onChange: (options: RenderDesignOptions) => void;
  onCreateZone?: (name: string, polygon: Point[]) => string;
  onRenameZone?: (id: string, name: string) => void;
  onReshapeZone?: (id: string, polygon: Point[]) => void;
  onRemoveZone?: (id: string) => void;
  disabled?: boolean;
}

const scopes = [
  ['all', 'Toda esta planta'],
  ['interior', 'Solo interior'],
  ['exterior', 'Solo exterior'],
  ['rooms', 'Estancias concretas'],
  ['zone', 'Zona dibujada'],
] as const;

export function DesignScopePicker({ document, options, onChange, onCreateZone, onRenameZone, onReshapeZone, onRemoveZone, disabled }: Props) {
  const [zoneName, setZoneName] = useState('Zona nueva');
  const [zoneError, setZoneError] = useState<string | null>(null);
  const [reshapeId, setReshapeId] = useState<string | null>(null);
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
  const exteriorStructures = useMemo(() => {
    if (!document) return [];
    const indoorRooms = eligibleCeilingRooms(document);
    return [
      ...(document.stairs ?? []).map((item, index) => ({ ...item, label: item.name || `Escalera exterior ${index + 1}` })),
      ...(document.ramps ?? []).map((item, index) => ({ ...item,
        label: item.name || `${item.riseMm === 0 ? 'Descansillo' : 'Rampa'} exterior ${index + 1}` })),
    ].filter((item) => !scopeContainsPoint(indoorRooms,
      localToWorld(item, { x: item.widthMm / 2, y: item.depthMm / 2 })));
  }, [document]);
  const interiorCount = rooms.filter((room) => !room.outdoor).length;
  const exteriorCount = rooms.length - interiorCount;
  const changeScope = (patch: Partial<RenderDesignOptions>) => onChange({ ...options, ...patch,
    placement: 'all', regions: [] });
  const toggleRoom = (id: string) => onChange({ ...options,
    designRoomIds: options.designRoomIds.includes(id)
      ? options.designRoomIds.filter((value) => value !== id)
      : [...options.designRoomIds, id],
  });
  return <div className="mt-4 rounded-control border border-line p-3 text-sm">
    <label htmlFor="editor-design-scope" className="text-ink mb-1 block font-medium">Qué parte del inmueble diseñar</label>
    <ModernSelect compact id="editor-design-scope" value={options.designScope} disabled={disabled}
      onChange={(event) => changeScope({ designScope: event.target.value as RenderDesignOptions['designScope'] })}>
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
    {options.designScope === 'rooms' && exteriorStructures.length > 0 && <div className="mt-3 border-t border-line pt-3">
      <p className="mb-2 text-xs font-medium">Escaleras, rampas y descansillos exteriores</p>
      <div className="grid max-h-36 gap-2 overflow-y-auto sm:grid-cols-2">
        {exteriorStructures.map((item) => <CheckToggle key={item.id}
          checked={options.designStructureIds.includes(item.id)} disabled={disabled}
          onChange={(checked) => onChange({ ...options, designStructureIds: checked
            ? [...options.designStructureIds, item.id]
            : options.designStructureIds.filter((id) => id !== item.id) })}
          label={item.label} />)}
      </div>
    </div>}
    {options.designScope === 'zone' && <div className="mt-3 space-y-3 border-t border-line pt-3">
      <p className="text-muted-foreground text-xs">Dibuja Entrada, Patio, Salón o Cocina sobre el plano. Cada zona queda guardada y puedes diseñarla sin cambiar las demás.</p>
      {(document?.designZones ?? []).length > 0 && <div className="grid gap-2 sm:grid-cols-2">
        {(document?.designZones ?? []).map((zone) => <div key={zone.id} className="bg-canvas flex items-center gap-2 rounded-control border border-line px-2 py-1">
          <button type="button" aria-pressed={options.designZoneId === zone.id} disabled={disabled}
            className={`rounded-control px-2 py-1 text-xs ${options.designZoneId === zone.id ? 'bg-emerald-800 text-white' : 'border border-line'}`}
            onClick={() => { if (options.designZoneId !== zone.id) changeScope({ designZoneId: zone.id }); }}>{zone.name}</button>
          {onRenameZone && <input aria-label={`Renombrar ${zone.name}`} defaultValue={zone.name} key={`${zone.id}:${zone.name}`}
            disabled={disabled} maxLength={80} className="min-w-0 flex-1 rounded-control border border-line px-1 text-xs"
            onBlur={(event) => { if (event.target.value.trim() !== zone.name) {
              try { onRenameZone(zone.id, event.target.value); setZoneError(null); }
              catch (error) { setZoneError(error instanceof Error ? error.message : 'No se pudo renombrar la zona.'); event.target.value = zone.name; }
            } }} />}
          {onReshapeZone && <button type="button" disabled={disabled} aria-pressed={reshapeId === zone.id}
            className="text-emerald-800 text-xs underline" onClick={() => { setReshapeId(reshapeId === zone.id ? null : zone.id); setZoneError(null); }}>
            {reshapeId === zone.id ? 'Cancelar contorno' : 'Redibujar'}
          </button>}
          {onRemoveZone && <button type="button" disabled={disabled} className="text-destructive text-xs underline"
            onClick={() => { try { onRemoveZone(zone.id); if (options.designZoneId === zone.id) changeScope({ designZoneId: '' });
              if (reshapeId === zone.id) setReshapeId(null); setZoneError(null); }
              catch (error) { setZoneError(error instanceof Error ? error.message : 'No se pudo quitar la zona.'); } }}>Quitar</button>}
        </div>)}
      </div>}
      {reshapeId && <p className="text-emerald-900 text-xs">Marca el nuevo contorno de «{document?.designZones?.find((zone) => zone.id === reshapeId)?.name}» en el mapa. El acabado aplicado se conservará.</p>}
      {onCreateZone && <ZoneDrawCanvas document={document} zones={document?.designZones ?? []}
        snapToWalls={false}
        name={zoneName} onNameChange={setZoneName}
        onPolygon={(polygon, name) => {
          try {
            if (reshapeId && onReshapeZone) { onReshapeZone(reshapeId, polygon); changeScope({ designZoneId: reshapeId }); setReshapeId(null); }
            else { const id = onCreateZone(name, polygon); changeScope({ designZoneId: id }); }
            setZoneError(null);
          }
          catch (error) { setZoneError(error instanceof Error ? error.message : 'No se pudo guardar la zona.'); }
        }} disabled={disabled} full={!reshapeId && (document?.designZones?.length ?? 0) >= MAX_DESIGN_ZONES}
        fullMessage={`Máximo de ${MAX_DESIGN_ZONES} zonas de diseño.`}
        label="Mapa 2D para dibujar una zona de diseño" />}
      {zoneError && <p role="alert" className="text-destructive text-xs">{zoneError}</p>}
      {!options.designZoneId && <p className="text-amber-800 text-xs">Elige o dibuja una zona antes de pedir la propuesta.</p>}
    </div>}
    <p className="text-muted-foreground mt-2 text-xs">Las propuestas se suman en la misma escena 3D. Guarda y aprueba el diseño conjunto al terminar.</p>
  </div>;
}
