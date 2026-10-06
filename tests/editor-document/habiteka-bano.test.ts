/** Familia baño de la fábrica de muebles (scripts/furniture-factory/families/bano.mjs + scripts/blender/fam_bano*.py). */
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { FAMILY, PRODUCTS } from '../../scripts/furniture-factory/families/bano.mjs';
import { HABITEKA_FURNITURE_CATALOG, HABITEKA_REGISTRY, listedForProposal } from '@/lib/editor-document/habiteka-furniture';
import { furnitureAsset } from '@/lib/editor-document/furniture-assets';
import { getFurnitureCatalogEntry, searchFurnitureCatalog } from '@/lib/editor-document/furniture-catalog';
import { furnitureModel } from '@/lib/editor-document/furniture-models';

interface Variant { key: string; dims: number[]; proposal?: boolean; params?: Record<string, unknown> }
interface Product { product: string; type: string; profile: string; room?: string; params?: Record<string, unknown>; variants: Variant[] }
interface ManifestModel { file: string; thumbnail: string; sha256: string; bytes: number; triangles: number; elevationMm?: number; textures: string[] }

const DIR = 'public/models/habiteka';
const products = PRODUCTS as Product[];
const pieces = products.flatMap((product) => product.variants.map((variant) => ({ product, variant, id: `${product.product}_${variant.key}` })));
const manifest = JSON.parse(readFileSync(`${DIR}/manifest/bano.json`, 'utf8')) as { models: Record<string, ManifestModel>; textures: Record<string, { license: string; source: string }> };
const registry = new Map(HABITEKA_REGISTRY.filter((entry) => entry.family === 'bano').map((entry) => [entry.id, entry]));
const ids = (prefix: string) => pieces.filter((piece) => piece.id.startsWith(prefix)).map((piece) => piece.id);

