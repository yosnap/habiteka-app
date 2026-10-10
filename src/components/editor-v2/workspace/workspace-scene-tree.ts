import type { EditorDocument } from '@/lib/editor-document/schema';
import type { DerivedRoom } from '@/lib/editor-document/rooms';
import {
  matchesQuery,
  planElementIndex,
  type PlanElementEntry,
} from '@/lib/editor-document/plan-element-index';
import { planObjects } from '@/lib/editor-document/boundary-types';
import { insideRoom } from '@/lib/editor-document/ceiling-geometry';
import { editDocument, interiorPoint, newId } from '@/canvas/editor-v2/editing-operations';
import { renameDesignZone } from '@/lib/editor-document/design-zone-commands';

export type SceneTab = 'structure' | 'objects' | 'rooms';
export interface SceneTreeNode extends PlanElementEntry {
  children: SceneTreeNode[];
  renamable: boolean;
  hideable?: boolean;
  propertiesPanel?: 'ceiling';
}
export const SCENE_TABS = [
  { id: 'structure', label: 'Estructura', shortcut: 'sceneStructure' },
  { id: 'objects', label: 'Mobiliario', shortcut: 'sceneObjects' },
  { id: 'rooms', label: 'Estancias', shortcut: 'sceneRooms' },
] as const;

/** Paredes y huecos mantienen la relación real wallId; el índice no se duplica. */
export function sceneTree(document: EditorDocument, rooms: DerivedRoom[]): SceneTreeNode[] {
  const namedIds = new Set(
    [
      ...document.walls,
      ...document.openings,
      ...(document.stairs ?? []),
      ...(document.ramps ?? []),
      ...(document.columns ?? []),
      ...planObjects(document),
      ...(document.terrainSurfaces ?? []),
      ...document.labels,
      ...document.dimensions,
    ].map((item) => item.id),
  );
  const nodes = planElementIndex(document, rooms).map((entry) => ({
    ...entry,
    children: [] as SceneTreeNode[],
    renamable: namedIds.has(entry.id) || rooms.some((room) => room.id === entry.id),
  }));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const nested = new Set<string>();
  for (const opening of document.openings) {
    const child = byId.get(opening.id),
      parent = byId.get(opening.wallId);
    if (child && parent) {
      parent.children.push(child);
      nested.add(child.id);
    }
  }
  const floors = nodes
    .filter((node) => node.group === 'Estancias')
    .map((node) => ({ ...node, group: 'Suelos' }));
  const ceilings: SceneTreeNode[] = (document.ceilings ?? []).flatMap((ceiling) => {
    const room = byId.get(ceiling.roomId);
    if (!room) return [];
    return [
      {
        id: ceiling.id,
        label: `Techo · ${room.label}`,
        group: 'Techos',
        point: room.point,
        renamable: false,
        hideable: true,
        propertiesPanel: 'ceiling',
        children: (document.luminaires ?? [])
          .filter((light) => light.ceilingId === ceiling.id)
          .map((light, i) => ({
            id: light.id,
            label: `Luz ${i + 1} · ${light.kind}`,
            group: 'Iluminación',
            point: light,
            children: [],
            renamable: false,
            hideable: true,
            propertiesPanel: 'ceiling' as const,
          })),
      },
    ];
  });
  const zones: SceneTreeNode[] = (document.designZones ?? []).map(zone => ({
    id: zone.id, label: zone.name, group: 'Zonas de diseño', point: interiorPoint(zone.polygon),
    children: [], renamable: true, hideable: false,
  }));
  return [...nodes.filter((node) => !nested.has(node.id)), ...floors, ...ceilings, ...zones];
}

export function filterSceneTree(
  nodes: SceneTreeNode[],
  tab: SceneTab,
  query: string,
): SceneTreeNode[] {
  return nodes
    .filter((node) =>
      tab === 'objects'
        ? node.group === 'Objetos'
        : tab === 'rooms'
          ? ['Estancias', 'Zonas de diseño'].includes(node.group)
          : !['Objetos', 'Estancias', 'Zonas de diseño'].includes(node.group),
    )
    .flatMap((node) => {
      if (!query.trim() || matchesQuery(node, query)) return [node];
      const children = node.children.filter((child) => matchesQuery(child, query));
      return children.length ? [{ ...node, children }] : [];
    });
}

/** Usa los campos de nombre existentes, incluido el texto de las estancias; nunca crea alias paralelos. */
export function renameSceneElement(
  document: EditorDocument,
  id: string,
  value: string,
  rooms: DerivedRoom[],
): EditorDocument {
  if (document.designZones?.some(zone => zone.id === id)) return renameDesignZone(document, id, value);
  const name = value.trim().slice(0, 100),
    room = rooms.find((item) => item.id === id);
  return editDocument(document, (next) => {
    if (room) {
      const label = next.labels.find((item) => insideRoom(item, room.boundary));
      if (label) {
        if (name) label.text = name;
        else next.labels = next.labels.filter((item) => item.id !== label.id);
      } else if (name)
        next.labels.push({ id: newId(), ...interiorPoint(room.boundary), text: name });
      return;
    }
    const label = next.labels.find((item) => item.id === id);
    if (label) {
      if (name) label.text = name;
      return;
    }
    const dimension = next.dimensions.find((item) => item.id === id);
    if (dimension) {
      dimension.label = name || undefined;
      return;
    }
    const terrain = next.terrainSurfaces?.find((item) => item.id === id);
    if (terrain) {
      if (name) terrain.name = name;
      return;
    }
    const entity = [
      ...next.walls,
      ...next.openings,
      ...(next.stairs ?? []),
      ...(next.ramps ?? []),
      ...(next.columns ?? []),
      ...planObjects(next),
    ].find((item) => item.id === id);
    if (!entity) throw new Error('Este elemento se edita desde Propiedades.');
    entity.name = name || undefined;
  });
}
