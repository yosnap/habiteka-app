'use client';
import { planObjects, isBoundary, isLegacyBoundary, boundaryGateOwner } from '@/lib/editor-document/boundary-types';

import { elementName } from '@/lib/editor-document/element-classification';
import { BoundaryFields } from './boundary-fields';
import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { matchesQuery, planElementIndex } from '@/lib/editor-document/plan-element-index';
import { useStore } from 'zustand';
import { ModernSelect } from '@/components/ui/modern-select';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { applyCommand } from '@/lib/editor-document/commands';
import { distance, wallPoints } from '@/lib/editor-document/geometry';
import { assertOpeningClearance } from '@/lib/editor-document/opening-clearance';
import { deleteEntities, editDocument, interiorPoint, newId } from '@/canvas/editor-v2/editing-operations';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { insideRoom } from '@/lib/editor-document/ceiling-geometry';
import { editableOutdoorRoom } from '@/lib/editor-document/outdoor-editing';
import { bulkPeers, propagateToPeers } from '@/lib/editor-document/bulk-edit';
import { floorFinish, setFloorFinish } from '@/lib/editor-document/floor-finishes';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { updateFurniture } from '@/lib/editor-document/spatial-commands';
import { furnitureSpatial } from '@/lib/editor-document/spatial-properties';
import { MeterField, NumberField } from './property-number-field';
import { OpeningConstructionFields, RampConstructionFields, StairConstructionFields, WallConstructionFields } from './construction-fields';
import { isRampLanding } from '@/lib/editor-document/ramp-kind';
import { setWallVisibility, updateColumn } from '@/lib/editor-document/construction-commands';
import styles from './editor.module.css';
export function Inspector({ store, onClose }: { store: EditorStore; onClose?: () => void }) {
  const doc = useStore(store, (s) => s.document), selection = useStore(store, (s) => s.selection);
  const readOnly = useStore(store, (s) => s.readOnly);
  const [mergeId, setMergeId] = useState(''), [query, setQuery] = useState(''), id = selection[0];
  const gateOwner = boundaryGateOwner(doc, id);
  const wall = doc.walls.find((w) => w.id === id), furniture = planObjects(doc).find((f) => f.id === id) ?? gateOwner?.boundary;
  const opening = doc.openings.find((o) => o.id === id), label = doc.labels.find((o) => o.id === id);
  const stair = doc.stairs?.find((item) => item.id === id);
  const ramp = doc.ramps?.find((item) => item.id === id);
  const column = doc.columns?.find((item) => item.id === id);
  // Las estancias no son entidades: su nombre es la etiqueta de texto situada dentro del contorno.
  const rooms = useMemo(() => { try { return deriveRooms(doc); } catch { return []; } }, [doc]);
  const room = rooms.find((item) => item.id === id), outdoor = room ? editableOutdoorRoom(doc, room) : false;
  const roomLabel = room ? doc.labels.find((item) => insideRoom(item, room.boundary)) : undefined;
  const renameRoom = (value: string) => room && apply((document) => editDocument(document, (next) => {
    const text = value.trim(), existing = roomLabel && next.labels.find((item) => item.id === roomLabel.id);
    if (existing) { if (text) existing.text = text; else next.labels = next.labels.filter((item) => item.id !== existing.id); }
    else if (text) next.labels.push({ id: newId(), ...interiorPoint(room.boundary), text });
  }));
  // Con varios elementos del mismo tipo seleccionados, cada cambio del inspector se repite en todos ellos.
  const peers = id ? bulkPeers(doc, id, selection) : [];
  const apply = (operation: (current: EditorDocument) => EditorDocument) => {
    try {
      const current = store.getState().document, next = operation(current);
      store.getState().apply(id && peers.length ? propagateToPeers(current, next, id, peers) : next);
      return true;
    }
    catch (error) { store.getState().setError(error instanceof Error ? error.message : 'Valor inválido'); return false; }
  };
  const meterField = (text: string, valueMm: number, edit: (next: EditorDocument, n: number) => void) =>
    <MeterField label={text} valueMm={valueMm} change={(n) => apply((d) => editDocument(d, (next) => edit(next, n)))} />;
  const points = wall ? wallPoints(doc, wall) : null;
  const selectedEntity = wall ?? opening ?? stair ?? ramp ?? column ?? furniture;
  const updateName = (value: string) => apply((document) => editDocument(document, (next) => {
    const entity = [...next.walls, ...next.openings, ...(next.stairs ?? []), ...(next.ramps ?? []), ...(next.columns ?? []), ...planObjects(next)]
      .find((item) => item.id === id);
    if (!entity) throw new Error('Elemento no encontrado');
    entity.name = value.trim() || undefined;
  }));
  const index = useMemo(() => planElementIndex(doc, rooms), [doc, rooms]);
  const matches = query.trim() ? index.filter((entry) => matchesQuery(entry, query)).slice(0, 12) : [];
  // Ir a un elemento: lo selecciona y centra el lienzo en él.
  const goTo = (entryId: string) => {
    const entry = index.find((item) => item.id === entryId);
    store.getState().setTool('select'); store.getState().select(entry ? [entry.id] : []);
    if (entry) store.getState().focusOn(entry.point);
    setQuery('');
  };
  return <aside className={styles.inspector} aria-label="Propiedades de selección">
    <header className={styles.inspectorHeading}><h2>Propiedades</h2>
      {onClose && <button type="button" onClick={onClose} aria-label="Cerrar propiedades"><X size={18} aria-hidden="true" /></button>}</header>
    <label className={`${styles.field} ${styles.search}`}>Buscar en el plano
      <span><Search size={14} aria-hidden="true" /><input type="search" value={query} placeholder="Pared, patio, sofá…" aria-label="Buscar elemento del plano"
        onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && matches[0]) goTo(matches[0].id); if (event.key === 'Escape') setQuery(''); }} /></span>
    </label>
    {query.trim() && <ul className={styles.searchResults} aria-label="Resultados de la búsqueda">
      {matches.length === 0 && <li className={styles.searchEmpty}>Sin coincidencias</li>}
      {matches.map((entry) => <li key={entry.id}><button type="button" onClick={() => goTo(entry.id)}>
        <span>{entry.label}</span><small>{entry.group}</small></button></li>)}
    </ul>}
    <label className={styles.field}>Elemento del plano<ModernSelect value={id ?? ''} onChange={(event) => goTo(event.target.value)}>
      <option value="">Selecciona un elemento</option>
      {index.map((entry) => <option key={entry.id} value={entry.id}>{entry.label} · {entry.group}</option>)}
    </ModernSelect></label>
    <fieldset disabled={readOnly} className="m-0 min-w-0 border-0 p-0">
    <h2>{gateOwner ? 'Puerta del cerramiento' : wall ? 'Muro' : column ? 'Columna' : furniture ? elementName(furniture) : opening ? 'Abertura' : stair ? 'Escalera' : ramp ? isRampLanding(ramp) ? 'Descansillo' : 'Rampa' : room ? outdoor ? 'Patio / terraza' : 'Estancia' : label ? 'Texto' : 'Propiedades'}</h2>
    {!id && <p>Selecciona un elemento para editar sus medidas. Todas las distancias se expresan en metros.</p>}
    {peers.length > 0 && <p className={styles.bulkNotice} role="status">{peers.length + 1} elementos seleccionados: cada cambio se aplica a todos.</p>}
    {selectedEntity && !gateOwner && !peers.length && <label className={styles.field}>Nombre<input key={selectedEntity.name} defaultValue={selectedEntity.name ?? ''}
      placeholder={furniture ? elementName(furniture) : "Nombre del elemento"} maxLength={100} onBlur={(event) => updateName(event.currentTarget.value)} /></label>}
    {room && <>
      {!peers.length && <label className={styles.field}>Nombre<input key={roomLabel?.id ?? 'sin-nombre'} defaultValue={roomLabel?.text ?? ''}
        placeholder={outdoor ? 'Patio / terraza' : 'Nombre de la estancia'} maxLength={100} onBlur={(event) => renameRoom(event.currentTarget.value)} /></label>}
      <p className={styles.field}>Superficie: {(room.areaMm2 / 1e6).toFixed(2)} m²</p>
      <MeterField label="Cota del suelo" valueMm={floorFinish(doc, room.id).elevationMm ?? 0} change={(elevationMm) => apply((d) => setFloorFinish(d, room.id, { elevationMm }))} />
      <button type="button" onClick={() => store.getState().setDetailPanel('paint')}>Textura del suelo</button>
    </>}
    {wall && points && <>
      <div className={styles.fields}>
        {meterField('Grosor', wall.thicknessMm, (d, n) => { d.walls.find((w) => w.id === id)!.thicknessMm = n; })}
        <MeterField label="Longitud" valueMm={distance(...points)} change={(n) => apply((d) => {
          if (n <= 0) throw new Error('La longitud debe ser positiva.');
          const w = d.walls.find((w) => w.id === id)!, [a, b] = wallPoints(d, w), factor = n / distance(a, b);
          return applyCommand(d, { type: 'move-vertex', vertexId: w.endVertexId,
            x: a.x + (b.x - a.x) * factor, y: a.y + (b.y - a.y) * factor });
        })} />
        <NumberField label="Ángulo (°)" value={Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x) * 180 / Math.PI}
          change={(n) => apply((d) => { const w = d.walls.find((w) => w.id === id)!, [a, b] = wallPoints(d, w);
            return applyCommand(d, { type: 'move-vertex', vertexId: w.endVertexId,
              x: a.x + Math.cos(n * Math.PI / 180) * distance(a, b), y: a.y + Math.sin(n * Math.PI / 180) * distance(a, b) }); })} />
      </div>
      <div className={styles.actions}>
        <button onClick={() => apply((d) => applyCommand(d, { type: 'invert-wall', wallId: wall.id }))}>Invertir sentido</button>
        <button onClick={() => apply((d) => setWallVisibility(d, wall.id, !wall.hidden))}>{wall.hidden ? 'Mostrar pared' : 'Ocultar pared'}</button>
        <button onClick={() => apply((d) => applyCommand(d, { type: 'split-wall', wallId: wall.id,
          position: .5, vertexId: newId(), newWallId: newId() }))}>Dividir al 50%</button>
      </div>
      <label className={styles.field}>Muro para unir<ModernSelect value={mergeId} onChange={(e) => setMergeId(e.target.value)}>
        <option value="">Elige un muro contiguo</option>
        {doc.walls.filter((w) => w.id !== id && [w.startVertexId, w.endVertexId].some((v) =>
          v === wall.startVertexId || v === wall.endVertexId)).map((w, i) => <option key={w.id} value={w.id}>Contiguo {i + 1} ({(distance(...wallPoints(doc, w)) / 1000).toFixed(2)} m)</option>)}
      </ModernSelect></label>
      <button disabled={!mergeId} onClick={() => apply((d) => applyCommand(d, { type: 'merge-walls', wallId: wall.id, otherWallId: mergeId }))}>Unir muros</button>
      <WallConstructionFields wall={wall} document={doc} edit={apply} />
    </>}
    {furniture && !gateOwner && <div className={styles.fields}>
      {([['x', 'X'], ['y', 'Y'], ['widthMm', 'Ancho'], ['depthMm', 'Fondo'],
        ['heightMm', 'Altura'], ['elevationMm', 'Elevación']] as const).map(([key, label]) =>
        <MeterField key={key} label={isBoundary(furniture) && key === 'widthMm' ? 'Longitud' : isBoundary(furniture) && key === 'depthMm' ? 'Espesor' : label} valueMm={({ ...furniture, ...furnitureSpatial(furniture) })[key]}
          change={(value) => apply((doc) => updateFurniture(doc, furniture.id, { [key]: value }))} />)}
      <NumberField label="Rotación (°)" value={furniture.rotation}
        change={(rotation) => apply((doc) => updateFurniture(doc, furniture.id, { rotation }))} />
    </div>}
    {furniture && (isBoundary(furniture) || isLegacyBoundary(furniture)) && <BoundaryFields item={furniture} edit={apply} />}
    {opening && <><div className={styles.fields}>
      {meterField('Ancho', opening.widthMm, (d, n) => {
        const target = d.openings.find((o) => o.id === id)!;
        target.widthMm = n; assertOpeningClearance(d, target);
      })}
      <NumberField label="Centro en muro (%)" value={opening.position * 100} change={(n) => apply((d) => editDocument(d, (next) => {
        const target = next.openings.find((o) => o.id === id)!;
        target.position = n / 100; assertOpeningClearance(d, target);
      }))} />
    </div><OpeningConstructionFields opening={opening} edit={apply} /></>}
    {stair && <StairConstructionFields stair={stair} edit={apply} />}
    {ramp && <RampConstructionFields ramp={ramp} edit={apply} />}
    {column && <div className={styles.fields}>{([['x', 'X'], ['y', 'Y'], ['widthMm', 'Ancho'], ['depthMm', 'Fondo'], ['heightMm', 'Altura'], ['elevationMm', 'Elevación']] as const).map(([key, label]) =>
      <MeterField key={key} label={label} valueMm={column[key]} change={(value) => apply((document) => updateColumn(document, column.id, { [key]: value }))} />)}
      <NumberField label="Rotación (°)" value={column.rotation} change={(rotation) => apply((document) => updateColumn(document, column.id, { rotation }))} /></div>}
    {label && <label className={styles.field}>Texto<input key={label.text} defaultValue={label.text}
      onBlur={(e) => { const text = e.currentTarget.value; apply((d) => editDocument(d, (next) => { next.labels.find((l) => l.id === id)!.text = text; })); }} /></label>}
    {id && <button className={styles.danger} onClick={() => {
      apply((d) => deleteEntities(d, selection)); store.getState().select([]);
    }}>Eliminar selección</button>}
    </fieldset>
    <p className={styles.hint}>{readOnly ? 'Modo solo lectura.' : 'Ctrl/Cmd + Z deshace. Escape cancela el trazo. Arrastra los extremos para ajustar un muro.'}</p>
  </aside>;
}
