/** Biblioteca de acabados CC0 (ambientCG y Poly Haven) importada con scripts/import-cc0-materials.mjs. */
import { describe, expect, it } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import cc0Manifest from '../../public/materials/cc0/manifest.json';
import cc0Sources from '../../public/materials/cc0/sources.json';
import legacyManifest from '../../public/materials/polyhaven/manifest.json';
import { SURFACE_CATEGORIES, SURFACE_MATERIALS, surfaceMaterial } from '@/lib/editor-document/surface-materials';
import { LEGACY_SURFACE_NAMES, SURFACE_CATEGORY_ORDER } from '@/lib/editor-document/surface-material-names';

const categories = SURFACE_CATEGORY_ORDER as readonly string[];
/** Descargas y hashes de cada material: fuera del manifiesto para no engordar el paquete del navegador. */
const sources = cc0Sources as Record<string, { downloads: { url: string }[]; files: Record<string, { sha256: string; bytes: number }> }>;
const count = (category: string) => cc0Manifest.filter((material) => material.category === category).length;

describe('biblioteca de materiales CC0', () => {
  it('importa 117 acabados y cinco superficies exteriores CC0 con ids únicos', () => {
    expect(cc0Manifest.filter((material) => material.category !== 'Exterior')).toHaveLength(117);
    expect(cc0Manifest.filter((material) => material.category === 'Exterior').map((material) => material.id).sort()).toEqual([
      'polyhaven:asphalt_02', 'polyhaven:brown_mud_dry', 'polyhaven:gravel_road', 'polyhaven:sand_01', 'polyhaven:wood_chips',
    ]);
    expect(new Set(SURFACE_MATERIALS.map((material) => material.id)).size).toBe(SURFACE_MATERIALS.length);
    for (const material of cc0Manifest) {
      expect(material.license).toBe('CC0-1.0');
      expect(material.id).toMatch(/^(ambientcg|polyhaven):[A-Za-z0-9_]+$/);
      expect(surfaceMaterial(material.id)).toMatchObject({ label: material.label, maps: material.maps });
    }
  });

  it('reparte los materiales por las categorías útiles en una vivienda, con nombre en español', () => {
    for (const category of ['Parqué y tarima', 'Baldosas y porcelánico', 'Baldosa hidráulica y barro', 'Mármol', 'Piedra y terrazo',
      'Microcemento y hormigón', 'Moqueta', 'Azulejo de pared', 'Pintura y estuco', 'Ladrillo visto', 'Madera (paredes y muebles)', 'Fachada']) {
      expect(count(category), category).toBeGreaterThanOrEqual(5);
    }
    for (const material of cc0Manifest) {
      expect(categories).toContain(material.category);
      expect(material.label).not.toBe(material.provenance.title);
      expect(material.label).not.toMatch(/\d{2,}|_/);
    }
    expect(SURFACE_CATEGORIES).toEqual(categories.filter((category) => SURFACE_CATEGORIES.includes(category)));
  });

  it('registra la procedencia: proveedor, id, URL de la ficha y de la descarga, fecha', () => {
    for (const { id, source, authors, provenance } of cc0Manifest) {
      const [provider, assetId] = id.split(':');
      expect(provenance.assetId).toBe(assetId);
      expect(provenance.provider).toBe(provider === 'ambientcg' ? 'ambientCG' : 'Poly Haven');
      expect(source).toBe(provider === 'ambientcg' ? `https://ambientcg.com/view?id=${assetId}` : `https://polyhaven.com/a/${assetId}`);
      expect(authors.length).toBeGreaterThan(0);
      expect(provenance.importedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(sources[id]?.downloads.length).toBeGreaterThan(0);
      for (const download of sources[id]!.downloads) expect(download.url).toMatch(/^https:\/\/([a-z0-9-]+\.)*(ambientcg\.com|struffelproductions\.com|polyhaven\.org)\//);
    }
  });

  it('cada mapa existe, está íntegro, es WebP de 1024 px como máximo y la biblioteca cabe en 60 MB', async () => {
    let total = 0;
    for (const material of cc0Manifest) {
      expect(material.sizeMm.every((n) => Number.isFinite(n) && n >= 50 && n <= 10000), material.id).toBe(true);
      const files = { ...material.maps, preview: material.preview };
      for (const [key, url] of Object.entries(files)) {
        const path = `public${url}`, bytes = readFileSync(path);
        total += statSync(path).size;
        expect(createHash('sha256').update(bytes).digest('hex'), path).toBe(sources[material.id]?.files[key]?.sha256);
        const { format, width = 0, height = 0 } = await sharp(bytes).metadata();
        expect(format, path).toBe('webp');
        expect(Math.max(width, height), path).toBeLessThanOrEqual(key === 'roughness' ? 512 : 1024);
      }
    }
    expect(total).toBeLessThan(60 * 1024 * 1024);
    expect(Object.keys(sources).sort()).toEqual(cc0Manifest.map((material) => material.id).sort());
  });

  it('los materiales históricos conservan su id y pasan a nombre y categoría en español', () => {
    expect(legacyManifest).toHaveLength(61);
    for (const { id } of legacyManifest) {
      const [label, category] = LEGACY_SURFACE_NAMES[id]!;
      expect(surfaceMaterial(id)).toMatchObject({ id, label, category });
      expect(categories).toContain(category);
    }
  });
});
