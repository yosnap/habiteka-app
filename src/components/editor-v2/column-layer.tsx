'use client';
import { snapSpatialDrag } from './magnetic-drag';
import { Group, Rect, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useStore } from 'zustand';
import type { EditorStore } from '@/canvas/editor-v2/store';
import { updateColumn } from '@/lib/editor-document/construction-commands';
import type { Column } from '@/lib/editor-document/schema';
import { snapObject } from '@/canvas/editor-v2/spatial-placement';

const ACCENT = '#087f75';
// Referencia estable: un `?? []` dentro del selector devolvería un array nuevo en
// cada lectura y React entraría en bucle de re-render con documentos sin columnas.
const NO_COLUMNS: Column[] = [];
export function ColumnLayer({ store, scale, disabled = false }: { store: EditorStore; scale: number; disabled?: boolean }) {
  const columns = useStore(store, (state) => state.document.columns ?? NO_COLUMNS), selected = useStore(store, (state) => state.selection);
  const tool = useStore(store, (state) => state.tool), readOnly = useStore(store, (state) => state.readOnly), unit = 1 / Math.max(scale, .001);
  return <Group>{columns.map((column) => <Group key={column.id} x={column.x} y={column.y} rotation={column.rotation}
    draggable={!disabled && !readOnly && tool === 'select'}
    onClick={(event) => { if (tool === 'select') { event.cancelBubble = true; store.getState().select([column.id]); } }}
    onTap={(event) => { if (tool === 'select') { event.cancelBubble = true; store.getState().select([column.id]); } }}
    onDragMove={(event) => { event.target.position(snapSpatialDrag(store, { ...column, ...event.target.position() }, scale)); }}
    onDragEnd={(event: KonvaEventObject<DragEvent>) => {
      const state = store.getState(), point = event.target.position(), snapped = snapObject(state.document, { ...column, ...point }, scale, state.snap);
      event.target.position({ x: column.x, y: column.y });
      try { state.apply(updateColumn(state.document, column.id, { x: snapped.x, y: snapped.y })); state.select([column.id]); }
      catch (error) { state.setError(error instanceof Error ? error.message : 'No se pudo mover la columna.'); }
    }}>
    <Rect width={column.widthMm} height={column.depthMm} fill={column.color ?? '#a6a6a0'} stroke={selected.includes(column.id) ? ACCENT : '#48524e'} strokeWidth={2 * unit} />
    <Text text={column.name ?? 'Columna'} x={0} y={column.depthMm / 2 - 6 * unit} width={column.widthMm} align="center"
      rotation={-column.rotation} fontSize={11 * unit} fill={selected.includes(column.id) ? ACCENT : '#48524e'} listening={false} />
  </Group>)}</Group>;
}
