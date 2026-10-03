'use client';
import { planObjects, isBoundary, isLegacyBoundary, boundaryGateOwner } from '@/lib/editor-document/boundary-types';

import { elementName } from '@/lib/editor-document/element-classification';
import { BoundaryFields } from './boundary-fields';
import { KitchenFields } from './kitchen-fields';
import { isKitchenRun, kitchenSlotOwner } from '@/lib/editor-document/kitchen-run-types';
import { useMemo, useState } from 'react';
import { MousePointer2, Search } from 'lucide-react';
import { matchesQuery, planElementIndex } from '@/lib/editor-document/plan-element-index';
import { useStore } from 'zustand';
import { ModernSelect } from '@/components/ui/modern-select';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { deleteEntities, editDocument, interiorPoint, newId } from '@/canvas/editor-v2/editing-operations';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { insideRoom } from '@/lib/editor-document/ceiling-geometry';
import { deleteOutdoorRoom, editableOutdoorRoom } from '@/lib/editor-document/outdoor-editing';
import { editSelectionProperties, selectionPropertyScope, selectPropertyElement } from '@/canvas/editor-v2/selection-properties';
import { floorFinish, setFloorFinish } from '@/lib/editor-document/floor-finishes';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { updateFurniture } from '@/lib/editor-document/spatial-commands';
import { MeterField, NumberField } from './property-number-field';
import { OpeningConstructionFields, RampConstructionFields, StairConstructionFields } from './construction-fields';
import { isRampLanding } from '@/lib/editor-document/ramp-kind';
import { exteriorWallIds } from '@/lib/editor-document/exterior-wall-selection';
import { BulkWallAppearanceFields } from './bulk-wall-appearance-fields';
import { updateColumn } from '@/lib/editor-document/construction-commands';
import { CarpaSidesField } from './carpa-sides-field';
import { TerrainFields } from './terrain-fields';
import { SurfaceMaterialPicker } from './surface-material-picker';
import styles from './editor.module.css';
import properties from './selection-properties.module.css';
import { PropertySection } from './property-section';
import { WallProperties } from './wall-properties';
import { FurnitureProperties } from './furniture-properties';
import { ElementDetailsPanel } from './element-details-panel';
import { FloorFinishPanel } from './floor-finish-panel';
import { SelectionElementActions } from './selection-element-actions';
export function Inspector({ store }: { store: EditorStore }) {
  const doc = useStore(store, (s) => s.document), selection = useStore(store, (s) => s.selection);
  const readOnly = useStore(store, (s) => s.readOnly);
  const [query, setQuery] = useState(''), id = selection[0];
  const detailPanel = useStore(store, (s) => s.detailPanel);
  const gateOwner = boundaryGateOwner(doc, id), slotOwner = kitchenSlotOwner(doc, id), partOwner = gateOwner ?? slotOwner;
  const wall = doc.walls.find((w) => w.id === id), furniture = planObjects(doc).find((f) => f.id === id) ?? gateOwner?.boundary ?? slotOwner?.run;
  const opening = doc.openings.find((o) => o.id === id), label = doc.labels.find((o) => o.id === id);
  const stair = doc.stairs?.find((item) => item.id === id);
  const ramp = doc.ramps?.find((item) => item.id === id);
  const column = doc.columns?.find((item) => item.id === id);
  const terrain = doc.terrainSurfaces?.find((item) => item.id === id);
  const dimension = doc.dimensions.find(item => item.id === id);
  // Las estancias no son entidades: su nombre es la etiqueta de texto situada dentro del contorno.
  const rooms = useMemo(() => { try { return deriveRooms(doc); } catch { return []; } }, [doc]);
  const facadeIds = useMemo(() => new Set(exteriorWallIds(doc)), [doc]);
  const room = rooms.find((item) => item.id === id), outdoor = room ? editableOutdoorRoom(doc, room) : false;
  const roomLabel = room ? doc.labels.find((item) => insideRoom(item, room.boundary)) : undefined;
  const renameRoom = (value: string) => room && apply((document) => editDocument(document, (next) => {
    const text = value.trim(), existing = roomLabel && next.labels.find((item) => item.id === roomLabel.id);
    if (existing) { if (text) existing.text = text; else next.labels = next.labels.filter((item) => item.id !== existing.id); }
    else if (text) next.labels.push({ id: newId(), ...interiorPoint(room.boundary), text });
  }));
  const { multiple, mixed, peers } = selectionPropertyScope(doc, selection);
  const selectedWallIds = wall && !mixed ? [wall.id, ...peers] : [];
  const allFacades = selectedWallIds.length > 1 && selectedWallIds.every((wallId) => facadeIds.has(wallId));
  const apply = (operation: (current: EditorDocument) => EditorDocument) => editSelectionProperties(store, operation);
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
    selectPropertyElement(store, entry?.id ?? '');
    if (entry) store.getState().focusOn(entry.point);
    setQuery('');
  };
  const title = gateOwner ? 'Puerta del cerramiento' : slotOwner ? 'Aparato de cocina' : wall ? 'Pared' : column ? 'Columna' : furniture ? elementName(furniture) : opening ? opening.kind === 'puerta' ? 'Puerta' : opening.kind === 'ventana' ? 'Ventana' : 'Hueco' : stair ? 'Escalera' : ramp ? isRampLanding(ramp) ? 'Descansillo' : 'Rampa' : room ? outdoor ? 'Patio / terraza' : 'Habitación' : label ? 'Texto' : 'Elemento';
  const appearance = !mixed && (room || wall || (!multiple && (opening || (furniture && !partOwner) || stair)));
  const comments = !multiple && (wall || opening || (furniture && !partOwner) || stair);
  const mode = detailPanel === 'paint' && appearance ? 'paint' : detailPanel === 'comments' && comments ? 'comments' : null;
  const selectedRooms = rooms.filter((item) => selection.includes(item.id));
  const canDelete = selectedRooms.length === 0 || (selection.length === 1 && outdoor);
  return <aside className={styles.inspector} aria-label="Propiedades de selección">
    <details key={id ? 'selected' : 'empty'} open={!id || undefined} className={properties.searchToggle}>
      <summary>{id ? 'Buscar o cambiar de elemento' : 'Buscar en el plano'}</summary>
    <div className={properties.searchFields}>
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
    </div>
    </details>
    {!id ? <div className={properties.empty}>
      <MousePointer2 size={28} aria-hidden="true" />
      <h2>Selecciona lo que quieres editar</h2>
      <p>Pulsa una pared, el suelo de una habitación, una puerta o un mueble. También puedes buscarlo por su nombre.</p>
      <p>Mayús, Ctrl o Cmd añaden elementos a la selección. Las medidas del panel se expresan en metros.</p>
    </div> : <>
      <div className={properties.identity}>
        <h2>{multiple ? `${selection.length} elementos seleccionados` : terrain ? 'Superficie exterior' : dimension ? 'Medida' : title}</h2>
        {(multiple || index.find((entry) => entry.id === id)?.label !== title) && <span>{multiple ? 'Selección múltiple' : index.find((entry) => entry.id === id)?.label ?? selectedEntity?.name ?? title}</span>}
      </div>
      {multiple && <>
        <p className={styles.bulkNotice} role="status">{mixed
          ? 'Esta selección combina tipos distintos o elementos sin edición conjunta. Elige uno para ver sus propiedades.'
          : 'Los campos comunes se aplican a toda la selección. Se muestran los valores del primer elemento; pueden diferir entre elementos.'}</p>
        <details className={properties.searchToggle} open={mixed || undefined}>
          <summary>Editar un elemento de la selección</summary>
          <div className={properties.selectionList}>{selection.map((selectedId, i) => {
            const entry = index.find((item) => item.id === selectedId);
            return <button key={selectedId} type="button" onClick={() => selectPropertyElement(store, selectedId)}>
              {entry?.label ?? `Elemento ${i + 1}`}<small>{entry?.group ?? 'Seleccionado'}</small>
            </button>;
          })}</div>
        </details>
      </>}
      {!mixed && <>
      {(appearance || comments) && <div className={properties.tabs} role="group" aria-label="Secciones de propiedades">
        <button type="button" aria-pressed={!mode} onClick={() => store.getState().setDetailPanel(null)}>Medidas</button>
        {appearance && <button type="button" aria-pressed={mode === 'paint'} onClick={() => store.getState().setDetailPanel('paint')}>Acabados</button>}
        {comments && <button type="button" aria-pressed={mode === 'comments'} onClick={() => store.getState().setDetailPanel('comments')}>Notas ({doc.comments?.filter((item) => item.targetEntityId === id).length ?? 0})</button>}
      </div>}
      {mode === 'paint' && <fieldset disabled={readOnly} className="m-0 min-w-0 border-0 p-0">
        {room ? <FloorFinishPanel store={store} embedded /> : selectedWallIds.length > 1
          ? <BulkWallAppearanceFields store={store} wallIds={selectedWallIds} facades={allFacades} />
          : <ElementDetailsPanel key={`${id}:paint`} store={store} embedded />}
      </fieldset>}
      {mode === 'comments' && <ElementDetailsPanel key={`${id}:comments`} store={store} embedded />}
      {!mode && <fieldset key={id} disabled={readOnly} className="m-0 min-w-0 border-0 p-0">
    {selectedEntity && !partOwner && !peers.length && <label className={styles.field}>Nombre<input key={selectedEntity.name} defaultValue={selectedEntity.name ?? ''}
      placeholder={furniture ? elementName(furniture) : "Nombre del elemento"} maxLength={100} onBlur={(event) => updateName(event.currentTarget.value)} /></label>}
    {room && <PropertySection title="Habitación y suelo">
      {!peers.length && <label className={styles.field}>Nombre<input key={`${room.id}:${roomLabel?.text ?? ''}`} defaultValue={roomLabel?.text ?? ''}
        placeholder={outdoor ? 'Patio / terraza' : 'Nombre de la estancia'} maxLength={100} onBlur={(event) => renameRoom(event.currentTarget.value)} /></label>}
      <p className={styles.field}>{multiple ? 'Superficie total' : 'Superficie'}: {((multiple ? selectedRooms.reduce((sum, item) => sum + item.areaMm2, 0) : room.areaMm2) / 1e6).toFixed(2)} m²</p>
      <MeterField label="Cota del suelo" valueMm={floorFinish(doc, room.id).elevationMm ?? 0} change={(elevationMm) => apply((d) => setFloorFinish(d, room.id, { elevationMm }))} />
      <p>La superficie depende de las paredes que delimitan la habitación. Selecciona una pared para cambiar su tamaño.</p>
    </PropertySection>}
    {terrain && <TerrainFields surface={terrain} edit={apply} />}
    {dimension && <PropertySection title="Medida del plano">
      <p className={styles.field}>Distancia: <strong>{(Math.hypot(dimension.to.x - dimension.from.x, dimension.to.y - dimension.from.y) / 1000).toFixed(2)} m</strong></p>
      <p>Esta cota marca la distancia entre dos puntos. Puedes arrastrarla para moverla, eliminarla aquí o deshacer su creación. No modifica paredes ni muebles.</p>
    </PropertySection>}
    {wall && <WallProperties key={wall.id} wall={wall} document={doc} store={store} multiple={multiple} edit={apply} />}
    {furniture?.kind === 'carpa' && !partOwner && !multiple && <CarpaSidesField className={styles.field} value={furniture.rolledSides}
      onChange={(rolledSides) => apply((document) => updateFurniture(document, furniture.id, { rolledSides }))} />}
    {furniture && !partOwner && <FurnitureProperties furniture={furniture} multiple={multiple} edit={apply} />}
    {!multiple && furniture && (isBoundary(furniture) || isLegacyBoundary(furniture)) && <BoundaryFields item={furniture} edit={apply} />}
    {!multiple && furniture && isKitchenRun(furniture) && <KitchenFields doc={doc} item={furniture} selectedSlotId={slotOwner?.slot.id} edit={apply} />}
    {opening && <OpeningConstructionFields opening={opening} edit={apply} multiple={multiple} />}
    {stair && <StairConstructionFields stair={stair} edit={apply} />}
    {ramp && <RampConstructionFields ramp={ramp} edit={apply} />}
    {column && <><div className={styles.fields}>{([['x', 'X'], ['y', 'Y'], ['widthMm', 'Ancho'], ['depthMm', 'Fondo'], ['heightMm', 'Altura'], ['elevationMm', 'Elevación']] as const).filter(([key]) => !multiple || (key !== 'x' && key !== 'y')).map(([key, label]) =>
      <MeterField key={key} label={label} valueMm={column[key]} change={(value) => apply((document) => updateColumn(document, column.id, { [key]: value }))} />)}
      {!multiple && <NumberField label="Giro (°)" value={column.rotation} change={(rotation) => apply((document) => updateColumn(document, column.id, { rotation }))} />}</div>
      <SurfaceMaterialPicker label="Material de columna" value={column.materialId} onChange={(materialId) =>
        apply((document) => updateColumn(document, column.id, { materialId: materialId ?? 'concrete-grey' }))} /></>}
    {label && <label className={styles.field}>Texto<input key={label.text} defaultValue={label.text}
      onBlur={(e) => { const text = e.currentTarget.value; apply((d) => editDocument(d, (next) => { next.labels.find((l) => l.id === id)!.text = text; })); }} /></label>}
    <SelectionElementActions store={store} edit={apply} />
    {stair && <button type="button" onClick={() => { try { store.getState().copyStair(stair.id); } catch (error) { store.getState().setError(error instanceof Error ? error.message : 'No se pudo copiar la escalera.'); } }}>Copiar escalera</button>}
    </fieldset>}
    </>}
    <div className={properties.footer}>
      <button type="button" onClick={() => store.getState().select([])}>Quitar selección</button>
      <button type="button" className={properties.delete} disabled={readOnly || !canDelete}
        title={!canDelete ? 'La habitación está delimitada por sus paredes. Edita las paredes para cambiarla.' : undefined} onClick={() => {
          try {
            const current = store.getState();
            current.apply(room && outdoor ? deleteOutdoorRoom(current.document, room.id) : deleteEntities(current.document, selection));
            current.select([]);
          } catch (error) { store.getState().setError(error instanceof Error ? error.message : 'No se pudo eliminar la selección.'); }
        }}>Eliminar{multiple ? ` (${selection.length})` : ''}</button>
    </div>
    </>}
    <p className={styles.hint}>{readOnly ? 'Modo solo lectura.' : 'Ctrl/Cmd + Z deshace. Escape cierra el panel. Puedes cambiar de selección sin cerrarlo.'}</p>
  </aside>;
}
