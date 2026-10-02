'use client';
import { useState } from 'react';
import type { EditorStore } from '@/canvas/editor-v2/store';
import type { EditorDocument, Wall } from '@/lib/editor-document/schema';
import { ModernSelect } from '@/components/ui/modern-select';
import { applyCommand } from '@/lib/editor-document/commands';
import { distance, wallPoints } from '@/lib/editor-document/geometry';
import { defaultWallCurve, setWallCurve } from '@/lib/editor-document/curve-commands';
import { setWallVisibility } from '@/lib/editor-document/construction-commands';
import { editDocument, newId } from '@/canvas/editor-v2/editing-operations';
import { MeterField, NumberField } from './property-number-field';
import { WallConstructionFields } from './construction-fields';
import { PropertySection } from './property-section';
import styles from './editor.module.css';
import properties from './selection-properties.module.css';

export function WallProperties({ wall, document, store, multiple, edit }: {
  wall: Wall; document: EditorDocument; store: EditorStore; multiple: boolean;
  edit: (operation: (document: EditorDocument) => EditorDocument) => boolean;
}) {
  const [mergeId, setMergeId] = useState('');
  const points = wallPoints(document, wall);
  const adjacent = document.walls.filter((item) => item.id !== wall.id && [item.startVertexId, item.endVertexId]
    .some((id) => id === wall.startVertexId || id === wall.endVertexId));
  return <>
    <PropertySection title="Dimensiones">
      <div className={styles.fields}>
        {!multiple && <MeterField label={wall.curveHeightMm ? 'Entre extremos' : 'Longitud'} valueMm={distance(...points)} change={(value) => edit((doc) => {
          if (value <= 0) throw new Error('La longitud debe ser positiva.');
          const target = doc.walls.find((item) => item.id === wall.id)!;
          const [a, b] = wallPoints(doc, target), factor = value / distance(a, b);
          return applyCommand(doc, { type: 'move-vertex', vertexId: target.endVertexId, x: a.x + (b.x - a.x) * factor, y: a.y + (b.y - a.y) * factor });
        })} />}
        <MeterField label="Grosor" valueMm={wall.thicknessMm} change={(value) => edit((doc) => editDocument(doc, (next) => {
          next.walls.find((item) => item.id === wall.id)!.thicknessMm = value;
        }))} />
      </div>
      <WallConstructionFields wall={wall} document={document} edit={edit} showSurfaceFields={false} />
    </PropertySection>
    {!multiple && <>
      <PropertySection title="Orientación y forma">
        <div className={styles.fields}>
          <NumberField label="Giro (°)" value={Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x) * 180 / Math.PI} change={(angle) => edit((doc) => {
            const target = doc.walls.find((item) => item.id === wall.id)!, [a, b] = wallPoints(doc, target);
            return applyCommand(doc, { type: 'move-vertex', vertexId: target.endVertexId,
              x: a.x + Math.cos(angle * Math.PI / 180) * distance(a, b), y: a.y + Math.sin(angle * Math.PI / 180) * distance(a, b) });
          })} />
          <MeterField label="Curvatura" valueMm={wall.curveHeightMm ?? 0} change={(value) => edit((doc) => setWallCurve(doc, wall.id, value))} />
        </div>
        <p>Longitud y giro mueven el extremo final y las paredes unidas a él. En una pared curva se mide la distancia entre extremos.</p>
        <button type="button" onClick={() => edit((doc) => setWallCurve(doc, wall.id, wall.curveHeightMm ? 0 : defaultWallCurve(doc, wall.id)))}>
          {wall.curveHeightMm ? 'Pared recta' : 'Curvar pared'}
        </button>
      </PropertySection>
      <PropertySection title="Acciones de pared">
        <div className={properties.actions}>
          <button type="button" onClick={() => store.getState().beginWallSplit(wall.id)}>Añadir esquina</button>
          <button type="button" onClick={() => edit((doc) => applyCommand(doc, { type: 'split-wall', wallId: wall.id, position: .5, vertexId: newId(), newWallId: newId() }))}>Dividir por la mitad</button>
          <button type="button" onClick={() => edit((doc) => applyCommand(doc, { type: 'invert-wall', wallId: wall.id }))}>Invertir sentido</button>
          <button type="button" onClick={() => edit((doc) => setWallVisibility(doc, wall.id, !wall.hidden))}>{wall.hidden ? 'Mostrar pared' : 'Ocultar pared'}</button>
        </div>
        <details className={properties.searchToggle}>
          <summary>Unir con otra pared</summary>
          <label className={styles.field}>Pared contigua<ModernSelect value={mergeId} onChange={(event) => setMergeId(event.target.value)}>
            <option value="">Elige una pared</option>
            {adjacent.map((item, index) => <option key={item.id} value={item.id}>{item.name || `Contigua ${index + 1}`} ({(distance(...wallPoints(document, item)) / 1000).toFixed(2)} m)</option>)}
          </ModernSelect></label>
          <button type="button" disabled={!adjacent.some((item) => item.id === mergeId)} onClick={() => edit((doc) => applyCommand(doc, { type: 'merge-walls', wallId: wall.id, otherWallId: mergeId }))}>Unir paredes</button>
        </details>
      </PropertySection>
    </>}
  </>;
}
