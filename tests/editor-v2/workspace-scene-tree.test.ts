import { expect, it } from 'vitest';
import { Group, Mesh } from 'three';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { deriveRooms } from '@/lib/editor-document/rooms';
import { setRoomCeiling } from '@/lib/editor-document/ceiling-commands';
import { addWallPath } from '@/canvas/editor-v2/editing-operations';
import { createEditorStore } from '@/canvas/editor-v2/store';
import {
  filterSceneTree,
  renameSceneElement,
  sceneTree,
} from '@/components/editor-v2/workspace/workspace-scene-tree';
import { hideSceneElements } from '@/components/editor-v2/scene/scene-element-visibility';

function fixture() {
  const doc = addWallPath(
    emptyEditorDocument(),
    [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 4000, y: 4000 },
      { x: 0, y: 4000 },
    ],
    true,
  );
  doc.openings.push(
    {
      id: 'door',
      wallId: doc.walls[0]!.id,
      kind: 'puerta',
      widthMm: 800,
      position: 0.25,
      dimensionalOrigin: 'physical',
    },
    {
      id: 'window',
      wallId: doc.walls[0]!.id,
      kind: 'ventana',
      widthMm: 700,
      position: 0.75,
      dimensionalOrigin: 'physical',
    },
  );
  return doc;
}

it('relaciona puertas y ventanas con su pared y evita duplicarlas en la raíz', () => {
  const doc = fixture(),
    nodes = sceneTree(doc, deriveRooms(doc));
  expect(
    nodes.find((node) => node.id === doc.walls[0]!.id)?.children.map((child) => child.id),
  ).toEqual(['door', 'window']);
  expect(nodes.some((node) => node.id === 'door' || node.id === 'window')).toBe(false);
});

it('buscar una ventana conserva su pared contenedora y separa pestañas', () => {
  const doc = fixture(),
    nodes = sceneTree(doc, deriveRooms(doc));
  const found = filterSceneTree(nodes, 'structure', 'ventana');
  expect(found).toHaveLength(1);
  expect(found[0]!.children.map((child) => child.id)).toEqual(['window']);
  expect(filterSceneTree(nodes, 'rooms', '').every((node) => node.group === 'Estancias')).toBe(
    true,
  );
});

it('incluye suelos, techos y las luces del techo en Estructura', () => {
  const original = fixture(),
    rooms = deriveRooms(original),
    doc = setRoomCeiling(original, rooms[0]!.id, {});
  const ceiling = doc.ceilings![0]!;
  doc.luminaires = [
    {
      id: 'light',
      ceilingId: ceiling.id,
      kind: 'pendant',
      x: 2000,
      y: 2000,
      dropMm: 500,
      color: '#ffffff',
      temperatureK: 3000,
      lumens: 1000,
      enabled: true,
    },
  ];
  const nodes = filterSceneTree(sceneTree(doc, rooms), 'structure', '');
  expect(nodes.some((node) => node.group === 'Suelos' && node.id === rooms[0]!.id)).toBe(true);
  const roof = nodes.find((node) => node.id === ceiling.id)!;
  expect(roof.propertiesPanel).toBe('ceiling');
  expect(roof.children[0]!.id).toBe('light');
});

it('renombra pared y puerta con los campos originales sin cambiar su geometría', () => {
  const doc = fixture(),
    rooms = deriveRooms(doc);
  const next = renameSceneElement(
    renameSceneElement(doc, doc.walls[0]!.id, 'Fachada norte', rooms),
    'door',
    'Entrada',
    rooms,
  );
  expect(next.walls[0]!.name).toBe('Fachada norte');
  expect(next.openings[0]!.name).toBe('Entrada');
  expect(next.vertices).toEqual(doc.vertices);
  expect(next.openings[0]!.position).toBe(doc.openings[0]!.position);
  expect(doc.walls[0]!.name).toBeUndefined();
});

it('renombra una estancia mediante su etiqueta, sin modificar el perímetro', () => {
  const doc = fixture(),
    rooms = deriveRooms(doc),
    room = rooms[0]!;
  const next = renameSceneElement(doc, room.id, 'Salón', rooms);
  expect(next.labels.some((label) => label.text === 'Salón')).toBe(true);
  expect(next.walls).toEqual(doc.walls);
  expect(sceneTree(next, deriveRooms(next)).find((node) => node.id === room.id)?.label).toBe(
    'Salón',
  );
});

it('oculta visualmente la selección sin editar documento ni crear una revisión', () => {
  const store = createEditorStore(fixture()),
    original = store.getState().document;
  store.getState().select([original.walls[0]!.id, 'door']);
  store.getState().setElementsVisible([original.walls[0]!.id, 'door'], false);
  expect(store.getState().document).toBe(original);
  expect(original.walls[0]!.hidden).toBeUndefined();
  expect(store.getState().selection).toEqual([]);
  expect(store.getState().hiddenElementIds).toContain('window');
  store.getState().setElementsVisible(store.getState().hiddenElementIds, true);
  expect(store.getState().hiddenElementIds).toEqual([]);
});

it('no cambia visibilidad mientras una herramienta de construcción está activa', () => {
  const store = createEditorStore(fixture());
  store.getState().setTool('wall');
  store.getState().setElementsVisible(['door'], false);
  expect(store.getState().hiddenElementIds).toEqual([]);
  expect(store.getState().tool).toBe('wall');
  expect(store.getState().error).toMatch(/Termina/);
});

it('restaura las mallas ocultadas sin mostrar otras que ya eran invisibles', () => {
  const scene = new Group(),
    wall = new Group(),
    opening = new Mesh(),
    originallyHidden = new Mesh();
  wall.userData.buildKey = 'wall';
  opening.userData.sourceEntityId = 'door';
  originallyHidden.visible = false;
  originallyHidden.userData.sourceEntityId = 'door';
  scene.add(wall, opening, originallyHidden);
  const restore = hideSceneElements(scene, new Set(['wall', 'door']));
  expect(wall.layers.mask).toBe(0);
  expect(opening.layers.mask).toBe(0);
  restore();
  expect(wall.visible).toBe(true);
  expect(opening.visible).toBe(true);
  expect(originallyHidden.visible).toBe(false);
});

it('no sobrescribe un cambio nativo de visibilidad mientras la entidad está oculta', () => {
  const scene = new Group(),
    wall = new Group(),
    child = new Mesh();
  wall.userData.buildKey = 'wall';
  wall.add(child);
  scene.add(wall);
  child.layers.set(2);
  const restore = hideSceneElements(scene, new Set(['wall']));
  expect(child.layers.mask).toBe(0);
  wall.visible = false; // Un cambio de techo/muros puede producirse sin cambiar el árbol.
  restore();
  expect(wall.visible).toBe(false);
  expect(child.layers.mask).toBe(4);
});
