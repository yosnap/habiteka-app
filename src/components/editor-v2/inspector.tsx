'use client';
import { useState } from 'react';
import { useStore } from 'zustand';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { applyCommand } from '@/lib/editor-document/commands';
import { distance, wallPoints } from '@/lib/editor-document/geometry';
import { assertOpeningClearance } from '@/lib/editor-document/opening-clearance';
import { deleteEntities, editDocument, newId } from '@/canvas/editor-v2/editing-operations';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { updateFurniture } from '@/lib/editor-document/spatial-commands';
import { furnitureSpatial } from '@/lib/editor-document/spatial-properties';
import { MeterField, NumberField } from './property-number-field';
import { OpeningConstructionFields, RampConstructionFields, StairConstructionFields, WallConstructionFields } from './construction-fields';
import styles from './editor.module.css';
export function Inspector({ store }: { store: EditorStore }) {
  const doc = useStore(store, (s) => s.document), selection = useStore(store, (s) => s.selection);
  const readOnly = useStore(store, (s) => s.readOnly);
  const [mergeId, setMergeId] = useState(''), id = selection[0];
  const wall = doc.walls.find((w) => w.id === id), furniture = doc.furniture.find((f) => f.id === id);
  const opening = doc.openings.find((o) => o.id === id), label = doc.labels.find((o) => o.id === id);
  const stair = doc.stairs?.find((item) => item.id === id);
  const ramp = doc.ramps?.find((item) => item.id === id);
  const apply = (operation: (current: EditorDocument) => EditorDocument) => {
    try { store.getState().apply(operation(store.getState().document)); return true; }
    catch (error) { store.getState().setError(error instanceof Error ? error.message : 'Valor inválido'); return false; }
  };
  const meterField = (text: string, valueMm: number, edit: (next: EditorDocument, n: number) => void) =>
    <MeterField label={text} valueMm={valueMm} change={(n) => apply((d) => editDocument(d, (next) => edit(next, n)))} />;
  const points = wall ? wallPoints(doc, wall) : null;
  const selectedEntity = wall ?? opening ?? stair ?? ramp ?? furniture;
  const displayName = (name: string | undefined, fallback: string) => name?.trim() || fallback;
  const updateName = (value: string) => apply((document) => editDocument(document, (next) => {
    const entity = [...next.walls, ...next.openings, ...(next.stairs ?? []), ...(next.ramps ?? []), ...next.furniture]
      .find((item) => item.id === id);
    if (!entity) throw new Error('Elemento no encontrado');
    entity.name = value.trim() || undefined;
  }));
  return <aside className={styles.inspector} aria-label="Propiedades de selección">
    <label className={styles.field}>Elemento del plano<select value={id ?? ''} onChange={(event) => {
      store.getState().setTool('select'); store.getState().select(event.target.value ? [event.target.value] : []);
    }}><option value="">Selecciona un elemento</option>
      {doc.walls.map((item, index) => <option key={item.id} value={item.id}>{displayName(item.name, `Pared ${index + 1}`)}</option>)}
      {doc.openings.map((item, index) => <option key={item.id} value={item.id}>{displayName(item.name, `${item.kind} ${index + 1}`)}</option>)}
      {doc.stairs?.map((item, index) => <option key={item.id} value={item.id}>{displayName(item.name, `Escalera ${item.kind} ${index + 1}`)}</option>)}
      {doc.ramps?.map((item, index) => <option key={item.id} value={item.id}>{displayName(item.name, `Rampa ${index + 1}`)}</option>)}
      {doc.furniture.map((item, index) => <option key={item.id} value={item.id}>{displayName(item.name, `Mueble ${index + 1}`)}</option>)}
      {doc.labels.map((item) => <option key={item.id} value={item.id}>{item.text}</option>)}
    </select></label>
    <fieldset disabled={readOnly} className="m-0 min-w-0 border-0 p-0">
    <h2>{wall ? 'Muro' : furniture ? 'Mueble' : opening ? 'Abertura' : stair ? 'Escalera' : ramp ? 'Rampa' : label ? 'Texto' : 'Propiedades'}</h2>
    {!id && <p>Selecciona un elemento para editar sus medidas. Todas las distancias se expresan en metros.</p>}
    {selectedEntity && <label className={styles.field}>Nombre<input key={selectedEntity.name} defaultValue={selectedEntity.name ?? ''}
      placeholder="Ej. pared lateral" maxLength={100} onBlur={(event) => updateName(event.currentTarget.value)} /></label>}
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
        <button onClick={() => apply((d) => applyCommand(d, { type: 'split-wall', wallId: wall.id,
          position: .5, vertexId: newId(), newWallId: newId() }))}>Dividir al 50%</button>
      </div>
      <label className={styles.field}>Muro para unir<select value={mergeId} onChange={(e) => setMergeId(e.target.value)}>
        <option value="">Elige un muro contiguo</option>
        {doc.walls.filter((w) => w.id !== id && [w.startVertexId, w.endVertexId].some((v) =>
          v === wall.startVertexId || v === wall.endVertexId)).map((w, i) => <option key={w.id} value={w.id}>Contiguo {i + 1} ({(distance(...wallPoints(doc, w)) / 1000).toFixed(2)} m)</option>)}
      </select></label>
      <button disabled={!mergeId} onClick={() => apply((d) => applyCommand(d, { type: 'merge-walls', wallId: wall.id, otherWallId: mergeId }))}>Unir muros</button>
      <WallConstructionFields wall={wall} document={doc} edit={apply} />
    </>}
    {furniture && <div className={styles.fields}>
      {([['x', 'X'], ['y', 'Y'], ['widthMm', 'Ancho'], ['depthMm', 'Fondo'],
        ['heightMm', 'Altura'], ['elevationMm', 'Elevación']] as const).map(([key, label]) =>
        <MeterField key={key} label={label} valueMm={({ ...furniture, ...furnitureSpatial(furniture) })[key]}
          change={(value) => apply((doc) => updateFurniture(doc, furniture.id, { [key]: value }))} />)}
      <NumberField label="Rotación (°)" value={furniture.rotation}
        change={(rotation) => apply((doc) => updateFurniture(doc, furniture.id, { rotation }))} />
    </div>}
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
    {label && <label className={styles.field}>Texto<input key={label.text} defaultValue={label.text}
      onBlur={(e) => { const text = e.currentTarget.value; apply((d) => editDocument(d, (next) => { next.labels.find((l) => l.id === id)!.text = text; })); }} /></label>}
    {id && <button className={styles.danger} onClick={() => {
      apply((d) => deleteEntities(d, selection)); store.getState().select([]);
    }}>Eliminar selección</button>}
    </fieldset>
    <p className={styles.hint}>{readOnly ? 'Modo solo lectura.' : 'Ctrl/Cmd + Z deshace. Escape cancela el trazo. Arrastra los extremos para ajustar un muro.'}</p>
  </aside>;
}
