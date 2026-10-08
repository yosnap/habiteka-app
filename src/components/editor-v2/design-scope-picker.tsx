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
import { Check, Pencil, ScanLine, Trash2 } from 'lucide-react';

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
  ['house', 'Solo la casa'],
  ['interior', 'Solo interior'],
  ['exterior', 'Solo exterior'],
  ['rooms', 'Estancias concretas'],
  ['zone', 'Zona dibujada'],
] as const;

export function DesignScopePicker({ document, options, onChange, onCreateZone, onRenameZone, onReshapeZone, onRemoveZone, disabled }: Props) {
  const [zoneName, setZoneName] = useState('Zona nueva');
  const [zoneError, setZoneError] = useState<string | null>(null);
  const [reshapeId, setReshapeId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  // Quitar una zona borra su contorno y sus acabados: se pide confirmación en un segundo paso.
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
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
  const finishRename = (id: string, previous: string, value: string) => {
    setRenameId(null);
    if (value.trim() === previous) return;
    try { onRenameZone?.(id, value); setZoneError(null); }
    catch (error) { setZoneError(error instanceof Error ? error.message : 'No se pudo renombrar la zona.'); }
  };
  return <div className="mt-4 rounded-control border border-line p-3 text-sm">
    <label htmlFor="editor-design-scope" className="text-ink mb-1 block font-medium">Qué parte del inmueble diseñar</label>
    <ModernSelect compact id="editor-design-scope" value={options.designScope} disabled={disabled}
      onChange={(event) => changeScope({ designScope: event.target.value as RenderDesignOptions['designScope'] })}>
      {scopes.map(([kind, label]) => <option key={kind} value={kind}
        disabled={kind === 'interior' || kind === 'house' ? !interiorCount : kind === 'exterior' ? !exteriorCount : kind === 'rooms' ? !rooms.length : false}>
        {label}
      </option>)}
    </ModernSelect>
    {options.designScope === 'house' && <p className="mt-2 text-xs text-ink-soft">Estancias interiores y sus fachadas de esta planta. La parcela, los patios y las construcciones exteriores quedan fuera del ámbito.</p>}
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
      {(document?.designZones ?? []).length > 0 && <div className="space-y-2" aria-label="Zonas guardadas">
        {(document?.designZones ?? []).map((zone) => <div key={zone.id}
          className={`rounded-control border p-2.5 ${options.designZoneId === zone.id ? 'border-emerald-700 bg-emerald-50' : 'border-line bg-canvas'}`}>
          <button type="button" aria-pressed={options.designZoneId === zone.id} aria-label={`Elegir zona ${zone.name}`}
            disabled={disabled} className={`flex w-full items-center justify-between gap-3 rounded-control px-2 py-1.5 text-left font-medium focus-visible:outline-2 focus-visible:outline-emerald-700 ${options.designZoneId === zone.id ? 'text-emerald-900' : 'text-ink hover:bg-emerald-50'}`}
            onClick={() => { if (options.designZoneId !== zone.id) {
              setRenameId(null); setReshapeId(null); changeScope({ designZoneId: zone.id });
            } }}>
            <span className="min-w-0 break-words">{zone.name}</span>
            <span className={`shrink-0 text-xs ${options.designZoneId === zone.id ? 'text-emerald-800' : 'text-muted-foreground'}`}>
              {options.designZoneId === zone.id ? <><Check aria-hidden="true" className="mr-1 inline size-3.5" />Seleccionada</> : 'Elegir zona'}
            </span>
          </button>
          {renameId === zone.id && <input aria-label={`Nuevo nombre de ${zone.name}`} value={renameValue}
            autoFocus disabled={disabled} maxLength={80} className="mt-2 w-full rounded-control border border-line bg-white px-3 py-2 text-sm"
            onChange={(event) => setRenameValue(event.target.value)}
            onBlur={(event) => finishRename(zone.id, zone.name, event.currentTarget.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
              if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation();
                event.currentTarget.value = zone.name; setRenameValue(zone.name); event.currentTarget.blur(); } }} />}
          {options.designZoneId === zone.id && <div className="mt-1.5 flex flex-wrap gap-2 border-t border-line pt-2">
            {onRenameZone && <button type="button" disabled={disabled} aria-label={`Renombrar ${zone.name}`}
              className="inline-flex items-center gap-1 rounded-control border border-line bg-white px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-emerald-50"
              onClick={() => { setRenameId(zone.id); setRenameValue(zone.name); }}><Pencil aria-hidden="true" className="size-3.5" />Renombrar</button>}
            {onReshapeZone && <button type="button" disabled={disabled} aria-pressed={reshapeId === zone.id}
              className="inline-flex items-center gap-1 rounded-control border border-line bg-white px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-emerald-50"
              onClick={() => { setReshapeId(reshapeId === zone.id ? null : zone.id); setZoneError(null); }}>
              <ScanLine aria-hidden="true" className="size-3.5" />{reshapeId === zone.id ? 'Cancelar contorno' : 'Redibujar contorno'}
            </button>}
            {onRemoveZone && confirmRemoveId !== zone.id && <button type="button" disabled={disabled} aria-label={`Quitar zona ${zone.name}`}
              className="text-destructive inline-flex items-center gap-1 rounded-control border border-line bg-white px-2.5 py-1.5 text-xs font-medium hover:bg-red-50"
              onClick={() => setConfirmRemoveId(zone.id)}>
              <Trash2 aria-hidden="true" className="size-3.5" />Quitar
            </button>}
            {onRemoveZone && confirmRemoveId === zone.id && <>
              <button type="button" disabled={disabled} aria-label={`Confirmar quitar zona ${zone.name}`}
                className="inline-flex items-center gap-1 rounded-control border border-red-300 bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                onClick={() => { setConfirmRemoveId(null); try { onRemoveZone(zone.id); if (options.designZoneId === zone.id) changeScope({ designZoneId: '' });
                  if (reshapeId === zone.id) setReshapeId(null); if (renameId === zone.id) setRenameId(null); setZoneError(null); }
                  catch (error) { setZoneError(error instanceof Error ? error.message : 'No se pudo quitar la zona.'); } }}>
                <Trash2 aria-hidden="true" className="size-3.5" />¿Quitar «{zone.name}»? Confirmar
              </button>
              <button type="button" aria-label="Cancelar quitar zona"
                className="inline-flex items-center gap-1 rounded-control border border-line bg-white px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-emerald-50"
                onClick={() => setConfirmRemoveId(null)}>Cancelar</button>
            </>}
          </div>}
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
        }}
        onExistingRoom={{ hint: 'si ya es una zona guardada, se elige esa', select: (id) => { setReshapeId(null); setZoneError(null); changeScope({ designZoneId: id }); } }}
        disabled={disabled} full={!reshapeId && (document?.designZones?.length ?? 0) >= MAX_DESIGN_ZONES}
        fullMessage={`Máximo de ${MAX_DESIGN_ZONES} zonas de diseño.`}
        label="Mapa 2D para dibujar una zona de diseño" />}
      {zoneError && <p role="alert" className="text-destructive text-xs">{zoneError}</p>}
      {!options.designZoneId && <p className="text-amber-800 text-xs">Elige o dibuja una zona antes de pedir la propuesta.</p>}
    </div>}
    <p className="text-muted-foreground mt-2 text-xs">Las propuestas se suman en la misma escena 3D. Guarda y aprueba el diseño conjunto al terminar.</p>
  </div>;
}
