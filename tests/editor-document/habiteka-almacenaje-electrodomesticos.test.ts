/**
 * Familias almacenaje y electrodomésticos de la fábrica de muebles (scripts/furniture-factory/families/almacenaje.mjs y
 * electrodomesticos.mjs, con scripts/blender/fam_almacenaje*.py y fam_electrodomesticos*.py).
 */
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import * as almacenaje from '../../scripts/furniture-factory/families/almacenaje.mjs';
import * as electrodomesticos from '../../scripts/furniture-factory/families/electrodomesticos.mjs';
import { HABITEKA_FURNITURE_CATALOG, HABITEKA_REGISTRY, listedForProposal } from '@/lib/editor-document/habiteka-furniture';
import { furnitureAsset, REALISTIC_ASSET_REPLACEMENTS } from '@/lib/editor-document/furniture-assets';
import { furnitureModel } from '@/lib/editor-document/furniture-models';
import { getFurnitureCatalogEntry, searchFurnitureCatalog, type FurnitureRoom } from '@/lib/editor-document/furniture-catalog';
import { addFurniture } from '@/canvas/editor-v2/editing-operations';
import { emptyEditorDocument } from '@/lib/editor-document/schema';
import { canRestOnHost, restOnHost } from '@/lib/editor-document/object-host-rest';
import { furnitureSpatial } from '@/lib/editor-document/spatial-properties';
import { slotKindFor } from '@/lib/editor-document/kitchen-slot-drop';
import { furniturePhotoSource } from '@/canvas/editor-v2/scene/catalog-photo-subjects';
import { parseEditorDocument } from '@/lib/editor-document/validation';

interface Variant { key: string; dims: number[]; proposal?: boolean; params?: Record<string, unknown> }
interface Product { product: string; type: string; profile: string; room?: string; params?: Record<string, unknown>; variants: Variant[] }
interface Family { FAMILY: { id: string; room: string; dependsOn?: string[] }; PRODUCTS: unknown[] }
interface ManifestModel {
  file: string; thumbnail: string; sha256: string; bytes: number; triangles: number; elevationMm?: number; textures: string[];
  dimensionsMm: number[]; specDimensionsMm: number[];
}
interface Manifest { models: Record<string, ManifestModel>; textures: Record<string, { license: string; source: string }> }

const DIR = 'public/models/habiteka';
const families = [almacenaje, electrodomesticos] as unknown as Family[];
const pieces = families.flatMap((family) => (family.PRODUCTS as Product[]).flatMap((product) => product.variants
  .map((variant) => ({ family: family.FAMILY.id, product, variant, id: `${product.product}_${variant.key}` }))));
const manifests = Object.fromEntries(families.map(({ FAMILY }) => [FAMILY.id,
  JSON.parse(readFileSync(`${DIR}/manifest/${FAMILY.id}.json`, 'utf8')) as Manifest]));
const products = (family: Family) => new Set((family.PRODUCTS as Product[]).map((product) => product.product));
const catalog = (id: string) => getFurnitureCatalogEntry(`habiteka:model:${id}`)!;
const placed = (id: string) => addFurniture(emptyEditorDocument(), catalog(id), { x: 0, y: 0 }).furniture[0]!;

