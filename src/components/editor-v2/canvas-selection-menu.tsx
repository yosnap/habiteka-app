'use client';
import { planObjects, isBoundary, isLegacyBoundary, boundaryGateOwner } from '@/lib/editor-document/boundary-types';

import { addBoundaryGate, putBoundaryGate } from '@/lib/editor-document/boundary-commands';
import { deriveRoomsSafe } from '@/lib/editor-document/rooms';
import { interiorPoint } from '@/canvas/editor-v2/editing-operations';
import { editableOutdoorRoom, deleteOutdoorRoom } from '@/lib/editor-document/outdoor-editing';
import { useStore } from 'zustand';
import { Copy, MoveHorizontal, FlipHorizontal, FlipVertical, RotateCw, Trash2, DoorOpen, Eye, EyeOff, Paintbrush, MessageSquare } from 'lucide-react';
import { AddWallVertexIcon, CurvedWallIcon, StraightWallIcon } from './wall-action-icons';
import { objectCenter, localToWorld } from '@/lib/editor-document/spatial-properties';
import { updateFurniture } from '@/lib/editor-document/spatial-commands';
import type { EditorStore } from '@/canvas/editor-v2/store';
import type { Point } from '@/lib/editor-document/schema';
import { deleteEntities } from '@/canvas/editor-v2/editing-operations';
import { openingConstruction } from '@/lib/editor-document/construction-properties';
import { setOpeningConstruction, setWallVisibility, updateStair } from '@/lib/editor-document/construction-commands';
import { SelectionContextMenu, type SelectionContextAction } from './selection-context-menu';
import { wallPath } from '@/lib/editor-document/wall-path';
import { fillWallWithOpening } from '@/lib/editor-document/opening-clearance';
import { defaultWallCurve, setWallCurve } from '@/lib/editor-document/curve-commands';

