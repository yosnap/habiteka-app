import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { FURNITURE_CATALOG, getFurnitureCatalogEntry, searchFurnitureCatalog } from '@/lib/editor-document/furniture-catalog';
import { HABITEKA_REGISTRY } from '@/lib/editor-document/habiteka-furniture';
import { furnitureModel } from '@/lib/editor-document/furniture-models';
import { canRestOnHost, isSurfaceHost, restOnHost } from '@/lib/editor-document/object-host-rest';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { addFurniture } from '@/canvas/editor-v2/editing-operations';
import { furnitureRooms } from '@/lib/editor-document/furniture-rooms';

const entry = (key: string) => getFurnitureCatalogEntry(`habiteka:model:${key}_base`)!;
const item = (key: string) => addFurniture(emptyEditorDocument(), entry(key), { x: 1000, y: 1000 }).furniture[0]!;

it.each(['batidora', 'licuadora', 'Thermomix', 'microondas', 'armario superior', 'librería', 'estantería', 'florero',
  'felpudo', 'alfombra', 'hamaca', 'piscina enterrada', 'sombrilla', 'toldo', 'barbacoa', 'tobogán', 'columpio',
  'calle', 'acera', 'guirnalda', 'aire acondicionado', 'Tesla', 'Ford'])('encuentra %s y sus modelos reales', query => {
  const entries = searchFurnitureCatalog(query);
  expect(entries.length).toBeGreaterThan(0);
  expect(entries.some(e => furnitureModel({ catalogId: e.id })?.thumbnailUrl)).toBe(true);
});

it('los aparatos se apoyan en la encimera sin saltar sobre los armarios superiores', () => {
  const document = emptyEditorDocument();
  const counter = { ...item('armario_alto_cocina_900'), id: 'counter', catalogId: 'habiteka:furniture:mesa-cocina',
    kind: 'mesa-cocina', widthMm: 1200, depthMm: 600, heightMm: 900, elevationMm: 0 };
  const upper = { ...item('armario_alto_cocina_900'), id: 'upper', elevationMm: 1450 };
  document.furniture = [counter, upper];
  expect(isSurfaceHost(upper)).toBe(false);
  for (const key of ['batidora_vaso', 'licuadora', 'robot_cocina', 'batidora_amasadora', 'microondas_compacto']) {
    const appliance = item(key);
    expect(canRestOnHost(appliance)).toBe(true);
    expect(restOnHost(document, appliance)).toMatchObject({ hostId: 'counter', elevationMm: 900 });
  }
  expect(canRestOnHost(item('aire_acondicionado_split'))).toBe(false);
  expect(canRestOnHost(item('guirnalda_luces'))).toBe(false);
  expect(canRestOnHost(item('piscina_enterrada_rectangular'))).toBe(false);
});

it('los colgados tienen cota real y las piscinas enterradas no son vasos elevados', () => {
  expect(entry('armario_alto_cocina_600').elevationMm).toBe(1450);
  expect(entry('aire_acondicionado_split').elevationMm).toBe(2100);
  expect(entry('lampara_colgante_cocina').elevationMm).toBe(2000);
  expect(entry('piscina_enterrada_rectangular').heightMm).toBeLessThan(150);
  expect(entry('piscina_enterrada_redonda').heightMm).toBeLessThan(150);
  expect(entry('piscina_redonda_elevada').heightMm).toBeGreaterThan(1100);
});

it('mantiene los vehículos procedurales antiguos resolubles, pero fuera de las nuevas inserciones', () => {
  const entries = FURNITURE_CATALOG.filter(e => HABITEKA_REGISTRY.some(r => r.family === 'movilidad' && e.id === `habiteka:model:${r.id}`));
  expect(entries).toHaveLength(0);
  for (const registry of HABITEKA_REGISTRY.filter(r => r.family === 'movilidad')) {
    const e = getFurnitureCatalogEntry(`habiteka:model:${registry.id}`)!;
    expect(furnitureRooms(e)).toEqual(expect.arrayContaining(['exterior', 'garaje']));
    const model = furnitureModel({ catalogId: e.id })!;
    expect(model.tintMaterialNames).toEqual(['pintura']);
    const glb = readFileSync(`public${model.url.split('?')[0]}`);
    const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString());
    expect(json.materials.map((m: { name: string }) => m.name)).toEqual(expect.arrayContaining(['goma', 'inox', 'pintura']));
  }
});
