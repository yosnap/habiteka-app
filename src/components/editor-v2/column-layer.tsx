'use client';
import { isElementLocked } from '@/lib/editor-document/element-locks';
import { moveEntity } from '@/canvas/editor-v2/editing-operations';
import { useHiddenElements } from './workspace/use-hidden-elements';
import { snapSpatialDrag } from './magnetic-drag';
import { Group, Rect, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useStore } from 'zustand';
import type { EditorStore } from '@/canvas/editor-v2/store';
import type { Column } from '@/lib/editor-document/schema';
import { surfaceMaterialAppearance } from '@/lib/editor-document/surface-materials';
import { snapObject } from '@/canvas/editor-v2/spatial-placement';
import { clickSelect } from '@/canvas/editor-v2/selection-click';

const ACCENT = '#087f75';
// Referencia estable: un `?? []` dentro del selector devolvería un array nuevo en
// cada lectura y React entraría en bucle de re-render con documentos sin columnas.
const NO_COLUMNS: Column[] = [];
export function ColumnLayer({ store, scale, disabled = false }: { store: EditorStore; scale: number; disabled?: boolean }) {
  const columns = useStore(store, (state) => state.document.columns ?? NO_COLUMNS), selected = useStore(store, (state) => state.selection);
  const hidden = useHiddenElements(store);
  const tool = useStore(store, (state) => state.tool), readOnly = useStore(store, (state) => state.readOnly), unit = 1 / Math.max(scale, .001);
  return <Group>{columns.filter(column => !hidden.has(column.id)).map((column) => <Group key={column.id} x={column.x} y={column.y} rotation={column.rotation}
    draggable={!disabled && !readOnly && !isElementLocked(store.getState().document, column.id) && tool === 'select'}
    onClick={(event) => { if (tool === 'select') { event.cancelBubble = true; clickSelect(store, column.id, event.evt); } }}
    onTap={(event) => { if (tool === 'select') { event.cancelBubble = true; clickSelect(store, column.id, event.evt as unknown as MouseEvent); } }}
    onDragMove={(event) => { event.target.position(snapSpatialDrag(store, { ...column, ...event.target.position() }, scale)); }}
    onDragEnd={(event: KonvaEventObject<DragEvent>) => {
      const state = store.getState(), point = event.target.position(), snapped = snapObject(state.document, { ...column, ...point }, scale, state.snap);
      event.target.position({ x: column.x, y: column.y });
      try { state.apply(moveEntity(state.document, column.id, { x: snapped.x - column.x, y: snapped.y - column.y })); state.select([column.id]); }
      catch (error) { state.setError(error instanceof Error ? error.message : 'No se pudo mover la columna.'); }
    }}>
    <Rect width={column.widthMm} height={column.depthMm} fill={surfaceMaterialAppearance(column.materialId)?.baseColor ?? column.color ?? '#a6a6a0'} stroke={selected.includes(column.id) ? ACCENT : '#48524e'} strokeWidth={2 * unit} />
    <Text text={column.name ?? 'Columna'} x={0} y={column.depthMm / 2 - 6 * unit} width={column.widthMm} align="center"
      rotation={-column.rotation} fontSize={11 * unit} fill={selected.includes(column.id) ? ACCENT : '#48524e'} listening={false} />
  </Group>)}</Group>;
}