export function CanvasSelectionMenu({ store, view, size }: {
  store: EditorStore; view: Point & { scale: number }; size: { width: number; height: number };
}) {
  const state = useStore(store), id = state.selection.length === 1 ? state.selection[0] : undefined;
  if (!id || state.tool !== 'select') return null;
  const doc = state.document, gateOwner = boundaryGateOwner(state.document, id), wall = doc.walls.find((w) => w.id === id);
  const opening = doc.openings.find((o) => o.id === id), stair = doc.stairs?.find((s) => s.id === id);
  const furniture = planObjects(doc).find((f) => f.id === id), ramp = doc.ramps?.find((r) => r.id === id), column = doc.columns?.find((c) => c.id === id);
  const text = doc.labels.find((entry) => entry.id === id), dimension = doc.dimensions.find((entry) => entry.id === id);
  const light = doc.luminaires?.find((entry) => entry.id === id);
  const room = deriveRoomsSafe(doc).find((r) => r.id === id);
  const outdoor = room && editableOutdoorRoom(doc, room);
  let position: Point | undefined = room ? interiorPoint(room.boundary) : text ?? light ?? (dimension ? { x: (dimension.from.x + dimension.to.x) / 2, y: (dimension.from.y + dimension.to.y) / 2 } : undefined);
  if (wall) {
    position = wallPath(doc, wall).at(.5);
    // The wall itself must remain directly draggable. Keep the radial menu outside
    // its hit area instead of centring its close button over the selected segment.
    const direction = wallPath(doc, wall).tangent(.5);
    position = { x: position.x - direction.y * 190 / view.scale, y: position.y + direction.x * 190 / view.scale };
  }
  else if (opening) {
    const host = doc.walls.find((w) => w.id === opening.wallId);
    if (host) {
      // Igual que con las paredes: el menú se aparta del muro para no tapar el hueco ni sus tiradores.
      const path = wallPath(doc, host), at = path.at(opening.position), direction = path.tangent(opening.position);
      position = { x: at.x - direction.y * 190 / view.scale, y: at.y + direction.x * 190 / view.scale };
    }
  } else { const object = stair ?? furniture ?? ramp ?? column; position = object ? objectCenter(object) : position; }
  if (gateOwner) position = localToWorld(gateOwner.boundary, { x: gateOwner.gate.positionMm, y: gateOwner.boundary.depthMm / 2 });
  if (!position) return null;
  // Leave the central curvature handle available for dragging.
  if (wall?.curveHeightMm) position = { ...position, y: position.y - 160 / view.scale };
  const run = (operation: () => void) => { try { operation(); }
    catch (error) { state.setError(error instanceof Error ? error.message : 'No se pudo editar'); } };
  const actions: SelectionContextAction[] = room && !outdoor ? [] : [{ id: 'delete', label: 'Eliminar', icon: Trash2, danger: true,
    onSelect: () => run(() => { state.apply(outdoor ? deleteOutdoorRoom(doc, id) : deleteEntities(doc, [id])); state.select([]); }) }];
  if (gateOwner) actions.push({ id: 'toggle-gate', label: gateOwner.gate.openAngleDeg ? 'Cerrar puerta' : 'Abrir puerta', icon: DoorOpen,
    onSelect: () => run(() => state.apply(putBoundaryGate(doc, gateOwner.boundary.id, { ...gateOwner.gate, openAngleDeg: gateOwner.gate.openAngleDeg ? 0 : 90 }))) });
  if (room || wall || opening || furniture || stair) actions.push({ id: 'paint', label: room ? 'Textura del suelo' : 'Pintar', icon: Paintbrush, onSelect: () => state.setDetailPanel('paint') });
  if (wall || opening || furniture || stair) actions.push({ id: 'comments', label: 'Comentar', icon: MessageSquare, onSelect: () => state.setDetailPanel('comments') });
  if (furniture) actions.push({ id: 'rotate', label: 'Girar 90°', icon: RotateCw,
    onSelect: () => run(() => state.apply(updateFurniture(doc, id, { rotation: (furniture.rotation + 90) % 360 }))) });
  if (furniture && (isBoundary(furniture) || isLegacyBoundary(furniture))) actions.push({ id: 'add-gate', label: 'Añadir puerta', icon: DoorOpen,
    onSelect: () => run(() => state.apply(addBoundaryGate(doc, id))) });
  if (wall) actions.push({ id: 'split', label: 'Añadir esquina', icon: AddWallVertexIcon,
    onSelect: () => state.beginWallSplit(id) });
  if (wall) actions.push({ id: 'curve', label: wall.curveHeightMm ? 'Pared recta' : 'Curvar pared', icon: wall.curveHeightMm ? StraightWallIcon : CurvedWallIcon,
    onSelect: () => run(() => state.apply(setWallCurve(doc, id, wall.curveHeightMm ? 0 : defaultWallCurve(doc, id)))) });
  if (wall) actions.push({ id: 'visibility', label: wall.hidden ? 'Mostrar pared' : 'Ocultar pared', icon: wall.hidden ? Eye : EyeOff,
    onSelect: () => run(() => state.apply(setWallVisibility(doc, id, !wall.hidden))) });
  if (opening) actions.push({ id: 'copy', label: 'Copiar y colocar', icon: Copy,
    onSelect: () => state.copyOpening(id) },
  { id: 'fill-wall', label: 'Ocupar todo el muro', icon: MoveHorizontal,
    onSelect: () => run(() => state.apply(fillWallWithOpening(doc, id))) });
  if (opening?.kind === 'puerta') {
    const props = openingConstruction(opening);
    actions.push({ id: 'hinge', label: 'Cambiar bisagra', icon: FlipHorizontal,
      onSelect: () => run(() => state.apply(setOpeningConstruction(doc, id, { hinge: props.hinge === 'left' ? 'right' : 'left' }))) },
    { id: 'swing', label: 'Cambiar apertura', icon: FlipVertical,
      onSelect: () => run(() => state.apply(setOpeningConstruction(doc, id, { swing: props.swing === 'left' ? 'right' : 'left' }))) },
    { id: 'open', label: props.openAngleDeg ? 'Cerrar puerta' : 'Abrir puerta', icon: DoorOpen,
      onSelect: () => run(() => state.apply(setOpeningConstruction(doc, id, { openAngleDeg: props.openAngleDeg ? 0 : 90 }))) });
  }
  if (stair) actions.push({ id: 'rotate', label: 'Girar 90°', icon: RotateCw,
    onSelect: () => run(() => state.apply(updateStair(doc, id, { rotation: (stair.rotation + 90) % 360 }))) },
    { id: 'copy-stair', label: 'Copiar escalera', icon: Copy, onSelect: () => run(() => state.copyStair(id)) });
  if (furniture || ramp || column) actions.push({ id: 'copy-spatial', label: 'Copiar', icon: Copy,
    onSelect: () => state.copySpatial(id) });
  const clamp = (n: number, limit: number) => Math.max(Math.min(120, limit / 2), Math.min(limit - 120, n));
  return <SelectionContextMenu anchor={{ x: clamp(position.x * view.scale + view.x, size.width),
    y: clamp(position.y * view.scale + view.y, size.height) }}
    label={text ? 'texto' : dimension ? 'medida' : light ? 'luz' : room ? (outdoor ? 'patio / terraza' : 'suelo') : wall ? 'pared' : opening?.kind ?? (stair ? 'escalera' : ramp ? 'rampa' : column ? 'columna' : 'elemento')}
    actions={actions.map((action) => ({ ...action, disabled: state.readOnly }))} onClose={() => state.select([])} />;
}