describe('familia baño de la fábrica de muebles', () => {
  it('especifica todo el surtido pedido con ids únicos, medidas de mercado y una propuesta por producto', () => {
    expect(FAMILY).toMatchObject({ id: 'bano', room: 'bano' });
    expect(new Set(pieces.map((piece) => piece.id)).size).toBe(pieces.length);
    for (const product of products) {
      expect(product.variants.filter((variant) => variant.proposal), product.product).toHaveLength(1);
      for (const variant of product.variants) expect(variant.dims.every((size) => Number.isInteger(size) && size > 0)).toBe(true);
    }
    for (const shape of ['redondo', 'ovalado', 'rectangular']) expect(ids(`lavabo_sobre_encimera_${shape}`).length).toBeGreaterThan(0);
    for (const kind of ['lavabo_suspendido', 'lavabo_pedestal', 'lavabo_semipedestal', 'inodoro_cisterna', 'inodoro_compacto',
      'inodoro_suspendido', 'bide_suelo', 'bide_suspendido', 'banera_empotrada', 'banera_exenta', 'banera_esquina', 'banera_hidromasaje',
      'espejo_rectangular', 'espejo_redondo', 'espejo_led', 'columna_bano', 'toallero_barra', 'radiador_toallero', 'portarrollos']) {
      expect(ids(kind).length, kind).toBeGreaterThan(0);
    }
    for (const width of ['60', '80', '100', '120']) {
      expect(ids('mueble_lavabo_suspendido')).toContain(`mueble_lavabo_suspendido_${width}`);
      expect(ids('mueble_lavabo_suelo')).toContain(`mueble_lavabo_suelo_${width}`);
    }
    expect(ids('mueble_lavabo_doble')).toEqual(expect.arrayContaining(['mueble_lavabo_doble_120', 'mueble_lavabo_doble_140']));
    for (const size of ['80x80', '90x90', '70x120', '80x140', '80x160', '90x180']) expect(ids('plato_ducha')).toContain(`plato_ducha_${size}`);
    for (const shower of ['ducha_walk_in', 'ducha_corredera', 'ducha_angular']) expect(ids(shower).length).toBeGreaterThan(0);
    expect(ids('ducha_').some((id) => id.endsWith('_techo'))).toBe(true);
    expect(ids('banera_empotrada')).toEqual(expect.arrayContaining(['banera_empotrada_160', 'banera_empotrada_170']));
  });

  it('cada pieza está generada: GLB íntegro, miniatura WebP, presupuesto y texturas CC0', () => {
    let bytes = 0;
    for (const { id } of pieces) {
      const model = manifest.models[id];
      expect(model, id).toBeDefined();
      if (!model) continue;
      const glb = readFileSync(`${DIR}/${model.file}`);
      expect(glb.readUInt32LE(0)).toBe(0x46546c67);
      expect(createHash('sha256').update(glb).digest('hex'), id).toBe(model.sha256);
      expect(glb.length).toBeLessThanOrEqual(1.5 * 1024 * 1024);
      expect(model.triangles).toBeLessThanOrEqual(40_000);
      expect(readFileSync(`${DIR}/${model.thumbnail}`).subarray(8, 12).toString()).toBe('WEBP');
      for (const key of model.textures) expect(manifest.textures[key], `${id}: ${key}`).toMatchObject({ license: 'CC0-1.0' });
      bytes += glb.length + statSync(`${DIR}/${model.thumbnail}`).size;
    }
    expect(bytes).toBeLessThanOrEqual(25 * 1024 * 1024);
  });

  it('aparece en el catálogo en la estancia Baño, con su foto, medidas positivas y su perfil sanitario', () => {
    const profiles: Record<string, string> = { lavabo: 'sink', mueble: 'sink', inodoro: 'toilet', bide: 'toilet', plato: 'shower', ducha: 'shower', banera: 'bath' };
    for (const { id } of pieces) {
      const entry = registry.get(id);
      expect(entry, id).toBeDefined();
      const catalog = getFurnitureCatalogEntry(`habiteka:model:${id}`)!;
      expect(catalog).toMatchObject({ room: 'bano', productId: entry!.productId });
      expect([catalog.widthMm, catalog.depthMm, catalog.heightMm].every((size) => size > 0)).toBe(true);
      const asset = furnitureAsset({ catalogId: catalog.id })!;
      expect(existsSync(`public${asset.url}`) && existsSync(`public${asset.thumbnailUrl}`), id).toBe(true);
      const expected = profiles[id.split('_')[0]!];
      if (expected) expect(catalog.profile, id).toBe(expected);
    }
    for (const query of ['lavabo', 'inodoro', 'ducha', 'bañera', 'espejo']) {
      expect(searchFurnitureCatalog(query, 'bano').some((entry) => entry.id.startsWith('habiteka:model:')), query).toBe(true);
    }
    const listed = HABITEKA_FURNITURE_CATALOG.filter((entry) => registry.has(entry.id.slice('habiteka:model:'.length)) && listedForProposal(entry));
    expect(listed).toHaveLength(products.length);
  });

  it('Amueblar dibuja las piezas por código del baño con estos modelos, sin deformarlos', () => {
    const assigned: Record<string, string> = {
      inodoro: 'inodoro_cisterna_blanco', banera: 'banera_empotrada_170x75_repisa', 'banera-compacta': 'banera_empotrada_140_repisa',
      ducha: 'plato_ducha_90x90', 'columna-bano': 'columna_bano_suelo_blanca',
    };
    for (const [code, id] of Object.entries(assigned)) {
      const piece = getFurnitureCatalogEntry(`habiteka:furniture:${code}`)!, model = registry.get(id)!;
      expect(furnitureModel({ catalogId: piece.id })?.url, code).toBe(`/models/habiteka/${model.file}`);
      const ratios = [piece.widthMm / model.widthMm, piece.depthMm / model.depthMm, piece.heightMm / model.heightMm];
      expect(ratios.every((ratio) => Math.abs(ratio - 1) <= .06), `${code}: ${ratios.join(' ')}`).toBe(true);
      expect(model.elevationMm ?? 0).toBe(piece.elevationMm);
    }
    // El lavabo por código mide 850 mm hasta la encimera; los de la fábrica llegan a 1045 con el grifo.
    expect(furnitureModel({ catalogId: 'habiteka:furniture:lavabo' })?.url).not.toMatch(/^\/models\/habiteka\//);
  });

  it('las piezas colgadas se colocan a su cota real y las de suelo apoyan en él', () => {
    const elevation = (id: string) => getFurnitureCatalogEntry(`habiteka:model:${id}`)!.elevationMm;
    expect(elevation('mueble_lavabo_suspendido_80')).toBe(350);
    expect(elevation('mueble_lavabo_doble_140')).toBe(350);
    expect(elevation('inodoro_suspendido_blanco')).toBe(200);
    expect(elevation('bide_suspendido_blanco')).toBe(200);
    expect(elevation('espejo_rectangular_80')).toBe(1050);
    expect(elevation('espejo_redondo_80')).toBe(1050);
    expect(elevation('columna_bano_blanca')).toBe(350);
    for (const id of ['lavabo_suspendido_60', 'lavabo_semipedestal_60', 'toallero_barra_60', 'portarrollos_cromo', 'estante_bano_60']) {
      expect(elevation(id), id).toBeGreaterThan(300);
    }
    for (const id of ['mueble_lavabo_suelo_80', 'lavabo_pedestal_65', 'inodoro_compacto_blanco', 'inodoro_cisterna_blanco', 'bide_suelo_blanco',
      'plato_ducha_80x140', 'ducha_walk_in_80x140', 'banera_empotrada_170', 'banera_exenta_170', 'banera_esquina_140', 'columna_bano_suelo_blanca']) {
      expect(elevation(id), id).toBe(0);
    }
  });
});
