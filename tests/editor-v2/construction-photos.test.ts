import { existsSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { CatalogNavigationImage } from '@/components/editor-v2/catalog-navigation-image';
import { CatalogPhoto } from '@/components/editor-v2/catalog-photo';
import { ConstructionCatalog } from '@/components/editor-v2/construction-catalog';
import { constructionSection, type ConstructionCardCategory } from '@/components/editor-v2/construction-cards';
import { ConstructionNavigationImage } from '@/components/editor-v2/construction-navigation-image';
import { CONSTRUCTION_PHOTO_IDS, constructionPhotoSource, constructionPhotoUrl } from '@/components/editor-v2/construction-photos';
import { OpeningTypeCatalog } from '@/components/editor-v2/opening-type-catalog';

const CATEGORIES: ConstructionCardCategory[] = ['patio', 'walls', 'rooms', 'kitchen', 'shapes', 'passages', 'stairs', 'ramps', 'columns'];
const noop = () => {};
const handlers = { readOnly: false, onTool: noop, onShape: noop, onAddStair: noop, onAddRamp: noop, onAddLanding: noop, onAddColumn: noop };
/** Fichas fuera de construction-cards: las superficies del apartado Exterior y jardín. */
const SURFACE_PHOTOS = ['terreno', 'pavimento', 'tejado', 'cristal-tejado', 'ventana-tejado', 'chimenea-tejado'];

describe('fotos de las fichas de Construir', () => {
  it('cada foto es un WebP de 336 × 224 px en public/images/construction', async () => {
    for (const id of CONSTRUCTION_PHOTO_IDS) {
      const file = path.join(process.cwd(), 'public', constructionPhotoUrl(id));
      expect(existsSync(file), file).toBe(true);
      const { format, width, height } = await sharp(file).metadata();
      expect({ id, format, width, height }).toEqual({ id, format: 'webp', width: 336, height: 224 });
    }
  });

  it('asigna a cada ficha su foto y no deja fotos sin ficha', () => {
    const photos = (category: ConstructionCardCategory) => constructionSection(category).cards.map((card) => card.photo);
    expect(photos('walls')).toEqual(['pared', 'murete']);
    expect(photos('rooms')).toEqual(['habitacion', 'habitacion-l', 'habitacion-u', 'habitacion-t']);
    expect(photos('shapes')).toEqual(['forma-l', 'forma-u', 'forma-t']);
    expect(photos('stairs')).toEqual(['escalera-recta', 'escalera-l', 'escalera-u', 'descansillo']);
    expect(photos('ramps')).toEqual(['rampa', 'descansillo']);
    expect(photos('kitchen')).toEqual(['cocina']);
    expect(photos('columns')).toEqual(['columna']);
    expect(photos('passages')).toEqual(['paso-abierto']);
    expect(photos('patio')).toEqual(['patio']);
    const used = new Set([...CATEGORIES.flatMap(photos), ...SURFACE_PHOTOS]);
    expect([...used].sort()).toEqual([...CONSTRUCTION_PHOTO_IDS].sort());
  });

  it('conserva las acciones de cada ficha', () => {
    const actions = Object.fromEntries(CATEGORIES.map((category) => [category, constructionSection(category).cards.map((card) => card.action)]));
    expect(actions).toEqual({
      patio: [{ type: 'tool', tool: 'patio' }],
      walls: [{ type: 'tool', tool: 'wall' }, { type: 'tool', tool: 'guard-wall' }],
      rooms: [{ type: 'tool', tool: 'rectangle' }, { type: 'room-shape', shape: 'L' }, { type: 'room-shape', shape: 'U' }, { type: 'room-shape', shape: 'T' }],
      kitchen: [{ type: 'tool', tool: 'kitchen' }],
      shapes: [{ type: 'coming-soon' }, { type: 'coming-soon' }, { type: 'coming-soon' }],
      passages: [{ type: 'tool', tool: 'passage' }],
      stairs: [{ type: 'stair', kind: 'straight' }, { type: 'stair', kind: 'L' }, { type: 'stair', kind: 'U' }, { type: 'landing' }],
      ramps: [{ type: 'ramp' }, { type: 'landing' }],
      columns: [{ type: 'column' }],
    });
  });

  it('las fichas muestran su foto y ningún dibujo vectorial', () => {
    for (const category of CATEGORIES) {
      const html = renderToStaticMarkup(createElement(ConstructionCatalog, { ...handlers, category }));
      expect(html, category).not.toContain('<svg');
      for (const card of constructionSection(category).cards) expect(html, card.id).toContain(`src="${constructionPhotoUrl(card.photo)}"`);
    }
  });

  it('ofrece piezas y edición del tejado desde Construir con fotografías', () => {
    const html = renderToStaticMarkup(createElement(ConstructionCatalog, { ...handlers, category: 'roof', onRoofAction: noop }));
    for (const id of ['tejado', 'cristal-tejado', 'ventana-tejado', 'chimenea-tejado'] as const) expect(html).toContain(constructionPhotoUrl(id));
    for (const text of ['Editar tejado en plano 2D', 'Ver tejado en 3D', 'Salida de chimenea', 'Ocultar tejado']) expect(html).toContain(text);
    expect(html).not.toContain('<svg');
    const navigation = renderToStaticMarkup(createElement(ConstructionNavigationImage, { category: 'roof' }));
    expect(navigation).toContain('/images/construction/tejado.webp');
  });

  it('no ofrece una ficha si el editor no tiene su comando', () => {
    for (const category of ['stairs', 'columns'] as const) {
      const html = renderToStaticMarkup(createElement(ConstructionCatalog, { readOnly: false, onTool: noop, onShape: noop, category }));
      expect(html, category).not.toContain('<button');
    }
    const ramps = renderToStaticMarkup(createElement(ConstructionCatalog, { readOnly: false, onTool: noop, onShape: noop, onAddLanding: noop, category: 'ramps' }));
    expect(ramps).toContain('descansillo.webp');
    expect(ramps).not.toContain('rampa.webp');
  });

  it('puertas y ventanas no tienen iconos de respaldo', () => {
    for (const kind of ['puerta', 'ventana'] as const) {
      const html = renderToStaticMarkup(createElement(OpeningTypeCatalog, { kind, readOnly: false, onChoose: noop }));
      expect(html, kind).not.toContain('<svg');
      expect(html, kind).toContain('data-photo-state');
    }
  });
});

describe('marcador neutro en lugar de dibujos', () => {
  it('sin foto posible queda el marcador neutro', () => {
    const html = renderToStaticMarkup(createElement(CatalogPhoto, { source: null }));
    expect(html).toContain('data-photo-state="unavailable"');
    expect(html).not.toContain('<svg');
  });

  it('una foto estática muestra el barrido mientras carga', () => {
    const html = renderToStaticMarkup(createElement(CatalogPhoto, { source: constructionPhotoSource('pared') }));
    expect(html).toContain('data-photo-state="loading"');
    expect(html).toContain('src="/images/construction/pared.webp"');
  });

  it('las fotos de navegación por estancia, categoría y apartado no dibujan nada', () => {
    const images = [createElement(CatalogNavigationImage, { room: 'salon' }), createElement(CatalogNavigationImage, { room: 'garaje' }),
      createElement(CatalogNavigationImage, { room: 'cocina', categoryId: 'kitchen' }), createElement(ConstructionNavigationImage, { category: 'stairs' })];
    for (const image of images) {
      const html = renderToStaticMarkup(image);
      expect(html).not.toContain('<svg');
      expect(html).toContain('data-photo-state="loading"');
    }
  });
});