describe('familias de almacenaje y electrodomésticos de la fábrica de muebles', () => {
  it('especifica el surtido pedido con ids únicos, una propuesta por producto y sus módulos de Blender', () => {
    expect(new Set(pieces.map((piece) => piece.id)).size).toBe(pieces.length);
    for (const family of families) {
      for (const builder of [family.FAMILY.id, ...(family.FAMILY.dependsOn ?? [])]) expect(existsSync(`scripts/blender/fam_${builder}.py`), builder).toBe(true);
      for (const product of family.PRODUCTS as Product[]) {
        expect(product.variants.filter((variant) => variant.proposal), product.product).toHaveLength(1);
        if (product.type === 'casework') {
          for (const variant of product.variants) expect(variant.params?.grid ?? product.params?.grid, product.product).toBeInstanceOf(Array);
        }
      }
    }
    const storage = products(almacenaje as unknown as Family);
    for (const id of ['armario_nordico', 'armario_roble', 'armario_corredero', 'armario_corredero_espejo', 'armario_rejilla', 'comoda_roble',
      'comoda_lacada', 'sinfonier', 'comoda_nogal', 'mesilla_roble', 'mesilla_suspendida', 'mesilla_nogal', 'mesilla_ratan', 'mueble_tv_roble',
      'mueble_tv_nogal', 'mueble_tv_suspendido', 'mueble_tv_industrial', 'mueble_tv_rejilla', 'composicion_salon', 'aparador_roble',
      'aparador_rejilla', 'aparador_lacado', 'vitrina_metal', 'libreria_alta', 'estanteria_cubos', 'estanteria_escalera', 'libreria_baja',
      'estante_pared', 'estante_escuadras', 'zapatero_abatible', 'banco_zapatero', 'consola_roble', 'consola_marmol', 'consola_estrecha',
      'mueble_recibidor', 'perchero_pared', 'perchero_pie']) expect(storage.has(id), id).toBe(true);
    expect(pieces.map((piece) => piece.id)).toEqual(expect.arrayContaining(['armario_nordico_1p_50', 'armario_nordico_2p_100', 'armario_nordico_3p_150']));
    const appliances = products(electrodomesticos as unknown as Family);
    for (const id of ['lavadora', 'secadora', 'lavasecadora', 'lavavajillas', 'frigorifico_combi', 'frigorifico_americano', 'microondas',
      'horno_sobremesa', 'cafetera_espresso', 'campana_pared', 'termo_electrico', 'vitroceramica']) expect(appliances.has(id), id).toBe(true);
  });

  it('cada pieza está generada a su medida: GLB íntegro, miniatura WebP, presupuesto y texturas CC0', () => {
    let bytes = 0;
    for (const { family, id } of pieces) {
      const model = manifests[family]!.models[id];
      expect(model, id).toBeDefined();
      if (!model) continue;
      const glb = readFileSync(`${DIR}/${model.file}`);
      expect(glb.readUInt32LE(0)).toBe(0x46546c67);
      expect(createHash('sha256').update(glb).digest('hex'), id).toBe(model.sha256);
      expect(glb.length).toBeLessThanOrEqual(1.5 * 1024 * 1024);
      expect(model.triangles).toBeLessThanOrEqual(40_000);
      expect(readFileSync(`${DIR}/${model.thumbnail}`).subarray(8, 12).toString()).toBe('WEBP');
      model.dimensionsMm.forEach((size, axis) => {
        const spec = model.specDimensionsMm[axis]!;
        expect(Math.abs(size - spec), `${id} eje ${axis}`).toBeLessThanOrEqual(Math.max(30, spec * .04));
      });
      for (const key of model.textures) {
        expect(manifests[family]!.textures[key], `${id}: ${key}`).toMatchObject({ license: 'CC0-1.0' });
        expect(['polyhaven', 'ambientcg']).toContain(manifests[family]!.textures[key]!.source);
      }
      bytes += glb.length + statSync(`${DIR}/${model.thumbnail}`).size;
    }
    expect(bytes).toBeLessThanOrEqual(40 * 1024 * 1024);
  });

  it('aparece en el catálogo en su estancia, con foto, modelo 3D y una variante por producto para Amueblar', () => {
    const rooms: [RegExp, FurnitureRoom][] = [[/^(lavadora|secadora|lavasecadora|termo)/, 'lavadero'],
      [/^(zapatero|banco_zapatero|consola|perchero|mueble_recibidor)/, 'recibidor'], [/^(armario|comoda|sinfonier|mesilla)/, 'dormitorio'],
      [/^(aparador|vitrina)/, 'comedor'], [/^(mueble_tv|composicion|libreria|estanteria|estante)/, 'salon'],
      [/^(lavavajillas|frigorifico|microondas|horno|cafetera|campana|vitroceramica)/, 'cocina']];
    const registry = new Set(HABITEKA_REGISTRY.map((entry) => entry.id));
    for (const { id, product } of pieces) {
      expect(registry.has(id), id).toBe(true);
      const entry = catalog(id);
      expect(entry, id).toBeDefined();
      expect(entry.room, id).toBe(rooms.find(([pattern]) => pattern.test(id))?.[1]);
      expect(entry.profile).toBe(product.profile);
      const asset = furnitureAsset({ catalogId: entry.id })!;
      expect(asset).toMatchObject({ frontRotation: 0, attributionRequired: false });
      expect(existsSync(`public${asset.url}`) && existsSync(`public${asset.thumbnailUrl}`), id).toBe(true);
    }
    const ours = HABITEKA_FURNITURE_CATALOG.filter((entry) => pieces.some((piece) => entry.id === `habiteka:model:${piece.id}`));
    expect(ours.filter(listedForProposal).length).toBe(new Set(pieces.map((piece) => piece.product.product)).size);
    for (const [query, room] of [['lavadora', 'lavadero'], ['armario', 'dormitorio'], ['cómoda', 'dormitorio'], ['mueble de tv', 'salon'],
      ['frigorífico', 'cocina'], ['zapatero', 'recibidor']] as const) {
      expect(searchFurnitureCatalog(query, room).some((entry) => entry.id.startsWith('habiteka:model:')), query).toBe(true);
    }
  });

  it('viste las piezas por código y los activos antiguos con un modelo propio de su misma medida, sin deformarlo', () => {
    const dressed = ['mesita', 'armario', 'armario:grande', 'comoda', 'aparador', 'vitrina', 'zapatero', 'mueble-columna', 'mueble-tv',
      'libreria', 'lavadora', 'secadora', 'lavavajillas', 'frigorifico'].map((id) => `habiteka:furniture:${id}`);
    const replaced = ['armario', 'microondas', 'nevera', 'nevera_americana'];
    expect(replaced.map((key) => REALISTIC_ASSET_REPLACEMENTS[key])).toEqual(replaced.map(() => expect.stringMatching(/^habiteka:model:/)));
    for (const id of [...dressed, ...replaced.map((key) => `habiteka:asset:${key}`)]) {
      const piece = getFurnitureCatalogEntry(id)!, model = furnitureModel({ catalogId: id })!;
      expect(model.url, id).toMatch(/^\/models\/habiteka\//);
      const own = catalog(model.key);
      for (const axis of ['widthMm', 'depthMm', 'heightMm'] as const) {
        expect(Math.abs(own[axis] - piece[axis]) / piece[axis], `${id} → ${model.key} (${axis})`).toBeLessThanOrEqual(.05);
      }
    }
  });

  it('cuelga a su altura real las piezas de pared y apoya el resto, también los aparatos de encimera', () => {
    const hung: Record<string, number> = {
      mesilla_suspendida_45: 420, mueble_tv_suspendido_140: 350, mueble_tv_suspendido_180: 350, estante_pared_80: 1500, estante_pared_120: 1500,
      estante_escuadras_120: 1400, perchero_pared_80: 1600, campana_pared_60: 1550, campana_pared_90: 1550, termo_electrico_50: 1500,
      termo_electrico_80: 1400, termo_electrico_100: 1250,
    };
    for (const { id } of pieces) expect(catalog(id).elevationMm, id).toBe(hung[id] ?? 0);
    // Microondas, horno y cafetera van apoyados: el editor los sube al mueble sobre el que se sueltan; con una cota de
    // catálogo fija quedarían flotando sobre un mueble más bajo que la encimera.
    const microwave = placed('microondas_inox');
    expect(furnitureSpatial(microwave)).toMatchObject({ elevationMm: 0, heightMm: 280 });
    expect(canRestOnHost(microwave)).toBe(true);
    expect(canRestOnHost(placed('frigorifico_combi_inox_186'))).toBe(false);
    const sideboard = catalog('aparador_roble_180');
    const doc = addFurniture(addFurniture(emptyEditorDocument(), sideboard, { x: 0, y: 0 }), catalog('microondas_inox'),
      { x: sideboard.widthMm / 2 - 240, y: sideboard.depthMm / 2 - 190 });
    const [host, onTop] = doc.furniture;
    expect(restOnHost(doc, onTop!)).toMatchObject({ hostId: host!.id, elevationMm: sideboard.heightMm });
    expect(restOnHost(emptyEditorDocument(), onTop!).elevationMm ?? 0).toBe(0);
  });

  it('ofrece una vitrocerámica de encimera en Cocina con foto, apoyo y compatibilidad modular', () => {
    const hob = catalog('vitroceramica_60');
    expect(searchFurnitureCatalog('vitroceramica', 'cocina')).toContainEqual(hob);
    expect(hob).toMatchObject({ widthMm: 600, depthMm: 520, heightMm: 8, elevationMm: 0 });
    const island = getFurnitureCatalogEntry('habiteka:asset:encimera')!;
    const doc = addFurniture(addFurniture(emptyEditorDocument(), island, { x: 0, y: 0 }), hob, { x: 300, y: 40 });
    const [host, item] = doc.furniture;
    const rested = restOnHost(doc, item!);
    expect(rested).toMatchObject({ hostId: host!.id, elevationMm: island.heightMm });
    expect(slotKindFor(item!)).toBe('vitroceramica');
    expect(furniturePhotoSource(item!)).toMatchObject({ kind: 'image', url: '/models/habiteka/thumbs/vitroceramica_60.webp' });
    expect(furnitureModel(item!)?.tintMaterialNames).toEqual(['vidrio']);
    doc.furniture[1] = rested;
    expect(parseEditorDocument(JSON.parse(JSON.stringify(doc))).furniture[1]).toMatchObject({ hostId: host!.id, elevationMm: island.heightMm });
    // La cocina completa histórica sigue disponible como aparato de pie.
    expect(getFurnitureCatalogEntry('habiteka:asset:vitroceramica')?.heightMm).toBe(900);
  });
});
