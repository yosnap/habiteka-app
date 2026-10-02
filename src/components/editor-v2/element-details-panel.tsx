'use client';
import { planObjects, isBoundary } from '@/lib/editor-document/boundary-types';
import { isKitchenRun, type KitchenRun } from '@/lib/editor-document/kitchen-run-types';
import { updateKitchenRun } from '@/lib/editor-document/kitchen-run-commands';

import { AnchoredEditorPanel } from './anchored-editor-panel';
import { elementName } from '@/lib/editor-document/element-classification';
import { useState } from 'react';
import { useStore } from 'zustand';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { paintElement, removeComment, saveComment, setWallSurface } from '@/lib/editor-document/spatial-commands';
import { SurfaceMaterialPicker } from './surface-material-picker';
import { finishColor, furnitureSpatial } from '@/lib/editor-document/spatial-properties';
import type { EditorDocument } from '@/lib/editor-document/schema';
import { wallFaces } from '@/lib/editor-document/wall-faces';
import { furnitureAsset, ORIGINAL_ASSET_COLOR } from '@/lib/editor-document/furniture-assets';

export function ElementDetailsPanel({ store, embedded = false }: { store: EditorStore; embedded?: boolean }) {
  const state = useStore(store), id = state.selection[0];
  const [draft, setDraft] = useState(''), [editing, setEditing] = useState<string | null>(null);
  const doc = state.document, wall = doc.walls.find((w) => w.id === id), opening = doc.openings.find((o) => o.id === id);
  const furniture = planObjects(doc).find((f) => f.id === id), stair = doc.stairs?.find((s) => s.id === id);
  if (!state.detailPanel || !id || !(wall || opening || furniture || stair)) return null;
  if (!embedded && state.sidePanel === 'inspector') return null;
  const run = (operation: (doc: EditorDocument) => EditorDocument) => {
    try { store.getState().apply(operation(store.getState().document)); return true; }
    catch (error) { state.setError(error instanceof Error ? error.message : 'No se pudo guardar'); return false; }
  };
  const surfaces: [string, string, string][] = wall ? wallFaces(doc, wall).map(({ side, label }) =>
    [side, label, wall.colors?.[side] ?? finishColor(wall.materials?.[side] ?? 'plaster-white')])
    : opening ? [['frame', 'Marco', opening.colors?.frame ?? '#f4f1e9'], ...(opening.kind === 'puerta' ? [['leaf', 'Hoja', opening.colors?.leaf ?? '#bb956c'] as [string, string, string]] : [])]
    : furniture && isBoundary(furniture) ? [['base', 'Muro inferior', furniture.construction.baseColor], ['body', 'Valla / seto', furniture.color], ['posts', 'Postes', furniture.construction.postColor]]
    : furniture && isKitchenRun(furniture) ? [['body', 'Frentes', furniture.color], ['worktop', 'Encimera', furniture.kitchen.worktopColor], ['plinth', 'Zócalo', furniture.kitchen.plinthColor],
      ...(furniture.kitchen.uppers ? [['uppers', 'Módulos altos', furniture.kitchen.uppers.color] as [string, string, string]] : [])]
    : [['body', 'Color del elemento', furniture ? furnitureSpatial(furniture).color : stair!.color ?? finishColor(stair!.materialId)]];
  const content = <>
    {!embedded && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
      <strong>{state.detailPanel === 'paint' ? `Pintar · ${furniture ? elementName(furniture) : wall ? 'Pared' : opening ? opening.kind : 'Escalera'}` : 'Comentarios'}</strong>
      <button type="button" aria-label="Cerrar panel" onClick={() => state.setDetailPanel(null)}>×</button>
    </div>}
    <fieldset disabled={state.readOnly} style={{ border: 0, padding: 0 }}>
      {state.detailPanel === 'paint' && wall && <p style={{ fontSize: 12, marginBottom: 16 }}>
        {surfaces.length ? 'Acabados independientes, visibles solamente en 3D.' : 'Cierra la habitación para identificar su interior y exterior.'}
      </p>}
      {state.detailPanel === 'paint' && furniture && furnitureAsset(furniture) && <div style={{ fontSize: 12, marginBottom: 16 }}>
        <p>Tinte global del modelo 3D: conserva texturas y transparencias. No edita materiales por partes.</p>
        <button type="button" onClick={() => run((d) => paintElement(d, id, 'body', ORIGINAL_ASSET_COLOR))}>Restablecer materiales originales</button>
      </div>}
      {state.detailPanel === 'paint' ? surfaces.map(([part, label, color]) => <div key={part}><label
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>{label}
        <input type="color" aria-label={label} value={color} onChange={(e) => run((d) => paintElement(d, id, part, e.target.value))} />
      </label>{wall && <SurfaceMaterialPicker label={label} value={wall.materials?.[part as 'left' | 'right']}
        onChange={(material) => run((d) => setWallSurface(d, id, part as 'left' | 'right', material))} />}
      {furniture && isKitchenRun(furniture) && part !== 'plinth' && <SurfaceMaterialPicker label={label} value={kitchenMaterial(furniture, part)}
        onChange={(material) => run((d) => updateKitchenRun(d, id, { kitchen: withKitchenMaterial(furniture.kitchen, part, material) }))} />}</div>) : <>
        <p style={{ fontSize: 12 }}>Notas del proyecto vinculadas a este elemento.</p>
        {(doc.comments ?? []).filter((c) => c.targetEntityId === id).map((c) => <article key={c.id} style={{ borderBottom: '1px solid #ddd', padding: '12px 0' }}>
          <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{c.text}</p>
          <button type="button" onClick={() => { setEditing(c.id); setDraft(c.text); }}>Editar</button>{' '}
          <button type="button" onClick={() => { if (run((d) => removeComment(d, c.id)) && editing === c.id) { setEditing(null); setDraft(''); } }}>Eliminar comentario</button>
        </article>)}
        <label style={{ display: 'block', marginTop: 16 }}>Comentario
          <textarea aria-label="Comentario" value={draft} maxLength={2000} rows={4} style={{ width: '100%', border: '1px solid #aab', padding: 8 }}
            onChange={(e) => setDraft(e.target.value)} />
        </label>
        <small>{draft.length}/2000</small>
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button type="button" disabled={!draft.trim()} onClick={() => {
            if (run((d) => saveComment(d, { id: editing ?? crypto.randomUUID(), targetEntityId: id, anchor: { x: .5, y: .5 }, text: draft }))) {
              setDraft(''); setEditing(null);
            }
          }}>{editing ? 'Guardar comentario' : 'Añadir comentario'}</button>
          <button type="button" onClick={() => { setDraft(''); setEditing(null); }}>Cancelar</button>
        </div>
      </>}
    </fieldset>
  </>;
  return embedded ? content : <AnchoredEditorPanel store={store} label={state.detailPanel === 'paint' ? 'Pintar elemento' : 'Comentarios del elemento'}>{content}</AnchoredEditorPanel>;
}

/** Material fotografiado de cada parte del mueble de cocina; el zócalo va solo en color. */
function kitchenMaterial(run: KitchenRun, part: string): string | undefined {
  return part === 'worktop' ? run.kitchen.worktopMaterialId : part === 'uppers' ? run.kitchen.uppers?.materialId : run.kitchen.baseMaterialId;
}
function withKitchenMaterial(kitchen: KitchenRun['kitchen'], part: string, material: string | undefined): KitchenRun['kitchen'] {
  if (part === 'worktop') return { ...kitchen, worktopMaterialId: material };
  if (part === 'uppers') return kitchen.uppers ? { ...kitchen, uppers: { ...kitchen.uppers, materialId: material } } : kitchen;
  return { ...kitchen, baseMaterialId: material };
}
